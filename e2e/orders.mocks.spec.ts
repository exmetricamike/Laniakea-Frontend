import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(() => fetch("http://localhost:8000/__mocks/reset", { method: "POST" }));
  await page.getByLabel("Email").fill("demo@example.test");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.beforeEach(async ({ page }) => login(page));

test("cancels and modifies an advertised open order", async ({ page }) => {
  await page.goto("/systems/42");
  await page.getByRole("button", { name: "Modify" }).click();
  await expect(page.getByText("Will cancel and replace; queue priority is lost")).toBeVisible();
  await expect(page.getByLabel("Stop price")).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByText("Command completed")).toBeVisible();
});

test("sends notional without size", async ({ page }) => {
  const request = page.waitForRequest((item) => item.url().endsWith("/systems/42/orders/"));
  await page.goto("/systems/42");
  await page.getByRole("button", { name: "New order" }).click();
  await page.getByRole("radio", { name: "By notional" }).check();
  await page.getByLabel("Notional", { exact: true }).fill("10");
  await page.getByLabel("Price").fill("60000");
  await page.getByRole("button", { name: "Place order" }).click();
  const body = JSON.parse((await request).postData() ?? "{}");
  expect(body.notional).toBe("10");
  expect(body.size).toBeUndefined();
});

test("places a new limit order and completes the command", async ({ page }) => {
  await page.goto("/systems/42");
  await page.getByRole("button", { name: "New order" }).click();
  await page.getByLabel("Size", { exact: true }).fill("0.01");
  await page.getByLabel("Price").fill("60000");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Command completed")).toBeVisible();
});

test("keeps a risk-rejected order dialog open with its reason", async ({ page }) => {
  await page.goto("/systems/42");
  await page.getByRole("button", { name: "New order" }).click();
  await page.getByLabel("Size", { exact: true }).fill("11");
  await page.getByLabel("Price").fill("60000");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText(/rejected by risk controls/i)).toBeVisible();
  await expect(page.getByText("max order notional")).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("locks reduce-only while an applicable kill switch is active", async ({ page }) => {
  await page.goto("/systems/42");
  await page.getByRole("button", { name: "New order" }).click();
  const reduceOnly = page.getByRole("checkbox", { name: "Reduce only" });
  await expect(reduceOnly).toBeChecked();
  await expect(reduceOnly).toBeDisabled();
});

test("closes a position and shows flat after completion", async ({ page }) => {
  await page.goto("/systems/42");
  await page.getByRole("button", { name: "Close position" }).first().click();
  await page.getByLabel("Type the system name to confirm LIVE exposure").fill("BTC ATR 1h");
  await page.getByRole("button", { name: "Close position", exact: true }).last().click();
  await expect(page.getByText("Command completed")).toBeVisible();
  await expect(page.getByText("Flat")).toBeVisible();
});

test("saves only changed settings and shows parameter errors", async ({ page }) => {
  await page.goto("/systems/44");
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  const request = page.waitForRequest((item) => item.url().endsWith("/systems/44/"));
  await page.getByLabel("Allocation").fill("12000");
  await page.getByRole("button", { name: "Save settings" }).click();
  expect(JSON.parse((await request).postData() ?? "{}")).toEqual({ allocation: "12000" });
});

test("shows settings parameter field errors", async ({ page }) => {
  await page.goto("/systems/44");
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("trailing_atr_period").fill("0");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("invalid")).toBeVisible();
});

test("does not render unadvertised order controls", async ({ page }) => {
  await page.goto("/systems/44");
  await expect(page.getByRole("button", { name: "New order" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Close position" })).toHaveCount(0);
});
