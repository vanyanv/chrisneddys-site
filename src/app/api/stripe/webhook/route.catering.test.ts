import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { createDraftOrder, getOrderById, type CreateDraftOrderInput } from "@/lib/catering/orders";

// See the note in src/app/api/checkout/route.test.ts.
vi.mock("server-only", () => ({}));

const constructEventMock = vi.hoisted(() => vi.fn());
const retrieveIntentMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: constructEventMock },
    paymentIntents: { retrieve: retrieveIntentMock },
  }),
}));

// The merch side of this route also imports these — stub them so the merch
// branch (never exercised by these catering-only events) can't explode.
vi.mock("@/lib/email", () => ({
  sendOrderConfirmation: vi.fn(),
  sendRefundConfirmation: vi.fn(),
}));

const sendRequestReceivedMock = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: false }));
const sendOwnerNewRequestMock = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: false }));
vi.mock("@/lib/catering/emails", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/catering/emails")>("@/lib/catering/emails");
  return {
    ...actual,
    sendRequestReceivedEmail: sendRequestReceivedMock,
    sendOwnerNewRequestEmail: sendOwnerNewRequestMock,
  };
});

const migrationsFolder = fileURLToPath(new URL("../../../../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
  delete process.env.CATERING_FAKE_PAYMENTS;
  constructEventMock.mockReset();
  retrieveIntentMock.mockReset();
  retrieveIntentMock.mockResolvedValue({ payment_method: "pm_test_1" });
  sendRequestReceivedMock.mockClear();
  sendOwnerNewRequestMock.mockClear();
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

function baseDraftInput(overrides: Partial<CreateDraftOrderInput> = {}): CreateDraftOrderInput {
  return {
    store: "hollywood",
    fulfilment: "pickup",
    eventAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    contactName: "Pat Customer",
    contactEmail: "pat@example.com",
    contactPhone: "555-1234",
    items: [
      {
        itemId: "single-patty-slider",
        itemName: "Single Patty Slider",
        qty: 12,
        wayId: null,
        wayLabel: null,
        toppings: ["lettuce"],
        toppingLabels: ["Lettuce"],
        extras: [],
        extraLabels: [],
        unitCents: 649,
        amountCents: 7788,
        forName: null,
        note: null,
      },
    ],
    foodCents: 7788,
    taxCents: 760,
    totalCents: 8548,
    ...overrides,
  };
}

function cateringSessionCompletedEvent(
  id: string,
  cateringOrderId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_catering_${id}`,
        payment_status: "paid",
        payment_intent: `pi_${id}`,
        customer: `cus_${id}`,
        metadata: { cateringOrderId, number: "CAT-1001" },
        ...overrides,
      },
    },
  };
}

function cateringSessionExpiredEvent(id: string, cateringOrderId: string) {
  return {
    id,
    type: "checkout.session.expired",
    data: {
      object: {
        id: `cs_catering_${id}`,
        metadata: { cateringOrderId, number: "CAT-1001" },
      },
    },
  };
}

describe("POST /api/stripe/webhook — catering", () => {
  it("moves a draft catering order to requested and sends both emails on checkout.session.completed", async () => {
    const draft = await createDraftOrder(baseDraftInput());
    constructEventMock.mockReturnValueOnce(
      cateringSessionCompletedEvent("evt_cat_1", draft.orderId),
    );

    const res = await post("raw-body");
    expect(res.status).toBe(200);

    const order = await getOrderById(draft.orderId);
    expect(order?.status).toBe("requested");
    expect(order?.stripePaymentIntentId).toBe("pi_evt_cat_1");
    expect(order?.stripeCustomerId).toBe("cus_evt_cat_1");
    expect(order?.stripePaymentMethodId).toBe("pm_test_1");
    expect(order?.requestedAt).toBeTruthy();
    expect(order?.respondBy).toBeTruthy();
    expect(sendRequestReceivedMock).toHaveBeenCalledTimes(1);
    expect(sendOwnerNewRequestMock).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: a duplicate delivery doesn't resend the emails", async () => {
    const draft = await createDraftOrder(baseDraftInput());
    const event = cateringSessionCompletedEvent("evt_cat_dup", draft.orderId);

    constructEventMock.mockReturnValueOnce(event);
    await post("raw-body");
    expect(sendRequestReceivedMock).toHaveBeenCalledTimes(1);

    constructEventMock.mockReturnValueOnce(event);
    const res2 = await post("raw-body");
    expect(res2.status).toBe(200);
    expect(sendRequestReceivedMock).toHaveBeenCalledTimes(1);
  });

  it("cancels a still-draft catering order on checkout.session.expired", async () => {
    const draft = await createDraftOrder(baseDraftInput());
    constructEventMock.mockReturnValueOnce(
      cateringSessionExpiredEvent("evt_cat_exp", draft.orderId),
    );

    const res = await post("raw-body");
    expect(res.status).toBe(200);

    const order = await getOrderById(draft.orderId);
    expect(order?.status).toBe("cancelled");
  });
});
