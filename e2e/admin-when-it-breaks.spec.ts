import { test, expect } from "@playwright/test";
import { signInAsOwner } from "./helpers";

/**
 * Covers the genuinely-reachable half of issue #36 phase 5 ("When it
 * breaks"): the signed-out redirect's explanation, the admin 404, and the
 * offline indicator. The error boundary (`admin/error.tsx`) and
 * `global-error.tsx` aren't covered here — there's no real, non-faked way
 * to make a page or a root layout throw in this harness, and rigging one
 * to would test a fake error rather than the real one Next hands the
 * boundary.
 */

test.describe("when it breaks (issue #36 phase 5)", () => {
  test("1. a browser that has never signed in is NOT told it was signed out", async ({ page }) => {
    // The honest half of the signed-out state. A fresh browser and a browser
    // whose 12-hour session just lapsed both arrive carrying no session
    // cookie, so the redirect alone can't tell them apart — and only one of
    // them was ever signed in. This one wasn't, so it gets a plain sign-in
    // form with no explanation of an event that never happened to it.
    await page.goto("/admin/orders");

    await expect(page).toHaveURL(/\/admin\/sign-in/);
    expect(page.url()).not.toContain("expired=1");
    await expect(page.getByText(/you were signed out/i)).toHaveCount(0);
  });

  test("2. a session that lapses mid-work lands on sign-in with the 12-hour explanation", async ({
    page,
    context,
  }) => {
    await signInAsOwner(page);

    // Drop ONLY the session cookie, keeping `rack_seen` — exactly the state
    // a browser is in when a 12-hour session expires: the session cookie is
    // gone, the year-long marker saying "this browser signed in once" is
    // not. Playwright can't delete a single cookie, so keep the survivors
    // and put them back.
    const survivors = (await context.cookies()).filter((c) => c.name === "rack_seen");
    expect(survivors).toHaveLength(1);
    await context.clearCookies();
    await context.addCookies(survivors);

    await page.goto("/admin/orders");

    await expect(page).toHaveURL(/\/admin\/sign-in\/?\?/);
    expect(page.url()).toContain("expired=1");
    await expect(page.getByText(/you were signed out/i)).toBeVisible();
    await expect(page.getByText(/12 hours/i)).toBeVisible();
    // No count of anything and no invented number beyond the one decided
    // fact — this is not a throttle/attempt message.
    await expect(page.getByText(/tries? left/i)).toHaveCount(0);
  });

  test("3. a real missing order shows the admin 404 with a working way back to Today", async ({
    page,
  }) => {
    await signInAsOwner(page);

    // A well-formed UUID that was never seeded — `getOrderForAdmin` queries
    // fine and comes back empty, so `page.tsx` calls the real `notFound()`,
    // not a forced one.
    await page.goto("/admin/orders/00000000-0000-4000-8000-000000000000");

    await expect(page.getByRole("heading", { name: /not on the rack/i })).toBeVisible();
    await page.getByRole("link", { name: /back to today/i }).click();
    await expect(page).toHaveURL(/\/admin\/?$/);
  });

  test("4. the offline indicator appears when the connection drops and clears when it's back", async ({
    page,
    context,
  }) => {
    await signInAsOwner(page);
    await page.goto("/admin");

    await expect(page.getByRole("status").filter({ hasText: /offline/i })).toHaveCount(0);

    await context.setOffline(true);
    const indicator = page.getByRole("status").filter({ hasText: /offline/i });
    await expect(indicator).toBeVisible();
    // Honest copy only: nothing here queues or retries what failed offline.
    await expect(indicator).not.toContainText(/queue|retry|sync/i);

    await context.setOffline(false);
    await expect(indicator).toHaveCount(0);
  });
});
