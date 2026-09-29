import { test, expect } from "@playwright/test";
import { quickOrder } from "./helpers";

/**
 * Flow 10: "Find my orders" always answers "sent" — whether or not the
 * email has any orders is never observable (`findMyOrders` in
 * `src/lib/catering/service.ts`). Issue #190.
 */
test.describe("flow 10: find my orders always says sent", () => {
  test("an email with no orders still gets the same sent confirmation", async ({ page }) => {
    await page.goto("/catering/find/");
    await expect(page.getByRole("heading", { name: "Find my orders" })).toBeVisible();

    await page.getByLabel("Email").fill("nobody-has-ever-ordered@example.com");
    await page.getByRole("button", { name: "Email my links" }).click();

    await expect(page.getByText(/Sent\. If that email has orders/)).toBeVisible();
  });

  test("an email with a real order gets the identical sent confirmation", async ({ page }) => {
    await quickOrder(page, {
      name: "Find Me",
      email: "find.me@example.com",
      phone: "(818) 555-0401",
    });

    await page.goto("/catering/find/");
    await page.getByLabel("Email").fill("find.me@example.com");
    await page.getByRole("button", { name: "Email my links" }).click();
    await expect(page.getByText(/Sent\. If that email has orders/)).toBeVisible();
  });
});
