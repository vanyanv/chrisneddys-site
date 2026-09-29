#!/usr/bin/env node
/**
 * Real-browser performance measurement (issue #89).
 *
 * Drives the site through actual Chromium with CDP throttling applied for
 * real — `Network.emulateNetworkConditions` and
 * `Emulation.setCPUThrottlingRate` — not Lighthouse's simulated ("Lantern")
 * throttling, which this site's own `docs/perf-baseline.md` found to
 * overstate LCP by roughly 2x. See that file for the full story.
 *
 * LCP is read from a `PerformanceObserver` snapshotted BEFORE any scripted
 * scrolling. A scripted `scrollTo` does not end LCP the way a real user
 * input does, so reading the metric after a scroll test reports whatever
 * image happened to be painting at that moment instead of the page's actual
 * largest contentful paint — on this site that produced fake 9-12s LCPs.
 * Always read LCP first, then run any scroll/frame-timing work after.
 *
 * Usage:
 *   node scripts/perf.mjs --base http://localhost:3000
 *   node scripts/perf.mjs --base http://localhost:3000 --pages /,/menu/
 *   node scripts/perf.mjs --base http://localhost:3000 --profiles iphone
 *   node scripts/perf.mjs --base http://localhost:3000 --out after.json
 *   node scripts/perf.mjs --base http://localhost:3000 --compare before.json
 *
 * With --compare, nothing is measured against the network — instead this
 * loads --out (or a fresh run if --out is also given) is not required; a
 * plain --compare run still measures the live --base and diffs the result
 * against the given baseline file, printing a before/after/delta table and
 * exiting non-zero if any page+profile regressed LCP by more than
 * max(100ms, 10%) or CLS by more than 0.02.
 */
import { chromium } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

function parseArgs(argv) {
  const args = {
    base: "http://localhost:3000",
    pages: [
      "/",
      "/menu/",
      "/locations/",
      "/shop/",
      "/shop/foam-trucker-blue/",
      "/about/",
      "/careers/",
      "/contact/",
    ],
    profiles: ["iphone", "iphone-landscape", "desktop", "baseline-mobile"],
    runs: 3,
    out: null,
    compare: null,
    frames: false,
    skipIntro: true,
  };
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
      case "--profiles":
        args.profiles = next()
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        break;
      case "--runs":
        args.runs = Number(next());
        break;
      case "--out":
        args.out = next();
        break;
      case "--compare":
        args.compare = next();
        break;
      case "--frames":
        args.frames = true;
        break;
      case "--skip-intro":
        args.skipIntro = true;
        break;
      case "--with-intro":
        args.skipIntro = false;
        break;
      default:
        console.error(`Unknown argument: ${a}`);
        process.exit(2);
    }
  }
  return args;
}

// Profiles. Network figures match docs/perf-baseline.md's simulated Slow 4G
// (150ms RTT / 1638 kbps down / 750 kbps up), CPU 4x slowdown.
const PROFILES = {
  "baseline-mobile": {
    width: 412,
    height: 823,
    dpr: 1.75,
    mobile: true,
    throttle: true,
    cpu: 4,
  },
  iphone: {
    width: 402,
    height: 874,
    dpr: 3,
    mobile: true,
    throttle: true,
    cpu: 4,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1",
  },
  "iphone-landscape": {
    width: 874,
    height: 402,
    dpr: 3,
    mobile: true,
    throttle: true,
    cpu: 4,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1",
  },
  desktop: {
    width: 1440,
    height: 900,
    dpr: 1,
    mobile: false,
    throttle: false,
    cpu: 1,
  },
};

/** Set by `addInitScript`, before any app JS runs. Snapshots LCP, CLS, long
 * tasks and FCP as they happen so we can read them before a scroll test. */
const INIT_SCRIPT = `
  window.__perf = { lcp: 0, lcpEl: "", cls: 0, longTasks: [], fcp: 0 };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      window.__perf.lcp = e.startTime;
      const el = e.element;
      window.__perf.lcpEl = el
        ? el.tagName + (el.currentSrc ? " " + el.currentSrc.split("/").pop() : el.className ? "." + String(el.className).split(" ")[0] : "")
        : e.url ?? "";
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value;
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__perf.longTasks.push([e.startTime, e.duration]);
  }).observe({ type: "longtask", buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.name === "first-contentful-paint") window.__perf.fcp = e.startTime;
  }).observe({ type: "paint", buffered: true });
`;

