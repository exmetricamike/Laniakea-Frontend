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

test("lists start blockers and hides unadvertised start actions", async ({ page }) => {
  await page.goto("/systems/44");
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await page.evaluate(() =>
    fetch("http://localhost:8000/__mocks/fail-next/system-start-blockers", { method: "POST" }),
  );
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).last().click();
  await expect(page.getByText("The exchange account is not verified.")).toBeVisible();
  await expect(page.getByText("A kill switch is active.")).toBeVisible();
  await page.goto("/systems/42");
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
});

test("starts an advertised stopped system", async ({ page }) => {
  await page.goto("/systems/44");
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).last().click();
  await expect(page.getByText("Start requested")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
});

test("stops with each policy and requires a LIVE flatten confirmation", async ({ page }) => {
  for (const [policy, label] of [
    ["keep_positions", "Keep positions"],
    ["cancel_all", "Cancel all orders"],
  ] as const) {
    await page.goto("/systems/42");
    await page.getByRole("button", { name: "Stop" }).click();
    await page.getByRole("radio", { name: new RegExp(label) }).check();
    const request = page.waitForRequest((value) => value.url().endsWith("/systems/42/stop/"));
    await page.getByRole("button", { name: "Stop", exact: true }).last().click();
    expect(JSON.parse((await request).postData() ?? "{}")).toEqual({ policy });
  }
  await page.goto("/systems/42");
  await page.getByRole("button", { name: "Stop" }).click();
  await page.getByRole("radio", { name: /Flatten/ }).check();
  await expect(page.getByRole("button", { name: "Stop", exact: true }).last()).toBeDisabled();
  await page.getByLabel("Type the system name to confirm LIVE exposure").fill("BTC ATR 1h");
  await expect(page.getByRole("button", { name: "Stop", exact: true }).last()).toBeEnabled();
});

test("keeps acknowledgement disabled until a meaningful note is supplied", async ({ page }) => {
  await page.goto("/systems/45");
  await page.getByRole("button", { name: "Ack" }).click();
  await page.getByLabel("Acknowledgement note").fill("short");
  await expect(page.getByRole("button", { name: "Acknowledge" })).toBeDisabled();
});

test("toggles tenant and account kill switches and shows risk limits", async ({ page }) => {
  await page.goto("/portfolio");
  await page.getByRole("button", { name: "Kill switch" }).click();
  await page.getByLabel("Reason").fill("test halt");
  await page.getByRole("button", { name: "Activate" }).click();
  await expect(page.getByRole("alert").getByText(/Kill switch active \(tenant\)/)).toBeVisible();
  await page.getByRole("button", { name: "Kill switch ON" }).click();
  await page.getByLabel("Reason").fill("resume");
  await page.getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByRole("alert").getByText(/Kill switch active \(tenant\)/)).toHaveCount(0);
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Activate" }).first().click();
  await page.getByLabel("Reason").fill("account halt");
  await page.getByRole("button", { name: "Activate", exact: true }).last().click();
  await page.goto("/risk");
  await expect(page.getByText("Tenant — all my systems")).toBeVisible();
  await expect(page.getByText("Per-system limits")).toBeVisible();
  await expect(page.getByText("Max order")).toBeVisible();
});

test("reuses a failed start idempotency key and rotates it after reopening", async ({ page }) => {
  const keys: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/systems/44/start/")) {
      keys.push(request.headers()["idempotency-key"] ?? "");
    }
  });
  await page.goto("/systems/44");
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await page.evaluate(() =>
    fetch("http://localhost:8000/__mocks/fail-next/system-start", { method: "POST" }),
  );
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).last().click();
  await expect(page.getByText("Temporary failure.")).toBeVisible();
  // Fail the retry too, so the dialog stays open and can be closed and reopened.
  await page.evaluate(() =>
    fetch("http://localhost:8000/__mocks/fail-next/system-start", { method: "POST" }),
  );
  await page.getByRole("button", { name: "Start", exact: true }).last().click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[0]).toBe(keys[1]);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).last().click();
  await expect.poll(() => keys.length).toBe(3);
  expect(keys[2]).not.toBe(keys[0]);
});
