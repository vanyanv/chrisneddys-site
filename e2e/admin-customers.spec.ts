import { test, expect, type Locator, type Page } from "@playwright/test";
import { signInAsOwner } from "./helpers";

/**
 * Covers issue #36 phase 7 ("Customers") end to end: the list at
 * `/admin/customers` and the detail page at `/admin/customers/[email]`.
 *
 * `e2e/db-warmup.mjs` seeds four *paid* orders against foam-trucker-blue —
 * one of each status/fulfilment combination — plus a fifth left `pending`
 * and never paid (a guest mid-checkout, so its `email`/`name` stay null):
 *
 *   - "Jordan Ship"   buyer.ship@example.com     2 units -> editions #1, #2
 *   - "Casey Pickup"  buyer.pickup@example.com   1 unit  -> edition #3
 *   - "Riley Shipped" buyer.shipped@example.com  1 unit  -> edition #4
 *   - "Morgan Ready"  buyer.ready@example.com    1 unit  -> edition #5
 *
 * This file is deliberately read-only (no mark-shipped/refund/etc. — those
 * live in `admin-orders.spec.ts`) and runs alphabetically before every
 * other admin spec, so it sees that seed exactly as `db-warmup.mjs` left
 * it: four customers, one order each, nothing refunded yet. It never
 * mutates order data, so it can't affect what any later spec file sees.
 */

const CUSTOMERS = {
  ship: { email: "buyer.ship@example.com", name: "Jordan Ship", totalLabel: "$106.50" },
  pickup: { email: "buyer.pickup@example.com", name: "Casey Pickup", totalLabel: "$50.20" },
  shipped: { email: "buyer.shipped@example.com", name: "Riley Shipped", totalLabel: "$56.20" },
  ready: { email: "buyer.ready@example.com", name: "Morgan Ready", totalLabel: "$50.20" },
} as const;

function rowByEmail(page: Page, email: string): Locator {
  return page.locator("a.cust-row").filter({ hasText: email });
}

function statValue(page: Page, label: string): Locator {
  return page.locator(".rack-stat-card", { hasText: label }).locator(".rack-stat-value");
}

test.describe.serial("admin customers (issue #36 phase 7)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await signInAsOwner(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("1. the nav links to Customers from another admin screen", async () => {
    await page.goto("/admin/orders");
    await page.getByRole("link", { name: "Customers", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/customers\/?$/);
    await expect(page.getByRole("heading", { name: "Customers", level: 1 })).toBeVisible();
  });

  test("2. the list shows exactly the four paid buyers, and no guest", async () => {
    await page.goto("/admin/customers");
    await expect(page.getByText("4 customers", { exact: true })).toBeVisible();

    for (const customer of Object.values(CUSTOMERS)) {
      const row = rowByEmail(page, customer.email);
      await expect(row).toBeVisible();
      await expect(row).toContainText(customer.name);
      await expect(row).toContainText(customer.totalLabel);
    }

    // The fifth, still-pending seeded cart never reached `markPaid`, so its
    // email/name are null — it must never render as a row at all.
    await expect(page.locator("a.cust-row")).toHaveCount(4);
  });

  test("3. search filters the list to a real match", async () => {
    await page.goto("/admin/customers");
    await page.getByPlaceholder("Search name or email").fill("casey");
    await expect(page.locator("a.cust-row")).toHaveCount(1);
    await expect(rowByEmail(page, CUSTOMERS.pickup.email)).toBeVisible();

    await page.getByPlaceholder("Search name or email").fill("nobody-matches-this");
    await expect(page.getByText("No customers match “nobody-matches-this”.")).toBeVisible();
  });

  test("4. a customer who bought two numbers shows real stats and both numbers", async () => {
    await page.goto("/admin/customers");
    await rowByEmail(page, CUSTOMERS.ship.email).click();
    await expect(page).toHaveURL(/\/admin\/customers\/.+/);

    await expect(page.getByRole("heading", { name: CUSTOMERS.ship.name, level: 1 })).toBeVisible();
    await expect(page.getByText(CUSTOMERS.ship.email)).toBeVisible();

    await expect(statValue(page, "Orders")).toHaveText("1");
    await expect(statValue(page, "Spent")).toHaveText(CUSTOMERS.ship.totalLabel);
    await expect(statValue(page, "Sent back")).toHaveText("0");

    // One order, two units of an edition product -> two owned numbers,
    // claimed lowest-first (see `admin-run.spec.ts`'s own comment on the
    // same seed): #1 and #2.
    const chips = page.locator(".cust-number-chip");
    await expect(chips).toHaveCount(2);
    await expect(chips.nth(0)).toHaveText("#1");
    await expect(chips.nth(1)).toHaveText("#2");

    // The run board underneath is the real "All fifty numbers" data,
    // reused wholesale — all 5 numbers sold across the seed's four paid
    // orders show up here, not just this customer's own 2.
    await expect(page.locator(".rack-edcell.is-sold")).toHaveCount(5);

    // Clicking through to the order lands on the real order, not a 404.
    await page.locator(".cust-order-row").first().click();
    await expect(page).toHaveURL(/\/admin\/orders\/[^/]+\/?$/);
    await expect(page.locator(".rack-page-title")).toContainText(/CNE-/);
  });

  test("5. a customer with one number shows one chip, and the back link returns to the list", async () => {
    await page.goto("/admin/customers");
    await rowByEmail(page, CUSTOMERS.pickup.email).click();

    await expect(
      page.getByRole("heading", { name: CUSTOMERS.pickup.name, level: 1 }),
    ).toBeVisible();
    await expect(page.locator(".cust-number-chip")).toHaveCount(1);
    await expect(page.locator(".cust-number-chip")).toHaveText("#3");

    await page.getByRole("link", { name: /Everyone who.?s bought/ }).click();
    await expect(page).toHaveURL(/\/admin\/customers\/?$/);
  });

  test("6. an email nobody has ever paid with 404s honestly", async () => {
    // Same shared admin 404 `admin-when-it-breaks.spec.ts` covers for a
    // well-formed but unseeded order id — `getCustomerForAdmin` queries
    // fine and comes back `undefined`, so `page.tsx` calls the real
    // `notFound()`, not a forced one.
    await page.goto("/admin/customers/nobody-has-this-email@example.com");
    await expect(page.getByRole("heading", { name: /not on the rack/i })).toBeVisible();
  });
});
