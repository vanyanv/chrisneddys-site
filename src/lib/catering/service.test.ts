import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb, type Db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  attachStripeIds,
  createDraftOrder,
  getOrderById,
  setStatus,
  type CreateDraftOrderInput,
} from "./orders";
import { saveCateringSettings } from "./settings";

vi.mock("server-only", () => ({}));

const captureMock = vi.hoisted(() => vi.fn());
const cancelMock = vi.hoisted(() => vi.fn());
const createIntentMock = vi.hoisted(() => vi.fn());
const createRefundMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    paymentIntents: { capture: captureMock, cancel: cancelMock, create: createIntentMock },
    refunds: { create: createRefundMock },
  }),
}));

const emailMocks = vi.hoisted(() => ({
  sendBookedEmail: vi.fn().mockResolvedValue({ sent: false }),
  sendCancelledEmail: vi.fn().mockResolvedValue({ sent: false }),
  sendChangeApprovedEmail: vi.fn().mockResolvedValue({ sent: false }),
  sendChangeDeclinedEmail: vi.fn().mockResolvedValue({ sent: false }),
  sendChangeReceivedEmail: vi.fn().mockResolvedValue({ sent: false }),
  sendDeclinedEmail: vi.fn().mockResolvedValue({ sent: false }),
  sendExpiredEmail: vi.fn().mockResolvedValue({ sent: false }),
  sendFindMyOrdersEmail: vi.fn().mockResolvedValue({ sent: false }),
}));
vi.mock("@/lib/catering/emails", async () => {
  const actual = await vi.importActual<typeof import("./emails")>("./emails");
  return { ...actual, ...emailMocks };
});

import {
  addNote,
  approveChange,
  approveOrder,
  cancelByCustomer,
  declineChange,
  declineOrder,
  expireDue,
  findMyOrders,
  getOrderView,
  markCompleted,
  requestChange,
} from "./service";

const migrationsFolder = fileURLToPath(new URL("../../../drizzle", import.meta.url));

let db: Db;

beforeAll(async () => {
  db = (await getDb()) as unknown as Db;
  await migrate(db as unknown as PgliteDatabase<typeof schema>, { migrationsFolder });
});

beforeEach(async () => {
  Object.values(emailMocks).forEach((m) => m.mockClear());
  captureMock.mockReset().mockResolvedValue({});
  cancelMock.mockReset().mockResolvedValue({});
  createIntentMock.mockReset().mockResolvedValue({ id: "pi_new" });
  createRefundMock.mockReset().mockResolvedValue({ id: "re_new" });
  await saveCateringSettings({ replyHours: 24 }, db);
});

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function draftInput(
  overrides: Partial<CreateDraftOrderInput> = {},
): Promise<CreateDraftOrderInput> {
  return {
    store: "hollywood",
    fulfilment: "pickup",
    eventAt: daysFromNow(10),
    headcount: 20,
    contactName: "Pat Customer",
    contactEmail: "pat@example.com",
    contactPhone: "555-1234",
    items: [
      {
        itemId: "single-patty-slider",
        itemName: "Single Patty Slider",
        qty: 10,
        wayId: null,
        toppings: ["lettuce"],
        toppingLabels: ["Lettuce"],
        unitCents: 649,
        amountCents: 6490,
      },
    ],
    foodCents: 6490,
    taxCents: 633,
    totalCents: 7123,
    ...overrides,
  };
}

/** A `requested` order, ready for approve/decline/cancel/change tests. */
async function requestedOrder(
  overrides: Partial<CreateDraftOrderInput> = {},
  respondBy: Date = daysFromNow(1),
) {
  const draft = await createDraftOrder(await draftInput(overrides), db);
  await attachStripeIds(
    draft.orderId,
    { paymentIntentId: "pi_1", customerId: "cus_1", paymentMethodId: "pm_1" },
    db,
  );
  await setStatus(draft.orderId, "requested", { requestedAt: new Date(), respondBy }, db);
  return draft;
}

async function bookedOrder(overrides: Partial<CreateDraftOrderInput> = {}) {
  const draft = await requestedOrder(overrides);
  await setStatus(draft.orderId, "booked", { approvedAt: new Date() }, db);
  return draft;
}

describe("getOrderView", () => {
  it("returns {ok:false} for an unknown token", async () => {
    const view = await getOrderView(db, "no-such-token");
    expect(view.ok).toBe(false);
  });

  it("returns the order, events, cancellation quote and cancel/change flags", async () => {
    const draft = await requestedOrder();
    const view = await getOrderView(db, draft.token);
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.order.id).toBe(draft.orderId);
    expect(view.canCancel).toBe(true);
    expect(view.canChange).toBe(true);
    expect(view.cancellationQuote.tier).toBe("free");
  });

  it("lazily expires an overdue requested order on read", async () => {
    const draft = await createDraftOrder(await draftInput(), db);
    await attachStripeIds(draft.orderId, { paymentIntentId: "pi_expired" }, db);
    await setStatus(
      draft.orderId,
      "requested",
      { requestedAt: daysFromNow(-2), respondBy: daysFromNow(-1) },
      db,
    );

    const view = await getOrderView(db, draft.token);
    expect(view.ok).toBe(true);
    if (view.ok) expect(view.order.status).toBe("expired");
    expect(cancelMock).toHaveBeenCalledWith("pi_expired");
    expect(emailMocks.sendExpiredEmail).toHaveBeenCalledTimes(1);
  });
});

