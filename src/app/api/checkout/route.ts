/**
 * POST /api/checkout
 *
 * Turns a bag into a Stripe Checkout Session: quotes the cart, reserves it
 * as a pending order (`createPendingOrder` — editions locked, quantities
 * checked, a 30-minute hold), then asks Stripe for a hosted payment page and
 * hands back its URL. `POST /api/stripe/webhook` is what actually marks the
 * order paid once the customer pays; this route never touches order status
 * beyond "pending" (or "cancelled", if Stripe itself can't be reached).
 *
 * Gated on `isShopOpen()` (`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
 * both set) — a 503 with no reservation made, no Stripe key required to
 * fail closed.
 */
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { brand } from "@/data/brand";
import { getProductBySlug } from "@/lib/catalog";
import { productImage } from "@/lib/merchLd";
import {
  attachStripeSession,
  createPendingOrder,
  getProductLimits,
  getStoreSettings,
  quoteCart,
  releaseExpiredReservations,
  releaseOrder,
  setOrderExpiry,
  type Fulfilment,
  type QuoteLineError,
} from "@/lib/orders";
import { isShopOpen } from "@/lib/shopStatus";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/** More line items than this in one order is not a real cart — reject
 * before touching the database at all. */
const MAX_LINE_ITEMS = 10;

const HOLD_MINUTES = 30;
const SESSION_EXPIRES_SECONDS = HOLD_MINUTES * 60;

/**
 * How much longer the order's hold outlives the Stripe Checkout Session's
 * own `expires_at`. Both start out ~`HOLD_MINUTES` from now, created a few
 * database round-trips apart — with no gap, a customer who pays in the
 * final seconds before Stripe's own expiry could still have their order
 * released by `releaseExpiredReservations` first (it only looks at the
 * order's `expiresAt`), after which `markPaid` would find a `cancelled`
 * order instead of the `pending` one it expects. Setting the order's
 * `expiresAt` to Stripe's `expires_at` plus this grace period (via
 * `setOrderExpiry`, right after the session is created) makes that
 * ordering impossible: the order can never expire before Stripe's own
 * session does.
 */
const EXPIRY_GRACE_MINUTES = 10;

type CheckoutBody = {
  items: { slug: string; quantity: number }[];
  fulfilment: Fulfilment;
};

function badRequest(error: string, code?: string): NextResponse {
  return NextResponse.json(code ? { error, code } : { error }, { status: 400 });
}

/**
 * Sums quantities for repeated slugs into one line per product, in
 * first-seen order. Without this, a cart could repeat the same slug across
 * several line items to slip past `quoteCart`/`createPendingOrder`'s
 * per-line `perOrderLimit` check (each line individually within the limit,
 * the sum across lines over it) — every quantity check downstream
 * (`quoteCart`, `createPendingOrder`) is per-slug, so it must see one merged
 * line per product to enforce the limit correctly.
 */
function mergeDuplicateSlugs(
  items: { slug: string; quantity: number }[],
): { slug: string; quantity: number }[] {
  const order: string[] = [];
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!totals.has(item.slug)) order.push(item.slug);
    totals.set(item.slug, (totals.get(item.slug) ?? 0) + item.quantity);
  }
  return order.map((slug) => ({ slug, quantity: totals.get(slug)! }));
}

/** Parses and shape-checks the request body without touching the database.
 * Returns `null` (having already responded) on anything malformed. */
function parseBody(raw: unknown): CheckoutBody | NextResponse {
  if (typeof raw !== "object" || raw === null) return badRequest("Malformed request.");
  const { items, fulfilment } = raw as Record<string, unknown>;

  if (fulfilment !== "ship" && fulfilment !== "pickup") {
    return badRequest("Choose shipping or pickup.");
  }
  if (!Array.isArray(items) || items.length === 0) {
    return badRequest("Your bag is empty.");
  }
  if (items.length > MAX_LINE_ITEMS) {
    return badRequest("Too many items in one order.");
  }

  const parsed: { slug: string; quantity: number }[] = [];
  for (const raw of items) {
    if (typeof raw !== "object" || raw === null) return badRequest("Malformed request.");
    const { slug, quantity } = raw as Record<string, unknown>;
    if (typeof slug !== "string" || !slug) return badRequest("Malformed request.");
    const qty = Math.floor(Number(quantity));
    if (!Number.isFinite(qty) || qty < 1) return badRequest("Malformed request.");
    parsed.push({ slug, quantity: qty });
  }

  return { items: mergeDuplicateSlugs(parsed), fulfilment };
}

