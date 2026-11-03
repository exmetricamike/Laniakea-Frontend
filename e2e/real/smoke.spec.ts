import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const email = process.env.E2E_EMAIL ?? "e2e@local.test";
const password = process.env.E2E_PASSWORD ?? "Laniakea-e2e-1";
const authHeaders: Record<string, string> = {};

type SystemRow = {
  id: number;
  state: string;
};

type JsonResponse = {
  json(): Promise<unknown>;
};

let systemId: number | null = null;

function apiPath(path: string): string {
  return `${apiUrl}${path}`;
}

function systemFrom(value: unknown): SystemRow {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    !("state" in value) ||
    typeof value.id !== "number" ||
    typeof value.state !== "string"
  ) {
    throw new Error("Unexpected system response.");
  }
  return { id: value.id, state: value.state };
}

async function getSystem(request: APIRequestContext, id: number): Promise<SystemRow> {
  const response = await request.get(apiPath(`/api/engine/v1/systems/${id}/`), {
    headers: authHeaders,
  });
  if (!response.ok()) {
    throw new Error(`System ${id} could not be read during smoke test cleanup.`);
  }
  return systemFrom(await response.json());
}

async function waitForSystemState(
  request: APIRequestContext,
  id: number,
  state: string,
  timeout: number,
): Promise<void> {
  await expect
    .poll(async () => (await getSystem(request, id)).state, { timeout, intervals: [5_000] })
    .toBe(state);
}

async function waitForCommand(
  request: APIRequestContext,
  id: number,
  commandId: number,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const response = await request.get(
          apiPath(`/api/engine/v1/systems/${id}/commands/`),
          { headers: authHeaders },
        );
        if (!response.ok()) return "request_failed";
        const body = await response.json();
        if (
          typeof body !== "object" ||
          body === null ||
          !("results" in body) ||
          !Array.isArray(body.results)
        ) {
          return "invalid_response";
        }
        const results: unknown[] = body.results;
        const command = results.find(
          (item): item is { id: number; status: string } =>
            typeof item === "object" &&
            item !== null &&
            "id" in item &&
            "status" in item &&
            item.id === commandId &&
            typeof item.status === "string",
        );
        return command?.status ?? "pending";
      },
      { timeout: 150_000, intervals: [5_000] },
    )
    .toBe("done");
}

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/portfolio$/);
}

async function createSystem(page: Page): Promise<number> {
  await page.goto("/systems/new");
  const strategy = page.getByText("on_off_strategies/on_off_baseline", { exact: true });
  await strategy.locator("..").getByRole("button", { name: "Choose" }).click();
  await expect(page.getByRole("heading", { name: "Choose a version" })).toBeVisible();
  await page.getByRole("button", { name: "Choose" }).first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Search instruments").fill("BTC/USDT");
  await page.getByRole("combobox", { name: "Instrument" }).click();
  await page.getByRole("option", { name: "BTC/USDT", exact: true }).click();
  await page.getByLabel("Timeframe").click();
  await page.getByRole("option", { name: "1m", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Name").fill(`E2E smoke ${Date.now()}`);
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/engine/v1/systems/") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create system" }).click();
  const response = await created;
  expect(response.ok()).toBeTruthy();
  const system = systemFrom(await response.json());
  await expect(page.getByRole("heading", { name: "Created" })).toBeVisible();
  return system.id;
}

async function startWithMarketDataRetry(page: Page, request: APIRequestContext, id: number) {
  const deadline = Date.now() + 180_000;
  while (true) {
    await page.getByRole("button", { name: "Start" }).click();
    await page.getByRole("button", { name: "Start", exact: true }).last().click();
    const unavailable = page.getByText("Required live market data is unavailable.", {
      exact: true,
    });
    if (!(await unavailable.isVisible().catch(() => false))) break;
    if (Date.now() >= deadline) {
      throw new Error("market_data_unavailable after 180 seconds");
    }
    await page.waitForTimeout(10_000);
  }
  await waitForSystemState(request, id, "running", 60_000);
}

async function commandIdFrom(response: JsonResponse): Promise<number> {
  const value = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "number"
  ) {
    throw new Error("Unexpected command submission response.");
  }
  return value.id;
}

test.setTimeout(800_000);

test.beforeAll(async ({ request }) => {
  try {
    await request.get(apiPath("/api/engine/v1/venues/"));
  } catch {
    throw new Error("backend not running: scripts/dev-up.sh start");
  }
  const response = await request.post(apiPath("/api/jwt/create/"), {
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error("e2e tenant missing: scripts/dev-up.sh seed-e2e");
  }
  const body = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("access" in body) ||
    typeof body.access !== "string"
  ) {
    throw new Error("e2e tenant missing: scripts/dev-up.sh seed-e2e");
  }
  authHeaders.Authorization = `Bearer ${body.access}`;
});

test.afterAll(async ({ request }, testInfo) => {
  if (systemId === null) return;
  try {
    if ((await getSystem(request, systemId)).state !== "stopped") {
      const stop = await request.post(apiPath(`/api/engine/v1/systems/${systemId}/stop/`), {
        headers: authHeaders,
        data: { policy: "cancel_all" },
      });
      if (!stop.ok()) throw new Error("stop request failed");
      await waitForSystemState(request, systemId, "stopped", 150_000);
    }
    const archive = await request.delete(apiPath(`/api/engine/v1/systems/${systemId}/`), {
      headers: authHeaders,
    });
    if (!archive.ok()) throw new Error("archive request failed");
  } catch (error) {
    console.error(`Smoke cleanup failed for system id: ${systemId}`);
    testInfo.annotations.push({ type: "cleanup", description: `system id: ${systemId}` });
    throw error;
  }
});

test("runs a paper system lifecycle against the real backend", async ({ page, request }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Portfolio" })).toBeVisible();
  await page.getByRole("radio", { name: "PAPER" }).click();
  await expect(page.locator("[data-bucket]").first()).toBeVisible();
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Systems", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Systems" })).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();

  systemId = await createSystem(page);
  await startWithMarketDataRetry(page, request, systemId);
  await page.goto(`/systems/${systemId}`);
  await expect(page.getByText("running", { exact: true })).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: "New order" }).click();
  await page.getByLabel("Size", { exact: true }).fill("0.02");
  await page.getByLabel("Price").fill("1000");
  const placed = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/engine/v1/systems/${systemId}/orders/`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Place order" }).click();
  await waitForCommand(request, systemId, await commandIdFrom(await placed));

  await page.getByRole("tab", { name: "Open orders" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  const cancelled = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/engine/v1/systems/${systemId}/orders/`) &&
      response.request().method() === "DELETE",
  );
  await page.getByRole("button", { name: "Cancel order" }).click();
  await waitForCommand(request, systemId, await commandIdFrom(await cancelled));

  await page.getByRole("button", { name: "Stop" }).click();
  await page.getByRole("radio", { name: "Cancel all orders" }).check();
  await page.getByRole("button", { name: "Stop", exact: true }).last().click();
  await waitForSystemState(request, systemId, "stopped", 150_000);

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Strategies", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Strategies" })).toBeVisible();
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Backtests", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Backtests" })).toBeVisible();
  await page.getByRole("button", { name: "User menu" }).click();
  await page.getByRole("menuitem", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
