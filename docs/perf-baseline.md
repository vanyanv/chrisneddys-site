# Store speed baseline — 18 September 2026

Reference numbers for `chrisneddys-site` before any performance work. Later
changes should be measured the same way and compared against this file.

Commit measured: `320e4fc` (merge of PR #52), clean tree, no app code changed.

## How these were measured

- `pnpm build` then `pnpm start` (production Next.js server) on `localhost:3100`.
- Lighthouse **12.8.2**, performance category only, driving headless
  **Chromium 141.0.7390.37** (the Playwright `chromium-1194` build at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).
- Four pages: `/`, `/menu/`, `/locations/`, `/shop/foam-trucker-blue/`.
- Two profiles per page: Lighthouse **mobile** default and the **desktop**
  preset. The mobile profile simulates 150 ms RTT at 1638 kbps with a 4x CPU
  slowdown, on a 412 x 823 viewport at a 1.75x device pixel ratio.
- Three runs per page per profile, 24 runs total. The figures below are the
  **median** of the three.
- Host CPU benchmark index at the time of the run: 2547. A materially
  different index on a later run means the CPU-bound numbers are not directly
  comparable.
- **Cross-checked in a real browser.** Every page was also driven through
  Playwright against the same Chromium with the throttling actually applied
  over CDP (`Network.emulateNetworkConditions` at 150 ms / 1638 kbps,
  `Emulation.setCPUThrottlingRate` at 4), recording `largest-contentful-paint`
  entries from a `PerformanceObserver`. Three runs per page.

Two caveats, both load-bearing:

1. This is a local server with no CDN and no real network in front of it, so
   treat the absolute numbers as a yardstick for comparison rather than as what
   a shopper in Los Angeles sees. The simulated profile is why every page shows
   the same ~457 ms time to first byte though the server answered in 10–30 ms.
2. Lighthouse's mobile profile **simulates** rather than applies its throttling,
   and on this site it overstates LCP by roughly 2x. The real-browser numbers
   are the ones to reason about. See "LCP: what Lighthouse modelled, and what a
   real browser does" below — this distinction already produced one wrong
   conclusion, recorded there.

## Page scores and metrics

### Mobile (simulated Slow 4G)

| Page                       | Score | FCP     | LCP         | Speed Index | TBT    | CLS   | Total transferred |
| -------------------------- | ----- | ------- | ----------- | ----------- | ------ | ----- | ----------------- |
| `/`                        | 92    | 1180 ms | **3388 ms** | 1180 ms     | 46 ms  | 0     | 656 KB            |
| `/menu/`                   | 90    | 1267 ms | **3385 ms** | 1267 ms     | 159 ms | 0     | 571 KB            |
| `/locations/`              | 90    | 1221 ms | **3347 ms** | 1221 ms     | 144 ms | 0.024 | 601 KB            |
| `/shop/foam-trucker-blue/` | 89    | 1276 ms | **3469 ms** | 1276 ms     | 173 ms | 0     | **1218 KB**       |

### Desktop

| Page                       | Score | FCP    | LCP    | Speed Index | TBT  | CLS   | Total transferred |
| -------------------------- | ----- | ------ | ------ | ----------- | ---- | ----- | ----------------- |
| `/`                        | 100   | 322 ms | 731 ms | 448 ms      | 0 ms | 0.002 | 637 KB            |
| `/menu/`                   | 100   | 347 ms | 721 ms | 376 ms      | 0 ms | 0.002 | 596 KB            |
| `/locations/`              | 99    | 331 ms | 750 ms | 354 ms      | 0 ms | 0.051 | 630 KB            |
| `/shop/foam-trucker-blue/` | 100   | 348 ms | 765 ms | 353 ms      | 0 ms | 0.002 | 779 KB            |

Desktop is healthy everywhere. All of the headroom is on mobile.

## LCP: what Lighthouse modelled, and what a real browser does

**Read this section before acting on the LCP numbers above.** Lighthouse's
mobile profile does not actually throttle the page; it records an unthrottled
trace and then _models_ what a slow connection would have done (Lantern
simulation). On this site that model is roughly 2x pessimistic about LCP, and
it attributes the difference to a phase that does not exist in a real browser.

Lighthouse's phase split says the overwhelming majority of LCP is **render
delay** — the resource is in the browser and nothing is drawing it:

| Page                       | LCP element                 | TTFB   | Load delay | Load time | Render delay  |
| -------------------------- | --------------------------- | ------ | ---------- | --------- | ------------- |
| `/`                        | `<img>` hero-still-760.webp | 459 ms | 106 ms     | 279 ms    | 2562 ms (75%) |
| `/menu/`                   | `<span class="d">` (text)   | 457 ms | 0 ms       | 0 ms      | 2928 ms (86%) |
| `/locations/`              | `<img>` map-base.svg        | 457 ms | 362 ms     | 387 ms    | 2137 ms (64%) |
| `/shop/foam-trucker-blue/` | `<h1>` (text)               | 458 ms | 0 ms       | 0 ms      | 3011 ms (87%) |

Driving the same build through headless Chromium with the **same conditions
applied for real** — 150 ms RTT, 1638 kbps and a 4x CPU slowdown set over CDP,
on the same 412 x 823 viewport at 1.75x — gives a different and much better
picture. Median of three runs, and the three runs agreed to within 12 ms:

| Page                       | FCP    | LCP         | `load` event | LCP element               |
| -------------------------- | ------ | ----------- | ------------ | ------------------------- |
| `/`                        | 564 ms | **1704 ms** | 2596 ms      | `hero-still-760.webp`     |
| `/menu/`                   | 540 ms | **540 ms**  | 2276 ms      | `<span class="d">` (text) |
| `/locations/`              | 476 ms | **1256 ms** | 2205 ms      | `map-base.svg`            |
| `/shop/foam-trucker-blue/` | 532 ms | **1780 ms** | **5298 ms**  | `shop/.../front.webp`     |

There is no long render-delay phase. Every page fires a single LCP entry, with
no late candidate replacing an earlier one. Where LCP is later than FCP it is
because an **image** is still arriving: `/menu/`, the one page with no
above-the-fold image, reports LCP at 540 ms, identical to its FCP.

So treat the simulated LCP column as a pessimistic index that is useful for
comparing one run against another, and the table immediately above as what a
shopper on a slow connection actually waits for. The one number that tells the
real story is `/shop/foam-trucker-blue/`'s `load` event at 5.3 s against
2.2–2.6 s everywhere else.

### The scroll-reveal is not the problem — it is already handled

An earlier draft of this document named the scroll-reveal animation as the
biggest cost, on the strength of that render-delay column. That was wrong, and
it is recorded here so nobody re-opens it.

`.js .cne-rv { opacity: 0 }` (`src/styles/counter.css:1415`) does hide the
revealed sections, and `RevealRoot` (`src/components/counter/Reveal.tsx`) only
adds `is-in` after hydration. But `src/app/(site)/layout.tsx` already ships an
inline `REVEAL_ABOVE_FOLD` script directly after `<main>`, added in `3f18ace`,
which reveals everything in the initial viewport while the HTML is still
parsing. Measured: on `/menu/` both above-the-fold `.cne-rv` sections are at
`opacity: 1` and LCP fires at 540 ms. On `/`, `/locations/` and
`/shop/foam-trucker-blue/` there are no `.cne-rv` elements above the fold at
all, so the reveal cannot gate their LCP under any circumstances.

## Bundle sizes

Next.js build output, First Load JS:

- Shared by every route: **102 KB**
  - `chunks/414fb65c-….js` — 54.2 KB (169.0 KB raw / 52.8 KB gzipped on disk)
  - `chunks/8353-….js` — 45.9 KB (169.6 KB raw / 45.1 KB gzipped on disk)
  - other shared chunks — 1.99 KB
- Middleware: **34.9 KB**
- Storefront routes, First Load JS: `/` 116 KB, `/menu/` 114 KB,
  `/locations/` 111 KB, `/shop/[product]/` 112 KB.
- Heaviest routes overall are on the admin side: `/admin/products` 124 KB,
  `/admin/settings` 120 KB. Not shopper-facing.
- `.next/static` on disk: 2.0 MB. `framework-….js` (185 KB),
  `main-….js` (126 KB) and `polyfills-….js` (110 KB) are present on disk but
  are **not** requested by any App Router page — don't count them as shipped.
- Compiled CSS on disk: 196.6 KB across 8 files, largest 81.6 KB.

## Largest assets

`public/` totals **3.5 MB**. The biggest individual files:

| File                                         | Size     |
| -------------------------------------------- | -------- |
| `public/shop/foam-trucker-blue.png`          | 200.6 KB |
| `public/hero-still.webp`                     | 168.8 KB |
| `public/photos/fries.jpg`                    | 152.2 KB |
| `public/photos/double.jpg`                   | 120.4 KB |
| `public/og.jpg`                              | 117.5 KB |
| `public/shop/foam-trucker-blue/back.webp`    | 117.0 KB |
| `public/shop/foam-trucker-blue/cyclops.webp` | 111.7 KB |
| `public/photos/double-1x1.jpg`               | 110.7 KB |
| `public/photos/fries.webp`                   | 102.1 KB |
| `public/map-base.svg`                        | 93.0 KB  |

Bytes actually transferred, mobile, by resource type:

| Page                       | Images     | Script | Fetch (route prefetch) | Fonts  | Document |
| -------------------------- | ---------- | ------ | ---------------------- | ------ | -------- |
| `/`                        | 160 KB     | 164 KB | 143 KB                 | 102 KB | 59 KB    |
| `/menu/`                   | 73 KB      | 164 KB | 144 KB                 | 102 KB | 60 KB    |
| `/locations/`              | 44 KB      | 170 KB | 203 KB                 | 102 KB | 54 KB    |
| `/shop/foam-trucker-blue/` | **688 KB** | 169 KB | 174 KB                 | 102 KB | 57 KB    |

## The three worst offenders

Ranked on the real-browser measurements above, not on the simulated scores.

### 1. The shop product page ships 688 KB of images, mostly at the wrong size

`/shop/foam-trucker-blue/` transfers 1218 KB on mobile — roughly double every
other page — and 688 KB of that is images. It is the only page whose `load`
event lands at 5.3 s instead of 2.2–2.6 s, and the gap is almost exactly the
image weight. Nine gallery images download at full 720 px width even though
eight of them render as 120 px thumbnails.

The cause is a gap in the `srcSet`: each gallery image offers only a 200 w thumb
and the 720 w original. At the mobile profile's 1.75x device pixel ratio a
120 px thumbnail needs about 210 px, the 200 w file is just short of that, so
the browser falls back to the 720 w original every time. Real phones commonly
run at 2x or 3x, where the gap is wider still. Lighthouse puts the saving at
595 KB. Next.js image optimisation is off (`images: { unoptimized: true }` in
`next.config.mjs`), so nothing fills that gap automatically.

A single intermediate width in each `srcSet` would take most of those 595 KB
off the page, and it is the one change on this list with a clearly measurable
payoff.

### 2. Images are what LCP waits for on every page that has one

`/` reports LCP at 1704 ms and `/locations/` at 1256 ms, and in both cases the
LCP element is an image still in flight — `hero-still-760.webp` (57 KB
transferred) and `map-base.svg` (31 KB transferred, 93 KB on disk). `/menu/`,
which has no above-the-fold image, reports 540 ms. The delta between those is
the whole of the available LCP win on the storefront.

`map-base.svg` is the softer target of the two: 93 KB of SVG on disk for a
decorative locator map, served uncompressed by byte count and decoded on the
main thread.

### 3. Every page ships ~116 KB of inline CSS and ~145–205 KB of route prefetch that nothing asked for

Two separate costs. Neither shows up in LCP; both show up in bytes and in the
`load` event, and both scale with every page a visitor opens.

`experimental.inlineCss: true` in `next.config.mjs` inlines the stylesheet into
the HTML document. All four pages carry an identical 116,085 bytes of inline
`<style>`, which is why each HTML document is 279–320 KB raw (54–60 KB
compressed). Because it lives in the document it is re-sent on every page view
and can never be cached, and Lighthouse reckons about 12 KB of it is unused on
any given page. The trade is deliberate — inlining removes a render-blocking
request — but it is being paid on every navigation rather than once.

Separately, Next.js `<Link>` prefetch pulls the React payload for five or six
other routes as soon as the page settles — 28–31 KB each, 143–203 KB per page —
plus their route chunks. On `/locations/` that prefetch traffic (203 KB) is
larger than the page's own scripts, images and document combined.

## Smaller items worth noting

- **Trailing-slash redirect, ~610 ms on mobile.** `trailingSlash: true` means
  `/menu` redirects to `/menu/`. Internal links already carry the slash, so this
  only costs anyone arriving from an external link or typing the URL — but for
  them it is a full extra round trip before anything starts.
- **Three Google font families, 102 KB per page.** Bowlby One, Inter (five
  weights) and JetBrains Mono, all loaded at high priority on every page. All
  three use `display: "optional"`, so on a slow connection the fonts lose the
  race and the site renders in fallback faces anyway — the bytes are spent
  without the branding arriving.
- **`legacy-javascript`, ~11 KB.** Unnecessary transpilation in
  `chunks/8353-….js`.
- **Image cache lifetime is 7 days** (`Cache-Control: max-age=604800` in
  `next.config.mjs`). Lighthouse flags it on every page; the shop page has
  9 resources affected.
- **`cne-logo.webp` is oversized**, ~8 KB wasted on every page.
- **CLS on `/locations/`** is 0.024 mobile / 0.051 desktop — the only page with
  meaningful layout shift, and the only one where desktop is worse than mobile.

## Reproducing this

```shell
pnpm install && pnpm build
PORT=3100 pnpm start

# Pinned deliberately: an unpinned `npx lighthouse` will drift to a newer
# version whose scoring curve is not comparable with the numbers above.
npx --yes lighthouse@12.8.2 http://localhost:3100/menu/ \
  --only-categories=performance --output=json --output-path=out.json \
  --chrome-flags="--headless=new --no-sandbox"
```

Lighthouse finds Chromium through `CHROME_PATH`; point it at the same binary
named above, or at any Chromium of a comparable major version, and say which
one you used when you record new numbers. Lighthouse is deliberately not a
`devDependency` — it is a measurement tool run by hand, not part of
`pnpm install`, `pnpm test` or the build, and pinning it at the call site
keeps it out of everyone's install.

Add `--preset=desktop` for the desktop profile. Take the median of three runs.

For the real-browser figures, drive the same build with Playwright instead,
applying the throttling over CDP rather than letting Lighthouse model it:

```js
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 150,
  downloadThroughput: (1638.4 * 1024) / 8,
  uploadThroughput: (675 * 1024) / 8,
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
```

with the context at `viewport: { width: 412, height: 823 }`,
`deviceScaleFactor: 1.75`, `isMobile: true`, and an init script registering a
`PerformanceObserver` on `largest-contentful-paint`. The repo's own
`@playwright/test` expects a newer Chromium than the one pinned above, so pass
`executablePath` explicitly rather than running `playwright install`.

## Checking a change

The manual recipe above is how these baseline numbers were produced; day to
day, use the two scripts this doc's numbers fed (issue #89) instead —
`pnpm perf` for "did this make the page feel slower or shift more?" and
`pnpm perf:budget` for "did this ship more bytes than the page is allowed to?".

### `pnpm perf --compare` — is it actually slower?

`pnpm perf` (`scripts/perf.mjs`) is this doc's real-browser method, packaged:
real CDP throttling, LCP read from a `PerformanceObserver`, median of several
runs. To check a change:

```shell
# On main, before your change:
pnpm build && PORT=3100 pnpm start &
pnpm perf --base http://localhost:3100 --out /tmp/before.json

# On your branch, after your change (same server, rebuilt):
pnpm build && pnpm perf --base http://localhost:3100 --compare /tmp/before.json
```

It prints a before/after/delta line per page and profile and **exits
non-zero** if any page's LCP got worse by more than `max(100ms, 10%)` or its
CLS got worse by more than `0.02` — small jitter passes, a real regression
fails the comparison the same way it would fail CI.

Useful flags: `--pages /,/menu/` to check just the pages you touched,
`--profiles iphone` to skip the others, `--runs 1` for a quick check while
iterating (use the default 3 before trusting a result), and `--frames` to
also report idle/scroll frame timing (p95 frame time, long-task count) for
animation-heavy changes.

**The LCP-before-scroll gotcha:** LCP stops being measured the moment the
_user_ does something — a click, a keypress, a real scroll. A script calling
`scrollTo()` does **not** count as that, so if you read `largest-contentful-
paint` entries _after_ a scroll test, whatever image happens to be painting
at that moment gets misreported as LCP — this produced fake 9-12 second LCPs
during this tooling's own development. `scripts/perf.mjs` snapshots LCP
before it ever touches the scroll/frame-timing measurement; if you write your
own probe, read LCP first and treat that as load-bearing.

The home page's first-visit desktop intro (`src/lib/intro.ts`) is skipped by
default (`--skip-intro`, on unless you pass `--with-intro`), by setting its
`localStorage` gate before the page loads — otherwise desktop LCP on `/`
would measure the intro overlay's own paint, not the page underneath it.

### `pnpm perf:budget` — did this ship more bytes than it's allowed to?

`pnpm perf:budget` (`scripts/perf-budget.mjs`) is deliberately **not** the
throttled, multi-run method above — it applies no network or CPU throttling
at all, so its byte counts depend only on what the page actually requests,
not on simulated-network jitter, which is what lets it run in CI without
flaking. It sums transferred bytes per resource type (document, font, image,
script, stylesheet, fetch) from real CDP `Network` events, once in the
`iphone` profile (402x874 @3x, median of 3 runs) and once at `desktop`, plus
the byte size of whichever single request produced the page's LCP image, and
checks each total against `scripts/perf-budget.json`. Exits non-zero and
names every page, resource type, actual size and budget that a change
breached:

```shell
pnpm build && PORT=3100 pnpm start &
pnpm perf:budget --base http://localhost:3100
```

Most budgets in `scripts/perf-budget.json` are the numbers measured on
`main` plus about 10% headroom — room for normal variation, not room to add
a new image. Two are set lower, as **targets a fix is expected to hit**
rather than headroom over what already ships: total font weight per page
(`font`, budgeted at 115 KB, once the graffiti font is trimmed) and the home
page's LCP image at the `iphone` profile's 3x device pixel ratio (`lcpImage`,
budgeted at 80 KB, once the hero moves to AVIF). Until those fixes land,
`pnpm perf:budget` is expected to fail on exactly those two lines — that is
the check doing its job, not a false positive; if it starts failing on a
_different_ page or resource type, that is a real regression.

CI runs `pnpm perf:budget` against a production `pnpm start` after every
build (see `.github/workflows/ci.yml`), using Playwright's own installed
Chromium there instead of the `/opt/pw-browsers` build used for local
development (both scripts fall back automatically — see `resolveChromium()`
in either script, or set `PERF_CHROMIUM` to force a specific binary).
