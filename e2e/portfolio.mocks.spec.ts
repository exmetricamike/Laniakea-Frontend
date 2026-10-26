import { expect, test, type Page } from "@playwright/test";

type PortfolioFixture = "default" | "empty" | "paper-only" | "large";

async function resetAndLogin(page: Page, fixture: PortfolioFixture = "default") {
  await page.addInitScript((value) => {
    localStorage.setItem("laniakea.mocks.portfolio", value);
  }, fixture);
  await page.goto("/login");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.getByLabel("Email").fill("demo@example.test");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("shows API KPI values, alerts, and halted systems first", async ({ page }) => {
  await resetAndLogin(page);
  await page.goto("/portfolio");
  await expect(page.locator('[data-bucket="USD*"]')).toBeVisible();
  await expect(page.locator('[data-kpi="Equity"]').first()).toHaveText("12387.40");
  await expect(page.locator('[data-kpi="Period PnL"]').first()).toHaveText("87.40");
  await expect(page.getByRole("alert").getByText("halted: Reconciliation mismatch")).toBeVisible();
  await expect(page.locator("tr[data-system-state]").first()).toHaveAttribute(
    "data-system-state",
    "halted",
  );
});

test("switching period refetches the portfolio summary", async ({ page }) => {
  await resetAndLogin(page);
  await page.goto("/portfolio");
  const request = page.waitForRequest(
    (item) => item.url().includes("/portfolio/summary/") && item.url().includes("period=7d"),
  );
  await page.getByRole("button", { name: "7D" }).click();
  await request;
});

test("renders both canonical empty states", async ({ page }) => {
  await resetAndLogin(page, "empty");
  await page.goto("/portfolio");
  await expect(page.getByText("No systems yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create a system" })).toBeVisible();

  await resetAndLogin(page, "paper-only");
  await page.goto("/portfolio");
  await expect(page.getByText("No live systems — switch to PAPER")).toBeVisible();
  await page.getByRole("button", { name: "Switch to PAPER" }).click();
  await expect(page.getByText("Systems").last()).toBeVisible();
});

test("large fixture remains interactive", async ({ page }) => {
  await resetAndLogin(page, "large");
  const started = Date.now();
  await page.goto("/portfolio");
  await page.getByRole("radio", { name: "PAPER" }).click();
  await expect(page.getByText("Large system 1").first()).toBeVisible();
  await page.getByRole("button", { name: "7D" }).click();
  await expect(page.getByRole("button", { name: "7D" })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(2_000);
});
