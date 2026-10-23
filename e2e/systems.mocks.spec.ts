import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@example.test");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function selectPaperSystem(page: import("@playwright/test").Page) {
  await page.goto("/systems/new");
  await page.getByRole("button", { name: "Choose" }).first().click();
  await expect(page.getByRole("heading", { name: "Choose a version" })).toBeVisible();
  await page.getByRole("button", { name: "Choose" }).first().click();
  await expect(page.getByRole("heading", { name: "Parameters" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Instrument and timeframe" })).toBeVisible();
  await page.getByLabel("Search instruments").fill("BTC/USDT");
  await page.getByRole("combobox", { name: "Instrument" }).click();
  await page.getByRole("option", { name: "BTC/USDT" }).click();
  await page.getByLabel("Timeframe").click();
  await page.getByRole("option", { name: "1h" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Mode and account" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Capital, risk, and costs" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
}

test("creates a paper system and displays it stopped", async ({ page }) => {
  await login(page);
  await selectPaperSystem(page);
  await page.getByLabel("Name").fill("Wizard paper system");
  await page.getByRole("button", { name: "Create system" }).click();
  await expect(page.getByRole("heading", { name: "Created" })).toBeVisible();
  await page.getByRole("button", { name: "Open in list" }).click();
  await expect(page.getByText("Wizard paper system")).toBeVisible();
  await expect(page.getByText("stopped").first()).toBeVisible();
});

test("shows invalid parameter errors on step three", async ({ page }) => {
  await login(page);
  await page.goto("/systems/new");
  await page.getByRole("button", { name: "Choose" }).first().click();
  await expect(page.getByRole("heading", { name: "Choose a version" })).toBeVisible();
  await page.getByRole("button", { name: "Choose" }).first().click();
  await expect(page.getByRole("heading", { name: "Parameters" })).toBeVisible();
  await page.getByLabel("trailing_atr_period").fill("0");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Instrument and timeframe" })).toBeVisible();
  await page.getByLabel("Search instruments").fill("BTC/USDT");
  await page.getByRole("combobox", { name: "Instrument" }).click();
  await page.getByRole("option", { name: "BTC/USDT" }).click();
  await page.getByLabel("Timeframe").click();
  await page.getByRole("option", { name: "1h" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Mode and account" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Capital, risk, and costs" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
  await page.getByRole("button", { name: "Create system" }).click();
  await expect(
    page.getByText("trailing_atr_period: 'invalid' is not of type 'integer'"),
  ).toBeVisible();
  await expect(page).toHaveURL(/step=3/);
});
