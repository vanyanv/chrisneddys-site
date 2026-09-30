/**
 * Creating, updating, reordering, duplicating and publishing products.
 *
 * Part of `@/lib/catalogAdmin` (see `src/lib/catalogAdmin.ts`), which
 * re-exports the public names; import from there, not from here.
 */
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  missingPublishRequirements,
  PUBLISH_REQUIREMENT_MESSAGES,
} from "@/lib/publishRequirements";
import { draftStoredSeo } from "@/lib/productSeo";
import { editions, productImages, products, variants, type AuthenticityFact } from "@/db/schema";
import { SLUG_PATTERN, slugify, uniqueSlug, uniqueCopySlug, nextPosition } from "./shared";

export type CreateDraftResult = { id: string; slug: string };

/**
 * Creates a draft product with a unique slug derived from `name`, appended
 * at the end of the rack (`position` = current max + 1).
 *
 * `name` may be blank — The Rack's "New product" tile creates a draft with
 * no name at all rather than forcing a placeholder like "Untitled product"
 * on it (issue #36's decisions comment: an unnamed draft is a first-class
 * state, not something to paper over). A blank name still needs a slug, so
 * `"draft"` stands in for the slug base only, never for `name` or
 * `displayName1` — those stay genuinely empty until the owner types
 * something, and `setStatus` refuses to publish while they are.
 */
export async function createDraft(name: string): Promise<CreateDraftResult> {
  const db = await getDb();
  const trimmedName = name.trim();
  const slug = await uniqueSlug(slugify(trimmedName) || "draft");
  const position = await nextPosition();

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
      position,
      metaTitle: null,
      metaKeywords: null,
      socialImageUrl: null,
      socialImageAlt: null,
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
  metaTitle: string | null;
  metaKeywords: string | null;
  socialImageUrl: string | null;
  socialImageAlt: string | null;
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
      metaTitle: patch.metaTitle,
      metaKeywords: patch.metaKeywords,
      socialImageUrl: patch.socialImageUrl,
      socialImageAlt: patch.socialImageAlt,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));

  return { ok: true, oldSlug: existing.slug, newSlug: slug };
}

/**
 * Fills the four search-engine columns with derived copy the moment a
 * product has a name but has never had any of them written. `createDraft`
 * lets The Rack's "New product" button create a nameless draft with nothing
 * to write SEO from (issue #64), so those columns stay empty until the owner
 * names it — this is what catches that moment. Called after every save that
 * could be the one that names it (`applyProductChangesAction` in
 * `actions.ts`); a no-op whenever the product
 * still has no name, or whenever any of the four columns already holds
 * anything at all, so an owner's own words (or an earlier run of this same
 * backfill) are never overwritten. Always uses the synchronous
 * `draftStoredSeo`, never the model-backed `writeProductSeo` — this runs on every
 * save, not just creation, so it can't add latency or a network dependency.
 */
export async function backfillDraftSeo(id: string): Promise<void> {
  const db = await getDb();
  const existing = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!existing || !existing.displayName1.trim()) return;

  const alreadyWritten =
    Boolean(existing.metaTitle?.trim()) ||
    existing.metaDescription.trim() !== "" ||
    Boolean(existing.metaKeywords?.trim()) ||
    Boolean(existing.socialImageAlt?.trim());
  if (alreadyWritten) return;

  const drafted = draftStoredSeo({
    slug: existing.slug,
    name: existing.name,
    displayName1: existing.displayName1,
    displayName2: existing.displayName2,
    price: existing.priceCents / 100,
    eyebrow: existing.eyebrow,
    description: existing.description,
    limitedNote: existing.limitedNote,
  });

  await db
    .update(products)
    .set({
      metaTitle: drafted.metaTitle,
      metaDescription: drafted.metaDescription,
      metaKeywords: drafted.metaKeywords,
      socialImageAlt: drafted.socialImageAlt,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));
}

export type ReorderProductsResult = { ok: true };

/**
 * Sets every listed product's `position` to its index in `orderedIds`
 * (0-based), in one transaction. Ids that don't match any product are
 * silently ignored — the caller (a drag reorder) only ever sends ids it
 * just rendered, so a mismatch here means a product was deleted out from
 * under the request, not a bug worth surfacing.
 */
export async function reorderProducts(orderedIds: string[]): Promise<ReorderProductsResult> {
  const db = await getDb();
  const existing = await db.select({ id: products.id }).from(products);
  const existingIds = new Set(existing.map((r) => r.id));
  const ids = orderedIds.filter((id) => existingIds.has(id));

  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(products).set({ position, updatedAt: new Date() }).where(eq(products.id, id));
    }
  });

  return { ok: true };
}

export type DuplicateProductResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };

