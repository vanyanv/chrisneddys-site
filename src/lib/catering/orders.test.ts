import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  addOwnerNote,
  applyPendingChange,
  attachStripeIds,
  clearPendingChange,
  createDraftOrder,
  findExpirable,
  getOrderById,
  getOrderByToken,
  listOrders,
  listOrdersByEmail,
  recordEvent,
  setPendingChange,
  setStatus,
  type CreateDraftOrderInput,
} from "@/lib/catering/orders";

const migrationsFolder = fileURLToPath(new URL("../../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

function baseInput(overrides: Partial<CreateDraftOrderInput> = {}): CreateDraftOrderInput {
  return {
    store: "hollywood",
    fulfilment: "pickup",
    eventAt: new Date("2026-10-10T18:00:00-07:00"),
    contactName: "Pat Customer",
    contactEmail: "Pat@Example.com",
    contactPhone: "555-1234",
    items: [
      {
        itemId: "sliders-fries",
        itemName: "Sliders and Fries",
        qty: 12,
        wayId: "chriss-way",
        wayLabel: "Chris's Way",
        toppings: ["lettuce", "sauce", "grilled-onion"],
        toppingLabels: ["Lettuce", "Sauce", "Grilled Onion"],
        extras: [],
        extraLabels: [],
        unitCents: 500,
        amountCents: 6000,
        forName: null,
        note: null,
      },
    ],
    foodCents: 6000,
    taxCents: 585,
    totalCents: 6585,
    ...overrides,
  };
}

describe("createDraftOrder", () => {
  it("allocates an increasing CAT- number and a 32+ char url-safe token, snapshots items", async () => {
    const result = await createDraftOrder(baseInput());
    expect(result.number).toMatch(/^CAT-\d+$/);
    expect(result.token.length).toBeGreaterThanOrEqual(32);
    expect(result.token).toMatch(/^[A-Za-z0-9_-]+$/);

    const order = await getOrderById(result.orderId);
    expect(order?.status).toBe("draft");
    expect(order?.number).toBe(result.number);
    expect(order?.token).toBe(result.token);
    expect(order?.items).toHaveLength(1);
    expect(order?.items[0]).toMatchObject({
      itemName: "Sliders and Fries",
      qty: 12,
      wayLabel: "Chris's Way",
      toppingLabels: ["Lettuce", "Sauce", "Grilled Onion"],
      amountCents: 6000,
      position: 0,
    });
  });

  it("hands out a new number and token to each draft", async () => {
    const first = await createDraftOrder(baseInput());
    const second = await createDraftOrder(baseInput());
    expect(second.number).not.toBe(first.number);
    expect(second.token).not.toBe(first.token);
  });

  it("is found by its token, and getOrderByToken returns undefined for an unknown one", async () => {
    const result = await createDraftOrder(baseInput());
    const order = await getOrderByToken(result.token);
    expect(order?.id).toBe(result.orderId);

    const missing = await getOrderByToken("not-a-real-token");
    expect(missing).toBeUndefined();
  });
});

describe("status transitions", () => {
  it("allows draft -> requested -> booked -> completed", async () => {
    const { orderId } = await createDraftOrder(baseInput());

    const toRequested = await setStatus(orderId, "requested", {
      requestedAt: new Date(),
      respondBy: new Date(Date.now() + 24 * 60 * 60_000),
    });
    expect(toRequested).toEqual({ ok: true });
    expect((await getOrderById(orderId))?.status).toBe("requested");

    const toBooked = await setStatus(orderId, "booked", { approvedAt: new Date() });
    expect(toBooked).toEqual({ ok: true });
    expect((await getOrderById(orderId))?.status).toBe("booked");

    const toCompleted = await setStatus(orderId, "completed");
    expect(toCompleted).toEqual({ ok: true });
    expect((await getOrderById(orderId))?.status).toBe("completed");
  });

  it("rejects an invalid transition", async () => {
    const { orderId } = await createDraftOrder(baseInput());
    // Still "draft" — can't jump straight to "booked".
    const result = await setStatus(orderId, "booked");
    expect(result.ok).toBe(false);
    expect((await getOrderById(orderId))?.status).toBe("draft");
  });

  it("rejects any transition out of a terminal status", async () => {
    const { orderId } = await createDraftOrder(baseInput());
    await setStatus(orderId, "requested");
    await setStatus(orderId, "declined", { declinedAt: new Date(), declineReason: "too far" });
    expect((await getOrderById(orderId))?.status).toBe("declined");

    const result = await setStatus(orderId, "booked");
    expect(result.ok).toBe(false);
  });

  it("reports order not found", async () => {
    const result = await setStatus("00000000-0000-0000-0000-000000000000", "requested");
    expect(result).toEqual({ ok: false, error: "Order not found." });
  });
});

describe("attachStripeIds", () => {
  it("sets only the ids given, leaving others untouched", async () => {
    const { orderId } = await createDraftOrder(baseInput());
    await attachStripeIds(orderId, { checkoutSessionId: "cs_test_1", customerId: "cus_test_1" });
    let order = await getOrderById(orderId);
    expect(order?.stripeCheckoutSessionId).toBe("cs_test_1");
    expect(order?.stripeCustomerId).toBe("cus_test_1");
    expect(order?.stripePaymentIntentId).toBeNull();

    await attachStripeIds(orderId, { paymentIntentId: "pi_test_1" });
    order = await getOrderById(orderId);
    expect(order?.stripeCheckoutSessionId).toBe("cs_test_1");
    expect(order?.stripePaymentIntentId).toBe("pi_test_1");
  });
});

describe("recordEvent", () => {
  it("appends a timeline row with actor and detail", async () => {
    const { orderId } = await createDraftOrder(baseInput());
    const event = await recordEvent(orderId, "requested", "system", { note: "card held" });
    expect(event.orderId).toBe(orderId);
    expect(event.kind).toBe("requested");
    expect(event.actor).toBe("system");
    expect(event.detail).toEqual({ note: "card held" });
  });
});

describe("pending change", () => {
  it("sets, applies (replacing items and totals) and clears a pending change", async () => {
    const { orderId } = await createDraftOrder(baseInput());
    await setStatus(orderId, "requested");
    await setStatus(orderId, "booked", { approvedAt: new Date() });

    await setPendingChange(orderId, {
      lines: [
        {
          itemId: "sliders-fries",
          itemName: "Sliders and Fries",
          qty: 24,
          wayId: "chriss-way",
          wayLabel: "Chris's Way",
          toppings: ["lettuce"],
          toppingLabels: ["Lettuce"],
          extras: [],
          extraLabels: [],
          unitCents: 500,
          amountCents: 12000,
          forName: null,
          note: null,
        },
      ],
      plateSets: 2,
      foodCents: 12000,
      deliveryCents: 0,
      taxCents: 1170,
      tipCents: 0,
      totalCents: 13170,
      requestedAt: new Date().toISOString(),
    });

    let order = await getOrderById(orderId);
    expect(order?.pendingChange).not.toBeNull();

    const applied = await applyPendingChange(orderId);
    expect(applied).toEqual({ ok: true });

    order = await getOrderById(orderId);
    expect(order?.pendingChange).toBeNull();
    expect(order?.foodCents).toBe(12000);
    expect(order?.totalCents).toBe(13170);
    expect(order?.items).toHaveLength(1);
    expect(order?.items[0]?.qty).toBe(24);
  });

  it("clearing a pending change leaves the order's own lines and totals alone", async () => {
    const { orderId } = await createDraftOrder(baseInput());
    await setPendingChange(orderId, {
      lines: [],
      plateSets: 0,
      foodCents: 1,
      deliveryCents: 0,
      taxCents: 0,
      tipCents: 0,
      totalCents: 1,
      requestedAt: new Date().toISOString(),
    });
    await clearPendingChange(orderId);
    const order = await getOrderById(orderId);
    expect(order?.pendingChange).toBeNull();
    expect(order?.foodCents).toBe(6000);
  });

  it("refuses to apply a pending change that isn't there", async () => {
    const { orderId } = await createDraftOrder(baseInput());
    const result = await applyPendingChange(orderId);
    expect(result).toEqual({ ok: false, error: "No pending change on this order." });
  });
});

describe("addOwnerNote", () => {
  it("appends, keeping earlier notes", async () => {
    const { orderId } = await createDraftOrder(baseInput());
    await addOwnerNote(orderId, "called to confirm headcount");
    await addOwnerNote(orderId, "confirmed 20");
    const order = await getOrderById(orderId);
    expect(order?.ownerNote).toBe("called to confirm headcount\nconfirmed 20");
  });
});

describe("listOrders tabs", () => {
  it("needs-you: requested orders and booked orders with a pending change", async () => {
    const requested = await createDraftOrder(
      baseInput({ contactEmail: "needs-you-1@example.com" }),
    );
    await setStatus(requested.orderId, "requested");

    const bookedWithChange = await createDraftOrder(
      baseInput({ contactEmail: "needs-you-2@example.com" }),
    );
    await setStatus(bookedWithChange.orderId, "requested");
    await setStatus(bookedWithChange.orderId, "booked");
    await setPendingChange(bookedWithChange.orderId, {
      lines: [],
      plateSets: 0,
      foodCents: 1,
      deliveryCents: 0,
      taxCents: 0,
      tipCents: 0,
      totalCents: 1,
      requestedAt: new Date().toISOString(),
    });

    const rows = await listOrders({ tab: "needs-you" });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(requested.orderId);
    expect(ids).toContain(bookedWithChange.orderId);
  });

  it("upcoming: booked, future event, no pending change", async () => {
    const upcoming = await createDraftOrder(
      baseInput({
        contactEmail: "upcoming@example.com",
        eventAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
      }),
    );
    await setStatus(upcoming.orderId, "requested");
    await setStatus(upcoming.orderId, "booked");

    const rows = await listOrders({ tab: "upcoming" });
    expect(rows.map((r) => r.id)).toContain(upcoming.orderId);

    const needsYou = await listOrders({ tab: "needs-you" });
    expect(needsYou.map((r) => r.id)).not.toContain(upcoming.orderId);
  });

  it("past: settled statuses, and a booked order whose event has passed", async () => {
    const declined = await createDraftOrder(baseInput({ contactEmail: "past-1@example.com" }));
    await setStatus(declined.orderId, "requested");
    await setStatus(declined.orderId, "declined", { declinedAt: new Date() });

    const pastEvent = await createDraftOrder(
      baseInput({
        contactEmail: "past-2@example.com",
        eventAt: new Date(Date.now() - 30 * 24 * 60 * 60_000),
      }),
    );
    await setStatus(pastEvent.orderId, "requested");
    await setStatus(pastEvent.orderId, "booked");

    const rows = await listOrders({ tab: "past" });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(declined.orderId);
    expect(ids).toContain(pastEvent.orderId);
  });

  it("q filters by order number, contact name or email", async () => {
    const order = await createDraftOrder(
      baseInput({ contactName: "Searchable Name", contactEmail: "findme@example.com" }),
    );
    await setStatus(order.orderId, "requested");

    const byNumber = await listOrders({ tab: "needs-you", q: order.number });
    expect(byNumber.map((r) => r.id)).toContain(order.orderId);

    const byName = await listOrders({ tab: "needs-you", q: "searchable" });
    expect(byName.map((r) => r.id)).toContain(order.orderId);

    const byEmail = await listOrders({ tab: "needs-you", q: "findme@" });
    expect(byEmail.map((r) => r.id)).toContain(order.orderId);

    const noMatch = await listOrders({ tab: "needs-you", q: "no-such-thing-at-all" });
    expect(noMatch.map((r) => r.id)).not.toContain(order.orderId);
  });
});

describe("listOrdersByEmail", () => {
  it("matches case-insensitively", async () => {
    const created = await createDraftOrder(baseInput({ contactEmail: "MixedCase@Example.com" }));
    const rows = await listOrdersByEmail("mixedcase@example.com");
    expect(rows.map((r) => r.id)).toContain(created.orderId);
  });

  it("returns nothing for an email with no orders", async () => {
    const rows = await listOrdersByEmail("nobody-here@example.com");
    expect(rows).toEqual([]);
  });
});

describe("findExpirable", () => {
  it("finds requested orders whose respondBy has passed, and none that haven't", async () => {
    const overdue = await createDraftOrder(baseInput({ contactEmail: "overdue@example.com" }));
    await setStatus(overdue.orderId, "requested", {
      requestedAt: new Date(Date.now() - 48 * 60 * 60_000),
      respondBy: new Date(Date.now() - 24 * 60 * 60_000),
    });

    const notYet = await createDraftOrder(baseInput({ contactEmail: "not-yet@example.com" }));
    await setStatus(notYet.orderId, "requested", {
      requestedAt: new Date(),
      respondBy: new Date(Date.now() + 24 * 60 * 60_000),
    });

    const expirable = await findExpirable(new Date());
    const ids = expirable.map((r) => r.id);
    expect(ids).toContain(overdue.orderId);
    expect(ids).not.toContain(notYet.orderId);
  });
});
