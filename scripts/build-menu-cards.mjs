#!/usr/bin/env node
/**
 * Cuts every size the site serves of each menu photograph (issues #206, #208,
 * #237), from one master per photo:
 *
 *   assets/menu/<photo>.jpg     the master: the owner's full-resolution shot,
 *                               in the menu's 3:2 frame, kept out of `public/`
 *                               so it is never served. Written by
 *                               `scripts/add-menu-photo.mjs`.
 *
 * A photo with no master yet (the Otter shots still waiting on studio
 * replacements) falls back to its 720px `public/menu/<photo>.webp`, which is
 * all the detail it has: nothing is cut larger than its source, so those stay
 * at 720px until a bigger original exists.
 *
 * From the master it writes, in AVIF and WebP:
 *
 *   public/menu/<photo>-thumb     200px   list rows, small cards
 *   public/menu/<photo>-360       360px
 *   public/menu/<photo>           720px   the URL search engines know
 *   public/menu/<photo>-1080     1080px
 *   public/menu/<photo>-1280     1280px   the item sheet on a 3x phone
 *
 * and the menu card, a 4:3 frame cut tight around the food so it fills the
 * card (the white sweep trimmed, the food centred with a margin added back), at 400, 560 (the
 * original `-card` URL) and 900px:
 *
 *   public/menu/<photo>-card-400, <photo>-card, <photo>-card-900
 *
 * plus the 480/720/900px ladders of the two big menu cards, Chris N Eddy's
 * Slider leading Sliders (`public/photos/slider-<way>-4x3-<w>`, issue #230)
 * and 2 Sliders and Fries opening the menu
 * (`public/photos/combo-2-<way>-16x10-<w>`, issue #227), both Ways, from the
 * `.jpg` beside them (cuts of the owner's studio shots, their near-white
 * backdrop lifted to pure white so AVIF doesn't draw it as faint blocks).
 *
 * Every file is encoded at the lowest quality that still measures as the
 * master at that size (see `scripts/lib/photo-quality.mjs`), so a plain shot
 * of a cup comes out small and a busy tray of loaded fries keeps its detail.
 * Which sizes exist for each photo goes to `src/data/menuPhotoCuts.json`, which
 * is what the `srcset`s are built from, so a page never asks for a size that
 * was not cut.
 *
 * A photo whose master has not changed since the last run is skipped
 * (`assets/menu/hashes.json` records each master's hash). Run after adding or
 * replacing one:
 *
 *     node scripts/build-menu-cards.mjs           # changed photos only
 *     node scripts/build-menu-cards.mjs --force   # everything
 */
import sharp from "sharp";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeToTarget } from "./lib/photo-quality.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MENU = join(root, "public/menu");
const MASTERS = join(root, "assets/menu");
const MANIFEST = join(root, "src/data/menuPhotoCuts.json");
/** Each master's hash at the last run, kept out of the manifest the pages
 * import so it never reaches the browser. */
const HASHES = join(MASTERS, "hashes.json");
const force = process.argv.includes("--force");

/**
 * How close each file has to measure to the master: luma SSIM and the worse
 * of the two chroma SSIMs. Picked by eye on the busiest photos (the Eddy's
 * Way combos' grilled onions, the loaded fries) at 2x zoom: below this the
 * onions smear and the cheese's edge goes soft.
 */
const TARGET = { luma: 0.982, chroma: 0.94 };

/** The 3:2 ladder: [width, file suffix]. 720 keeps the URL already indexed. */
const FULL = [
  [200, "-thumb"],
  [360, "-360"],
  [720, ""],
  [1080, "-1080"],
  [1280, "-1280"],
];
/** The 4:3 card ladder. 560 keeps the original `-card` URL. */
const CARD = [
  [400, "-card-400"],
  [560, "-card"],
  [900, "-card-900"],
];

/** The card frame: 4:3, the food plus 18% of its width on each side and
 * 30% of its height above and below, whichever is the bigger frame. */
const RATIO = 4 / 3;
const PAD = 1.36;
const PAD_Y = 1.6;

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

/** The previous run's manifest and hashes, so unchanged photos can be skipped. */
function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

/** The card's 4:3 region of the master, in master pixels. */
async function cardRegion(id, src, meta) {
  if (CENTRED.has(id)) {
    const w = Math.round(meta.height * RATIO);
    return { left: Math.round((meta.width - w) / 2), top: 0, width: w, height: meta.height };
  }
  // `trim` reports the box it kept as negative offsets into the original. The
  // threshold is in pixel values, so it reads the same on any size of master,
  // and it is high enough to drop the soft grey shadow the studio shots throw
  // to the left: the card centres the food itself, not food and shadow.
  const { info } = await sharp(src).trim({ threshold: 70 }).toBuffer({ resolveWithObject: true });
  const l = -(info.trimOffsetLeft ?? 0);
  const t = -(info.trimOffsetTop ?? 0);
  const cx = l + info.width / 2;
  const cy = t + info.height / 2;

  // Every card shows the whole of the food, centred, with the same margin
  // round it (more above and below, so a tall slider doesn't crowd the frame).
  // Where that frame runs past the photo's edge it is padded out with the
  // white sweep rather than cutting the food off (issue #230).
  const width = Math.round(Math.max(info.width * PAD, info.height * PAD_Y * RATIO));
  const height = Math.round(width / RATIO);
  const left = Math.round(cx - width / 2);
  const top = Math.round(cy - height / 2);
  const pad = {
    left: Math.max(0, -left),
    top: Math.max(0, -top),
    right: Math.max(0, left + width - meta.width),
    bottom: Math.max(0, top + height - meta.height),
  };
  const padded = Object.values(pad).some(Boolean);
  return { left: left + pad.left, top: top + pad.top, width, height, ...(padded && { pad }) };
}

