/**
 * Product photos: adding, updating, removing and reordering them.
 *
 * Part of `@/lib/catalogAdmin` (see `src/lib/catalogAdmin.ts`), which
 * re-exports the public names; import from there, not from here.
 */
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { productImages } from "@/db/schema";

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
  /** The 400px-wide cut (issue #151) — optional so existing callers/tests
   * that don't care about it still type-check; `/api/admin/upload` always
   * passes one for a new or replaced image. */
  urlMid?: string;
  urlThumb: string;
  /** AVIF twins of the three cuts, which the storefront offers first. Optional
   * for the same reason as `urlMid`; `/api/admin/upload` always passes them. */
  urlFullAvif?: string;
  urlMidAvif?: string;
  urlThumbAvif?: string;
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
      urlMid: input.urlMid ?? null,
      urlThumb: input.urlThumb,
      urlFullAvif: input.urlFullAvif ?? null,
      urlMidAvif: input.urlMidAvif ?? null,
      urlThumbAvif: input.urlThumbAvif ?? null,
    })
    .onConflictDoUpdate({
      target: [productImages.productId, productImages.viewId],
      set: {
        label: input.label,
        alt: input.alt,
        width: input.width,
        height: input.height,
        urlFull: input.urlFull,
        urlMid: input.urlMid ?? null,
        urlThumb: input.urlThumb,
        urlFullAvif: input.urlFullAvif ?? null,
        urlMidAvif: input.urlMidAvif ?? null,
        urlThumbAvif: input.urlThumbAvif ?? null,
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
