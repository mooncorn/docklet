import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { faker } from "@faker-js/faker";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function username() {
  return faker.internet.username().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 20);
}

function password() {
  return faker.internet.password({ length: 12 });
}

describe("users/service", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "docklet-users-test-"));
    process.env.DOCKLET_DATA_DIR = tmpDir;
    const db = await import("@/lib/db");
    db.initDataDirs();
    db.runMigrations();
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DOCKLET_DATA_DIR;
  });

  beforeEach(async () => {
    const { getDb } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");
    getDb().delete(users).run();
  });

  describe("createUser", () => {
    it("creates a user that appears in listUsers", async () => {
      const { createUser, listUsers } = await import("./service");
      const name = username();
      await createUser({ username: name, password: password(), role: "admin" });
      const list = await listUsers();
      expect(list).toHaveLength(1);
      expect(list[0].username).toBe(name);
    });

    it("when username is duplicate — rejects with 409", async () => {
      const { createUser } = await import("./service");
      const name = username();
      await createUser({ username: name, password: password(), role: "user" });
      await expect(
        createUser({ username: name, password: password(), role: "user" })
      ).rejects.toMatchObject({ status: 409 });
    });

    it("when username contains spaces — rejects with 400", async () => {
      const { createUser } = await import("./service");
      await expect(
        createUser({ username: "bad name", password: password(), role: "user" })
      ).rejects.toMatchObject({ status: 400 });
    });

    it("when password is shorter than 8 chars — rejects with 400", async () => {
      const { createUser } = await import("./service");
      await expect(
        createUser({ username: username(), password: "abc", role: "user" })
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe("listUsers", () => {
    it("DTO does not expose passwordHash", async () => {
      const { createUser, listUsers } = await import("./service");
      await createUser({ username: username(), password: password(), role: "admin" });
      const list = await listUsers();
      expect(list[0]).not.toHaveProperty("passwordHash");
    });
  });

  describe("updateUser", () => {
    it("when updating role — persists new role", async () => {
      const { createUser, updateUser } = await import("./service");
      const a1 = await createUser({ username: username(), password: password(), role: "admin" });
      await createUser({ username: username(), password: password(), role: "admin" });
      const updated = await updateUser(a1.id, { role: "user" });
      expect(updated.role).toBe("user");
    });

    it("when updating password — updatedAt is refreshed", async () => {
      const { createUser, updateUser } = await import("./service");
      const u = await createUser({ username: username(), password: password(), role: "user" });
      const updated = await updateUser(u.id, { password: password() });
      expect(updated.updatedAt).toBeGreaterThanOrEqual(u.updatedAt);
    });

    it("when demoting the last admin — rejects with 400", async () => {
      const { createUser, updateUser } = await import("./service");
      const only = await createUser({ username: username(), password: password(), role: "admin" });
      await expect(
        updateUser(only.id, { role: "user" })
      ).rejects.toMatchObject({ status: 400 });
    });

    it("when patch is empty — rejects with 400", async () => {
      const { createUser, updateUser } = await import("./service");
      const u = await createUser({ username: username(), password: password(), role: "user" });
      await expect(updateUser(u.id, {})).rejects.toMatchObject({ status: 400 });
    });

    it("when user does not exist — rejects with 404", async () => {
      const { updateUser } = await import("./service");
      await expect(
        updateUser(9999, { role: "user" })
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("deleteUser", () => {
    it("when deleting self — rejects with 400", async () => {
      const { createUser, deleteUser } = await import("./service");
      const u = await createUser({ username: username(), password: password(), role: "admin" });
      await expect(deleteUser(u.id, u.id)).rejects.toMatchObject({ status: 400 });
    });

    it("when deleting the last admin — rejects with 400", async () => {
      const { createUser, deleteUser } = await import("./service");
      const admin = await createUser({ username: username(), password: password(), role: "admin" });
      const other = await createUser({ username: username(), password: password(), role: "user" });
      await expect(deleteUser(admin.id, other.id)).rejects.toMatchObject({ status: 400 });
    });

    it("when deleting a non-last admin — removes the user", async () => {
      const { createUser, deleteUser, listUsers } = await import("./service");
      const name2 = username();
      const a1 = await createUser({ username: username(), password: password(), role: "admin" });
      const a2 = await createUser({ username: name2, password: password(), role: "admin" });
      await deleteUser(a1.id, a2.id);
      const list = await listUsers();
      expect(list).toHaveLength(1);
      expect(list[0].username).toBe(name2);
    });
  });
});
