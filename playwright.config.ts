import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: "e2e/global-setup.ts",
    },
    {
      // Auth tests run first: setup wizard needs an empty DB, and creates
      // the admin account that all other specs depend on.
      name: "auth",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "e2e/auth.spec.ts",
      dependencies: ["setup"],
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["e2e/containers.spec.ts", "e2e/images.spec.ts", "e2e/users.spec.ts", "e2e/settings.spec.ts", "e2e/rbac.spec.ts"],
      dependencies: ["auth"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // Do NOT reuse an existing dev server. It may point to a different data
    // directory and will cause tests to fail. Stop any running dev server
    // before running e2e tests.
    reuseExistingServer: false,
    env: { ...process.env, DOCKLET_DATA_DIR: "./tmp/docklet-e2e-data", E2E_DISABLE_RATE_LIMIT: "1" },
  },
});
