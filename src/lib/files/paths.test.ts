import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join, sep } from "path";
import { tmpdir } from "os";

describe("files/paths", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "docklet-paths-test-"));
    process.env.DOCKLET_DATA_DIR = tmpDir;
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DOCKLET_DATA_DIR;
  });

  describe("getFilesRoot", () => {
    it("returns data-dir/volumes", async () => {
      const { getFilesRoot } = await import("./paths");
      expect(getFilesRoot()).toBe(join(tmpDir, "volumes"));
    });
  });

  describe("resolveSafePath", () => {
    it("when path is empty or dot — resolves to root", async () => {
      const { resolveSafePath, getFilesRoot } = await import("./paths");
      const root = getFilesRoot();
      expect(resolveSafePath("")).toBe(root);
      expect(resolveSafePath(".")).toBe(root);
    });

    it("when path is nested — resolves relative to root", async () => {
      const { resolveSafePath, getFilesRoot } = await import("./paths");
      const root = getFilesRoot();
      expect(resolveSafePath("sub/dir")).toBe(join(root, "sub", "dir"));
      expect(resolveSafePath("sub/dir/file.txt")).toBe(join(root, "sub", "dir", "file.txt"));
    });

    it("when path has leading slashes — strips them before resolving", async () => {
      const { resolveSafePath, getFilesRoot } = await import("./paths");
      const root = getFilesRoot();
      expect(resolveSafePath("/sub")).toBe(join(root, "sub"));
      expect(resolveSafePath("//sub")).toBe(join(root, "sub"));
    });

    it("when path contains traversal segments — throws Invalid path", async () => {
      const { resolveSafePath } = await import("./paths");
      expect(() => resolveSafePath("../etc/passwd")).toThrow(/Invalid path/);
      expect(() => resolveSafePath("../../etc/passwd")).toThrow(/Invalid path/);
      expect(() => resolveSafePath("sub/../../etc")).toThrow(/Invalid path/);
      expect(() => resolveSafePath("foo/../../../bar")).toThrow(/Invalid path/);
    });

    it("when path traverses far above root — throws", async () => {
      const { resolveSafePath } = await import("./paths");
      expect(() => resolveSafePath("../../../etc/passwd")).toThrow();
    });
  });

  describe("toRelative", () => {
    it("returns forward-slash relative path from root", async () => {
      const { toRelative, getFilesRoot } = await import("./paths");
      const root = getFilesRoot();
      expect(toRelative(root)).toBe("");
      expect(toRelative(root + sep + "foo")).toBe("foo");
      expect(toRelative(root + sep + "a" + sep + "b.txt")).toBe("a/b.txt");
    });
  });
});
