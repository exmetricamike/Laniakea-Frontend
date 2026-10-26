import { expect, test } from "@playwright/test";

test("mock login reaches the application", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@example.test");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Portfolio" })).toBeVisible();
  await expect(page.locator('[data-bucket="USD*"]')).toBeVisible();
});