/** The sweep's near-whites (every channel from 232 up) eased to pure white;
 * the food, all well below that, is untouched. */
const LIFT_FROM = 232;
const LIFT_TO = 246;
async function liftWhite(pipeline) {
  const { data, info } = await pipeline.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 3) {
    const m = Math.min(data[i], data[i + 1], data[i + 2]);
    if (m < LIFT_FROM) continue;
    const t = Math.min(1, (m - LIFT_FROM) / (LIFT_TO - LIFT_FROM));
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] + (255 - data[i + c]) * t);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
    .png()
    .toBuffer();
}

/** Encode one size in both formats; returns the bytes written. */
async function writeCut(pipeline, width, height, outBase) {
  const ref = await pipeline
    .resize(width, height, { kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const sizes = {};
  for (const format of ["avif", "webp"]) {
    const r = await encodeToTarget(ref, width, height, format, TARGET);
    writeFileSync(`${outBase}.${format}`, r.buf);
    sizes[format] = `${(r.buf.length / 1024).toFixed(1)}K q${r.quality}`;
  }
  return sizes;
}

async function cutPhoto(id, masterPath, isLegacy) {
  const src = readFileSync(masterPath);
  const meta = await sharp(src).metadata();
  const full = [];
  for (const [w, suffix] of FULL) {
    if (w > meta.width) continue;
    // A legacy photo's 720 *is* its master: re-encoding it would only lose
    // detail, so it stays byte for byte, and only its AVIF copy is made.
    if (isLegacy && w === meta.width) {
      const ref = await sharp(src).removeAlpha().raw().toBuffer();
      const r = await encodeToTarget(ref, meta.width, meta.height, "avif", TARGET);
      writeFileSync(join(MENU, `${id}.avif`), r.buf);
      console.log(`  ${id}${suffix} ${w}w avif ${(r.buf.length / 1024).toFixed(1)}K (webp kept)`);
      full.push(w);
      continue;
    }
    const h = Math.round((w * meta.height) / meta.width);
    const s = await writeCut(sharp(src), w, h, join(MENU, `${id}${suffix}`));
    console.log(`  ${id}${suffix} ${w}w`, s);
    full.push(w);
  }

  const { pad, ...region } = await cardRegion(id, src, meta);
  // A frame that runs past the photo's edge is padded out with white first,
  // and the near-white sweep is lifted to pure white so the pad doesn't show
  // as a faint box (AVIF draws a 253-against-255 edge as visible blocks).
  const cardSrc = CENTRED.has(id)
    ? await sharp(src).extract(region).png().toBuffer()
    : await liftWhite(
        sharp(
          pad
            ? await sharp(src)
                .extend({ ...pad, background: "#ffffff" })
                .png()
                .toBuffer()
            : src,
        ).extract(region),
      );
  const card = [];
  for (const [w, suffix] of CARD) {
    // Never upscale. A small master still gets its `-card`, at the size of
    // its own crop, since every menu card asks for that URL.
    const width = suffix === "-card" ? Math.min(w, region.width) : w;
    if (width > region.width) continue;
    const h = Math.round(width / RATIO);
    const s = await writeCut(sharp(cardSrc), width, h, join(MENU, `${id}${suffix}`));
    console.log(`  ${id}${suffix} ${width}w`, s);
    card.push(width);
  }
  return { full, card };
}

/** The 480/720/900 ladders of the two big menu cards. */
async function leadCuts(prevHashes, hashes) {
  for (const name of [
    "slider-chris-4x3",
    "slider-eddy-4x3",
    "combo-2-chris-16x10",
    "combo-2-eddy-16x10",
  ]) {
    const srcPath = join(root, `public/photos/${name}.jpg`);
    const src = readFileSync(srcPath);
    const hash = createHash("sha1").update(src).digest("hex").slice(0, 12);
    hashes[`photos/${name}`] = hash;
    if (!force && prevHashes[`photos/${name}`] === hash) continue;
    const meta = await sharp(src).metadata();
    for (const w of [480, 720, 900]) {
      const h = Math.round((w * meta.height) / meta.width);
      const s = await writeCut(sharp(src), w, h, join(root, `public/photos/${name}-${w}`));
      console.log(`  ${name}-${w}`, s);
    }
  }
}

async function main() {
  const prev = readJson(MANIFEST);
  const prevHashes = readJson(HASHES);
  const next = {};
  const hashes = {};
  const ids = readdirSync(MENU)
    .filter((f) => f.endsWith(".webp") && !/-(thumb|card|card-\d+|360|1080|1280)\.webp$/.test(f))
    .map((f) => f.slice(0, -".webp".length))
    .sort();
  // Three photos at a time: the encoder is single-threaded per file.
  const queue = [...ids];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      const master = join(MASTERS, `${id}.jpg`);
      const isLegacy = !existsSync(master);
      const masterPath = isLegacy ? join(MENU, `${id}.webp`) : master;
      const hash = createHash("sha1").update(readFileSync(masterPath)).digest("hex").slice(0, 12);
      if (!force && prevHashes[id] === hash && prev[id]) {
        hashes[id] = hash;
        next[id] = prev[id];
        continue;
      }
      console.log(`${id}${isLegacy ? " (no master: 720px only)" : ""}`);
      next[id] = await cutPhoto(id, masterPath, isLegacy);
      hashes[id] = hash;
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  await leadCuts(prevHashes, hashes);

  const sorted = (o) =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFEST, `${JSON.stringify(sorted(next), null, 2)}\n`);
  writeFileSync(HASHES, `${JSON.stringify(sorted(hashes), null, 2)}\n`);
  console.log(`Wrote ${MANIFEST}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
