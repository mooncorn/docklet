import {
  type APIRequestContext,
  expect as pwExpect,
} from "@playwright/test";
import { test, getAdminCookie } from "./fixtures/auth.fixtures";
import { ContainersPage } from "./pom/ContainersPage";
import { CreateContainerPage } from "./pom/CreateContainerPage";
import { ContainerDetailPage } from "./pom/ContainerDetailPage";

test.describe.configure({ mode: "serial" });

async function apiDeleteContainer(
  request: APIRequestContext,
  id: string
): Promise<void> {
  const cookie = await getAdminCookie(request);
  await request.delete(`/api/containers/${id}?force=true`, {
    headers: { Cookie: cookie },
  });
}

async function apiCreateContainer(
  request: APIRequestContext,
  name: string,
  image: string,
  cmd?: string[]
): Promise<string> {
  const cookie = await getAdminCookie(request);
  const res = await request.post("/api/containers", {
    headers: { Cookie: cookie },
    data: { name, image, autoStart: false, ...(cmd ? { cmd } : {}) },
  });
  if (!res.ok()) {
    throw new Error(`create container failed: ${await res.text()}`);
  }
  const { id } = (await res.json()) as { id: string };
  return id;
}

test.describe("Create Container", () => {
  test("creates a container via the form, lands on detail page, and card appears in list", async ({
    adminPage,
    request,
  }) => {
    const create = new CreateContainerPage(adminPage);
    await create.goto();
    await create.fillBasic("e2e-create-ui", "alpine:latest");
    await create.submit();
    await pwExpect(adminPage).toHaveURL(/\/containers\/[a-f0-9]+/);
    const id = adminPage.url().split("/containers/")[1];

    const containers = new ContainersPage(adminPage);
    await containers.goto();
    await pwExpect(containers.getContainerCard("e2e-create-ui")).toBeVisible();

    await apiDeleteContainer(request, id);
  });
});

test.describe("Container Lifecycle", () => {
  test("can start, stop, and restart a container from the detail page", async ({
    adminPage,
    request,
  }) => {
    const id = await apiCreateContainer(
      request,
      "e2e-lifecycle",
      "alpine:latest",
      ["sleep", "3600"]
    );
    const detail = new ContainerDetailPage(adminPage);

    await detail.goto(id);
    await detail.start();
    await pwExpect(detail.statusBadge).toContainText(/running/i);

    await detail.stop();
    await pwExpect(detail.statusBadge).toContainText(/exited|stopped/i);

    await detail.start();
    await detail.restart();
    await pwExpect(detail.statusBadge).toContainText(/running/i);

    await apiDeleteContainer(request, id);
  });
});

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
