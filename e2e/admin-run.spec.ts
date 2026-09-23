import { test, expect, type Locator, type Page } from "@playwright/test";
import { signInAsOwner } from "./helpers";

/**
 * Covers issue #36 phase 3's two run screens end to end:
 *
 *  - "Starting a run" — the edition-size field in `/admin/products`' panel
 *    locks the instant anything in the run has sold, and stays fully
 *    editable on a run that hasn't sold a single number yet.
 *  - "All fifty numbers" (`/admin/products/[id]/run`) — the board renders
 *    real sold/held/available numbers, a sold cell links through to its
 *    real order, and the held list shows what's actually mid-checkout.
 *
 * `e2e/db-warmup.mjs` seeds foam-trucker-blue (a 50-number edition) with
 * four paid orders (5 units sold across them) and one still-pending,
 * never-paid cart (1 unit held) before the server starts — this file reads
 * that real, already-locked run rather than trying to sell anything itself
 * (Stripe is disabled entirely in this harness, see `playwright.config.ts`).
 */

const FOAM_TRUCKER_SLUG = "foam-trucker-blue";

function cardBySlug(page: Page, slug: string): Locator {
  return page.locator(`[data-testid="product-card"][data-slug="${slug}"]`);
}

function panel(page: Page): Locator {
  return page.getByTestId("product-panel");
}

async function openCard(page: Page, card: Locator): Promise<void> {
  const alreadyOpen = (await card.getAttribute("class"))?.includes("is-open");
  if (!alreadyOpen) await card.click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByTestId("row-menu-trigger")).toBeVisible();
}

test.describe.serial("the run (issue #36 phase 3)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await signInAsOwner(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("1. a run with a sold number locks the edition-size field", async () => {
    await page.goto("/admin/products/");
    await openCard(page, cardBySlug(page, FOAM_TRUCKER_SLUG));

    // "The run" (and its edition-size field) renders directly in the panel,
    // outside the "More details" accordion — no need to expand anything.
    const sizeInput = panel(page).getByLabel("Edition size", { exact: true });
    await expect(sizeInput).toBeDisabled();
    await expect(panel(page).getByText(/locks the moment number one sells/i)).toBeVisible();
  });

  test("2. a run with nothing sold yet stays fully editable", async () => {
    await page.goto("/admin/products/");
    await page.getByRole("button", { name: "New product", exact: true }).click();
    await expect(panel(page)).toBeVisible();

    await panel(page).locator("summary", { hasText: "More details" }).click();
    await panel(page).getByRole("button", { name: "Numbered edition", exact: true }).click();

    const sizeInput = panel(page).getByLabel("Edition size", { exact: true });
    await expect(sizeInput).toBeEnabled();
    await expect(panel(page).getByText(/locks the moment number one sells/i)).toHaveCount(0);

    await sizeInput.fill("20");
    await sizeInput.press("Tab");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved");
    await expect(sizeInput).toHaveValue("20");

    // Archive this scratch draft rather than leaving it around: the rack's
    // "N products" count (asserted verbatim by `admin-sheet.spec.ts`'s first
    // spec) only excludes archived rows, and this file's tests share the
    // one database the whole e2e run boots once.
    await panel(page).getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Archived");
  });

  test("3. the run board renders the real sold/held/available split", async () => {
    await page.goto("/admin/products/");
    await openCard(page, cardBySlug(page, FOAM_TRUCKER_SLUG));

    await page.getByRole("link", { name: "Open the run" }).click();
    await expect(page).toHaveURL(/\/admin\/products\/.+\/run\/?$/);

    await expect(page.getByText("5 sold", { exact: true })).toBeVisible();
    await expect(page.getByText("1 held in a checkout", { exact: true })).toBeVisible();
    await expect(page.getByText("44 for sale online", { exact: true })).toBeVisible();

    // Numbers 1-5 were claimed lowest-first by the four seeded paid orders
    // (2 + 1 + 1 + 1 units) — #1 is real, sold data, not a placeholder.
    await expect(page.getByTestId("run-cell-1")).toHaveClass(/is-sold/);
    await expect(page.getByTestId("run-cell-50")).toHaveClass(/is-available/);

    // Exactly one number is genuinely held right now.
    await expect(page.locator(".run-held-row")).toHaveCount(1);
  });

  test("4. clicking a sold number opens its real order", async () => {
    await page.getByTestId("run-cell-1").click();
    const openOrderLink = page.getByRole("link", { name: "Open the order" });
    await expect(openOrderLink).toBeVisible();

    await openOrderLink.click();
    await expect(page).toHaveURL(/\/admin\/orders\/[^/]+\/?$/);
    // The order detail page rendered a real order, not a 404 — its number
    // heading is present.
    await expect(page.locator(".rack-page-title")).toBeVisible();
  });

  test("5. setting a number aside takes it off the shop, and putting it back returns it", async () => {
    const shopLine = async () =>
      (await (await page.request.get(`/shop/${FOAM_TRUCKER_SLUG}/`)).text()).match(
        /\d+ OF 50 LEFT/,
      )?.[0];

    await page.goBack();
    await expect(page).toHaveURL(/\/run\/?$/);
    await page.getByTestId("run-cell-50").click();
    await page.getByRole("button", { name: "Set aside", exact: true }).click();
    await expect(page.getByTestId("run-cell-50")).toHaveClass(/is-aside/);
    await expect(page.getByText("1 set aside", { exact: true })).toBeVisible();
    await expect.poll(shopLine, { timeout: 10_000 }).toBe("43 OF 50 LEFT");

    await page.getByRole("button", { name: "Put back on sale online" }).click();
    await expect(page.getByTestId("run-cell-50")).toHaveClass(/is-available/);
    await expect.poll(shopLine, { timeout: 10_000 }).toBe("44 OF 50 LEFT");
  });
});
