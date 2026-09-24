import { brand } from "@/data/brand";

/**
 * The hero still, at the widths the layout actually asks for.
 *
 * Lighthouse measured this as the home page's Largest Contentful Paint and the
 * only real performance problem on the site: a 1400px source rendered into a
 * 346px slot on a phone, 73% of the bytes thrown away. Everything else scored
 * clean — 10ms total blocking time, zero layout shift — so this image is the
 * whole of the LCP story.
 *
 * "3A The Peek" (issue #112) put the photo in its own edge-to-edge column
 * instead of a bordered box beside the copy: the slot is now ~50% of the
 * viewport from 600px up (panel left, photo right) and, below 600px, the
 * full viewport width at a 76vw-tall landscape crop — see `HERO_WIDE` below,
 * which is what a phone actually downloads. `HERO`'s own portrait ladder and
 * `sizes` only matter at 600px and up now; the phone `<source>`s in
 * `Hero.tsx` take priority under that.
 *
 * The preload in `app/page.tsx` must pass the *same* srcset and sizes. A
 * preload that disagrees with the `<img>` is a second, separate download.
 *
 * AVIF cuts (`hero-still-<w>.avif` plus the full-size `hero-still.avif`) sit
 * alongside the WebP ones and are served first, via a `<picture>` in
 * `Hero.tsx` — AVIF wins the byte-for-byte comparison at every width here,
 * and the WebP `<img>` below is what browsers without AVIF support fall back
 * to. A 402px-wide, 3x phone needs ~1100 device px for this slot, which is
 * why 1100 is a rung in both ladders rather than jumping from 760/760 straight
 * to the 1400w originals. Regenerate both ladders with
 * `node scripts/build-photo-cuts.mjs` after replacing the source photo.
 */
const WEBP_WIDTHS = [360, 560, 760, 1000, 1100] as const;
const AVIF_WIDTHS = [360, 560, 760, 1100] as const;

export const HERO = {
  src: "/hero-still.webp",
  srcSet: WEBP_WIDTHS.map((w) => `/hero-still-${w}.webp ${w}w`)
    .concat("/hero-still.webp 1400w")
    .join(", "),
  avifSrcSet: AVIF_WIDTHS.map((w) => `/hero-still-${w}.avif ${w}w`)
    .concat("/hero-still.avif 1400w")
    .join(", "),
  // Only actually selected at 600px and up (see the phone-only `<source>`s in
  // Hero.tsx); the 100vw clause is a defensive fallback for a browser old
  // enough to support neither AVIF nor WebP nor the phone sources' media
  // matching, not the common case below 600px.
  //
  // The first clause is a phone held sideways (the short-landscape tier in
  // counter.css) on a 3x screen. There the photo column is ~453px wide, so
  // the honest 50vw asks for ~1360 device px and the browser takes the 80 KB
  // 1400w original, which on a slow line arrives last of everything the page
  // loads: 2.7s to the home page's Largest Contentful Paint (issue #160).
  // 36vw lands that pick on the 1100w cut instead (~2.4 device px per CSS px,
  // the same density a portrait 3x phone already gets from the 1000w crop),
  // which is where the extra pixels stop being visible on a photo. 2x screens
  // and every other width keep the 50vw pick. A browser that ignores the
  // `resolution` feature in `sizes` just falls through to 50vw, as before.
  sizes:
    "(min-width: 600px) and (max-width: 900px) and (max-height: 500px) and (min-resolution: 2.5dppx) 36vw, (min-width: 600px) 50vw, 100vw",
  width: 1400,
  height: 1480,
  alt: "A basket of Chris N Eddy's smashed cheeseburger sliders",
} as const;

/**
 * The phone-only landscape crop (issue #112's "3A The Peek"). The hero box
 * below 600px is 100vw wide and 76vw tall — landscape — while `HERO` above is
 * cut from the still's native 1400x1480 portrait. A `cover` fit on that
 * portrait source in a landscape box downloads the full 1400px width to keep
 * only a band out of the middle; `build-photo-cuts.mjs` does that crop ahead
 * of time instead (the central 1400x1064 band, the same 100:76 ratio the box
 * fills), so the phone ladder is cut for the shape it actually renders into.
 * Full viewport width at every phone size, hence the flat `100vw`. The ladder
 * tops out at 1000 (not 1200) to keep the 3x-phone pick inside the LCP byte
 * budget — see the note in `build-photo-cuts.mjs`.
 */
const WIDE_WIDTHS = [480, 800, 1000] as const;

export const HERO_WIDE = {
  avifSrcSet: WIDE_WIDTHS.map((w) => `/hero-wide-${w}.avif ${w}w`).join(", "),
  webpSrcSet: WIDE_WIDTHS.map((w) => `/hero-wide-${w}.webp ${w}w`).join(", "),
  sizes: "100vw",
} as const;

/** Absolute URL for the hero still, for structured data and social cards. */
export const heroImageUrl = `${brand.siteUrl}${HERO.src}`;
