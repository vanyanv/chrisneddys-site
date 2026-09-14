import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { attachStripeSession, createPendingOrder, getOrder, markPaid } from "@/lib/orders";

// See the note in src/app/api/checkout/route.test.ts — `server-only` throws
// outside a real Next.js server build, so it's stubbed for every module this
// route pulls in (`shopStatus.ts`/`stripe.ts` indirectly, `email.ts`).
vi.mock("server-only", () => ({}));

const constructEventMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent: constructEventMock } }),
}));

const sendOrderConfirmationMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email", () => ({
  sendOrderConfirmation: sendOrderConfirmationMock,
}));

const migrationsFolder = fileURLToPath(new URL("../../../../../drizzle", import.meta.url));
const SLUG = "foam-trucker-blue";

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
  constructEventMock.mockReset();
  sendOrderConfirmationMock.mockReset();
  sendOrderConfirmationMock.mockResolvedValue({ sent: false, reason: "not configured in tests" });
});

async function post(rawBody: string): Promise<Response> {
  const { POST } = await import("./route");
  const request = new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=fake" },
    body: rawBody,
  });
  return POST(request);
}

/** A pending order, reserved and attached to a fake Checkout Session id —
 * the state `attachStripeSession` leaves behind for the webhook to find. */
async function pendingOrderWithSession(sessionId: string, quantity = 1) {
  const result = await createPendingOrder({
    items: [{ slug: SLUG, quantity }],
    fulfilment: "pickup",
  });
  if ("code" in result) throw new Error(`expected a pending order, got ${result.code}`);
  await attachStripeSession(result.orderId, sessionId);
  return result;
}

/** A paid order with a known Stripe PaymentIntent id — what
 * `getOrderByPaymentIntentId` looks orders up by for `charge.refunded`. */
async function paidOrderWithIntent(paymentIntentId: string) {
  const reservation = await createPendingOrder({
    items: [{ slug: SLUG, quantity: 1 }],
    fulfilment: "pickup",
  });
  if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);
  await markPaid({
    orderId: reservation.orderId,
    paymentIntentId,
    email: "buyer@example.com",
    name: "Test Buyer",
    amounts: { subtotal: 4800, shipping: 0, tax: 0, total: 4800 },
  });
  return reservation.orderId;
}

function chargeRefundedEvent(
  id: string,
  paymentIntentId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    type: "charge.refunded",
    data: {
      object: {
        payment_intent: paymentIntentId,
        refunded: true,
        amount_refunded: 4800,
        ...overrides,
      },
    },
  };
}

function sessionCompletedEvent(
  id: string,
  sessionId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        payment_status: "paid",
        payment_intent: `pi_${sessionId}`,
        customer_details: {
          email: "buyer@example.com",
          name: "Buyer Person",
          phone: "+13235550100",
        },
        collected_information: null,
        metadata: { fulfilment: "pickup" },
        amount_subtotal: 4800,
        amount_total: 4800,
        total_details: { amount_shipping: 0, amount_tax: 0 },
        ...overrides,
      },
    },
  };
}

describe("POST /api/stripe/webhook", () => {
  it("400s on a bad signature", async () => {
    constructEventMock.mockImplementationOnce(() => {
      throw new Error("signature mismatch");
    });
    const res = await post("{}");
    expect(res.status).toBe(400);
  });

  it("503s when STRIPE_WEBHOOK_SECRET isn't set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await post("{}");
    expect(res.status).toBe(503);
    expect(constructEventMock).not.toHaveBeenCalled();
  });

  it("marks the order paid with edition numbers, sends the confirmation email once, and is idempotent on a repeat delivery", async () => {
    const sessionId = "cs_test_paid_1";
    const { orderId } = await pendingOrderWithSession(sessionId);
    const event = sessionCompletedEvent("evt_paid_1", sessionId);

    constructEventMock.mockReturnValueOnce(event);
    const res1 = await post("raw-body");
    expect(res1.status).toBe(200);
    expect(await res1.json()).toEqual({ received: true });

    const order = await getOrder(orderId);
    expect(order?.status).toBe("paid");
    expect(order?.email).toBe("buyer@example.com");
    expect(order?.items[0]?.editionNumber).toEqual(expect.any(Number));
    expect(sendOrderConfirmationMock).toHaveBeenCalledTimes(1);

    // A second delivery of the exact same event id — Stripe retries and
    // duplicate deliveries are both real — must not reprocess it.
    constructEventMock.mockReturnValueOnce(event);
    const res2 = await post("raw-body");
    expect(res2.status).toBe(200);
    expect(await res2.json()).toEqual({ received: true });
    expect(sendOrderConfirmationMock).toHaveBeenCalledTimes(1);

    const orderAfterRepeat = await getOrder(orderId);
    expect(orderAfterRepeat?.status).toBe("paid");
    expect(orderAfterRepeat?.items[0]?.editionNumber).toBe(order?.items[0]?.editionNumber);
  });

  it("releases the reservation on checkout.session.expired", async () => {
    const sessionId = "cs_test_expired_1";
    const { orderId } = await pendingOrderWithSession(sessionId);

    constructEventMock.mockReturnValueOnce({
      id: "evt_expired_1",
      type: "checkout.session.expired",
      data: { object: { id: sessionId } },
    });

    const res = await post("raw-body");
    expect(res.status).toBe(200);

    const order = await getOrder(orderId);
    expect(order?.status).toBe("cancelled");
  });

  it("deletes the idempotency record on a handler failure so a retry gets a real attempt", async () => {
    // `checkout.session.completed` with no matching order (`markPaid` throws)
    // is a real failure mode, not a bug in the test double.
    constructEventMock.mockReturnValueOnce(
      sessionCompletedEvent("evt_failure_1", "cs_test_does_not_exist"),
    );
    const res1 = await post("raw-body");
    expect(res1.status).toBe(500);

    // If the id had stayed claimed, this second delivery would be treated
    // as an already-seen duplicate and short-circuit to 200 with no attempt
    // at `constructEvent` even being re-checked here — instead it retries
    // the same handler and fails the same way, proving the record was
    // rolled back.
    constructEventMock.mockReturnValueOnce(
      sessionCompletedEvent("evt_failure_1", "cs_test_does_not_exist"),
    );
    const res2 = await post("raw-body");
    expect(res2.status).toBe(500);
  });

  it("marks the order refunded on a full (charge.refunded === true) refund", async () => {
    const paymentIntentId = "pi_full_refund_1";
    const orderId = await paidOrderWithIntent(paymentIntentId);

    constructEventMock.mockReturnValueOnce(
      chargeRefundedEvent("evt_full_refund_1", paymentIntentId, {
        refunded: true,
        amount_refunded: 4800,
      }),
    );
    const res = await post("raw-body");
    expect(res.status).toBe(200);

    const order = await getOrder(orderId);
    expect(order?.status).toBe("refunded");
    expect(order?.refundedAt).not.toBeNull();
  });

  it("leaves the order's status alone and appends a note on a partial refund", async () => {
    const paymentIntentId = "pi_partial_refund_1";
    const orderId = await paidOrderWithIntent(paymentIntentId);

    constructEventMock.mockReturnValueOnce(
      chargeRefundedEvent("evt_partial_refund_1", paymentIntentId, {
        refunded: false,
        amount_refunded: 1200,
      }),
    );
    const res = await post("raw-body");
    expect(res.status).toBe(200);

    const order = await getOrder(orderId);
    expect(order?.status).toBe("paid");
    expect(order?.refundedAt).toBeNull();
    expect(order?.notes).toBe("Partial refund of $12.00 in Stripe");
  });
});
