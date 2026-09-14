/**
 * Covers the hold/Stripe-session expiry race (`setOrderExpiry`) and
 * `markPaid`'s tolerance for an order whose hold was already released by
 * the time Stripe confirms payment — the fatal race this fixes: a customer
 * paying in the final seconds before the hold's `expiresAt` could have their
 * order cancelled by `releaseExpiredReservations` moments before the
 * webhook's `markPaid` call landed, which used to throw forever.
 */
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { editions } from "@/db/schema";
import {
  appendOrderNote,
  createPendingOrder,
  getOrder,
  markPaid,
  releaseOrder,
  setOrderExpiry,
} from "@/lib/orders";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const FOAM_TRUCKER_SLUG = "foam-trucker-blue";

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

function paymentInput(orderId: string, note = "") {
  return {
    orderId,
    paymentIntentId: `pi_${orderId}${note}`,
    email: "buyer@example.com",
    name: "Test Buyer",
    amounts: { subtotal: 4800, shipping: 0, tax: 0, total: 4800 },
  };
}

describe("setOrderExpiry", () => {
  it("overwrites a pending order's expiresAt", async () => {
    const reservation = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "pickup",
    });
    if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);

    const before = await getOrder(reservation.orderId);
    const graceExpiry = new Date(Date.now() + 40 * 60_000);
    await setOrderExpiry(reservation.orderId, graceExpiry);

    const after = await getOrder(reservation.orderId);
    expect(after?.expiresAt?.getTime()).toBe(graceExpiry.getTime());
    expect(after?.expiresAt?.getTime()).not.toBe(before?.expiresAt?.getTime());
  });

  it("is a no-op on an order that isn't pending", async () => {
    const reservation = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "pickup",
    });
    if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);
    await releaseOrder({ orderId: reservation.orderId }, "expired");

    const before = await getOrder(reservation.orderId);
    await setOrderExpiry(reservation.orderId, new Date(Date.now() + 999 * 60_000));
    const after = await getOrder(reservation.orderId);

    expect(after?.expiresAt).toEqual(before?.expiresAt);
    expect(after?.status).toBe("cancelled");
  });
});

describe("appendOrderNote", () => {
  it("appends to an empty notes field", async () => {
    const reservation = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "pickup",
    });
    if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);
    const paid = await markPaid(paymentInput(reservation.orderId, "-note-1"));

    await appendOrderNote(paid.orderId, "Partial refund of $5.00 in Stripe");

    const order = await getOrder(paid.orderId);
    expect(order?.notes).toBe("Partial refund of $5.00 in Stripe");
  });

  it("appends to existing notes rather than overwriting them", async () => {
    const reservation = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "pickup",
    });
    if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);
    const paid = await markPaid(paymentInput(reservation.orderId, "-note-2"));

    await appendOrderNote(paid.orderId, "First note");
    await appendOrderNote(paid.orderId, "Second note");

    const order = await getOrder(paid.orderId);
    expect(order?.notes).toBe("First note\nSecond note");
  });
});

describe("markPaid after the hold was released (the Stripe-session race)", () => {
  it("reclaims the exact same edition number when it's still available", async () => {
    const reservation = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "pickup",
    });
    if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);
    const originalNumber = reservation.reservations[0]?.editionNumbers[0];
    expect(originalNumber).toEqual(expect.any(Number));

    const released = await releaseOrder({ orderId: reservation.orderId }, "expired");
    expect(released).toBe(true);
    expect((await getOrder(reservation.orderId))?.status).toBe("cancelled");

    // Stripe's webhook still confirms the payment after the release ran.
    const result = await markPaid(paymentInput(reservation.orderId, "-a"));

    expect(result.items[0]?.editionNumber).toBe(originalNumber);
    const order = await getOrder(reservation.orderId);
    expect(order?.status).toBe("paid");
    expect(order?.notes).not.toContain("PAID AFTER RELEASE");
  });

  it("falls back to the next available number when the original was resold in between", async () => {
    const reservation = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "pickup",
    });
    if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);
    const originalNumber = reservation.reservations[0]?.editionNumbers[0];

    await releaseOrder({ orderId: reservation.orderId }, "expired");

    // A second buyer grabs the now-available (lowest-numbered) edition —
    // which is the same number this order held — and pays for it first.
    const other = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "pickup",
    });
    if ("code" in other) throw new Error(`expected a reservation, got ${other.code}`);
    expect(other.reservations[0]?.editionNumbers[0]).toBe(originalNumber);
    await markPaid(paymentInput(other.orderId, "-b-other"));

    // The original (released) order's payment now lands.
    const result = await markPaid(paymentInput(reservation.orderId, "-b"));

    expect(result.items[0]?.editionNumber).toEqual(expect.any(Number));
    expect(result.items[0]?.editionNumber).not.toBe(originalNumber);
    const order = await getOrder(reservation.orderId);
    expect(order?.status).toBe("paid");
    expect(order?.notes).not.toContain("PAID AFTER RELEASE");
  });

  it("still marks the order paid, flagged for a manual refund, when no stock is left to reclaim", async () => {
    const reservation = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "pickup",
    });
    if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);
    const variantId = reservation.reservations[0]?.variantId;
    if (!variantId) throw new Error("expected a variantId on the reservation");

    await releaseOrder({ orderId: reservation.orderId }, "expired");

    // Every edition for this variant sells out in between — simulated
    // directly, standing in for a flood of other real checkouts.
    const db = await getDb();
    await db.update(editions).set({ status: "sold" }).where(eq(editions.variantId, variantId));

    const result = await markPaid(paymentInput(reservation.orderId, "-c"));

    expect(result.items[0]?.editionNumber).toBeNull();
    const order = await getOrder(reservation.orderId);
    expect(order?.status).toBe("paid");
    expect(order?.notes).toBe("PAID AFTER RELEASE — NO STOCK LEFT — REFUND IN STRIPE");
  });
});
