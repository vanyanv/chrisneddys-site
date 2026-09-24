#!/usr/bin/env node
/**
 * Renders the monster PNGs the form emails show (`src/lib/siteFormEmail.ts`)
 * into `public/email/`. Email clients don't draw inline SVG, so the monster
 * has to be a hosted PNG; this takes the same art as the browser-tab icon
 * (`MONSTER_ICON_SVG` in `src/lib/monsterIcon.ts`), swaps the body and iris
 * colours for each of the store's four monster colours, and screenshots it on
 * a transparent background. Re-run after the monster art changes:
 *
 *   node scripts/render-email-monsters.mjs
 */
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(ROOT, "src/lib/monsterIcon.ts"), "utf8");
const svg = source.match(/MONSTER_ICON_SVG = `([\s\S]*?)`;/)?.[1];
if (!svg) throw new Error("MONSTER_ICON_SVG not found in src/lib/monsterIcon.ts");

const BLUE = "#2e5fd9";
const RED = "#e63027";
/** Body and iris per colour — the same pairs the map pins and vortex use. */
const COLOURS = {
  blue: [BLUE, RED],
  red: [RED, BLUE],
  yellow: ["#f5d20e", RED],
  lime: ["#c6ff2b", RED],
};

const SIZE = 192;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
for (const [name, [body, iris]] of Object.entries(COLOURS)) {
  const art = svg
    .replace(
      `fill="${BLUE}" stroke="#14110d" stroke-width="9"`,
      `fill="${body}" stroke="#14110d" stroke-width="9"`,
    )
    .replace(`r="17" fill="${RED}"`, `r="17" fill="${iris}"`);
  await page.setContent(
    `<body style="margin:0;background:transparent">${art.replace("<svg ", `<svg width="${SIZE}" height="${SIZE}" `)}</body>`,
  );
  await page.screenshot({
    path: join(ROOT, `public/email/monster-${name}.png`),
    omitBackground: true,
  });
}
await browser.close();
console.log(`Wrote ${Object.keys(COLOURS).length} monsters to public/email/`);
