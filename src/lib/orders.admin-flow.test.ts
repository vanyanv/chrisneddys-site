/**
 * Covers the orders-desk transitions (`setFulfilment`, `markReadyForPickup`,
 * `markPickedUp`, `markRefunded`) through `src/lib/orders.ts` directly —
 * `src/lib/ordersAdmin.ts` itself is hard to unit test outside a real
 * request (its mutations call `requireOwner()`, which needs cookies/headers
 * context), so this exercises the same state machine its wrappers sit on.
 */
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { editions, products, variants } from "@/db/schema";
import {
  createPendingOrder,
  getOrder,
  markPaid,
  markPickedUp,
  markReadyForPickup,
  markRefunded,
  setFulfilment,
} from "@/lib/orders";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const FOAM_TRUCKER_SLUG = "foam-trucker-blue";

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

/** Reserves and pays for one foam trucker, ship or pickup, returning the
 * paid order's id. */
async function createPaidOrder(fulfilment: "ship" | "pickup"): Promise<string> {
  const reservation = await createPendingOrder({
    items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
    fulfilment,
  });
  if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);

  await markPaid({
    orderId: reservation.orderId,
    paymentIntentId: `pi_test_${reservation.number}`,
    email: "buyer@example.com",
    name: "Test Buyer",
    amounts: { subtotal: 4800, shipping: 600, tax: 0, total: 5400 },
  });

  return reservation.orderId;
}

async function truckerVariantId(): Promise<string> {
  const db = await getDb();
  const product = await db.query.products.findFirst({
    where: eq(products.slug, FOAM_TRUCKER_SLUG),
  });
  if (!product) throw new Error("expected the seeded foam trucker product");
  const [variant] = await db.select().from(variants).where(eq(variants.productId, product.id));
  if (!variant) throw new Error("expected the seeded foam trucker variant");
  return variant.id;
}

describe("ship: paid -> fulfilled with carrier + tracking", () => {
  it("stamps carrier, tracking number and fulfilledAt", async () => {
    const orderId = await createPaidOrder("ship");

    const result = await setFulfilment(orderId, {
      carrier: "USPS",
      trackingNumber: "9400111899223344",
    });
    expect(result.ok).toBe(true);

    const order = await getOrder(orderId);
    expect(order?.status).toBe("fulfilled");
    expect(order?.carrier).toBe("USPS");
    expect(order?.trackingNumber).toBe("9400111899223344");
    expect(order?.fulfilledAt).not.toBeNull();
  });

  it("refuses to fulfil a pending (unpaid) order", async () => {
    const reservation = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "ship",
    });
    if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);

    const result = await setFulfilment(reservation.orderId, {
      carrier: "USPS",
      trackingNumber: "9400111899223399",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/pending/);

    const order = await getOrder(reservation.orderId);
    expect(order?.status).toBe("pending");
    expect(order?.carrier).toBeNull();
  });

  it("refuses to fulfil an order twice", async () => {
    const orderId = await createPaidOrder("ship");
    const first = await setFulfilment(orderId, {
      carrier: "UPS",
      trackingNumber: "1Z999AA10123456784",
    });
    expect(first.ok).toBe(true);

    const second = await setFulfilment(orderId, {
      carrier: "UPS",
      trackingNumber: "1Z999AA10123456784",
    });
    expect(second.ok).toBe(false);
  });
});

describe("pickup: paid -> ready_for_pickup -> picked_up", () => {
  it("walks the full pickup flow", async () => {
    const orderId = await createPaidOrder("pickup");

    const ready = await markReadyForPickup(orderId);
    expect(ready.ok).toBe(true);
    expect((await getOrder(orderId))?.status).toBe("ready_for_pickup");

    const pickedUp = await markPickedUp(orderId);
    expect(pickedUp.ok).toBe(true);
    expect((await getOrder(orderId))?.status).toBe("picked_up");
  });

  it("also allows marking picked up straight from paid, skipping ready_for_pickup", async () => {
    const orderId = await createPaidOrder("pickup");

    const pickedUp = await markPickedUp(orderId);
    expect(pickedUp.ok).toBe(true);
    expect((await getOrder(orderId))?.status).toBe("picked_up");
  });

  it("refuses to mark ready-for-pickup twice", async () => {
    const orderId = await createPaidOrder("pickup");
    const first = await markReadyForPickup(orderId);
    expect(first.ok).toBe(true);

    const second = await markReadyForPickup(orderId);
    expect(second.ok).toBe(false);
  });
});

