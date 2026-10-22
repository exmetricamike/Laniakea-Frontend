import { expect, test, type Page } from "@playwright/test";

const staff = {
  id: 1,
  email: "staff@example.test",
  first_name: "Staff",
  last_name: "User",
  is_staff: true,
};
async function mockMe(page: Page, isStaff = true) {
  await page.addInitScript(() => {
    localStorage.setItem("laniakea.access", "test-token");
    localStorage.setItem("laniakea.refresh", "test-refresh");
  });
  await page.route("**/api/jwt/refresh/", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"access":"x"}' }),
  );
  await page.route("**/api/users/me/", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ ...staff, is_staff: isStaff }),
    }),
  );
  await page.route("**/api/engine/v1/**", (route) => {
    const url = route.request().url();
    const account = {
      id: 3,
      venue: "binance",
      label: "Shell account",
      is_testnet: true,
      status: "verified",
      verified_at: null,
      permissions: { trade: true, withdraw: false },
      credentials_set: true,
      credential_hint: "…1234",
      risk: { daily_loss_limit: null, max_drawdown_pct: null, breaker_policy: "cancel_orders" },
      kill_switch: { active: false },
      systems_count: 0,
      created_at: "2026-10-22T10:00:00Z",
      verification_pending: false,
      probe_error: "",
    };
    const body = url.endsWith("/venues/")
      ? {
          results: [
            {
              id: "binance",
              name: "Binance",
              kinds: ["spot"],
              has_testnet: true,
              credential_fields: [],
            },
          ],
          next: null,
          count: 1,
        }
      : url.includes("/accounts/3/balance/")
        ? { balances: [], as_of: null, pending: false, error: "" }
        : url.endsWith("/accounts/3/")
          ? account
          : url.endsWith("/accounts/")
            ? [account]
            : { results: [], next: null, count: 0 };
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body),
    });
  });
  const strategySummary = {
    key: "atr_strategies/atr_allocation",
    title: "ATR allocation",
    description_md: "Demo",
    instrument_kinds: ["spot"],
    recommended_timeframes: ["1h"],
    warmup_bars: 200,
    latest_version: {
      version: "1.0.0",
      meta: { live_capable: true, restart_safe: false, notes: [] },
      published_at: "2026-10-22T10:00:00Z",
    },
  };
  const strategyVersion = {
    key: strategySummary.key,
    version: "1.0.0",
    title: strategySummary.title,
    description_md: strategySummary.description_md,
    instrument_kinds: strategySummary.instrument_kinds,
    recommended_timeframes: strategySummary.recommended_timeframes,
    warmup_bars: strategySummary.warmup_bars,
    meta: strategySummary.latest_version.meta,
    evidence: [],
    published_at: strategySummary.latest_version.published_at,
  };
  await page.route("**/strategies/atr_strategies/atr_allocation/versions/1.0.0/", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(strategyVersion),
    }),
  );
  await page.route("**/strategies/atr_strategies/atr_allocation/versions/", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [strategyVersion], next: null, count: 1 }),
    }),
  );
  await page.route("**/strategies/atr_strategies/atr_allocation/", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(strategySummary),
    }),
  );
}

test("login renders and public login omits stale authorization", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("laniakea.access", "stale-token"));
  await page.route("**/api/jwt/create/", (route) => {
    expect(route.request().headers()["authorization"]).toBeUndefined();
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ detail: "Invalid credentials" }),
    });
  });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill("person@example.test");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid credentials", { exact: true })).toBeVisible();
});
test("staff can navigate sidebar items", async ({ page }) => {
  await mockMe(page);
  await page.goto("/portfolio");
  for (const name of [
    "Portfolio",
    "Systems",
    "Strategies",
    "Backtests",
    "Accounts",
    "Risk",
    "Settings",
    "Operator",
  ]) {
    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
});
test("operator is absent for non-staff", async ({ page }) => {
  await mockMe(page, false);
  await page.goto("/portfolio");
  await expect(page.getByRole("link", { name: "Operator" })).toHaveCount(0);
});
test("nested placeholders and not-found render", async ({ page }) => {
  await mockMe(page);
  for (const [path, heading] of [
    ["/systems/new", "New system"],
    ["/systems/42", "System #42"],
    ["/strategies/atr_strategies%2Fatr_allocation", "ATR allocation"],
    ["/backtests/new", "New backtest"],
    ["/backtests/7", "Backtest #7"],
    ["/accounts/new", "Add account"],
    ["/accounts/3", "Shell account"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
test("mode persists and logout clears tokens", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("laniakea.access", "token");
    localStorage.setItem("laniakea.refresh", "refresh");
  });
  await mockMe(page);
  await page.goto("/portfolio");
  await page.getByRole("radio", { name: "PAPER" }).click();
  await page.reload();
  await expect(page.getByRole("radio", { name: "PAPER" })).toHaveAttribute("data-state", "on");
  await page.getByRole("button", { name: "User menu" }).click();
  await page.getByRole("menuitem", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem("laniakea.access"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("laniakea.refresh"))).toBeNull();
});
