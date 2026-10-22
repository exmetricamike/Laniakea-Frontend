import { expect, test } from "@playwright/test";

test("creates a backtest and shows its assumptions and metrics", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@example.test");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/backtests/new");
  await page.getByLabel("Strategy").click();
  await page.getByRole("option", { name: "ATR allocation" }).click();
  await page.getByLabel("Search instruments").fill("BTC/USDT");
  await page.getByLabel("Instrument", { exact: true }).click();
  await page.getByRole("option", { name: "BTC/USDT" }).click();
  await page.getByLabel("Timeframe").click();
  await page.getByRole("option", { name: "1h" }).click();
  await page.getByLabel("Start (UTC)").fill("2021-01-01");
  await page.getByLabel("End (UTC)").fill("2021-03-01");
  await page.getByLabel("In-sample end (UTC, optional)").fill("2021-02-01");
  await page.getByRole("button", { name: "Create backtest" }).click();
  await expect(
    page.getByRole("heading", { name: "atr_strategies/atr_allocation@1.0.0" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Caveats & assumptions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Metrics" })).toBeVisible();
  await expect(page.locator("[data-points]")).toHaveAttribute("data-points", "1");
  await expect(page.locator("[data-points]")).toHaveAttribute(
    "data-first",
    "2024-11-05T13:00:00.000Z",
  );
  await page.getByRole("tab", { name: "Orders" }).click();
  await expect(page.getByRole("columnheader", { name: "Fill price" })).toBeVisible();
  await expect(page.getByText("Completed")).toBeVisible();
});

test("queued backtest detail waits for results without crashing", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@example.test");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/backtests/2");
  await expect(page.getByText("Results appear when the backtest finishes.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Metrics" })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Total return")).toBeVisible({ timeout: 5_000 });
});