// The home page's desktop intro (src/lib/intro.ts) is skipped when this
// localStorage key is set. Left unset, desktop LCP on `/` measures the intro
// overlay instead of the page underneath it.
const INTRO_STORAGE_KEY = "cne-welcome-intro-off";

function resolveChromium() {
  const fromEnv = process.env.PERF_CHROMIUM;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const known = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  if (existsSync(known)) return known;
  return undefined; // let Playwright pick its own default install
}

async function measureFrames(page) {
  return page.evaluate(async () => {
    const measure = (durationMs, onTick) =>
      new Promise((resolve) => {
        const frames = [];
        let last = performance.now();
        const start = last;
        let longTaskMs = 0;
        const po = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) longTaskMs += e.duration;
        });
        po.observe({ type: "longtask" });
        const tick = (t) => {
          frames.push(t - last);
          last = t;
          if (onTick) onTick(t - start);
          if (t - start < durationMs) {
            requestAnimationFrame(tick);
          } else {
            po.disconnect();
            const sorted = frames.slice(1).sort((a, b) => a - b);
            const at = (q) => sorted[Math.floor(sorted.length * q)];
            resolve({
              frames: sorted.length,
              p50: +(at(0.5) ?? 0).toFixed(1),
              p95: +(at(0.95) ?? 0).toFixed(1),
              over50: sorted.filter((f) => f > 50).length,
              longTaskMs: Math.round(longTaskMs),
            });
          }
        };
        requestAnimationFrame(tick);
      });
    const idle = await measure(3000);
    const scrollHeight = document.documentElement.scrollHeight - innerHeight;
    const scroll = await measure(4000, (elapsed) =>
      window.scrollTo(0, Math.min(1, elapsed / 4000) * scrollHeight),
    );
    return { idle, scroll };
  });
}

