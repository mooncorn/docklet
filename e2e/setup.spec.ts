import { test, expect } from "@playwright/test";

test.describe("Setup Wizard", () => {
  test("should redirect to setup on first visit", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/setup/);
  });

  test("should show setup form", async ({ page }) => {
    await page.goto("/setup");
    await expect(page.getByText("Welcome to Docklet")).toBeVisible();
    await expect(page.getByLabel("Admin Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
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

test.describe("Login", () => {
  test("should show login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign in to your account")).toBeVisible();
  });
});
