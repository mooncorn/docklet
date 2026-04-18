import { test, expect, ADMIN_CREDS } from "./fixtures/auth.fixtures";
import { LoginPage } from "./pom/LoginPage";
import { SetupPage } from "./pom/SetupPage";

test.describe.configure({ mode: "serial" });

test.describe("Setup Wizard", () => {
  test("redirects to /setup on first visit when no admin exists", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/setup/);
  });

  test("shows form with username, password, and confirm password fields", async ({
    page,
  }) => {
    const setup = new SetupPage(page);
    await setup.goto();
    await expect(setup.usernameInput).toBeVisible();
    await expect(setup.passwordInput).toBeVisible();
    await expect(setup.confirmPasswordInput).toBeVisible();
  });

  test("shows error for mismatched passwords", async ({ page }) => {
    const setup = new SetupPage(page);
    await setup.goto();
    await setup.fillForm("e2e-admin", "e2epassword1", "differentpass");
    await setup.submit();
    await expect(setup.errorMessage).toBeVisible();
    await expect(setup.errorMessage).toContainText("Passwords do not match");
  });

  test("prevents submission when password is shorter than 8 characters", async ({
    page,
  }) => {
    const setup = new SetupPage(page);
    await setup.goto();
    await setup.fillForm("e2e-admin", "short", "short");
    await setup.submit();
    // Native HTML minLength blocks the submit event, so the page stays at /setup
    await expect(page).toHaveURL(/\/setup/);
    await expect(setup.usernameInput).toBeVisible();
  });

  test("completes setup and redirects to /containers via dashboard button", async ({
    page,
  }) => {
    const setup = new SetupPage(page);
    await setup.goto();
    await setup.fillForm(ADMIN_CREDS.username, ADMIN_CREDS.password);
    await setup.submit();
    await expect(setup.successHeading).toBeVisible();
    await setup.dashboardButton.click();
    await expect(page).toHaveURL(/\/containers/);
  });

  test("redirects /setup to /login once admin exists", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/setup");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Login", () => {
  test("shows login heading", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(page.getByText("Sign in to your account")).toBeVisible();
  });

  test("logs in with valid credentials and redirects to /containers", async ({
    page,
  }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(ADMIN_CREDS.username, ADMIN_CREDS.password);
    await expect(page).toHaveURL(/\/containers/);
  });

  test("shows vague error for invalid password", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(ADMIN_CREDS.username, "wrongpassword");
    await expect(login.errorMessage).toBeVisible();
    await expect(login.errorMessage).toContainText(
      "Invalid username or password"
    );
  });

  test("error does not reveal whether username exists", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("nonexistentuser", "anypassword");
    await expect(login.errorMessage).toBeVisible();
    await expect(login.errorMessage).toContainText(
      "Invalid username or password"
    );
    await expect(login.errorMessage).not.toContainText("not found");
    await expect(login.errorMessage).not.toContainText("does not exist");
  });
});

test.describe("Logout", () => {
  test("logs out via header user menu and redirects to /login", async ({
    adminPage,
  }) => {
    await adminPage.goto("/containers");
    await adminPage
      .locator("header button")
      .filter({ hasText: ADMIN_CREDS.username })
      .click();
    await adminPage.getByRole("button", { name: "Sign out" }).click();
    await expect(adminPage).toHaveURL(/\/login/);
  });
});

test.describe("Redirect guards", () => {
  test("unauthenticated visit to /containers redirects to /login", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/containers");
    await expect(page).toHaveURL(/\/login/);
  });

  test("authenticated visit to /login redirects to /containers", async ({
    adminPage,
  }) => {
    await adminPage.goto("/login");
    await expect(adminPage).toHaveURL(/\/containers/);
  });
});
