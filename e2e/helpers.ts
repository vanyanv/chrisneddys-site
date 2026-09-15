import { expect, type Page } from "@playwright/test";

/**
 * Must match the seed pinned in `playwright.config.ts`'s `webServer.env`:
 * `OWNER_EMAILS` and the plaintext behind `OWNER_PASSWORD_HASH`.
 */
export const OWNER_EMAIL = "owner@example.com";
export const OWNER_PASSWORD = "e2e-test-password-123";

/**
 * Signs in as the seeded owner and lands on `/admin/products`.
 *
 * Sign-in itself (`src/app/(admin)/admin/actions.ts`'s `signInAction`)
 * redirects to `next`, which defaults to `/admin` — today that renders the
 * dashboard, not the products list. Another branch is changing `/admin` to
 * redirect straight to `/admin/products`, so rather than assert on where the
 * sign-in redirect lands, this waits for the sign-in form to finish
 * navigating away and then goes to `/admin/products` explicitly — correct
 * either way.
 */
export async function signInAsOwner(page: Page): Promise<void> {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password").fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  // The sign-in server action can take a few seconds on a cold PGlite start
  // (migrate + seed happen on this very request, see src/db/client.ts), so
  // give the post-submit navigation more room than Playwright's 5s default.
  await page.waitForURL((url) => !url.pathname.includes("sign-in"), { timeout: 30_000 });

  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/products\/?$/);
}
