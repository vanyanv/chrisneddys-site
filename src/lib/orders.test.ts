import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { editions, products, variants } from "@/db/schema";
import { getInventory } from "@/lib/catalog";
import { addImage, createDraft, setInventory, setStatus } from "@/lib/catalogAdmin";
import {
  createPendingOrder,
  getOrder,
  getStoreSettings,
  markPaid,
  quoteCart,
  releaseExpiredReservations,
  releaseOrder,
  updateStoreSettings,
} from "@/lib/orders";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const FOAM_TRUCKER_SLUG = "foam-trucker-blue";

// Threaded from the "reserves…" test to the later tests in the same
// describe block that pay for / release those same two orders.
let order1Id = "";
let order2Id = "";

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

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

describe("quoteCart", () => {
  it("prices two hats shipped: subtotal 9600, flat shipping 600", async () => {
    const quote = await quoteCart([{ slug: FOAM_TRUCKER_SLUG, quantity: 2 }], "ship");
    if ("code" in quote) throw new Error(`expected a quote, got error ${quote.code}`);
    expect(quote.subtotalCents).toBe(9600);
    expect(quote.shippingCents).toBe(600);
    expect(quote.currency).toBe("usd");
  });

  it("charges no shipping for pickup", async () => {
    const quote = await quoteCart([{ slug: FOAM_TRUCKER_SLUG, quantity: 2 }], "pickup");
    if ("code" in quote) throw new Error(`expected a quote, got error ${quote.code}`);
    expect(quote.shippingCents).toBe(0);
  });

  it("waives shipping once the subtotal clears the free-over threshold", async () => {
    const set = await updateStoreSettings({ shippingFreeOverCents: 9600 });
    expect(set.ok).toBe(true);

    const quote = await quoteCart([{ slug: FOAM_TRUCKER_SLUG, quantity: 2 }], "ship");
    if ("code" in quote) throw new Error(`expected a quote, got error ${quote.code}`);
    expect(quote.shippingCents).toBe(0);

    // Reset so later tests see the default flat rate again.
    const reset = await updateStoreSettings({ shippingFreeOverCents: null });
    expect(reset.ok).toBe(true);
  });

  it("refuses a quantity over the product's per-order limit", async () => {
    const db = await getDb();
    const product = await db.query.products.findFirst({
      where: eq(products.slug, FOAM_TRUCKER_SLUG),
    });
    if (!product) throw new Error("expected the seeded foam trucker product");

    await db.update(products).set({ perOrderLimit: 2 }).where(eq(products.id, product.id));

    const quote = await quoteCart([{ slug: FOAM_TRUCKER_SLUG, quantity: 3 }], "ship");
    expect(quote).toEqual({ code: "over_limit", slug: FOAM_TRUCKER_SLUG });
  });

  it("reports unknown_product and not_published for the wrong slug/status", async () => {
    const unknown = await quoteCart([{ slug: "no-such-product", quantity: 1 }], "ship");
    expect(unknown).toEqual({ code: "unknown_product", slug: "no-such-product" });

    const draft = await createDraft("Draft Quote Product");
    const notPublished = await quoteCart([{ slug: draft.slug, quantity: 1 }], "ship");
    expect(notPublished).toEqual({ code: "not_published", slug: draft.slug });
  });
});

