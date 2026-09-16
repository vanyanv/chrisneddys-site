import { test, expect, type Page, type BrowserContext, type Browser } from "@playwright/test";
import { signInAsOwner, OWNER_EMAIL, OWNER_PASSWORD } from "./helpers";

/**
 * Owner-account flows on Better Auth, issue #33 — see
 * `docs/superpowers/specs/2026-09-14-better-auth-owner-sign-in-design.md`
 * and DEPLOY.md's "Owner accounts" section.
 *
 * TWO REAL PRODUCT BUGS were found writing this file, both in `src/`. Both
 * are now fixed (issues #53 and #54); every assertion below is a real
 * `expect`, not `expect.soft`.
 *
 * 1. **Changing your own password used to sign *you* out too**, not just
 *    other devices (#54). `ChangePasswordCard` calls `auth.api.
 *    changePassword`, and it's tempting to pass that call's own
 *    `revokeOtherSessions: true` body flag to get "every other device signed
 *    out" — but despite the name, that flag revokes *every* session for the
 *    user, the caller's current one included (`node_modules/better-auth/
 *    dist/api/routes/update-user.mjs`'s `changePassword` handler:
 *    `revokeOtherSessions` triggers `deleteUserSessions` unconditionally,
 *    then mints a brand-new session and a fresh `Set-Cookie` for it). That
 *    fresh cookie only reaches the browser on the response to *that*
 *    request; the admin layout's `requireOwner()` re-render that follows a
 *    server action happens within the *same* request and reads the cookies
 *    the request *arrived* with — the now-deleted session — so it redirects
 *    to sign-in and the browser loops there. `changePasswordAction`
 *    (`src/app/(admin)/admin/settings/actions.ts`) now calls
 *    `auth.api.changePassword` with no such flag, then separately calls
 *    Better Auth's dedicated `auth.api.revokeOtherSessions` endpoint, which
 *    filters out the caller's own session token before revoking
 *    (`revoke-other-sessions`'s handler in the same source file) — so the
 *    acting session's cookie never changes and there's nothing to reach the
 *    browser in the first place. Tests 2 and 3 prove the acting device
 *    stays signed in and sees the confirmation toast.
 *
 * 2. **Inviting an owner used to never surface a link** (#53). `OwnersCard`'s
 *    "Send invite" reproducibly showed "Couldn't generate an invite link.
 *    Try again." instead of the expected set-password link.
 *    `src/lib/owners.ts`'s `inviteOwner` learns what Better Auth's
 *    `sendResetPassword` hook (`src/lib/betterAuth.ts`) actually did via
 *    `captureResetSend`, and that channel was an `AsyncLocalStorage`: the
 *    App Router compiles `betterAuth.ts` once per webpack layer (RSC, SSR,
 *    Server Actions), and a `run()` context started through one layer's
 *    copy of the module is invisible to a `getStore()` read through
 *    another's — reproducible only in the built app, never under Vitest
 *    (which loads the module once). `captureResetSend` now hands
 *    `sendResetPassword` a plain `Map`, keyed by email and parked on
 *    `globalThis` the same way `getAuth()`'s promise cache already is, so
 *    every layer's copy of the module reads and writes the exact same
 *    object — no async context has to survive anything. See
 *    `betterAuth.ts`'s module comment and `owners.test.ts`'s
 *    "resetSendOutcomes globalThis parking" block. Test 5 proves the link
 *    now shows up and the invitee can sign in with it; 6b (which needs a
 *    second owner, and previously failed at the same invite step as test 5)
 *    now proves removing one works too.
 */

const TEMP_PASSWORD_2 = "temp-password-for-change-test-1";
const TEMP_PASSWORD_3 = "temp-password-for-revoke-test-1";

/** Fills and submits the sign-in form without waiting for the result —
 * callers assert on either a successful or a failed outcome themselves. */
async function submitSignIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

/** A brand-new browser context (its own cookie jar) signed in as
 * (`email`, `password`), landed past the sign-in redirect. */
async function newSignedInContext(
  browser: Browser,
  email: string,
  password: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await submitSignIn(page, email, password);
  await page.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 30_000 });
  return { context, page };
}

/** Submits the Change password form on `/admin/settings` (`page` must
 * already be there, signed in), and waits for the *action itself* to settle
 * before returning — the button's accessible name flips to "Changing…"
 * while `useActionState` has a submission in flight and back to "Change
 * password" once it resolves (`ChangePasswordCard.tsx`), so waiting on that
 * reflects exactly when the server action has returned. Deliberately not
 * `page.waitForLoadState("networkidle")`: before #54 was fixed, a successful
 * change left the *acting* page's client-side router stuck retofetching the
 * now-invalid session in the background — network activity that never went
 * idle — which made `networkidle` hang for the test's entire timeout instead
 * of ever returning; kept this way since it's the more precise wait either
 * way. Doesn't wait for the confirmation *toast* specifically, so callers
 * that need that check for it separately. */
