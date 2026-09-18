# Store speed baseline — 18 September 2026

Reference numbers for `chrisneddys-site` before any performance work. Later
changes should be measured the same way and compared against this file.

Commit measured: `320e4fc` (merge of PR #52), clean tree, no app code changed.

## How these were measured

- `pnpm build` then `pnpm start` (production Next.js server) on `localhost:3100`.
- Lighthouse 12, performance category only, headless Chromium 1194.
- Four pages: `/`, `/menu/`, `/locations/`, `/shop/foam-trucker-blue/`.
- Two profiles per page: Lighthouse **mobile** default (simulated Slow 4G,
  Moto G Power class CPU throttling) and the **desktop** preset.
- Three runs per page per profile, 24 runs total. The figures below are the
  **median** of the three.

Caveat worth keeping in mind: this is a local server with no CDN and no real
network in front of it, so treat the absolute numbers as a yardstick for
comparison rather than as what a shopper in Los Angeles sees. The mobile
profile's throttling is simulated, which is why every page shows the same
~457 ms time to first byte even though the server itself answered in 10–30 ms.

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

## LCP breakdown (mobile, per page)

Lighthouse splits LCP into four phases. On every page the overwhelming
majority sits in **render delay** — the resource is already in the browser and
nothing is drawing it.

| Page                       | LCP element                 | TTFB   | Load delay | Load time | **Render delay**  |
| -------------------------- | --------------------------- | ------ | ---------- | --------- | ----------------- |
| `/`                        | `<img>` hero-still-760.webp | 459 ms | 106 ms     | 279 ms    | **2562 ms (75%)** |
| `/menu/`                   | `<span class="d">` (text)   | 457 ms | 0 ms       | 0 ms      | **2928 ms (86%)** |
| `/locations/`              | `<img>` map-base.svg        | 457 ms | 362 ms     | 387 ms    | **2137 ms (64%)** |
| `/shop/foam-trucker-blue/` | `<h1>` (text)               | 458 ms | 0 ms       | 0 ms      | **3011 ms (87%)** |

Note the Speed Index / LCP gap: the page is visually settled at ~1.2 s but LCP
does not fire until ~3.4 s. That gap is the signature of the reveal animation
described below.

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

### 1. The scroll-reveal animation holds back LCP by about 2–3 seconds on every page

`src/app/(site)/layout.tsx:152` runs an inline script that puts a `js` class on
`<html>` straight away. `src/styles/counter.css:1415` then sets
`.js .cne-rv { opacity: 0 }`, so every section marked `cne-rv` — which is most
of the page — is invisible from the very first frame. Those sections only
become visible once React has hydrated and `RevealRoot`
(`src/components/counter/Reveal.tsx`) runs its effect and adds `is-in`.

The practical effect is that LCP is pinned to "hydration finished", not to
"content arrived". That is why render delay is 64–87% of LCP on all four
pages, why LCP is the same ~3.4 s whether the element is an image or a plain
`<h1>`, and why Speed Index (1.2 s) and LCP (3.4 s) are so far apart. Anyone on
a slow phone stares at hidden sections for roughly two extra seconds after the
content has already been delivered.

### 2. The shop product page ships 688 KB of images, mostly at the wrong size

`/shop/foam-trucker-blue/` transfers 1218 KB on mobile — roughly double every
other page — and 688 KB of that is images. Nine gallery images download at full
720 px width even though eight of them render as 120 px thumbnails.

The cause is a gap in the `srcSet`: each gallery image offers only a 200 w thumb
and the 720 w original. A 120 px thumbnail on a phone with a 2.6x screen needs
about 315 px, the 200 w file is too small, so the browser falls back to the
720 w original every time. Lighthouse puts the saving at 595 KB. Next.js image
optimisation is off (`images: { unoptimized: true }` in `next.config.mjs`), so
nothing fills that gap automatically.

### 3. Every page ships ~116 KB of inline CSS and ~145–205 KB of route prefetch that nothing asked for

Two separate costs that together dominate what is left.

`experimental.inlineCss: true` in `next.config.mjs` inlines the stylesheet into
the HTML document. All four pages carry an identical 116,085 bytes of inline
`<style>`, which is why each HTML document is 279–320 KB raw (54–60 KB
compressed). Because it lives in the document it is re-sent on every page view
and can never be cached, and Lighthouse reckons about 12 KB of it is unused on
any given page.

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

```
pnpm install && pnpm build
PORT=3100 pnpm start
CHROME_PATH=/path/to/chrome npx lighthouse http://localhost:3100/menu/ \
  --only-categories=performance --output=json --output-path=out.json \
  --chrome-flags="--headless=new --no-sandbox"
```

Add `--preset=desktop` for the desktop profile. Take the median of three runs.
