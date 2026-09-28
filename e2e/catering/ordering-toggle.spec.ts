import { test, expect } from "@playwright/test";
import { disableCateringOrdering, enableCateringOrdering } from "./helpers";

/**
 * Flow 0: catering ordering ships off. `/catering/order/` shows the
 * ask-about-catering card linking to `/contact/` while it's off; the owner
 * turns it on from Admin -> Settings -> Catering and every catering button
 * then goes to the real order builder instead. Runs at both the phone and
 * desktop projects (`playwright.config.ts`), so the phone assertion below
 * also proves the settings save bar is reachable on a 390px viewport.
 *
 * Every catering spec shares the same PGlite database (see
 * `playwright.config.ts`) and Playwright doesn't guarantee file run order
 * across the suite, so test 1 can't assume ordering starts off just because
 * this is "flow 0" — another spec file's `enableCateringOrdering` may have
 * already turned it on. It explicitly turns ordering off first.
 */
test.describe.serial("flow 0: catering ordering on/off", () => {
  test("1. off: /catering/order/ shows the ask-about-catering card linking to /contact/", async ({
    page,
  }) => {
    await disableCateringOrdering(page);
    await page.goto("/catering/order/");
    await expect(page.getByRole("heading", { name: "Catering", level: 1 })).toBeVisible();
    await expect(page.getByText("Online ordering isn't open yet.", { exact: false })).toBeVisible();
    const cta = page.getByRole("link", { name: /ask about catering/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/contact/");
  });

  test("2. the owner turns ordering on in Admin -> Settings -> Catering and saves", async ({
    page,
  }) => {
    await enableCateringOrdering(page);
    // Reload settings to prove the save actually persisted, not just local
    // component state.
    await page.reload();
    await expect(page.locator("#orderingOn")).toBeChecked();
  });

  test("3. on: /catering/order/ now shows the real landing screen", async ({ page }) => {
    await page.goto("/catering/order/");
    await expect(page.getByRole("button", { name: /start a catering order/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /sliders for/i })).toBeVisible();
  });
});