describe("cancelByCustomer", () => {
  it("releases the hold for free before capture, regardless of how close the event is", async () => {
    const draft = await requestedOrder({ eventAt: daysFromNow(0.1) }); // ~2.4h out
    const result = await cancelByCustomer(db, draft.token);
    expect(result).toEqual({ ok: true });
    expect(cancelMock).toHaveBeenCalledWith("pi_1");
    expect(createRefundMock).not.toHaveBeenCalled();

    const order = await getOrderById(draft.orderId, db);
    expect(order?.status).toBe("cancelled");
    expect(order?.refundedCents).toBe(0);
    expect(emailMocks.sendCancelledEmail).toHaveBeenCalledWith(expect.anything(), 0);
  });

  it("refunds the full tier amount after capture, 48h+ out", async () => {
    const draft = await bookedOrder({ eventAt: daysFromNow(10) });
    const result = await cancelByCustomer(db, draft.token);
    expect(result).toEqual({ ok: true });
    expect(createRefundMock).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_1", amount: 7123 }),
    );
    expect(emailMocks.sendCancelledEmail).toHaveBeenCalledWith(expect.anything(), 7123);
  });

  it("refunds half after capture, 24-48h out", async () => {
    const draft = await bookedOrder({ eventAt: daysFromNow(1.2) }); // ~29h out
    await cancelByCustomer(db, draft.token);
    expect(createRefundMock).toHaveBeenCalledWith(expect.objectContaining({ amount: 3562 }));
  });

  it("refunds nothing after capture, inside 24h", async () => {
    const draft = await bookedOrder({ eventAt: daysFromNow(0.2) }); // ~4.8h out
    await cancelByCustomer(db, draft.token);
    expect(createRefundMock).not.toHaveBeenCalled();
    const order = await getOrderById(draft.orderId, db);
    expect(order?.refundedCents).toBe(0);
  });

  it("refuses to cancel an already-declined order", async () => {
    const draft = await requestedOrder();
    await setStatus(draft.orderId, "declined", { declinedAt: new Date(), declineReason: "x" }, db);
    const result = await cancelByCustomer(db, draft.token);
    expect(result.ok).toBe(false);
  });
});

