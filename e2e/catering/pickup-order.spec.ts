import { test, expect, type Page } from "@playwright/test";
import {
  startOrder,
  choosePickup,
  selectCalendarDate,
  selectFirstSlot,
  setHeadcount,
  openItemByName,
  pickWay,
  toggleTopping,
  toggleExtra,
  fillItemForName,
  fillItemNote,
  setItemQty,
  addItem,
  closeItemSheet,
  saveItem,
  openOrderSheet,
  fillContactDetails,
  submitAndGetToken,
} from "./helpers";

/**
 * Flow 1: the full pickup order — Hollywood, headcount 12, a mix of
 * Chris's/Eddy's Way, a custom halal build, a named line with a note, and
 * "add one for someone else" — through the order sheet edits, details
 * validation, review, request and the sent/order-link pages. Issue #190.
 *
 * One `describe.serial` with a single page: each test builds on the
 * `localStorage` draft the last one left behind, the same way a real
 * customer's browser carries the draft between screens.
 */
test.describe.serial("flow 1: pickup order", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("1. landing -> Hollywood pickup -> date >=3 days out, a slot, headcount 12", async () => {
    await startOrder(page);
    await expect(page.getByRole("heading", { name: "How are you getting it?" })).toBeVisible();

    await choosePickup(page, "Hollywood");
    await expect(page.locator(".cor-choice.is-selected", { hasText: "Pickup" })).toBeVisible();
    await expect(page.locator(".cor-store.is-selected", { hasText: "Hollywood" })).toBeVisible();
    await expect(page.getByText(/You’ll pick up at/)).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=when/);
    await expect(page.getByRole("heading", { name: "When and how many?" })).toBeVisible();

    await setHeadcount(page, 12);
    await expect(page.getByLabel("Number of people")).toHaveValue("12");

    await selectCalendarDate(page, 5);
    await expect(page.getByText(/Pickup time/)).toBeVisible();
    await selectFirstSlot(page);
    await expect(page.locator(".cor-slot.is-selected")).toBeVisible();
  });

  test("2. food: Chris's Way, Eddy's Way, a custom halal build, a named line with a note, plus one for someone else", async () => {
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=food/);
    await expect(page.getByRole("heading", { name: "What are we feeding them?" })).toBeVisible();

    // Chris's Way, qty 2.
    await openItemByName(page, "2 Sliders and Fries");
    await pickWay(page, "chris");
    await setItemQty(page, 2);
    await addItem(page);

    // Eddy's Way, qty 1 — the sheet resets fresh each time it's reopened.
    await openItemByName(page, "2 Sliders and Fries");
    await pickWay(page, "eddy");
    await setItemQty(page, 1);
    await addItem(page);

    // A custom build toggling individual toppings, plus Make it Halal, named
    // with a note.
    await openItemByName(page, "2 Sliders and Fries");
    await toggleTopping(page, "Lettuce");
    await toggleTopping(page, "Pickles");
    await toggleExtra(page, "Make it Halal");
    await fillItemForName(page, "Sam T.");
    await fillItemNote(page, "No onion please");
    await addItem(page);

    // A second named line with a note, on an item with no toppings.
    await openItemByName(page, "Grilled Cheese");
    await fillItemForName(page, "Priya S.");
    await fillItemNote(page, "Vegetarian, clean spot on the griddle");
    await addItem(page);
    await closeItemSheet(page);

    // "Add one for someone else" from the order sheet.
    await openOrderSheet(page);
    await expect(page.getByRole("dialog", { name: "Your order" })).toBeVisible();
    await page.getByRole("button", { name: "+ Add an order for one person" }).click();
    await expect(page.getByRole("dialog", { name: "2 Sliders and Fries" })).toBeVisible();
    await fillItemForName(page, "Jordan K.");
    await addItem(page);
    await closeItemSheet(page);
  });

  test("3. order sheet shows names/notes, a qty change, and a removed line", async () => {
    await openOrderSheet(page);
    const sheet = page.getByRole("dialog", { name: "Your order" });
    await expect(sheet).toBeVisible();

    await expect(sheet.getByText("For Sam T.")).toBeVisible();
    await expect(sheet.getByText("“No onion please”")).toBeVisible();
    await expect(sheet.getByText("For Priya S.")).toBeVisible();
    await expect(sheet.getByText("“Vegetarian, clean spot on the griddle”")).toBeVisible();
    await expect(sheet.getByText("For Jordan K.")).toBeVisible();
    await expect(sheet.locator(".cor-line")).toHaveCount(5);

    // Change qty on the Chris's Way line (2 -> 3) via Edit.
    const chrisLine = sheet.locator(".cor-line", { hasText: "Chris’s Way" });
    await chrisLine.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("dialog", { name: "2 Sliders and Fries" })).toBeVisible();
    await setItemQty(page, 3);
    await saveItem(page);

    await openOrderSheet(page);
    const sheet2 = page.getByRole("dialog", { name: "Your order" });
    await expect(
      sheet2.locator(".cor-line", { hasText: "Chris’s Way" }).locator(".cor-line-qty"),
    ).toHaveText("3");

    // Remove the Grilled Cheese (Priya) line.
    await sheet2
      .locator(".cor-line", { hasText: "For Priya S." })
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(sheet2.locator(".cor-line")).toHaveCount(4);
    await expect(sheet2.getByText("For Priya S.")).toHaveCount(0);

    await sheet2.getByRole("button", { name: "Done" }).click();
  });

  test("4. details: validation errors first (URL-driven skip-ahead), then a valid submit", async () => {
    // A direct step=review jump (no gate stops it — the step lives in the
    // URL) with contact details still blank: the review step's own submit
    // has to catch it, sending the customer back to "details" with errors
    // rather than letting an empty contact through to checkout.
    const reviewUrl = new URL(page.url());
    reviewUrl.searchParams.set("step", "review");
    await page.goto(reviewUrl.toString());
    await page.getByRole("button", { name: "Request catering" }).click();

    await expect(page).toHaveURL(/step=details/);
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await expect(page.getByText("Enter a valid email.")).toBeVisible();
    await expect(page.getByText("Enter a phone number.")).toBeVisible();

    await fillContactDetails(page, {
      name: "Chris Owner",
      email: "chris.owner@example.com",
      phone: "(818) 555-0100",
    });
    await expect(page.getByText("Enter your name.")).toHaveCount(0);
  });

  test("5. review: every line, a tip change updates the total, plates count", async () => {
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/step=review/);
    await expect(page.getByRole("heading", { name: "Check it, then send it" })).toBeVisible();

    // Scoped to `.cor-step`, the current step's own root: the order sheet
    // (`OrderSheet`/`Sheet`) stays mounted the whole time the builder is
    // open — just `inert` while closed, not unmounted — so it renders its
    // own copy of every line via the same `OrderLines` component. An
    // unscoped page-wide locator would double-count (or strict-mode-fail
    // on `getByText`) against that still-present, invisible copy.
    const reviewStep = page.locator(".cor-step");
    await expect(reviewStep.locator(".cor-line")).toHaveCount(4);
    await expect(reviewStep.getByText("For Sam T.")).toBeVisible();
    await expect(reviewStep.getByText("For Jordan K.")).toBeVisible();

    const totalBefore = await page.locator(".cor-review-total span").last().innerText();
    await page.getByRole("button", { name: "20%" }).click();
    await expect(page.locator(".cor-chip.is-selected", { hasText: "20%" })).toBeVisible();
    const totalAfter = await page.locator(".cor-review-total span").last().innerText();
    expect(totalAfter).not.toBe(totalBefore);

    await expect(page.getByLabel("Plate sets")).toHaveValue("0");
    await page.getByRole("button", { name: "More sets" }).click();
    await page.getByRole("button", { name: "More sets" }).click();
    await expect(page.getByLabel("Plate sets")).toHaveValue("2");
  });

  test("6. request -> sent page -> order link shows waiting", async () => {
    const token = await submitAndGetToken(page);
    await expect(page.getByRole("heading", { name: "Request sent." })).toBeVisible();
    await expect(page.getByText(/We’ll confirm within 24 hours/)).toBeVisible();

    await page.getByRole("link", { name: "View your order" }).click();
    await expect(page).toHaveURL(new RegExp(`/catering/o/${token}/`));
    await expect(page.locator(".cor-status-pill")).toHaveText("Waiting on us");
    await expect(page.getByText(/We’ll confirm by/)).toBeVisible();
    await expect(page.locator(".cor-line")).toHaveCount(4);
  });
});
