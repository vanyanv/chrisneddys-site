import { test, expect } from "@playwright/test";
import { startOrder, choosePickup } from "./helpers";

/**
 * Flow 5: leaving mid-order. The header's ✕ opens a confirm modal;
 * "Keep ordering" stays on the same step with the draft intact, "Leave"
 * goes back to the order page's landing. Issue #190.
 */
test.describe("flow 5: leave modal mid-order", () => {
  test("keep ordering closes the modal and keeps the draft; leave exits to the landing", async ({
    page,
  }) => {
    await startOrder(page);
    await choosePickup(page, "Hollywood");

    await page.getByRole("button", { name: "Leave order" }).click();
    const modal = page.getByRole("dialog", { name: "Leave your order?" });
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/saved on this phone/)).toBeVisible();

    await modal.getByRole("button", { name: "Keep ordering" }).click();
    await expect(modal).toBeHidden();
    await expect(page).toHaveURL(/step=where/);
    await expect(page.locator(".cor-choice.is-selected", { hasText: "Pickup" })).toBeVisible();

    await page.getByRole("button", { name: "Leave order" }).click();
    await page
      .getByRole("dialog", { name: "Leave your order?" })
      .getByRole("button", { name: "Leave" })
      .click();
    await expect(page).toHaveURL(/\/catering\/order\/?$/);
    await expect(page.getByRole("button", { name: /start a catering order/i })).toBeVisible();
  });
});
