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
 * and 618 at 1516, which is what the two clauses below describe.
 *
 * The preload in `app/page.tsx` must pass the *same* srcset and sizes. A
 * preload that disagrees with the `<img>` is a second, separate download.
 */
export const HERO = {
  src: "/hero-still.webp",
  srcSet: [360, 560, 760, 1000]
    .map((w) => `/hero-still-${w}.webp ${w}w`)
    .concat("/hero-still.webp 1400w")
    .join(", "),
  sizes: "(min-width: 901px) 42vw, calc(100vw - 36px)",
  width: 1400,
  height: 1480,
  alt: "A basket of Chris N Eddy's smashed cheeseburger sliders",
} as const;

/** Absolute URL for the hero still, for structured data and social cards. */
export const heroImageUrl = `${brand.siteUrl}${HERO.src}`;
