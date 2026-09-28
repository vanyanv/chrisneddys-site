import { test, expect } from "@playwright/test";
import { signInAsOwner } from "../helpers";

/**
 * Flow 11: the admin crew ticket shows per-item builds with counts and
 * named lines, and the labels page shows one label per named person. Uses
 * the seeded "round-3" order from `e2e/seed-catering.mjs`, wired into
 * `e2e/db-warmup.mjs` so it exists before the app even starts. Issue #190.
 */
test.describe("flow 11: admin crew ticket and labels", () => {
  test("crew ticket: per-item builds with counts, and named lines", async ({ page, context }) => {
    await signInAsOwner(page);
    await page.goto("/admin/catering");
    await page.getByLabel("Search catering orders").fill("Northlight");
    await page.locator(".cat-row", { hasText: "Northlight Pictures" }).click();

    const [ticket] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("link", { name: "Crew ticket", exact: true }).click(),
    ]);
    await ticket.waitForLoadState();

    const slidersGroup = ticket.locator(".cat-make-list-group", { hasText: "2 Sliders and Fries" });
    await expect(slidersGroup).toBeVisible();
    await expect(slidersGroup.locator(".cat-make-list-count")).toHaveText("× 56");

    const chrisBuild = slidersGroup.locator(".cat-build-row", { hasText: "Chris’s Way" });
    await expect(chrisBuild.locator(".cat-build-count")).toHaveText("30");

    const eddyBuild = slidersGroup.locator(".cat-build-row", { hasText: "Eddy’s Way" });
    await expect(eddyBuild.locator(".cat-build-count")).toHaveText("20");

    const halalBuild = slidersGroup.locator(".cat-build-row.is-halal");
    await expect(halalBuild.locator(".cat-build-count")).toHaveText("6");
    // `.cat-build-names` renders twice when a build has both names and a
    // note (the crew ticket's own markup) — the names line always comes
    // first, so `.first()` is the names line, never the quoted note.
    await expect(halalBuild.locator(".cat-build-names").first()).toContainText("Halal table");

    // Named orders table: Dev Patel, Priya S., Marcus L., Jordan K.
    const namedTable = ticket.locator(".cat-named-table");
    await expect(namedTable.getByText("Dev Patel")).toBeVisible();
    await expect(namedTable.getByText("Priya S.")).toBeVisible();
    await expect(namedTable.getByText("Marcus L.")).toBeVisible();
    await expect(namedTable.getByText("Jordan K.")).toBeVisible();

    await ticket.close();
  });

  test("labels page: one label per named person", async ({ page, context }) => {
    await signInAsOwner(page);
    await page.goto("/admin/catering");
    await page.getByLabel("Search catering orders").fill("Northlight");
    await page.locator(".cat-row", { hasText: "Northlight Pictures" }).click();

    const [labels] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("link", { name: "Labels", exact: true }).click(),
    ]);
    await labels.waitForLoadState();

    const named = ["Halal table", "Dev Patel", "Priya S.", "Marcus L.", "Jordan K."];
    for (const name of named) {
      await expect(labels.locator(".cat-label-name", { hasText: name })).toHaveCount(1);
    }
    await labels.close();
  });
});
