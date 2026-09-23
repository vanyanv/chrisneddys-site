import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./helpers";

/**
 * The product sheet on a phone used to sit on top of the Save bar (z-index
 * 56 over 55), so an edit made there could never be saved: the bar showed
 * "1 change" underneath, out of reach, while the field and the run header
 * already read the new value. That is how an edition size set to 20 on a
 * phone left the shop still reading "50 of 50". A real click (not a forced
 * one) is the point here — Playwright refuses to click a button another
 * element covers.
 */
const FOAM_TRUCKER_SLUG = "foam-trucker-blue";

test.use({ viewport: { width: 402, height: 874 }, hasTouch: true, isMobile: true });

test("an edit made in the phone product sheet can be saved and reaches the shop", async ({
  page,
}) => {
  await signInAsOwner(page);

  await page.locator(`[data-testid="product-card"][data-slug="${FOAM_TRUCKER_SLUG}"]`).click();
  const sheet = page.locator(".adm-mobile-sheet.is-open");
  await expect(sheet.getByTestId("row-menu-trigger")).toBeVisible();

  const price = sheet.getByLabel("Price", { exact: true });
  await price.fill("47");
  await price.press("Tab");

  await page.getByRole("button", { name: "Save", exact: true }).click({ timeout: 5_000 });
  await expect(page.getByRole("status")).toContainText("Saved");

  await expect
    .poll(async () => (await page.request.get(`/shop/${FOAM_TRUCKER_SLUG}/`)).text(), {
      timeout: 10_000,
    })
    .toContain("$47.00");

  // Put the seed price back: `admin-sheet.spec.ts` runs after this file and
  // expects the catalogue's $48.00.
  await price.fill("48");
  await price.press("Tab");
  await page.getByRole("button", { name: "Save", exact: true }).click({ timeout: 5_000 });
  await expect(page.getByRole("status")).toContainText("Saved");
});
