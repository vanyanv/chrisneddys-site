"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import {
  addImage,
  applyProductChanges,
  createDraft,
  duplicateProduct,
  getProductForAdmin,
  moveImage,
  reorderImages,
  reorderProducts,
  removeImage,
  setInventory,
  setStatus,
  updateImage,
  updateProduct,
  updateProductField,
  type AdminProduct,
  type InventoryMode,
  type ProductChange,
  type ProductField,
  type ProductFieldValues,
} from "@/lib/catalogAdmin";
import type { AuthenticityFact } from "@/db/schema";

/** Every write the storefront could show goes through here: the cached
 * catalogue reads (`src/lib/catalog.ts`) and the two /shop routes that could
 * be showing this product right now. */
function revalidateStorefront(...slugs: string[]): void {
  revalidateTag("catalogue");
  revalidatePath("/shop/");
  for (const slug of new Set(slugs)) {
    revalidatePath(`/shop/${slug}/`);
  }
}

export type CreateDraftState = { error?: string };

export async function createProductAction(
  _prevState: CreateDraftState | undefined,
  formData: FormData,
): Promise<CreateDraftState> {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the product a name." };

  const { id } = await createDraft(name);
  redirect(`/admin/products/${id}`);
}

export type CreateProductPlainResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };

/** The Sheet's inline "+ Add a product" row: a plain (non-FormData, non-
 * redirecting) equivalent of `createProductAction` so the row can create the
 * draft, apply its starting price, and expand in place instead of
 * navigating away to the full editor. */
export async function createProductPlainAction(name: string): Promise<CreateProductPlainResult> {
  await requireOwner();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the product a name." };

  const { id, slug } = await createDraft(trimmed);
  revalidateStorefront(slug);
  return { ok: true, id, slug };
}

export type SaveProductState = {
  ok?: boolean;
  error?: string;
  /** ISO timestamp — formatted client-side (`ProductForm`) so it renders in
   * the viewer's local time instead of the server's (UTC on Vercel). */
  savedAt?: string;
};

function linesToList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseAuthenticityFacts(formData: FormData): AuthenticityFact[] {
  const facts: AuthenticityFact[] = [];
  for (let i = 0; i < 4; i++) {
    const label = String(formData.get(`authFactLabel${i}`) ?? "").trim();
    const value = String(formData.get(`authFactValue${i}`) ?? "").trim();
    if (label && value) facts.push({ label, value });
  }
  return facts;
}

export async function saveProductAction(
  _prevState: SaveProductState | undefined,
  formData: FormData,
): Promise<SaveProductState> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing product id." };

  const priceDollars = Number(formData.get("priceDollars") ?? "0");
  if (!Number.isFinite(priceDollars) || priceDollars < 0) {
    return { error: "Price must be a positive number." };
  }
  const perOrderLimit = Number(formData.get("perOrderLimit") ?? "6");
  if (!Number.isInteger(perOrderLimit) || perOrderLimit < 1) {
    return { error: "Per-order limit must be a positive whole number." };
  }
  const metaDescription = String(formData.get("metaDescription") ?? "");
  if (metaDescription.length > 155) {
    return { error: "Meta description must be 155 characters or fewer." };
  }

  const result = await updateProduct(id, {
    name: String(formData.get("name") ?? "").trim(),
    displayName1: String(formData.get("displayName1") ?? "").trim(),
    displayName2: String(formData.get("displayName2") ?? "").trim(),
    eyebrow: String(formData.get("eyebrow") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim(),
    priceCents: Math.round(priceDollars * 100),
    perOrderLimit,
    oneSize: formData.get("oneSize") === "on",
    description: String(formData.get("description") ?? ""),
    metaDescription,
    limitedNote: String(formData.get("limitedNote") ?? ""),
    details: linesToList(formData.get("details")),
    fit: String(formData.get("fit") ?? "").trim() || null,
    limitedCopy: String(formData.get("limitedCopy") ?? "").trim() || null,
    why: String(formData.get("why") ?? "").trim() || null,
    authenticityCopy: String(formData.get("authenticityCopy") ?? "").trim() || null,
    authenticityFacts: parseAuthenticityFacts(formData),
  });

  if (!result.ok) return { error: result.error };

  revalidateStorefront(result.oldSlug, result.newSlug);

  return { ok: true, savedAt: new Date().toISOString() };
}

export type StatusActionState = { error?: string };

export async function setStatusAction(
  _prevState: StatusActionState | undefined,
  formData: FormData,
): Promise<StatusActionState> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as "draft" | "published" | "archived";
  if (!id || !["draft", "published", "archived"].includes(status)) {
    return { error: "Bad status change." };
  }

  const result = await setStatus(id, status);
  if (!result.ok) return { error: result.error };

  revalidateStorefront(result.slug);
  return {};
}

export type InventoryActionState = { ok?: boolean; error?: string };

export async function setInventoryAction(
  _prevState: InventoryActionState | undefined,
  formData: FormData,
): Promise<InventoryActionState> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const mode = String(formData.get("mode") ?? "") as InventoryMode;
  if (!id || !["untracked", "quantity", "edition"].includes(mode)) {
    return { error: "Bad inventory mode." };
  }

  const nRaw = formData.get("n");
  const n = nRaw !== null && nRaw !== "" ? Number(nRaw) : undefined;

  const result = await setInventory(id, mode, n);
  if (!result.ok) return { error: result.error };

  revalidateStorefront(result.slug);
  return { ok: true };
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

export async function moveImageAction(formData: FormData): Promise<void> {
  await requireOwner();
  const imageId = String(formData.get("imageId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const direction = String(formData.get("direction") ?? "") as "up" | "down";
  if (!imageId || !productId || (direction !== "up" && direction !== "down")) return;

  await moveImage(imageId, direction);
  const product = await getProductForAdmin(productId);
  if (product) revalidateStorefront(product.slug);
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

/** Per-field autosave for the panel's single controls and its Story &
 * details / Authenticity / Search engines accordions. `F` pins `value` and
 * the returned `previous` to that one field's type — see `ProductField` /
 * `ProductFieldValues` in `@/lib/catalogAdmin`. */
export async function updateProductFieldAction<F extends ProductField>(
  id: string,
  field: F,
  value: ProductFieldValues[F],
): Promise<Awaited<ReturnType<typeof updateProductField<F>>>> {
  await requireOwner();
  const result = await updateProductField(id, field, value);
  if (result.ok) {
    const product = await getProductForAdmin(id);
    if (product) revalidateStorefront(product.slug);
  }
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

  const after = await Promise.all(touchedIds.map((id) => getProductForAdmin(id)));
  const newSlugs = after.filter((p): p is AdminProduct => Boolean(p)).map((p) => p.slug);

  revalidateStorefront(...oldSlugs, ...newSlugs);
  return result;
}

export async function addImageAction(input: {
  productId: string;
  kind: "view" | "certificate" | "sticker";
  viewId: string;
  label: string;
  alt: string;
  urlFull: string;
  urlThumb: string;
  width: number;
  height: number;
}): Promise<{ id: string }> {
  await requireOwner();
  const row = await addImage(input);
  const product = await getProductForAdmin(input.productId);
  if (product) revalidateStorefront(product.slug);
  return row;
}
