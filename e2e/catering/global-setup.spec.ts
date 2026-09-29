import { test } from "@playwright/test";
import { enableCateringOrdering } from "./helpers";

/**
 * Its own project (`catering-setup`, `playwright.config.ts`), which both
 * `catering-phone` and `catering-desktop` declare as a `dependencies` entry
 * — Playwright then runs this project's one test exactly once, before
 * either of them, instead of once per project the way a plain `globalSetup`
 * script would still need duplicating logic for. Turns catering ordering ON
 * through the real admin UI (`enableCateringOrdering`, same helper
 * `ordering-toggle.spec.ts` itself uses) — the one place in the whole
 * catering suite that needs to, since that's a Server Action running
 * inside the actual `next start` process, so it's the only thing that can
 * revalidate the storefront pages that read `orderingOn`
 * (`saveCateringSettingsAction` in `src/app/(admin)/admin/catering/
 * settingsActions.ts`; see that file's module comment). A direct
 * `UPDATE catering_settings` from a separate `node` process, run while
 * `next start` already has that same PGlite data directory open, doesn't
 * just fail to invalidate that process's Router Cache — `src/db/client.ts`'s
 * own module comment documents why a second live PGlite instance on one
 * data directory doesn't work at all, and in practice the write stalls
 * fighting the running server for the same on-disk files for anywhere from
 * tens of seconds to several minutes. So there's no direct-DB shortcut for
 * this at all: every catering spec but `ordering-toggle.spec.ts` (which
 * needs the toggle itself, both directions) and `lead-time.spec.ts`'s
 * day-off step (a real settings change of its own) relies entirely on this
 * project having already turned ordering on, once, before it runs.
 *
 * Runs as an ordinary Playwright test (not a hand-rolled `chromium.launch`
 * script) specifically so it inherits the exact same context options,
 * launch options and `expect.timeout` every other catering spec gets from
 * its project's `use` block — a bare script driving its own browser instance
 * doesn't, and silently missing that timeout is what made this flaky
 * against a cold first `next start` request.
 */
test("turn catering ordering on", async ({ page }) => {
  await enableCateringOrdering(page);
});
