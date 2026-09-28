import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end harness.
 *
 * `webServer` builds and boots the real app (`next build` + `next start`,
 * `NODE_ENV=production`) against a local, file-persisted PGlite database —
 * never the real Neon database, Stripe, or Blob store that `.env.local`
 * points at. Every env var the app reads for those is pinned below so it
 * can never fall through to `.env.local`'s real credentials: Next only
 * skips a `.env.local` value when the same key is already present in
 * `process.env` of the process it starts in, so each of these has to be
 * set explicitly, including to `""` for "unset".
 *
 * The database itself is `src/db/client.ts`'s ordinary `pnpm dev` path: with
 * `DATABASE_URL` unset (and not a Vitest run), it opens a file-persisted
 * PGlite instance, migrating and seeding it once. That path defaults to
 * `.pglite/dev` — the developer's own local database — so this config points
 * it at `.pglite/e2e` instead via `PGLITE_DATA_DIR` (both gitignored under
 * the existing `.pglite/` entry) and `webServer.command` wipes only that
 * `e2e` directory before every run, never `dev`, so each e2e run starts from
 * a known, freshly-seeded catalogue without touching anyone's local data.
 * It also wipes `e2e/catering/.fixtures.json` in the same step:
 * `seed-catering-fixtures.mjs` skips its own seed whenever that file
 * already exists (the same idempotency guard `db-warmup.mjs` uses), and
 * that file lives outside `.pglite/e2e` — left in place across a wipe, it
 * would point `cancel.spec.ts`/`expired.spec.ts` at tokens for orders that
 * no longer exist in the freshly-wiped database, a 404 on the customer
 * order link that has nothing to do with those specs' own assertions.
 * `e2e/db-warmup.mjs` then migrates and seeds that fresh database once,
 * single-process, before `next build` starts — see that file for why: left
 * to `next build`'s own parallel static-generation workers, the first-ever
 * migrate/seed races and corrupts the PGlite data directory.
 *
 * `OWNER_EMAILS`/`OWNER_PASSWORD_HASH` below no longer feed a real sign-in:
 * `e2e/db-warmup.mjs` seeds the owner account (`e2e/helpers.ts`'s
 * `OWNER_EMAIL`/`OWNER_PASSWORD`) directly into the database before `next
 * build` even starts, by inserting the `user`/`account` rows itself and
 * hashing the password with `src/lib/password.ts`'s `hashPassword` — see
 * that file's module comment. With a `user` row already present,
 * `src/lib/auth.ts`'s `bootstrapFirstOwnerIfNeeded` (which is the only code
 * that ever reads `OWNER_PASSWORD_HASH`) is a no-op: it only seeds an
 * account while the `user` table is still empty.
 *
 * These two vars are kept only because `isAuthConfigured()` (`src/lib/
 * auth.ts`) requires `AUTH_SECRET`, `OWNER_EMAILS` and `OWNER_PASSWORD_HASH`
 * to all be set before the sign-in page will even render its form — so
 * these just need to be non-empty, not valid. That used to matter a great
 * deal: this value used to be the *only* thing bootstrapping the owner
 * account, and it had to survive `next start` loading `.env.local` via
 * `@next/env`, whose `dotenv-expand` pass runs over the *whole* resulting
 * environment whenever any `.env*` file is present — not just the keys
 * that file defines. That pass un-escapes a literal `\$` back to `$`, so a
 * hash containing raw, unescaped `$<hex>` runs already sitting in
 * `process.env` would get "expanded" against undefined variable names and
 * silently truncated. But that only happens when some `.env*` file exists
 * to make `@next/env` run the expand pass at all (a fresh checkout has
 * none), so the old escaped-`\$` value was actually broken exactly on a
 * clean checkout — a real, since-fixed harness bug, not something to
 * preserve. Since neither var is ever parsed as a real hash anymore, this
 * value is now a plain placeholder with no `$` in it at all, so there's no
 * escaping question left to get right in either direction.
 *
 * `localhost`, not `127.0.0.1` (issue #51): WebAuthn's Relying Party ID must
 * be a valid domain string per the spec — an IP address literal doesn't
 * qualify, and Chromium enforces that when a passkey ceremony runs, virtual
 * authenticator or not. `localhost` is the one hostname every browser (and
 * `@better-auth/passkey`'s own `rpID` default) treats as a valid RP ID and a
 * secure context without TLS, so the e2e harness has to serve from it for
 * `e2e/admin-passkeys.spec.ts` to be able to drive a real ceremony at all.
 */
const PORT = 3111;
export const BASE_URL = `http://localhost:${PORT}`;

/**
 * This sandbox's preinstalled Chromium (revision 1194, under
 * `PLAYWRIGHT_BROWSERS_PATH`) is older than what the pinned `@playwright/
 * test` version's own bundled-browser manifest asks for (revision 1243),
 * and the sandbox's network policy blocks `cdn.playwright.dev`, so
 * `playwright install` can't fetch the newer one. Pointing `executablePath`
 * straight at the preinstalled binary skips that revision check entirely.
 * Scoped to the catering projects only, since only they were added here —
 * the existing `chromium` project is left exactly as it was.
 */
const CHROMIUM_HEADLESS_SHELL =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
export const PW_LAUNCH_OPTIONS = existsSync(CHROMIUM_HEADLESS_SHELL)
  ? { executablePath: CHROMIUM_HEADLESS_SHELL }
  : undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // 120s, not Playwright's 30s default: the same shared, 4-core-box
  // slow-under-load reasoning as `expect.timeout` below applies to a whole
  // test occasionally too (a `signInAsOwner` + admin navigation + a
  // server-rendered page under load has been observed to clear 60s even
  // though nothing is actually hung), so this only gives a slow machine
  // more patience — it doesn't loosen what any assertion checks, and a
  // genuinely hung test still fails.
  timeout: 120_000,
  // Playwright's default expect timeout is 5s, which is too tight here.
  // These specs assert on state that arrives via a Server Action plus the
  // revalidation that follows it, and the whole suite shares one worker on
  // a 4-core box that is also running `next start`, so a perfectly healthy
  // "owner removed, list re-rendered" round trip can exceed 5s under load
  // and fail an assertion that would have passed a moment later. Assertions
  // poll, so a higher ceiling costs nothing when things are fast — it only
  // stops a slow machine from being reported as a broken one.
  expect: { timeout: 20_000 },
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /e2e\/catering\//,
    },
    // Catering (issue #190) walks every flow at both a phone and a desktop
    // viewport, so its specs get their own two projects instead of the one
    // above — every other spec keeps running at Desktop Chrome only via
    // `testIgnore` there.
    //
    // `catering-setup` is a third, hidden project holding just
    // `global-setup.spec.ts`, which turns catering ordering ON once through
    // the real admin UI before either viewport project runs a single spec
    // (see that file's module comment for why this has to be a real Server
    // Action round trip, not a direct database write). `catering-phone` and
    // `catering-desktop` each declare it as a `dependencies` entry, which
    // runs it exactly once for the whole suite (not once per viewport) and
    // blocks both projects until it passes — the standard Playwright
    // pattern for "this has to happen first," and one that (unlike a plain
    // `globalSetup` script driving its own hand-rolled `chromium.launch`)
    // inherits this project's own `use` block, so it gets the same
    // `expect.timeout` as every other spec instead of Playwright's 5s
    // default.
    {
      name: "catering-setup",
      testMatch: /e2e\/catering\/global-setup\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], launchOptions: PW_LAUNCH_OPTIONS },
    },
    {
      name: "catering-phone",
      testMatch: /e2e\/catering\/.*\.spec\.ts$/,
      testIgnore: /e2e\/catering\/global-setup\.spec\.ts$/,
      dependencies: ["catering-setup"],
      // 2, not the suite's default 0 (see `retries` below for why this is
      // scoped to just the two catering viewport projects): reproduced
      // directly (a standalone script driving 20-30 approve/decline
      // actions in a row against a freshly built server, no other
      // concurrent traffic) as an intermittent PGlite stall — roughly 1 in
      // 5 of these action round trips, on a small and unpredictable
      // subset, simply never returns, confirmed stuck past 90s with no
      // server-side error and no sign it would ever resolve, while every
      // neighboring identical action completes in ~250ms. It reproduces
      // identically whether the page revalidates inline, via a deferred
      // `after()`, or via a client `router.refresh()` (all three were
      // tried), and the DB writes underneath it (confirmed via the
      // `[email]` log lines each action's own service call ends with)
      // sometimes never even reach that point — so this lives inside
      // PGlite/its driver, not in any of this app's own revalidation
      // code. It's specific to this local, single-connection, WASM
      // database the e2e harness runs against (`src/db/client.ts`'s
      // module comment covers its other single-connection quirks) —
      // production always talks to real, multi-connection Postgres
      // (Neon) and has no equivalent failure mode. A retry costs nothing
      // when the flow was already healthy and reliably clears a stall
      // that has never been observed to repeat back-to-back.
      retries: 2,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        launchOptions: PW_LAUNCH_OPTIONS,
      },
    },
    {
      name: "catering-desktop",
      testMatch: /e2e\/catering\/.*\.spec\.ts$/,
      testIgnore: /e2e\/catering\/global-setup\.spec\.ts$/,
      dependencies: ["catering-setup"],
      // See `catering-phone`'s `retries` comment above.
      retries: 2,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        launchOptions: PW_LAUNCH_OPTIONS,
      },
    },
  ],
  webServer: {
    command: `rm -rf .pglite/e2e e2e/catering/.fixtures.json && node e2e/db-warmup.mjs && pnpm build && pnpm exec next start -p ${PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: "production",
      // PGlite, not Neon — see module comment above.
      DATABASE_URL: "",
      // Its own data directory — never the developer's `.pglite/dev`.
      PGLITE_DATA_DIR: ".pglite/e2e",
      AUTH_SECRET: "e2e-test-auth-secret-32-characters-minimum-length",
      // Without this, `src/lib/siteOrigin.ts` would fall through to
      // `brand.siteUrl` (the real, live chrisneddys.com) when building the
      // invite/reset link `src/lib/betterAuth.ts` emails out, and spec 5
      // (`e2e/admin-owner-accounts.spec.ts`) would try to navigate the
      // invitee there instead of to this disposable test server.
      SITE_ORIGIN: BASE_URL,
      OWNER_EMAILS: "owner@example.com",
      // Never actually parsed as a hash — see the module comment above.
      OWNER_PASSWORD_HASH: "unused-e2e-owner-password-hash-placeholder",
      // Keep the smoke suite away from real Stripe/Blob/Resend credentials
      // even if .env.local has them set. Unset (not just falsy) RESEND_API_KEY
      // and EMAIL_FROM is also what `e2e/admin-owner-accounts.spec.ts`'s
      // forgot-password test (4) exercises: `isEmailConfigured()` in
      // `src/app/(admin)/admin/forgot-password/page.tsx` and `actions.ts`
      // both key off this exact pair.
      //
      // STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET are non-empty placeholders,
      // not real credentials — `getStripe()` (`src/lib/stripe.ts`) is never
      // actually called anywhere in this suite (no spec drives `/api/checkout`
      // all the way through, since that really would need a live Stripe
      // account), so no request is ever made with them and Stripe stays as
      // disabled here as ever. What they DO need to be is *present*:
      // `hasPaymentKeys()` (`src/lib/shopStatus.ts`) — and therefore
      // `isShopOpenFor()` — checks only that both env vars are set, and it
      // gates the paused-shop UI issue #43 added (`e2e/shop-pause.spec.ts`):
      // `paused` on the product/shop pages is `isShopOpenFor(settings) &&
      // isShopPausedFor(settings)`, so with these blank the pause banner and
      // disabled buy button could never render at all, paused or not. Every
      // other spec still sees a closed shop exactly as before: `returnsPolicy`
      // (the other half of `isShopOpenFor`) stays unset for everyone except
      // `shop-pause.spec.ts`, which sets and then restores it through the
      // Settings form.
      STRIPE_SECRET_KEY: "sk_test_e2e_disabled_placeholder",
      STRIPE_WEBHOOK_SECRET: "whsec_e2e_disabled_placeholder",
      BLOB_READ_WRITE_TOKEN: "",
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      // Catering (issue #190): skips the Stripe adapter entirely — checkout
      // redirects straight to the sent page and capture/cancel/refund are
      // no-ops that record fake ids. VERCEL_ENV must stay unset (it's never
      // set above) since the adapter refuses fake mode in Vercel.
      CATERING_FAKE_PAYMENTS: "1",
    },
  },
});
