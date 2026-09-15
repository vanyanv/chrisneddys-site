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
 * `e2e/db-warmup.mjs` then migrates and seeds that fresh database once,
 * single-process, before `next build` starts — see that file for why: left
 * to `next build`'s own parallel static-generation workers, the first-ever
 * migrate/seed races and corrupts the PGlite data directory.
 *
 * `OWNER_PASSWORD_HASH` below is `scrypt$<salt>$<hash>` — src/lib/password.ts's
 * format — for the plaintext password `"e2e-test-password-123"`, produced by
 * `pnpm owner:password e2e-test-password-123`. `e2e/helpers.ts` signs in with
 * that same plaintext (exported there as `OWNER_PASSWORD`).
 *
 * Its `$`s are escaped (`\$`), same as DEPLOY.md warns for `.env` files, and
 * for the same reason even though this value never touches a `.env` file:
 * `next start` loads `.env.local` via `@next/env`, and that pass runs
 * `dotenv-expand` over the *whole* resulting environment whenever any `.env`
 * file is present — not just the keys that file defines — so an unescaped
 * `scrypt$<hex>$<hex>` already sitting in `process.env` (set right here,
 * below) gets its `$<hex>` runs "expanded" against undefined variable names
 * and silently truncated to `scrypt`, and every sign-in then fails with "That
 * email or password isn't right." Confirmed by reproducing it locally: signed
 * in fine with `.env.local` absent, failed with it present and this value
 * unescaped, passed again once escaped. `.env.local` is never touched here —
 * only the value this config sets.
 */
const PORT = 3111;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
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
    },
  ],
  webServer: {
    command: `rm -rf .pglite/e2e && node e2e/db-warmup.mjs && pnpm build && pnpm exec next start -p ${PORT}`,
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
      OWNER_EMAILS: "owner@example.com",
      OWNER_PASSWORD_HASH:
        "scrypt\\$49bb82fcf56a3fd47be334f724da8825\\$ec75a0afa670e1849fb2b8f745dfbe015dea49942b51f93a9c79d029543cdf7396f29981005ef523463c9e11da7249c47b14e5808bb1a206505f76d851228c1d",
      // Keep the smoke suite away from real Stripe/Blob credentials even if
      // .env.local has them set.
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      BLOB_READ_WRITE_TOKEN: "",
    },
  },
});
