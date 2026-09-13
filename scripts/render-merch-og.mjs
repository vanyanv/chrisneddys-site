/**
 * Renders scripts/merch-og-card.html to public/shop/<slug>.png, once per
 * product in the merch catalogue.
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
 * Run `pnpm build` first. Headless Chrome here can't reach Google Fonts, so
 * the card's Bowlby One / JetBrains Mono would otherwise fall back to a
 * generic sans — `pnpm build` (next/font) has already fetched both as
 * `.next/static/media/*.woff2`, and this script inlines them as data URIs
 * from there. Without a `.next` from a prior build, it prints a warning and
 * renders in the fallback fonts instead of failing outright.
 *
 *   pnpm build && node scripts/render-merch-og.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir, tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "scripts", "merch-og-card.html");
const outDir = join(root, "public", "shop");

const MIME = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

// Node strips TypeScript types at load time (no ts-node/tsx dependency
// needed) — this is the catalogue itself, so a slug can never drift from
// what the shop actually sells.
const { merch } = await import(pathToFileURL(join(root, "src", "data", "merch.ts")));

/**
 * Inline every `src="../public/..."` as a data URI and render that copy.
 *
 * Headless Chrome will not fetch a file:// subresource from a file:// page: the
 * request never resolves, `--virtual-time-budget` waits on it, and the render
 * hangs rather than failing. Inlining sidesteps the question, and a product
 * photo stays a single file on disk — the card reads the same one /shop
 * (or the menu row) does. The Foam Trucker's card has no photo to inline yet,
 * so this is a no-op for it today.
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

/**
 * The card's `<style>` block of local, base64-inlined `@font-face` rules for
 * Bowlby One and JetBrains Mono — read from a prior `pnpm build`'s output —
 * or null if `.next/static/css` isn't there to read.
 *
 * Only the Latin subset (the `-s.p.woff2` files next/font emits) is pulled
 * in: this card is English-only, and embedding all dozen-plus unicode-range
 * slices next/font generates per family would bloat the staged HTML for
 * ranges nothing on the card uses.
 */
function localFontFacesCss() {
  const cssDir = join(root, ".next", "static", "css");
  if (!existsSync(cssDir)) return null;

  const mediaDir = join(root, ".next", "static", "media");
  const families = new Set(["Bowlby One", "JetBrains Mono"]);
  const rules = [];

  for (const file of readdirSync(cssDir).filter((f) => f.endsWith(".css"))) {
    const css = readFileSync(join(cssDir, file), "utf8");
    for (const rule of css.match(/@font-face\{[^}]*\}/g) ?? []) {
      const family = rule.match(/font-family:([^;]+);/)?.[1];
      if (!family || !families.has(family)) continue;

      const urlMatch = rule.match(/url\(\/_next\/static\/media\/([^)]+\.p\.woff2)\)/);
      if (!urlMatch) continue; // not the Latin subset — skip it

      const fontFile = join(mediaDir, urlMatch[1]);
      if (!existsSync(fontFile)) continue;

      const dataUri = `data:font/woff2;base64,${readFileSync(fontFile).toString("base64")}`;
      rules.push(rule.replace(urlMatch[0], `url(${dataUri})`));
    }
  }

  return rules.length ? `<style>${rules.join("")}</style>` : null;
}

/**
 * Give the card its real brand fonts instead of a network fetch to Google
 * Fonts. The local `<style>` is injected right after the Google Fonts
 * `<link>` — same family names, so whichever is declared last wins, and a
 * local, already-decoded data URI always beats a stylesheet fetch that has
 * nowhere to go in a sandboxed renderer.
 */
function withLocalFonts(html) {
  const localCss = localFontFacesCss();
  if (!localCss) {
    console.warn(
      "No .next/static/css found — rendering with fallback fonts. Run `pnpm build` first for the real Bowlby One / JetBrains Mono.",
    );
    return html;
  }
  return html.replace(/(<link[^>]*fonts\.googleapis\.com[^>]*>)/, `$1\n    ${localCss}`);
}

/** Newest `chromium-*` build's binary under `root`, or null if there isn't one. */
function findChromiumIn(root) {
  if (!existsSync(root)) return null;
  const builds = readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const build of builds) {
    // The folder holding the binary is named for the platform build, not
    // consistently across installs — "chrome-linux64" from a `npx playwright
    // install`, plain "chrome-linux" from at least one pre-installed cache
    // seen in the wild. Try both rather than assuming one.
    for (const folder of ["chrome-linux64", "chrome-linux"]) {
      const bin = join(root, build, folder, "chrome");
      if (existsSync(bin)) return bin;
    }
  }
  return null;
}

/**
 * Newest Playwright chromium this machine has. `PLAYWRIGHT_BROWSERS_PATH`
 * wins when set — it's how a preinstalled, shared browser cache (outside the
 * usual per-user `~/.cache`) tells Playwright-based tooling where to look.
 */
function findChromium() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    const fromEnv = findChromiumIn(process.env.PLAYWRIGHT_BROWSERS_PATH);
    if (fromEnv) return fromEnv;
  }
  return findChromiumIn(join(homedir(), ".cache", "ms-playwright"));
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

const html = withLocalFonts(inlineLocalImages(readFileSync(source, "utf8")));

for (const product of merch) {
  const staged = join(tmpdir(), `cne-og-card-${product.slug}.html`);
  // The template is a single generic card today — one product in the
  // catalogue — so every product renders from the same markup. A second
  // product with its own layout would need its own source file and a lookup
  // from slug to source here.
  writeFileSync(staged, html);

  const outFile = join(outDir, `${product.slug}.png`);

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
      `--user-data-dir=${join(tmpdir(), `cne-og-render-${product.slug}`)}`,
      `--screenshot=${outFile}`,
      `file://${staged}`,
    ],
    { stdio: "inherit" },
  );

  console.log(`Wrote ${outFile}`);
}
