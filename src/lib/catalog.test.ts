import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb, hasDatabase } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { editions, productImages, products, variants } from "@/db/schema";
import {
  catalogueUpdatedAt,
  editionCounts,
  getInventory,
  getProductBySlug,
  listInventory,
  listPublishedProducts,
  nextAvailableEditionNumber,
} from "@/lib/catalog";
import {
  addImage,
  createDraft,
  setInventory,
  setStatus,
  updateProductField,
} from "@/lib/catalogAdmin";
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
    expect(inventory).toEqual({
      tracked: true,
      available: 50,
      editionSize: 50,
      editions: Array.from({ length: 50 }, (_, i) => ({ number: i + 1, status: "available" })),
    });
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

// Placed after "seed idempotency" (which asserts exact row counts) since
// this adds its own products/images.
describe("listPublishedProducts ordering", () => {
  it("orders by position asc, then createdAt — following a reorder", async () => {
    const db = await getDb();

    const a = await createDraft("Ordering Product A");
    const b = await createDraft("Ordering Product B");
    for (const draft of [a, b]) {
      await updateProductField(draft.id, "priceCents", 1000);
      await setInventory(draft.id, "quantity", 10);
      await addImage({
        productId: draft.id,
        kind: "view",
        viewId: crypto.randomUUID(),
        label: "FRONT",
        alt: "front view alt text",
        urlFull: "https://example.com/order.webp",
        urlThumb: "https://example.com/order-thumb.webp",
        width: 720,
        height: 720,
      });
      await setStatus(draft.id, "published");
    }

    // b was created after a, so plain creation order already puts a first —
    // explicitly force the opposite order via position to prove the query
    // sorts by position rather than insertion/createdAt order.
    await db.update(products).set({ position: 0 }).where(eq(products.id, b.id));
    await db.update(products).set({ position: 1 }).where(eq(products.id, a.id));

    const published = await listPublishedProducts();
    const slugs = published.map((p) => p.slug);
    expect(slugs.indexOf(b.slug)).toBeLessThan(slugs.indexOf(a.slug));
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
      editions: [
        ...Array.from({ length: 37 }, (_, i) => ({ number: i + 1, status: "sold" })),
        ...Array.from({ length: 13 }, (_, i) => ({ number: i + 38, status: "available" })),
      ],
    });
  });
});

// Isolated from the shared foam-trucker fixture above (a fresh draft product
// of its own) so it can put editions into `reserved` — a state none of the
// tests sharing that fixture need — without disturbing their counts.
describe("editions distinguish reserved from sold", () => {
  it("getInventory reports a checked-out number as reserved, not sold or available", async () => {
    const draft = await createDraft("Edition Map Test Cap");
    await updateProductField(draft.id, "priceCents", 4800);
    await setInventory(draft.id, "edition", 5);
    await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "FRONT",
      alt: "front view alt text",
      urlFull: "https://example.com/edmap.webp",
      urlThumb: "https://example.com/edmap-thumb.webp",
      width: 720,
      height: 720,
    });
    await setStatus(draft.id, "published");

    const { createPendingOrder } = await import("@/lib/orders");
    const pending = await createPendingOrder({
      items: [{ slug: draft.slug, quantity: 1 }],
      fulfilment: "ship",
    });
    if ("code" in pending) throw new Error(`expected a reservation, got ${pending.code}`);

    const db = await getDb();
    const [variant] = await db.select().from(variants).where(eq(variants.productId, draft.id));
    if (!variant) throw new Error("expected the edition variant to exist");
    await db
      .update(editions)
      .set({ status: "sold" })
      .where(and(eq(editions.variantId, variant.id), eq(editions.number, 5)));

    const inventory = await getInventory(draft.slug);
    expect(inventory?.editions).toEqual([
      { number: 1, status: "reserved" },
      { number: 2, status: "available" },
      { number: 3, status: "available" },
      { number: 4, status: "available" },
      { number: 5, status: "sold" },
    ]);
    // The reserved and sold numbers are both excluded from `available` —
    // reserved is a hold, not a sale, but it is still not open to buy.
    expect(inventory?.available).toBe(3);
  });
});

describe("editionCounts", () => {
  it("tallies available, reserved and sold separately", () => {
    expect(
      editionCounts([
        { number: 1, status: "sold" },
        { number: 2, status: "sold" },
        { number: 3, status: "reserved" },
        { number: 4, status: "available" },
      ]),
    ).toEqual({ available: 1, reserved: 1, sold: 2 });
  });

  it("returns all zeros for an empty run", () => {
    expect(editionCounts([])).toEqual({ available: 0, reserved: 0, sold: 0 });
  });
});

