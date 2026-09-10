/**
 * Renders scripts/merch-og-card.html to public/shop/ball-cap.png.
 *
 * The product's social card has to be a real file with a real extension: a
 * static export writes an `opengraph-image.tsx` route to an extensionless file,
 * which is served as application/octet-stream and is therefore useless both as
 * a link preview and as the `Product.image` Google needs before it will draw a
 * merchant listing. `/og.jpg` is a real file for the same reason.
 *
 * Chromium comes from the Playwright cache rather than a dependency, because
 * this runs by hand when the card changes — not on every build.
 *
 *   node scripts/render-merch-og.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "scripts", "merch-og-card.html");
const outDir = join(root, "public", "shop");
const outFile = join(outDir, "ball-cap.png");

/** Newest Playwright chromium in the local cache. */
function findChromium() {
  const cache = join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(cache)) return null;
  const builds = readdirSync(cache)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const build of builds) {
    const bin = join(cache, build, "chrome-linux64", "chrome");
    if (existsSync(bin)) return bin;
  }
  return null;
}

const chrome = findChromium();
if (!chrome) {
  console.error(
    "No Playwright chromium found in ~/.cache/ms-playwright.\n" +
      "Install one with:  npx playwright install chromium",
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

execFileSync(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1200,630",
    // The card pulls Bowlby One and JetBrains Mono from Google Fonts; without
    // the wait the screenshot lands on the fallback stack.
    "--virtual-time-budget=6000",
    `--user-data-dir=${join(tmpdir(), "cne-og-render")}`,
    `--screenshot=${outFile}`,
    `file://${source}`,
  ],
  { stdio: "inherit" },
);

console.log(`Wrote ${outFile}`);
