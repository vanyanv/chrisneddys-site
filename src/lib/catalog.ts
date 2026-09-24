/**
 * The catalogue layer — the ONLY module the app reads products through.
 *
 * In production (`DATABASE_URL` set), in local dev (no `DATABASE_URL`, which
 * runs against a file-persisted PGlite database — see `src/db/client.ts`),
 * and anywhere `PGLITE_DATA_DIR` points at a PGlite database (regardless of
 * `NODE_ENV` — this is how the e2e harness proves admin writes reach the
 * storefront without a real `DATABASE_URL`), this reads a real database. A
 * production build/run with neither `DATABASE_URL` nor `PGLITE_DATA_DIR` set
 * — CI, or a preview deploy that has not been given one — falls back to the
 * in-repo `merch` array instead, so the site still builds and renders the
 * shop with no database reachable at all. `hasDatabase()` in
 * `src/db/client.ts` is the shared rule behind all of this.
 *
 * Reads are cached with `unstable_cache`, tagged `"catalogue"`, `revalidate:
 * 60`. That is the stable Next 15 API for this: the newer `"use cache"` /
 * `cacheTag()` pair needs the `experimental.dynamicIO` flag, which this repo
 * does not enable (phase 1 is not the place to turn on an experimental
 * rendering mode). Phase 2's admin can call `revalidateTag("catalogue")`
 * after a write and every cached read here picks it up immediately.
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb, hasDatabase } from "@/db/client";
import { editions, products, variants, type AuthenticityFact } from "@/db/schema";
import { merch, MERCH_UPDATED, type MerchProduct, type MerchView } from "@/data/merch";
import { shopperAlt } from "@/lib/productImage";

const CACHE_TAGS = ["catalogue"];
const REVALIDATE_SECONDS = 60;

function isTestEnv(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

/**
 * True when this process has no database to talk to — see `hasDatabase()`
 * in `src/db/client.ts` for the shared rule (Postgres via `DATABASE_URL`,
 * then PGlite via `PGLITE_DATA_DIR` regardless of `NODE_ENV`, then the local
 * dev/test PGlite default, then this static fallback).
 */
function shouldUseFallback(): boolean {
  return !hasDatabase();
}

type ProductRow = typeof products.$inferSelect;
type ImageRow = {
  position: number;
  viewId: string;
  label: string;
  alt: string;
  src: string;
  width: number;
  height: number;
  kind: "view" | "certificate" | "sticker";
  urlFull?: string | null;
  urlMid?: string | null;
  urlThumb?: string | null;
};

/** Maps a database product row (with its images) onto the app's existing `MerchProduct` shape. */
function mapProductRow(row: ProductRow & { images: ImageRow[] }): MerchProduct {
  const images = [...row.images].sort((a, b) => a.position - b.position);
  const views: MerchView[] = images
    .filter((img) => img.kind === "view")
    .map((img) => ({
      id: img.viewId,
      label: img.label,
      caption: shopperAlt(img.alt, row.name),
      photo: {
        src: img.src,
        width: img.width,
        height: img.height,
        url: img.urlFull ?? undefined,
        midUrl: img.urlMid ?? undefined,
        thumbUrl: img.urlThumb ?? undefined,
      },
    }));
  const certificate = images.find((img) => img.kind === "certificate");
  const sticker = images.find((img) => img.kind === "sticker");

  return {
    id: row.id,
    status: row.status,
    slug: row.slug,
    name: row.name,
    displayName: [row.displayName1, row.displayName2],
    price: row.priceCents / 100,
    eyebrow: row.eyebrow,
    description: row.description,
    metaDescription: row.metaDescription,
    limitedNote: row.limitedNote,
    oneSize: row.oneSize,
    perOrderLimit: row.perOrderLimit,
    photoDir: row.photoDir ?? undefined,
    capColor: row.capColor ?? undefined,
    views,
    details: row.details ?? undefined,
    fit: row.fit ?? undefined,
    limitedCopy: row.limitedCopy ?? undefined,
    why: row.why ?? undefined,
    authenticityCopy: row.authenticityCopy ?? undefined,
    authenticityFacts: (row.authenticityFacts as AuthenticityFact[] | null) ?? undefined,
    metaTitle: row.metaTitle ?? undefined,
    metaKeywords: row.metaKeywords ?? undefined,
    socialImageUrl: row.socialImageUrl ?? undefined,
    socialImageAlt: row.socialImageAlt ?? undefined,
    authenticity:
      certificate && sticker
        ? {
            certificate: {
              src: certificate.src,
              width: certificate.width,
              height: certificate.height,
              alt: shopperAlt(certificate.alt, `${row.name} certificate`),
              url: certificate.urlFull ?? undefined,
              thumbUrl: certificate.urlThumb ?? undefined,
            },
            sticker: {
              src: sticker.src,
              width: sticker.width,
              height: sticker.height,
              alt: shopperAlt(sticker.alt, `${row.name} sticker`),
              url: sticker.urlFull ?? undefined,
              thumbUrl: sticker.urlThumb ?? undefined,
            },
          }
        : undefined,
  };
}

