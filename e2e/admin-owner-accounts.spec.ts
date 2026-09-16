import { test, expect, type Page, type BrowserContext, type Browser } from "@playwright/test";
import { signInAsOwner, OWNER_EMAIL, OWNER_PASSWORD } from "./helpers";

/**
 * Owner-account flows on Better Auth, issue #33 — see
 * `docs/superpowers/specs/2026-09-14-better-auth-owner-sign-in-design.md`
 * and DEPLOY.md's "Owner accounts" section.
 *
 * TWO REAL PRODUCT BUGS were found writing this file, both in `src/`, both
 * out of scope for this file to fix (see this repo's task rules). Each is
 * exercised here with `expect.soft` so the rest of the test still runs and
 * every other assertion gets a real answer, rather than the whole test
 * aborting on the first known-bad assertion:
 *
 * 1. **Changing your own password signs *you* out too**, not just other
 *    devices. `ChangePasswordCard` always calls `auth.api.changePassword`
 *    with `revokeOtherSessions: true` and expects to stay signed in on the
 *    device that made the change (the toast says "Every other device was
 *    signed out", implying this one wasn't) — matching
 *    `owners.test.ts`'s "changePassword revocation" describe block, which
 *    proves the fresh cookie Better Auth mints for the *acting* device
 *    keeps working when replayed by hand through `auth.api.getSession`.
 *    In the real, built app the equivalent browser request instead lands
 *    back on `/admin/sign-in` and never shows the confirmation toast —
 *    reproduced by test 2 and test 3 below. The most likely place for this
 *    to go wrong is `src/lib/auth.ts`'s `applySetCookieHeader` /
 *    `src/app/(admin)/admin/settings/actions.ts`'s `changePasswordAction`:
 *    the fresh `Set-Cookie` Better Auth returns has to actually reach the
 *    browser and replace the old one for the acting session to survive,
 *    and something in that path isn't landing right. The password change
 *    itself does persist correctly either way (proven by test 2's "new
 *    password works, old one doesn't", and by every later spec file's
 *    `signInAsOwner()` still working, which depends on this file restoring
 *    `OWNER_PASSWORD` afterwards).
 *
 * 2. **Inviting an owner never surfaces a link.** `OwnersCard`'s "Send
 *    invite" reproducibly shows "Couldn't generate an invite link. Try
 *    again." instead of the expected set-password link — reproduced by
 *    test 5. The server never logs an error and `auth.api.
 *    requestPasswordReset` itself doesn't throw — `src/lib/owners.ts`'s
 *    `inviteOwner` reaches its own `if (!outcome) return { ok:false, error:
 *    "Could not generate an invite link. Try again." }` fallback, meaning
 *    Better Auth's `sendResetPassword` hook (`src/lib/betterAuth.ts`) ran to
 *    completion but never recorded an outcome into `captureResetSend`'s
 *    `AsyncLocalStorage`. The exact same call, made outside the built app
 *    (a standalone script importing `inviteOwner` directly against the same
 *    PGlite database), succeeds and returns a real `{ sent: false, url }` —
 *    so the bug is specific to running inside the compiled/bundled app, not
 *    the logic itself. Likely mechanism: `src/lib/betterAuth.ts`'s
 *    `resetSendStorage` (the `AsyncLocalStorage` `captureResetSend` reads
 *    and writes) is a plain module-scope singleton, unlike `getAuth()`'s
 *    promise cache a few lines below it, which is deliberately parked on
 *    `globalThis` specifically *because* Next can compile a shared module
 *    more than once across different Server Component / Server Action
 *    bundle layers (see that file's own module comment). If
 *    `src/lib/owners.ts` and whichever call site first builds the cached
 *    `auth` instance land in different layers, `owners.ts`'s
 *    `captureResetSend` sets up a `run()` context on *its* copy of
 *    `resetSendStorage` while the real `sendResetPassword` closure (bound
 *    into the cached singleton) reads `getStore()` from a *different*
 *    copy — always `undefined`, so `store.outcome` is silently never set.
 *    Test 6 is split in two because of this: 6a (self-removal is refused)
 *    needs no second owner and passes; 6b (removing a second owner) needs
 *    one, which today only exists via invite, so it fails at the same step
 *    as test 5 — not a third bug.
 *
 * Because of bug 1, tests 2 and 3 can't rely on staying signed in right
 * after changing a password, so both always re-sign-in explicitly before
 * their next step rather than assuming the previous session survived —
 * which also means restoring `OWNER_EMAIL` back to `OWNER_PASSWORD` in a
 * `finally` block works reliably regardless of bug 1. Every other spec
 * file's `signInAsOwner()` depends on that restoration, so a final
 * `afterAll` double-checks it independently, in case a mid-test crash skips
 * a `finally` block.
 *
 * With invite broken (bug 2), tests 2 and 3 also can't get a second,
 * disposable owner account the normal way, so both change and restore the
 * seeded `OWNER_EMAIL` account's own password instead of an invited one.
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
 * `page.waitForLoadState("networkidle")`: per bug 1 above, a successful
 * change can leave the *acting* page's client-side router stuck retofetching
 * the now-invalid session in the background — network activity that never
 * goes idle — which would make `networkidle` hang for the test's entire
 * timeout instead of ever returning. Doesn't wait for the confirmation
 * *toast* specifically — see bug 1 above, it doesn't always appear — so
 * callers that need that check for it separately. */
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
 * works — the reliable way to change/restore this account's password given
 * bug 1 (the change itself always sticks; only the same-session
 * toast/redirect is broken, and reusing that same session's cookie jar for
 * the verification step isn't worth the risk of tripping over the same bug
 * a second time). Throws if `to` doesn't end up working, so a broken
 * restoration is never silent. */
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

