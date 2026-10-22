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
  await page.route("**/api/engine/v1/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ results: [], next: null, count: 0 }),
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
    ["/strategies/atr_strategies%2Fatr_allocation", "Strategy atr_strategies/atr_allocation"],
    ["/backtests/new", "New backtest"],
    ["/backtests/7", "Backtest #7"],
    ["/accounts/new", "New account"],
    ["/accounts/3", "Account #3"],
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
