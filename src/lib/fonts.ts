import localFont from "next/font/local";

/**
 * The site's three typefaces, self-hosted from `src/fonts/` so a build never
 * has to reach Google Fonts: `next/font/google` fetched them at build time,
 * and when Google answered a build server with an unexpected file list the
 * whole build failed (PR #168). These are the latin files Google serves,
 * slimmed by scripts/slim-fonts.sh (every character kept). Shared by the
 * site, admin and root 404 layouts, which each put the `variable` classes on
 * their `<html>`.
 */

export const bowlby = localFont({
  src: "../fonts/bowlby-one-latin.woff2",
  weight: "400",
  style: "normal",
  display: "optional",
  adjustFontFallback: "Arial",
  variable: "--font-bowlby",
});

/**
 * Body text. Barlow is drawn from California's highway and street signs.
 * Two static files, 400 and 700. The storefront also asks for 600 (the skip
 * link, the About page's pull quotes) and 800 (the home page's Start here
 * card names, drink names on the menu); those render at 700. Every font here
 * is preloaded, and on a throttled phone each extra weight pushed the menu
 * and careers photos back by about 0.2 s, so four Barlow files in all (about
 * 57 KB) stand where Inter and JetBrains Mono (48 KB) did.
 */
export const barlow = localFont({
  src: [
    { path: "../fonts/barlow-latin-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/barlow-latin-700.woff2", weight: "700", style: "normal" },
  ],
  display: "optional",
  preload: true,
  adjustFontFallback: "Arial",
  variable: "--font-barlow",
});

/**
 * Labels, prices, hours and times (the `--font-mono` role, which used to be
 * JetBrains Mono). The semi-condensed cut of Barlow keeps tracked capitals
 * reading like a sign. Two weights cover every label: a 400 or 500 label
 * renders at 500, a 700 or 800 label at 700. Proportional, so anything that
 * measures label text does it with `labelWidth` in
 * `components/locations/mapLayout.ts`, not a fixed advance.
 */
export const barlowSemi = localFont({
  src: [
    { path: "../fonts/barlow-semi-condensed-latin-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/barlow-semi-condensed-latin-700.woff2", weight: "700", style: "normal" },
  ],
  display: "optional",
  adjustFontFallback: "Arial",
  variable: "--font-barlow-semi",
});
