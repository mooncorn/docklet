import { test, expect } from "./fixtures/auth.fixtures";
import { ImagesPage } from "./pom/ImagesPage";

test.describe.configure({ mode: "serial" });

test.describe("Image List", () => {
  test("images page loads for admin", async ({ adminPage }) => {
    const images = new ImagesPage(adminPage);
    await images.goto();
    await expect(images.heading).toBeVisible();
  });

  test("Pull Image button is visible for admin", async ({ adminPage }) => {
    const images = new ImagesPage(adminPage);
    await images.goto();
    await expect(images.pullButton).toBeVisible();
  });
});

test.describe("Pull Image", () => {
  test("opens Pull Image modal and can be dismissed", async ({ adminPage }) => {
    const images = new ImagesPage(adminPage);
    await images.goto();
    await images.openPullModal();
    await expect(
      adminPage.getByRole("heading", { name: "Pull Image" })
    ).toBeVisible();
    await adminPage.keyboard.press("Escape");
    await expect(
      adminPage.getByRole("heading", { name: "Pull Image" })
    ).not.toBeVisible();
  });

  test("pulls busybox:latest and shows it in the list", async ({
    adminPage,
  }) => {
    test.skip(
      !process.env["DOCKER_E2E_NETWORK"],
      "Requires Docker Hub access. Set DOCKER_E2E_NETWORK=1 to enable"
    );
    test.setTimeout(180_000);
    const images = new ImagesPage(adminPage);
    await images.goto();
    await images.pullImage("busybox:latest", 120_000);
    await expect(images.getImageCard("busybox")).toBeVisible({
      timeout: 30_000,
    });
  });
});

test.describe("Delete Image", () => {
  test("deletes busybox:latest and removes it from the list", async ({
    adminPage,
  }) => {
    test.skip(
      !process.env["DOCKER_E2E_NETWORK"],
      "Requires pull test to have run first. Set DOCKER_E2E_NETWORK=1 to enable"
    );
    const images = new ImagesPage(adminPage);
    await images.goto();
    const card = images.getImageCard("busybox");
    await images.deleteImage("busybox");
    await expect(card).not.toBeVisible();
  });
});
