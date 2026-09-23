import { test, expect, type Page } from "@playwright/test";
import { signInAsOwner } from "./helpers";

/**
 * Covers issue #43's one hard constraint, drawn on the design canvas:
 * "EVERY PAGE STAYS UP AND EVERY LINK STILL WORKS. ONLY THE BUY BUTTON
 * CHANGES." Everything below is against a real running build, not the
 * decision-logic unit tests (`src/lib/shopStatus.test.ts`,
 * `src/lib/shopCopy.test.ts`) that already cover `isShopPausedFor` and the
 * pause copy in isolation — those can't catch a future change that starts
 * 404ing a paused product page or dropping it from the shop index, since
 * neither of those is a decision `isShopPausedFor` itself makes.
 *
 * One `describe.serial` block sharing a single signed-in page, same shape as
 * `admin-settings.spec.ts` and `admin-run.spec.ts`. The pause state is set
 * the way the app really sets it — the `/admin/settings` Settings form,
 * never a direct database write — following the pattern `admin-settings
 * .spec.ts` already establishes for every other field on that form.
 *
 * `isShopOpenFor(settings)` (`src/lib/shopStatus.ts`) is the other half of
 * `paused` on both storefront pages (`paused = shopOpen &&
 * isShopPausedFor(settings)`), and it requires BOTH Stripe env vars AND a
 * published returns policy. This spec is what actually needs the shop to be
 * "open" so pausing it means something (see `playwright.config.ts`'s
 * `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` comment for why those are now
 * non-empty placeholders) — it sets a returns policy through the same form,
 * and restores it afterwards for the same reason it restores the pause
 * toggle: nothing here should still be true once this file is done running.
 *
 * Serial specs in this repo are NOT idempotent — they mutate shared state —
 * so every setting this file changes (`returnsPolicy`, `shopPaused`,
 * `pauseNote`) is put back in `afterAll`, which Playwright still runs even
 * if an earlier test in this block fails.
 */

const SLUG = "foam-trucker-blue";
const PAUSE_NOTE = "Back Thursday — e2e";

/**
 * Clicks Save and waits for the "Settings saved" toast, on the config's
 * default 15s expect timeout.
 *
 * This used to wait 45 seconds, as a cushion for issue #38. Two earlier
 * explanations for that were wrong: first that the save queued behind its
 * own `revalidatePath` fan-out on PGlite's single connection, then that
 * nothing could be done about it at all. What the toast actually waited on
 * was Next's *implicit* re-render of `/admin/settings` after any Server
 * Action that revalidates something — and `saveStoreSettings` now does its
 * revalidation inside `after()`, so that re-render never runs in the
 * response the toast arrives in. The save itself finishes in single-digit
 * milliseconds.
 *
 * So there is nothing left for a cushion to cover, and a 45s ceiling would
 * let the whole defect come back without this suite noticing. It waits the
 * same 15s every other settings save in `admin-settings.spec.ts` waits.
 */
async function save(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Settings saved", { exact: true })).toBeVisible();
}