/** Turns a `QuoteLineError` (from `quoteCart` or a race in
 * `createPendingOrder`) into the human, per-item message the bag drawer
 * shows inline — "Only 2 per order.", "Only 1 left.", and so on. */
async function quoteErrorResponse(error: QuoteLineError): Promise<NextResponse> {
  let message: string;

  switch (error.code) {
    case "unknown_product":
      message = "That item isn't in the shop.";
      break;
    case "not_published":
      message = "That item isn't available right now.";
      break;
    case "over_limit": {
      const limits = await getProductLimits(error.slug);
      message = limits
        ? `Only ${limits.perOrderLimit} per order.`
        : "That's more than one order can take.";
      break;
    }
    case "insufficient_stock": {
      const limits = await getProductLimits(error.slug);
      const left = limits?.available ?? 0;
      message = left > 0 ? `Only ${left} left.` : "That item just sold out.";
      break;
    }
  }

  return badRequest(message, error.code);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isShopOpen()) {
    return NextResponse.json({ error: "The shop isn't open yet." }, { status: 503 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = parseBody(raw);
  if (parsed instanceof NextResponse) return parsed;
  const { items, fulfilment } = parsed;

  const settings = await getStoreSettings();
  if (fulfilment === "pickup" && !settings.pickupEnabled) {
    return badRequest("Pickup isn't available right now.");
  }

  // Free anything that timed out before this cart competes for the same stock.
  await releaseExpiredReservations();

  const quote = await quoteCart(items, fulfilment);
  if ("code" in quote) return quoteErrorResponse(quote);

  const pending = await createPendingOrder({
    items,
    fulfilment,
    holdMinutes: HOLD_MINUTES,
  });
  if ("code" in pending) return quoteErrorResponse(pending);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = await Promise.all(
    quote.lines.map(async (line) => {
      const product = await getProductBySlug(line.product.slug);
      const image = product ? productImage(product)[0] : undefined;
      return {
        quantity: line.quantity,
        price_data: {
          currency: quote.currency,
          unit_amount: line.unitPriceCents,
          product_data: {
            name: line.product.name,
            images: image ? [image] : undefined,
          },
        },
      };
    }),
  );

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: lineItems,
    phone_number_collection: { enabled: true },
    automatic_tax: { enabled: true },
    expires_at: Math.floor(Date.now() / 1000) + SESSION_EXPIRES_SECONDS,
    metadata: { orderId: pending.orderId, orderNumber: pending.number, fulfilment },
    client_reference_id: pending.orderId,
    success_url: `${brand.siteUrl}/shop/thanks/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${brand.siteUrl}/shop/?cancelled=1`,
  };

  if (fulfilment === "ship") {
    params.shipping_address_collection = { allowed_countries: settings.shipCountries };
    params.shipping_options = [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: quote.shippingCents, currency: quote.currency },
          display_name: quote.shippingCents === 0 ? "Free shipping" : "Shipping",
        },
      },
    ];
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.create(params);
  } catch {
    // The reservation must not outlive a Stripe session that never
    // existed — release it immediately rather than waiting for
    // `releaseExpiredReservations` to catch it up to 30 minutes later.
    await releaseOrder({ orderId: pending.orderId }, "cancelled");
    return NextResponse.json(
      { error: "Couldn't reach Stripe. Please try again." },
      { status: 502 },
    );
  }

  if (!session.url) {
    await releaseOrder({ orderId: pending.orderId }, "cancelled");
    return NextResponse.json(
      { error: "Couldn't reach Stripe. Please try again." },
      { status: 502 },
    );
  }

  await attachStripeSession(pending.orderId, session.id);

  // Stripe's own `expires_at` is authoritative for when the *session* dies;
  // push the order's hold past it (see `EXPIRY_GRACE_MINUTES`) so the two
  // can't race.
  if (session.expires_at) {
    const graceExpiresAt = new Date((session.expires_at + EXPIRY_GRACE_MINUTES * 60) * 1000);
    await setOrderExpiry(pending.orderId, graceExpiresAt);
  }

  return NextResponse.json({ url: session.url });
}
