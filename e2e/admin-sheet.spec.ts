import { test, expect, type Locator, type Page } from "@playwright/test";
import { signInAsOwner } from "./helpers";

/**
 * Covers every owner flow of The Rack's catalogue (`/admin/products`), issue
 * #36 phase 2 — this file replaces The Sheet's UI (issue #28) it used to
 * cover, porting each spec's *intent* onto the new card-grid-plus-detail-
 * panel design rather than dropping coverage. One `describe.serial` block
 * with a single signed-in page, same as before, so state (price/run-size
 * edits, add/duplicate/archive, reorder) carries from one test to the next.
 *
 * Two capabilities changed shape enough to need a note rather than a literal
 * port, both called out at their test below:
 *  - The old Sheet's click-to-edit table cells (an explicit "editing" mode,
 *    Escape reverts, Enter commits) are now plain always-editable fields in
 *    the panel, matching the design's artboards. Escape-reverts-a-pending-
 *    edit is still real (the fields reset their own value and blur on
 *    Escape — see `revertOnEscape` in `RackProductPanel.tsx`) so spec 9's
 *    assertion still holds; there is no separate "editing mode" to leave
 *    without it, so that part of the old test's shape doesn't apply.
 *  - The design has no phone-specific FAB or two-line row for Products (only
 *    Today, `/admin`, got a phone artboard this issue) — spec 11 checks what
 *    the design actually gives phone-width users instead: the same card
 *    grid, reachable "New product" controls, and a full-screen panel.
 *
 * Cards are looked up by `data-slug` (mirrors `data-id`, added for the one
 * spot a test needs the id directly) rather than by name: `duplicateProduct`
 * copies `displayName1`/`displayName2` unchanged, so after a `router.refresh()`
 * a duplicate's card briefly shows nothing distinct in its title either — the
 * slug (with its own `-copy` suffix) is what's guaranteed unique.
 */

const FOAM_TRUCKER_SLUG = "foam-trucker-blue";

function cardBySlug(page: Page, slug: string): Locator {
  return page.locator(`[data-testid="product-card"][data-slug="${slug}"]`);
}

function panel(page: Page): Locator {
  return page.getByTestId("product-panel");
}

function openIdFrom(page: Page): string {
  return new URL(page.url()).searchParams.get("open") ?? "";
}

/** Opens `card`'s panel if it isn't already the one open, and waits for its
 * content to actually mount (the panel lazy-loads the full product on open,
 * same as the old Sheet's expanded row). */
async function openCard(page: Page, card: Locator): Promise<void> {
  const alreadyOpen = (await card.getAttribute("class"))?.includes("is-open");
  if (!alreadyOpen) await card.click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByTestId("row-menu-trigger")).toBeVisible();
}

async function openRowMenu(page: Page) {
  const trigger = panel(page).getByTestId("row-menu-trigger");
  await trigger.click();
}

