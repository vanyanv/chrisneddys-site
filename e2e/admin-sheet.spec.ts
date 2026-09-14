import { test, expect, type Locator, type Page } from "@playwright/test";
import { signInAsOwner } from "./helpers";

/**
 * Covers every owner flow of the products sheet (`/admin/products`), issue
 * #28. One `describe.serial` block with a single signed-in page so state
 * (price/stock edits, add/duplicate/archive, reorder) carries from one test
 * to the next the way an owner's real session would — each test starts from
 * whatever the previous one left in the database, not a fresh seed.
 *
 * Rows are looked up by their slug (`/foam-trucker-blue`, `/e2e-tee`, …)
 * rather than by product name: `duplicateProduct` copies the DB `name`
 * unchanged, so after a `router.refresh()` a duplicate's row briefly shows
 * an optimistic "<name> copy" label and then reverts to the same name as
 * the original — the slug is the only text that stays distinct.
 */

const FOAM_TRUCKER_SLUG = "foam-trucker-blue";

function rowBySlug(page: Page, slug: string): Locator {
  return page
    .locator(".adm-sheet-row")
    .filter({ has: page.getByText(`/${slug}`, { exact: true }) });
}

async function editCell(
  row: Locator,
  testId: "price-cell" | "stock-cell",
  labelPattern: RegExp,
  value: string,
  key: "Enter" | "Escape" = "Enter",
) {
  await row.getByTestId(testId).click();
  const input = row.getByLabel(labelPattern);
  await input.fill(value);
  await input.press(key);
}

/** Opens whichever row's "···" menu is currently rendered — only one row is
 * ever expanded at a time in these flows, and the menu only exists inside
 * the expanded row's footer (`RowMenu`), not on the collapsed row.
 *
 * `<details>`'s own accessible role is "group", named from the `<summary>`'s
 * text content ("···") rather than its `aria-label` — Chromium's
 * accessibility tree doesn't expose the summary as an independently
 * queryable "button" node, so `getByRole("button", { name: /^Actions for/ })`
 * never matches it; `data-testid="row-menu-trigger"` (added to `RowMenu.tsx`)
 * is the reliable handle. */
async function openRowMenu(page: Page) {
  const trigger = page.getByTestId("row-menu-trigger");
  await expect(trigger).toBeVisible();
  await trigger.click();
}

/** Expands `row` if it isn't already open — the "+ Add a product" row
 * auto-expands the product it just created (`submitAdd` calls `expandRow`),
 * so a row reached right after adding/duplicating may already be open; the
 * chevron's accessible name flips from "Expand …" to "Collapse …" once it
 * is, so a plain unconditional click on "Expand …" would hang forever. */
async function ensureExpanded(page: Page, row: Locator) {
  const expandBtn = row.getByRole("button", { name: /^Expand/ });
  if (await expandBtn.count()) await expandBtn.click();
  await expect(page.getByTestId("row-menu-trigger")).toBeVisible();
}