describe("nextAvailableEditionNumber", () => {
  it("is the lowest-numbered available edition, not the lowest overall", () => {
    expect(
      nextAvailableEditionNumber([
        { number: 1, status: "sold" },
        { number: 2, status: "reserved" },
        { number: 3, status: "available" },
        { number: 4, status: "available" },
      ]),
    ).toBe(3);
  });

  it("is null once nothing is left to preview", () => {
    expect(
      nextAvailableEditionNumber([
        { number: 1, status: "sold" },
        { number: 2, status: "reserved" },
      ]),
    ).toBeNull();
  });
});

// `hasDatabase()` (in `src/db/client.ts`) is the shared rule
// `shouldUseFallback()` here delegates to for whether the storefront reads
// this file's PGlite/Postgres, or the static `src/data/merch.ts` fallback.
// Vitest itself runs with `NODE_ENV=test` and `VITEST=true`, so these tests
// save and restore all four env vars the rule reads, to exercise it as if
// running outside Vitest without disturbing any other test in this file.
describe("hasDatabase", () => {
  // `NODE_ENV` is typed `readonly` (Next.js's global env augmentation), so
  // every read/write here goes through this mutable view instead of
  // `process.env` directly.
  const env = process.env as Record<string, string | undefined>;

  const ENV_KEYS = ["DATABASE_URL", "PGLITE_DATA_DIR", "NODE_ENV", "VITEST"] as const;
  const original: Record<(typeof ENV_KEYS)[number], string | undefined> = {
    DATABASE_URL: undefined,
    PGLITE_DATA_DIR: undefined,
    NODE_ENV: undefined,
    VITEST: undefined,
  };

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original[key] = env[key];
      delete env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete env[key];
      else env[key] = original[key];
    }
  });

  it("is true whenever DATABASE_URL is set, regardless of NODE_ENV", () => {
    env.DATABASE_URL = "postgres://example";
    env.NODE_ENV = "production";
    expect(hasDatabase()).toBe(true);
  });

  it("is true when PGLITE_DATA_DIR is set even under NODE_ENV=production with no DATABASE_URL", () => {
    env.NODE_ENV = "production";
    env.PGLITE_DATA_DIR = ".pglite/e2e";
    expect(hasDatabase()).toBe(true);
  });

  it("is true outside production with neither DATABASE_URL nor PGLITE_DATA_DIR set", () => {
    env.NODE_ENV = "development";
    expect(hasDatabase()).toBe(true);
  });

  it("is false under NODE_ENV=production with neither DATABASE_URL nor PGLITE_DATA_DIR set", () => {
    env.NODE_ENV = "production";
    expect(hasDatabase()).toBe(false);
  });
});

// The shop index reads inventory through `listInventory` and the product page
// reads it through `getInventory`. They are two different queries over the
// same rows, so the thing worth testing is that they cannot disagree about a
// product — that is what would put "13 of 50 left" on one page and something
// else on the other.
describe("listInventory", () => {
  it("reports the same counts as getInventory, without the edition rows", async () => {
    const [listed] = await listInventory(["foam-trucker-blue"]);
    const single = await getInventory("foam-trucker-blue");
    if (!single) throw new Error("expected the seeded product to have inventory");

    expect(listed).toEqual({
      tracked: single.tracked,
      available: single.available,
      editionSize: single.editionSize,
    });
    // Not merely absent from the comparison above — genuinely not fetched.
    expect(listed).not.toHaveProperty("editions");
    expect(single.editions).toBeDefined();
  });

  it("keeps one entry per slug asked for, in that order, undefined where there is no product", async () => {
    expect(await listInventory(["no-such-cap", "foam-trucker-blue", "also-not-real"])).toEqual([
      undefined,
      expect.objectContaining({ tracked: true, editionSize: 50 }),
      undefined,
    ]);
  });

  it("makes no query at all for an empty page", async () => {
    expect(await listInventory([])).toEqual([]);
  });

  it("agrees with getInventory on a plain-quantity product, which has no editions", async () => {
    const draft = await createDraft("Batched Quantity Cap");
    await updateProductField(draft.id, "priceCents", 2400);
    await setInventory(draft.id, "quantity", 7);
    await setStatus(draft.id, "published");

    const [listed] = await listInventory([draft.slug]);
    const single = await getInventory(draft.slug);
    expect(listed).toEqual({ tracked: true, available: 7, editionSize: null });
    expect(single?.available).toBe(7);
    expect(single?.editions).toBeUndefined();
  });
});
