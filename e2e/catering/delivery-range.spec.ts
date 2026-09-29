import { test, expect, type Page } from "@playwright/test";
import {
  startOrder,
  chooseDelivery,
  selectCalendarDate,
  selectFirstSlot,
  openItemByName,
  pickWay,
  addItem,
  closeItemSheet,
  fillContactDetails,
  submitAndGetToken,
  VAN_NUYS_NEAR_ZIP,
  FAR_ZIP,
} from "./helpers";

/**
 * Flow 2: delivery from Van Nuys. An in-range ZIP shows the "about X mi"
 * note and lets the customer continue; a far ZIP blocks continue with a
 * "too far" message. Then a second visit, after a completed order, prefills
 * the returning customer's contact and address (`saveReturningContact` in
 * `src/components/catering-order/draft.ts`). Issue #190.
 */
test.describe.serial("flow 2: delivery range (Van Nuys) and returning-customer prefill", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('1. an in-range ZIP shows "about X mi" and Continue is enabled', async () => {
    await startOrder(page);
    await chooseDelivery(page, "Van Nuys", {
      line1: "7120 Hayvenhurst Ave",
      city: "Van Nuys",
      zip: VAN_NUYS_NEAR_ZIP,
    });
    await expect(page.getByText(/miles from Van Nuys\. Delivery is \$25\./)).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("2. a far ZIP shows too far and blocks continue", async () => {
    await page.locator('input[autocomplete="postal-code"]').fill(FAR_ZIP);
    await expect(page.getByText(/outside our 10 mile range/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Message us" })).toHaveAttribute(
      "href",
      "/contact/",
    );
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  test("3. switching back to the in-range ZIP unblocks continue; complete the order", async () => {
    await page.locator('input[autocomplete="postal-code"]').fill(VAN_NUYS_NEAR_ZIP);
    await expect(page.getByText(/miles from Van Nuys\. Delivery is \$25\./)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=when/);

    await selectCalendarDate(page, 5);
    await selectFirstSlot(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=food/);

    await openItemByName(page, "2 Sliders and Fries");
    await pickWay(page, "chris");
    await addItem(page);
    await closeItemSheet(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=details/);

    await fillContactDetails(page, {
      name: "Maya Torres",
      email: "maya.returning@example.com",
      phone: "(818) 555-0142",
    });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=review/);
    await submitAndGetToken(page);
    await expect(page.getByRole("heading", { name: "Request sent." })).toBeVisible();
  });

  test("4. a second order prefills the returning customer's contact and address", async () => {
    await startOrder(page);
    await expect(page).toHaveURL(/step=where/);
    // The where step only shows the address form once delivery + a store are
    // picked; prefill is on `start()` (from `loadReturningContact`), so pick
    // delivery/Van Nuys again and check the address field is already filled.
    await page.getByRole("button", { name: "Delivery" }).click();
    await page.locator(".cor-store", { hasText: "Van Nuys" }).click();
    await expect(page.getByPlaceholder("Street address")).toHaveValue("7120 Hayvenhurst Ave");
    await expect(page.locator('input[autocomplete="postal-code"]')).toHaveValue(VAN_NUYS_NEAR_ZIP);

    await page.getByRole("button", { name: "Continue" }).click();
    await selectCalendarDate(page, 5);
    await selectFirstSlot(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await openItemByName(page, "2 Sliders and Fries");
    await pickWay(page, "eddy");
    await addItem(page);
    await closeItemSheet(page);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(page.getByLabel("Your name")).toHaveValue("Maya Torres");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
      "maya.returning@example.com",
    );
    await expect(page.getByLabel("Mobile", { exact: true })).toHaveValue("(818) 555-0142");
  });
});
