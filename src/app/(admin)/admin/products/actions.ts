"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireOwner } from "@/lib/auth";
import {
  applyProductChanges,
  backfillDraftSeo,
  createDraft,
  duplicateProduct,
  getProductForAdmin,
  reorderImages,
  reorderProducts,
  removeImage,
  setEditionAside,
  setInventory,
  setStatus,
  updateImage,
  updateProduct,
  type AdminProduct,
  type InventoryMode,
  type ProductChange,
  type ProductPatch,
} from "@/lib/catalogAdmin";
import { seoWriterConfigured, writeProductSeo, type WrittenSeo } from "@/lib/seoWriter";

/** Every write the storefront could show goes through here: the cached
 * catalogue reads (`src/lib/catalog.ts`) and the two /shop routes that could
 * be showing this product right now. */
function revalidateStorefront(...slugs: string[]): void {
  revalidateTag("catalogue", { expire: 0 });
  revalidatePath("/shop/");
  for (const slug of new Set(slugs)) {
    revalidatePath(`/shop/${slug}/`);
  }
}

/** The rest of `product` carried through unchanged, with `fields` (the
 * model's four lines, or the derived fallback's) laid over the search-engine columns
 * — `updateProduct` takes a full patch, so `generateProductSeoAction`
 * `generateProductSeoAction` build one of these rather than writing the four
 * fields with four separate calls. */
function seoPatch(product: AdminProduct, fields: WrittenSeo): ProductPatch {
  return {
    name: product.name,
    displayName1: product.displayName1,
    displayName2: product.displayName2,
    eyebrow: product.eyebrow,
    slug: product.slug,
    priceCents: product.priceCents,
    perOrderLimit: product.perOrderLimit,
    oneSize: product.oneSize,
    description: product.description,
    metaDescription: fields.metaDescription,
    limitedNote: product.limitedNote,
    details: product.details,
    fit: product.fit,
    limitedCopy: product.limitedCopy,
    why: product.why,
    authenticityCopy: product.authenticityCopy,
    authenticityFacts: product.authenticityFacts,
    metaTitle: fields.metaTitle,
    metaKeywords: fields.metaKeywords,
    socialImageUrl: product.socialImageUrl,
    socialImageAlt: fields.socialImageAlt,
  };
}

/** Writes and saves a product's four search-engine fields in one go — the
 * core of the "Write with AI" button's `generateProductSeoAction`. Throws only if the
 * save itself fails (in practice never, since the slug is unchanged), never
 * because `writeProductSeo` failed — that function already falls back to
 * derived copy on its own. */
async function writeProductSeoFields(product: AdminProduct): Promise<WrittenSeo> {
  const fields = await writeProductSeo(product);
  const result = await updateProduct(product.id, seoPatch(product, fields));
  if (!result.ok) throw new Error(result.error);
  return fields;
}

export type CreateBlankProductResult = { id: string; slug: string };

/**
 * The Rack's "New product" tile/button: creates a nameless draft directly,
 * with no name prompt first. An unnamed draft is a first-class state (issue
 * #36's decisions comment), not a gap the UI has to talk the owner out of —
 * the panel opens straight onto the new, empty draft so naming it is just
 * filling in a field like any other edit.
 */
export async function createBlankProductAction(): Promise<CreateBlankProductResult> {
  await requireOwner();
  const { id, slug } = await createDraft("");
  revalidateStorefront(slug);
  return { id, slug };
}

export type ImageActionState = { ok?: boolean; error?: string };

