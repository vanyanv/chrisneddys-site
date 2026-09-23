import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { editions, products, variants } from "@/db/schema";
import { getInventory, inventoryLine, listInventory } from "@/lib/catalog";
import {
  applyProductChanges,
  createDraft,
  getProductForAdmin,
  setEditionAside,
  setInventory,
  setOnlineCount,
} from "@/lib/catalogAdmin";
import { createPendingOrder } from "@/lib/orders";
import { editionFlag } from "@/lib/shopCopy";

/**
 * A run of 50 with only 20 left to sell online: the other 30 were sold at
 * the location or kept back. The shop has to say "Only 50 made" and "20 of
 * 50 left", and a checkout must never hand out one of the 30.
 */

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const SLUG = "foam-trucker-blue";

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

async function truckerIds(): Promise<{ productId: string; variantId: string }> {
  const db = await getDb();
  const product = await db.query.products.findFirst({ where: eq(products.slug, SLUG) });
  if (!product) throw new Error("expected the seeded foam trucker");
  const [variant] = await db.select().from(variants).where(eq(variants.productId, product.id));
  if (!variant) throw new Error("expected the seeded foam trucker variant");
  return { productId: product.id, variantId: variant.id };
}

async function statusOf(variantId: string, number: number): Promise<string | undefined> {
  const db = await getDb();
  const [row] = await db
    .select({ status: editions.status })
    .from(editions)
    .where(and(eq(editions.variantId, variantId), eq(editions.number, number)));
  return row?.status;
}

describe("left to sell online", () => {
  it("keeps the run at 50 and sets aside the lowest 30 numbers", async () => {
    const { productId, variantId } = await truckerIds();
    expect((await setOnlineCount(productId, 20)).ok).toBe(true);

    const inventory = await getInventory(SLUG);
    expect(inventory?.editionSize).toBe(50);
    expect(inventory?.available).toBe(20);
    expect(await statusOf(variantId, 30)).toBe("set_aside");
    expect(await statusOf(variantId, 31)).toBe("available");

    // The shop's two lines: the run, and what's left of it.
    const [listed] = await listInventory([SLUG]);
    expect(editionFlag(listed?.editionSize ?? null)).toBe("ONLY 50 MADE");
    expect(inventoryLine(listed, "CNE Merch Capsule 01")?.text).toBe("20 OF 50 LEFT");

    const admin = await getProductForAdmin(productId);
    expect(admin?.inventory).toMatchObject({
      mode: "edition",
      editionSize: 50,
      available: 20,
      setAside: 30,
    });
  });

  it("never hands a set-aside number to a checkout", async () => {
    const order = await createPendingOrder({
      items: [{ slug: SLUG, quantity: 1 }],
      fulfilment: "ship",
    });
    if ("code" in order) throw new Error(`expected a reservation, got ${order.code}`);
    expect(order.reservations[0]?.editionNumbers).toEqual([31]);
    expect((await getInventory(SLUG))?.available).toBe(19);
  });

  it("puts the highest set-aside numbers back first when the count goes up", async () => {
    const { productId, variantId } = await truckerIds();
    expect((await setOnlineCount(productId, 21)).ok).toBe(true);
    expect(await statusOf(variantId, 30)).toBe("available");
    // 19 were left after the held checkout, so 21 puts back two: 30 and 29.
    expect(await statusOf(variantId, 29)).toBe("available");
    expect(await statusOf(variantId, 28)).toBe("set_aside");
  });

  it("refuses more than the numbers that aren't sold or held", async () => {
    const { productId } = await truckerIds();
    // 50 made, 1 held in the open checkout above.
    const result = await setOnlineCount(productId, 50);
    expect(result.ok).toBe(false);
  });

  it("moves one specific number either way, but never a held one", async () => {
    const { productId, variantId } = await truckerIds();
    expect((await setEditionAside(productId, 5, false)).ok).toBe(true);
    expect(await statusOf(variantId, 5)).toBe("available");
    expect((await setEditionAside(productId, 5, true)).ok).toBe(true);
    expect(await statusOf(variantId, 5)).toBe("set_aside");

    const held = await setEditionAside(productId, 31, true);
    expect(held.ok).toBe(false);
    expect(await statusOf(variantId, 31)).toBe("reserved");
  });

  it("saves a new run size before a new online count in the same batch", async () => {
    const draft = await createDraft("Set Aside Batch Product");
    await setInventory(draft.id, "edition", 10);
    const result = await applyProductChanges([
      { id: draft.id, field: "onlineN", value: 15 },
      { id: draft.id, field: "inventoryN", value: 25 },
    ]);
    expect(result).toEqual({ ok: true, applied: 2 });
    const admin = await getProductForAdmin(draft.id);
    expect(admin?.inventory).toMatchObject({ editionSize: 25, available: 15, setAside: 10 });
  });

  it("refuses an online count for a product that isn't numbered", async () => {
    const draft = await createDraft("Plain Count Product");
    await setInventory(draft.id, "quantity", 5);
    expect((await setOnlineCount(draft.id, 3)).ok).toBe(false);
  });
});
