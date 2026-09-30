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
 * It also cuts the photo that leads the menu ("Asked about most") from
 * `public/photos/double-4x3.jpg` into the AVIF/WebP ladder its `<picture>`
 * asks for: `public/photos/double-4x3-{480,720,900}.{avif,webp}`.
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

async function cardCut(id) {
  const src = join(MENU, `${id}.webp`);
  const meta = await sharp(src).metadata();
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
  const src = join(root, "public/photos/double-4x3.jpg");
  for (const w of [480, 720, 900]) {
    for (const [ext, opts] of [
      ["avif", (p) => p.avif(AVIF)],
      ["webp", (p) => p.webp({ quality: 82 })],
    ]) {
      const out = join(root, `public/photos/double-4x3-${w}.${ext}`);
      const buf = await opts(sharp(src).resize({ width: w })).toBuffer();
      writeFileSync(out, buf);
      console.log(`${out} — ${buf.length} bytes`);
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