test.describe.serial("admin products — the rack's catalogue", () => {
  let page: Page;
  let foamTruckerId = "";
  let e2eTeeId = "";
  let e2eTeeSlug = "";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await signInAsOwner(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("1. the catalogue renders after sign-in", async () => {
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    await expect(page.getByText("1 product · 1 live", { exact: true })).toBeVisible();

    const card = cardBySlug(page, FOAM_TRUCKER_SLUG);
    await expect(card).toBeVisible();
    await expect(card.locator(".rack-pill")).toHaveText("Live");

    foamTruckerId = (await card.getAttribute("data-id")) ?? "";
    expect(foamTruckerId).toBeTruthy();
  });

  test("2. editing price and per-order limit collects into the Save bar, and Discard reverts both", async () => {
    const card = cardBySlug(page, FOAM_TRUCKER_SLUG);
    await openCard(page, card);

    const priceInput = panel(page).getByLabel("Price", { exact: true });
    await priceInput.fill("52");
    await priceInput.press("Tab");
    await expect(page.getByText("1 change", { exact: true })).toBeVisible();

    // Not "Edition size": issue #36 phase 3 locks that field for good once
    // anything in the run has sold, and `e2e/db-warmup.mjs` seeds this exact
    // product with sold numbers before the server even starts — so "Limit
    // per order" stands in as the second ordinary field here, same Save-bar/
    // Discard mechanics, on a field that's still genuinely editable.
    const limitInput = panel(page).getByLabel("Limit per order", { exact: true });
    const originalLimit = await limitInput.inputValue();
    await limitInput.fill("3");
    await limitInput.press("Tab");
    await expect(page.getByText("2 changes", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Discard", exact: true }).click();

    await expect(page.getByText("1 change", { exact: true })).toHaveCount(0);
    await expect(page.getByText("2 changes", { exact: true })).toHaveCount(0);
    await expect(priceInput).toHaveValue("48.00");
    await expect(limitInput).toHaveValue(originalLimit);
  });

  // Specs 3 and 4 assert the real thing: `playwright.config.ts` pins
  // `DATABASE_URL` to `""` and `PGLITE_DATA_DIR` to `.pglite/e2e`, and
  // `hasDatabase()` (`src/db/client.ts`) treats a set `PGLITE_DATA_DIR` the
  // same as `DATABASE_URL` regardless of `NODE_ENV` — so `/shop/` reads the
  // same PGlite database the panel just wrote to, not the static
  // `src/data/merch.ts` fallback. `expect.poll` absorbs any scheduling
  // wobble between the Save action's response and the next `GET /shop/`
  // picking up the revalidated render.
  async function shopHtml(): Promise<string> {
    return (await page.request.get("/shop/")).text();
  }

  test("3. saving a price change shows a toast and survives reload", async () => {
    const card = cardBySlug(page, FOAM_TRUCKER_SLUG);
    await openCard(page, card);

    const priceInput = panel(page).getByLabel("Price", { exact: true });
    await priceInput.fill("52");
    await priceInput.press("Tab");
    await expect(page.getByText("1 change", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved");

    await page.reload();
    await expect(cardBySlug(page, FOAM_TRUCKER_SLUG).locator(".rack-card-price")).toHaveText(
      "$52.00",
    );

    await expect.poll(shopHtml, { timeout: 10_000 }).toContain("$52");
  });

  // The shop heading's first line only (`displayName1`) — the rendered
  // `<h2>` puts `displayName1` and `displayName2` either side of a `<br>`,
  // so they're never one contiguous string in the raw HTML this polls; and
  // this can't be a case-insensitive "Foam Trucker" match either, since
  // that would also hit `/shop/`'s static, hardcoded SEO
  // `<meta name="description">`, rendered regardless of the product's live
  // status.
  const FOAM_TRUCKER_HEADING = "THE FOAM TRUCKER";

  test("4. the Draft/Live status chips flip the card immediately, with a toast and an Undo", async () => {
    const card = cardBySlug(page, FOAM_TRUCKER_SLUG);
    await openCard(page, card);

    await panel(page).getByRole("button", { name: "Draft", exact: true }).click();
    await expect(card.locator(".rack-pill")).toHaveText("Draft");
    await expect(page.getByRole("status")).toContainText("Now hidden from the shop");

    await expect.poll(shopHtml, { timeout: 10_000 }).not.toContain(FOAM_TRUCKER_HEADING);

    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(card.locator(".rack-pill")).toHaveText("Live");

    await expect.poll(shopHtml, { timeout: 10_000 }).toContain(FOAM_TRUCKER_HEADING);
  });

  test("5. opening a card, editing a name line, and reloading with ?open= keeps it open", async () => {
    await page.goto("/admin/products/");
    const card = cardBySlug(page, FOAM_TRUCKER_SLUG);

    await card.click();
    await expect(page).toHaveURL(/\?open=/);
    expect(openIdFrom(page)).toBe(foamTruckerId);

    const nameLine1 = panel(page).getByLabel("Name line 1", { exact: true });
    await expect(nameLine1).toBeVisible();
    await nameLine1.fill("THE FOAM TRUCKER E2E");
    await nameLine1.press("Tab");
    await expect(page.getByText("1 unsaved change", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved");

    await page.goto(`/admin/products/?open=${foamTruckerId}`);
    await expect(page).toHaveURL(new RegExp(`open=${foamTruckerId}`));
    await expect(panel(page).getByLabel("Name line 1", { exact: true })).toHaveValue(
      "THE FOAM TRUCKER E2E",
    );

    await cardBySlug(page, FOAM_TRUCKER_SLUG).click();
    await expect(page).not.toHaveURL(/\?open=/);
    // Left renamed on purpose, same as the old Sheet's equivalent spec: every
    // spec after this one looks products up by slug, not by name.
  });

  test("6. adding a product creates a hidden draft that stays hidden without a photo", async () => {
    await page.goto("/admin/products/");

    // The rack's "New product" creates a nameless draft directly — no name
    // prompt first (issue #36's decisions comment: an unnamed draft is a
    // first-class state) — so the panel opens on an empty product straight
    // away, and this is also where the unnamed-draft honesty gets checked.
    await page.getByRole("button", { name: "New product", exact: true }).click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole("heading", { name: "No name yet" })).toBeVisible();
    await expect(page).toHaveURL(/\?open=/);

    e2eTeeId = openIdFrom(page);
    expect(e2eTeeId).toBeTruthy();
    e2eTeeSlug =
      (await page
        .locator(`[data-testid="product-card"][data-id="${e2eTeeId}"]`)
        .getAttribute("data-slug")) ?? "";
    expect(e2eTeeSlug).toBeTruthy();

    const nameInput = panel(page).getByLabel("Name line 1", { exact: true });
    await nameInput.fill("E2E TEE");
    await nameInput.press("Tab");
    await expect(page.getByText("1 unsaved change", { exact: true })).toBeVisible();

    const priceInput = panel(page).getByLabel("Price", { exact: true });
    await priceInput.fill("32");
    await priceInput.press("Tab");

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved");

    const card = page.locator(`[data-testid="product-card"][data-id="${e2eTeeId}"]`);
    await expect(card).toBeVisible();
    await expect(card.locator(".rack-pill")).toHaveText("Draft");

    // It was never published, so it was never in the catalogue `/shop/`
    // reads to begin with — no polling needed, unlike specs 3-4 above,
    // since there's no revalidation to wait on for something that was never
    // there.
    expect(await shopHtml()).not.toContain("E2E TEE");

    // Give it a run size (but still no photo) so the chip's refusal below
    // is specifically the photo gate, not the run-size one — both are real,
    // data-layer-enforced gates now (`setStatus` in `@/lib/catalogAdmin`),
    // and isolating them here is what proves this test is still about the
    // photo, not a different gate firing first.
    await panel(page).locator("summary", { hasText: "More details" }).click();
    await panel(page).getByRole("button", { name: "Count", exact: true }).click();

    await panel(page).getByRole("button", { name: "Live", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(/photo/i);
    await expect(card.locator(".rack-pill")).toHaveText("Draft");
  });

  test("7. duplicating and archiving/restoring a product", async () => {
    const card = page.locator(`[data-testid="product-card"][data-id="${e2eTeeId}"]`);
    await openCard(page, card);

    await openRowMenu(page);
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page.getByRole("status")).toContainText("Duplicated");

    const dupSlug = `${e2eTeeSlug}-copy`;
    const dupCard = cardBySlug(page, dupSlug);
    await expect(dupCard).toBeVisible();

    await openCard(page, dupCard);
    await panel(page).getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Archived");
    await expect(cardBySlug(page, dupSlug)).toHaveCount(0);

    await page.getByText(/^Archived \(\d+\)$/).click();
    // Scope to the archived row for THIS slug rather than clicking the only
    // Restore on the page: the archive is shared across spec files, and
    // `e2e/admin-run.spec.ts` (which sorts first) parks its own scratch
    // draft there, so an unscoped `getByRole("button", { name: "Restore" })`
    // is a strict-mode violation the moment anything else is archived.
    const archivedRow = page.locator(".rack-archived-row").filter({ hasText: `/${dupSlug}` });
    await expect(archivedRow).toBeVisible();
    await archivedRow.getByRole("button", { name: "Restore", exact: true }).click();

    await expect(cardBySlug(page, dupSlug)).toBeVisible();
  });

  // Known pre-existing failure, not introduced by this port — tracked as
  // issue #37. If it still fails here, that's expected; if this port
  // happens to fix it, that's worth flagging in the PR, not this comment.
  test("8. reordering a card (Move up) persists across reload", async () => {
    const cards = page.locator('[data-testid="product-card"]');
    const beforeCount = await cards.count();
    const lastCard = cards.nth(beforeCount - 1);
    const movedSlug = await lastCard.getAttribute("data-slug");

    await openCard(page, lastCard);
    await openRowMenu(page);
    await page.getByRole("menuitem", { name: "Move up" }).click();
    await expect(page.getByRole("status")).toContainText("Order saved");

    const orderAfterMove = await page
      .locator('[data-testid="product-card"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-slug")));
    expect(orderAfterMove[orderAfterMove.length - 1]).not.toBe(movedSlug);

    await page.reload();
    const orderAfterReload = await page
      .locator('[data-testid="product-card"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-slug")));
    expect(orderAfterReload).toEqual(orderAfterMove);
  });

  test("9. Escape reverts a pending edit; Control+S saves one", async () => {
    await page.goto("/admin/products/");
    const card = cardBySlug(page, FOAM_TRUCKER_SLUG);
    await openCard(page, card);

    // 52.00, not the original 48.00: spec 3 above already saved a price
    // change, and nothing since has touched it back.
    const priceInput = panel(page).getByLabel("Price", { exact: true });
    await priceInput.fill("99");
    await priceInput.press("Escape");
    await expect(priceInput).toHaveValue("52.00");
    // The Save bar's count span always renders in the DOM ("0 changes"
    // rather than being removed when the pending map is empty), but its
    // `.adm-savebar` ancestor is translated off-screen until a change is
    // pending, so it's genuinely not visible — the Save button inside it is
    // the clean, accessible check that nothing is pending.
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeHidden();

    await priceInput.fill("55");
    await priceInput.press("Tab");
    await expect(page.getByText("1 change", { exact: true })).toBeVisible();

    await page.keyboard.press("Control+S");
    await expect(page.getByRole("status")).toContainText("Saved");
    await expect(cardBySlug(page, FOAM_TRUCKER_SLUG).locator(".rack-card-price")).toHaveText(
      "$55.00",
    );
  });

  test("10. exactly one Save button (inside the Save bar); the standalone full editor still renders", async () => {
    await page.goto("/admin/products/");
    const card = cardBySlug(page, FOAM_TRUCKER_SLUG);
    await openCard(page, card);

    // The Save bar (and its Save button) is translated off-screen and
    // pruned from the accessibility tree entirely while no change is
    // pending — make one pending so a `getByRole` query resolves to it.
    const priceInput = panel(page).getByLabel("Price", { exact: true });
    await priceInput.fill("56");
    await priceInput.press("Tab");
    await expect(page.getByText("1 change", { exact: true })).toBeVisible();

    const saveButtons = page.getByRole("button", { name: "Save", exact: true });
    await expect(saveButtons).toHaveCount(1);
    await expect(
      page.locator(".adm-savebar").getByRole("button", { name: "Save", exact: true }),
    ).toHaveCount(1);

    await page.getByRole("button", { name: "Discard", exact: true }).click();

    // Deliberately unchanged in this phase — see `RackProductPanel.tsx`'s
    // menu ("Open full editor") and `admin/layout.tsx`'s comment on why
    // `/admin/products/<id>` still gets the old Sheet chrome.
    await page.goto(`/admin/products/${foamTruckerId}/`);
    await expect(page.getByRole("link", { name: /All products/i })).toBeVisible();
  });
});

test.describe("admin products — the rack's catalogue — phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("11. phone width: cards stay reachable, and a card opens a full-screen panel", async ({
    page,
  }) => {
    await signInAsOwner(page);

    // No FAB and no two-line table row in this design (only Today, `/admin`,
    // got a phone artboard this issue) — what phone width actually gives a
    // products owner is the same card grid, both "New product" controls
    // still on screen, and a full-screen panel once a card is tapped.
    const card = cardBySlug(page, FOAM_TRUCKER_SLUG);
    await expect(card).toBeVisible();
    await expect(card.locator(".rack-card-price")).toBeVisible();

    await expect(page.getByRole("button", { name: "New product", exact: true })).toBeVisible();

    await card.click();
    await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
    await expect(panel(page)).toBeVisible();
  });
});