describe("requestChange / approveChange / declineChange", () => {
  it("stashes a re-priced pending change and emails the customer", async () => {
    const draft = await requestedOrder({ eventAt: daysFromNow(10) });
    const result = await requestChange(db, draft.token, {
      lines: [
        {
          itemId: "single-patty-slider",
          qty: 20,
          wayId: null,
          toppings: ["lettuce"],
          extras: [],
        },
      ],
      headcount: 40,
    });
    expect(result).toEqual({ ok: true });

    const order = await getOrderById(draft.orderId, db);
    expect(order?.pendingChange?.foodCents).toBe(12980); // 20 × $6.49
    expect(order?.totalCents).toBe(7123); // unchanged until approved
    expect(emailMocks.sendChangeReceivedEmail).toHaveBeenCalledTimes(1);
  });

  it("rejects a change within 48 hours of the event", async () => {
    const draft = await requestedOrder({ eventAt: daysFromNow(1) });
    const result = await requestChange(db, draft.token, {
      lines: [{ itemId: "single-patty-slider", qty: 1, wayId: null, toppings: [], extras: [] }],
      headcount: 5,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid line rather than trusting it", async () => {
    const draft = await requestedOrder({ eventAt: daysFromNow(10) });
    const result = await requestChange(db, draft.token, {
      lines: [{ itemId: "not-a-real-item", qty: 1, wayId: null, toppings: [], extras: [] }],
      headcount: 5,
    });
    expect(result.ok).toBe(false);
  });

  it("approving a change that costs more re-authorizes before capture", async () => {
    const draft = await requestedOrder({ eventAt: daysFromNow(10) });
    await requestChange(db, draft.token, {
      lines: [
        { itemId: "single-patty-slider", qty: 40, wayId: null, toppings: ["lettuce"], extras: [] },
      ],
      headcount: 40,
    });

    const result = await approveChange(db, draft.orderId);
    expect(result).toEqual({ ok: true });
    expect(cancelMock).toHaveBeenCalledWith("pi_1");
    expect(createIntentMock).toHaveBeenCalledWith(
      expect.objectContaining({ capture_method: "manual", off_session: true }),
    );

    const order = await getOrderById(draft.orderId, db);
    expect(order?.pendingChange).toBeNull();
    expect(order?.foodCents).toBe(25960); // 40 × $6.49
    expect(order?.stripePaymentIntentId).toBe("pi_new");
    expect(emailMocks.sendChangeApprovedEmail).toHaveBeenCalledTimes(1);
  });

  it("approving a costlier change after capture charges the difference off-session", async () => {
    const draft = await bookedOrder({ eventAt: daysFromNow(10) });
    await requestChange(db, draft.token, {
      lines: [
        { itemId: "single-patty-slider", qty: 20, wayId: null, toppings: ["lettuce"], extras: [] },
      ],
      headcount: 20,
    });

    const result = await approveChange(db, draft.orderId);
    expect(result).toEqual({ ok: true });
    expect(createIntentMock).toHaveBeenCalledWith(
      expect.objectContaining({ off_session: true, confirm: true }),
    );
  });

  it("approving a cheaper change after capture refunds the difference", async () => {
    const draft = await bookedOrder({ eventAt: daysFromNow(10) });
    await requestChange(db, draft.token, {
      lines: [
        { itemId: "single-patty-slider", qty: 2, wayId: null, toppings: ["lettuce"], extras: [] },
      ],
      headcount: 5,
    });

    const result = await approveChange(db, draft.orderId);
    expect(result).toEqual({ ok: true });
    expect(createRefundMock).toHaveBeenCalled();
    expect(createIntentMock).not.toHaveBeenCalled();
  });

  it("declining a change leaves the order untouched", async () => {
    const draft = await requestedOrder({ eventAt: daysFromNow(10) });
    await requestChange(db, draft.token, {
      lines: [{ itemId: "single-patty-slider", qty: 99, wayId: null, toppings: [], extras: [] }],
      headcount: 40,
    });

    const before = await getOrderById(draft.orderId, db);
    const result = await declineChange(db, draft.orderId, "Not available that day.");
    expect(result).toEqual({ ok: true });

    const after = await getOrderById(draft.orderId, db);
    expect(after?.pendingChange).toBeNull();
    expect(after?.foodCents).toBe(before?.foodCents);
    expect(emailMocks.sendChangeDeclinedEmail).toHaveBeenCalledWith(
      expect.anything(),
      "Not available that day.",
    );
  });
});

describe("approveOrder / declineOrder", () => {
  it("approve captures the payment intent and books the order", async () => {
    const draft = await requestedOrder();
    const result = await approveOrder(db, draft.orderId);
    expect(result).toEqual({ ok: true });
    expect(captureMock).toHaveBeenCalledWith("pi_1");
    const order = await getOrderById(draft.orderId, db);
    expect(order?.status).toBe("booked");
    expect(emailMocks.sendBookedEmail).toHaveBeenCalledTimes(1);
  });

  it("decline cancels the payment intent and declines the order", async () => {
    const draft = await requestedOrder();
    const result = await declineOrder(db, draft.orderId, "Fully booked that day.");
    expect(result).toEqual({ ok: true });
    expect(cancelMock).toHaveBeenCalledWith("pi_1");
    const order = await getOrderById(draft.orderId, db);
    expect(order?.status).toBe("declined");
    expect(order?.declineReason).toBe("Fully booked that day.");
    expect(emailMocks.sendDeclinedEmail).toHaveBeenCalledWith(
      expect.anything(),
      "Fully booked that day.",
    );
  });

  it("refuses to approve a non-requested order", async () => {
    const draft = await bookedOrder();
    const result = await approveOrder(db, draft.orderId);
    expect(result.ok).toBe(false);
  });
});

describe("markCompleted / addNote", () => {
  it("marks a booked order completed", async () => {
    const draft = await bookedOrder();
    const result = await markCompleted(db, draft.orderId);
    expect(result).toEqual({ ok: true });
    const order = await getOrderById(draft.orderId, db);
    expect(order?.status).toBe("completed");
  });

  it("appends an owner note and records an event", async () => {
    const draft = await requestedOrder();
    const result = await addNote(db, draft.orderId, "Called to confirm headcount.");
    expect(result).toEqual({ ok: true });
    const order = await getOrderById(draft.orderId, db);
    expect(order?.ownerNote).toContain("Called to confirm headcount.");
  });
});

describe("expireDue", () => {
  it("expires every requested order past its respond-by time", async () => {
    const overdue = await requestedOrder({}, daysFromNow(-1));
    const notYet = await requestedOrder();

    const result = await expireDue(db, new Date());
    expect(result.ok).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(1);

    const expiredOrder = await getOrderById(overdue.orderId, db);
    expect(expiredOrder?.status).toBe("expired");
    const stillPending = await getOrderById(notYet.orderId, db);
    expect(stillPending?.status).toBe("requested");
  });
});

describe("findMyOrders", () => {
  it("always resolves ok:true whether or not the email matches any order", async () => {
    await requestedOrder({ contactEmail: "known@example.com" });

    const known = await findMyOrders(db, "known@example.com");
    expect(known).toEqual({ ok: true });
    expect(emailMocks.sendFindMyOrdersEmail).toHaveBeenCalled();

    const unknown = await findMyOrders(db, "nobody@example.com");
    expect(unknown).toEqual({ ok: true });
  });
});
