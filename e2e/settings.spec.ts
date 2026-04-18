import { type APIRequestContext } from "@playwright/test";
import { test, expect, ADMIN_CREDS } from "./fixtures/auth.fixtures";
import { SettingsPage } from "./pom/SettingsPage";
import { LoginPage } from "./pom/LoginPage";

test.describe.configure({ mode: "serial" });

async function restoreAppName(
  request: APIRequestContext,
  name: string
): Promise<void> {
  const loginRes = await request.post("/api/auth/login", { data: ADMIN_CREDS });
  const cookie = loginRes.headers()["set-cookie"] ?? "";
  await request.put("/api/settings", {
    headers: { Cookie: cookie },
    data: { app_name: name },
  });
}

test.describe("App Name Setting", () => {
  let originalName: string;

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post("/api/auth/login", {
      data: ADMIN_CREDS,
    });
    const cookie = loginRes.headers()["set-cookie"] ?? "";
    const res = await request.get("/api/settings", {
      headers: { Cookie: cookie },
    });
    const data = (await res.json()) as { app_name?: string };
    originalName = data.app_name ?? "Docklet";
  });

  test.afterAll(async ({ request }) => {
    await restoreAppName(request, originalName);
  });

  test("settings form shows current app name", async ({ adminPage }) => {
    const settings = new SettingsPage(adminPage);
    await settings.goto();
    const name = await settings.getAppName();
    expect(name.length).toBeGreaterThan(0);
  });

  test("updating app name shows success message", async ({ adminPage }) => {
    const settings = new SettingsPage(adminPage);
    await settings.goto();
    await settings.updateAppName("MyDocklet");
    await expect(settings.successMessage).toBeVisible();
  });

  test("updated app name persists after page reload", async ({ adminPage }) => {
    const settings = new SettingsPage(adminPage);
    await settings.goto();
    await adminPage.reload();
    await expect(settings.appNameInput).toHaveValue("MyDocklet");
  });

  test("updated app name appears on the login page heading", async ({
    adminPage,
  }) => {
    await adminPage.context().clearCookies();
    const login = new LoginPage(adminPage);
    await login.goto();
    await expect(login.appHeading()).toHaveText("MyDocklet");
  });
});

test.describe("TLS Certificate UI", () => {
  test("Upload Certificate section is visible", async ({ adminPage }) => {
    const settings = new SettingsPage(adminPage);
    await settings.goto();
    await expect(adminPage.getByText("Upload Custom Certificate")).toBeVisible();
    await expect(
      adminPage.getByRole("button", { name: "Upload Certificate" })
    ).toBeVisible();
  });

  test("submitting cert form without files shows an error", async ({
    adminPage,
  }) => {
    const settings = new SettingsPage(adminPage);
    await settings.goto();
    await adminPage.getByRole("button", { name: "Upload Certificate" }).click();
    await expect(
      adminPage.getByText(/certificate and key files are required/i)
    ).toBeVisible();
  });
});

test.describe("System Restart", () => {
  test("Restart button is visible in the System section", async ({
    adminPage,
  }) => {
    const settings = new SettingsPage(adminPage);
    await settings.goto();
    await expect(
      adminPage.getByRole("button", { name: /Restart/i })
    ).toBeVisible();
  });

  test("clicking Restart shows confirm dialog; Cancel dismisses without restarting", async ({
    adminPage,
  }) => {
    const settings = new SettingsPage(adminPage);
    await settings.goto();
    await adminPage
      .getByRole("button", { name: /^Restart/i })
      .last()
      .click();
    await expect(
      adminPage.getByRole("heading", { name: /Restart/i })
    ).toBeVisible();
    await adminPage.getByRole("button", { name: "Cancel" }).click();
    await expect(
      adminPage.getByRole("heading", { name: /Restart/i })
    ).not.toBeVisible();
  });
});