export async function updateImageAction(
  _prevState: ImageActionState | undefined,
  formData: FormData,
): Promise<ImageActionState> {
  await requireOwner();
  const imageId = String(formData.get("imageId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!imageId || !productId) return { error: "Missing image or product id." };

  const result = await updateImage(imageId, {
    label: String(formData.get("label") ?? ""),
    alt: String(formData.get("alt") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  const product = await getProductForAdmin(productId);
  if (product) revalidateStorefront(product.slug);
  return { ok: true };
}

export async function removeImageAction(formData: FormData): Promise<void> {
  await requireOwner();
  const imageId = String(formData.get("imageId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!imageId || !productId) return;

  const product = await getProductForAdmin(productId);
  await removeImage(imageId);
  if (product) revalidateStorefront(product.slug);
}

export type ReorderProductsActionResult = { ok: true };

/** Drag reorder on the rack. Sets every listed product's position to its
 * index in `ids`; unknown ids are ignored. */
export async function reorderProductsAction(ids: string[]): Promise<ReorderProductsActionResult> {
  await requireOwner();
  const result = await reorderProducts(ids);
  revalidateStorefront();
  return result;
}

export type DuplicateProductActionResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };

/** "···" menu → Duplicate. Copies the product as a new draft appended at the
 * end of the rack. */
export async function duplicateProductAction(id: string): Promise<DuplicateProductActionResult> {
  await requireOwner();
  const result = await duplicateProduct(id);
  if (!result.ok) return result;
  revalidateStorefront(result.slug);
  return result;
}

export type SetProductStatusActionResult = { ok: true } | { ok: false; error: string };

/** Live/Hidden toggle and the "···" menu's Archive/Restore, called directly
 * (not via `archiveProductAction`/`restoreProductAction`) when the caller
 * already knows the target status. */
export async function setProductStatusAction(
  id: string,
  status: "draft" | "published" | "archived",
): Promise<SetProductStatusActionResult> {
  await requireOwner();
  const result = await setStatus(id, status);
  if (!result.ok) return result;
  revalidateStorefront(result.slug);
  return { ok: true };
}

/** "···" menu → Archive. Archived products drop off the rack (still in the
 * database) and only reappear via the "Archived (n)" list. */
export async function archiveProductAction(id: string): Promise<SetProductStatusActionResult> {
  return setProductStatusAction(id, "archived");
}

/** Archived list → Restore, which always lands back in Hidden (`draft`), not
 * whatever status the product held before it was archived. */
export async function restoreProductAction(id: string): Promise<SetProductStatusActionResult> {
  return setProductStatusAction(id, "draft");
}

export type SetInventoryPlainActionResult = { ok: true } | { ok: false; error: string };

/** `setInventory`, callable with plain args instead of `FormData` — the
 * panel's inventory stepper/radio group autosaves through this. */
export async function setInventoryPlainAction(
  id: string,
  mode: InventoryMode,
  n?: number,
): Promise<SetInventoryPlainActionResult> {
  await requireOwner();
  const result = await setInventory(id, mode, n);
  if (!result.ok) return result;
  revalidateStorefront(result.slug);
  return { ok: true };
}

export type ReorderImagesActionResult = { ok: true };

/** Drag reorder within the panel's photo grid (`kind: "view"` images only). */
export async function reorderImagesAction(
  productId: string,
  imageIds: string[],
): Promise<ReorderImagesActionResult> {
  await requireOwner();
  const result = await reorderImages(productId, imageIds);
  const product = await getProductForAdmin(productId);
  if (product) revalidateStorefront(product.slug);
  return result;
}

/** Lazy full-product fetch for `?open=<id>` — the list payload alone isn't
 * enough to render the panel. Null (not a 404) when the id doesn't exist,
 * so the caller can close the panel instead of erroring. */
export async function loadProductForPanelAction(id: string): Promise<AdminProduct | null> {
  await requireOwner();
  const product = await getProductForAdmin(id);
  return product ?? null;
}

export type ApplyProductChangesActionResult =
  | { ok: true; applied: number }
  | { ok: false; error: string; failedIndex: number };

/** The Sheet's Save: one batch of cell edits, applied atomically by
 * `applyProductChanges`. Revalidates every touched product's slug — both the
 * slug it had before the batch and the one it has after, in case one of the
 * changes renamed it. */
export async function applyProductChangesAction(
  changes: ProductChange[],
): Promise<ApplyProductChangesActionResult> {
  await requireOwner();

  const touchedIds = Array.from(new Set(changes.map((c) => c.id)));
  const before = await Promise.all(touchedIds.map((id) => getProductForAdmin(id)));
  const oldSlugs = before.filter((p): p is AdminProduct => Boolean(p)).map((p) => p.slug);

  const result = await applyProductChanges(changes);
  if (!result.ok) return result;

  for (const id of touchedIds) await backfillDraftSeo(id);

  const after = await Promise.all(touchedIds.map((id) => getProductForAdmin(id)));
  const newSlugs = after.filter((p): p is AdminProduct => Boolean(p)).map((p) => p.slug);

  revalidateStorefront(...oldSlugs, ...newSlugs);
  return result;
}

export type GenerateProductSeoResult =
  | { ok: true; fields: WrittenSeo; source: "ai" | "derived" }
  | { ok: false; error: string };

/** The "Search engines" accordion's "Write with AI" button: rewrites all
 * four fields from scratch and saves them in one write. `writeProductSeo`
 * already falls back to the derived copy when `OPENAI_API_KEY` is unset
 * or the call fails, so this action's only jobs are to persist whichever
 * copy it got and tell the caller which one that was, so the toast can say
 * so honestly. */
export async function generateProductSeoAction(id: string): Promise<GenerateProductSeoResult> {
  await requireOwner();
  const product = await getProductForAdmin(id);
  if (!product) return { ok: false, error: "Product not found." };

  let fields: WrittenSeo;
  try {
    fields = await writeProductSeoFields(product);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Couldn't save the generated fields.",
    };
  }

  revalidateStorefront(product.slug);
  return { ok: true, fields, source: seoWriterConfigured() ? "ai" : "derived" };
}

export type SetEditionAsideActionResult = { ok: true } | { ok: false; error: string };

/** The run page's per-number control: take one number off the online shop
 * (sold at the location, kept back) or put it back on sale. */
export async function setEditionAsideAction(
  productId: string,
  number: number,
  aside: boolean,
): Promise<SetEditionAsideActionResult> {
  await requireOwner();
  const result = await setEditionAside(productId, number, aside);
  if (!result.ok) return result;
  revalidateStorefront(result.slug);
  revalidatePath(`/admin/products/${productId}/run`);
  return { ok: true };
}
