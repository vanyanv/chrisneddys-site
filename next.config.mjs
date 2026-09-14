import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Full policy and rationale: DEPLOY.md -> "Security headers" and "Cache
// policy". This is now the one place these ship from for every host — Vercel
// runs a server, so `public/_headers` (Netlify/Cloudflare only, inert
// elsewhere) is no longer enough on its own.
// `next dev`'s react-refresh runtime evaluates its module registry with
// `eval`, so a policy without 'unsafe-eval' kills the client bundle outright:
// nothing hydrates, and every interactive control on the site (add to bag, the
// bag drawer, the product gallery) silently does nothing. Production never
// loads react-refresh, so the shipped policy stays exactly as it was — this
// concession exists only while `pnpm dev` is running.
const isDev = process.env.NODE_ENV === "development";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://plausible.io`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com https://*.public.blob.vercel-storage.com",
  "font-src 'self'",
  "connect-src 'self' https://api.web3forms.com https://plausible.io https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
  "upgrade-insecure-requests",
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
