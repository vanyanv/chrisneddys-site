import { test, expect, type Page } from "@playwright/test";
import { quickOrder, readHalfRefundFixture } from "./helpers";

/**
 * Flow 8: cancellation tiers from the customer's own order link — free
 * 48h+ out, half back 24-48h out, nothing inside 24h. The free tier is a
 * `requested` order whose event is far out (`quickOrder` already books
 * 5+ days out); the half tier needs a `booked` order 30h out, which the
 * builder itself can never produce (it only ever offers >=48h-out slots),
 * so `e2e/seed-catering-fixtures.mjs` seeds one already `booked` and 30h
 * out directly into the database before the e2e server starts (see that
 * script's module comment for why this moved out of a live admin approval
 * + a `db-mutate.mjs` timestamp edit — the latter fights the running
 * server for the same PGlite data directory). Issue #190.
 */
test.describe.serial("flow 8: cancellation tiers", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("1. free tier: a requested order far out cancels for a full refund", async () => {
    const { token, number } = await quickOrder(page, {
      name: "Free Tier",
      email: "free.tier@example.com",
      phone: "(818) 555-0201",
    });

    await page.goto(`/catering/o/${token}/cancel/`);
    await expect(page.getByRole("heading", { name: /You get all/ })).toBeVisible();
    await expect(page.locator(".cor-tier-strip span.is-current")).toHaveText(/All back/);

    await page.getByRole("button", { name: "Cancel my order" }).click();
    await expect(page.getByRole("heading", { name: "Cancelled." })).toBeVisible();
    await expect(page.getByText(/Your refund of \$/)).toBeVisible();

    await page.goto(`/catering/o/${token}/`);
    await expect(page.locator(".cor-status-pill")).toHaveText("Cancelled");
    void number;
  });

  test("2. half tier: a booked order 30h out cancels for half back", async ({}, testInfo) => {
    const { token } = readHalfRefundFixture(testInfo.project.name);

    await page.goto(`/catering/o/${token}/cancel/`);
    await expect(page.getByRole("heading", { name: /You get \$/ })).toBeVisible();
    await expect(page.locator(".cor-tier-strip span.is-current")).toHaveText(/Half back/);

    const heading = await page.getByRole("heading", { name: /You get \$/ }).innerText();
    const expectedRefund = heading.match(/\$[\d,.]+/)?.[0];
    expect(expectedRefund).toBeTruthy();

    await page.getByRole("button", { name: "Cancel my order" }).click();
    await expect(page.getByText(`Your refund of ${expectedRefund} is on its way.`)).toBeVisible();

    await page.goto(`/catering/o/${token}/`);
    await expect(page.locator(".cor-status-pill")).toHaveText("Cancelled");
  });
});
