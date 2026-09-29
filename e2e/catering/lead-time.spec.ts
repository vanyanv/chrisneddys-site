import { test, expect, type Page } from "@playwright/test";
import { signInAsOwner } from "../helpers";
import {
  startOrder,
  choosePickup,
  selectCalendarDate,
  selectFirstSlot,
  calendarDayStatus,
  dateStrDaysFromNow,
  cateringSaveButton,
  cateringSaveBar,
} from "./helpers";

/**
 * Flow 3: lead time. Tomorrow is always too soon (48h notice) and its
 * message links to `/contact/` with no `tel:` link; the same 48h notice
 * applies whatever the size of the order (there is no longer notice for big
 * ones); a day the owner has marked off shows closed. Issue #190.
 */
test.describe.serial("flow 3: lead time", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await startOrder(page);
    await choosePickup(page, "Hollywood");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=when/);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("1. tomorrow is too soon, with a /contact/ link and no tel: link", async () => {
    expect(await calendarDayStatus(page, 1)).toBe("too-soon");

    const tomorrow = page.locator(`button.cor-cal-day[aria-label^="${dateStrDaysFromNow(1)}"]`);
    // `{ force: true }`: the day button is `aria-disabled`, not natively
    // `disabled` — it stays clickable (that's how the day shows *why* it's
    // too soon, below) and only reads as disabled to assistive tech and to
    // `toBeDisabled()` (which honors `aria-disabled` too), never selectable
    // into an actual booking (no slots ever appear for it). Playwright's
    // own actionability check is more conservative than a real mouse click
    // and refuses an `aria-disabled` target without `force`.
    await tomorrow.click({ force: true });
    const note = page.locator(".cor-note.is-error");
    await expect(
      note.getByText(/too soon for us to prep — every slot that day is inside our notice window/),
    ).toBeVisible();
    const contactLink = note.getByRole("link", { name: "message us" });
    await expect(contactLink).toHaveAttribute("href", "/contact/");
    // Scoped to the note: the site footer always carries two real `tel:`
    // links (each location's phone number), so an unscoped, page-wide
    // check here would fail regardless of this message.
    await expect(note.locator('a[href^="tel:"]')).toHaveCount(0);
    // Not clickable — no slot can ever appear for it.
    await expect(tomorrow).toBeDisabled();
  });

  test("2. a 60-person order gets the same 48h notice as any other, not 72h", async () => {
    // Nothing on this step depends on the order's size, and nothing says
    // otherwise: no "72 hours' notice" note, and the day the calendar
    // opens up is the same one a small order gets.
    await expect(page.getByText(/72 hours/)).toHaveCount(0);
    expect(await calendarDayStatus(page, 3)).toBe("open");

    // Build a big order (Feed my crew for 60), then come back to the
    // calendar: still tomorrow too soon, three days out open, no 72h note.
    await selectCalendarDate(page, 3);
    await selectFirstSlot(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=food/);
    await page.getByRole("button", { name: /feed my crew/i }).click();
    const sheet = page.getByRole("dialog", { name: "Feed my crew" });
    await sheet.getByLabel("Number of people").fill("60");
    await sheet.getByRole("button", { name: /^Fill my order/ }).click();
    await expect(sheet).toBeHidden();

    await page.locator(".cor-summary").getByRole("button", { name: "Edit" }).click();
    await expect(page).toHaveURL(/step=where/);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=when/);

    await expect(page.getByText(/72 hours/)).toHaveCount(0);
    expect(await calendarDayStatus(page, 1)).toBe("too-soon");
    expect(await calendarDayStatus(page, 3)).toBe("open");
    expect(await calendarDayStatus(page, 5)).toBe("open");
  });

  test("3. a day off the owner sets in admin shows closed", async () => {
    const dayOffDate = dateStrDaysFromNow(6);

    const adminPage = await page.context().browser()!.newPage();
    await signInAsOwner(adminPage);
    await adminPage.goto("/admin/catering/settings");
    // `catering-phone` and `catering-desktop` both run this same spec file
    // against one shared server/database, and `dayOffDate` is derived from
    // the real clock (not per-project), so whichever project runs this
    // test second would otherwise find the first project's day off still
    // saved from before and add a duplicate row alongside it — a strict-
    // mode violation below. Clear any existing row(s) for this date first,
    // so the state this test asserts on doesn't depend on run order.
    const existingRows = adminPage
      .locator(".cat-day-off-row")
      .filter({ hasText: dayOffDate })
      .getByRole("button", { name: "Remove day off" });
    while ((await existingRows.count()) > 0) {
      await existingRows.first().click();
    }
    await adminPage.locator(".cat-add-day-off input[type='date']").fill(dayOffDate);
    await adminPage.getByRole("button", { name: "+ Add a day off" }).click();
    await expect(adminPage.getByText(dayOffDate)).toBeVisible();
    await cateringSaveButton(adminPage).click();
    await expect(cateringSaveBar(adminPage)).not.toHaveClass(/is-visible/);
    await adminPage.close();

    // Force a fresh render of the calendar/day-status with the new setting:
    // reload the whole order page (the draft persists in localStorage, but
    // `config` — including `daysOff` — only ever comes from the server render).
    await page.reload();
    await expect(page).toHaveURL(/step=when/);
    expect(await calendarDayStatus(page, 6)).toBe("closed");
  });
});
