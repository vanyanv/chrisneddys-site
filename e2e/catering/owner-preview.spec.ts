import { test, expect } from "@playwright/test";
import {
  disableCateringOrdering,
  enableCateringOrdering,
  orderNumberFromSentPage,
  quickOrder,
} from "./helpers";

/**
 * Owner preview (issue #190): with ordering off, anonymous visitors still get
 * the "ask about catering" card, while a signed-in owner sees the real
 * builder under a banner and can place a (fake-payments) order.
 *
 * Turns ordering off, so it always turns it back on afterwards: every other
 * catering spec assumes it is on.
 */
test.describe.serial("owner preview while ordering is off", () => {
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await enableCateringOrdering(page);
    await context.close();
  });

  test("1. off: an anonymous visitor sees the ask card and no banner", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    await disableCateringOrdering(await ownerContext.newPage());
    await ownerContext.close();

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/catering/order/");
    await expect(page.getByText(/online ordering isn.t open yet\./i)).toBeVisible();
    await expect(page.getByRole("link", { name: /ask about catering/i })).toHaveAttribute(
      "href",
      "/contact/",
    );
    await expect(page.locator("[data-catering-owner-preview]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /start a catering order/i })).toHaveCount(0);

    const res = await page.request.post("/api/catering/checkout", { data: {} });
    expect(res.status()).toBe(503);
    await context.close();
  });

  test("2. off: a signed-in owner sees the banner and can place an order", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await disableCateringOrdering(page); // signs in as the owner; already off

    await page.goto("/catering/order/");
    await expect(
      page.getByText("Owner preview: catering is off, so only signed-in owners see this page."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /start a catering order/i })).toBeVisible();

    const { token } = await quickOrder(page, {
      name: "Owen Owner",
      email: "owner-preview@example.com",
      phone: "555-0142",
    });
    expect(await orderNumberFromSentPage(page)).toMatch(/^CAT-\d+/);

    // The order link keeps working while ordering is off.
    await page.goto(`/catering/o/${token}/`);
    await expect(page.getByText(/CAT-\d+/).first()).toBeVisible();
    await context.close();
  });
});
