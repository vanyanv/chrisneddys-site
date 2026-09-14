/**
 * The admin write layer — every `/admin/products` server action funnels its
 * database work through here. Unlike `src/lib/catalog.ts` (the storefront's
 * read layer, cached with `unstable_cache`) every read in this module is
 * uncached: an owner editing a product has to see what is actually in the
 * database, not a stale minute-old snapshot.
 *
 * Callers (server actions in `src/app/admin/products/actions.ts`) are
 * responsible for `requireOwner()` and for `revalidateTag("catalogue")` /
 * `revalidatePath` after a write that the storefront could see — nothing
 * here touches the cache.
 */
import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { imageThumbSrc } from "@/lib/productImage";
import { editions, productImages, products, variants, type AuthenticityFact } from "@/db/schema";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "product";
}

/** Appends `-2`, `-3`, … to `base` until it is unique among other products' slugs. */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const db = await getDb();
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(excludeId ? ne(products.id, excludeId) : undefined);
  const taken = new Set(rows.map((r) => r.slug));

  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export type CreateDraftResult = { id: string; slug: string };

/** Creates a draft product with a unique slug derived from `name`. */
export async function createDraft(name: string): Promise<CreateDraftResult> {
  const db = await getDb();
  const trimmedName = name.trim() || "Untitled product";
  const slug = await uniqueSlug(slugify(trimmedName));

  const [row] = await db
    .insert(products)
    .values({
      slug,
      name: trimmedName,
      displayName1: trimmedName.toUpperCase(),
      displayName2: "",
      eyebrow: "",
      description: "",
      metaDescription: "",
      limitedNote: "",
      priceCents: 0,
      oneSize: true,
      status: "draft",
    })
    .returning({ id: products.id, slug: products.slug });

  if (!row) throw new Error("insert of the draft product returned nothing");
  return row;
}

export type ProductPatch = {
  name: string;
  displayName1: string;
  displayName2: string;
  eyebrow: string;
  slug: string;
  priceCents: number;
  perOrderLimit: number;
  oneSize: boolean;
  description: string;
  metaDescription: string;
  limitedNote: string;
  details: string[];
  fit: string | null;
  limitedCopy: string | null;
  why: string | null;
  authenticityCopy: string | null;
  authenticityFacts: AuthenticityFact[];
};

export type UpdateProductResult =
  | { ok: true; oldSlug: string; newSlug: string }
  | { ok: false; error: string };

/**
 * Updates a product's copy, price and slug. Validates the slug's shape and
 * uniqueness itself (the form field is free text) — every other field here
 * is assumed already checked at a type level by the caller. Returns both the
 * old and new slug so the caller can `revalidatePath` both `/shop/<slug>/`
 * pages when the slug changed.
 */
export async function updateProduct(id: string, patch: ProductPatch): Promise<UpdateProductResult> {
  const db = await getDb();

  const slug = patch.slug.trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    return { ok: false, error: "Slug must be lowercase letters, numbers and hyphens only." };
  }

  const existing = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!existing) return { ok: false, error: "Product not found." };

  const clash = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), ne(products.id, id)),
  });
  if (clash) return { ok: false, error: "That slug is already in use by another product." };

  await db
    .update(products)
    .set({
      name: patch.name,
      displayName1: patch.displayName1,
      displayName2: patch.displayName2,
      eyebrow: patch.eyebrow,
      slug,
      priceCents: patch.priceCents,
      perOrderLimit: patch.perOrderLimit,
      oneSize: patch.oneSize,
      description: patch.description,
      metaDescription: patch.metaDescription,
      limitedNote: patch.limitedNote,
      details: patch.details.length > 0 ? patch.details : null,
      fit: patch.fit,
      limitedCopy: patch.limitedCopy,
      why: patch.why,
      authenticityCopy: patch.authenticityCopy,
      authenticityFacts: patch.authenticityFacts.length > 0 ? patch.authenticityFacts : null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));

  return { ok: true, oldSlug: existing.slug, newSlug: slug };
}

export type SetStatusResult = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Sets a product's status. Stamps `publishedAt` the first time a product is
 * ever published; an unpublish/republish cycle keeps that original
 * timestamp rather than treating every publish as a new "first" one.
 *
 * Refuses to publish a product with no gallery photo: `firstView` (in
 * `src/data/merch.ts`) has to return something for the shop index and the
 * product page to render, and a product with zero `view` images is exactly
 * the case that used to render an empty $0 line instead.
 */
