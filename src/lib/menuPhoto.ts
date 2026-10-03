import cuts from "@/data/menuPhotoCuts.json";

/**
 * The sizes each menu photo is cut at (`scripts/build-menu-cards.mjs`), as
 * `srcset`s. Built from the manifest that script writes, so a page only ever
 * offers sizes that exist: a photo with a full-resolution master goes up to
 * 1280px, an old 720px Otter shot stops at 720.
 */
type Cuts = { full: number[]; card: number[] };
const MANIFEST = cuts as Record<string, Cuts>;

/** File suffix of each width in the 3:2 frame. 720 is the bare, indexed URL. */
const FULL_SUFFIX: Record<number, string> = {
  200: "-thumb",
  360: "-360",
  720: "",
  1080: "-1080",
  1280: "-1280",
};

const NO_CUTS: Cuts = { full: [200, 720], card: [560] };

/** A photo's cuts, or the two sizes every menu photo has always had. */
export function menuPhotoCuts(photo: string): Cuts {
  return MANIFEST[photo] ?? NO_CUTS;
}

/** `srcset` of the 3:2 frame, in `ext`, up to `max` px wide. */
export function menuPhotoSrcSet(photo: string, ext: "avif" | "webp", max = Infinity): string {
  return menuPhotoCuts(photo)
    .full.filter((w) => w <= max)
    .map((w) => `/menu/${photo}${FULL_SUFFIX[w] ?? `-${w}`}.${ext} ${w}w`)
    .join(", ");
}

/** `srcset` of the 4:3 menu card crop, in `ext`. Its 560px cut (or the
 * largest a small original allows) keeps the original `-card` URL. */
export function menuCardSrcSet(photo: string, ext: "avif" | "webp"): string {
  const ws = menuPhotoCuts(photo).card;
  const base = Math.max(...ws.filter((w) => w <= 560));
  return ws.map((w) => `/menu/${photo}-card${w === base ? "" : `-${w}`}.${ext} ${w}w`).join(", ");
}

/** The largest WebP of the 3:2 frame: what search engines are pointed at. */
export function menuPhotoLargest(photo: string): string {
  const w = Math.max(...menuPhotoCuts(photo).full);
  return `/menu/${photo}${FULL_SUFFIX[w] ?? `-${w}`}.webp`;
}

/**
 * A CSS `image-set()` for a background drawn up to about 600 CSS px wide (the
 * item sheet's photo, zoomed): AVIF first, the 720 at 1x and the largest cut
 * at 2x and up. Browsers without `type()` in `image-set()` keep the plain
 * `url()` declared before it.
 */
export function menuPhotoImageSet(photo: string): string {
  const big = Math.max(...menuPhotoCuts(photo).full);
  const url = (w: number, ext: string) => `url(/menu/${photo}${FULL_SUFFIX[w] ?? `-${w}`}.${ext})`;
  const entries = [`${url(720, "avif")} type("image/avif") 1x`];
  if (big > 720) entries.push(`${url(big, "avif")} type("image/avif") 2x`);
  entries.push(`${url(720, "webp")} type("image/webp") 1x`);
  if (big > 720) entries.push(`${url(big, "webp")} type("image/webp") 2x`);
  return `image-set(${entries.join(", ")})`;
}
