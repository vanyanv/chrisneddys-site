import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
};

export default nextConfig;
