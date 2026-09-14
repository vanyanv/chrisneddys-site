/**
 * POST /api/stripe/webhook
 *
 * Stripe's server-to-server notifications for this shop's Checkout Sessions.
 * Verified with the raw request body (`request.text()`, never `.json()` —
 * signature verification hashes the exact bytes Stripe sent) against
 * `STRIPE_WEBHOOK_SECRET`. Handles four event types:
 *
 * - `checkout.session.completed` / `checkout.session.async_payment_succeeded`
 *   (when `payment_status === "paid"`) — `markPaid()` (assigns edition
 *   numbers, decrements quantity stock), then a confirmation email, then
 *   `catalogueChanged()` so the storefront's "N left" count updates.
 * - `checkout.session.expired` / `checkout.session.async_payment_failed` —
 *   `releaseOrder()` returns the hold to the pool.
 * - `charge.refunded` — looked up by payment intent, `markRefunded()`.
 *
 * Idempotency: `recordStripeEvent(event.id, event.type)` claims the event id
 * before any of the above runs; a second delivery of the same event id
 * returns `false` and this handler skips straight to `{ received: true }`
 * with no reprocessing. If the handler throws after the id is claimed, the
 * claim is undone (`deleteStripeEvent`) before the 500 goes out, so Stripe's
 * automatic retry gets a clean attempt rather than being silently swallowed
 * by an idempotency record for work that never actually finished.
 */
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import {
  catalogueChanged,
  deleteStripeEvent,
  getOrder,
  getOrderByPaymentIntentId,
  markPaid,
  markRefunded,
  recordStripeEvent,
  releaseOrder,
  markStripeEventProcessed,
} from "@/lib/orders";
import type { ShipTo } from "@/db/schema";
import { sendOrderConfirmation } from "@/lib/email";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * The address to store on the order: `collected_information.shipping_details`
 * when Stripe collected one (this API version's home for what used to be
 * `session.shipping_details`), else `customer_details.address` — and only
 * for a `ship` order. A pickup order never has a shipping address, no
 * matter what Stripe collected.
 */
function mapShipTo(
  session: Stripe.Checkout.Session,
  fulfilment: string | undefined,
): ShipTo | null {
  if (fulfilment !== "ship") return null;

  const shipping = session.collected_information?.shipping_details;
  const address = shipping?.address ?? session.customer_details?.address ?? null;
  if (!address) return null;

  return {
    name: shipping?.name ?? session.customer_details?.name ?? "",
    line1: address.line1 ?? "",
    line2: address.line2 ?? null,
    city: address.city ?? "",
    state: address.state ?? "",
    postalCode: address.postal_code ?? "",
    country: address.country ?? "",
  };
}

function paymentIntentId(session: Stripe.Checkout.Session): string {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : (session.payment_intent?.id ?? "");
}

async function handleSessionPaid(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== "paid") return;

  const result = await markPaid({
    sessionId: session.id,
    paymentIntentId: paymentIntentId(session),
    email: session.customer_details?.email ?? "",
    name: session.customer_details?.name ?? "",
    phone: session.customer_details?.phone ?? null,
    shipTo: mapShipTo(session, session.metadata?.fulfilment),
    amounts: {
      subtotal: session.amount_subtotal ?? 0,
      shipping: session.total_details?.amount_shipping ?? 0,
      tax: session.total_details?.amount_tax ?? 0,
      total: session.amount_total ?? 0,
    },
  });

  const order = await getOrder(result.orderId);
  if (order) await sendOrderConfirmation(order);

  catalogueChanged();
}

async function handleSessionReleased(session: Stripe.Checkout.Session): Promise<void> {
  await releaseOrder({ sessionId: session.id }, "expired");
  catalogueChanged();
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const intentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!intentId) return;

  const order = await getOrderByPaymentIntentId(intentId);
  if (!order) return;

  await markRefunded(order.id, {});
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Stripe isn't configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const isNew = await recordStripeEvent(event.id, event.type);
  if (!isNew) return NextResponse.json({ received: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleSessionPaid(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await handleSessionReleased(event.data.object as Stripe.Checkout.Session);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        break;
    }
  } catch (err) {
    // The claim on this event id was premature — undo it so Stripe's retry
    // of the same event gets a real attempt instead of being skipped as a
    // duplicate of work that never finished.
    await deleteStripeEvent(event.id);
    console.error(`stripe webhook: ${event.type} (${event.id}) failed`, err);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  await markStripeEventProcessed(event.id);
  return NextResponse.json({ received: true });
}
