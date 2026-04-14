import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("config", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "docklet-config-test-"));
    process.env.DOCKLET_DATA_DIR = tmpDir;

    // Initialize DB - use dynamic import to pick up env var
    const db = await import("@/lib/db");
    db.initDataDirs();
    db.runMigrations();
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DOCKLET_DATA_DIR;
  });

  it("should get and set settings", async () => {
    const { getSetting, setSetting } = await import("@/lib/config");

    expect(getSetting("test_key")).toBeNull();

    setSetting("test_key", "test_value");
    expect(getSetting("test_key")).toBe("test_value");

    setSetting("test_key", "updated_value");
    expect(getSetting("test_key")).toBe("updated_value");
  });

  it("should check setup completion based on admin user existence", async () => {
    const { isSetupCompleted } = await import("@/lib/config");
    const { getDb } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");

    expect(isSetupCompleted()).toBe(false);

    const db = getDb();
    const now = new Date();
    db.insert(users).values({
      username: "admin",
      passwordHash: "hash",
      role: "admin",
      createdAt: now,
      updatedAt: now,
    }).run();

    expect(isSetupCompleted()).toBe(true);
  });

  it("should ensure JWT secret", async () => {
    const { ensureJwtSecret, getSetting } = await import("@/lib/config");

    ensureJwtSecret();
    const secret = getSetting("jwt_secret");
    expect(secret).toBeTruthy();
    expect(secret!.length).toBeGreaterThan(32);

    // Should not overwrite existing secret
    ensureJwtSecret();
    expect(getSetting("jwt_secret")).toBe(secret);
  });
});
