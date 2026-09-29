import { test, expect, type Page } from "@playwright/test";
import { signInAsOwner } from "../helpers";
import { quickOrder, openOrderSheet } from "./helpers";

/**
 * Flow 9: the customer changes their qty from the order link; the owner
 * sees the pending change on the order page and approves it; the order's
 * total updates to the new one. Issue #190.
 */
test.describe.serial("flow 9: customer change, owner approval", () => {
  let page: Page;
  let adminPage: Page;
  let token: string;
  let number: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    const order = await quickOrder(page, {
      name: "Change Order",
      email: "change.order@example.com",
      phone: "(818) 555-0301",
    });
    token = order.token;
    number = order.number;

    adminPage = await browser.newPage();
    await signInAsOwner(adminPage);
  });

  test.afterAll(async () => {
    await page.close();
    await adminPage.close();
  });

  test("1. the customer changes qty and sends the change", async () => {
    await page.goto(`/catering/o/${token}/`);
    const originalTotal = await page.locator(".cor-review-total span").last().innerText();

    await page.getByRole("link", { name: "Change order" }).click();
    await expect(page.getByRole("heading", { name: "Change your order" })).toBeVisible();

    await openOrderSheet(page);
    const sheet = page.getByRole("dialog", { name: "Your order" });
    await sheet.locator(".cor-line").first().getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Quantity").fill("4");
    await page.getByRole("button", { name: /^Save/ }).click();

    await page.getByRole("button", { name: "Review change" }).click();
    await expect(page.getByRole("heading", { name: "What’s changing?" })).toBeVisible();
    await page.getByRole("button", { name: "Send change" }).click();

    await expect(page.getByRole("heading", { name: "Change sent." })).toBeVisible();
    void originalTotal;
  });

  test("2. the owner sees the pending change", async () => {
    await adminPage.goto("/admin/catering");
    await adminPage.getByLabel("Search catering orders").fill(number);
    await adminPage.locator(".cat-row", { hasText: number }).click();

    await expect(adminPage.getByText("Pending change")).toBeVisible();
    await expect(adminPage.locator(".rack-page-header .adm-pill")).toHaveText("CHANGE");
  });

  test("3. approving the change updates the order's total", async () => {
    const beforeTotal = await adminPage.locator(".ord-total-row .adm-money").innerText();

    await adminPage.getByRole("button", { name: "Approve change" }).click();
    await expect(adminPage.getByText("Pending change")).toHaveCount(0);
    await expect(adminPage.locator(".rack-page-header .adm-pill")).toHaveText("NEW");

    const afterTotal = await adminPage.locator(".ord-total-row .adm-money").innerText();
    expect(afterTotal).not.toBe(beforeTotal);

    await page.goto(`/catering/o/${token}/`);
    await expect(page.locator(".cor-review-total").locator("span").last()).toHaveText(afterTotal);
  });
});
