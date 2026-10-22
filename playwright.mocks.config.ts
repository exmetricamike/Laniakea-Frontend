import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.mocks.spec.ts",
  workers: 1,
  use: { baseURL: "http://localhost:3002", headless: true },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "next dev -p 3002",
    url: "http://localhost:3002/login",
    env: { NEXT_PUBLIC_USE_MOCKS: "true", NEXT_DIST_DIR: ".next-mocks" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
