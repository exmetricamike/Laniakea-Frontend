import { expect, test, type Page } from "@playwright/test";

async function resetAndLogin(page: Page) {
  await page.goto("/login");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(() => fetch("http://localhost:8000/__mocks/reset", { method: "POST" }));
  await page.getByLabel("Email").fill("demo@example.test");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.beforeEach(async ({ page }) => resetAndLogin(page));

test("browses strategy parameters, markdown, and evidence", async ({ page }) => {
  await page.goto("/strategies");
  await page.getByRole("link", { name: "Open strategy" }).first().click();
  await expect(page.getByRole("heading", { name: "ATR allocation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ATR allocation", level: 2 })).toBeVisible();
  await expect(page.locator("main script")).toHaveCount(0);
  expect(await page.evaluate(() => "catalogScript" in window)).toBe(false);
  await page.getByRole("tab", { name: "Parameters" }).click();
  await expect(page.getByText("trailing_atr_period", { exact: true })).toBeVisible();
  await expect(page.getByText("5", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Evidence" }).click();
  await expect(page.getByRole("link", { name: "Published ATR backtest" })).toHaveAttribute(
    "href",
    "/backtests/1",
  );
});

test("shows the strategy-specific not-found state", async ({ page }) => {
  await page.goto("/strategies/not-a-key");
  await expect(page.getByRole("heading", { name: "Strategy not found" })).toBeVisible();
  await page.goto("/strategies/unknown%2Fmissing");
  await expect(page.getByRole("heading", { name: "Strategy not found" })).toBeVisible();
});

test("renders markdown tables and an empty description state", async ({ page }) => {
  await page.goto("/strategies/trend%2Fbreakout");
  const description = page.getByRole("region", { name: "Description" });
  await expect(description.locator("table")).toHaveCount(1);
  await expect(description.locator("th")).toHaveText(["Date", "Result"]);
  await expect(description.locator("td")).toHaveText(["2026-10-22", "Positive"]);
  await page.goto("/strategies/mean%2Freversion");
  await expect(page.getByText("No description yet.", { exact: true })).toBeVisible();
});

test("retries a failed version detail request", async ({ page }) => {
  await page.goto("/strategies/atr_strategies%2Fatr_allocation");
  await page.getByRole("tab", { name: "Parameters" }).click();
  await expect(page.getByText("trailing_atr_period", { exact: true })).toBeVisible();
  const failStatus = await page.evaluate(async () => {
    const response = await fetch(
      "http://localhost:8000/__mocks/fail-next/strategy-version-detail",
      {
        method: "POST",
      },
    );
    return response.status;
  });
  expect(failStatus).toBe(204);
  const failedDetail = page.waitForResponse(
    (response) =>
      response.url().includes("/versions/0.9.0/") && response.request().method() === "GET",
  );
  await page.getByRole("tab", { name: "Versions" }).click();
  await page.getByRole("button", { name: "0.9.0" }).click();
  expect((await failedDetail).status()).toBe(500);
  await page.getByRole("tab", { name: "Parameters" }).click();
  await expect(page.locator("main [role=alert]")).toContainText("Temporary failure.");
  await page.locator("main").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("trailing_atr_period", { exact: true })).toBeVisible();
});