/**
 * Copies a product: all copy/price fields, `status` reset to `draft`, a
 * unique `<slug>-copy` (then `-copy-2`, …) slug, appended at the end of the
 * rack. Images are copied as new rows (same `src`/URLs); inventory is
 * copied by mode but never by count — a `quantity` variant starts at 0, an
 * `edition` variant gets fresh, untouched editions of the same size, and an
 * `untracked` variant stays untracked.
 */
export async function duplicateProduct(id: string): Promise<DuplicateProductResult> {
  const db = await getDb();
  const existing = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: { images: true, variants: { with: { editions: true } } },
  });
  if (!existing) return { ok: false, error: "Product not found." };

  const slug = await uniqueCopySlug(existing.slug);
  const position = await nextPosition();

  const [row] = await db
    .insert(products)
    .values({
      slug,
      name: existing.name,
      displayName1: existing.displayName1,
      displayName2: existing.displayName2,
      eyebrow: existing.eyebrow,
      description: existing.description,
      metaDescription: existing.metaDescription,
      limitedNote: existing.limitedNote,
      priceCents: existing.priceCents,
      oneSize: existing.oneSize,
      perOrderLimit: existing.perOrderLimit,
      status: "draft",
      position,
      capColor: existing.capColor,
      details: existing.details,
      fit: existing.fit,
      limitedCopy: existing.limitedCopy,
      why: existing.why,
      authenticityCopy: existing.authenticityCopy,
      authenticityFacts: existing.authenticityFacts,
      metaTitle: existing.metaTitle,
      metaKeywords: existing.metaKeywords,
      socialImageUrl: existing.socialImageUrl,
      socialImageAlt: existing.socialImageAlt,
      photoDir: existing.photoDir,
    })
    .returning({ id: products.id, slug: products.slug });

  if (!row) throw new Error("insert of the duplicated product returned nothing");

  for (const img of existing.images) {
    await db.insert(productImages).values({
      productId: row.id,
      position: img.position,
      viewId: img.viewId,
      label: img.label,
      alt: img.alt,
      src: img.src,
      width: img.width,
      height: img.height,
      kind: img.kind,
      urlFull: img.urlFull,
      urlThumb: img.urlThumb,
    });
  }

  const variant = existing.variants[0];
  if (variant) {
    // Mode is preserved (untracked stays untracked); only the count resets —
    // a quantity variant starts at 0, an edition variant gets a same-size run
    // of fresh, untouched editions rather than copies of the sold/reserved
    // state of the original.
    const inventoryQuantity =
      variant.editionSize !== null
        ? variant.editionSize
        : variant.inventoryQuantity !== null
          ? 0
          : null;

    const [newVariant] = await db
      .insert(variants)
      .values({
        productId: row.id,
        sku: slug.toUpperCase(),
        label: variant.label,
        priceCents: variant.priceCents,
        inventoryQuantity,
        editionSize: variant.editionSize,
        position: variant.position,
      })
      .returning({ id: variants.id });

    if (newVariant && variant.editionSize !== null) {
      for (let number = 1; number <= variant.editionSize; number++) {
        await db.insert(editions).values({ variantId: newVariant.id, number, status: "available" });
      }
    }
  }

  return { ok: true, id: row.id, slug: row.slug };
}

export type SetStatusResult = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Sets a product's status. Stamps `publishedAt` the first time a product is
 * ever published; an unpublish/republish cycle keeps that original
 * timestamp rather than treating every publish as a new "first" one.
 *
 * Refuses to publish a product that isn't ready — see `PublishReadiness`
 * and `missingPublishRequirements` in `@/lib/publishRequirements` for what
 * "ready" means and the order it's checked in. That module is the pure,
 * server-free leaf both this function and the rack panel's live checklist
 * (`RackProductPanel.tsx`) import, so the two can never drift apart.
 */
export async function setStatus(
  id: string,
  status: "draft" | "published" | "archived",
): Promise<SetStatusResult> {
  const db = await getDb();
  const existing = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: {
      images: { where: eq(productImages.kind, "view") },
      variants: true,
    },
  });
  if (!existing) return { ok: false, error: "Product not found." };

  if (status === "published") {
    const variant = existing.variants[0];
    const missing = missingPublishRequirements({
      hasName: existing.displayName1.trim() !== "",
      hasPrice: existing.priceCents > 0,
      hasRunSize: Boolean(
        variant && (variant.editionSize !== null || variant.inventoryQuantity !== null),
      ),
      hasPhoto: existing.images.length > 0,
    });
    const firstMissing = missing[0];
    if (firstMissing) {
      return { ok: false, error: PUBLISH_REQUIREMENT_MESSAGES[firstMissing] };
    }
  }

  const publishedAt =
    status === "published" && existing.publishedAt === null ? new Date() : existing.publishedAt;

  await db
    .update(products)
    .set({ status, publishedAt, updatedAt: new Date() })
    .where(eq(products.id, id));

  return { ok: true, slug: existing.slug };
}
