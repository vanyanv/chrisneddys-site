#!/usr/bin/env node
/**
 * Adds a new menu photograph from a full-size original (issues #208, #237).
 *
 *     node scripts/add-menu-photo.mjs <original.png|jpg> <photo-id>
 *
 * Cuts the original to the menu's frame (3:2, full height, slid sideways to
 * centre the food; white added above and below when the food is wider than
 * that) and keeps that at full resolution as the photo's master:
 *
 *   assets/menu/<photo-id>.jpg   at most 2160px wide, JPEG quality 95 with
 *                                full-resolution colour: one careful encode,
 *                                so every size cut from it starts clean
 *
 * then runs `scripts/build-menu-cards.mjs`, which cuts every size the site
 * serves from it (200px to 1280px, the 4:3 card, AVIF and WebP), and prints
 * the `[focus, zoom]` framing to add to `src/data/photoFocus.ts`. Point the
 * item's `photo` (or `wayPhotos`) in `src/data/menu.ts` at the id.
 *
 * The original itself stays out of the repo; keep it with the owner's files.
 */
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [src, id] = process.argv.slice(2);
if (!src || !id) {
  console.error("usage: node scripts/add-menu-photo.mjs <original> <photo-id>");
  process.exit(1);
}

/** The food's box: everything that isn't the white sweep. */
async function foodBox(input) {
  const { info } = await sharp(input).trim({ threshold: 18 }).toBuffer({ resolveWithObject: true });
  const left = -(info.trimOffsetLeft ?? 0);
  const top = -(info.trimOffsetTop ?? 0);
  return { left, top, width: info.width, height: info.height };
}

const meta = await sharp(src).metadata();
const box = await foodBox(src);

// 3:2 at full height, slid sideways to centre the food. Food too wide for
// that window (a spread on a wide original) gets white added above and below
// instead, so nothing is cut off.
let h = meta.height;
let w = Math.round((h * 3) / 2);
if (w > meta.width) {
  w = meta.width;
  h = Math.round((w * 2) / 3);
}
const margin = Math.round(meta.height * 0.04);
if (box.width + 2 * margin > w) {
  w = box.width + 2 * margin;
  h = Math.round((w * 2) / 3);
}
const cx = box.left + box.width / 2;
const cy = box.top + box.height / 2;
const place = (size, span, c) =>
  Math.round(size <= span ? Math.max(0, Math.min(span - size, c - size / 2)) : c - size / 2);
const region = {
  left: place(w, meta.width, cx),
  top: place(h, meta.height, cy),
  width: w,
  height: h,
};
const pad = {
  left: Math.max(0, -region.left),
  top: Math.max(0, -region.top),
  right: Math.max(0, region.left + w - meta.width),
  bottom: Math.max(0, region.top + h - meta.height),
};

// A transparent original (some arrive as RGBA PNGs) sits on the white sweep.
// (Two passes: within one pipeline sharp extracts before it extends.)
const padded = await sharp(src)
  .flatten({ background: "#ffffff" })
  .extend({ ...pad, background: "#ffffff" })
  .png()
  .toBuffer();
const master = await sharp(padded)
  .extract({ ...region, left: region.left + pad.left, top: region.top + pad.top })
  .resize({ width: Math.min(2160, region.width), kernel: "lanczos3" })
  .jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true })
  .toBuffer();
writeFileSync(join(root, "assets/menu", `${id}.jpg`), master);
console.log(`assets/menu/${id}.jpg — ${master.length} bytes`);
if (region.width < 1280) {
  console.warn(
    `Only ${region.width}px wide: the site will draw it soft on phones and Retina screens. Ask for a bigger original.`,
  );
}
// The 720px WebP is the file the cutter looks for (and the URL search engines
// know), so write it first; the cutter then re-cuts it and every other size.
const full = await sharp(master).resize(720, 480).webp({ quality: 90 }).toBuffer();
writeFileSync(join(root, "public/menu", `${id}.webp`), full);
execFileSync(process.execPath, [join(root, "scripts/build-menu-cards.mjs")], { stdio: "inherit" });

// Framing for the item sheet's 16:10 hero (see photoFocus.ts): the zoom is
// capped at 132% and at whatever still shows the whole food, and the focus
// centres the food vertically.
const f = await foodBox(full);
const fx0 = f.left / 720;
const fx1 = (f.left + f.width) / 720;
const fy0 = f.top / 480;
const fy1 = (f.top + f.height) / 480;
const zoomX = 1 / (2 * Math.max(0.5 - fx0, fx1 - 0.5));
const zoomY = 0.9375 / (fy1 - fy0);
const zoom = Math.max(1, Math.min(1.32, zoomX, zoomY));
const visible = 0.9375 / zoom;
const focus =
  visible >= 1 ? 50 : Math.max(0, Math.min(1, ((fy0 + fy1) / 2 - visible / 2) / (1 - visible)));
console.log(
  `photoFocus.ts: "${id}": [${Math.round(visible >= 1 ? 50 : focus * 100)}, ${Math.round(zoom * 100)}],`,
);
