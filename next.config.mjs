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
const isDev = process.env.NODE_ENV === "development";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com https://*.public.blob.vercel-storage.com",
  "font-src 'self'",
  "connect-src 'self' https://api.web3forms.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
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
        source: "/:path*.:ext(webp|jpg|jpeg|png|svg)",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
      // Deliberately no blanket HTML rule: server-rendered and ISR routes
      // set their own Cache-Control, and a catch-all here would override it.
    ];
  },
};

export default nextConfig;
