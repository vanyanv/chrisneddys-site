#!/usr/bin/env node
/**
 * Responsive AVIF/WebP cuts of the owner's photos of the Hollywood location
 * and Slider's murals, for the location pages and /careers.
 *
 * Same approach as `build-photo-cuts.mjs`: plain `sharp`, sources kept in
 * `assets/photos/` (downsized from the owner's uploads to 1800px on the long
 * side), output written straight into `public/photos/art/`. Each photo has a
 * fixed crop so every cut of it shares one aspect ratio, which is what lets
 * the `<img>` carry width/height and never shift the layout.
 *
 * Run with:
 *
 *     pnpm images:art
 *
 * Re-run after replacing a source in `assets/photos/`.
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "assets", "photos");
const OUT = join(root, "public", "photos", "art");

// Murals are all hard edges and flat colour, which AVIF holds well at a far
// lower quality than the food photos' 50 before any banding shows. The
// /careers cut goes lower still so its phone LCP image stays under the 34 KB
// food photo it replaced (the CI byte budget in `perf-budget.json`).
const AVIF_QUALITY = 34;
const WEBP = { quality: 74 };

/**
 * `ratio` is width / height of the crop; `focusX`/`focusY` (0-1) place the
 * crop inside the source when it has to trim one side.
 */
const PHOTOS = [
  // The Hollywood dining room: the logo on the floor, the menu board, the walls.
  { name: "hollywood-room", ratio: 4 / 3, focusX: 0.42, focusY: 0.5, widths: [480, 720, 960] },
  // The long wall of monsters and bullseyes over the tables (/careers).
  {
    name: "hollywood-wall",
    ratio: 16 / 9,
    focusX: 0.5,
    focusY: 0.5,
    widths: [480, 720, 900],
    quality: 26,
  },
  // Portrait crops for the mural strip on the Hollywood page.
  { name: "mural-vortex", ratio: 3 / 4, focusX: 0.5, focusY: 0.35, widths: [360, 540] },
  { name: "mural-monsters", ratio: 3 / 4, focusX: 0.5, focusY: 0.4, widths: [360, 540] },
  { name: "mural-hallway", ratio: 3 / 4, focusX: 0.47, focusY: 0.5, widths: [360, 540] },
];

async function region(file, ratio, focusX, focusY) {
  const { width, height } = await sharp(file).metadata();
  let w = width;
  let h = Math.round(width / ratio);
  if (h > height) {
    h = height;
    w = Math.round(height * ratio);
  }
  const left = Math.round(Math.min(Math.max(0, width * focusX - w / 2), width - w));
  const top = Math.round(Math.min(Math.max(0, height * focusY - h / 2), height - h));
  return { left, top, width: w, height: h };
}

mkdirSync(OUT, { recursive: true });

for (const p of PHOTOS) {
  const file = join(SRC, `${p.name}.jpg`);
  const crop = await region(file, p.ratio, p.focusX, p.focusY);
  for (const w of p.widths) {
    const base = () => sharp(file).extract(crop).resize({ width: w });
    const avif = await base()
      .avif({ quality: p.quality ?? AVIF_QUALITY, effort: 6 })
      .toBuffer();
    writeFileSync(join(OUT, `${p.name}-${w}.avif`), avif);
    const webp = await base().webp(WEBP).toBuffer();
    writeFileSync(join(OUT, `${p.name}-${w}.webp`), webp);
    console.log(`${p.name}-${w}: avif ${avif.length} B, webp ${webp.length} B`);
  }
  // The `<img src>` fallback: the middle cut as a JPEG.
  const mid = p.widths[Math.floor((p.widths.length - 1) / 2)];
  const jpg = await sharp(file)
    .extract(crop)
    .resize({ width: mid })
    .jpeg({ quality: 78 })
    .toBuffer();
  writeFileSync(join(OUT, `${p.name}.jpg`), jpg);
  console.log(`${p.name}.jpg (${mid}w): ${jpg.length} B`);
}
