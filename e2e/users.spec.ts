import { test, expect, ADMIN_CREDS } from "./fixtures/auth.fixtures";
import { UsersPage } from "./pom/UsersPage";

test.describe("User List", () => {
  test("admin row shows (you) label", async ({ adminPage }) => {
    const users = new UsersPage(adminPage);
    await users.goto();
    await expect(users.getUserRow(ADMIN_CREDS.username)).toContainText("(you)");
  });
});