describe("reservation, payment and release (edition product)", () => {
  it("reserves the two lowest-numbered available editions and mirrors inventory", async () => {
    const result = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 2 }],
      fulfilment: "ship",
    });
    if ("code" in result) throw new Error(`expected a reservation, got error ${result.code}`);

    expect(result.number).toBe("CNE-1001");
    expect(result.reservations).toEqual([
      {
        slug: FOAM_TRUCKER_SLUG,
        variantId: await truckerVariantId(),
        quantity: 2,
        editionNumbers: [1, 2],
      },
    ]);

    const inventory = await getInventory(FOAM_TRUCKER_SLUG);
    expect(inventory?.available).toBe(48);

    const db = await getDb();
    const reserved = await db
      .select({ number: editions.number, status: editions.status })
      .from(editions)
      .where(
        and(eq(editions.variantId, await truckerVariantId()), eq(editions.status, "reserved")),
      );
    expect(reserved.map((e) => e.number).sort((a, b) => a - b)).toEqual([1, 2]);

    order1Id = result.orderId;
  });

  it("hands out increasing order numbers to the next reservation", async () => {
    const result = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "pickup",
    });
    if ("code" in result) throw new Error(`expected a reservation, got error ${result.code}`);
    expect(result.number).toBe("CNE-1002");
    expect(result.reservations[0]?.editionNumbers).toEqual([3]);
    order2Id = result.orderId;
  });

  it("marks an order paid: editions become sold and land on order_items.edition_number", async () => {
    const paid = await markPaid({
      orderId: order1Id,
      paymentIntentId: "pi_test_1001",
      email: "buyer@example.com",
      name: "Test Buyer",
      amounts: { subtotal: 9600, shipping: 600, tax: 0, total: 10200 },
    });

    const numbers = paid.items.map((i) => i.editionNumber).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(numbers).toEqual([1, 2]);

    const order = await getOrder(order1Id);
    expect(order?.status).toBe("paid");
    expect(order?.number).toBe("CNE-1001");

    const db = await getDb();
    const sold = await db
      .select({ number: editions.number })
      .from(editions)
      .where(and(eq(editions.variantId, await truckerVariantId()), eq(editions.status, "sold")));
    expect(sold.map((e) => e.number).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("is idempotent: paying an already-paid order returns the same result and does not re-decrement", async () => {
    const before = await getInventory(FOAM_TRUCKER_SLUG);

    const again = await markPaid({
      orderId: order1Id,
      paymentIntentId: "pi_test_1001",
      email: "buyer@example.com",
      name: "Test Buyer",
      amounts: { subtotal: 9600, shipping: 600, tax: 0, total: 10200 },
    });
    const numbers = again.items.map((i) => i.editionNumber).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(numbers).toEqual([1, 2]);

    const after = await getInventory(FOAM_TRUCKER_SLUG);
    expect(after?.available).toBe(before?.available);
  });

  it("releases a cancelled reservation's edition back to available", async () => {
    const released = await releaseOrder({ orderId: order2Id }, "cancelled");
    expect(released).toBe(true);

    const inventory = await getInventory(FOAM_TRUCKER_SLUG);
    expect(inventory?.available).toBe(48);

    const order = await getOrder(order2Id);
    expect(order?.status).toBe("cancelled");

    // Idempotent: releasing an already-cancelled order is a no-op.
    const releasedAgain = await releaseOrder({ orderId: order2Id }, "cancelled");
    expect(releasedAgain).toBe(false);
  });

  it("releases expired reservations back to available", async () => {
    const expired = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "ship",
      holdMinutes: -60,
    });
    if ("code" in expired) throw new Error(`expected a reservation, got error ${expired.code}`);
    expect(expired.reservations[0]?.editionNumbers).toEqual([3]);

    const beforeRelease = await getInventory(FOAM_TRUCKER_SLUG);
    expect(beforeRelease?.available).toBe(47);

    const count = await releaseExpiredReservations(new Date());
    expect(count).toBe(1);

    const afterRelease = await getInventory(FOAM_TRUCKER_SLUG);
    expect(afterRelease?.available).toBe(48);
  });

  it("reports insufficient_stock once fewer editions remain than requested", async () => {
    const db = await getDb();
    const variantId = await truckerVariantId();

    // Simulate a rush: every remaining edition except #3 sells elsewhere,
    // leaving exactly one in stock.
    await db
      .update(editions)
      .set({ status: "sold" })
      .where(
        and(
          eq(editions.variantId, variantId),
          eq(editions.status, "available"),
          gt(editions.number, 3),
        ),
      );

    const inventory = await getInventory(FOAM_TRUCKER_SLUG);
    expect(inventory?.available).toBe(1);

    const quote = await quoteCart([{ slug: FOAM_TRUCKER_SLUG, quantity: 2 }], "ship");
    expect(quote).toEqual({ code: "insufficient_stock", slug: FOAM_TRUCKER_SLUG });

    const reservation = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 2 }],
      fulfilment: "ship",
    });
    expect(reservation).toEqual({ code: "insufficient_stock", slug: FOAM_TRUCKER_SLUG });

    // The single remaining edition can still be bought on its own.
    const single = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "ship",
    });
    if ("code" in single) throw new Error(`expected a reservation, got error ${single.code}`);
    expect(single.reservations[0]?.editionNumbers).toEqual([3]);
  });
});

