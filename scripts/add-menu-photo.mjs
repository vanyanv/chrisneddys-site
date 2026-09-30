#!/usr/bin/env node
/**
 * Adds a new menu photograph from a full-size original (issue #208).
 *
 *     node scripts/add-menu-photo.mjs <original.png|jpg> <photo-id>
 *
 * Writes the two files every other menu photo has, in the same frame as the
 * Otter shots (3:2, centred on the food):
 *
 *   public/menu/<photo-id>.webp        720x480, the item sheet and item page
 *   public/menu/<photo-id>-thumb.webp  200x133, list rows and small cards
 *
 * and prints the `[focus, zoom]` framing to add to `src/data/photoFocus.ts`.
 * Then point the item's `photo` (or `wayPhotos`) in `src/data/menu.ts` at the
 * id and run `node scripts/build-menu-cards.mjs` for its menu card.
 *
 * The original stays out of the repo: 720px is the largest size the site
 * draws a menu photo at.
 */
import sharp from "sharp";
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

// 3:2 at full height, slid sideways to centre the food.
let h = meta.height;
let w = Math.round((h * 3) / 2);
if (w > meta.width) {
  w = meta.width;
  h = Math.round((w * 2) / 3);
}
const cx = box.left + box.width / 2;
const cy = box.top + box.height / 2;
const region = {
  left: Math.round(Math.max(0, Math.min(meta.width - w, cx - w / 2))),
  top: Math.round(Math.max(0, Math.min(meta.height - h, cy - h / 2))),
  width: w,
  height: h,
};

const full = await sharp(src)
  .extract(region)
  .resize(720, 480)
  .webp({ quality: 80, effort: 6 })
  .toBuffer();
writeFileSync(join(root, "public/menu", `${id}.webp`), full);
const thumb = await sharp(full).resize(200, 133).webp({ quality: 80, effort: 6 }).toBuffer();
writeFileSync(join(root, "public/menu", `${id}-thumb.webp`), thumb);
console.log(`public/menu/${id}.webp — ${full.length} bytes`);
console.log(`public/menu/${id}-thumb.webp — ${thumb.length} bytes`);

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
