import localFont from "next/font/local";

/**
 * The site's three typefaces, self-hosted from `src/fonts/` so a build never
 * has to reach Google Fonts: `next/font/google` fetched them at build time,
 * and when Google answered a build server with an unexpected file list the
 * whole build failed (PR #168). These are the same latin files Google serves,
 * so pages look and weigh the same. Shared by the site, admin and root 404
 * layouts, which each put the `variable` classes on their `<html>`.
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
 * The same latin Inter file next/font/google serves, with its weight axis
 * pinned to the 400-800 the site actually uses instead of 100-900: 48 KB ->
 * 37 KB, no visible change. It is preloaded on every page, and on a slow phone
 * connection it downloads alongside the home hero photo, the page's Largest
 * Contentful Paint. See scripts/instance-inter-font.sh.
 */
export const inter = localFont({
  src: "../fonts/inter-latin-400-800.woff2",
  weight: "400 800",
  style: "normal",
  display: "optional",
  preload: true,
  adjustFontFallback: "Arial",
  variable: "--font-inter",
});

/** One variable file covers both weights the site uses (400 and 500). */
export const jetbrains = localFont({
  src: "../fonts/jetbrains-mono-latin.woff2",
  weight: "400 500",
  style: "normal",
  display: "optional",
  adjustFontFallback: "Arial",
  variable: "--font-mono-jb",
});
