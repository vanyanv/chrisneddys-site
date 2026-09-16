/**
 * Covers `getRunForAdmin` — the read behind "All fifty numbers" (issue #36
 * phase 3). Two things this file exists specifically to prove:
 *
 * 1. The count is produced by joining `editions` to `orders` on
 *    `editions.variantId` (Finding 01: a run belongs to the variant, not the
 *    product), not by anything keyed on `productId`.
 * 2. A held (reserved) number and a sold one are reported as genuinely
 *    different states, each with its own order reference, rather than one
 *    being folded into the other.
 */
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { editions, variants } from "@/db/schema";
import {
  addImage,
  createDraft,
  setInventory,
  setStatus,
  updateProductField,
} from "@/lib/catalogAdmin";
import { createPendingOrder, markPaid } from "@/lib/orders";
import { getRunForAdmin } from "@/lib/runAdmin";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

/** A published, edition-tracked draft, ready for `createPendingOrder` to
 * reserve numbers against — the three `setStatus` gates plus a run size. */
async function makePublishedEditionProduct(name: string, editionSize: number) {
  const draft = await createDraft(name);
  await updateProductField(draft.id, "priceCents", 4800);
  await setInventory(draft.id, "edition", editionSize);
  await addImage({
    productId: draft.id,
    kind: "view",
    viewId: crypto.randomUUID(),
    label: "FRONT",
    alt: "front view alt text",
    urlFull: "https://example.com/run-1.webp",
    urlThumb: "https://example.com/run-1-thumb.webp",
    width: 720,
    height: 720,
  });
  const published = await setStatus(draft.id, "published");
  if (!published.ok) throw new Error(`expected to publish: ${published.error}`);
  return draft;
}

describe("getRunForAdmin", () => {
  it("returns undefined for a product with no numbered run", async () => {
    const draft = await createDraft("Untracked Run Product");
    expect(await getRunForAdmin(draft.id)).toBeUndefined();

    await setInventory(draft.id, "quantity", 10);
    expect(await getRunForAdmin(draft.id)).toBeUndefined();
  });

  it("counts a run by joining editions to orders on variantId, not productId", async () => {
    const draft = await makePublishedEditionProduct("Joined Run Product", 5);

    const db = await getDb();
    const [variant] = await db.select().from(variants).where(eq(variants.productId, draft.id));
    if (!variant) throw new Error("expected a variant");

    // Sell #1 and #2 directly, so this test is purely about the join/count,
    // not about re-exercising `markPaid`'s own edition-claiming logic.
    await db
      .update(editions)
      .set({ status: "sold" })
      .where(and(eq(editions.variantId, variant.id), eq(editions.number, 1)));
    await db
      .update(editions)
      .set({ status: "sold" })
      .where(and(eq(editions.variantId, variant.id), eq(editions.number, 2)));

    const run = await getRunForAdmin(draft.id);
    expect(run).toBeDefined();
    expect(run?.productId).toBe(draft.id);
    expect(run?.editionSize).toBe(5);
    expect(run?.locked).toBe(true);
    expect(run?.counts).toEqual({ available: 3, reserved: 0, sold: 2 });
    expect(run?.numbers.map((n) => n.number)).toEqual([1, 2, 3, 4, 5]);
    expect(run?.numbers.map((n) => n.status)).toEqual([
      "sold",
      "sold",
      "available",
      "available",
      "available",
    ]);
  });

  it("distinguishes a held (reserved) number from a sold one, each with its own order", async () => {
    const draft = await makePublishedEditionProduct("Held Vs Sold Product", 5);

    // Buyer A completes checkout -> their number is sold, with a name/email.
    const paidCart = await createPendingOrder({
      items: [{ slug: draft.slug, quantity: 1 }],
      fulfilment: "ship",
    });
    if ("code" in paidCart) throw new Error(`expected a reservation, got ${paidCart.code}`);
    await markPaid({
      orderId: paidCart.orderId,
      paymentIntentId: "pi_test_run_admin_sold",
      email: "buyer@example.com",
      name: "Alex Buyer",
      amounts: { subtotal: 4800, shipping: 0, tax: 0, total: 4800 },
    });

    // Buyer B is still mid-checkout -> their number is only held, no name or
    // email yet, and it carries a `reservedUntil` in the future.
    const heldCart = await createPendingOrder({
      items: [{ slug: draft.slug, quantity: 1 }],
      fulfilment: "ship",
    });
    if ("code" in heldCart) throw new Error(`expected a reservation, got ${heldCart.code}`);

    const run = await getRunForAdmin(draft.id);
    expect(run).toBeDefined();
    expect(run?.counts).toEqual({ available: 3, reserved: 1, sold: 1 });
    expect(run?.locked).toBe(true);

    const sold = run?.numbers.find((n) => n.status === "sold");
    expect(sold?.reservedUntil).toBeNull();
    expect(sold?.order).toEqual({
      orderId: paidCart.orderId,
      orderNumber: expect.any(String),
      orderStatus: "paid",
      customerName: "Alex Buyer",
      customerEmail: "buyer@example.com",
      paidAt: expect.any(Date),
    });

    const held = run?.numbers.find((n) => n.status === "reserved");
    expect(held?.reservedUntil).toBeInstanceOf(Date);
    expect(held?.reservedUntil && held.reservedUntil.getTime()).toBeGreaterThan(Date.now());
    expect(held?.order).toEqual({
      orderId: heldCart.orderId,
      orderNumber: expect.any(String),
      orderStatus: "pending",
      customerName: null,
      customerEmail: null,
      paidAt: null,
    });

    const stillAvailable = run?.numbers.filter((n) => n.status === "available");
    expect(stillAvailable).toHaveLength(3);
    for (const row of stillAvailable ?? []) {
      expect(row.order).toBeNull();
      expect(row.reservedUntil).toBeNull();
    }
  });
});
