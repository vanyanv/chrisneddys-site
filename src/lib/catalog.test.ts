import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { editions, productImages, variants } from "@/db/schema";
import {
  catalogueUpdatedAt,
  getInventory,
  getProductBySlug,
  listPublishedProducts,
} from "@/lib/catalog";
import { merch } from "@/data/merch";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

const trucker = merch.find((p) => p.slug === "foam-trucker-blue");
if (!trucker) throw new Error("expected foam-trucker-blue in the merch catalogue");

// This module runs against Vitest's own PGlite branch of `src/db/client.ts`
// (no DATABASE_URL is set here) — an in-memory database private to this test
// file, migrated and seeded once before the assertions below.
beforeAll(async () => {
  // In tests (no DATABASE_URL, VITEST set) `getDb()` always returns the
  // in-memory PGlite branch of `src/db/client.ts` — the cast just tells
  // `drizzle-orm/pglite/migrator` what `Db`'s driver-agnostic type already
  // guarantees at runtime here.
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  // Seeding twice is the idempotency check: if it left any duplicate rows,
  // the counts asserted below would be wrong.
  await seedCatalogue(db);
  await seedCatalogue(db);
});

describe("listPublishedProducts", () => {
  it("returns exactly the seeded Foam Trucker, with all 8 views and its authenticity images", async () => {
    const products = await listPublishedProducts();
    expect(products).toHaveLength(1);

    const product = products[0];
    if (!product) throw new Error("expected a product");
    expect(product.slug).toBe("foam-trucker-blue");
    expect(product.status).toBe("published");
    expect(product.views).toHaveLength(8);
    expect(product.authenticity).toBeDefined();
    expect(product.authenticity?.certificate.src).toBe("certificate");
    expect(product.authenticity?.sticker.src).toBe("sticker");
  });

  it("maps every copy field the same as the seed source", async () => {
    const product = await getProductBySlug("foam-trucker-blue");
    if (!product) throw new Error("expected the product to be found");

    expect(product.name).toBe(trucker.name);
    expect(product.displayName).toEqual(trucker.displayName);
    expect(product.price).toBe(trucker.price);
    expect(product.eyebrow).toBe(trucker.eyebrow);
    expect(product.description).toBe(trucker.description);
    expect(product.metaDescription).toBe(trucker.metaDescription);
    expect(product.limitedNote).toBe(trucker.limitedNote);
    expect(product.oneSize).toBe(trucker.oneSize);
    // The seeded row's own `per_order_limit` — the fallback copy in
    // `merch.ts` leaves it unset, so this only exists on the database-backed
    // product.
    expect(product.perOrderLimit).toBe(6);
    expect(product.photoDir).toBe(trucker.photoDir);
    expect(product.capColor).toBe(trucker.capColor);
    expect(product.details).toEqual(trucker.details);
    expect(product.fit).toBe(trucker.fit);
    expect(product.limitedCopy).toBe(trucker.limitedCopy);
    expect(product.why).toBe(trucker.why);
    expect(product.authenticityCopy).toBe(trucker.authenticityCopy);
    expect(product.authenticityFacts).toEqual(trucker.authenticityFacts);
    expect(
      product.views.map((v) => ({ id: v.id, label: v.label, caption: v.caption, photo: v.photo })),
    ).toEqual(
      trucker.views.map((v) => ({ id: v.id, label: v.label, caption: v.caption, photo: v.photo })),
    );
  });
});

describe("getInventory", () => {
  it("reports the full, untouched edition run as available", async () => {
    const inventory = await getInventory("foam-trucker-blue");
    expect(inventory).toEqual({ tracked: true, available: 50, editionSize: 50 });
  });

  it("returns undefined for a slug that doesn't exist", async () => {
    expect(await getInventory("no-such-product")).toBeUndefined();
  });
});

describe("seed idempotency", () => {
  it("leaves exactly 1 product, 10 images, 1 variant and 50 editions after seeding twice", async () => {
    const db = await getDb();
    const [imageRows, variantRows, editionRows] = await Promise.all([
      db.select().from(productImages),
      db.select().from(variants),
      db.select().from(editions),
    ]);

    expect(imageRows).toHaveLength(10);
    expect(variantRows).toHaveLength(1);
    expect(editionRows).toHaveLength(50);
    expect(editionRows.every((e) => e.status === "available")).toBe(true);
  });
});

describe("catalogueUpdatedAt", () => {
  it("returns an ISO date driven by the product's own updated_at", async () => {
    const updated = await catalogueUpdatedAt();
    expect(updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// Runs last: it sells editions out from under the run the earlier tests in
// this file assert is untouched (50 of 50 available, every row "available").
describe("getInventory after editions sell", () => {
  it("counts only the editions still marked available", async () => {
    const db = await getDb();
    const [variant] = await db.select().from(variants);
    if (!variant) throw new Error("expected the seeded variant to exist");

    for (let number = 1; number <= 37; number++) {
      await db
        .update(editions)
        .set({ status: "sold" })
        .where(and(eq(editions.variantId, variant.id), eq(editions.number, number)));
    }

    expect(await getInventory("foam-trucker-blue")).toEqual({
      tracked: true,
      available: 13,
      editionSize: 50,
    });
  });
});