test.describe.serial("admin products sheet", () => {
  let page: Page;
  let foamTruckerId = "";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await signInAsOwner(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("1. sheet renders after sign-in", async () => {
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    await expect(page.getByText("1 product · 1 live", { exact: true })).toBeVisible();

    const row = rowBySlug(page, FOAM_TRUCKER_SLUG);
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: "Live", exact: true })).toBeVisible();

    foamTruckerId = (await row.getAttribute("data-id")) ?? "";
    expect(foamTruckerId).toBeTruthy();
  });

  test("2. editing price and stock collects into the Save bar, and Discard reverts both", async () => {
    const row = rowBySlug(page, FOAM_TRUCKER_SLUG);

    await editCell(row, "price-cell", /Price for/i, "52");
    await expect(page.getByText("1 change", { exact: true })).toBeVisible();

    // The editing-mode `<label>` always reads "Stock for …", even in edition
    // mode — "Edition size for …" is only the rest-state button's sr-only text.
    await editCell(row, "stock-cell", /Stock for/i, "60");
    await expect(page.getByText("2 changes", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Discard", exact: true }).click();

    await expect(page.getByText("1 change", { exact: true })).toHaveCount(0);
    await expect(page.getByText("2 changes", { exact: true })).toHaveCount(0);
    await expect(row.getByTestId("price-cell")).toContainText("$48.00");
    await expect(row.getByTestId("stock-cell")).toContainText("50 / 50");
  });

  // Flows 3 and 4 assert the real thing: `playwright.config.ts` pins
  // `DATABASE_URL` to `""` and `PGLITE_DATA_DIR` to `.pglite/e2e`, and
  // `hasDatabase()` (`src/db/client.ts`) treats a set `PGLITE_DATA_DIR` the
  // same as `DATABASE_URL` regardless of `NODE_ENV` — so `/shop/` reads the
  // same PGlite database the sheet just wrote to, not the static
  // `src/data/merch.ts` fallback. The actions already call
  // `revalidateTag("catalogue")` / `revalidatePath("/shop/")`
  // (`src/app/(admin)/admin/products/actions.ts`), which should make the
  // change visible on the very next request — `expect.poll` just absorbs any
  // scheduling wobble between the Save action's response and the next
  // `GET /shop/` picking up the revalidated render.
  async function shopHtml(): Promise<string> {
    return (await page.request.get("/shop/")).text();
  }

  test("3. saving a price change shows a toast and survives reload", async () => {
    const row = rowBySlug(page, FOAM_TRUCKER_SLUG);

    await editCell(row, "price-cell", /Price for/i, "52");
    await expect(page.getByText("1 change", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved");

    await page.reload();
    await expect(rowBySlug(page, FOAM_TRUCKER_SLUG).getByTestId("price-cell")).toContainText(
      "$52.00",
    );

    await expect.poll(shopHtml, { timeout: 10_000 }).toContain("$52");
  });

  // The product card's own heading ("THE FOAM TRUCKER", from
  // `product.displayName[0]`) — not a case-insensitive "Foam Trucker" match,
  // which would also hit `/shop/`'s static, hardcoded SEO
  // `<meta name="description">` ("...The Foam Trucker — Blue...", set in
  // this file above and rendered regardless of the product's live status).
  // The all-caps display name only ever comes from the actual product row.
  const FOAM_TRUCKER_HEADING = "THE FOAM TRUCKER";

  test("4. toggling Live flips the pill immediately, with a toast and an Undo", async () => {
    const row = rowBySlug(page, FOAM_TRUCKER_SLUG);

    await row.getByRole("button", { name: "Live", exact: true }).click();
    await expect(row.getByRole("button", { name: "Hidden", exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Now hidden from the shop");

    await expect.poll(shopHtml, { timeout: 10_000 }).not.toContain(FOAM_TRUCKER_HEADING);

    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(row.getByRole("button", { name: "Live", exact: true })).toBeVisible();

    await expect.poll(shopHtml, { timeout: 10_000 }).toContain(FOAM_TRUCKER_HEADING);
  });

  test("5. expanding a row, editing a display line, and reloading with ?open= keeps it open", async () => {
    await page.goto("/admin/products/");
    const row = rowBySlug(page, FOAM_TRUCKER_SLUG);

    await row.getByRole("button", { name: /^Expand/ }).click();
    await expect(page).toHaveURL(/\?open=/);
    const id = new URL(page.url()).searchParams.get("open") ?? "";
    expect(id).toBe(foamTruckerId);

    const displayLine1 = page.getByLabel("Display line 1", { exact: true });
    await expect(displayLine1).toBeVisible();
    await displayLine1.fill("THE FOAM TRUCKER E2E");
    await displayLine1.press("Tab");
    await expect(page.getByText("1 unsaved change", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved");

    await page.goto(`/admin/products/?open=${id}`);
    await expect(page).toHaveURL(new RegExp(`open=${id}`));
    await expect(page.getByLabel("Display line 1", { exact: true })).toHaveValue(
      "THE FOAM TRUCKER E2E",
    );

    await rowBySlug(page, FOAM_TRUCKER_SLUG)
      .getByRole("button", { name: /^Collapse/ })
      .click();
    await expect(page).not.toHaveURL(/\?open=/);
  });

  test("6. adding a product creates a hidden draft that stays hidden without a photo", async () => {
    await page.goto("/admin/products/");

    await page.getByRole("button", { name: "+ Add a product", exact: true }).click();
    // `startAdd()` focuses the name input from a `requestAnimationFrame`
    // callback (it isn't in the DOM yet when `+ Add a product` is clicked) —
    // waiting for that focus to land before typing avoids a race where a
    // late rAF steals focus back to the name field mid-fill, under this
    // sandbox's CPU contention observed leaking the price digits into it
    // ("E2E Tee32").
    const nameInput = page.getByLabel("New product name", { exact: true });
    await expect(nameInput).toBeFocused();
    await nameInput.fill("E2E Tee");
    await expect(nameInput).toHaveValue("E2E Tee");

    const priceInput = page.getByLabel("Price", { exact: true });
    await priceInput.fill("32");
    await expect(priceInput).toHaveValue("32");

    await page.getByRole("button", { name: "Add", exact: true }).click();

    const newRow = rowBySlug(page, "e2e-tee");
    await expect(newRow).toBeVisible();
    await expect(newRow.getByRole("button", { name: "Hidden", exact: true })).toBeVisible();

    // It was never published, so it was never in the catalogue `/shop/`
    // reads to begin with — no polling needed, unlike tests 3 and 4 above,
    // since there's no revalidation to wait on for something that was never
    // there.
    expect(await shopHtml()).not.toContain("E2E Tee");

    await newRow.getByRole("button", { name: "Hidden", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(/photo/i);
    await expect(newRow.getByRole("button", { name: "Hidden", exact: true })).toBeVisible();
  });

  test("7. duplicating and archiving/restoring a product", async () => {
    const row = rowBySlug(page, "e2e-tee");
    await ensureExpanded(page, row);

    await openRowMenu(page);
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page.getByRole("status")).toContainText("Duplicated as");
    await expect(rowBySlug(page, "e2e-tee-copy")).toBeVisible();

    await openRowMenu(page);
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await expect(page.getByRole("status")).toContainText("Archived");
    await expect(rowBySlug(page, "e2e-tee")).toHaveCount(0);

    await page.getByText(/^Archived \(\d+\)$/).click();
    await expect(page.getByText("/e2e-tee", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Restore", exact: true }).click();

    await expect(rowBySlug(page, "e2e-tee")).toBeVisible();
  });

  test("8. reordering a row (Move up) persists across reload", async () => {
    const rows = page.locator(".adm-sheet-row");
    const beforeCount = await rows.count();
    const lastRow = rows.nth(beforeCount - 1);
    const movedSlug = await lastRow.locator(".adm-name-cell-slug").innerText();

    await ensureExpanded(page, lastRow);
    await openRowMenu(page);
    await page.getByRole("menuitem", { name: "Move up" }).click();
    await expect(page.getByRole("status")).toContainText("Order saved");

    const orderAfterMove = await page.locator(".adm-name-cell-slug").allInnerTexts();
    // The moved row should no longer be last.
    expect(orderAfterMove[orderAfterMove.length - 1]).not.toBe(movedSlug);

    await page.reload();
    const orderAfterReload = await page.locator(".adm-name-cell-slug").allInnerTexts();
    expect(orderAfterReload).toEqual(orderAfterMove);
  });

  test("9. Escape reverts an edited cell; Control+S saves a pending change", async () => {
    await page.goto("/admin/products/");
    const row = rowBySlug(page, FOAM_TRUCKER_SLUG);

    await editCell(row, "price-cell", /Price for/i, "99", "Escape");
    await expect(row.getByTestId("price-cell")).toContainText("$52.00");
    // The Save bar's count span always renders in the DOM ("0 changes"
    // rather than being removed when the pending map is empty), but its
    // `.adm-savebar` ancestor is translated off-screen until a change is
    // pending, so it's genuinely not visible — the Save button inside it
    // is the clean, accessible check that no change is pending.
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeHidden();

    await editCell(row, "price-cell", /Price for/i, "55");
    await expect(page.getByText("1 change", { exact: true })).toBeVisible();

    await page.keyboard.press("Control+S");
    await expect(page.getByRole("status")).toContainText("Saved");
    await expect(row.getByTestId("price-cell")).toContainText("$55.00");
  });

  test("10. the sheet has exactly one Save button (inside the Save bar); the standalone editor renders", async () => {
    await page.goto("/admin/products/");
    const row = rowBySlug(page, FOAM_TRUCKER_SLUG);

    // The Save bar (and its Save button) is translated off-screen and
    // pruned from the accessibility tree entirely while no change is
    // pending — a `getByRole` query for it only resolves to anything once
    // there's a reason for it to be on screen, so make one pending.
    await editCell(row, "price-cell", /Price for/i, "56");
    await expect(page.getByText("1 change", { exact: true })).toBeVisible();

    const saveButtons = page.getByRole("button", { name: "Save", exact: true });
    await expect(saveButtons).toHaveCount(1);
    await expect(
      page.locator(".adm-savebar").getByRole("button", { name: "Save", exact: true }),
    ).toHaveCount(1);

    await page.getByRole("button", { name: "Discard", exact: true }).click();

    await page.goto(`/admin/products/${foamTruckerId}/`);
    await expect(page.getByRole("link", { name: /All products/i })).toBeVisible();
  });
});

test.describe("admin products sheet — phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("11. the sheet renders two-line rows, a FAB, and a full-screen expanded row", async ({
    page,
  }) => {
    await signInAsOwner(page);

    const row = rowBySlug(page, FOAM_TRUCKER_SLUG);
    await expect(row).toBeVisible();
    await expect(row.getByTestId("price-cell")).toBeVisible();
    await expect(row.getByTestId("stock-cell")).toBeVisible();

    await expect(page.getByRole("button", { name: "New product", exact: true })).toBeVisible();

    await row.getByTestId("name-cell").click();
    await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
  });
});
