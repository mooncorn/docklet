import { type APIRequestContext } from "@playwright/test";
import { test, expect, getAdminCookie } from "./fixtures/auth.fixtures";
import { SettingsPage } from "./pom/SettingsPage";
import { LoginPage } from "./pom/LoginPage";

async function restoreAppName(
  request: APIRequestContext,
  name: string
): Promise<void> {
  const cookie = await getAdminCookie(request);
  await request.put("/api/settings", {
    headers: { Cookie: cookie },
    data: { app_name: name },
  });
}

test.describe("App Name Setting", () => {
  test("updated app name persists on reload and shows on the login page", async ({
    adminPage,
    request,
  }) => {
    const cookie = await getAdminCookie(request);
    const originalRes = await request.get("/api/settings", {
      headers: { Cookie: cookie },
    });
    const originalName =
      ((await originalRes.json()) as { app_name?: string }).app_name ?? "Docklet";

    try {
      const settings = new SettingsPage(adminPage);
      await settings.goto();
      await settings.updateAppName("MyDocklet");
      await adminPage.reload();
      await expect(settings.appNameInput).toHaveValue("MyDocklet");

      await adminPage.context().clearCookies();
      const login = new LoginPage(adminPage);
      await login.goto();
      await expect(login.appHeading()).toHaveText("MyDocklet");
    } finally {
      await restoreAppName(request, originalName);
    }
  });
});
