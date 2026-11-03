import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function login(page: Page, staff = false): Promise<void> {
  await page.goto("/login");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(() => fetch("http://localhost:8000/__mocks/reset", { method: "POST" }));
  await page.getByLabel("Email").fill(staff ? "ops@example.test" : "demo@example.test");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function expectNoSeriousViolations(page: Page): Promise<void> {
  // axe-core carries a newer private Playwright Page type than this project’s pinned test runner.
  const results = await new AxeBuilder({ page: page as never }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious).toEqual([]);
}

test("main tenant pages have no serious or critical axe violations", async ({ page }) => {
  await login(page);
  for (const path of [
    "/portfolio",
    "/systems",
    "/systems/43",
    "/systems/new?step=1",
    "/strategies",
    "/backtests",
    "/accounts",
    "/risk",
    "/settings",
  ]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await expectNoSeriousViolations(page);
  }
});

test("operator has no serious or critical axe violations", async ({ page }) => {
  await login(page, true);
  await page.goto("/operator");
  await expect(page.locator("main")).toBeVisible();
  await expectNoSeriousViolations(page);
});
