import { execFileSync } from "node:child_process";
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

/** Runs `e2e/catering/db-mutate.mjs` out-of-process against the same
 * `PGLITE_DATA_DIR` the running e2e server uses, to reach an order state the
 * customer UI can never produce itself (see that file's module comment). */
export function mutateOrder(
  command: "set-event-at" | "set-respond-by",
  orderNumber: string,
  isoValue: string,
): void {
  execFileSync(
    process.execPath,
    [path.join(__dirname, "db-mutate.mjs"), command, orderNumber, isoValue],
    {
      cwd: path.join(__dirname, "..", ".."),
      env: { ...process.env, PGLITE_DATA_DIR: ".pglite/e2e", DATABASE_URL: "" },
      stdio: "pipe",
    },
  );
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

export async function enableCateringOrdering(page: Page): Promise<void> {
  await signInAsOwner(page);
  await page.goto("/admin/settings");
  const toggle = page.locator("#orderingOn");
  if (await toggle.isChecked()) return;
  await toggle.click({ force: true });
  await cateringSaveButton(page).click();
  await expect(cateringSaveBar(page)).not.toHaveClass(/is-visible/);
  await expect(toggle).toBeChecked();
}

export async function disableCateringOrdering(page: Page): Promise<void> {
  await signInAsOwner(page);
  await page.goto("/admin/settings");
  const toggle = page.locator("#orderingOn");
  if (!(await toggle.isChecked())) return;
  await toggle.click({ force: true });
  await cateringSaveButton(page).click();
  await expect(cateringSaveBar(page)).not.toHaveClass(/is-visible/);
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

/** Opens an item's sheet from the food step's menu grid by its visible name. */
export async function openItemByName(page: Page, name: string): Promise<void> {
  await page.locator(".cor-menu-row", { hasText: name }).first().click();
}

export async function pickWay(page: Page, way: "chris" | "eddy"): Promise<void> {
  const label = way === "chris" ? /CHRIS.?S WAY/i : /EDDY.?S WAY/i;
  await page.getByRole("button", { name: label }).click();
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
  await page.getByLabel("Phone", { exact: true }).fill(contact.phone);
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
  await page.getByRole("button", { name: "Continue" }).click();
  await fillContactDetails(page, contact);
  await page.getByRole("button", { name: "Continue" }).click();
  const token = await submitAndGetToken(page);
  const number = await orderNumberFromSentPage(page);
  return { token, number };
}
