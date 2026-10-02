import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Full policy and rationale: DEPLOY.md -> "Security headers" and "Cache
// policy". This is now the one place these ship from for every host — Vercel
// runs a server, so `public/_headers` (Netlify/Cloudflare only, inert
// elsewhere) is no longer enough on its own.
// Two directives in the shipped policy are hostile to `next dev`, which serves
// over plain http on localhost. Both are gated on NODE_ENV so the deployed
// policy is unchanged byte for byte:
//
//  - 'unsafe-eval' — react-refresh evaluates its module registry with `eval`,
//    and without it the browser refuses the entire client bundle. Nothing
//    hydrates, so add-to-bag, the bag drawer and the gallery silently do
//    nothing. Production never loads react-refresh.
//  - upgrade-insecure-requests — rewrites every http request the page makes to
//    https, including same-origin `fetch`. On http://localhost that turns the
//    admin's own POST /api/admin/upload into an ERR_SSL_PROTOCOL_ERROR against
//    a port speaking no TLS, so photo upload fails with nothing in the server
//    log. In production every URL is already https and the directive is a
//    no-op for correctly-written pages — it stays there.
//
// Vercel Web Analytics needs nothing extra in production: it loads
// /_vercel/insights/script.js and posts to /_vercel/insights/* on our own
// origin. Only `next dev` swaps in a debug script from va.vercel-scripts.com.
const isDev = process.env.NODE_ENV === "development";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ""} https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com https://*.public.blob.vercel-storage.com",
  "font-src 'self'",
  "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  experimental: {
    inlineCss: true,
    // Next 16 reuses Turbopack's build cache between builds by default. One
    // local build after a branch switch shipped CSS missing a rule changed on
    // the new branch (the hat photo rendered smaller); a clean build was fine.
    // Vercel restores that cache between deploys, so every build starts clean.
    turbopackFileSystemCacheForBuild: false,
  },
  // PGlite loads its WASM/data files with `fs` + `URL` in ways Next's server
  // webpack bundle mishandles (an "instance of URL" `fs` error); left as a
  // real `require`, resolved by Node itself at runtime, it works as shipped.
  serverExternalPackages: ["@electric-sql/pglite"],
  // `/service-worker.js` is the other path site builders register a worker
  // at; both answer with the kill switch in public/sw.js.
  async rewrites() {
    return [{ source: "/service-worker.js", destination: "/sw.js" }];
  },
  // Online catering ordering was taken down on 2026-09-29. Its old links
  // (the order builder, order links and "find my orders") land on the
  // catering page instead of a 404.
  async redirects() {
    return [
      { source: "/catering/order", destination: "/catering/", permanent: true },
      { source: "/catering/order/:path*", destination: "/catering/", permanent: true },
      { source: "/catering/o/:path*", destination: "/catering/", permanent: true },
      { source: "/catering/find", destination: "/catering/", permanent: true },
      { source: "/catering/find/:path*", destination: "/catering/", permanent: true },
      // The Otter photos the owner's own shots replaced (issues #208, #230). Image
      // search and the old sitemap point at them; send those to the new ones.
      ...Object.entries({
        "5f336391-8daf-4d23-929a-cb78c125ce0d": "combo-1-chris",
        "6dcd14a3-7032-489a-9e66-5f4718e96af1": "combo-2-chris",
        "0a500a4b-3624-4ea3-b99a-9a5f83f2155b": "cheese-fries",
        "e714a53e-90be-4cc8-8692-1358c9faebb1": "loaded-fries",
        "f4a0f2cc-ba78-4149-88b7-c2f04c81903c": "straight-cut-fries",
        "fe9754fa-6f48-423a-a833-b52f0a9c2f89": "chris-n-eddy-s-slider-chris",
        "3bbad078-abd7-4c5a-9fd1-6c93497c3e9d": "single-patty-slider-chris",
        "25f20ba6-6643-4d3d-b833-6bddbcedbfcc": "reverse-bun-chris",
        // The drinks, reshot in the same studio look as the combos.
        "cceb4fd1-72ae-43f5-8432-8e4648f26e07": "strawberry-shake",
        "688ed85d-8dd9-4d31-be94-5994801863be": "chocolate-shake",
        "42b6ff6c-9e02-43da-bdeb-dd181e8ec348": "vanilla-shake",
        "90727ef0-3fff-4e67-afd1-77d34ed83417": "coca-cola",
        "a9ccb11e-44fa-4241-bb8c-b9ffb6288d07": "diet-coke",
        "828b4720-c3f3-42d0-b5f6-851bb8ec6621": "sprite",
        "914889df-3ce3-4968-9f8b-3ad1154c28c2": "orange-fanta",
        "115c038a-7ed0-4de8-9c67-d7bf54d70f0e": "hi-c",
        "7678a45c-dd42-4249-a148-ca575e757d3d": "minute-maid",
        "1d36f305-06ca-4bfe-bbc7-c01aa67757f5": "mexican-sprite",
        "6e108101-0671-4280-a3f9-69d5738349b7": "mexican-fanta",
        "953b863c-2e2a-4d60-b1a2-436c1db3a149": "water-bottle",
      }).flatMap(([from, to]) =>
        [".webp", ".avif", "-thumb.webp", "-thumb.avif", "-card.webp", "-card.avif"].map(
          (file) => ({
            source: `/menu/${from}${file}`,
            destination: `/menu/${to}${file}`,
            permanent: true,
          }),
        ),
      ),
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()",
          },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
      {
        // The Vercel-assigned `*.vercel.app` hosts (production alias and every
        // preview) serve the same pages as www.chrisneddys.com. Canonical tags
        // already point at www, but this keeps search engines from indexing
        // the Vercel address as a second copy of the site at all.
        source: "/(.*)",
        has: [{ type: "host", value: "(?<vercelHost>.+)\\.vercel\\.app" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // The old site's service-worker kill switch (public/sw.js) must never
        // be served stale, or a returning visitor keeps the old site longer.
        source: "/:worker(sw|service-worker).js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      {
        source: "/_next/static/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // path-to-regexp (Next's `source` matcher) doesn't accept a bare
        // `\.(ext|ext)` suffix after a wildcard segment — it parses the
        // literal `.` fine but rejects the trailing alternation group unless
        // it's bound to a named parameter. This is the closest supported
        // form: a named, repeated `:path*` segment with the extension as its
        // own custom-regex parameter.
        source: "/:path*.:ext(webp|jpg|jpeg|png|svg|avif)",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
      {
        // The /locations/ map's early start. React would normally put this
        // preload in the page itself, but under Next 16 it then also rides
        // along with every prefetch of /locations/, so every page linking
        // here downloaded the map (see LocationsMapCanvas). A header on the
        // HTML only (not the `RSC` prefetch requests) keeps it on this page.
        source: "/locations",
        missing: [{ type: "header", key: "rsc" }],
        headers: [
          { key: "Link", value: "</map-base.svg>; rel=preload; as=image; fetchpriority=high" },
        ],
      },
      // Deliberately no blanket HTML rule: server-rendered and ISR routes
      // set their own Cache-Control, and a catch-all here would override it.
    ];
  },
};

export default nextConfig;