describe("store settings", () => {
  it("seeds sensible defaults", async () => {
    const settings = await getStoreSettings();
    expect(settings.pickupEnabled).toBe(true);
    expect(settings.pickupAddress).toBe("5539 W. Sunset Blvd, Los Angeles, CA 90028");
    expect(settings.shippingFlatCents).toBe(600);
    expect(settings.shipCountries).toEqual(["US"]);
  });

  it("rejects an invalid support email without writing anything", async () => {
    const before = await getStoreSettings();
    const result = await updateStoreSettings({ supportEmail: "not-an-email" });
    expect(result.ok).toBe(false);

    const after = await getStoreSettings();
    expect(after.supportEmail).toBe(before.supportEmail);
  });

  it("rejects negative cent amounts", async () => {
    const flat = await updateStoreSettings({ shippingFlatCents: -100 });
    expect(flat.ok).toBe(false);

    const threshold = await updateStoreSettings({ shippingFreeOverCents: -1 });
    expect(threshold.ok).toBe(false);
  });

  it("rejects a lowercase or malformed country code", async () => {
    const result = await updateStoreSettings({ shipCountries: ["us", "CA"] });
    expect(result.ok).toBe(false);
  });

  it("accepts a valid patch and persists it", async () => {
    const result = await updateStoreSettings({
      shippingFlatCents: 500,
      shippingFreeOverCents: 10000,
      shipCountries: ["US", "CA"],
      pickupEnabled: false,
    });
    expect(result.ok).toBe(true);

    const settings = await getStoreSettings();
    expect(settings.shippingFlatCents).toBe(500);
    expect(settings.shippingFreeOverCents).toBe(10000);
    expect(settings.shipCountries).toEqual(["US", "CA"]);
    expect(settings.pickupEnabled).toBe(false);
  });

  it("rejects turning pickup on with a blank pickup address, and writes nothing", async () => {
    const before = await getStoreSettings();
    const result = await updateStoreSettings({ pickupEnabled: true, pickupAddress: "" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the update to be rejected");
    expect(result.error).toBe("Add the pickup address, or turn pickup off.");
    expect(result.field).toBe("pickupAddress");

    const after = await getStoreSettings();
    expect(after.pickupEnabled).toBe(before.pickupEnabled);
    expect(after.pickupAddress).toBe(before.pickupAddress);
  });

  it("rejects a whitespace-only pickup address the same way", async () => {
    const result = await updateStoreSettings({ pickupEnabled: true, pickupAddress: "   \n  " });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the update to be rejected");
    expect(result.field).toBe("pickupAddress");
  });

  it("rejects blanking the pickup address while pickup is already on, without re-stating pickupEnabled", async () => {
    const enable = await updateStoreSettings({
      pickupEnabled: true,
      pickupAddress: "123 Real St, LA, CA",
    });
    expect(enable.ok).toBe(true);

    const result = await updateStoreSettings({ pickupAddress: "" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the update to be rejected");
    expect(result.field).toBe("pickupAddress");

    const after = await getStoreSettings();
    expect(after.pickupAddress).toBe("123 Real St, LA, CA");
  });

  it("allows turning pickup off with a blank address", async () => {
    const result = await updateStoreSettings({ pickupEnabled: false, pickupAddress: "" });
    expect(result.ok).toBe(true);

    const settings = await getStoreSettings();
    expect(settings.pickupEnabled).toBe(false);
  });

  it("allows a real pickup address alongside pickupEnabled: true", async () => {
    const result = await updateStoreSettings({
      pickupEnabled: true,
      pickupAddress: "5539 W. Sunset Blvd, Los Angeles, CA 90028",
    });
    expect(result.ok).toBe(true);

    const settings = await getStoreSettings();
    expect(settings.pickupEnabled).toBe(true);
    expect(settings.pickupAddress).toBe("5539 W. Sunset Blvd, Los Angeles, CA 90028");
  });
});

describe("plain-quantity product", () => {
  it("only decrements inventory_quantity once the order is paid", async () => {
    const draft = await createDraft("Quantity Order Test Product");
    await setInventory(draft.id, "quantity", 5);
    await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "FRONT",
      alt: "front view alt text",
      urlFull: "https://example.com/qty-1.webp",
      urlThumb: "https://example.com/qty-1-thumb.webp",
      width: 720,
      height: 720,
    });
    await setStatus(draft.id, "published");

    const reservation = await createPendingOrder({
      items: [{ slug: draft.slug, quantity: 2 }],
      fulfilment: "ship",
    });
    if ("code" in reservation)
      throw new Error(`expected a reservation, got error ${reservation.code}`);
    expect(reservation.reservations).toEqual([
      { slug: draft.slug, variantId: expect.any(String), quantity: 2, editionNumbers: [] },
    ]);

    const beforePayment = await getInventory(draft.slug);
    expect(beforePayment?.available).toBe(5);

    const paid = await markPaid({
      orderId: reservation.orderId,
      paymentIntentId: "pi_test_qty",
      email: "qty-buyer@example.com",
      name: "Qty Buyer",
      amounts: { subtotal: 0, shipping: 0, tax: 0, total: 0 },
    });
    expect(paid.items).toEqual([
      { id: expect.any(String), variantId: expect.any(String), quantity: 2, editionNumber: null },
    ]);

    const afterPayment = await getInventory(draft.slug);
    expect(afterPayment?.available).toBe(3);
  });

  it("blocks a second reservation that would oversell the remaining stock", async () => {
    const draft = await createDraft("Tight Quantity Product");
    await setInventory(draft.id, "quantity", 2);
    await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "FRONT",
      alt: "front view alt text",
      urlFull: "https://example.com/qty-2.webp",
      urlThumb: "https://example.com/qty-2-thumb.webp",
      width: 720,
      height: 720,
    });
    await setStatus(draft.id, "published");

    const first = await createPendingOrder({
      items: [{ slug: draft.slug, quantity: 2 }],
      fulfilment: "ship",
    });
    if ("code" in first) throw new Error(`expected a reservation, got error ${first.code}`);

    const second = await createPendingOrder({
      items: [{ slug: draft.slug, quantity: 1 }],
      fulfilment: "ship",
    });
    expect(second).toEqual({ code: "insufficient_stock", slug: draft.slug });
  });
});
