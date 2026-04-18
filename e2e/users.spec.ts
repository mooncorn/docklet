import { type APIRequestContext } from "@playwright/test";
import { test, expect, ADMIN_CREDS } from "./fixtures/auth.fixtures";
import { UsersPage } from "./pom/UsersPage";

test.describe.configure({ mode: "serial" });

async function getAdminCookie(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/auth/login", { data: ADMIN_CREDS });
  return res.headers()["set-cookie"] ?? "";
}

async function apiDeleteUserByUsername(
  request: APIRequestContext,
  username: string
): Promise<void> {
  const cookie = await getAdminCookie(request);
  const listRes = await request.get("/api/users", {
    headers: { Cookie: cookie },
  });
  const users = (await listRes.json()) as Array<{
    id: number;
    username: string;
  }>;
  const user = users.find((u) => u.username === username);
  if (!user) return;
  await request.delete(`/api/users/${user.id}`, {
    headers: { Cookie: cookie },
  });
}

test.describe("User List", () => {
  test("users page loads for admin", async ({ adminPage }) => {
    const users = new UsersPage(adminPage);
    await users.goto();
    await expect(users.heading).toBeVisible();
  });

  test("admin user row is present", async ({ adminPage }) => {
    const users = new UsersPage(adminPage);
    await users.goto();
    await expect(users.getUserRow(ADMIN_CREDS.username)).toBeVisible();
  });

  test("admin row shows (you) label", async ({ adminPage }) => {
    const users = new UsersPage(adminPage);
    await users.goto();
    await expect(users.getUserRow(ADMIN_CREDS.username)).toContainText("(you)");
  });
});

test.describe("Create User", () => {
  test.afterAll(async ({ request }) => {
    await apiDeleteUserByUsername(request, "newuser1");
    await apiDeleteUserByUsername(request, "newmod1");
  });

  test("creates a user with role user", async ({ adminPage }) => {
    const users = new UsersPage(adminPage);
    await users.goto();
    await users.createUser({
      username: "newuser1",
      password: "newpass123",
      role: "user",
    });
    await expect(users.getUserRow("newuser1")).toBeVisible();
    await expect(users.getUserRow("newuser1")).toContainText("user");
  });

  test("creates a user with role mod", async ({ adminPage }) => {
    const users = new UsersPage(adminPage);
    await users.goto();
    await users.createUser({
      username: "newmod1",
      password: "modpass123",
      role: "mod",
    });
    await expect(users.getUserRow("newmod1")).toBeVisible();
    await expect(users.getUserRow("newmod1")).toContainText("mod");
  });

  test("shows error for duplicate username", async ({ adminPage }) => {
    const users = new UsersPage(adminPage);
    await users.goto();
    await users.openCreateModal();
    await adminPage.getByLabel("Username").fill(ADMIN_CREDS.username);
    await adminPage.getByLabel("Password").fill("password999");
    await adminPage.getByRole("button", { name: "Create" }).click();
    await expect(users.createError).toBeVisible();
    await expect(users.createError).toContainText(/already exists/i);
  });

  test("Create button is disabled when password is too short", async ({
    adminPage,
  }) => {
    const users = new UsersPage(adminPage);
    await users.goto();
    await users.openCreateModal();
    await adminPage.getByLabel("Username").fill("shortpwduser");
    await adminPage.getByLabel("Password").fill("short");
    await expect(
      adminPage.getByRole("button", { name: "Create" })
    ).toBeDisabled();
  });
});

test.describe("Edit User", () => {
  test.beforeAll(async ({ request }) => {
    const cookie = await getAdminCookie(request);
    for (const creds of [
      { username: "edituser1", password: "editpass123", role: "user" },
      { username: "editmod1", password: "editpass456", role: "mod" },
    ]) {
      const res = await request.post("/api/users", {
        headers: { Cookie: cookie },
        data: creds,
      });
      if (!res.ok() && res.status() !== 409) {
        throw new Error(`Failed to create ${creds.username}: ${await res.text()}`);
      }
    }
  });

  test.afterAll(async ({ request }) => {
    await apiDeleteUserByUsername(request, "edituser1");
    await apiDeleteUserByUsername(request, "editmod1");
  });

  test("changes user role from user to mod", async ({ adminPage }) => {
    const users = new UsersPage(adminPage);
    await users.goto();
    await users.editUser("edituser1", { role: "mod" });
    await expect(users.getUserRow("edituser1")).toContainText("mod");
  });

  test("resets user password and new password works for login", async ({
    adminPage,
    request,
  }) => {
    const users = new UsersPage(adminPage);
    await users.goto();
    await users.editUser("editmod1", { password: "updatedpass456" });
    const res = await request.post("/api/auth/login", {
      data: { username: "editmod1", password: "updatedpass456" },
    });
    await expect(res.ok()).toBe(true);
  });
});

test.describe("Delete User", () => {
  test.beforeAll(async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const res = await request.post("/api/users", {
      headers: { Cookie: cookie },
      data: { username: "deleteuser1", password: "deletepass123", role: "user" },
    });
    if (!res.ok() && res.status() !== 409) {
      throw new Error(`Failed to create deleteuser1: ${await res.text()}`);
    }
  });

  test("deletes a non-self user", async ({ adminPage }) => {
    const users = new UsersPage(adminPage);
    await users.goto();
    await users.deleteUser("deleteuser1");
    await expect(users.getUserRow("deleteuser1")).not.toBeVisible();
  });

  test("self-delete button is disabled for current user", async ({
    adminPage,
  }) => {
    const users = new UsersPage(adminPage);
    await users.goto();
    await expect(
      users.getDeleteButton(ADMIN_CREDS.username)
    ).toBeDisabled();
  });

  test("API rejects self-deletion with 400", async ({ adminPage, request }) => {
    const meRes = await adminPage.request.get("/api/auth/me");
    const { user } = (await meRes.json()) as { user: { id: number } };
    const cookie = await getAdminCookie(request);
    const res = await request.delete(`/api/users/${user.id}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Cannot delete your own account");
  });
});
