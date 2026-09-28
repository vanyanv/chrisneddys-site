import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { signInAsOwner } from "../helpers";

/** ZIPs used across the delivery-range specs: Hollywood is 90028, Van Nuys
 * 91405 (see `src/lib/catering/public.test.ts`). 91406 is ~2 straight-line
 * miles from Van Nuys (well inside the 10mi range after the 1.25 driving
 * fudge factor); 95014 (Cupertino) is ~300mi from either store. */
export const HOLLYWOOD_NEAR_ZIP = "90028";
export const VAN_NUYS_NEAR_ZIP = "91406";
export const FAR_ZIP = "95014";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function dateStrDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The two order fixtures `e2e/seed-catering-fixtures.mjs` seeds directly
 * into `.pglite/e2e` before `next build`/`next start` ever open it (see
 * that script's module comment for why a *second* `node` process reaching
 * into the database once the e2e server already has it open doesn't work —
 * a second process's write would eventually land, but only after the two
 * PGlite instances fought over the same on-disk files for anywhere from
 * tens of seconds to several minutes). Reading this file is a plain
 * filesystem read, not a database connection, so it carries none of that
 * risk. */
type CateringFixtures = {
  expired: { token: string; number: string };
  /** One half-refund order per catering Playwright project, keyed by
   * project name — `cancel.spec.ts` test 2 cancels it (a one-time state
   * change), and that spec runs once per project against this one shared
   * server, so a single shared fixture would already be cancelled by the
   * time the second project's test 2 ran. */
  halfRefund: Record<string, { token: string; number: string }>;
};

export function readCateringFixtures(): CateringFixtures {
  const raw = readFileSync(path.join(__dirname, ".fixtures.json"), "utf8");
  return JSON.parse(raw) as CateringFixtures;
}

/** This test's half-refund fixture — the one seeded for its own Playwright
 * project (see `CateringFixtures.halfRefund`'s comment). */
export function readHalfRefundFixture(projectName: string): { token: string; number: string } {
  const fixture = readCateringFixtures().halfRefund[projectName];
  if (!fixture) {
    throw new Error(
      `No seeded half-refund fixture for catering project "${projectName}" — ` +
        `check e2e/seed-catering-fixtures.mjs seeds one per catering project.`,
    );
  }
  return fixture;
}

export async function signInAsOwnerOnCateringList(page: Page): Promise<void> {
  await signInAsOwner(page);
  await page.goto("/admin/catering");
}

/** Turns catering ordering on (idempotent — a no-op if already on) from
 * Admin -> Settings -> Catering, saving through the sticky save bar (the
 * same bar phone has to reach per issue #190's acceptance criteria).
 * `/admin/settings` is middleware-protected, so this signs in as the owner
 * first — on the same `page` a spec then reuses as the customer, which is
 * fine: the admin session cookie doesn't gate the storefront/order routes. */
/** `/admin/settings` renders two independent forms, each with its own save
 * bar (`CateringSettingsSection`'s module comment: "a different table, so a
 * different save") — so every selector here is scoped to the catering
 * form's own save button (`form="catering-settings-form"`), not just
 * `.adm-savebar-save`, which the store-settings save bar shares the class
 * name with too. */
export function cateringSaveButton(page: Page) {
  return page.locator('button.adm-savebar-save[form="catering-settings-form"]');
}
export function cateringSaveBar(page: Page) {
  return page.locator(".adm-savebar", { has: cateringSaveButton(page) });
}

// Playwright's `expect` polling timeout defaults to 5s and only picks up
// `playwright.config.ts`'s longer `expect.timeout` (15s) inside a running
// test's own worker context — not here, since `enableCateringOrdering`/
// `disableCateringOrdering` also run from `e2e/catering/global-setup.ts`,
// outside any test. Passed explicitly so both callers get the same
// tolerance for a cold PGlite start's slower save round trip.
const SAVE_BAR_TIMEOUT = 45_000;

export async function enableCateringOrdering(page: Page): Promise<void> {
  await signInAsOwner(page);
  await page.goto("/admin/settings");
  const toggle = page.locator("#orderingOn");
  if (await toggle.isChecked()) return;
  await toggle.click({ force: true });
  await cateringSaveButton(page).click();
  await expect(cateringSaveBar(page)).not.toHaveClass(/is-visible/, { timeout: SAVE_BAR_TIMEOUT });
  await expect(toggle).toBeChecked();
}

export async function disableCateringOrdering(page: Page): Promise<void> {
  await signInAsOwner(page);
  await page.goto("/admin/settings");
  const toggle = page.locator("#orderingOn");
  if (!(await toggle.isChecked())) return;
  await toggle.click({ force: true });
  await cateringSaveButton(page).click();
  await expect(cateringSaveBar(page)).not.toHaveClass(/is-visible/, { timeout: SAVE_BAR_TIMEOUT });
  await expect(toggle).not.toBeChecked();
}

