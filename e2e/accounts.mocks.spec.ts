import { expect, test } from "@playwright/test";

async function resetAndLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(() => fetch("http://localhost:8000/__mocks/reset", { method: "POST" }));
  await page.getByLabel("Email").fill("demo@example.test");
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.beforeEach(async ({ page }) => resetAndLogin(page));

test("creates an OKX account without retaining secrets", async ({ page }) => {
  const secret = "never-render-this-secret";
  const responses: string[] = [];
  page.on("response", async (response) => {
    if (response.url().includes("/api/engine/v1/accounts")) responses.push(await response.text());
  });
  await page.goto("/accounts/new");
  await page.getByLabel("Venue").click();
  await page.getByRole("option", { name: "OKX" }).click();
  await page.getByLabel("Label").fill("Mock OKX");
  await page.getByLabel("API key").fill("key");
  await page.getByLabel("API secret").fill(secret);
  await page.getByLabel("Passphrase").fill("passphrase");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Verifying…")).toBeVisible();
  await expect(page.getByText("Trade: yes")).toBeVisible({ timeout: 8_000 });
  expect(await page.locator("body").textContent()).not.toContain(secret);
  expect(responses.join(" ")).not.toContain(secret);
});

test("shows withdrawal warning, persists settings, and blocks used-account deletion", async ({
  page,
}) => {
  await page.goto("/accounts/8");
  await expect(
    page.getByText("This key can withdraw funds and is refused for live trading."),
  ).toBeVisible();
  await expect(page.getByTestId("balance-card").getByRole("alert")).toHaveText(
    "Invalid credentials",
    { timeout: 8_000 },
  );
  await page.getByLabel("Label").fill("Renamed account");
  await page.getByLabel("Daily loss limit").fill("25.50");
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" && response.url().includes("/accounts/8/"),
  );
  await page.getByRole("button", { name: "Save settings" }).click();
  await saved;
  await page.reload();
  await expect(page.getByLabel("Label")).toHaveValue("Renamed account");
  await page.getByRole("button", { name: "Replace credentials" }).click();
  await page.getByLabel("API key").fill("replacement-key");
  await page.getByLabel("API secret").fill("replacement-secret");
  await page.getByLabel("Passphrase").fill("replacement-passphrase");
  await page.getByRole("button", { name: "Replace credentials", exact: true }).last().click();
  await expect(page.getByText("Credentials replaced. Verifying…")).toBeVisible();
  await page.goto("/accounts/7");
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Account is used by 1 trading systems.")).toBeVisible();
});