test.describe.serial("shop pause (issue #43)", () => {
  let page: Page;
  let originalReturnsPolicy = "";
  let originalPaused = false;
  let originalPauseNote = "";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await signInAsOwner(page);
    await page.goto("/admin/settings");

    // Recorded, not assumed, so `afterAll` restores whatever was really
    // here — including if some earlier spec ever leaves a returns policy
    // or a pause note behind.
    originalReturnsPolicy = await page.getByLabel("Returns policy", { exact: true }).inputValue();
    originalPaused = await page.getByLabel("Pause the shop", { exact: true }).isChecked();
    originalPauseNote = await page
      .getByLabel("Note to customers (optional)", { exact: true })
      .inputValue();
  });

  test.afterAll(async () => {
    await page.goto("/admin/settings");

    await page.getByLabel("Returns policy", { exact: true }).fill(originalReturnsPolicy);
    const pauseCheckbox = page.getByLabel("Pause the shop", { exact: true });
    if ((await pauseCheckbox.isChecked()) !== originalPaused) {
      if (originalPaused) await pauseCheckbox.check();
      else await pauseCheckbox.uncheck();
    }
    await page.getByLabel("Note to customers (optional)", { exact: true }).fill(originalPauseNote);

    await save(page);

    await page.close();
  });

  test("1. the Settings form opens the shop and pauses it with a note", async () => {
    await page
      .getByLabel("Returns policy", { exact: true })
      .fill(
        "Returns accepted within 14 days of delivery, unworn and with tags attached. Email support to start one.",
      );
    await page.getByLabel("Pause the shop", { exact: true }).check();
    await page.getByLabel("Note to customers (optional)", { exact: true }).fill(PAUSE_NOTE);

    await save(page);

    // `shopOpen` is a server-computed prop passed down from the page's own
    // Server Component, not something the form updates live — reload to
    // read it fresh, same as `admin-settings.spec.ts` test 5 does for
    // persisted pickup state. Confirms the fixture actually reached "open" —
    // a returns policy is the other half of `isShopOpenFor` alongside the
    // Stripe env vars — so a later test failing here reads as "the shop
    // never opened," not silently passing against a still pre-launch
    // product page. Scoped to the shop-status card specifically: `.adm-pill`
    // also styles each Connections row's own "Connected"/"Missing …" pill.
    await page.reload();
    await expect(page.locator(".rack-settings-shop-card .adm-pill")).toHaveText("Open");
  });

  test("2. a paused product page is still 200, still real, and only the buy control changed", async () => {
    const response = await page.goto(`/shop/${SLUG}/`);
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(`/shop/${SLUG}/`);

    // Real content, untouched by the pause: the product name, the price,
    // and the "N of M left" line. Not a specific dollar figure: `admin-sheet
    // .spec.ts` (like this file) mutates the shared catalogue and leaves its
    // price edits in place rather than reverting them, so by the time this
    // spec runs the real price is whatever that file last saved it as —
    // asserting the shape rather than a value is what makes this correct
    // regardless of run order.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/FOAM TRUCKER/i);
    await expect(page.locator(".cne-pdp-price")).toContainText(/^\$\d+\.\d{2}$/);
    await expect(page.locator(".cne-pdp-buy .cne-inv-text")).toContainText(
      /\d+ OF \d+ LEFT|SOLD OUT/,
    );

    // Only the buy control and its pill/card changed: the pause pill, the
    // owner's note in the pause card, and a disabled button carrying that
    // same note — on both the desktop row and the phone's sticky bar.
    await expect(page.locator(".cne-status-pill.is-paused")).toContainText("Shop paused");
    await expect(page.locator(".cne-pause-card")).toContainText(PAUSE_NOTE);

    const buyButton = page.locator(".cne-pdp-row .cne-btn-primary.is-paused");
    await expect(buyButton).toBeVisible();
    await expect(buyButton).toBeDisabled();
    await expect(buyButton).toHaveText(PAUSE_NOTE.toUpperCase());

    const stickyButton = page.locator(".cne-pdp-sticky .cne-btn-primary.is-paused");
    await expect(stickyButton).toBeDisabled();
    await expect(stickyButton).toHaveText(PAUSE_NOTE.toUpperCase());
  });

  test("3. the shop index still lists the product and the link to it still works", async () => {
    const response = await page.goto("/shop/");
    expect(response?.status()).toBe(200);

    const card = page.locator(".cne-drop").filter({ hasText: /FOAM TRUCKER/i });
    await expect(card).toBeVisible();
    await expect(card.locator(".cne-drop-go")).toHaveText("SHOP PAUSED");

    await card.click();
    await expect(page).toHaveURL(new RegExp(`/shop/${SLUG}/?$`));
    const response2 = await page.reload();
    expect(response2?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/FOAM TRUCKER/i);
  });

  test("4. unpausing restores the normal buy button", async () => {
    await page.goto("/admin/settings");
    await page.getByLabel("Pause the shop", { exact: true }).uncheck();
    await save(page);

    await page.goto(`/shop/${SLUG}/`);
    await expect(page.locator(".cne-status-pill.is-paused")).toHaveCount(0);
    await expect(page.locator(".cne-pause-card")).toHaveCount(0);

    const buyButton = page.locator(".cne-pdp-row .cne-btn-primary");
    await expect(buyButton).toBeEnabled();
    await expect(buyButton).toContainText("ADD TO BAG");
  });

  // 5. Sold-out precedence over paused (`ProductBuy.tsx`'s `soldOut` branch
  // is checked before `paused`) is skipped here rather than faked. The
  // catalogue has exactly one product, a 50-number numbered edition
  // (`e2e/db-warmup.mjs`, `e2e/admin-run.spec.ts`), and there is no
  // "mark sold out" switch anywhere in `/admin` — the only way to make it
  // genuinely `SOLD OUT` is to drive all 50 editions to `sold`, which means
  // either ~50 real checkout+webhook round trips (Stripe is a placeholder in
  // this harness — see `playwright.config.ts` — so there's no webhook to
  // call) or writing sold rows into the `editions` table directly, which
  // this spec is deliberately not doing and which `admin-run.spec.ts` and
  // `admin-sheet.spec.ts` both depend on staying at its seeded counts. Unlike
  // pausing, that isn't a settings toggle this file could flip back off
  // afterwards — it would be a one-way change to the one product every other
  // spec in this suite shares. `src/lib/shopStatus.test.ts` and the
  // `soldOut`-before-`paused` branch in `ProductBuy.tsx` (see its own
  // comment) already cover the precedence itself; this is excessive fixture
  // work for the same fact restated at the Playwright level.
  //
  // `test.skip(title, body)` (not the bare `test.skip(condition)` form,
  // which — called outside a test body — skips every test in the enclosing
  // `describe` rather than just this one) declares a single skipped test so
  // the reason shows up in the run's own output instead of only in this
  // comment.
  test.skip("5. sold-out precedence — skipped, see comment above", async () => {});
});
