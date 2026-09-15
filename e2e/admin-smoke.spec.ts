import { test, expect } from "@playwright/test";
import { signInAsOwner } from "./helpers";

test("owner signs in, reaches the products list, and the public shop still renders", async ({
  page,
}) => {
  await signInAsOwner(page);
  await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();

  const response = await page.goto("/shop/");
  expect(response?.status()).toBe(200);
  await expect(page.getByText(/Foam Trucker/i).first()).toBeVisible();
});
