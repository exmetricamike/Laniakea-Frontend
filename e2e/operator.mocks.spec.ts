import { expect, test, type Page } from "@playwright/test";

async function resetAndLogin(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const status = await page.evaluate(async () => {
    const response = await fetch("http://localhost:8000/__mocks/reset", { method: "POST" });
    return response.status;
  });
  expect(status).toBe(204);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function setMock(page: Page, path: string): Promise<void> {
  const status = await page.evaluate(async (mockPath) => {
    const response = await fetch(`http://localhost:8000${mockPath}`, { method: "POST" });
    return response.status;
  }, path);
  expect(status).toBe(204);
}

async function loginAsStaff(page: Page): Promise<void> {
  await resetAndLogin(page, "ops@example.test");
}

async function openDraftPublishDialog(page: Page): Promise<void> {
  await page.goto("/operator?tab=strategies");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test("hides operator navigation and denies non-staff users", async ({ page }) => {
  await resetAndLogin(page, "demo@example.test");
  await expect(page.getByRole("link", { name: "Operator", exact: true })).toHaveCount(0);
  await page.goto("/operator");
  await expect(page.getByRole("heading", { name: "Operators only" })).toBeVisible();
});

test("renders every operator tab for staff", async ({ page }) => {
  await loginAsStaff(page);

  await page.goto("/operator");
  await expect(page.getByRole("columnheader", { name: "Owner" })).toBeVisible();

  await page.goto("/operator?tab=strategies");
  await expect(page.getByRole("heading", { name: "ATR allocation" })).toBeVisible();

  await page.goto("/operator?tab=kill-switch");
  await expect(page.getByRole("heading", { name: "Global kill switch" })).toBeVisible();

  await page.goto("/operator?tab=audit");
  await expect(page.getByRole("columnheader", { name: "Actor" })).toBeVisible();

  await page.goto("/operator?tab=health");
  await expect(page.getByRole("heading", { name: "Supervisor" })).toBeVisible();
});

test("publishes a draft version with selected evidence", async ({ page }) => {
  await loginAsStaff(page);
  await openDraftPublishDialog(page);
  await page.getByRole("checkbox", { name: "#2 BTC/USDT 1h" }).check();
  await page.getByRole("button", { name: "Publish version" }).click();
  await expect(page.getByText("Strategy version published")).toBeVisible();

  const version = page.getByText("1.1.0", { exact: true }).locator("..");
  await expect(version.getByText("published", { exact: true })).toBeVisible();
});

test("disables publishing when no finished evidence exists", async ({ page }) => {
  await loginAsStaff(page);
  await page.goto("/operator?tab=strategies");
  await expect(page.getByRole("heading", { name: "ATR allocation" })).toBeVisible();
  await setMock(page, "/__mocks/operator/no-evidence");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("No finished backtests of this draft yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish version" })).toBeDisabled();
});

test("shows publish conflicts inline", async ({ page }) => {
  await loginAsStaff(page);
  await page.goto("/operator?tab=strategies");
  await expect(page.getByRole("heading", { name: "ATR allocation" })).toBeVisible();
  await setMock(page, "/__mocks/fail-next/operator-publish-conflict");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("checkbox", { name: "#2 BTC/USDT 1h" }).check();
  await page.getByRole("button", { name: "Publish version" }).click();
  await expect(page.getByRole("alert")).toContainText("Version is already published.");
});

test("confirms and unpublishes a published version", async ({ page }) => {
  await loginAsStaff(page);
  await page.goto("/operator?tab=strategies");
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText("Unpublish ATR allocation@1.0.0?")).toBeVisible();
  await dialog.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(page.getByText("Strategy version unpublished")).toBeVisible();

  const version = page.getByText("1.0.0", { exact: true }).locator("..");
  await expect(version.getByText("unpublished", { exact: true })).toBeVisible();
});

test("activates and deactivates the global kill switch with a reason", async ({ page }) => {
  await loginAsStaff(page);
  await page.goto("/operator?tab=kill-switch");

  await page.getByRole("button", { name: "Activate", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reason").fill("Operator test activation");
  await dialog.getByRole("button", { name: "Activate", exact: true }).click();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reason").fill("Operator test deactivation");
  await dialog.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(page.getByText("Inactive", { exact: true })).toBeVisible();
});

test("narrows the audit table with its filters", async ({ page }) => {
  await loginAsStaff(page);
  await page.goto("/operator?tab=audit");
  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(3);
  await page.getByLabel("actor filter").fill("tenant@example.test");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByText("tenant@example.test")).toBeVisible();
  await expect(table.getByText("ops@example.test")).toHaveCount(0);
});

test("shows an unhealthy Redis probe as a red health card", async ({ page }) => {
  await loginAsStaff(page);
  await page.goto("/operator");
  await expect(page.getByRole("columnheader", { name: "Owner" })).toBeVisible();
  await setMock(page, "/__mocks/operator/redis-unavailable");
  await page.getByRole("tab", { name: "Health" }).click();
  const redisCard = page.getByRole("heading", { name: "Redis" }).locator("../..");
  await expect(redisCard).toHaveClass(/border-red-500/);
  await expect(redisCard.getByText("Redis unavailable")).toBeVisible();
});
