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
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "scripts", "merch-og-card.html");
const outDir = join(root, "public", "shop");
const outFile = join(outDir, "ball-cap.png");

const MIME = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

/**
 * Inline every `src="../public/..."` as a data URI and render that copy.
 *
 * Headless Chrome will not fetch a file:// subresource from a file:// page: the
 * request never resolves, `--virtual-time-budget` waits on it, and the render
 * hangs rather than failing. Inlining sidesteps the question, and the
 * photograph stays a single file on disk — the card reads the same one /shop
 * and the menu row do.
 */
function inlineLocalImages(html) {
  return html.replace(/src="\.\.\/public\/([^"]+)"/g, (_, rel) => {
    const file = join(root, "public", rel);
    if (!existsSync(file)) {
      console.error(`The card references a file that is not there: public/${rel}`);
      process.exit(1);
    }
    const mime = MIME[rel.split(".").pop().toLowerCase()];
    if (!mime) {
      console.error(`No media type known for public/${rel}`);
      process.exit(1);
    }
    return `src="data:${mime};base64,${readFileSync(file).toString("base64")}"`;
  });
}

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

const staged = join(tmpdir(), "cne-og-card.html");
writeFileSync(staged, inlineLocalImages(readFileSync(source, "utf8")));

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
    `file://${staged}`,
  ],
  { stdio: "inherit" },
);

console.log(`Wrote ${outFile}`);
