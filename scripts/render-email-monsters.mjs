#!/usr/bin/env node
/**
 * Renders the monster PNGs the form emails show (`src/lib/siteFormEmail.ts`)
 * into `public/email/`. Email clients don't draw inline SVG, so the monster
 * has to be a hosted PNG; this draws the artist's monster (`monsterSvg` in
 * `src/components/mascots/monsterArt.ts`) in each of the four monster colours
 * and screenshots it on a transparent background. Re-run after the monster
 * art changes:
 *
 *   node scripts/render-email-monsters.mjs
 */
import { chromium } from "@playwright/test";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { monsterSvg } from "../src/components/mascots/monsterArt.ts";
import { MONSTER_COLORS } from "../src/components/mascots/monsterColors.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SIZE = 192;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
for (const [name, { body, iris }] of Object.entries(MONSTER_COLORS)) {
  const art = monsterSvg(body, iris);
  await page.setContent(
    `<body style="margin:0;background:transparent">${art.replace("<svg ", `<svg width="${SIZE}" height="${SIZE}" `)}</body>`,
  );
  await page.screenshot({
    path: join(ROOT, `public/email/monster-${name}.png`),
    omitBackground: true,
  });
}
await browser.close();
console.log(`Wrote ${Object.keys(MONSTER_COLORS).length} monsters to public/email/`);