export async function setStatus(
  id: string,
  status: "draft" | "published" | "archived",
): Promise<SetStatusResult> {
  const db = await getDb();
  const existing = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: { images: { where: eq(productImages.kind, "view") } },
  });
  if (!existing) return { ok: false, error: "Product not found." };

  if (status === "published" && existing.images.length === 0) {
    return { ok: false, error: "Add at least one photo before publishing." };
  }

  const publishedAt =
    status === "published" && existing.publishedAt === null ? new Date() : existing.publishedAt;

  await db
    .update(products)
    .set({ status, publishedAt, updatedAt: new Date() })
    .where(eq(products.id, id));

  return { ok: true, slug: existing.slug };
}

export type InventoryMode = "untracked" | "quantity" | "edition";

export type SetInventoryResult = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Sets a product's inventory mode.
 *
 * - `untracked`: clears both `inventory_quantity` and `edition_size` on the
 *   variant (creating a bare one if none exists yet).
 * - `quantity`: stores a plain count, clears `edition_size`.
 * - `edition`: creates the variant if none exists (sku from the slug,
 *   upper-cased; label "One size"), then creates editions `1..n` that don't
 *   already exist. Never deletes a `sold` or `reserved` edition — shrinking
 *   `n` below the highest sold number is refused outright.
 */
export async function setInventory(
  id: string,
  mode: InventoryMode,
  n?: number,
): Promise<SetInventoryResult> {
  const db = await getDb();
  const product = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: { variants: { with: { editions: true } } },
  });
  if (!product) return { ok: false, error: "Product not found." };

  let variant = product.variants[0];

  if (mode === "edition") {
    const size = n ?? 0;
    if (!Number.isInteger(size) || size < 1) {
      return { ok: false, error: "Edition size must be a positive whole number." };
    }

    if (variant) {
      const highestSold = variant.editions
        .filter((e) => e.status === "sold")
        .reduce((max, e) => Math.max(max, e.number), 0);
      if (size < highestSold) {
        return {
          ok: false,
          error: `Can't reduce the edition below ${highestSold} — that number has already sold.`,
        };
      }
    }

    if (!variant) {
      const [row] = await db
        .insert(variants)
        .values({
          productId: id,
          sku: product.slug.toUpperCase(),
          label: "One size",
          inventoryQuantity: size,
          editionSize: size,
        })
        .returning();
      if (!row) throw new Error("insert of the variant returned nothing");
      variant = { ...row, editions: [] };
    } else {
      await db
        .update(variants)
        .set({ editionSize: size, inventoryQuantity: size, updatedAt: new Date() })
        .where(eq(variants.id, variant.id));
    }

    const existingNumbers = new Set(variant.editions.map((e) => e.number));
    for (let number = 1; number <= size; number++) {
      if (existingNumbers.has(number)) continue;
      await db.insert(editions).values({ variantId: variant.id, number, status: "available" });
    }

    return { ok: true, slug: product.slug };
  }

  if (mode === "quantity") {
    const quantity = n ?? 0;
    if (!Number.isInteger(quantity) || quantity < 0) {
      return { ok: false, error: "Quantity must be zero or a positive whole number." };
    }

    if (!variant) {
      await db.insert(variants).values({
        productId: id,
        sku: product.slug.toUpperCase(),
        label: "One size",
        inventoryQuantity: quantity,
        editionSize: null,
      });
    } else {
      await db
        .update(variants)
        .set({ inventoryQuantity: quantity, editionSize: null, updatedAt: new Date() })
        .where(eq(variants.id, variant.id));
    }

    return { ok: true, slug: product.slug };
  }

  // untracked
  if (!variant) {
    await db.insert(variants).values({
      productId: id,
      sku: product.slug.toUpperCase(),
      label: "One size",
      inventoryQuantity: null,
      editionSize: null,
    });
  } else {
    await db
      .update(variants)
      .set({ inventoryQuantity: null, editionSize: null, updatedAt: new Date() })
      .where(eq(variants.id, variant.id));
  }

  return { ok: true, slug: product.slug };
}

export type ImageKind = "view" | "certificate" | "sticker";

export type AddImageInput = {
  productId: string;
  kind: ImageKind;
  /** For `kind: "view"`, a fresh id (`crypto.randomUUID()` is fine — it is
   * never shown, only used as the unique key alongside `productId`). For
   * `certificate`/`sticker` the caller must pass that literal string, since
   * the unique constraint is `(product_id, view_id)` and each product has at
   * most one of each. */
  viewId: string;
  label: string;
  alt: string;
  urlFull: string;
  urlThumb: string;
  width: number;
  height: number;
};

