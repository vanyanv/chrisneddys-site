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
import { and, asc, desc, eq, gt, ne } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { imageThumbSrc } from "@/lib/productImage";
import {
  missingPublishRequirements,
  PUBLISH_REQUIREMENT_MESSAGES,
} from "@/lib/publishRequirements";
import { editions, productImages, products, variants, type AuthenticityFact } from "@/db/schema";

/** `db ?? getDb()` — lets a function join a caller's transaction (pass `tx`)
 * while still working standalone (pass nothing). Same pattern as
 * `src/lib/orders.ts`'s `resolveDb`. */
async function resolveDb(db: Db | undefined): Promise<Db> {
  return db ?? (await getDb());
}

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

/** Appends `-copy`, then `-copy-2`, `-copy-3`, … to `baseSlug` until unique. */
async function uniqueCopySlug(baseSlug: string): Promise<string> {
  const db = await getDb();
  const rows = await db.select({ slug: products.slug }).from(products);
  const taken = new Set(rows.map((r) => r.slug));

  const base = `${baseSlug}-copy`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** One past the highest existing `position`, i.e. where a new product (or a
 * duplicate) belongs so it lands at the end of the rack. */
async function nextPosition(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ position: products.position })
    .from(products)
    .orderBy(desc(products.position))
    .limit(1);
  return (row?.position ?? -1) + 1;
}

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

/** The autosaveable single-field whitelist for `updateProductField`, and
 * each field's value type — the exact contract the panel's per-field
 * autosave codes against. */
