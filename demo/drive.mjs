/**
 * Drives the owner demo in a real browser and screenshots each step.
 *
 * Split into phases because PGlite is single-writer: the steps that need
 * the database to themselves (attaching a photo, completing the purchase)
 * run in `demo/prep.mjs` with this server stopped.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";

const BASE = "http://127.0.0.1:3222";
const SHOTS = new URL("./shots/", import.meta.url).pathname;
const STATE = new URL("./state.json", import.meta.url).pathname;
const phase = process.argv[2];
mkdirSync(SHOTS, { recursive: true });

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  // Reduced motion: The Rack staggers its rows in, and a screenshot taken
  // mid-stagger catches a row at opacity 0 — which reads as a missing row
  // rather than an animating one. This also exercises the reduced-motion
  // path the motion work put behind `prefers-reduced-motion`.
  reducedMotion: "reduce",
});
const page = await context.newPage();

async function shot(name) {
  await page.waitForTimeout(1200); // let any toast/transition settle
  await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });
  console.log(`  shot: ${name}`);
}

async function signIn() {
  await page.goto(`${BASE}/admin/sign-in`);
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("demo-owner-password-123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/, { timeout: 30_000 });
}

const panel = () => page.getByTestId("product-panel");

if (phase === "a") {
  await page.goto(`${BASE}/admin/sign-in`);
  await shot("01-sign-in");

  await signIn();
  await shot("02-today-work-queue");

  await page.goto(`${BASE}/admin/products/`);
  await shot("03-catalogue-before");

  await page.getByRole("button", { name: "New product", exact: true }).click();
  await panel().waitFor();
  await page.waitForURL(/\?open=/);
  state.productId = new URL(page.url()).searchParams.get("open");
  const card = page.locator(`[data-testid="product-card"][data-id="${state.productId}"]`);
  state.slug = await card.getAttribute("data-slug");
  save();
  await shot("04-blank-draft");

  const name1 = panel().getByLabel("Name line 1", { exact: true });
  await name1.fill("THE DEMO CAP");
  await name1.press("Tab");
  const name2 = panel().getByLabel("Name line 2", { exact: true });
  if (await name2.count()) {
    await name2.fill("RED");
    await name2.press("Tab");
  }
  const price = panel().getByLabel("Price", { exact: true });
  await price.fill("42");
  await price.press("Tab");
  await shot("05-details-filled");

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("status").filter({ hasText: /saved/i }).first().waitFor({ timeout: 20_000 });

  // Give it a run of 25 numbered editions.
  await panel().locator("summary", { hasText: "More details" }).click();
  await panel().getByRole("button", { name: "Numbered edition", exact: true }).click();
  const size = panel().getByLabel("Edition size", { exact: true });
  await size.fill("25");
  await size.press("Tab");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(1500);
  await shot("06-run-of-25");

  // Publish gate: no photo yet, so Live must refuse.
  await panel().getByRole("button", { name: "Live", exact: true }).click();
  await page.waitForTimeout(1200);
  await shot("07-publish-refused-no-photo");
}

if (phase === "b") {
  await signIn();
  await page.goto(`${BASE}/admin/products/?open=${state.productId}`);
  await panel().waitFor();
  await page.waitForTimeout(800);
  await shot("08-photo-attached");

  await panel().getByRole("button", { name: "Live", exact: true }).click();
  await page.waitForTimeout(1500);
  await shot("09-now-live");

  await page.goto(`${BASE}/shop`);
  await page.waitForTimeout(600);
  await shot("10-shop-listing");

  await page.goto(`${BASE}/shop/${state.slug}`);
  await page.waitForTimeout(600);
  await shot("11-product-page-with-run");

  const addToBag = page.getByRole("button", { name: /add to bag|add to cart/i }).first();
  await addToBag.click();
  await page.waitForTimeout(1200);
  await shot("12-added-to-bag");
}

if (phase === "c") {
  await page.goto(`${BASE}/shop/order`);
  await page.waitForTimeout(400);
  const num = page.getByLabel(/order number/i).first();
  if (await num.count()) {
    await num.fill(state.orderNumber);
    const em = page.getByLabel(/email/i).first();
    if (await em.count()) await em.fill("sam.buyer@example.com");
    await page
      .getByRole("button", { name: /find|look up|track/i })
      .first()
      .click();
    await page.waitForTimeout(1500);
  }
  await shot("13-customer-order-tracking");

  await signIn();
  await shot("14-admin-today-new-order");

  await page.goto(`${BASE}/admin/orders/`);
  await page.waitForTimeout(600);
  await shot("15-admin-orders");

  await page.goto(`${BASE}/admin/products/${state.productId}/run`);
  await page.waitForTimeout(600);
  await shot("16-run-board-number-sold");

  await page.goto(`${BASE}/admin/customers`);
  await page.waitForTimeout(600);
  await shot("17-customers");
}

await browser.close();
console.log(`phase ${phase} done`);
