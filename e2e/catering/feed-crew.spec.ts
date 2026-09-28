import { test, expect, type Page } from "@playwright/test";
import {
  startOrder,
  choosePickup,
  setHeadcount,
  selectCalendarDate,
  selectFirstSlot,
  openOrderSheet,
} from "./helpers";

/**
 * Flow 4: "Feed my crew" suggests a cart sized to the headcount, and the
 * result stays a normal, editable cart afterwards. Issue #190.
 */
test.describe.serial("flow 4: feed my crew", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await startOrder(page);
    await choosePickup(page, "Hollywood");
    await page.getByRole("button", { name: "Continue" }).click();
    await setHeadcount(page, 20);
    await selectCalendarDate(page, 5);
    await selectFirstSlot(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=food/);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("1. suggests a cart sized to the headcount", async () => {
    await page.getByRole("button", { name: /feed my crew/i }).click();
    const sheet = page.getByRole("dialog", { name: "Feed my crew" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("For 20 people.")).toBeVisible();

    // "Classic" (2 Sliders and Fries each) is selected by default.
    await expect(sheet.locator(".cor-choice.is-selected", { hasText: "Classic" })).toBeVisible();

    await sheet.getByRole("button", { name: /^Fill my order/ }).click();
    await expect(sheet).toBeHidden();

    await openOrderSheet(page);
    const orderSheet = page.getByRole("dialog", { name: "Your order" });
    // "Fill my order" also adds a shakes line by default (see
    // c7-feed-my-crew-sheet.png: "Add shakes" starts pre-filled, not 0,
    // and the total shown includes them) — scope to the food line so this
    // doesn't assume it's the only `.cor-line` in the sheet.
    await expect(
      orderSheet.locator(".cor-line", { hasText: "2 Sliders and Fries" }).locator(".cor-line-qty"),
    ).toHaveText("20");
    await expect(orderSheet.getByText("2 Sliders and Fries")).toBeVisible();
    await orderSheet.getByRole("button", { name: "Done" }).click();
  });

  test("2. the suggested cart is still editable afterwards", async () => {
    await openOrderSheet(page);
    const orderSheet = page.getByRole("dialog", { name: "Your order" });
    await orderSheet.locator(".cor-line").first().getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("dialog", { name: "2 Sliders and Fries" })).toBeVisible();
    await page.getByLabel("Quantity").fill("25");
    await page.getByRole("button", { name: /^Save/ }).click();

    await openOrderSheet(page);
    // Scoped to the food line, same reasoning as test 1: the shakes line
    // from "Fill my order" is still in the cart alongside it.
    await expect(
      page
        .getByRole("dialog", { name: "Your order" })
        .locator(".cor-line", { hasText: "2 Sliders and Fries" })
        .locator(".cor-line-qty"),
    ).toHaveText("25");
    await page
      .getByRole("dialog", { name: "Your order" })
      .getByRole("button", { name: "Done" })
      .click();
  });
});
