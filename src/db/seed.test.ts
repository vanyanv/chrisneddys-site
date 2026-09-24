/**
 * `seedCatalogue` must create the Foam Trucker exactly once and never touch
 * it again — a redeploy re-running the seed must not revert price, status,
 * copy, edition size or image alt text an owner has since changed through
 * /admin. See the fatal review finding this fixes: the seed used to
 * `onConflictDoUpdate` on every run.
 */
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "./client.ts";
import { seedCatalogue } from "./seed.ts";
import * as schema from "./schema.ts";
import { editions, productImages, products, variants } from "./schema.ts";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const SLUG = "foam-trucker-blue";

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

describe("seedCatalogue idempotency", () => {
  it("running twice leaves the same row counts as running once", async () => {
    const db = await getDb();

    await seedCatalogue(db);
    const [p1, i1, v1, e1] = await Promise.all([
      db.select().from(products),
      db.select().from(productImages),
      db.select().from(variants),
      db.select().from(editions),
    ]);

    await seedCatalogue(db);
    const [p2, i2, v2, e2] = await Promise.all([
      db.select().from(products),
      db.select().from(productImages),
      db.select().from(variants),
      db.select().from(editions),
    ]);

    expect(p2).toHaveLength(p1.length);
    expect(i2).toHaveLength(i1.length);
    expect(v2).toHaveLength(v1.length);
    expect(e2).toHaveLength(e1.length);
    expect(p1).toHaveLength(1);
    expect(e1).toHaveLength(50);
  });
});

describe("seedCatalogue never overwrites owner edits", () => {
  it("leaves a price/status change made outside the seed untouched by a later reseed", async () => {
    const db = await getDb();
    await seedCatalogue(db);

    // Simulate an owner's edit through /admin: a new price and a
    // different status, directly via the database (what `catalogAdmin.ts`
    // would ultimately do).
    await db
      .update(products)
      .set({ priceCents: 9999, status: "archived" })
      .where(eq(products.slug, SLUG));

    const before = await db.query.products.findFirst({ where: eq(products.slug, SLUG) });
    expect(before?.priceCents).toBe(9999);
    expect(before?.status).toBe("archived");

    // A later deploy re-runs the seed.
    await seedCatalogue(db);

    const after = await db.query.products.findFirst({ where: eq(products.slug, SLUG) });
    expect(after?.priceCents).toBe(9999);
    expect(after?.status).toBe("archived");
  });

  it("leaves a variant's edition size and inventory quantity untouched by a later reseed", async () => {
    const db = await getDb();
    await seedCatalogue(db);

    const variant = await db.query.variants.findFirst({
      where: eq(variants.sku, "CNE-FOAM-TRUCKER-BLUE"),
    });
    if (!variant) throw new Error("expected the seeded variant to exist");

    await db
      .update(variants)
      .set({ editionSize: 10, inventoryQuantity: 3 })
      .where(eq(variants.id, variant.id));

    await seedCatalogue(db);

    const after = await db.query.variants.findFirst({ where: eq(variants.id, variant.id) });
    expect(after?.editionSize).toBe(10);
    expect(after?.inventoryQuantity).toBe(3);
  });

  it("leaves an edited image's alt text untouched by a later reseed", async () => {
    const db = await getDb();
    await seedCatalogue(db);

    const product = await db.query.products.findFirst({ where: eq(products.slug, SLUG) });
    if (!product) throw new Error("expected the seeded product to exist");
    const image = await db.query.productImages.findFirst({
      where: eq(productImages.productId, product.id),
    });
    if (!image) throw new Error("expected at least one seeded image");

    await db
      .update(productImages)
      .set({ alt: "Owner-edited alt text" })
      .where(eq(productImages.id, image.id));

    await seedCatalogue(db);

    const after = await db.query.productImages.findFirst({
      where: eq(productImages.id, image.id),
    });
    expect(after?.alt).toBe("Owner-edited alt text");
  });

  it("leaves a sold edition's status untouched by a later reseed", async () => {
    const db = await getDb();
    await seedCatalogue(db);

    const variant = await db.query.variants.findFirst({
      where: eq(variants.sku, "CNE-FOAM-TRUCKER-BLUE"),
    });
    if (!variant) throw new Error("expected the seeded variant to exist");
    const edition = await db.query.editions.findFirst({
      where: eq(editions.variantId, variant.id),
    });
    if (!edition) throw new Error("expected at least one seeded edition");

    await db.update(editions).set({ status: "sold" }).where(eq(editions.id, edition.id));

    await seedCatalogue(db);

    const after = await db.query.editions.findFirst({ where: eq(editions.id, edition.id) });
    expect(after?.status).toBe("sold");
    // Total edition count for the variant is still the full run — no
    // duplicate rows created for the already-existing number.
    const allEditions = await db.select().from(editions).where(eq(editions.variantId, variant.id));
    expect(allEditions).toHaveLength(50);
  });

  it("does not recreate numbers an owner removed by shrinking the run", async () => {
    const db = await getDb();
    await seedCatalogue(db);

    const variant = await db.query.variants.findFirst({
      where: eq(variants.sku, "CNE-FOAM-TRUCKER-BLUE"),
    });
    if (!variant) throw new Error("expected the seeded variant to exist");

    // What /admin's edition resize does going from 50 to 20.
    await db.update(variants).set({ editionSize: 20 }).where(eq(variants.id, variant.id));
    await db
      .delete(editions)
      .where(and(eq(editions.variantId, variant.id), gt(editions.number, 20)));

    await seedCatalogue(db);

    const allEditions = await db.select().from(editions).where(eq(editions.variantId, variant.id));
    expect(allEditions).toHaveLength(20);
  });
});