async function submitChangePasswordForm(page: Page, current: string, next: string): Promise<void> {
  await page.getByLabel("Current password", { exact: true }).fill(current);
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await expect(page.getByRole("button", { name: "Change password", exact: true })).toBeEnabled({
    timeout: 15_000,
  });
}

/** Signs in as `OWNER_EMAIL` with `from`, changes the password to `to`, and
 * re-signs-in from a *fresh* browser context to confirm `to` now actually
 * works, rather than trusting that the page that made the change is still
 * in a good state — cheap insurance against ever trusting a stale session
 * for this restoration step. Throws if `to` doesn't end up working, so a
 * broken restoration is never silent. */
async function changeOwnerPasswordAndVerify(
  browser: Browser,
  from: string,
  to: string,
): Promise<void> {
  const changeContext = await browser.newContext();
  try {
    const changePage = await changeContext.newPage();
    await submitSignIn(changePage, OWNER_EMAIL, from);
    await changePage.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 30_000 });
    await changePage.goto("/admin/settings");
    await submitChangePasswordForm(changePage, from, to);
  } finally {
    await changeContext.close();
  }

  const verifyContext = await browser.newContext();
  try {
    const verifyPage = await verifyContext.newPage();
    await submitSignIn(verifyPage, OWNER_EMAIL, to);
    await verifyPage.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 30_000 });
  } finally {
    await verifyContext.close();
  }
}

/** Best-effort safety net: makes sure `OWNER_EMAIL` can sign in with
 * `OWNER_PASSWORD`, trying every password this file might have left it on
 * if an earlier test crashed before its own `finally` restored it. A no-op
 * once `OWNER_PASSWORD` already works. */
async function ensureOwnerPasswordRestored(browser: Browser): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await submitSignIn(page, OWNER_EMAIL, OWNER_PASSWORD);
    const signedIn = await page
      .waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (signedIn) return; // OWNER_PASSWORD already works — nothing to fix.

    for (const stale of [TEMP_PASSWORD_2, TEMP_PASSWORD_3]) {
      const staleWorks = await submitSignIn(page, OWNER_EMAIL, stale)
        .then(() => page.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 5_000 }))
        .then(() => true)
        .catch(() => false);
      if (!staleWorks) continue;
      await changeOwnerPasswordAndVerify(browser, stale, OWNER_PASSWORD);
      return;
    }
  } finally {
    await context.close();
  }
}