export type ProductFieldValues = {
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

export type ProductField = keyof ProductFieldValues;

export type UpdateProductFieldResult<F extends ProductField = ProductField> =
  | { ok: true; previous: ProductFieldValues[F] }
  | { ok: false; error: string };

/**
 * Thin typed wrapper over `updateProduct`'s validation, for the panel's
 * per-field autosave: writes exactly one column, with the same validation
 * `updateProduct` applies to that field, and returns the value the column
 * held before the write so the caller can offer "Undo".
 */
export async function updateProductField<F extends ProductField>(
  id: string,
  field: F,
  value: ProductFieldValues[F],
  dbOverride?: Db,
): Promise<UpdateProductFieldResult<F>> {
  const db = await resolveDb(dbOverride);
  const existing = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!existing) return { ok: false, error: "Product not found." };

  const touch = { updatedAt: new Date() };

  switch (field) {
    case "slug": {
      const slug = String(value).trim().toLowerCase();
      if (!SLUG_PATTERN.test(slug)) {
        return { ok: false, error: "Slug must be lowercase letters, numbers and hyphens only." };
      }
      const clash = await db.query.products.findFirst({
        where: and(eq(products.slug, slug), ne(products.id, id)),
      });
      if (clash) return { ok: false, error: "That slug is already in use by another product." };
      await db
        .update(products)
        .set({ slug, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.slug } as UpdateProductFieldResult<F>;
    }
    case "priceCents": {
      const priceCents = Number(value);
      if (!Number.isInteger(priceCents) || priceCents < 0) {
        return { ok: false, error: "Price must be zero or a positive whole number of cents." };
      }
      await db
        .update(products)
        .set({ priceCents, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.priceCents } as UpdateProductFieldResult<F>;
    }
    case "perOrderLimit": {
      const perOrderLimit = Number(value);
      if (!Number.isInteger(perOrderLimit) || perOrderLimit < 1) {
        return { ok: false, error: "Per-order limit must be a positive whole number." };
      }
      await db
        .update(products)
        .set({ perOrderLimit, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.perOrderLimit } as UpdateProductFieldResult<F>;
    }
    case "metaDescription": {
      const metaDescription = String(value);
      if (metaDescription.length > 155) {
        return { ok: false, error: "Meta description must be 155 characters or fewer." };
      }
      await db
        .update(products)
        .set({ metaDescription, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.metaDescription } as UpdateProductFieldResult<F>;
    }
    case "oneSize": {
      const oneSize = Boolean(value);
      await db
        .update(products)
        .set({ oneSize, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.oneSize } as UpdateProductFieldResult<F>;
    }
    case "details": {
      const details = Array.isArray(value) ? (value as string[]) : [];
      await db
        .update(products)
        .set({ details: details.length > 0 ? details : null, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.details ?? [] } as UpdateProductFieldResult<F>;
    }
    case "authenticityFacts": {
      const facts = Array.isArray(value) ? (value as AuthenticityFact[]) : [];
      await db
        .update(products)
        .set({ authenticityFacts: facts.length > 0 ? facts : null, ...touch })
        .where(eq(products.id, id));
      return {
        ok: true,
        previous: existing.authenticityFacts ?? [],
      } as UpdateProductFieldResult<F>;
    }
    case "name": {
      const text = String(value);
      await db
        .update(products)
        .set({ name: text, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.name } as UpdateProductFieldResult<F>;
    }
    case "displayName1": {
      const text = String(value);
      await db
        .update(products)
        .set({ displayName1: text, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.displayName1 } as UpdateProductFieldResult<F>;
    }
    case "displayName2": {
      const text = String(value);
      await db
        .update(products)
        .set({ displayName2: text, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.displayName2 } as UpdateProductFieldResult<F>;
    }
    case "eyebrow": {
      const text = String(value);
      await db
        .update(products)
        .set({ eyebrow: text, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.eyebrow } as UpdateProductFieldResult<F>;
    }
    case "description": {
      const text = String(value);
      await db
        .update(products)
        .set({ description: text, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.description } as UpdateProductFieldResult<F>;
    }
    case "limitedNote": {
      const text = String(value);
      await db
        .update(products)
        .set({ limitedNote: text, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.limitedNote } as UpdateProductFieldResult<F>;
    }
    case "fit": {
      const text = value === null ? null : String(value).trim() || null;
      await db
        .update(products)
        .set({ fit: text, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.fit } as UpdateProductFieldResult<F>;
    }
    case "limitedCopy": {
      const text = value === null ? null : String(value).trim() || null;
      await db
        .update(products)
        .set({ limitedCopy: text, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.limitedCopy } as UpdateProductFieldResult<F>;
    }
    case "why": {
      const text = value === null ? null : String(value).trim() || null;
      await db
        .update(products)
        .set({ why: text, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.why } as UpdateProductFieldResult<F>;
    }
    case "authenticityCopy": {
      const text = value === null ? null : String(value).trim() || null;
      await db
        .update(products)
        .set({ authenticityCopy: text, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.authenticityCopy } as UpdateProductFieldResult<F>;
    }
    default: {
      const _exhaustive: never = field;
      return { ok: false, error: `Unsupported field: ${String(_exhaustive)}` };
    }
  }
}

/** Thrown inside `applyProductChanges`'s transaction to unwind it with the
 * failing change's index and reason — never escapes that function. */
class BatchValidationError extends Error {
  constructor(
    message: string,
    public readonly failedIndex: number,
  ) {
    super(message);
  }
}

export type ProductChange = {
  id: string;
  field: ProductField | "inventoryN";
  value: unknown;
};

export type ApplyProductChangesResult =
  | { ok: true; applied: number }
  | { ok: false; error: string; failedIndex: number };

/**
 * The Sheet's batched Save: applies every cell edit — across any number of
 * products — in one transaction. Each change is validated with the same
 * rules `updateProductField` applies to its field; `field: "inventoryN"`
 * instead sets the count (`quantity` mode) or size (`edition` mode) for
 * whatever inventory mode the product is *currently* in via `setInventory`,
 * and is invalid for a product with no tracked inventory (`mode:
 * "untracked"`, including one with no variant row at all).
 *
 * If any change fails, the transaction rolls back — nothing in the batch is
 * written, not even changes earlier in the array that validated fine — and
 * the result names the failing change's index into `changes`. When the same
 * `(id, field)` pair appears more than once, the later entry wins simply
 * because changes are applied in array order within the same transaction.
 */
export async function applyProductChanges(
  changes: ProductChange[],
): Promise<ApplyProductChangesResult> {
  const db = await getDb();

  try {
    const applied = await db.transaction(async (tx) => {
      for (const [index, change] of changes.entries()) {
        if (change.field === "inventoryN") {
          const product = await tx.query.products.findFirst({
            where: eq(products.id, change.id),
            with: { variants: { with: { editions: true } } },
          });
          if (!product) throw new BatchValidationError("Product not found.", index);

          const variant = product.variants[0];
          const mode: InventoryMode =
            variant && variant.editionSize !== null
              ? "edition"
              : variant && variant.inventoryQuantity !== null
                ? "quantity"
                : "untracked";
          if (mode === "untracked") {
            throw new BatchValidationError(
              "This product's inventory isn't tracked — turn on quantity or edition tracking before setting a count.",
              index,
            );
          }

          const result = await setInventory(change.id, mode, Number(change.value), tx);
          if (!result.ok) throw new BatchValidationError(result.error, index);
        } else {
          const result = await updateProductField(
            change.id,
            change.field,
            change.value as ProductFieldValues[ProductField],
            tx,
          );
          if (!result.ok) throw new BatchValidationError(result.error, index);
        }
      }
      return changes.length;
    });

    return { ok: true, applied };
  } catch (err) {
    if (err instanceof BatchValidationError) {
      return { ok: false, error: err.message, failedIndex: err.failedIndex };
    }
    throw err;
  }
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

export type InventoryMode = "untracked" | "quantity" | "edition";

export type SetInventoryResult = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Thrown when an edition run's size would change after any number in it has
 * sold — issue #36's "Wiring The Rack" analysis, phase 3: "the count locks
 * the moment number one sells" (the `n-run` annotation), because by then
 * that count is printed on a certificate in somebody's hands. Once
 * `soldCount` is above zero, `setInventory("edition", …)` refuses *any*
 * different size — growing the run is refused exactly like shrinking it,
 * not just a shrink below the highest sold number (the pre-phase-3 rule).
 * `setInventory` is the only caller today; it catches this and reports
 * `.message` through its ordinary `{ ok: false, error }` result, but the
 * class is exported so the lock itself — not just that one call site's
 * translation of it — is directly testable.
 */
export class EditionSizeLockedError extends Error {
  constructor(public readonly soldCount: number) {
    super(
      `This run is locked — ${soldCount} number${soldCount === 1 ? " has" : "s have"} already ` +
        "sold. The edition size can't change now.",
    );
    this.name = "EditionSizeLockedError";
  }
}

/** Throws `EditionSizeLockedError` if `variant` already has any `sold`
 * edition and `nextSize` isn't the size it's already at — a no-op save (the
 * same size resubmitted) never trips the lock. A variant with nothing sold
 * yet, or with no variant at all (a run that's never existed), is always
 * unlocked. */
function assertEditionSizeUnlocked(
  variant: { editionSize: number | null; editions: { status: string }[] } | undefined,
  nextSize: number,
): void {
  if (!variant || nextSize === variant.editionSize) return;
  const soldCount = variant.editions.filter((e) => e.status === "sold").length;
  if (soldCount > 0) throw new EditionSizeLockedError(soldCount);
}

/**
 * Sets a product's inventory mode.
 *
 * - `untracked`: clears both `inventory_quantity` and `edition_size` on the
 *   variant (creating a bare one if none exists yet).
 * - `quantity`: stores a plain count, clears `edition_size`.
 * - `edition`: creates the variant if none exists (sku from the slug,
 *   upper-cased; label "One size"), then makes the run exactly `1..n` —
 *   creating the numbers that don't exist yet and deleting any above `n`.
 *   Never deletes a `sold` or `reserved` edition: changing `n` at all once
 *   anything has sold is refused outright by `assertEditionSizeUnlocked`
 *   (not just a shrink below the highest sold number), and a shrink past a
 *   number held by an open checkout is refused until that hold lapses.
 */
export async function setInventory(
  id: string,
  mode: InventoryMode,
  n?: number,
  dbOverride?: Db,
): Promise<SetInventoryResult> {
  const db = await resolveDb(dbOverride);
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

    try {
      assertEditionSizeUnlocked(variant, size);
    } catch (err) {
      if (err instanceof EditionSizeLockedError) return { ok: false, error: err.message };
      throw err;
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

    // Shrinking has to remove the numbers that fall off the end, or the run
    // keeps rows it no longer claims to have: take 50 down to 20 and the
    // board reads "50 of 20 left", counting fifty surviving editions against
    // an `editionSize` of 20. Nothing above `size` can be `sold` — the lock
    // above already refused any change in that case — but a number can be
    // `reserved` by a checkout that's open right now, and deleting that row
    // would strand a buyer mid-payment holding a number the run no longer
    // has. So refuse the shrink while such a hold is live, and say which
    // number it is; holds lapse on their own, and the save works after.
    if (variant.editions.some((e) => e.number > size && e.status === "reserved")) {
      const held = variant.editions
        .filter((e) => e.number > size && e.status === "reserved")
        .map((e) => e.number)
        .sort((a, b) => a - b);
      return {
        ok: false,
        error:
          `Number ${held[0]} is on hold in an open checkout right now, so the run ` +
          `can't shrink to ${size} yet. Try again once the hold lapses.`,
      };
    }
    await db
      .delete(editions)
      .where(and(eq(editions.variantId, variant.id), gt(editions.number, size)));

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

export type ReorderImagesResult = { ok: true };

/**
 * Sets every listed `kind: "view"` image's `position` to its index in
 * `orderedImageIds` (0-based). Ids that don't belong to this product's view
 * images (unknown, another product's, or a certificate/sticker) are ignored,
 * same as `reorderProducts`.
 */
export async function reorderImages(
  productId: string,
  orderedImageIds: string[],
): Promise<ReorderImagesResult> {
  const db = await getDb();
  const siblings = await db
    .select({ id: productImages.id })
    .from(productImages)
    .where(and(eq(productImages.productId, productId), eq(productImages.kind, "view")));
  const validIds = new Set(siblings.map((s) => s.id));
  const ids = orderedImageIds.filter((imgId) => validIds.has(imgId));

  await db.transaction(async (tx) => {
    for (const [position, imgId] of ids.entries()) {
      await tx
        .update(productImages)
        .set({ position, updatedAt: new Date() })
        .where(eq(productImages.id, imgId));
    }
  });

  return { ok: true };
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
