import { test, expect, type Page } from "@playwright/test";
import { signInAsOwner } from "./helpers";

/**
 * Covers every owner flow of `/admin/settings`, issue #32. One
 * `describe.serial` block with a single signed-in page, same shape as
 * `admin-sheet.spec.ts` and `admin-orders.spec.ts`: each test builds on
 * whatever the previous one left in the form/database.
 *
 * Store name is only ever *appended to*, never replaced outright — every
 * test that edits it reads the current value first and adds a short
 * suffix. That keeps the original seeded name ("Chris N Eddy's", from
 * `src/db/seed.ts`) a substring of whatever it ends up as, regardless of
 * this file's position relative to `admin-orders.spec.ts` in the run
 * order — the packing slip there asserts the logo's alt text contains
 * that name.
 */

test.describe.serial("admin settings", () => {
  let page: Page;
  let originalSupportEmail = "";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    // The Copy button (test 6) calls `navigator.clipboard.writeText` — grant
    // the permission up front so headless Chromium doesn't silently swallow
    // it as a permission failure.
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await signInAsOwner(page);
    await page.goto("/admin/settings");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("1. the page shows the four sections and the Connections list", async () => {
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    for (const name of ["Store", "Pickup", "Shipping", "Connections", "Policies"]) {
      await expect(page.getByRole("heading", { name, level: 2, exact: true })).toBeVisible();
    }
    await expect(page.locator(".adm-conn-item")).toHaveCount(5);

    originalSupportEmail = await page.getByLabel("Support email", { exact: true }).inputValue();
    expect(originalSupportEmail).toBeTruthy();
  });

  test("2. editing Store name shows the Save bar; Discard hides it and restores the value", async () => {
    const storeName = page.getByLabel("Store name", { exact: true });
    const original = await storeName.inputValue();

    await storeName.fill(`${original} A`);
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeHidden();
    await expect(storeName).toHaveValue(original);
  });

  test("3. editing Store name + Free over and saving shows a toast and survives reload", async () => {
    const storeName = page.getByLabel("Store name", { exact: true });
    const original = await storeName.inputValue();
    const newName = `${original} B`;

    await storeName.fill(newName);
    await page.getByLabel("Free over $ (optional)", { exact: true }).fill("75");
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Settings saved", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Store name", { exact: true })).toHaveValue(newName);
    await expect(page.getByLabel("Free over $ (optional)", { exact: true })).toHaveValue("75.00");
  });

  test("4. an invalid support email shows an inline error and keeps the typed store name; fixing it saves", async () => {
    const storeName = page.getByLabel("Store name", { exact: true });
    const original = await storeName.inputValue();
    const newName = `${original} C`;

    await storeName.fill(newName);
    const supportEmail = page.getByLabel("Support email", { exact: true });
    await supportEmail.fill("foo@bar");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("Enter a valid email address.", { exact: true })).toBeVisible();
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
    await expect(storeName).toHaveValue(newName);

    await supportEmail.fill(originalSupportEmail);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Settings saved", { exact: true })).toBeVisible();
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeHidden();
  });

  test("5. turning pickup off dims the address field and persists after Save", async () => {
    const pickup = page.getByLabel("Offer pickup at checkout", { exact: true });
    // `opacity` isn't an inherited CSS property — the dimming rule
    // (`.adm-settings-section:has(#pickupEnabled:not(:checked))
    // .adm-pickup-address`) sets it on the field's wrapper, not the
    // textarea itself, so that's the element to assert on rather than the
    // textarea (whose own computed opacity is always "1").
    const addressField = page.locator(".adm-pickup-address");

    await expect(pickup).toBeChecked();
    await pickup.uncheck();
    await expect(addressField).toHaveCSS("opacity", "0.45");

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Settings saved", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Offer pickup at checkout", { exact: true })).not.toBeChecked();
    await expect(page.locator(".adm-pickup-address")).toHaveCSS("opacity", "0.45");
  });

  test("6. Copy copies the webhook URL and shows a Copied toast", async () => {
    const webhookUrl = await page.getByLabel("Stripe webhook URL", { exact: true }).inputValue();
    expect(webhookUrl).toContain("/api/stripe/webhook");

    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.getByText("Copied", { exact: true })).toBeVisible();
  });

  test("7. Control+S submits the form", async () => {
    const storeName = page.getByLabel("Store name", { exact: true });
    const original = await storeName.inputValue();
    await storeName.fill(`${original} D`);
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();

    await page.keyboard.press("Control+s");
    await expect(page.getByText("Settings saved", { exact: true })).toBeVisible();
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeHidden();
  });

  test("8. phone 390px renders without horizontal overflow and the Save bar spans the width", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth === document.documentElement.clientWidth,
      ),
    ).toBe(true);

    const storeName = page.getByLabel("Store name", { exact: true });
    const original = await storeName.inputValue();
    await storeName.fill(`${original} E`);
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();

    const box = await page.locator(".adm-savebar").boundingBox();
    expect(box?.width).toBeGreaterThan(370);

    await page.setViewportSize({ width: 1280, height: 800 });
  });
});
