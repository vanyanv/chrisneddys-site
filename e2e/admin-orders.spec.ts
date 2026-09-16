import { test, expect, type Locator, type Page } from "@playwright/test";
import { signInAsOwner } from "./helpers";

/**
 * Covers every owner flow of the orders desk (`/admin/orders`,
 * `/admin/orders/[id]`, and the packing slip), issue #32. One
 * `describe.serial` block with a single signed-in page, same shape as
 * `admin-sheet.spec.ts`: state from one test (a mark-shipped, a refund)
 * carries into the next the way a real owner session would.
 *
 * `e2e/db-warmup.mjs` seeds four orders before the server starts — one of
 * each status/fulfilment combination the sheet distinguishes:
 *   - "Jordan Ship"   buyer.ship@example.com     ship,   paid              -> TO SHIP
 *   - "Casey Pickup"  buyer.pickup@example.com   pickup, paid              -> TO PREPARE
 *   - "Riley Shipped" buyer.shipped@example.com  ship,   fulfilled         -> DONE
 *   - "Morgan Ready"  buyer.ready@example.com     pickup, ready_for_pickup -> READY
 *
 * Rows are looked up by customer email rather than order number: the order
 * numbers are deterministic today (nothing else creates an order before
 * this file's own seeding), but matching on the email keeps the tests
 * correct even if that ever changes.
 */

const EMAILS = {
  ship: "buyer.ship@example.com",
  pickup: "buyer.pickup@example.com",
  shipped: "buyer.shipped@example.com",
  ready: "buyer.ready@example.com",
} as const;

function rowByEmail(page: Page, email: string): Locator {
  return page.locator("a.ord-row").filter({ hasText: email });
}

async function idFromRow(row: Locator): Promise<string> {
  const href = await row.getAttribute("href");
  const id = href?.split("/").filter(Boolean).pop() ?? "";
  expect(id).toBeTruthy();
  return id;
}

async function hasNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth === document.documentElement.clientWidth,
  );
}

