#!/usr/bin/env node
/**
 * Cuts the menu page's photo cards (issue #206).
 *
 * The item photos come from Otter at 720x479 on a white sweep, with the food
 * filling only about 45% of the frame's width. Drawn in a card, that is mostly
 * white paper around a small burger. This trims the white, adds back a thin
 * margin and cuts a 4:3 frame around the food, so the food fills the card:
 *
 *   public/menu/<photo>-card.avif   (at most 560px wide, never upscaled)
 *   public/menu/<photo>-card.webp   (the same, for browsers without AVIF)
 *
 * and AVIF copies of the photo's own two sizes, which `MenuPhoto` offers
 * ahead of the WebP (issue #208):
 *
 *   public/menu/<photo>.avif         (720px, the item page and card images)
 *   public/menu/<photo>-thumb.avif   (200px)
 *
 * It also cuts the two big photos into the AVIF/WebP ladders their
 * `<picture>`s ask for, at 480, 720 and 900px wide:
 *
 *   public/photos/double-4x3-<w>.{avif,webp}         the in-hand slider that
 *                                                    leads Sliders
 *   public/photos/combo-2-<way>-16x10-<w>.{avif,webp} 2 Sliders and Fries, both
 *                                                    Ways, the card the menu
 *                                                    opens with (issue #227)
 *
 * from `public/photos/double-4x3.jpg` and `public/photos/combo-2-<way>-16x10.jpg`
 * (16:10 cuts of the owner's studio shots, their near-white backdrop lifted
 * to pure white so AVIF doesn't draw it as faint blocks).
 *
 * Run again after replacing a photo in `public/menu/`:
 *
 *     node scripts/build-menu-cards.mjs
 */
import sharp from "sharp";
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MENU = join(root, "public/menu");

/** The card frame: 4:3, the food plus 7% of its size on each side. */
const RATIO = 4 / 3;
const PAD = 1.14;
const MAX_W = 560;
const WEBP = { quality: 80 };
// Same settings as scripts/build-photo-cuts.mjs, for the same reasons.
const AVIF = { quality: 50, effort: 6, chromaSubsampling: "4:2:0" };

/**
 * The drinks' studio shots: `add-menu-photo.mjs` already centred each frame
 * on the drink, and their long shadow off to the left would pull a trimmed
 * cut off-centre, so these take the middle 4:3 of the frame instead.
 */
const CENTRED = new Set([
  "strawberry-shake",
  "chocolate-shake",
  "vanilla-shake",
  "coca-cola",
  "diet-coke",
  "sprite",
  "orange-fanta",
  "hi-c",
  "minute-maid",
  "mexican-sprite",
  "mexican-fanta",
  "water-bottle",
]);

async function cardCut(id) {
  const src = join(MENU, `${id}.webp`);
  const meta = await sharp(src).metadata();
  if (CENTRED.has(id)) {
    const w = Math.round(meta.height * RATIO);
    return writeCard(id, src, {
      left: Math.round((meta.width - w) / 2),
      top: 0,
      width: w,
      height: meta.height,
    });
  }
  // `trim` reports the box it kept as negative offsets into the original.
  const { info } = await sharp(src).trim({ threshold: 18 }).toBuffer({ resolveWithObject: true });
  const l = -(info.trimOffsetLeft ?? 0);
  const t = -(info.trimOffsetTop ?? 0);
  const cx = l + info.width / 2;
  const cy = t + info.height / 2;

  let w = Math.max(info.width * PAD, info.height * PAD * RATIO);
  let h = w / RATIO;
  if (w > meta.width) {
    w = meta.width;
    h = w / RATIO;
  }
  if (h > meta.height) {
    h = meta.height;
    w = h * RATIO;
  }
  const region = {
    left: Math.round(Math.max(0, Math.min(meta.width - w, cx - w / 2))),
    top: Math.round(Math.max(0, Math.min(meta.height - h, cy - h / 2))),
    width: Math.round(w),
    height: Math.round(h),
  };
  return writeCard(id, src, region);
}

async function writeCard(id, src, region) {
  const cut = () =>
    sharp(src)
      .extract(region)
      .resize({ width: Math.min(MAX_W, region.width), withoutEnlargement: true });
  // AVIF is what almost every visitor gets: about half the bytes of the WebP
  // at the same look, and a menu page loads a dozen of these at once.
  for (const [ext, encode] of [
    ["avif", (p) => p.avif(AVIF)],
    ["webp", (p) => p.webp(WEBP)],
  ]) {
    const out = join(MENU, `${id}-card.${ext}`);
    const buf = await encode(cut()).toBuffer();
    writeFileSync(out, buf);
    console.log(`${out} — ${buf.length} bytes`);
  }
}

async function avifCopies(id) {
  for (const name of [id, `${id}-thumb`]) {
    const out = join(MENU, `${name}.avif`);
    const buf = await sharp(join(MENU, `${name}.webp`))
      .avif(AVIF)
      .toBuffer();
    writeFileSync(out, buf);
    console.log(`${out} — ${buf.length} bytes`);
  }
}

async function leadCuts() {
  for (const name of ["double-4x3", "combo-2-chris-16x10", "combo-2-eddy-16x10"]) {
    const src = join(root, `public/photos/${name}.jpg`);
    for (const w of [480, 720, 900]) {
      for (const [ext, opts] of [
        ["avif", (p) => p.avif(AVIF)],
        ["webp", (p) => p.webp({ quality: 82 })],
      ]) {
        const out = join(root, `public/photos/${name}-${w}.${ext}`);
        const buf = await opts(sharp(src).resize({ width: w })).toBuffer();
        writeFileSync(out, buf);
        console.log(`${out} — ${buf.length} bytes`);
      }
    }
  }
}

async function main() {
  const ids = readdirSync(MENU)
    .filter((f) => f.endsWith(".webp") && !/-(thumb|card)\.webp$/.test(f))
    .map((f) => f.slice(0, -".webp".length));
  for (const id of ids) {
    await cardCut(id);
    await avifCopies(id);
  }
  await leadCuts();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
