import { test, expect } from "@playwright/test";
import { signInAsOwner } from "../helpers";

/**
 * Flow 12: catering and the shop are separate in the admin. Catering's
 * settings live on their own page under the Catering tab (not in the shop's
 * Settings), the catering pages show a CATERING: ON/OFF tag instead of the
 * shop's STORE: OPEN/CLOSED tag, and the emails page has a button that
 * sends a real test through Resend (which the e2e server has no keys for,
 * so it reports that instead). The on/off flips themselves are covered by
 * `ordering-toggle.spec.ts`. Runs against whatever on/off state the shared
 * database is in, so it never flips catering itself.
 */
test.describe("flow 12: catering is separate from the shop", () => {
  test("the shop's settings no longer carry catering", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/admin/settings");
    await expect(page.locator(".rack-store-pill")).toContainText(/store:/i);
    const subNav = page.getByRole("navigation", { name: "Settings sections" });
    await expect(subNav.getByRole("link", { name: "The shop" })).toBeVisible();
    await expect(subNav.getByRole("link", { name: "Catering" })).toHaveCount(0);
    await expect(page.locator("#orderingOn")).toHaveCount(0);
    await expect(page.getByText("Take catering requests online")).toHaveCount(0);
  });

  test("the Catering tab links to its own settings page, catering switch first", async ({
    page,
  }) => {
    await signInAsOwner(page);
    await page.goto("/admin/catering");
    // The catering tag, not the shop's.
    await expect(page.locator(".rack-store-pill")).toContainText(/catering: (on|off)/i);
    await expect(page.locator(".rack-store-pill")).not.toContainText(/store:/i);

    await page.getByRole("link", { name: "Settings", exact: true }).last().click();
    await expect(page).toHaveURL(/\/admin\/catering\/settings\/?$/);
    await expect(page.getByRole("heading", { name: "Catering settings" })).toBeVisible();
    await expect(page.locator(".rack-store-pill")).toContainText(/catering: (on|off)/i);

    // "Take catering requests online" is the first control in the form, and
    // says it is catering only.
    const form = page.locator("#catering-settings-form");
    const firstSection = form.locator(".adm-settings-section").first();
    await expect(firstSection.getByText("Take catering requests online")).toBeVisible();
    await expect(firstSection.getByText(/catering only/i).first()).toBeVisible();
    await expect(firstSection.locator("#orderingOn")).toHaveCount(1);

    // The big-order notice rule is gone; one notice setting stays.
    await expect(page.getByLabel("Notice (hours)")).toHaveValue("48");
    await expect(page.getByText(/big-order/i)).toHaveCount(0);
    await expect(page.getByText(/\d+\+ people/)).toHaveCount(0);
  });

  test("Send test emails says email isn't set up when Resend has no keys", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/admin/catering/emails");
    await expect(page.locator(".rack-store-pill")).toContainText(/catering: (on|off)/i);
    await page.getByRole("button", { name: /^Send test emails to / }).click();
    await expect(page.locator(".cat-test-send .adm-error")).toContainText(
      "Email isn't set up: missing RESEND_API_KEY or EMAIL_FROM",
    );
  });
});
