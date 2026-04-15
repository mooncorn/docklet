import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

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

  it("creates and lists users", async () => {
    const { createUser, listUsers } = await import("./service");
    await createUser({ username: "alice", password: "password1", role: "admin" });
    await createUser({ username: "bob", password: "password2", role: "user" });
    const list = await listUsers();
    expect(list).toHaveLength(2);
    expect(list.map((u) => u.username)).toEqual(["alice", "bob"]);
    // DTO never exposes passwordHash
    expect(list[0]).not.toHaveProperty("passwordHash");
  });

  it("rejects duplicate username with 409", async () => {
    const { createUser } = await import("./service");
    await createUser({ username: "dup", password: "password1", role: "user" });
    await expect(
      createUser({ username: "dup", password: "password2", role: "user" })
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects invalid username", async () => {
    const { createUser } = await import("./service");
    await expect(
      createUser({ username: "bad name", password: "password1", role: "user" })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects short password", async () => {
    const { createUser } = await import("./service");
    await expect(
      createUser({ username: "short", password: "abc", role: "user" })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("updates role and password", async () => {
    const { createUser, updateUser } = await import("./service");
    // Seed two admins so demotion below doesn't trip last-admin guard
    const u1 = await createUser({ username: "admin1", password: "password1", role: "admin" });
    await createUser({ username: "admin2", password: "password2", role: "admin" });
    const updated = await updateUser(u1.id, { role: "user", password: "newpassword" });
    expect(updated.role).toBe("user");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(u1.updatedAt);
  });

  it("prevents demoting the last admin", async () => {
    const { createUser, updateUser } = await import("./service");
    const only = await createUser({ username: "only", password: "password1", role: "admin" });
    await expect(
      updateUser(only.id, { role: "user" })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects empty update patch", async () => {
    const { createUser, updateUser } = await import("./service");
    const u = await createUser({ username: "x", password: "password1", role: "user" });
    await expect(updateUser(u.id, {})).rejects.toMatchObject({ status: 400 });
  });

  it("prevents deleting self", async () => {
    const { createUser, deleteUser } = await import("./service");
    const u = await createUser({ username: "me", password: "password1", role: "admin" });
    await expect(deleteUser(u.id, u.id)).rejects.toMatchObject({ status: 400 });
  });

  it("prevents deleting the last admin", async () => {
    const { createUser, deleteUser } = await import("./service");
    const admin = await createUser({ username: "admin", password: "password1", role: "admin" });
    const other = await createUser({ username: "other", password: "password1", role: "user" });
    await expect(deleteUser(admin.id, other.id)).rejects.toMatchObject({ status: 400 });
  });

  it("deletes a non-last admin", async () => {
    const { createUser, deleteUser, listUsers } = await import("./service");
    const a1 = await createUser({ username: "a1", password: "password1", role: "admin" });
    const a2 = await createUser({ username: "a2", password: "password2", role: "admin" });
    await deleteUser(a1.id, a2.id);
    const list = await listUsers();
    expect(list).toHaveLength(1);
    expect(list[0].username).toBe("a2");
  });

  it("returns 404 when updating missing user", async () => {
    const { updateUser } = await import("./service");
    await expect(
      updateUser(9999, { role: "user" })
    ).rejects.toMatchObject({ status: 404 });
  });
});