async function queryPublishedProducts(): Promise<MerchProduct[]> {
  const db = await getDb();
  const rows = await db.query.products.findMany({
    where: eq(products.status, "published"),
    with: { images: true },
    orderBy: [asc(products.position), asc(products.createdAt)],
  });
  return rows.map(mapProductRow);
}

async function queryProductBySlug(slug: string): Promise<MerchProduct | undefined> {
  const db = await getDb();
  const row = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.status, "published")),
    with: { images: true },
  });
  return row ? mapProductRow(row) : undefined;
}

async function queryCatalogueUpdatedAt(): Promise<string> {
  const db = await getDb();
  const [latest] = await db
    .select({ updatedAt: products.updatedAt })
    .from(products)
    .orderBy(desc(products.updatedAt))
    .limit(1);
  return latest ? latest.updatedAt.toISOString().slice(0, 10) : MERCH_UPDATED;
}

const cachedListPublishedProducts = unstable_cache(queryPublishedProducts, ["catalogue-list"], {
  tags: CACHE_TAGS,
  revalidate: REVALIDATE_SECONDS,
});
const cachedProductBySlug = unstable_cache(queryProductBySlug, ["catalogue-by-slug"], {
  tags: CACHE_TAGS,
  revalidate: REVALIDATE_SECONDS,
});
const cachedCatalogueUpdatedAt = unstable_cache(queryCatalogueUpdatedAt, ["catalogue-updated-at"], {
  tags: CACHE_TAGS,
  revalidate: REVALIDATE_SECONDS,
});
const cachedInventory = unstable_cache(queryInventory, ["catalogue-inventory"], {
  tags: CACHE_TAGS,
  revalidate: REVALIDATE_SECONDS,
});
const cachedInventoryList = unstable_cache(queryInventoryList, ["catalogue-inventory-list"], {
  tags: CACHE_TAGS,
  revalidate: REVALIDATE_SECONDS,
});

export async function listPublishedProducts(): Promise<MerchProduct[]> {
  if (shouldUseFallback()) return merch;
  if (isTestEnv()) return queryPublishedProducts();
  return cachedListPublishedProducts();
}

export async function getProductBySlug(slug: string): Promise<MerchProduct | undefined> {
  if (shouldUseFallback()) return merch.find((p) => p.slug === slug);
  if (isTestEnv()) return queryProductBySlug(slug);
  return cachedProductBySlug(slug);
}

export type EditionCellStatus = "available" | "reserved" | "sold" | "set_aside";
export type EditionCell = { number: number; status: EditionCellStatus };

export type InventoryStatus = {
  /** Whether a real store is decrementing this count. False means `available` is not meaningful. */
  tracked: boolean;
  available: number;
  editionSize: number | null;
  /**
   * Every edition row for a tracked edition product, ordered by number —
   * `undefined` for a plain-quantity product, an untracked product, or the
   * static fallback (which has no real editions to report at all). The
   * storefront no longer draws these (the shop shows "N of M left" from
   * `listInventory`); they are here for callers that need to tell a number
   * held in an open checkout from one that's sold (see `editionCounts`).
   */
  editions?: EditionCell[];
};

