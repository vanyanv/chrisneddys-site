/**
 * The admin's reads: the product grid and one product in full.
 *
 * Part of `@/lib/catalogAdmin` (see `src/lib/catalogAdmin.ts`), which
 * re-exports the public names; import from there, not from here.
 */
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { imageThumbSrc } from "@/lib/productImage";
import { editions, productImages, products, variants, type AuthenticityFact } from "@/db/schema";

export type AdminInventorySummary =
  | { mode: "untracked" }
  | { mode: "quantity"; quantity: number }
  | {
      mode: "edition";
      editionSize: number;
      sold: number;
      reserved: number;
      available: number;
      /** Numbers taken off the online shop (`set_aside`) — part of the run,
       * never part of what's left to buy online. */
      setAside: number;
    };

function summarizeInventory(
  variant:
    | (typeof variants.$inferSelect & { editions: (typeof editions.$inferSelect)[] })
    | undefined,
): AdminInventorySummary {
  if (!variant || (variant.inventoryQuantity === null && variant.editionSize === null)) {
    return { mode: "untracked" };
  }
  if (variant.editionSize !== null) {
    const sold = variant.editions.filter((e) => e.status === "sold").length;
    const reserved = variant.editions.filter((e) => e.status === "reserved").length;
    const available = variant.editions.filter((e) => e.status === "available").length;
    const setAside = variant.editions.filter((e) => e.status === "set_aside").length;
    return {
      mode: "edition",
      editionSize: variant.editionSize,
      sold,
      reserved,
      available,
      setAside,
    };
  }
  return { mode: "quantity", quantity: variant.inventoryQuantity ?? 0 };
}

export type AdminProductListRow = {
  id: string;
  slug: string;
  /** The internal working title — set once at creation, not shown on the
   * rack card. `displayName1`/`displayName2` are what a customer (and now
   * the rack's card/panel) actually sees. */
  name: string;
  /** The shop's name — line 1. Empty for an unnamed draft (issue #36's
   * decisions comment): the rack renders that honestly rather than falling
   * back to `name` or a made-up placeholder. */
  displayName1: string;
  displayName2: string;
  status: "draft" | "published" | "archived";
  priceCents: number;
  position: number;
  updatedAt: Date;
  thumbUrl: string | null;
  inventory: AdminInventorySummary;
};

async function queryProductsForList(archivedOnly: boolean) {
  const db = await getDb();
  return db.query.products.findMany({
    where: archivedOnly ? eq(products.status, "archived") : undefined,
    with: {
      images: { where: eq(productImages.kind, "view"), orderBy: asc(productImages.position) },
      variants: { with: { editions: true } },
    },
    orderBy: (p, { asc: ordAsc }) => [ordAsc(p.position), ordAsc(p.createdAt)],
  });
}

type ProductListQueryRow = Awaited<ReturnType<typeof queryProductsForList>>[number];

function toAdminListRow(row: ProductListQueryRow): AdminProductListRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    displayName1: row.displayName1,
    displayName2: row.displayName2,
    status: row.status,
    priceCents: row.priceCents,
    position: row.position,
    updatedAt: row.updatedAt,
    thumbUrl: row.images[0] ? imageThumbSrc(row.photoDir, row.images[0]) : null,
    inventory: summarizeInventory(row.variants[0]),
  };
}

/** Every product (any status — the caller filters archived out of the main
 * rack view), ordered by `position` then `createdAt`, with just enough to
 * render the admin table/rack. */
export async function listProductsForAdmin(): Promise<AdminProductListRow[]> {
  const rows = await queryProductsForList(false);
  return rows.map(toAdminListRow);
}

/** Just the archived products, same shape and order as `listProductsForAdmin`
 * — backs the rack's "Archived (n)" list. */
export async function listArchivedProductsForAdmin(): Promise<AdminProductListRow[]> {
  const rows = await queryProductsForList(true);
  return rows.map(toAdminListRow);
}

export type AdminProductImage = {
  id: string;
  viewId: string;
  label: string;
  alt: string;
  /** Stem under the product's `photoDir` for a seeded, repo-shipped image.
   * Empty for an upload, which carries absolute Blob URLs instead. */
  src: string;
  urlFull: string | null;
  urlMid: string | null;
  urlThumb: string | null;
  position: number;
};

export type AdminEdition = {
  number: number;
  status: "available" | "reserved" | "sold" | "set_aside";
};

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  /** Directory the seeded photos live under, e.g. `/shop/foam-trucker-blue`. */
  photoDir: string | null;
  displayName1: string;
  displayName2: string;
  eyebrow: string;
  description: string;
  metaDescription: string;
  limitedNote: string;
  priceCents: number;
  oneSize: boolean;
  perOrderLimit: number;
  status: "draft" | "published" | "archived";
  details: string[];
  fit: string | null;
  limitedCopy: string | null;
  why: string | null;
  authenticityCopy: string | null;
  authenticityFacts: AuthenticityFact[];
  metaTitle: string | null;
  metaKeywords: string | null;
  socialImageUrl: string | null;
  socialImageAlt: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  views: AdminProductImage[];
  certificate: AdminProductImage | null;
  sticker: AdminProductImage | null;
  sku: string | null;
  inventory: AdminInventorySummary;
  editions: AdminEdition[];
};

/** Full detail for one product's editor page. Undefined if the id doesn't exist. */
export async function getProductForAdmin(id: string): Promise<AdminProduct | undefined> {
  const db = await getDb();
  const row = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: {
      images: { orderBy: asc(productImages.position) },
      variants: { with: { editions: true } },
    },
  });
  if (!row) return undefined;

  const toAdminImage = (img: (typeof row.images)[number]): AdminProductImage => ({
    id: img.id,
    viewId: img.viewId,
    label: img.label,
    alt: img.alt,
    src: img.src,
    urlFull: img.urlFull,
    urlMid: img.urlMid,
    urlThumb: img.urlThumb,
    position: img.position,
  });

  const variant = row.variants[0];

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    photoDir: row.photoDir,
    displayName1: row.displayName1,
    displayName2: row.displayName2,
    eyebrow: row.eyebrow,
    description: row.description,
    metaDescription: row.metaDescription,
    limitedNote: row.limitedNote,
    priceCents: row.priceCents,
    oneSize: row.oneSize,
    perOrderLimit: row.perOrderLimit,
    status: row.status,
    details: row.details ?? [],
    fit: row.fit,
    limitedCopy: row.limitedCopy,
    why: row.why,
    authenticityCopy: row.authenticityCopy,
    authenticityFacts: row.authenticityFacts ?? [],
    metaTitle: row.metaTitle,
    metaKeywords: row.metaKeywords,
    socialImageUrl: row.socialImageUrl,
    socialImageAlt: row.socialImageAlt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
    views: row.images.filter((img) => img.kind === "view").map(toAdminImage),
    certificate: (() => {
      const img = row.images.find((i) => i.kind === "certificate");
      return img ? toAdminImage(img) : null;
    })(),
    sticker: (() => {
      const img = row.images.find((i) => i.kind === "sticker");
      return img ? toAdminImage(img) : null;
    })(),
    sku: variant?.sku ?? null,
    inventory: summarizeInventory(variant),
    editions: (variant?.editions ?? [])
      .slice()
      .sort((a, b) => a.number - b.number)
      .map((e) => ({ number: e.number, status: e.status })),
  };
}
