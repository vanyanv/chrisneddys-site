/**
 * The one-field autosave and the Save bar's batch of changes.
 *
 * Part of `@/lib/catalogAdmin` (see `src/lib/catalogAdmin.ts`), which
 * re-exports the public names; import from there, not from here.
 */
import { and, eq, ne } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { products, type AuthenticityFact } from "@/db/schema";
import { resolveDb, SLUG_PATTERN } from "./shared";
import { type InventoryMode, setInventory, setOnlineCount } from "./inventory";

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
  metaTitle: string | null;
  metaKeywords: string | null;
  socialImageUrl: string | null;
  socialImageAlt: string | null;
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
    case "metaTitle": {
      const text = value === null ? null : String(value).trim() || null;
      if (text && text.length > 60) {
        return { ok: false, error: "Meta title must be 60 characters or fewer." };
      }
      await db
        .update(products)
        .set({ metaTitle: text, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.metaTitle } as UpdateProductFieldResult<F>;
    }
    case "metaKeywords": {
      const text = value === null ? null : String(value).trim() || null;
      if (text && text.length > 160) {
        return { ok: false, error: "Meta keywords must be 160 characters or fewer." };
      }
      await db
        .update(products)
        .set({ metaKeywords: text, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.metaKeywords } as UpdateProductFieldResult<F>;
    }
    case "socialImageUrl": {
      const text = value === null ? null : String(value).trim() || null;
      if (text && !(text.startsWith("/") || text.startsWith("https://"))) {
        return {
          ok: false,
          error: `Social image URL must start with "/" or be an https:// URL.`,
        };
      }
      await db
        .update(products)
        .set({ socialImageUrl: text, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.socialImageUrl } as UpdateProductFieldResult<F>;
    }
    case "socialImageAlt": {
      const text = value === null ? null : String(value).trim() || null;
      if (text && (text.length < 8 || text.length > 125)) {
        return { ok: false, error: "Alt text must be between 8 and 125 characters." };
      }
      await db
        .update(products)
        .set({ socialImageAlt: text, ...touch })
        .where(eq(products.id, id));
      return { ok: true, previous: existing.socialImageAlt } as UpdateProductFieldResult<F>;
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
  field: ProductField | "inventoryN" | "onlineN";
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
      // A new run size lands before a new online count, whichever the owner
      // typed first: "left to sell online" is checked against the run.
      const ordered = [...changes.entries()].sort(
        ([ia, a], [ib, b]) =>
          Number(a.field === "onlineN") - Number(b.field === "onlineN") || ia - ib,
      );
      for (const [index, change] of ordered) {
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
        } else if (change.field === "onlineN") {
          const result = await setOnlineCount(change.id, Number(change.value), tx);
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
