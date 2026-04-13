import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("database", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "docklet-test-"));
    process.env.DOCKLET_DATA_DIR = tmpDir;
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DOCKLET_DATA_DIR;
  });

  it("should initialize data directories", async () => {
    // Dynamic import to pick up env var
    const { initDataDirs } = await import("./index");
    initDataDirs();

    const { existsSync } = await import("fs");
    expect(existsSync(join(tmpDir, "db"))).toBe(true);
    expect(existsSync(join(tmpDir, "certs"))).toBe(true);
    expect(existsSync(join(tmpDir, "backups"))).toBe(true);
  });
});