async function queryInventory(slug: string): Promise<InventoryStatus | undefined> {
  const db = await getDb();
  const product = await db.query.products.findFirst({
    where: eq(products.slug, slug),
    // Ordered, so this and `queryInventoryList` below can never pick a
    // different variant for the same product and report two different counts.
    with: { variants: { orderBy: [asc(variants.position)], with: { editions: true } } },
  });
  if (!product) return undefined;

  const variant = product.variants[0];
  if (!variant) return { tracked: false, available: 0, editionSize: null };

  const tracked = variant.inventoryQuantity !== null;
  // Edition products: "available" is the count of edition rows still in that
  // status — `reserved` and `sold` rows are deliberately excluded, not
  // lumped in. Plain-quantity products have no edition rows at all, so their
  // count comes straight from `inventory_quantity` instead (kept in sync by
  // `src/lib/orders.ts` on every reservation/payment/release).
  const editionCells: EditionCell[] | undefined =
    variant.editionSize !== null
      ? [...variant.editions]
          .sort((a, b) => a.number - b.number)
          .map((e) => ({ number: e.number, status: e.status }))
      : undefined;
  const available =
    variant.editionSize !== null
      ? (editionCells ?? []).filter((e) => e.status === "available").length
      : (variant.inventoryQuantity ?? 0);
  return { tracked, available, editionSize: variant.editionSize, editions: editionCells };
}

/**
 * The storefront's inventory read (the shop index and the product page):
 * every slug in one query, counts only.
 *
 * `queryInventory` above loads every edition row a product has — fifty of
 * them for a fifty-piece run. Neither shop page draws the individual
 * numbers; both show "N of M left", so all they ever need is the two
 * numbers, and asking for the rows to count them would carry the whole run
 * across the wire per product, once per render.
 * Here the count is a `count(*)` the database answers off
 * `editions_variant_status_idx`, and one query covers every product on the
 * page rather than one query each.
 *
 * Deliberately not reading `variants.inventory_quantity` for edition
 * products even though `syncVariantAvailableMirror` keeps it equal to this
 * count: `queryInventory` counts the rows themselves, and the two reads have
 * to agree about the same product or the index and the product page will say
 * different things about it.
 */
async function queryInventoryList(slugs: string[]): Promise<(InventoryStatus | undefined)[]> {
  if (slugs.length === 0) return [];
  const db = await getDb();
  const rows = await db
    .select({
      slug: products.slug,
      inventoryQuantity: variants.inventoryQuantity,
      editionSize: variants.editionSize,
      availableEditions: sql<number>`(
        select count(*)::int from ${editions}
        where ${editions.variantId} = ${variants.id} and ${editions.status} = 'available'
      )`,
    })
    .from(products)
    .leftJoin(variants, eq(variants.productId, products.id))
    .where(inArray(products.slug, slugs))
    .orderBy(asc(products.slug), asc(variants.position));

  const bySlug = new Map<string, InventoryStatus>();
  for (const row of rows) {
    // First row per slug wins — the ordering above makes that the same
    // variant `queryInventory` picks.
    if (bySlug.has(row.slug)) continue;
    if (row.editionSize === null && row.inventoryQuantity === null) {
      bySlug.set(row.slug, { tracked: false, available: 0, editionSize: null });
      continue;
    }
    bySlug.set(row.slug, {
      tracked: row.inventoryQuantity !== null,
      available: row.editionSize !== null ? row.availableEditions : (row.inventoryQuantity ?? 0),
      editionSize: row.editionSize,
    });
  }
  return slugs.map((slug) => bySlug.get(slug));
}

/**
 * Splits an edition run's rows into the four counts the admin's run views
 * need — pulled out as its own pure function so it's testable without a
 * database, and so nothing reading `InventoryStatus.editions` tallies the
 * states a different way. `setAside` is the part of the run the owner has
 * taken off the online shop (sold at the location, kept back).
 */
