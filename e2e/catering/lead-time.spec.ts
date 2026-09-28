import { test, expect, type Page } from "@playwright/test";
import { signInAsOwner } from "../helpers";
import {
  enableCateringOrdering,
  startOrder,
  choosePickup,
  setHeadcount,
  calendarDayStatus,
  dateStrDaysFromNow,
  cateringSaveButton,
  cateringSaveBar,
} from "./helpers";

/**
 * Flow 3: lead time. Tomorrow is always too soon (48h notice) and its
 * message links to `/contact/` with no `tel:` link; a 50+ headcount needs
 * 72h, blocking a day that's fine for a normal order; a day the owner has
 * marked off shows closed. Issue #190.
 */
test.describe.serial("flow 3: lead time", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await enableCateringOrdering(page);
    await startOrder(page);
    await choosePickup(page, "Hollywood");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=when/);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("1. tomorrow is too soon, with a /contact/ link and no tel: link", async () => {
    await setHeadcount(page, 12);
    expect(await calendarDayStatus(page, 1)).toBe("too-soon");

    const tomorrow = page.locator(`button.cor-cal-day[aria-label^="${dateStrDaysFromNow(1)}"]`);
    await tomorrow.click();
    await expect(
      page.getByText(/too soon for us to prep — every slot that day is inside our notice window/),
    ).toBeVisible();
    const contactLink = page.getByRole("link", { name: "message us" });
    await expect(contactLink).toHaveAttribute("href", "/contact/");
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    // Not clickable — no slot can ever appear for it.
    await expect(tomorrow).toBeDisabled();
  });

  test("2. 50+ headcount needs 72h notice, blocking a day well inside it", async () => {
    await setHeadcount(page, 60);
    await expect(page.getByText(/72 hours’ notice/)).toBeVisible();
    expect(await calendarDayStatus(page, 2)).toBe("too-soon");
    expect(await calendarDayStatus(page, 5)).toBe("open");
  });

  test("3. a day off the owner sets in admin shows closed", async () => {
    const dayOffDate = dateStrDaysFromNow(6);

    const adminPage = await page.context().browser()!.newPage();
    await signInAsOwner(adminPage);
    await adminPage.goto("/admin/settings");
    await adminPage.locator(".cat-add-day-off input[type='date']").fill(dayOffDate);
    await adminPage.getByRole("button", { name: "+ Add a day off" }).click();
    await expect(adminPage.getByText(dayOffDate)).toBeVisible();
    await cateringSaveButton(adminPage).click();
    await expect(cateringSaveBar(adminPage)).not.toHaveClass(/is-visible/);
    await adminPage.close();

    await setHeadcount(page, 12);
    // Force a fresh render of the calendar/day-status with the new setting:
    // reload the whole order page (the draft persists in localStorage, but
    // `config` — including `daysOff` — only ever comes from the server render).
    await page.reload();
    await expect(page).toHaveURL(/step=when/);
    expect(await calendarDayStatus(page, 6)).toBe("closed");
  });
});
