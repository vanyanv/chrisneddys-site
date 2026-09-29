import { test, expect } from "@playwright/test";
import { readCateringFixtures } from "./helpers";

/**
 * Flow 12: a request past its respond-by shows expired when opened. Real
 * life reaches this only after the owner sits on a request for
 * `replyHours` (24h by default) — the customer UI has no way to fast-
 * forward that, so `e2e/seed-catering-fixtures.mjs` seeds an order whose
 * `respondBy` is already in the past directly into the database before the
 * e2e server starts, and this relies on `getOrderView`'s own lazy expiry
 * check (`src/lib/catering/service.ts`) to flip the order the moment its
 * link is opened. Issue #190.
 */
test.describe("flow 12: expired request", () => {
  test("a request past its respond-by shows expired when the link is opened", async ({ page }) => {
    const { token } = readCateringFixtures().expired;

    await page.goto(`/catering/o/${token}/`);
    await expect(page.locator(".cor-status-pill")).toHaveText("Expired");
    await expect(page.getByText(/didn’t confirm in time/)).toBeVisible();
  });
});
