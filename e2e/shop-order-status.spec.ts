import { test, expect } from "@playwright/test";

/**
 * `/shop/order` — the customer's order-status page, which had no e2e
 * coverage at all despite being the one customer-facing screen behind a
 * credential check (order number + the email used at checkout, no sign-in).
 *
 * Reads only. `e2e/db-warmup.mjs` seeds the orders this looks up, and every
 * assertion here is against those; nothing in this file writes, so it can
 * sit anywhere in the run order without disturbing the shared database the
 * admin specs depend on.
 */

// Seeded by `e2e/db-warmup.mjs`. Deliberately NOT asserted to be in any
// particular status: `admin-orders.spec.ts` sorts earlier in the run and
// marks this very order shipped, so its status depends on run order. The
// assertions below are about what the page always has to do — name the
// order, name what was bought, state where it is — not about which state it
// happens to be in.
const ORDER = "CNE-1001";
const ORDER_EMAIL = "buyer.ship@example.com";

const BADGES = ["Paid", "Shipped", "Ready", "Picked up", "Refunded"];

async function lookUp(page: import("@playwright/test").Page, number: string, email: string) {
  await page.goto("/shop/order");
  await page.getByLabel("Order number", { exact: true }).fill(number);
  await page.getByLabel("Email used at checkout", { exact: true }).fill(email);
  await page.getByRole("button", { name: /look up order/i }).click();
}

test("1. a real order number and email show the order, what was in it, and where it is", async ({
  page,
}) => {
  await lookUp(page, ORDER, ORDER_EMAIL);

  const result = page.locator(".cne-ord-result");
  await expect(result).toBeVisible();
  await expect(result.getByRole("heading", { name: ORDER })).toBeVisible();

  // Issue #41: the item name is snapshotted onto the order at checkout, and
  // it used to be snapshotted from a field The Rack never writes — so this
  // row rendered blank and the page never said what had been bought. An
  // order status page that cannot name the product is the bug worth
  // guarding here, so assert on real text rather than on the row existing.
  const itemName = result.locator(".cne-ord-item-name").first();
  await expect(itemName).toBeVisible();
  await expect(itemName).not.toHaveText(/^\s*$/);
  await expect(itemName).not.toHaveText(/untitled/i);

  // The status is stated twice on purpose — a one-word badge to scan, and a
  // sentence to read. Both must say something real, whichever state it is in.
  const badge = result.locator(".cne-ord-badge");
  await expect(badge).toBeVisible();
  // `innerText` gives the RENDERED text, and the badge is uppercased in CSS
  // (`text-transform`), so compare case-insensitively rather than asserting
  // the casing a stylesheet happens to apply.
  expect(BADGES.map((b) => b.toUpperCase())).toContain(
    (await badge.innerText()).trim().toUpperCase(),
  );
  await expect(result.locator(".cne-ord-headline")).not.toHaveText(/^\s*$/);

  // A live order shows the journey; a refunded one says so instead. Exactly
  // one of those, never neither.
  const timeline = result.locator(".cne-ord-timeline");
  const refunded = result.locator(".cne-ord-refunded");
  expect((await timeline.count()) + (await refunded.count())).toBe(1);
  if ((await timeline.count()) === 1) {
    await expect(result.getByText("Payment taken", { exact: true })).toBeVisible();
  }
});

test("2. a wrong email for a real order number is refused, and says nothing about the order", async ({
  page,
}) => {
  await lookUp(page, ORDER, "definitely-not-the-buyer@example.com");

  await expect(page.locator(".cne-ord-result")).toHaveCount(0);
  // `.cne-ck-err` rather than `getByRole("alert")`: Next mounts its own
  // route announcer with `role="alert"`, so the bare role matches two
  // elements and is a strict-mode violation.
  const error = page.locator(".cne-ck-err");
  await expect(error).toBeVisible();
  // Anti-enumeration: the miss must not confirm that the order number is
  // real, so the order number must not come back in the error.
  await expect(error).not.toContainText(ORDER);
});

test("3. the result gets the wider column beside the form on a desktop width", async ({ page }) => {
  await lookUp(page, ORDER, ORDER_EMAIL);
  await expect(page.locator(".cne-ord-result")).toBeVisible();

  const form = await page.locator(".cne-ord-form").boundingBox();
  const result = await page.locator(".cne-ord-result").boundingBox();
  if (!form || !result) throw new Error("expected both the form and the result to be laid out");

  // Side by side, with the answer given at least as much room as the
  // question — not the answer stacked underneath a full-width form.
  expect(result.x).toBeGreaterThan(form.x + form.width - 1);
  expect(result.width).toBeGreaterThanOrEqual(form.width);
});

test("4. phone width stacks it with no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await lookUp(page, ORDER, ORDER_EMAIL);
  await expect(page.locator(".cne-ord-result")).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
