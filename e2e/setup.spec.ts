import { test, expect } from "@playwright/test";

// Serial mode: forces the entire file onto one worker in declaration order.
// This ensures Setup Wizard always finishes before Login starts when running
// the full suite. Individual describe blocks still work via VS Code extension
// because Login's beforeAll creates admin independently.
test.describe.configure({ mode: "serial" });

test.describe.serial("Setup Wizard", () => {
  test("should redirect to setup on first visit", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/setup/);
  });

  test("should show setup form", async ({ page }) => {
    await page.goto("/setup");
    await expect(page.getByText("Welcome to Docklet")).toBeVisible();
    await expect(page.getByLabel("Admin Username")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm Password")).toBeVisible();
  });

  test("should complete setup and redirect to dashboard", async ({ page }) => {
    await page.goto("/setup");

    await page.getByLabel("Admin Username").fill("admin");
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByLabel("Confirm Password").fill("password123");
    await page.getByRole("button", { name: "Create Admin Account" }).click();

    await expect(page.getByText("Setup Complete")).toBeVisible();
    await page.getByRole("button", { name: "Go to Dashboard" }).click();
    await expect(page).toHaveURL(/\/containers/);
  });
});

test.describe.serial("Login", () => {
  test.beforeAll(async ({ request }) => {
    // Ensure admin exists. Ignore 400 if Setup Wizard tests already ran.
    await request.post("/api/auth/setup", {
      data: { username: "admin", password: "password123", confirmPassword: "password123" },
    });
  });

  test("should show login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign in to your account")).toBeVisible();
  });

  test("should login with valid credentials and redirect to dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/containers/);
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid username or password")).toBeVisible();
  });
});
