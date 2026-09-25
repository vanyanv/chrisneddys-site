/**
 * Writes `src/app/icon.svg` from the monster art (`MONSTER_ICON_SVG` in
 * `src/lib/monsterIcon.ts`), then builds `src/app/favicon.ico` (16, 32 and
 * 48px) from it.
 *
 * Browsers that take SVG favicons use `icon.svg` directly. The .ico covers
 * the rest, plus the default `/favicon.ico` request and the manifest's entry
 * for it. Run after any change to the monster art, and commit both files.
 */
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { MONSTER_ICON_SVG } from "../src/lib/monsterIcon.ts";

const SRC = new URL("../src/app/icon.svg", import.meta.url);
const OUT = new URL("../src/app/favicon.ico", import.meta.url);
const SIZES = [16, 32, 48];

const COMMENT = `<!--
  Browser-tab icon: the artist's blue monster, written from MONSTER_ICON_SVG
  (src/lib/monsterIcon.ts) by scripts/build-favicon.mjs. Don't edit by hand.
-->
`;
const svg = Buffer.from(MONSTER_ICON_SVG);
await writeFile(SRC, MONSTER_ICON_SVG.replace(/^(<svg[^>]*>)/, `$1${COMMENT}`) + "\n");
const pngs = await Promise.all(
  SIZES.map((size) => sharp(svg, { density: 600 }).resize(size, size).png().toBuffer()),
);

// ICO container with PNG-encoded images: a 6-byte header, one 16-byte
// directory entry per image, then the PNG data back to back.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);

let offset = 6 + 16 * pngs.length;
const entries = pngs.map((png, i) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(SIZES[i] % 256, 0);
  entry.writeUInt8(SIZES[i] % 256, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  return entry;
});

await writeFile(OUT, Buffer.concat([header, ...entries, ...pngs]));
console.log(`wrote ${OUT.pathname} (${SIZES.join(", ")}px)`);
