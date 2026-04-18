import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { faker } from "@faker-js/faker";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("config", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "docklet-config-test-"));
    process.env.DOCKLET_DATA_DIR = tmpDir;

    const db = await import("@/lib/db");
    db.initDataDirs();
    db.runMigrations();
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DOCKLET_DATA_DIR;
  });

  describe("getSetting", () => {
    it("when key does not exist — returns null", async () => {
      const { getSetting } = await import("@/lib/config");
      expect(getSetting(faker.word.noun())).toBeNull();
    });
  });

  describe("setSetting", () => {
    it("when setting a new key — value is retrievable", async () => {
      const { getSetting, setSetting } = await import("@/lib/config");
      const key = `test_set_${faker.string.alphanumeric(6)}`;
      const value = faker.word.sample();
      setSetting(key, value);
      expect(getSetting(key)).toBe(value);
    });

    it("when overwriting an existing key — returns updated value", async () => {
      const { getSetting, setSetting } = await import("@/lib/config");
      const key = `test_overwrite_${faker.string.alphanumeric(6)}`;
      setSetting(key, "first");
      const newValue = faker.word.sample();
      setSetting(key, newValue);
      expect(getSetting(key)).toBe(newValue);
    });
  });

  describe("isSetupCompleted", () => {
    it("when no admin user exists — returns false", async () => {
      const { isSetupCompleted } = await import("@/lib/config");
      expect(isSetupCompleted()).toBe(false);
    });

    it("when an admin user exists — returns true", async () => {
      const { isSetupCompleted } = await import("@/lib/config");
      const { getDb } = await import("@/lib/db");
      const { users } = await import("@/lib/db/schema");

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
  });

  describe("ensureJwtSecret", () => {
    it("when no secret exists — generates one longer than 32 chars", async () => {
      const { ensureJwtSecret, getSetting } = await import("@/lib/config");
      ensureJwtSecret();
      const secret = getSetting("jwt_secret");
      expect(secret).toBeTruthy();
      expect(secret!.length).toBeGreaterThan(32);
    });

    it("when a secret already exists — does not overwrite it", async () => {
      const { ensureJwtSecret, getSetting } = await import("@/lib/config");
      const existing = getSetting("jwt_secret");
      ensureJwtSecret();
      expect(getSetting("jwt_secret")).toBe(existing);
    });
  });
});