// Not `.serial`: with two known product bugs below (1 and 2 in the module
// comment), tests 2/3 and 5/6b are expected to fail, and `.serial` would
// skip every test after the first failure — this file wants every test to
// run and report independently. `workers: 1` + `fullyParallel: false`
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

      // Expected per the design (src/app/(admin)/admin/settings/
      // ChangePasswordCard.tsx) — reproducibly fails today, bug 1 above.
      await expect
        .soft(
          page.getByText("Password changed. Every other device was signed out.", { exact: true }),
        )
        .toBeVisible();

      // The new password works on a fresh sign-in, regardless of bug 1.
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
      await expect
        .soft(
          a.page.getByText("Password changed. Every other device was signed out.", {
            exact: true,
          }),
        )
        .toBeVisible();

      // Context B's cookie is completely untouched by A's change (a
      // separate context/cookie jar) — navigating it now must hit the
      // revoked session server-side (`requireOwner()` -> `auth.api.
      // getSession`) and bounce to sign-in, proving real session revocation
      // rather than a cleared cookie in the same browser context. This is
      // the core thing this spec exists to prove, and it holds regardless
      // of bug 1 above.
      await b.page.goto("/admin/settings");
      await b.page.waitForURL(/\/admin\/sign-in/, { timeout: 30_000 });
      // issue #44 restyled the guest sign-in screen onto The Rack — the
      // heading is now the board's "Sign in." rather than the Sheet-era
      // "Owner sign-in".
      await expect(b.page.getByRole("heading", { name: "Sign in." })).toBeVisible();

      // Context A's own session should still be good — only *other*
      // sessions are supposed to be revoked. Reproducibly fails today, bug
      // 1 above: A is bounced to sign-in here too.
      await a.page.goto("/admin/settings");
      await expect.soft(a.page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    } finally {
      // Restore OWNER_PASSWORD from fresh contexts — never trusting that
      // context A's own session survived the change (it may not have, per
      // bug 1) or that its cookie jar is still in a good state.
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

    // See this file's module comment (bug 2): reproducibly fails here with
    // "Couldn't generate an invite link. Try again." instead of showing the
    // set-password link.
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
    // Needs a second owner, which today only exists via invite — see this
    // file's module comment (bug 2). Expected to fail at the invite step,
    // the same known bug as test 5, not a separate one.
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
