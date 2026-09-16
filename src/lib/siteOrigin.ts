/**
 * Resolves the origin (scheme + host, no trailing slash) that an absolute
 * link built on the server should point at.
 *
 * Most of the app never needs this: a page rendered in a browser already has
 * a request/origin to resolve a relative link against, and `brand.siteUrl`
 * (`src/data/brand.ts`) is baked directly into SEO metadata and JSON-LD
 * (`src/lib/seo.ts`) because those are *always* the canonical production
 * site, deploy preview or not. But a link that has to survive leaving this
 * process entirely — the password-reset/owner-invite link `src/lib/
 * betterAuth.ts` emails out — has no such context to resolve against once
 * it's sitting in someone's inbox, so it has to be made absolute here, on
 * the server, before it's ever sent.
 *
 * Precedence:
 *
 * 1. `SITE_ORIGIN` — an explicit override, checked first so it always wins.
 *    This is what `playwright.config.ts`'s e2e harness sets, pointed at the
 *    Playwright test server's own `http://localhost:<port>` origin — without
 *    it, an emailed link built from `brand.siteUrl` would send the e2e
 *    suite's "invitee" flow off to the real, live chrisneddys.com instead of
 *    the disposable server under test. Any Vercel preview that needs a real
 *    email to link back at *that* preview (rather than falling through to
 *    step 2 or 3) can set it too.
 *
 * 2. `VERCEL_URL` — but **only when `VERCEL_ENV === "preview"`**. Vercel
 *    sets `VERCEL_URL` to the deployment's own unique `*.vercel.app` host
 *    (no scheme) on every deployment, preview and production alike, and
 *    it's the only origin a preview is actually reachable at, so an emailed
 *    link from a preview should point there. Production is deliberately
 *    excluded from this branch — gated on `VERCEL_ENV === "preview"`,
 *    not just "VERCEL_URL is set", since this project's Vercel-assigned
 *    production alias is not `brand.siteUrl` (see `DEPLOY.md`'s domain
 *    setup) and honouring `VERCEL_URL` there would silently mail out the
 *    wrong host. Anywhere `VERCEL_ENV` isn't exactly `"preview"` — no
 *    Vercel env at all (`pnpm dev`, unit tests, this repo's other hosting),
 *    or `"production"` — falls through to step 3.
 *
 * 3. `brand.siteUrl` — the canonical production domain, and the default
 *    with no environment variables set at all (`pnpm dev`, unit tests).
 */
import { brand } from "@/data/brand";

function stripTrailingSlashes(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/** The resolved origin, e.g. `"https://www.chrisneddys.com"` — never a
 * trailing slash. */
export function getSiteOrigin(): string {
  const override = process.env.SITE_ORIGIN;
  if (override) return stripTrailingSlashes(override);

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && process.env.VERCEL_ENV === "preview") {
    return `https://${stripTrailingSlashes(vercelUrl)}`;
  }

  return brand.siteUrl;
}

/** `path` (which should start with `/`) resolved into a fully-qualified URL
 * against `getSiteOrigin()` — never a double slash at the join, regardless
 * of whether `path` already has its own leading slash. */
export function absoluteUrl(path: string): string {
  const origin = getSiteOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