describe("refund", () => {
  it("refunds a fulfilled (shipped) order", async () => {
    const orderId = await createPaidOrder("ship");
    await setFulfilment(orderId, { carrier: "FedEx", trackingNumber: "999988887777" });

    const result = await markRefunded(orderId, {});
    expect(result.ok).toBe(true);

    const order = await getOrder(orderId);
    expect(order?.status).toBe("refunded");
    expect(order?.refundedAt).not.toBeNull();
  });

  it("refunds directly from paid (webhook missed the fulfilment step)", async () => {
    const orderId = await createPaidOrder("ship");

    const result = await markRefunded(orderId, {});
    expect(result.ok).toBe(true);
    expect((await getOrder(orderId))?.status).toBe("refunded");
  });

  it("refuses to refund a pending order", async () => {
    const reservation = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "ship",
    });
    if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);

    const result = await markRefunded(reservation.orderId, {});
    expect(result.ok).toBe(false);

    const order = await getOrder(reservation.orderId);
    expect(order?.status).toBe("pending");
  });

  it("refuses to refund an order twice", async () => {
    const orderId = await createPaidOrder("ship");
    const first = await markRefunded(orderId, {});
    expect(first.ok).toBe(true);

    const second = await markRefunded(orderId, {});
    expect(second.ok).toBe(false);
  });

  it("refunds a pickup order that's ready for pickup but not yet collected", async () => {
    const orderId = await createPaidOrder("pickup");
    await markReadyForPickup(orderId);

    const result = await markRefunded(orderId, {});
    expect(result.ok).toBe(true);
    expect((await getOrder(orderId))?.status).toBe("refunded");
  });

  it("refunds a pickup order that's already been picked up", async () => {
    const orderId = await createPaidOrder("pickup");
    await markPickedUp(orderId);

    const result = await markRefunded(orderId, {});
    expect(result.ok).toBe(true);
    expect((await getOrder(orderId))?.status).toBe("refunded");
  });

  describe("release", () => {
    it("release: false (the default) leaves the edition sold and reports nothing released", async () => {
      const orderId = await createPaidOrder("ship");
      const order = await getOrder(orderId);
      const editionNumber = order?.items[0]?.editionNumber;
      expect(editionNumber).toEqual(expect.any(Number));

      const result = await markRefunded(orderId, {});
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.releasedEditionNumbers).toEqual([]);

      const db = await getDb();
      const [edition] = await db
        .select({ status: editions.status, orderId: editions.orderId })
        .from(editions)
        .where(
          and(
            eq(editions.variantId, await truckerVariantId()),
            eq(editions.number, editionNumber!),
          ),
        );
      expect(edition?.status).toBe("sold");
      expect(edition?.orderId).toBe(orderId);
    });

    it("release: true puts the edition back to available and reports its number", async () => {
      const orderId = await createPaidOrder("ship");
      const order = await getOrder(orderId);
      const editionNumber = order?.items[0]?.editionNumber;
      expect(editionNumber).toEqual(expect.any(Number));

      const result = await markRefunded(orderId, { release: true });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.releasedEditionNumbers).toEqual([editionNumber]);

      const db = await getDb();
      const [edition] = await db
        .select({
          status: editions.status,
          orderId: editions.orderId,
          reservedUntil: editions.reservedUntil,
        })
        .from(editions)
        .where(
          and(
            eq(editions.variantId, await truckerVariantId()),
            eq(editions.number, editionNumber!),
          ),
        );
      expect(edition?.status).toBe("available");
      expect(edition?.orderId).toBeNull();
      expect(edition?.reservedUntil).toBeNull();
    });

    it("a failed refund (already refunded) releases nothing, even with release: true", async () => {
      const orderId = await createPaidOrder("ship");
      const first = await markRefunded(orderId, {});
      expect(first.ok).toBe(true);

      const second = await markRefunded(orderId, { release: true });
      expect(second.ok).toBe(false);

      const order = await getOrder(orderId);
      const editionNumber = order?.items[0]?.editionNumber;
      const db = await getDb();
      const [edition] = await db
        .select({ status: editions.status })
        .from(editions)
        .where(
          and(
            eq(editions.variantId, await truckerVariantId()),
            eq(editions.number, editionNumber!),
          ),
        );
      // Still sold — the first (non-releasing) refund is the one that stuck.
      expect(edition?.status).toBe("sold");
    });
  });
});