export async function startOrder(page: Page): Promise<void> {
  await page.goto("/catering/order/");
  await page.getByRole("button", { name: /start a catering order/i }).click();
  await expect(page).toHaveURL(/step=where/);
}

export async function choosePickup(page: Page, store: "Hollywood" | "Van Nuys"): Promise<void> {
  await page.getByRole("button", { name: "Pickup" }).click();
  await page.locator(".cor-store", { hasText: store }).click();
}

export async function chooseDelivery(
  page: Page,
  store: "Hollywood" | "Van Nuys",
  address: { line1: string; city: string; zip: string },
): Promise<void> {
  await page.getByRole("button", { name: "Delivery" }).click();
  await page.locator(".cor-store", { hasText: store }).click();
  await page.getByPlaceholder("Street address").fill(address.line1);
  await page.locator('input[autocomplete="address-level2"]').fill(address.city);
  await page.locator('input[autocomplete="postal-code"]').fill(address.zip);
}

async function goToCalendarMonth(page: Page, target: Date): Promise<void> {
  const label = target.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  for (let i = 0; i < 12; i++) {
    const current = await page.locator(".cor-cal-nav p").innerText();
    if (current === label) return;
    await page.getByRole("button", { name: "Next month" }).click();
  }
  throw new Error(`could not navigate calendar to ${label}`);
}

/** Clicks the calendar day `daysFromNow` days out and returns its
 * "YYYY-MM-DD". Fails loudly (via the `expect`) if that day isn't clickable
 * — a day disabled for lead time/closed days is never silently skipped. */
export async function selectCalendarDate(page: Page, daysFromNow: number): Promise<string> {
  const target = new Date();
  target.setDate(target.getDate() + daysFromNow);
  await goToCalendarMonth(page, target);
  const dateStr = dateStrDaysFromNow(daysFromNow);
  const day = page.locator(`button.cor-cal-day[aria-label^="${dateStr}"]`);
  await expect(day).toBeEnabled();
  await day.click();
  return dateStr;
}

export async function calendarDayStatus(
  page: Page,
  daysFromNow: number,
): Promise<"open" | "closed" | "too-soon" | "past"> {
  const target = new Date();
  target.setDate(target.getDate() + daysFromNow);
  await goToCalendarMonth(page, target);
  const dateStr = dateStrDaysFromNow(daysFromNow);
  const day = page.locator(`button.cor-cal-day[aria-label^="${dateStr}"]`);
  const cls = (await day.getAttribute("class")) ?? "";
  if (cls.includes("is-open")) return "open";
  if (cls.includes("is-closed")) return "closed";
  if (cls.includes("is-too-soon")) return "too-soon";
  return "past";
}

export async function selectFirstSlot(page: Page): Promise<void> {
  await page.locator(".cor-slots .cor-slot").first().click();
}

export async function setHeadcount(page: Page, n: number): Promise<void> {
  await page.getByLabel("Number of people").fill(String(n));
}

/** Opens an item's sheet from the food step's menu grid by its visible name.
 * `StepFood` only ever mounts the one active category's rows (`useState`,
 * not CSS visibility), so a name from a different category than whatever's
 * currently selected isn't in the DOM yet — this tries each category chip,
 * in order, until the named row actually appears, rather than hardcoding a
 * name-to-category table here that the menu data would drift out of sync
 * with. A no-op loop (0 iterations) when the row's already there.
 *
 * Closes any already-open item sheet first: a fresh (non-editing) `Add`
 * leaves the sheet open — "Added for ___. Add one for someone else?" — so
 * the food grid stays reachable for another item, but the sheet's `cor-
 * scrim` backdrop still covers the grid and intercepts a row click until
 * it's closed. */
export async function openItemByName(page: Page, name: string): Promise<void> {
  if (await page.locator(".cor-item-sheet.is-open").count()) {
    await closeItemSheet(page);
  }
  const row = page.locator(".cor-menu-row", { hasText: name }).first();
  const chips = page.locator(".cor-cat-chips .cor-chip");
  const chipCount = await chips.count();
  for (let i = 0; i < chipCount && (await row.count()) === 0; i++) {
    await chips.nth(i).click();
  }
  await row.click();
}

/** Closes the item sheet via its ✕. `ItemSheet`'s `handleAdd` only closes
 * the sheet on an *editing* add — a fresh add instead shows "Added for
 * ___. Add one for someone else?" and leaves it open, so the food grid
 * stays reachable for another `openItemByName` — but the sheet is still a
 * full modal (`role="dialog"`) intercepting clicks to anything else, e.g.
 * the step's own "Continue" button, until this closes it explicitly. */