export function editionCounts(editions: EditionCell[]): {
  available: number;
  reserved: number;
  sold: number;
  setAside: number;
} {
  let available = 0;
  let reserved = 0;
  let sold = 0;
  let setAside = 0;
  for (const cell of editions) {
    if (cell.status === "available") available++;
    else if (cell.status === "reserved") reserved++;
    else if (cell.status === "set_aside") setAside++;
    else sold++;
  }
  return { available, reserved, sold, setAside };
}

/**
 * Never returns a decrementing count that isn't backed by a real store — the
 * fallback (no database) always reports `tracked: false`, matching the
 * catalogue's honesty rule (see `src/data/merch.ts`).
 */
export async function getInventory(slug: string): Promise<InventoryStatus | undefined> {
  if (shouldUseFallback()) {
    if (!merch.some((p) => p.slug === slug)) return undefined;
    return { tracked: false, available: 0, editionSize: null };
  }
  if (isTestEnv()) return queryInventory(slug);
  return cachedInventory(slug);
}

/**
 * `getInventory` for a whole page of products at once, in one query and
 * without the edition rows — what the shop index needs. Returns one entry
 * per slug given, in that order, `undefined` where there is no such product.
 *
 * The `editions` array is deliberately absent from every entry: it is the
 * expensive part, and neither shop page shows the individual numbers.
 */
export async function listInventory(slugs: string[]): Promise<(InventoryStatus | undefined)[]> {
  if (shouldUseFallback()) {
    return slugs.map((slug) =>
      merch.some((p) => p.slug === slug)
        ? { tracked: false, available: 0, editionSize: null }
        : undefined,
    );
  }
  if (isTestEnv()) return queryInventoryList(slugs);
  return cachedInventoryList(slugs);
}

/**
 * The "N of M left" / sold-out line the shop index card and the product page
 * both need, derived the same way in both places so the two can never say
 * different things about the same product. Returns `null` whenever nothing
 * new should render — untracked inventory (the honesty rule above), or a
 * tracked count high enough that flagging it would be noise.
 */
export type InventoryLine = {
  text: string;
  soldOut: boolean;
  /** `available / editionSize`, for the bar's width — `null` when there's no bar. */
  barRatio: number | null;
};

export function inventoryLine(
  inventory: InventoryStatus | undefined,
  eyebrow: string,
): InventoryLine | null {
  if (!inventory?.tracked) return null;

  if (inventory.available === 0) {
    return { text: soldOutLine(eyebrow), soldOut: true, barRatio: null };
  }
  if (inventory.editionSize) {
    return {
      text: `${inventory.available} OF ${inventory.editionSize} LEFT`,
      soldOut: false,
      barRatio: inventory.available / inventory.editionSize,
    };
  }
  if (inventory.available <= 20) {
    return { text: `${inventory.available} LEFT`, soldOut: false, barRatio: null };
  }
  return null;
}

/**
 * "SOLD OUT", plus the eyebrow's own capsule label when the eyebrow states
 * one after a period (e.g. "CNE Merch. Capsule 01" -> "SOLD OUT · CAPSULE 01
 * CLOSED"). Falls back to plain "SOLD OUT" when the eyebrow doesn't carry one.
 */
function soldOutLine(eyebrow: string): string {
  const dot = eyebrow.indexOf(".");
  if (dot === -1) return "SOLD OUT";
  const label = eyebrow.slice(dot + 1).trim();
  return label ? `SOLD OUT · ${label.toUpperCase()} CLOSED` : "SOLD OUT";
}

/** ISO date (`YYYY-MM-DD`) of the latest product update, for the sitemap's `lastmod`. */
export async function catalogueUpdatedAt(): Promise<string> {
  if (shouldUseFallback()) return MERCH_UPDATED;
  if (isTestEnv()) return queryCatalogueUpdatedAt();
  return cachedCatalogueUpdatedAt();
}
