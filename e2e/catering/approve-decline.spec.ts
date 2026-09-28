import { test, expect, type Page } from "@playwright/test";
import { signInAsOwner } from "../helpers";
import { enableCateringOrdering, quickOrder } from "./helpers";

/**
 * Flows 6 and 7: the owner approves a request (customer link shows booked;
 * invoice has numbered lines, names and totals) or declines with a reason
 * (customer link shows declined with that reason). Issue #190.
 */
test.describe.serial("flows 6 & 7: admin approve and decline", () => {
  let customerPage: Page;
  let adminPage: Page;
  let approveToken: string;
  let approveNumber: string;
  let declineToken: string;
  let declineNumber: string;

  test.beforeAll(async ({ browser }) => {
    customerPage = await browser.newPage();
    await enableCateringOrdering(customerPage);

    const approve = await quickOrder(customerPage, {
      name: "Approve Me",
      email: "approve.me@example.com",
      phone: "(818) 555-0111",
    });
    approveToken = approve.token;
    approveNumber = approve.number;

    const decline = await quickOrder(customerPage, {
      name: "Decline Me",
      email: "decline.me@example.com",
      phone: "(818) 555-0122",
    });
    declineToken = decline.token;
    declineNumber = decline.number;

    adminPage = await browser.newPage();
    await signInAsOwner(adminPage);
  });

  test.afterAll(async () => {
    await customerPage.close();
    await adminPage.close();
  });

  test("1. approve: charges and books the order", async () => {
    await adminPage.goto("/admin/catering");
    await adminPage.getByLabel("Search catering orders").fill(approveNumber);
    await adminPage.locator(".cat-row", { hasText: approveNumber }).click();
    await expect(adminPage.getByRole("heading", { name: approveNumber, level: 1 })).toBeVisible();

    await adminPage.getByRole("button", { name: /^Approve & charge/ }).click();
    await expect(adminPage.locator(".rack-page-header .adm-pill")).toHaveText("BOOKED");
    await expect(adminPage.getByText("Approved · charged")).toBeVisible();
  });

  test("2. the customer link shows booked", async () => {
    await customerPage.goto(`/catering/o/${approveToken}/`);
    await expect(customerPage.locator(".cor-status-pill")).toHaveText("Booked");
    await expect(customerPage.getByText(/^Charged/)).toBeVisible();
  });

  test("3. the invoice shows numbered lines, names and totals", async () => {
    await customerPage.goto(`/catering/o/${approveToken}/invoice/`);
    await expect(customerPage.locator(".cinv-badge")).toHaveText("Paid in full");
    const firstRow = customerPage.locator(".cinv-table tbody tr").first();
    await expect(firstRow.locator("td").first()).toHaveText("1");
    await expect(firstRow).toContainText("2 Sliders and Fries");
    await expect(firstRow).toContainText("Group");
    await expect(customerPage.locator(".cinv-total").last()).toContainText("Balance due");
  });

  test("4. decline: releases the hold and records a reason", async () => {
    await adminPage.goto("/admin/catering");
    await adminPage.getByLabel("Search catering orders").fill(declineNumber);
    await adminPage.locator(".cat-row", { hasText: declineNumber }).click();

    await adminPage.getByRole("button", { name: "Decline" }).click();
    await adminPage
      .getByRole("textbox", { name: /message to the customer/i })
      .fill("We're fully booked that day.");
    await adminPage.getByRole("button", { name: /decline & release the hold/i }).click();

    await expect(adminPage.locator(".rack-page-header .adm-pill")).toHaveText("DECLINED");
  });

  test("5. the customer link shows declined with the reason", async () => {
    await customerPage.goto(`/catering/o/${declineToken}/`);
    await expect(customerPage.locator(".cor-status-pill")).toHaveText("We couldn't take this one");
    await expect(customerPage.getByText("We're fully booked that day.")).toBeVisible();
  });
});
