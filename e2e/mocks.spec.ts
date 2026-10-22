import { expect, test } from "@playwright/test";

test("mock login wires every placeholder page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@example.test");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("2 buckets · 3 systems")).toBeVisible();
  for (const [path, proof] of [
    ["/systems", "3 systems"],
    ["/systems/new", "3 strategies · 2 accounts"],
    ["/systems/45", "Halted BTC system · halted"],
    ["/strategies", "3 strategies"],
    ["/strategies/atr_strategies%2Fatr_allocation", "ATR allocation"],
    ["/backtests", "2 backtests"],
    ["/backtests/new", "3 strategies available"],
    ["/backtests/1", "atr_strategies/atr_allocation · done"],
    ["/accounts", "2 accounts"],
    ["/accounts/new", "1 venues"],
    ["/accounts/7", "Main futures · verified"],
    ["/risk", "2 kill switches"],
    ["/operator", "6 systems (all tenants)"],
    ["/settings", "demo@example.test"],
  ]) {
    await page.goto(path);
    await expect(page.getByText(proof as string)).toBeVisible();
  }
});
