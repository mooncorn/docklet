import {
  type APIRequestContext,
  expect as pwExpect,
} from "@playwright/test";
import { test, ADMIN_CREDS } from "./fixtures/auth.fixtures";
import { ContainersPage } from "./pom/ContainersPage";
import { CreateContainerPage } from "./pom/CreateContainerPage";
import { ContainerDetailPage } from "./pom/ContainerDetailPage";

test.describe.configure({ mode: "serial" });

// ---------------------------------------------------------------------------
// API helpers: establish known state without UI interactions
// ---------------------------------------------------------------------------

async function getAdminCookie(request: APIRequestContext): Promise<string> {
  await request.post("/api/auth/setup", {
    data: {
      username: ADMIN_CREDS.username,
      password: ADMIN_CREDS.password,
      confirmPassword: ADMIN_CREDS.password,
    },
  });
  const res = await request.post("/api/auth/login", { data: ADMIN_CREDS });
  return res.headers()["set-cookie"] ?? "";
}

async function apiCreateContainer(
  request: APIRequestContext,
  name: string,
  image: string,
  autoStart = false,
  cmd?: string[]
): Promise<string> {
  const cookie = await getAdminCookie(request);
  const res = await request.post("/api/containers", {
    headers: { Cookie: cookie },
    data: { name, image, autoStart, ...(cmd ? { cmd } : {}) },
  });
  if (!res.ok()) {
    throw new Error(`create container failed: ${await res.text()}`);
  }
  const { id } = (await res.json()) as { id: string };
  return id;
}

async function apiDeleteContainer(
  request: APIRequestContext,
  id: string
): Promise<void> {
  const cookie = await getAdminCookie(request);
  await request.delete(`/api/containers/${id}?force=true`, {
    headers: { Cookie: cookie },
  });
}

async function apiStartContainer(
  request: APIRequestContext,
  id: string
): Promise<void> {
  const cookie = await getAdminCookie(request);
  await request.post(`/api/containers/${id}/start`, {
    headers: { Cookie: cookie },
  });
}

// ---------------------------------------------------------------------------
// Container List
// ---------------------------------------------------------------------------

