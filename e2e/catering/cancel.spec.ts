import { test, expect, type Page } from "@playwright/test";
import { signInAsOwner } from "../helpers";
import { enableCateringOrdering, quickOrder, mutateOrder } from "./helpers";

/**
 * Flow 8: cancellation tiers from the customer's own order link — free
 * 48h+ out, half back 24-48h out, nothing inside 24h. The free tier is a
 * `requested` order whose event is far out (`quickOrder` already books
 * 5+ days out); the half tier needs a `booked` order 30h out, which the
 * builder itself can never produce (it only ever offers >=48h-out slots),
 * so this moves that order's `eventAt` back with `db-mutate.mjs` after
 * approving it. Issue #190.
 */
test.describe.serial("flow 8: cancellation tiers", () => {
  let page: Page;
  let adminPage: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await enableCateringOrdering(page);
    adminPage = await browser.newPage();
    await signInAsOwner(adminPage);
  });

  test.afterAll(async () => {
    await page.close();
    await adminPage.close();
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

  test("2. half tier: a booked order 30h out cancels for half back", async () => {
    const { token, number } = await quickOrder(page, {
      name: "Half Tier",
      email: "half.tier@example.com",
      phone: "(818) 555-0202",
    });

    // Approve it (requested -> booked, card captured), then move its event
    // 30 hours out — inside the 24-48h half-refund window.
    await adminPage.goto("/admin/catering");
    await adminPage.getByLabel("Search catering orders").fill(number);
    await adminPage.locator(".cat-row", { hasText: number }).click();
    await adminPage.getByRole("button", { name: /^Approve & charge/ }).click();
    await expect(adminPage.locator(".rack-page-header .adm-pill")).toHaveText("BOOKED");

    const in30h = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();
    mutateOrder("set-event-at", number, in30h);

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
