import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function completeBacktest(page: import("@playwright/test").Page): Promise<void> {
  await page.getByLabel("Search instruments").fill("BTC/USDT");
  await page.getByLabel("Instrument", { exact: true }).click();
  await page.getByRole("option", { name: "BTC/USDT" }).click();
  await page.getByLabel("Timeframe").click();
  await page.getByRole("option", { name: "1h" }).click();
  await page.getByLabel("Start (UTC)").fill("2021-01-01");
  await page.getByLabel("End (UTC)").fill("2021-03-01");
  await page.getByRole("button", { name: "Create backtest" }).click();
}

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

test("staff runs a draft version from operator strategies", async ({ page }) => {
  await login(page, "ops@example.test");
  await page.goto("/operator?tab=strategies");
  await page.getByRole("link", { name: "Run backtest" }).click();
  await expect(page.getByText("Version:")).toContainText("1.1.0 (draft)");
  await expect(page.getByLabel("trailing_atr_period")).toHaveValue("13");
  await completeBacktest(page);
  await expect(
    page.getByRole("heading", { name: "atr_strategies/atr_allocation@1.1.0" }),
  ).toBeVisible();
});

test("non-staff ignores a requested draft version", async ({ page }) => {
  await login(page, "demo@example.test");
  await page.goto("/backtests/new?strategy=atr_strategies%2Fatr_allocation&version=1.1.0");
  await expect(page.getByLabel("Strategy")).toBeVisible();
  await expect(page.getByText("Version:")).toContainText("1.0.0");
  await expect(page.getByText("(draft)")).toHaveCount(0);
});

for (const [version, message] of [
  ["404", "Not found."],
  ["1.0.0", "This strategy version is not a draft."],
  ["403", "Permission denied."],
] as const) {
  test(`draft endpoint ${version} is an inline error`, async ({ page }) => {
    await login(page, "ops@example.test");
    await page.goto(`/backtests/new?strategy=atr_strategies%2Fatr_allocation&version=${version}`);
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to operator strategies" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create backtest" })).toHaveCount(0);
  });
}

test("shows a stale draft version submit error inline", async ({ page }) => {
  await login(page, "ops@example.test");
  await page.goto("/backtests/new?strategy=atr_strategies%2Fatr_allocation&version=stale");
  await completeBacktest(page);
  await expect(page.getByText("This draft is no longer the latest version.")).toBeVisible();
});
