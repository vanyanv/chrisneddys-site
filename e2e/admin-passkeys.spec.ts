import { test, expect, type Page } from "@playwright/test";
import { signInAsOwner, OWNER_EMAIL, OWNER_PASSWORD } from "./helpers";

/**
 * Issue #51 — passkeys. Chromium's CDP `WebAuthn` domain drives a virtual
 * authenticator so these specs exercise the real `navigator.credentials.*`
 * ceremony end to end — registering in Settings, then signing in with the
 * credential it created — rather than mocking either call out. Firefox and
 * WebKit have no equivalent CDP surface, which is one reason
 * `playwright.config.ts` runs only the `chromium` project.
 *
 * Each test opens its own page/context (`browser.newPage()`), unlike this
 * suite's more common `describe.serial` + one shared page: a virtual
 * authenticator is configured per-page via CDP, and test 3 specifically
 * needs a *second*, authenticator-less page to stand in for "a different
 * browser that never enrolled a passkey" — sharing one page throughout
 * would make that impossible to represent.
 *
 * Every test here enrols whatever passkey it needs, under its own name, and
 * none reads another's. That is deliberate rather than tidy: these are
 * separate top-level tests, not a `describe.serial` block, so nothing makes
 * one a dependency of another — `workers: 1` and `fullyParallel: false`
 * fix the order they run in, but running any one of them alone still has
 * to work, and `retries: 0` means a cascade from an earlier failure would
 * be reported as several unrelated ones.
 */

/** Enables Chromium's virtual authenticator on `page` — a platform
 * authenticator with a resident key that approves every prompt with no UI,
 * standing in for Face ID / Windows Hello during registration and sign-in. */
async function addVirtualAuthenticator(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

/** Opens the avatar menu and signs out via the real form — every other spec
 * in this suite never needs to sign back out mid-run, so no shared helper
 * for it exists yet in `e2e/helpers.ts`. */
async function signOut(page: Page): Promise<void> {
  await page.locator(".rack-avatar-menu summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/sign-in/, { timeout: 15_000 });
}

test("1. enroll a passkey in Settings, then sign back in with only that passkey", async ({
  browser,
}) => {
  const page = await browser.newPage();
  await addVirtualAuthenticator(page);
  await signInAsOwner(page);
  await page.goto("/admin/settings");

  await expect(page.getByRole("heading", { name: "Passkeys" })).toBeVisible();
  await page.getByLabel("Name this device (optional)").fill("E2E virtual key");
  await page.getByRole("button", { name: "Add a passkey" }).click();

  // The registration ceremony round-trips through two server actions plus
  // the (instant, no-UI) virtual authenticator — give it real room.
  await expect(page.getByText("E2E virtual key")).toBeVisible({ timeout: 15_000 });

  await signOut(page);

  // No email, no password typed anywhere below this line.
  await page.getByRole("button", { name: "Continue with a passkey" }).click();
  await page.waitForURL((url) => !url.pathname.includes("sign-in"), { timeout: 15_000 });
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/products\/?$/);

  await page.close();
});

test("2. removing a passkey never breaks password sign-in (rule 3)", async ({ browser }) => {
  const page = await browser.newPage();
  await addVirtualAuthenticator(page);
  await signInAsOwner(page);
  await page.goto("/admin/settings");

  // Enrolled here rather than inherited from test 1. These are separate
  // top-level tests, not a `describe.serial` block: `workers: 1` and
  // `fullyParallel: false` happen to run them in order today, but neither
  // makes test 1 a dependency of test 2 — and running this test on its own
  // (`-g "removing a passkey"`) skips test 1 entirely, which would leave
  // this one failing on a passkey that was never created.
  const NAME = "E2E removable key";
  await page.getByLabel("Name this device (optional)").fill(NAME);
  await page.getByRole("button", { name: "Add a passkey" }).click();
  await expect(page.getByText(NAME)).toBeVisible({ timeout: 15_000 });

  // Now remove it and prove the password path is entirely unaffected.
  // Scoped to the passkey's own list row: "Remove" also appears in the
  // unrelated Owners card below it on the same page.
  const passkeyRow = page.getByRole("listitem").filter({ hasText: NAME });
  await expect(passkeyRow).toBeVisible();
  await passkeyRow.getByRole("button", { name: "Remove" }).click();
  await passkeyRow.getByRole("button", { name: "Confirm remove" }).click();
  await expect(page.getByText(NAME)).toHaveCount(0);

  await signOut(page);

  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password").fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("sign-in"), { timeout: 30_000 });
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/products\/?$/);

  await page.close();
});

test("3. device-loss fallback: a passkey exists on the account, this browser has none, password still gets in", async ({
  browser,
}) => {
  // First, an owner enrolls a passkey on "their phone" — a page with a
  // virtual authenticator of its own.
  const ownersPhone = await browser.newPage();
  await addVirtualAuthenticator(ownersPhone);
  await signInAsOwner(ownersPhone);
  await ownersPhone.goto("/admin/settings");
  await ownersPhone.getByLabel("Name this device (optional)").fill("Owner's phone");
  await ownersPhone.getByRole("button", { name: "Add a passkey" }).click();
  await expect(ownersPhone.getByText("Owner's phone")).toBeVisible({ timeout: 15_000 });
  await ownersPhone.close();

  // Then the owner loses that phone and signs in from a different browser
  // that was never given a passkey — no virtual authenticator configured
  // here at all, the same as a real machine with no platform authenticator
  // registered for this site.
  const strandedBrowser = await browser.newPage();
  await strandedBrowser.goto("/admin/sign-in");

  await strandedBrowser.getByRole("button", { name: "Continue with a passkey" }).click();
  // With no authenticator to answer it, the WebAuthn call rejects almost
  // immediately; the button's own catch swallows that silently and
  // re-enables itself — waiting for it to become enabled again is a real
  // signal that the failed attempt has fully settled, not a fixed delay.
  await expect(
    strandedBrowser.getByRole("button", { name: "Continue with a passkey" }),
  ).toBeEnabled({ timeout: 10_000 });
  await expect(strandedBrowser).toHaveURL(/sign-in/);

  // The password path right below it still works, exactly as if the
  // passkey button had never been there.
  await strandedBrowser.getByLabel("Email").fill(OWNER_EMAIL);
  await strandedBrowser.getByLabel("Password").fill(OWNER_PASSWORD);
  await strandedBrowser.getByRole("button", { name: /sign in/i }).click();
  await strandedBrowser.waitForURL((url) => !url.pathname.includes("sign-in"), {
    timeout: 30_000,
  });
  await strandedBrowser.goto("/admin/products");
  await expect(strandedBrowser).toHaveURL(/\/admin\/products\/?$/);

  await strandedBrowser.close();
});
