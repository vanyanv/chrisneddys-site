"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import {
  addImage,
  createDraft,
  getProductForAdmin,
  moveImage,
  removeImage,
  setInventory,
  setStatus,
  updateImage,
  updateProduct,
  type InventoryMode,
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
