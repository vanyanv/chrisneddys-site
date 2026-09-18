#!/usr/bin/env node
/**
 * Converts raw Foam Trucker photography into the three web cuts /shop expects:
 * a 720px-wide `.webp` (quality ~82), a 400px-wide `-mid.webp` and a 200px-wide
 * `-thumb.webp`, for every `.png`/`.jpg`/`.jpeg` in the input directory.
 *
 * The middle cut exists because the gallery's thumbnail strip draws tiles about
 * 50-175px wide. On a 2x or 3x screen — which is nearly every phone and most
 * laptops — that needs 240-500 source pixels, so with only 200 and 720 to pick
 * from the browser took the 720 for all eight tiles and downloaded the whole
 * gallery at full size. Measured on the Foam Trucker page: 136 KB of images at
 * 1x against 688 KB at 2x. A 400px cut lands in that gap, so every tile is
 * served a file at least as large as it draws and no larger.
 *
 * Source files are expected at `assets/shop/foam-trucker-blue/` — see the
 * README there for the eight expected gallery photos plus the certificate and
 * sticker scans, and their exact filenames.
 *
 *   pnpm images:shop
 *   # equivalent to:
 *   node scripts/build-shop-images.mjs \
 *     --in assets/shop/foam-trucker-blue \
 *     --out public/shop/foam-trucker-blue
 *
 * Tooling: this project already carries `sharp` as a devDependency (it's the
 * only one this script needs), so there's no `cwebp`/ImageMagick shell-out
 * path here — if `sharp` is ever removed, this script needs one added back.
 */
import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

/**
 * Source filename (no extension, case-insensitive) → the view id it becomes.
 * These are the exact filenames the source photography arrived under. A file
 * that isn't in this table still gets converted — see `outputName` below —
 * just under its own basename rather than a gallery view's id, so a stray or
 * renamed file doesn't silently disappear from the output directory.
 */
const NAME_MAP = {
  cne_web_images_retail_hat_blue_sticker_front_1: "front",
  cne_web_images_retail_hat_blue_front_1a: "front-plain",
  cne_web_images_retail_hat_blue_side_sticker_1large: "angle",
  cne_web_images_retail_hat_blue_side_1: "angle-plain",
  cne_web_images_retail_hat_blue_closeup_1b: "cyclops",
  cne_web_images_retail_hat_blue_closeup_1a: "stitch",
  cne_web_images_retail_hat_blue_back_1a: "snap",
  cne_web_images_retail_hat_blue_back_1: "back",
  cne_web_images_retail_hat_coa_blank_1: "certificate",
  cne_web_images_retail_hat_sticker_solo_1: "sticker",
};

/**
 * Optional per-output-name crop, applied (via `sharp().extract()`) before the
 * resize — keyed the same way as `NAME_MAP`, by the *output* name, since that's
 * the stable identity a crop belongs to regardless of which source file a
 * future reshoot arrives under.
 *
 * `certificate` is the only one today: the scan is a portrait certificate
 * inside a 2400x2400 white field, and publishing that whole white square would
 * put most of the card's own margin around it a second time. The box below is
 * the card's outer edge (including its drop shadow) found by thresholding the
 * scan for non-white pixels, plus a ~25px even margin — verified by eye
 * against a render of the crop, not just the numbers. Coordinates are source
 * pixels, `{ left, top, width, height }` as `sharp().extract()` expects.
 */
const CROP = {
  certificate: { left: 515, top: 139, width: 1366, height: 2118 },
};

const WIDTHS = { full: 720, mid: 400, thumb: 200 };
const QUALITY = 82;

function flag(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function outputName(file) {
  const stem = basename(file, extname(file)).toLowerCase();
  return NAME_MAP[stem] ?? basename(file, extname(file));
}

async function main() {
  const inDir = flag("in");
  const outDir = flag("out");
  if (!inDir || !outDir) {
    console.error("Usage: node scripts/build-shop-images.mjs --in <dir> --out <dir>");
    process.exit(1);
  }

  const resolvedIn = resolve(inDir);
  const resolvedOut = resolve(outDir);

  if (!existsSync(resolvedIn)) {
    console.error(`No such input directory: ${resolvedIn}`);
    process.exit(1);
  }

  const files = readdirSync(resolvedIn).filter((f) => /\.(png|jpe?g)$/i.test(f));
  if (files.length === 0) {
    console.error(`No .png/.jpg/.jpeg files found in ${resolvedIn}`);
    process.exit(1);
  }

  mkdirSync(resolvedOut, { recursive: true });

  for (const file of files) {
    const name = outputName(file);
    const src = join(resolvedIn, file);
    const crop = CROP[name];

    const cuts = [
      [`${name}.webp`, WIDTHS.full],
      [`${name}-mid.webp`, WIDTHS.mid],
      [`${name}-thumb.webp`, WIDTHS.thumb],
    ];

    for (const [outName, width] of cuts) {
      // A fresh `sharp(src)` per resize: `.extract()`/`.resize()` mutate the
      // pipeline, and the same instance can't be reused for two different
      // output sizes.
      const pipeline = crop ? sharp(src).extract(crop) : sharp(src);
      await pipeline
        .resize({ width })
        .webp({ quality: QUALITY })
        .toFile(join(resolvedOut, outName));
    }

    console.log(`${file} -> ${cuts.map(([n]) => n).join(", ")}${crop ? " (cropped)" : ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
