/**
 * Where a product image actually lives, for a caller that just wants a `src`.
 *
 * There are two kinds of product image and they resolve differently:
 *
 *  - Uploaded through `/admin/products/<id>` — `POST /api/admin/upload` writes
 *    both cuts to Vercel Blob and stores their absolute URLs on the row, so
 *    `urlThumb` / `urlFull` are the whole answer.
 *  - Shipped in the repo and seeded from `src/data/merch.ts` — the row carries
 *    only a stem (`front`, `angle`, `cyclops`) and the product carries the
 *    directory (`/shop/foam-trucker-blue`). The file on disk is
 *    `<photoDir>/<src>.webp`, with a `-thumb` sibling.
 *
 * The storefront has always handled both (`ProductShot.tsx`); the admin knew
 * only about the first, so every seeded photo rendered as the ink-filled
 * `.adm-thumb-empty` placeholder — a black square where the hat should be.
 * This is that rule in one place, so the two cannot drift again.
 *
 * Deliberately free of `server-only`: `PhotosCard` is a client component.
 */

export type ResolvableImage = {
  /** Stem under `photoDir` for a repo-shipped image; ignored when a URL is set. */
  src?: string | null;
  urlFull?: string | null;
  urlThumb?: string | null;
};

/** The 200px cut, or null when the row names no image this code can find. */
export function imageThumbSrc(
  photoDir: string | null | undefined,
  image: ResolvableImage,
): string | null {
  if (image.urlThumb) return image.urlThumb;
  if (image.urlFull) return image.urlFull;
  if (photoDir && image.src) return `${photoDir}/${image.src}-thumb.webp`;
  return null;
}

/** The 720px cut, same order of preference. */
export function imageFullSrc(
  photoDir: string | null | undefined,
  image: ResolvableImage,
): string | null {
  if (image.urlFull) return image.urlFull;
  if (photoDir && image.src) return `${photoDir}/${image.src}.webp`;
  return image.urlThumb ?? null;
}

/**
 * The alt text every upload used to be stored with until the owner typed a
 * real one. It reached customers verbatim on the product page, so it is now
 * treated as "no alt text yet" wherever it is read: rows written before the
 * fix still carry it, and new uploads store an empty string instead.
 */
export const LEGACY_PLACEHOLDER_ALT = "Product photo — edit this alt text";

/** Whether an image still needs the owner to write its alt text. */
export function needsAltText(alt: string | null | undefined): boolean {
  const text = alt?.trim() ?? "";
  return text === "" || text === LEGACY_PLACEHOLDER_ALT;
}

/**
 * The alt text a shopper's screen reader gets: the owner's own, or — until
 * they write one — the fallback (the product's name), never a placeholder
 * addressed to the owner.
 */
export function shopperAlt(alt: string | null | undefined, fallback: string): string {
  return needsAltText(alt) ? fallback : (alt ?? "").trim();
}
