import { test, expect } from "./fixtures/auth.fixtures";
import { ImagesPage } from "./pom/ImagesPage";

test.describe("Image List", () => {
  test("images page loads for admin with Pull button", async ({
    adminPage,
  }) => {
    const images = new ImagesPage(adminPage);
    await images.goto();
    await expect(images.heading).toBeVisible();
    await expect(images.pullButton).toBeVisible();
  });
});