test.describe("Container List", () => {
  test("shows empty state when no containers exist", async ({ adminPage }) => {
    const containers = new ContainersPage(adminPage);
    await containers.goto();
    await pwExpect(containers.emptyState).toBeVisible();
  });

  test("shows Create button", async ({ adminPage }) => {
    const containers = new ContainersPage(adminPage);
    await containers.goto();
    await pwExpect(containers.createButton).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Create Container (UI)
// ---------------------------------------------------------------------------

test.describe("Create Container", () => {
  test("navigates to /containers/create from list", async ({ adminPage }) => {
    const containers = new ContainersPage(adminPage);
    await containers.goto();
    await containers.clickCreate();
    await pwExpect(adminPage).toHaveURL(/\/containers\/create/);
  });

  test("shows field error when name is blank", async ({ adminPage }) => {
    const create = new CreateContainerPage(adminPage);
    await create.goto();
    await create.imageInput.fill("alpine:latest");
    await create.submit();
    await pwExpect(adminPage.getByText("Name is required")).toBeVisible();
  });

  test("shows field error when image is blank", async ({ adminPage }) => {
    const create = new CreateContainerPage(adminPage);
    await create.goto();
    await create.nameInput.fill("test-container");
    await create.submit();
    await pwExpect(adminPage.getByText("Image is required")).toBeVisible();
  });

  test("creates a container and redirects to detail page", async ({
    adminPage,
    request,
  }) => {
    const create = new CreateContainerPage(adminPage);
    await create.goto();
    await create.fillBasic("e2e-create-ui", "alpine:latest");
    await create.submit();
    await pwExpect(adminPage).toHaveURL(/\/containers\/[a-f0-9]+/);
    const id = adminPage.url().split("/containers/")[1];
    await apiDeleteContainer(request, id);
  });

  test("created container card appears in list", async ({ adminPage, request }) => {
    const id = await apiCreateContainer(request, "e2e-list-check", "alpine:latest");
    const containers = new ContainersPage(adminPage);
    await containers.goto();
    await pwExpect(containers.getContainerCard("e2e-list-check")).toBeVisible();
    await apiDeleteContainer(request, id);
  });
});

// ---------------------------------------------------------------------------
// Container with Ports and Environment
// ---------------------------------------------------------------------------

test.describe("Container Ports and Environment", () => {
  test("port mapping and env var appear on detail tabs", async ({
    adminPage,
    request,
  }) => {
    const create = new CreateContainerPage(adminPage);
    await create.goto();
    await create.fillBasic("e2e-porttest", "nginx:alpine");
    await create.addPort("8099", "80");
    await create.addEnvVar("E2E_VAR", "hello");
    await create.submit();
    await pwExpect(adminPage).toHaveURL(/\/containers\/[a-f0-9]+/);
    const id = adminPage.url().split("/containers/")[1];
    const detail = new ContainerDetailPage(adminPage);
    await detail.selectTab("Ports");
    await pwExpect(adminPage.getByText("8099")).toBeVisible();
    await detail.selectTab("Environment");
    await pwExpect(adminPage.getByText("E2E_VAR")).toBeVisible();
    await apiDeleteContainer(request, id);
  });
});

// ---------------------------------------------------------------------------
// Container Lifecycle
// API creates container in stopped state; each test drives a specific transition
// ---------------------------------------------------------------------------

test.describe("Container Lifecycle", () => {
  let containerId: string;

  test.beforeAll(async ({ request }) => {
    containerId = await apiCreateContainer(
      request,
      "e2e-lifecycle",
      "alpine:latest",
      false,
      ["sleep", "3600"]
    );
  });

  test.afterAll(async ({ request }) => {
    await apiDeleteContainer(request, containerId);
  });

  test("can start a stopped container", async ({ adminPage }) => {
    const detail = new ContainerDetailPage(adminPage);
    await detail.goto(containerId);
    await detail.start();
    await pwExpect(detail.statusBadge).toContainText(/running/i);
  });

  test("can stop a running container", async ({ adminPage }) => {
    const detail = new ContainerDetailPage(adminPage);
    await detail.goto(containerId);
    await detail.stop();
    await pwExpect(detail.statusBadge).toContainText(/exited|stopped/i);
  });

  test("can restart a container", async ({ adminPage, request }) => {
    await apiStartContainer(request, containerId);
    const detail = new ContainerDetailPage(adminPage);
    await detail.goto(containerId);
    await detail.restart();
    await pwExpect(detail.statusBadge).toContainText(/running/i);
  });

  test("Info tab shows image name", async ({ adminPage }) => {
    const detail = new ContainerDetailPage(adminPage);
    await detail.goto(containerId);
    await detail.selectTab("Info");
    await pwExpect(adminPage.getByText("alpine:latest")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Template Save and Load
// ---------------------------------------------------------------------------

test.describe("Template Save and Load", () => {
  test("saves container config as template and loads it on a new form", async ({
    adminPage,
  }) => {
    const create = new CreateContainerPage(adminPage);
    await create.goto();
    await create.fillBasic("template-source", "redis:alpine");
    await create.saveAsTemplate("My Redis Template");
    await create.goto();
    await create.loadTemplate("My Redis Template");
    await pwExpect(create.imageInput).toHaveValue("redis:alpine");
  });
});

// ---------------------------------------------------------------------------
// Delete Container
// ---------------------------------------------------------------------------

test.describe("Delete Container", () => {
  let containerId: string;

  test.beforeAll(async ({ request }) => {
    containerId = await apiCreateContainer(
      request,
      "e2e-delete-test",
      "alpine:latest",
      false
    );
  });

  test("cancel delete keeps the user on the detail page", async ({
    adminPage,
  }) => {
    const detail = new ContainerDetailPage(adminPage);
    await detail.goto(containerId);
    await detail.delete(false);
    await pwExpect(adminPage).toHaveURL(
      new RegExp(`/containers/${containerId}`)
    );
  });

  test("confirm delete redirects to list and removes card", async ({
    adminPage,
  }) => {
    const detail = new ContainerDetailPage(adminPage);
    await detail.goto(containerId);
    await detail.delete(true);
    await pwExpect(adminPage).toHaveURL(/\/containers$/);
    const containers = new ContainersPage(adminPage);
    await containers.goto();
    await pwExpect(
      containers.getContainerCard("e2e-delete-test")
    ).not.toBeVisible();
  });
});
