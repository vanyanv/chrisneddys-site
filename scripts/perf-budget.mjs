#!/usr/bin/env node
/**
 * Deterministic per-page byte budget (issue #89).
 *
 * Unlike `scripts/perf.mjs`, this applies no network or CPU throttling, so a
 * run's numbers depend only on what the page actually ships — not on
 * simulated-network jitter — which is what lets it gate CI without flaking.
 *
 * For each page (default: the same list `perf.mjs` uses) it loads the page
 * against a running server in two profiles — `iphone` (402x874 @3x, iPhone
 * Chrome UA; median of 3 runs, since even unthrottled real requests can
 * shuffle a few KB of prefetch timing) and `desktop` (1440x900 @1x; a single
 * run) — waits for network idle so Next's idle-time route prefetching gets a
 * chance to fire and finish, then sums encoded (transferred) bytes per
 * resource type from real CDP `Network` events: document, font, image,
 * script, stylesheet, fetch. It also records the bytes of whichever single
 * request produced the page's LCP image, when the LCP element is an `<img>`.
 *
 * Each (page, profile, type) total is checked against `scripts/perf-budget.json`
 * and the run exits non-zero, naming every breach, if any total exceeds its
 * budget.
 *
 * Usage:
 *   node scripts/perf-budget.mjs --base http://localhost:3000
 *   node scripts/perf-budget.mjs --base http://localhost:3000 --pages /,/menu/
 *   node scripts/perf-budget.mjs --base http://localhost:3000 --out measured.json
 */
import { chromium } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUDGET_FILE = join(ROOT, "scripts", "perf-budget.json");

const DEFAULT_PAGES = [
  "/",
  "/menu/",
  "/locations/",
  "/shop/",
  "/shop/foam-trucker-blue/",
  "/about/",
  "/careers/",
  "/contact/",
];

const PROFILES = {
  iphone: {
    width: 402,
    height: 874,
    dpr: 3,
    mobile: true,
    runs: 3,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1",
  },
  desktop: {
    width: 1440,
    height: 900,
    dpr: 1,
    mobile: false,
    runs: 1,
  },
};

// CDP resource types (Network.ResourceType) that this budget tracks, and the
// budget-file key each maps to. Anything else (Media, Manifest, WebSocket,
// Other, …) is reported but never enforced.
const TYPE_MAP = {
  Document: "document",
  Font: "font",
  Image: "image",
  Script: "script",
  Stylesheet: "stylesheet",
  Fetch: "fetch",
  XHR: "fetch",
};

const INTRO_STORAGE_KEY = "cne-welcome-intro-off";

const LCP_INIT_SCRIPT = `
  window.__lcp = { url: "", tag: "" };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      const el = e.element;
      window.__lcp.tag = el ? el.tagName : "";
      window.__lcp.url = el && el.currentSrc ? el.currentSrc : (e.url ?? "");
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });
`;

function parseArgs(argv) {
  const args = { base: "http://localhost:3000", pages: DEFAULT_PAGES, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--base":
        args.base = next();
        break;
      case "--pages":
        args.pages = next()
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        break;
      case "--out":
        args.out = next();
        break;
      default:
        console.error(`Unknown argument: ${a}`);
        process.exit(2);
    }
  }
  return args;
}

function resolveChromium() {
  const fromEnv = process.env.PERF_CHROMIUM;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const known = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  if (existsSync(known)) return known;
  return undefined; // Playwright's own default install (e.g. in CI).
}

async function measurePage(browser, base, path, profile) {
  const samples = [];
  for (let i = 0; i < profile.runs; i++) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.dpr,
      isMobile: profile.mobile,
      hasTouch: profile.mobile,
      userAgent: profile.userAgent,
    });
    await context.addInitScript((key) => {
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        // ignore
      }
    }, INTRO_STORAGE_KEY);
    await context.addInitScript(LCP_INIT_SCRIPT);
    const page = await context.newPage();

    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

    const bytesByType = {};
    const bytesByUrl = new Map();
    const requestMeta = new Map();
    let lastResponseSeen = Date.now();
    cdp.on("Network.responseReceived", (e) => {
      requestMeta.set(e.requestId, { type: e.type, url: e.response.url });
    });
    cdp.on("Network.loadingFinished", (e) => {
      lastResponseSeen = Date.now();
      const meta = requestMeta.get(e.requestId);
      if (!meta) return;
      const type = TYPE_MAP[meta.type] ?? "other";
      bytesByType[type] = (bytesByType[type] ?? 0) + e.encodedDataLength;
      bytesByUrl.set(meta.url, (bytesByUrl.get(meta.url) ?? 0) + e.encodedDataLength);
    });

    await page.goto(base + path, { waitUntil: "load", timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline && Date.now() - lastResponseSeen < 1500) {
      await page.waitForTimeout(250);
    }

    const lcp = await page.evaluate(() => window.__lcp);
    const lcpImageBytes = lcp.tag === "IMG" && lcp.url ? (bytesByUrl.get(lcp.url) ?? 0) : 0;

    await context.close();
    samples.push({ bytesByType, lcp, lcpImageBytes });
  }

  const types = new Set(samples.flatMap((s) => Object.keys(s.bytesByType)));
  const medianType = {};
  for (const type of types) {
    const values = samples.map((s) => s.bytesByType[type] ?? 0).sort((a, b) => a - b);
    medianType[type] = values[Math.floor(values.length / 2)];
  }
  const lcpValues = samples.map((s) => s.lcpImageBytes).sort((a, b) => a - b);
  return {
    bytesByType: medianType,
    lcpImageBytes: lcpValues[Math.floor(lcpValues.length / 2)],
    lcpEl: samples[0].lcp,
    samples: samples.map((s) => s.bytesByType),
  };
}

function toKB(bytes) {
  return +(bytes / 1024).toFixed(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const budgets = existsSync(BUDGET_FILE) ? JSON.parse(readFileSync(BUDGET_FILE, "utf8")) : {};

  const executablePath = resolveChromium();
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });

  const measured = {};
  const breaches = [];
  try {
    for (const path of args.pages) {
      measured[path] = {};
      for (const [profileName, profile] of Object.entries(PROFILES)) {
        const result = await measurePage(browser, args.base, path, profile);
        const kb = Object.fromEntries(
          Object.entries(result.bytesByType).map(([type, b]) => [type, toKB(b)]),
        );
        kb.lcpImage = toKB(result.lcpImageBytes);
        measured[path][profileName] = kb;
        console.log(
          `${path} [${profileName}] ${Object.entries(kb)
            .map(([type, v]) => `${type}:${v}KB`)
            .join(" ")} lcpEl=${result.lcpEl.tag || "-"}`,
        );

        const pageBudget = budgets[path]?.[profileName];
        if (!pageBudget) continue;
        for (const [type, limitKB] of Object.entries(pageBudget)) {
          const actualKB = kb[type] ?? 0;
          if (actualKB > limitKB) {
            breaches.push({ path, profileName, type, actualKB, limitKB });
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (args.out) {
    writeFileSync(args.out, JSON.stringify(measured, null, 2));
    console.log(`\nWrote ${args.out}`);
  }

  if (breaches.length > 0) {
    console.error("\nPerformance budget exceeded:");
    for (const b of breaches) {
      console.error(
        `  ${b.path} [${b.profileName}] ${b.type}: ${b.actualKB}KB > budget ${b.limitKB}KB`,
      );
    }
    process.exit(1);
  }

  console.log("\nAll pages within budget.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
