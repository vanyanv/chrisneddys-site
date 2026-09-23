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
 * `sizes` is measured, not guessed: the slot is 346 CSS px at a 390px viewport
 * and 618 at 1516, and between 600 and 900px, where the photo sits beside the
 * headline, it runs 41-43% of the viewport (244px at 600, 389 at 900). The
 * three clauses below describe those.
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
  sizes: "(min-width: 901px) 42vw, (min-width: 600px) 43vw, calc(100vw - 36px)",
  width: 1400,
  height: 1480,
  alt: "A basket of Chris N Eddy's smashed cheeseburger sliders",
} as const;

/** Absolute URL for the hero still, for structured data and social cards. */
export const heroImageUrl = `${brand.siteUrl}${HERO.src}`;