/** Inserts (or, for certificate/sticker, replaces) one uploaded image row. */
export async function addImage(input: AddImageInput): Promise<{ id: string }> {
  const db = await getDb();

  let position = 0;
  if (input.kind === "view") {
    const existing = await db
      .select({ position: productImages.position })
      .from(productImages)
      .where(and(eq(productImages.productId, input.productId), eq(productImages.kind, "view")));
    position = existing.reduce((max, r) => Math.max(max, r.position + 1), 0);
  }

  const [row] = await db
    .insert(productImages)
    .values({
      productId: input.productId,
      position,
      viewId: input.viewId,
      label: input.label,
      alt: input.alt,
      src: input.viewId,
      width: input.width,
      height: input.height,
      kind: input.kind,
      urlFull: input.urlFull,
      urlThumb: input.urlThumb,
    })
    .onConflictDoUpdate({
      target: [productImages.productId, productImages.viewId],
      set: {
        label: input.label,
        alt: input.alt,
        width: input.width,
        height: input.height,
        urlFull: input.urlFull,
        urlThumb: input.urlThumb,
        updatedAt: new Date(),
      },
    })
    .returning({ id: productImages.id });

  if (!row) throw new Error("insert of the image row returned nothing");
  return row;
}

export type UpdateImageResult = { ok: true } | { ok: false; error: string };

/** Updates an image's label and/or alt text. */
export async function updateImage(
  imageId: string,
  patch: { label?: string; alt?: string },
): Promise<UpdateImageResult> {
  const db = await getDb();
  if (patch.alt !== undefined && patch.alt.trim().length < 8) {
    return { ok: false, error: "Alt text needs at least 8 characters." };
  }

  await db
    .update(productImages)
    .set({
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.alt !== undefined ? { alt: patch.alt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(productImages.id, imageId));

  return { ok: true };
}

/** Swaps an image's position with its neighbour in the same product/kind group. */
export async function moveImage(imageId: string, direction: "up" | "down"): Promise<void> {
  const db = await getDb();
  const row = await db.query.productImages.findFirst({ where: eq(productImages.id, imageId) });
  if (!row) return;

  const siblings = await db
    .select({ id: productImages.id, position: productImages.position })
    .from(productImages)
    .where(and(eq(productImages.productId, row.productId), eq(productImages.kind, row.kind)))
    .orderBy(asc(productImages.position));

  const index = siblings.findIndex((s) => s.id === imageId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return;

  const a = siblings[index];
  const b = siblings[swapIndex];
  if (!a || !b) return;

  await db.update(productImages).set({ position: b.position }).where(eq(productImages.id, a.id));
  await db.update(productImages).set({ position: a.position }).where(eq(productImages.id, b.id));
}

/**
 * Deletes an image row and renumbers its remaining siblings (same product +
 * kind) so positions stay contiguous from 0. Does not delete anything from
 * Vercel Blob — v1 leaves the uploaded object in place, orphaned.
 */
export async function removeImage(imageId: string): Promise<void> {
  const db = await getDb();
  const row = await db.query.productImages.findFirst({ where: eq(productImages.id, imageId) });
  if (!row) return;

  await db.delete(productImages).where(eq(productImages.id, imageId));

  const siblings = await db
    .select({ id: productImages.id })
    .from(productImages)
    .where(and(eq(productImages.productId, row.productId), eq(productImages.kind, row.kind)))
    .orderBy(asc(productImages.position));

  for (const [position, sibling] of siblings.entries()) {
    await db.update(productImages).set({ position }).where(eq(productImages.id, sibling.id));
  }
}

export type AdminInventorySummary =
  | { mode: "untracked" }
  | { mode: "quantity"; quantity: number }
  | { mode: "edition"; editionSize: number; sold: number; reserved: number; available: number };

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
    return { mode: "edition", editionSize: variant.editionSize, sold, reserved, available };
  }
  return { mode: "quantity", quantity: variant.inventoryQuantity ?? 0 };
}

export type AdminProductListRow = {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "published" | "archived";
  priceCents: number;
  updatedAt: Date;
  thumbUrl: string | null;
  inventory: AdminInventorySummary;
};

/** Every product, newest-updated first, with just enough to render the admin table. */
export async function listProductsForAdmin(): Promise<AdminProductListRow[]> {
  const db = await getDb();
  const rows = await db.query.products.findMany({
    with: {
      images: { where: eq(productImages.kind, "view"), orderBy: asc(productImages.position) },
      variants: { with: { editions: true } },
    },
    orderBy: (p, { desc }) => desc(p.updatedAt),
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    priceCents: row.priceCents,
    updatedAt: row.updatedAt,
    thumbUrl: row.images[0] ? imageThumbSrc(row.photoDir, row.images[0]) : null,
    inventory: summarizeInventory(row.variants[0]),
  }));
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
  urlThumb: string | null;
  position: number;
};

export type AdminEdition = { number: number; status: "available" | "reserved" | "sold" };

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
