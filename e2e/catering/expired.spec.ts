import { test, expect } from "@playwright/test";
import { enableCateringOrdering, quickOrder, mutateOrder } from "./helpers";

/**
 * Flow 12: a request past its respond-by shows expired when opened. Real
 * life reaches this only after the owner sits on a request for
 * `replyHours` (24h by default) — the customer UI has no way to fast-
 * forward that, so this moves `respondBy` into the past with
 * `db-mutate.mjs` and relies on `getOrderView`'s own lazy expiry check
 * (`src/lib/catering/service.ts`) to flip the order the moment its link is
 * opened. Issue #190.
 */
test.describe("flow 12: expired request", () => {
  test("a request past its respond-by shows expired when the link is opened", async ({ page }) => {
    await enableCateringOrdering(page);
    const { token, number } = await quickOrder(page, {
      name: "Expired Order",
      email: "expired.order@example.com",
      phone: "(818) 555-0501",
    });

    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    mutateOrder("set-respond-by", number, anHourAgo);

    await page.goto(`/catering/o/${token}/`);
    await expect(page.locator(".cor-status-pill")).toHaveText("Expired");
    await expect(page.getByText(/didn’t confirm in time/)).toBeVisible();
  });
});
