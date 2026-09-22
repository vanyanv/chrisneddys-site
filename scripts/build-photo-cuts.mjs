#!/usr/bin/env node
/**
 * Generates responsive AVIF/WebP cuts for the site's above-the-fold photos —
 * the home hero and the careers photo — so the `<picture>` elements in
 * `Hero.tsx` and `careers/page.tsx` can offer a browser exactly the pixels its
 * slot needs instead of falling back to a single oversized source.
 *
 * Mirrors the style of `scripts/build-shop-images.mjs`: plain `sharp`, no
 * other imaging dependency, output written straight into `public/` next to
 * the existing originals. Deliberately narrow rather than generic — it only
 * ever produces the specific cuts these two `<picture>` elements reference,
 * so a later change to either component is the thing that grows this file,
 * not a `--in`/`--out` CLI surface nothing else needs yet.
 *
 * Run with:
 *
 *     node scripts/build-photo-cuts.mjs
 *
 * Re-run after replacing either source photo (`public/hero-still.webp` at
 * 1400×1480, or `public/photos/double-16x9.jpg` at 900×506).
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// effort 6 + quality ~50 measured at ~51 KB for the 1100w hero cut — the
// target this ladder exists for (a 402px@3x phone's ~1100 device-px hero
// slot, previously served the 173 KB 1400w WebP original).
const AVIF = { quality: 50, effort: 6 };
// Matches the quality the existing hero WebP cuts were built at.
const WEBP = { quality: 82 };

async function avifCut(src, outPath, width) {
  const pipeline = width ? sharp(src).resize({ width }) : sharp(src);
  const buf = await pipeline.avif(AVIF).toBuffer();
  writeFileSync(outPath, buf);
  console.log(`${outPath} — ${buf.length} bytes`);
}

async function webpCut(src, outPath, width) {
  const buf = await sharp(src).resize({ width }).webp(WEBP).toBuffer();
  writeFileSync(outPath, buf);
  console.log(`${outPath} — ${buf.length} bytes`);
}

async function main() {
  const heroSrc = join(root, "public/hero-still.webp");
  const careersSrc = join(root, "public/photos/double-16x9.jpg");

  // Hero AVIF ladder: 360/560/760/1100/1400. The existing WebP cuts are
  // 360/560/760/1000 plus the unsuffixed 1400w original — this mirrors that
  // shape in AVIF, with 1100 replacing 1000 as the one non-power-ish rung
  // aimed squarely at 3x phones. There is no source higher-resolution than
  // the 1400w WebP already in the repo, so every cut (including the
  // "full-size" 1400 one) is generated from it.
  for (const w of [360, 560, 760, 1100]) {
    await avifCut(heroSrc, join(root, `public/hero-still-${w}.avif`), w);
  }
  await avifCut(heroSrc, join(root, "public/hero-still.avif"));

  // Hero WebP: only the new 1100w rung. 360/560/760/1000 and the 1400w
  // original already exist and are untouched.
  await webpCut(heroSrc, join(root, "public/hero-still-1100.webp"), 1100);

  // Careers photo: no cuts existed before this — it shipped as one 81 KB
  // JPEG with no srcSet. 480/720/900 covers the phone slot (~370-402 CSS px)
  // up to 2x and the desktop slot (~672 CSS px) up to 1.3x; the source is
  // only 900px wide, so 900 is the ceiling either way.
  for (const w of [480, 720, 900]) {
    await avifCut(careersSrc, join(root, `public/photos/double-16x9-${w}.avif`), w);
    await webpCut(careersSrc, join(root, `public/photos/double-16x9-${w}.webp`), w);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
