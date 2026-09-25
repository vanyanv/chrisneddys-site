/**
 * The wordmark in the header and footer. It draws 71-156 CSS px wide (107-121
 * on a phone), so a 3x phone needs ~360 device px of it, yet every page used to
 * download the 618px file: PageSpeed flagged it as the largest oversized image
 * on the home page. `cne-logo-360.webp` is the same PNG master resized to 360px
 * and saved near-lossless (16 KB against 23 KB), with no visible difference at
 * 3x; the 618px file stays in the set for anything that draws it larger.
 */
export const LOGO = {
  src: "/cne-logo-2x.webp",
  srcSet: "/cne-logo-360.webp 360w, /cne-logo-2x.webp 618w",
  width: 309,
  height: 87,
} as const;
