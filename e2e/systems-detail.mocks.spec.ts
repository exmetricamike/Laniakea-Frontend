import { expect, test } from "@playwright/test";

test("renders system detail tabs and a not-found page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@example.test");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/systems/42");
  await expect(page.getByRole("heading", { name: "BTC ATR 1h" })).toBeVisible();
  await expect(page.getByText("Equity", { exact: true })).toBeVisible();
  // lightweight-charts draws several canvases per chart: assert per chart card
  for (const title of ["Price chart", "Equity & drawdown"]) {
    const card = page
      .locator("div")
      .filter({ has: page.getByText(title, { exact: true }) })
      .filter({ has: page.locator("canvas") })
      .last();
    await expect(card).toBeVisible();
  }
  await expect(page.getByText("Position", { exact: true })).toBeVisible();
  const activityTabs = [
    ["Open orders", "TP"],
    ["Order history", "TP"],
    ["Trades", "32.71"],
    ["Fills", "63999.50"],
    ["Events", "Demo event"],
    ["Commands", "command"],
  ];
  for (const [tab, value] of activityTabs) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("data-state", "active");
    const panel = page.getByRole("tabpanel");
    await expect(panel.locator("tbody tr")).toHaveCount(1);
    await expect(panel).toContainText(value);
    await expect(panel.getByRole("alert")).toHaveCount(0);
  }
  for (const [tab, value] of [
    ["Performance", "Published ATR backtest"],
    ["Settings", "Risk limits"],
  ]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("data-state", "active");
    const panel = page.getByRole("tabpanel");
    await expect(panel).toContainText(value);
    await expect(panel.getByRole("alert")).toHaveCount(0);
  }
  await page.goto("/systems/999999");
  await expect(page.getByRole("heading", { name: "System not found" })).toBeVisible();
});
