import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("initDataDirs", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "docklet-test-"));
    process.env.DOCKLET_DATA_DIR = tmpDir;
    const { initDataDirs } = await import("./index");
    initDataDirs();
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DOCKLET_DATA_DIR;
  });

  it("creates the db/ subdirectory", () => {
    expect(existsSync(join(tmpDir, "db"))).toBe(true);
  });

  it("creates the certs/ subdirectory", () => {
    expect(existsSync(join(tmpDir, "certs"))).toBe(true);
  });

  it("creates the backups/ subdirectory", () => {
    expect(existsSync(join(tmpDir, "backups"))).toBe(true);
  });
});
