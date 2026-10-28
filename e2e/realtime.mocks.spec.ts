import { expect, test, type Page } from "@playwright/test";

const mockApi = "http://localhost:8000";

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(() => fetch("http://localhost:8000/__mocks/reset", { method: "POST" }));
  await page.getByLabel("Email").fill("demo@example.test");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function emit(page: Page, event: Record<string, unknown>): Promise<void> {
  await page.evaluate(async ({ api, payload }) => {
    const response = await fetch(`${api}/__mocks/ws/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Unable to emit mock WebSocket event");
  }, { api: mockApi, payload: event });
}

async function drop(page: Page, blocked: boolean): Promise<void> {
  await page.evaluate(async ({ api, shouldBlock }) => {
    const response = await fetch(`${api}/__mocks/ws/drop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: 4000, blocked: shouldBlock }),
    });
    if (!response.ok) throw new Error("Unable to drop mock WebSocket");
  }, { api: mockApi, shouldBlock: blocked });
}

async function openSystem(page: Page): Promise<void> {
  await page.goto("/systems/42");
  await expect(page.getByRole("heading", { name: "BTC ATR 1h" })).toBeVisible();
  await expect(page.getByLabel("Live updates connected")).toBeVisible();
}

test.beforeEach(async ({ page }) => login(page));

test("shows the connected live updates status", async ({ page }) => {
  await page.goto("/portfolio");
  await expect(page.getByLabel("Live updates connected")).toBeVisible();
});

test("refetches open orders after an order event", async ({ page }) => {
  await openSystem(page);
  await page.getByRole("tab", { name: "Open orders" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("TP");
  const orderRequest = page.waitForRequest((request) =>
    request.url().includes("/systems/42/orders/"),
  );
  await emit(page, {
    type: "order.updated",
    channel: "system.42",
    seq: 1,
    time: "2026-10-22T10:01:00Z",
    data: {
      id: 9001,
      client_id: "e42s000137",
      tag: "TP",
      origin: "strategy",
      created_by: null,
      side: "buy",
      type: "limit",
      size: "0.031",
      price: "64000",
      stop_price: null,
      status: "partial",
      filled_size: "0.010",
      avg_fill_price: "64000",
      reject_reason: null,
      cancelled_by: null,
      replaces: null,
      replaced_by: null,
      bar_time: "2026-10-22T10:00:00Z",
      created_at: "2026-10-22T10:00:00Z",
      updated_at: "2026-10-22T10:01:00Z",
      reduce_only: false,
      allowed_actions: ["cancel_order", "modify_order"],
    },
  });
  await orderRequest;
  await expect(page.getByRole("tabpanel")).toContainText("TP");
});

test("updates the halt banner after a system state event", async ({ page }) => {
  await openSystem(page);
  const initialHaltBanner = page
    .getByRole("alert")
    .filter({ hasText: "Halted BTC system is halted" });
  await expect(initialHaltBanner).toBeVisible();
  await emit(page, {
    type: "system.state",
    channel: "system.42",
    seq: 1,
    time: "2026-10-22T10:01:00Z",
    data: {
      id: 42,
      state: "halted",
      desired_state: "stopped",
      state_reason: "Mock halt",
      allowed_actions: ["ack"],
    },
  });
  const updatedHaltBanner = page.getByRole("alert").filter({ hasText: "Systems are halted" });
  await expect(updatedHaltBanner).toBeVisible();
});

test("refetches a system after a WebSocket sequence gap", async ({ page }) => {
  await openSystem(page);
  await emit(page, {
    type: "position",
    channel: "system.42",
    seq: 1,
    time: "2026-10-22T10:01:00Z",
    data: { size: "0", side: null, avg_price: null, mark_price: null, marked_at: null },
  });
  const detailRequest = page.waitForRequest((request) => request.url().endsWith("/systems/42/"));
  await emit(page, {
    type: "position",
    channel: "system.42",
    seq: 3,
    time: "2026-10-22T10:02:00Z",
    data: { size: "0", side: null, avg_price: null, mark_price: null, marked_at: null },
  });
  await detailRequest;
});

test("reconnects and resubscribes after a dropped socket", async ({ page }) => {
  await openSystem(page);
  await drop(page, true);
  await expect(page.getByLabel("Live updates connecting")).toBeVisible();
  await drop(page, false);
  await expect(page.getByLabel("Live updates connected")).toBeVisible({ timeout: 15_000 });
});

test("shows paused updates and polls the open system after ten seconds", async ({ page }) => {
  await openSystem(page);
  await page.getByRole("tab", { name: "Open orders" }).click();
  await drop(page, true);
  await expect(page.getByText("Live updates paused")).toBeVisible({ timeout: 13_000 });
  const orderRequest = page.waitForRequest(
    (request) => request.url().includes("/systems/42/orders/"),
    { timeout: 6_000 },
  );
  await orderRequest;
});