// Not `.serial`: `.serial` skips every test after the first failure, and
// this file wants a failure in one test (say, a regression in #53 or #54)
// to still let every other test run and report independently rather than
// aborting the whole file. `workers: 1` + `fullyParallel: false`
// (playwright.config.ts) already keeps execution in declaration order
// without `.serial`'s stop-on-failure behaviour.
test.describe("owner accounts", () => {
  test.afterAll(async ({ browser }) => {
    await ensureOwnerPasswordRestored(browser);
  });

  test("1. sign-in: the seeded owner reaches /admin", async ({ page }) => {
    await page.goto("/admin/sign-in");
    await page.getByLabel("Email").fill(OWNER_EMAIL);
    await page.getByLabel("Password").fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // `/admin` itself is Today — The Rack's work queue
    // (src/app/(admin)/admin/page.tsx) — rather than a redirect to
    // /admin/products, since issue #36.
    await page.waitForURL(/\/admin\/?$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  });

  test("2. changing a password from settings: the new password works, the old one doesn't", async ({
    page,
    browser,
  }) => {
    try {
      await signInAsOwner(page);
      await page.goto("/admin/settings");
      await submitChangePasswordForm(page, OWNER_PASSWORD, TEMP_PASSWORD_2);

      // Per the design (src/app/(admin)/admin/settings/ChangePasswordCard.tsx).
      await expect(
        page.getByText("Password changed. Every other device was signed out.", { exact: true }),
      ).toBeVisible();

      // The new password works on a fresh sign-in.
      await submitSignIn(page, OWNER_EMAIL, TEMP_PASSWORD_2);
      await page.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 30_000 });
      await page.goto("/admin/products");
      await expect(page).toHaveURL(/\/admin\/products\/?$/);

      // The old password no longer works.
      await submitSignIn(page, OWNER_EMAIL, OWNER_PASSWORD);
      await expect(page.getByText("That email or password isn't right.")).toBeVisible();
    } finally {
      await changeOwnerPasswordAndVerify(browser, TEMP_PASSWORD_2, OWNER_PASSWORD);
    }
  });

  test("3. changing a password revokes every other session", async ({ browser }) => {
    // Two independent browser contexts — separate cookie jars, not two tabs
    // sharing one — both signed in as the seeded owner.
    const a = await newSignedInContext(browser, OWNER_EMAIL, OWNER_PASSWORD);
    const b = await newSignedInContext(browser, OWNER_EMAIL, OWNER_PASSWORD);

    try {
      // Context B is genuinely signed in before the change — prove it can
      // reach a protected page.
      await b.page.goto("/admin/settings");
      await expect(b.page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();

      // Change the password in context A only.
      await a.page.goto("/admin/settings");
      await submitChangePasswordForm(a.page, OWNER_PASSWORD, TEMP_PASSWORD_3);
      await expect(
        a.page.getByText("Password changed. Every other device was signed out.", {
          exact: true,
        }),
      ).toBeVisible();

      // Context B's cookie is completely untouched by A's change (a
      // separate context/cookie jar) — navigating it now must hit the
      // revoked session server-side (`requireOwner()` -> `auth.api.
      // getSession`) and bounce to sign-in, proving real session revocation
      // rather than a cleared cookie in the same browser context. This is
      // the core thing this spec exists to prove.
      await b.page.goto("/admin/settings");
      await b.page.waitForURL(/\/admin\/sign-in/, { timeout: 30_000 });
      // issue #44 restyled the guest sign-in screen onto The Rack — the
      // heading is now the board's "Sign in." rather than the Sheet-era
      // "Owner sign-in".
      await expect(b.page.getByRole("heading", { name: "Sign in." })).toBeVisible();

      // Context A's own session should still be good — only *other*
      // sessions are supposed to be revoked.
      await a.page.goto("/admin/settings");
      await expect(a.page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    } finally {
      // Restore OWNER_PASSWORD from fresh contexts rather than trusting
      // that context A's own cookie jar is still in a good state.
      await changeOwnerPasswordAndVerify(browser, TEMP_PASSWORD_3, OWNER_PASSWORD);
      await a.context.close();
      await b.context.close();
    }
  });

  test("4. forgot password with Resend unconfigured says so, not that a link was sent", async ({
    page,
  }) => {
    // `src/app/(admin)/admin/forgot-password/page.tsx` checks
    // RESEND_API_KEY/EMAIL_FROM itself, server-side, before ever rendering
    // `ForgotPasswordForm` — with both unset (`playwright.config.ts`'s
    // `webServer.env`), the page never offers the form at all, it shows the
    // static "not set up" notice directly. So this doesn't submit anything;
    // it just confirms that notice is what a visitor actually sees.
    await page.goto("/admin/forgot-password");

    await expect(
      page.getByText(/emailing isn.t set up for this site yet/i, { exact: false }),
    ).toBeVisible();
    await expect(page.getByText(/reset link is on its way/i)).toHaveCount(0);
    // No form offered — RESEND_API_KEY and EMAIL_FROM are both unset in
    // playwright.config.ts's webServer.env.
    await expect(page.getByLabel("Email")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /send reset link/i })).toHaveCount(0);

    // A locked-out-feeling owner still has a way back to sign in.
    await page.getByRole("link", { name: "Back to sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in\/?$/);
  });

  test("5. inviting an owner surfaces a working set-password link, and the invitee can sign in", async ({
    page,
  }) => {
    const email = `invitee-${Date.now()}@example.com`;

    await signInAsOwner(page);
    await page.goto("/admin/settings");
    await page.getByLabel("Invite an owner", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Send invite", exact: true }).click();

    // See this file's module comment (#53): this used to reliably show
    // "Couldn't generate an invite link. Try again." instead of the
    // set-password link below.
    const notice = page.locator(".adm-mono-value");
    await expect(notice).toBeVisible();
    const link = (await notice.textContent())?.trim();
    expect(link).toBeTruthy();

    await page.goto(link!);
    const password = "invitee-first-password-1";
    await page.getByLabel("New password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    // issue #44 restyled this button onto The Rack's board copy, "Set
    // password and sign in", in place of the plain "Reset password".
    await page.getByRole("button", { name: "Set password and sign in", exact: true }).click();
    await page.waitForURL(/\/admin\/sign-in/, { timeout: 30_000 });
    await expect(
      page.getByText("Password updated. Sign in with your new password.", { exact: true }),
    ).toBeVisible();

    await submitSignIn(page, email, password);
    await page.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 30_000 });
    await page.goto("/admin/products");
    await expect(page).toHaveURL(/\/admin\/products\/?$/);
  });

  test("6a. the UI never offers removing yourself", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/admin/settings");

    const ownRow = page.locator(".adm-owners-item", { hasText: OWNER_EMAIL });
    await expect(ownRow).toBeVisible();
    await expect(ownRow.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
  });

  test("6b. removing a second owner works", async ({ page }) => {
    // Needs a second owner, which only exists via invite — see this file's
    // module comment (#53).
    const email = `removable-${Date.now()}@example.com`;

    await signInAsOwner(page);
    await page.goto("/admin/settings");

    const before = await page.locator(".adm-owners-item").count();

    await page.getByLabel("Invite an owner", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Send invite", exact: true }).click();
    const otherRow = page.locator(".adm-owners-item", { hasText: email });
    await expect(otherRow).toBeVisible();
    await expect(page.locator(".adm-owners-item")).toHaveCount(before + 1);

    await otherRow.getByRole("button", { name: "Remove", exact: true }).click();
    await otherRow.getByRole("button", { name: "Confirm remove", exact: true }).click();

    await expect(page.getByText("Owner removed", { exact: true })).toBeVisible();
    await expect(page.locator(".adm-owners-item", { hasText: email })).toHaveCount(0);
    await expect(page.locator(".adm-owners-item")).toHaveCount(before);
  });
});