export async function closeItemSheet(page: Page): Promise<void> {
  await page.locator(".cor-item-sheet .cor-sheet-x").click();
}

/** Scoped to `.cor-item-sheet` (`ItemSheet`'s own root class): `FeedCrewSheet`
 * renders a same-named, same-class "quick fill" button of its own (its own
 * `wayId` state, defaulted to `"chris"`) and stays mounted (just `inert`)
 * behind the item sheet, so an unscoped `getByRole` for "Chris's/Eddy's Way"
 * resolves to two elements — this item's own quick-fill row plus the
 * feed-crew sheet's — a strict-mode violation regardless of which is
 * actually open. */
export async function pickWay(page: Page, way: "chris" | "eddy"): Promise<void> {
  const label = way === "chris" ? /CHRIS.?S WAY/i : /EDDY.?S WAY/i;
  await page.locator(".cor-item-sheet").getByRole("button", { name: label }).click();
}

export async function toggleTopping(page: Page, name: string): Promise<void> {
  await page.getByLabel(`Add ${name}`, { exact: true }).click();
}

export async function toggleExtra(
  page: Page,
  name: "Extra Cheese" | "Make it Halal",
): Promise<void> {
  await page.getByLabel(name, { exact: true }).click();
}

export async function fillItemForName(page: Page, name: string): Promise<void> {
  await page.getByPlaceholder(/A name, like Dev Patel/).fill(name);
}

export async function fillItemNote(page: Page, note: string): Promise<void> {
  await page.getByPlaceholder(/No onion, allergy/).fill(note);
}

export async function setItemQty(page: Page, n: number): Promise<void> {
  await page.getByLabel("Quantity").fill(String(n));
}

export async function addItem(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Add \d/ }).click();
}

export async function saveItem(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Save/ }).click();
}

/** Opens the order sheet from the food step, on either viewport (the
 * mobile sticky CTA and the desktop rail button are both in the DOM; only
 * one is ever visible, so this clicks whichever CSS has actually shown). */
export async function openOrderSheet(page: Page): Promise<void> {
  const mobileBtn = page.locator(".cor-view-order");
  if ((await mobileBtn.count()) > 0 && (await mobileBtn.isVisible())) {
    await mobileBtn.click();
    return;
  }
  await page.locator(".cor-food-rail button", { hasText: "View order" }).click();
}

export async function goToStep(
  page: Page,
  step: "where" | "when" | "food" | "details" | "review",
): Promise<void> {
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(new RegExp(`step=${step}`));
}

export async function fillContactDetails(
  page: Page,
  contact: { name: string; email: string; phone: string },
): Promise<void> {
  await page.getByLabel("Your name").fill(contact.name);
  await page.getByLabel("Email", { exact: true }).fill(contact.email);
  await page.getByLabel("Mobile", { exact: true }).fill(contact.phone);
}

/** Clicks "Request catering" on the review step and waits for the fake-
 * payments redirect to the sent page, returning the order token. */
export async function submitAndGetToken(page: Page): Promise<string> {
  await page.getByRole("button", { name: /request catering|sending/i }).click();
  await page.waitForURL(/\/catering\/order\/sent\/\?o=/, { timeout: 20_000 });
  const url = new URL(page.url());
  const token = url.searchParams.get("o");
  expect(token).toBeTruthy();
  return token!;
}

export async function orderNumberFromSentPage(page: Page): Promise<string> {
  const tag = await page.locator(".cor-sent-tag").innerText();
  return tag.trim();
}

/** Drives a minimal, valid pickup order end to end (Hollywood, one Chris's
 * Way line, a slot >=5 days out) and returns its token and order number —
 * for specs whose subject is what happens *after* a request lands (admin
 * approve/decline, cancel, change, expiry), not the builder itself. */
export async function quickOrder(
  page: Page,
  contact: { name: string; email: string; phone: string },
): Promise<{ token: string; number: string }> {
  await startOrder(page);
  await choosePickup(page, "Hollywood");
  await page.getByRole("button", { name: "Continue" }).click();
  await setHeadcount(page, 12);
  await selectCalendarDate(page, 5);
  await selectFirstSlot(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await openItemByName(page, "2 Sliders and Fries");
  await pickWay(page, "chris");
  await addItem(page);
  await closeItemSheet(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await fillContactDetails(page, contact);
  await page.getByRole("button", { name: "Continue" }).click();
  const token = await submitAndGetToken(page);
  const number = await orderNumberFromSentPage(page);
  return { token, number };
}