test.describe.serial("admin orders desk", () => {
  let page: Page;
  const orderId: Record<keyof typeof EMAILS, string> = {
    ship: "",
    pickup: "",
    shipped: "",
    ready: "",
  };

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await signInAsOwner(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("1. the list shows the seeded orders, the count line, and the right status pills", async () => {
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Orders", level: 1 })).toBeVisible();

    // 5, not 4: `e2e/db-warmup.mjs` also seeds a 5th, still-pending cart (a
    // number held in an open checkout, for `admin-run.spec.ts`) that never
    // reaches "paid" — it counts toward the "all orders" total here but not
    // toward "to ship"/"ready for pickup", both of which key off a later
    // status this cart never reaches.
    await expect(
      page.getByText("5 orders · 1 to ship · 1 ready for pickup", { exact: true }),
    ).toBeVisible();

    const shipRow = rowByEmail(page, EMAILS.ship);
    const pickupRow = rowByEmail(page, EMAILS.pickup);
    const shippedRow = rowByEmail(page, EMAILS.shipped);
    const readyRow = rowByEmail(page, EMAILS.ready);

    await expect(shipRow).toBeVisible();
    await expect(pickupRow).toBeVisible();
    await expect(shippedRow).toBeVisible();
    await expect(readyRow).toBeVisible();

    await expect(shipRow.locator(".ord-cell-status")).toHaveText("TO SHIP");
    await expect(pickupRow.locator(".ord-cell-status")).toHaveText("TO PREPARE");
    await expect(shippedRow.locator(".ord-cell-status")).toHaveText("DONE");
    await expect(readyRow.locator(".ord-cell-status")).toHaveText("READY");

    orderId.ship = await idFromRow(shipRow);
    orderId.pickup = await idFromRow(pickupRow);
    orderId.shipped = await idFromRow(shippedRow);
    orderId.ready = await idFromRow(readyRow);
  });

  /**
   * Clicks a status chip and waits for the filtered URL, retrying the click
   * if nothing navigated.
   *
   * The chips are plain Next `<Link>`s in a server component, so each one is
   * a soft navigation. A click that lands while the router is still settling
   * the PREVIOUS soft navigation is swallowed: React re-renders the nav and
   * the anchor the event was dispatched at is gone before the router sees
   * it, so no navigation ever starts and the URL simply stays where it was.
   * Waiting longer cannot fix that — the click is lost, not slow — which is
   * why this retries the click rather than raising a timeout. A real owner
   * does exactly the same thing: click it again.
   */
  async function clickStatusChip(label: string, expected: RegExp, present = true) {
    await expect(async () => {
      await page
        .getByRole("navigation", { name: "Filter by status" })
        .getByRole("link", { name: label })
        .click();
      if (present) {
        await expect(page).toHaveURL(expected, { timeout: 3_000 });
      } else {
        await expect(page).not.toHaveURL(expected, { timeout: 3_000 });
      }
    }).toPass({ timeout: 30_000 });
  }

  test("2. status chips filter the list via ?status=", async () => {
    await clickStatusChip("Paid (to fulfil)", /status=paid/);
    await expect(rowByEmail(page, EMAILS.ship)).toBeVisible();
    await expect(rowByEmail(page, EMAILS.pickup)).toBeVisible();
    await expect(rowByEmail(page, EMAILS.shipped)).toHaveCount(0);
    await expect(rowByEmail(page, EMAILS.ready)).toHaveCount(0);

    await clickStatusChip("Ready for pickup", /status=ready_for_pickup/);
    await expect(rowByEmail(page, EMAILS.ready)).toBeVisible();
    await expect(rowByEmail(page, EMAILS.ship)).toHaveCount(0);

    await clickStatusChip("Fulfilled", /status=fulfilled/);
    await expect(rowByEmail(page, EMAILS.shipped)).toBeVisible();
    await expect(rowByEmail(page, EMAILS.pickup)).toHaveCount(0);

    await clickStatusChip("All", /status=/, false);
    await expect(rowByEmail(page, EMAILS.ship)).toBeVisible();
    await expect(rowByEmail(page, EMAILS.pickup)).toBeVisible();
    await expect(rowByEmail(page, EMAILS.shipped)).toBeVisible();
    await expect(rowByEmail(page, EMAILS.ready)).toBeVisible();
  });

  test("3. search narrows rows by order number and by customer name", async () => {
    await page.goto("/admin/orders");
    const search = page.getByLabel("Search orders");

    const shipNumber = await rowByEmail(page, EMAILS.ship).locator(".ord-cell-num").innerText();
    await search.fill(shipNumber);
    await expect(rowByEmail(page, EMAILS.ship)).toBeVisible();
    await expect(rowByEmail(page, EMAILS.pickup)).toHaveCount(0);
    await expect(rowByEmail(page, EMAILS.shipped)).toHaveCount(0);
    await expect(rowByEmail(page, EMAILS.ready)).toHaveCount(0);

    await search.fill("Casey");
    await expect(rowByEmail(page, EMAILS.pickup)).toBeVisible();
    await expect(rowByEmail(page, EMAILS.ship)).toHaveCount(0);

    await search.fill("");
  });

  test("4. clicking a row opens the detail with number, status, customer, items and totals", async () => {
    await page.goto("/admin/orders");
    await rowByEmail(page, EMAILS.ship).click();
    await expect(page).toHaveURL(new RegExp(`/admin/orders/${orderId.ship}`));

    const shipNumber = await page.getByRole("heading", { level: 1 }).innerText();
    expect(shipNumber).toMatch(/^CNE-/);

    await expect(page.locator(".adm-order-head-meta .adm-pill")).toHaveText("TO SHIP");

    await expect(page.getByRole("heading", { name: "Customer", level: 3 })).toBeVisible();
    await expect(page.getByText("Jordan Ship", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: EMAILS.ship })).toHaveAttribute(
      "href",
      `mailto:${EMAILS.ship}`,
    );

    await expect(page.getByRole("heading", { name: "Ship to", level: 3 })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Items", level: 3 })).toBeVisible();
    await expect(page.getByText(/Foam Trucker/i).first()).toBeVisible();

    // subtotal 9600 + shipping 600 + tax 450 = 10650 cents.
    const totalRow = page.locator(".ord-total-row");
    await expect(totalRow).toContainText("Total");
    await expect(totalRow).toContainText("$106.50");

    await expect(page.getByRole("heading", { name: "Next", level: 3 })).toBeVisible();
  });

  test("5. mark shipped: carrier + tracking flips the pill to DONE and logs a timeline entry", async () => {
    await page.goto(`/admin/orders/${orderId.ship}`);

    await page.getByLabel("Carrier").selectOption("UPS");
    await page.getByLabel("Tracking number").fill("1Z999AA10123456784");
    await page.getByRole("button", { name: "Mark shipped", exact: true }).click();

    await expect(page.getByRole("status").filter({ hasText: "Marked shipped" })).toBeVisible();
    await expect(page.locator(".adm-order-head-meta .adm-pill")).toHaveText("DONE");

    await expect(page.getByRole("heading", { name: "Timeline", level: 3 })).toBeVisible();
    await expect(page.getByText("Fulfilled (shipped)", { exact: true })).toBeVisible();

    await expect(page.getByText("1Z999AA10123456784")).toBeVisible();
  });

  test("6. pickup order: Mark ready for pickup, then Mark picked up", async () => {
    await page.goto(`/admin/orders/${orderId.pickup}`);
    await expect(page.locator(".adm-order-head-meta .adm-pill")).toHaveText("TO PREPARE");

    await page.getByRole("button", { name: "Mark ready for pickup", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Marked ready for pickup" }),
    ).toBeVisible();
    await expect(page.locator(".adm-order-head-meta .adm-pill")).toHaveText("READY");

    await page.getByRole("button", { name: "Mark picked up", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Marked picked up" })).toBeVisible();
    await expect(page.locator(".adm-order-head-meta .adm-pill")).toHaveText("DONE");
  });

  test("7. refund: opens a confirm panel; Keep the order closes it, then the confirm marks it", async () => {
    await page.goto(`/admin/orders/${orderId.shipped}`);
    await expect(page.locator(".adm-order-head-meta .adm-pill")).toHaveText("DONE");

    const trigger = page.getByRole("button", { name: /^Refund \$/ });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Refund this order." });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("This one has no undo.")).toBeVisible();

    // Keep the order: closes the panel, changes nothing.
    await dialog.getByRole("button", { name: "Keep the order" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".adm-order-head-meta .adm-pill")).toHaveText("DONE");

    // Reopen and confirm.
    await trigger.click();
    await page.getByRole("dialog").getByRole("button", { name: "Mark refunded" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Marked refunded" })).toBeVisible();
    await expect(page.locator(".adm-order-head-meta .adm-pill")).toHaveText("REFUNDED");
    await expect(page.locator(".adm-order-head-meta .adm-pill")).toHaveClass(/is-hidden/);

    // Refunded, the trigger is gone — replaced by a plain "Refunded" note.
    await expect(page.getByRole("button", { name: /^Refund \$/ })).toHaveCount(0);
    await expect(page.getByText(/^Refunded ·/)).toBeVisible();
  });

  test("8. Packing slip opens a page with the order number and the store logo", async () => {
    await page.goto(`/admin/orders/${orderId.ready}`);
    const number = await page.getByRole("heading", { level: 1 }).innerText();

    await page.getByRole("link", { name: "Packing slip", exact: true }).click();
    await expect(page).toHaveURL(/\/packing-slip\/?$/);
    await expect(page.getByText(number, { exact: true })).toBeVisible();

    // The packing slip renders no admin topbar at all (it's a print sheet,
    // not a screen with navigation), so there's only ever one logo on the
    // page — but scope to the slip sheet's own class anyway for clarity.
    const logo = page.locator(".rack-slip-logo");
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("alt", /Chris N Eddy/i);
  });

  test("9. phone 390px: rows collapse to two lines and the detail stacks, no horizontal overflow", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/orders");

    await expect(page.locator(".ord-cols")).toBeHidden();
    await expect(rowByEmail(page, EMAILS.ready)).toBeVisible();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    await rowByEmail(page, EMAILS.ready).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    await page.setViewportSize({ width: 1280, height: 800 });
  });
});