async function measureOnce(browser, path, profileName, profile, args) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.dpr,
    isMobile: profile.mobile,
    hasTouch: profile.mobile,
    userAgent: profile.userAgent,
  });
  if (args.skipIntro) {
    await context.addInitScript((key) => {
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        // Private browsing etc. — the intro will show; not worth failing over.
      }
    }, INTRO_STORAGE_KEY);
  }
  await context.addInitScript(INIT_SCRIPT);
  const page = await context.newPage();

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (profile.throttle) {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1638 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });

  const bytesByType = {};
  const typeByRequest = new Map();
  cdp.on("Network.responseReceived", (e) => typeByRequest.set(e.requestId, e.type));
  cdp.on("Network.loadingFinished", (e) => {
    const type = typeByRequest.get(e.requestId) ?? "Other";
    bytesByType[type] = (bytesByType[type] ?? 0) + e.encodedDataLength;
  });

  const start = Date.now();
  await page.goto(args.base + path, { waitUntil: "load", timeout: 120_000 });
  const loadMs = Date.now() - start;
  // Let late resources (fonts, prefetches) settle before reading navigation
  // timing and byte totals.
  await page.waitForTimeout(2000);

  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0];
    return {
      loadEventEnd: n ? n.loadEventEnd : 0,
      transferSize: n ? n.transferSize : 0,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  // Snapshot BEFORE any scroll — see module comment.
  const snap = await page.evaluate(() => ({
    ...window.__perf,
    longTasks: [...window.__perf.longTasks],
  }));
  const tbt = snap.longTasks
    .filter(([taskStart]) => taskStart > snap.fcp)
    .reduce((sum, [, duration]) => sum + Math.max(0, duration - 50), 0);

  const frames = args.frames ? await measureFrames(page) : null;

  await context.close();

  return {
    fcp: Math.round(snap.fcp),
    lcp: Math.round(snap.lcp),
    lcpEl: snap.lcpEl,
    cls: +snap.cls.toFixed(3),
    tbt: Math.round(tbt),
    load: Math.round(nav.loadEventEnd),
    loadMs,
    overflowX: nav.overflowX,
    bytes: Object.fromEntries(
      Object.entries(bytesByType).map(([type, n]) => [type, Math.round(n / 1024)]),
    ),
    frames,
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function measurePageProfile(browser, path, profileName, profile, args) {
  const runs = [];
  for (let i = 0; i < args.runs; i++) {
    runs.push(await measureOnce(browser, path, profileName, profile, args));
  }
  // Pick the run whose LCP is the median as the representative sample (it
  // carries the byte counts, LCP element, etc.), but report medians for the
  // headline timing metrics individually.
  const byLcp = [...runs].sort((a, b) => a.lcp - b.lcp);
  const representative = byLcp[Math.floor(runs.length / 2)];
  return {
    ...representative,
    lcp: median(runs.map((r) => r.lcp)),
    fcp: median(runs.map((r) => r.fcp)),
    tbt: median(runs.map((r) => r.tbt)),
    load: median(runs.map((r) => r.load)),
    lcpRuns: runs.map((r) => r.lcp),
  };
}

function fmtMs(ms) {
  return `${ms}ms`;
}

function printTable(results) {
  for (const [profileName, byPage] of Object.entries(results)) {
    console.log(`\n=== ${profileName} ===`);
    const rows = Object.entries(byPage).map(([path, r]) => ({
      page: path,
      fcp: fmtMs(r.fcp),
      lcp: fmtMs(r.lcp),
      lcpEl: r.lcpEl,
      cls: r.cls,
      tbt: fmtMs(r.tbt),
      load: fmtMs(r.load),
      overflowX: r.overflowX ? "YES" : "",
      bytesKB: Object.entries(r.bytes)
        .map(([type, kb]) => `${type}:${kb}`)
        .join(" "),
    }));
    console.table(rows);
  }
}

function pct(delta, base) {
  if (base === 0) return delta === 0 ? "0%" : "n/a";
  return `${((delta / base) * 100).toFixed(1)}%`;
}

function compareResults(before, after) {
  let regressed = false;
  console.log("\n=== Comparison (before -> after) ===");
  for (const [profileName, byPage] of Object.entries(after)) {
    const beforeByPage = before[profileName];
    if (!beforeByPage) continue;
    for (const [path, a] of Object.entries(byPage)) {
      const b = beforeByPage[path];
      if (!b) continue;
      const lcpDelta = a.lcp - b.lcp;
      const clsDelta = +(a.cls - b.cls).toFixed(3);
      const lcpThreshold = Math.max(100, b.lcp * 0.1);
      const lcpBad = lcpDelta > lcpThreshold;
      const clsBad = clsDelta > 0.02;
      if (lcpBad || clsBad) regressed = true;
      console.log(
        `${profileName} ${path}: LCP ${b.lcp}ms -> ${a.lcp}ms (${lcpDelta >= 0 ? "+" : ""}${lcpDelta}ms, ${pct(lcpDelta, b.lcp)})${lcpBad ? "  ** REGRESSION **" : ""}` +
          `  |  CLS ${b.cls} -> ${a.cls} (${clsDelta >= 0 ? "+" : ""}${clsDelta})${clsBad ? "  ** REGRESSION **" : ""}`,
      );
    }
  }
  return regressed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const executablePath = resolveChromium();
  const browser = await chromium.launch({
    executablePath,
    args: ["--no-sandbox"],
  });

  const results = {};
  try {
    for (const profileName of args.profiles) {
      const profile = PROFILES[profileName];
      if (!profile) {
        console.error(
          `Unknown profile "${profileName}". Known profiles: ${Object.keys(PROFILES).join(", ")}`,
        );
        process.exit(2);
      }
      results[profileName] = {};
      for (const path of args.pages) {
        const r = await measurePageProfile(browser, path, profileName, profile, args);
        results[profileName][path] = r;
        console.log(
          `${profileName} ${path}: FCP ${r.fcp}ms LCP ${r.lcp}ms (${r.lcpEl}) CLS ${r.cls} TBT ${r.tbt}ms load ${r.load}ms`,
        );
      }
    }
  } finally {
    await browser.close();
  }

  printTable(results);

  if (args.out) {
    writeFileSync(args.out, JSON.stringify(results, null, 2));
    console.log(`\nWrote ${args.out}`);
  }

  if (args.compare) {
    const before = JSON.parse(readFileSync(args.compare, "utf8"));
    const regressed = compareResults(before, results);
    if (regressed) {
      console.error("\nPerformance regression detected — see ** REGRESSION ** lines above.");
      process.exit(1);
    }
    console.log("\nNo regression beyond thresholds (LCP: max(100ms, 10%), CLS: 0.02).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
