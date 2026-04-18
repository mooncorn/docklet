import { test, expect, getAdminCookie } from "./fixtures/auth.fixtures";
import { ImagesPage } from "./pom/ImagesPage";
import { ContainersPage } from "./pom/ContainersPage";

test.describe("Admin-only page access", () => {
  test("non-admin visiting /users is redirected", async ({ userPage }) => {
    await userPage.goto("/users");
    await expect(userPage).toHaveURL(/\/(login|containers)/);
  });

  test("non-admin visiting /settings is redirected", async ({ userPage }) => {
    await userPage.goto("/settings");
    await expect(userPage).toHaveURL(/\/(login|containers)/);
  });
});

test.describe("Sidebar navigation visibility", () => {
  test("admin sees Users and Settings links in sidebar", async ({
    adminPage,
  }) => {
    await adminPage.goto("/containers");
    await expect(
      adminPage.getByRole("link", { name: "Users" })
    ).toBeVisible();
    await expect(
      adminPage.getByRole("link", { name: "Settings" })
    ).toBeVisible();
  });

  test("regular user does not see Users link in sidebar", async ({
    userPage,
  }) => {
    await userPage.goto("/containers");
    await expect(
      userPage.getByRole("link", { name: "Users" })
    ).not.toBeVisible();
  });

  test("regular user does not see Settings link in sidebar", async ({
    userPage,
  }) => {
    await userPage.goto("/containers");
    await expect(
      userPage.getByRole("link", { name: "Settings" })
    ).not.toBeVisible();
  });
});

test.describe("Images RBAC", () => {
  test("admin can see Pull Image button", async ({ adminPage }) => {
    const images = new ImagesPage(adminPage);
    await images.goto();
    await expect(images.pullButton).toBeVisible();
  });

  test("regular user cannot see Pull Image button", async ({ userPage }) => {
    const images = new ImagesPage(userPage);
    await images.goto();
    await expect(images.pullButton).not.toBeVisible();
  });

  test("regular user cannot see delete buttons on image cards", async ({
    userPage,
  }) => {
    const images = new ImagesPage(userPage);
    await images.goto();
    await expect(
      userPage.getByRole("button", { name: "Delete image" })
    ).toHaveCount(0);
  });

  test("non-admin POST /api/images/pull returns 403", async ({ userPage }) => {
    const res = await userPage.request.post("/api/images/pull", {
      data: { image: "alpine:latest" },
    });
    expect(res.status()).toBe(403);
  });

  test("non-admin DELETE /api/images/[id] returns 403", async ({
    userPage,
  }) => {
    const res = await userPage.request.delete(
      "/api/images/sha256:fakeid?force=true"
    );
    expect(res.status()).toBe(403);
  });
});

test.describe("Users RBAC", () => {
  test("non-admin GET /api/users returns 403", async ({ userPage }) => {
    const res = await userPage.request.get("/api/users");
    expect(res.status()).toBe(403);
  });

  test("non-admin POST /api/users returns 403", async ({ userPage }) => {
    const res = await userPage.request.post("/api/users", {
      data: { username: "shouldfail", password: "password123", role: "user" },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("Settings RBAC", () => {
  test("non-admin GET /api/settings returns 403", async ({ userPage }) => {
    const res = await userPage.request.get("/api/settings");
    expect(res.status()).toBe(403);
  });

  test("non-admin PUT /api/settings returns 403", async ({ userPage }) => {
    const res = await userPage.request.put("/api/settings", {
      data: { app_name: "Hacked" },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("Container access for non-admin", () => {
  test.describe.configure({ mode: "serial" });

  let runningContainerId: string;

  test.beforeAll(async ({ request }) => {
    const cookie = await getAdminCookie(request);
    const createRes = await request.post("/api/containers", {
      headers: { Cookie: cookie },
      data: { name: "e2e-rbac-exec", image: "alpine:latest", cmd: ["sleep", "3600"] },
    });
    if (!createRes.ok()) throw new Error(`Failed to create container: ${await createRes.text()}`);
    const { id } = (await createRes.json()) as { id: string };
    await request.post(`/api/containers/${id}/start`, { headers: { Cookie: cookie } });
    runningContainerId = id;
  });

  test.afterAll(async ({ request }) => {
    const cookie = await getAdminCookie(request);
    await request.delete(`/api/containers/${runningContainerId}?force=true`, {
      headers: { Cookie: cookie },
    });
  });

  test("regular user can visit /containers", async ({ userPage }) => {
    const containers = new ContainersPage(userPage);
    await containers.goto();
    await expect(containers.heading).toBeVisible();
  });

  test("regular user can see Create button", async ({ userPage }) => {
    const containers = new ContainersPage(userPage);
    await containers.goto();
    await expect(containers.createButton).toBeVisible();
  });

  test("exec command input is not shown for non-admin on container detail", async ({
    userPage,
  }) => {
    await userPage.goto(`/containers/${runningContainerId}`);
    await userPage.getByRole("button", { name: "Logs" }).waitFor({ state: "visible" });
    await expect(
      userPage.getByPlaceholder("Enter command...")
    ).toHaveCount(0);
  });
});
