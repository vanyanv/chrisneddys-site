/**
 * The catalogue layer — the ONLY module the app reads products through.
 *
 * In production (`DATABASE_URL` set) and in local dev (no `DATABASE_URL`,
 * which runs against a file-persisted PGlite database — see
 * `src/db/client.ts`) this reads Postgres. A production build with no
 * `DATABASE_URL` — CI, or a preview deploy that has not been given one —
 * falls back to the in-repo `merch` array instead, so the site still builds
 * and renders the shop with no database reachable at all.
 *
 * Reads are cached with `unstable_cache`, tagged `"catalogue"`, `revalidate:
 * 60`. That is the stable Next 15 API for this: the newer `"use cache"` /
 * `cacheTag()` pair needs the `experimental.dynamicIO` flag, which this repo
 * does not enable (phase 1 is not the place to turn on an experimental
 * rendering mode). Phase 2's admin can call `revalidateTag("catalogue")`
 * after a write and every cached read here picks it up immediately.
 */
import { and, desc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb } from "@/db/client";
import { products, type AuthenticityFact } from "@/db/schema";
import { merch, MERCH_UPDATED, type MerchProduct, type MerchView } from "@/data/merch";

const CACHE_TAGS = ["catalogue"];
const REVALIDATE_SECONDS = 60;

function isTestEnv(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

/**
 * True for a production build with no database to talk to — CI, or a
 * preview deploy without `DATABASE_URL`. False for `pnpm dev` (a local
 * PGlite database is bootstrapped for it) and for tests (which run their
 * own PGlite instance and expect real query results).
 */
function shouldUseFallback(): boolean {
  if (process.env.DATABASE_URL) return false;
  if (isTestEnv()) return false;
  if (process.env.NODE_ENV === "development") return false;
  return true;
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
      caption: img.alt,
      photo: {
        src: img.src,
        width: img.width,
        height: img.height,
        url: img.urlFull ?? undefined,
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
    photoDir: row.photoDir ?? undefined,
    capColor: row.capColor ?? undefined,
    views,
    details: row.details ?? undefined,
    fit: row.fit ?? undefined,
    limitedCopy: row.limitedCopy ?? undefined,
    why: row.why ?? undefined,
    authenticityCopy: row.authenticityCopy ?? undefined,
    authenticityFacts: (row.authenticityFacts as AuthenticityFact[] | null) ?? undefined,
    authenticity:
      certificate && sticker
        ? {
            certificate: {
              src: certificate.src,
              width: certificate.width,
              height: certificate.height,
              alt: certificate.alt,
              url: certificate.urlFull ?? undefined,
              thumbUrl: certificate.urlThumb ?? undefined,
            },
            sticker: {
              src: sticker.src,
              width: sticker.width,
              height: sticker.height,
              alt: sticker.alt,
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

export type InventoryStatus = {
  /** Whether a real store is decrementing this count. False means `available` is not meaningful. */
  tracked: boolean;
  available: number;
  editionSize: number | null;
};

async function queryInventory(slug: string): Promise<InventoryStatus | undefined> {
  const db = await getDb();
  const product = await db.query.products.findFirst({
    where: eq(products.slug, slug),
    with: { variants: { with: { editions: true } } },
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
  const available =
    variant.editionSize !== null
      ? variant.editions.filter((e) => e.status === "available").length
      : (variant.inventoryQuantity ?? 0);
  return { tracked, available, editionSize: variant.editionSize };
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
 * The "N of 50 left" / sold-out line the shop index card and the product page
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
