import { expect, test, type Page } from "@playwright/test";

const api = "http://localhost:8000";

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(() => fetch("http://localhost:8000/__mocks/reset", { method: "POST" }));
  await page.getByLabel("Email").fill("demo@example.test");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/portfolio");
}

async function failPath(page: Page, path: string): Promise<void> {
  await page.evaluate(
    async ({ apiUrl, failedPath }) => {
      await fetch(`${apiUrl}/__mocks/fail-path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: failedPath }),
      });
    },
    { apiUrl: api, failedPath: path },
  );
}

async function clearPath(page: Page, path: string): Promise<void> {
  await page.evaluate(
    async ({ apiUrl, failedPath }) => {
      await fetch(`${apiUrl}/__mocks/fail-path`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: failedPath }),
      });
    },
    { apiUrl: api, failedPath: path },
  );
}

for (const section of [
  { name: "portfolio KPIs", page: "/portfolio", path: "/api/engine/v1/portfolio/summary/" },
  { name: "portfolio equity", page: "/portfolio", path: "/api/engine/v1/portfolio/equity/" },
  { name: "portfolio trades", page: "/portfolio", path: "/api/engine/v1/portfolio/trades/" },
  { name: "systems", page: "/systems", path: "/api/engine/v1/systems/" },
  { name: "backtests", page: "/backtests", path: "/api/engine/v1/backtests/" },
  { name: "strategies", page: "/strategies", path: "/api/engine/v1/strategies/" },
  { name: "accounts", page: "/accounts", path: "/api/engine/v1/accounts/" },
]) {
  test(`${section.name} retries a persistent route failure`, async ({ page }) => {
    await login(page);
    await failPath(page, section.path);
    await page.goto(section.page);
    // Not role=alert: Next's route announcer always has it.
    const retry = page.getByRole("button", { name: "Retry" }).first();
    await expect(retry).toBeVisible({ timeout: 15_000 });
    await clearPath(page, section.path);
    await retry.click();
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
  });
}
