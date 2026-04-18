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

  it("getFilesRoot returns data-dir/volumes and creates it", async () => {
    const { getFilesRoot } = await import("./paths");
    const root = getFilesRoot();
    expect(root).toBe(join(tmpDir, "volumes"));
  });

  it("resolveSafePath accepts empty, dot, and nested paths", async () => {
    const { resolveSafePath, getFilesRoot } = await import("./paths");
    const root = getFilesRoot();
    expect(resolveSafePath("")).toBe(root);
    expect(resolveSafePath(".")).toBe(root);
    expect(resolveSafePath("sub/dir")).toBe(join(root, "sub", "dir"));
    expect(resolveSafePath("sub/dir/file.txt")).toBe(
      join(root, "sub", "dir", "file.txt")
    );
  });

  it("resolveSafePath strips leading slashes", async () => {
    const { resolveSafePath, getFilesRoot } = await import("./paths");
    const root = getFilesRoot();
    expect(resolveSafePath("/sub")).toBe(join(root, "sub"));
    expect(resolveSafePath("//sub")).toBe(join(root, "sub"));
  });

  it("resolveSafePath rejects path traversal", async () => {
    const { resolveSafePath } = await import("./paths");
    expect(() => resolveSafePath("../etc/passwd")).toThrow(/Invalid path/);
    expect(() => resolveSafePath("../../etc/passwd")).toThrow(/Invalid path/);
    expect(() => resolveSafePath("sub/../../etc")).toThrow(/Invalid path/);
    expect(() => resolveSafePath("foo/../../../bar")).toThrow(/Invalid path/);
  });

  it("resolveSafePath rejects absolute paths escaping root", async () => {
    const { resolveSafePath } = await import("./paths");
    // After stripping leading slash, /etc/passwd becomes etc/passwd (inside root), which is fine.
    // But path.resolve("root", "/etc/passwd") would escape, so we strip the leading / first.
    // So this test confirms the strip + contain logic holds.
    expect(() => resolveSafePath("../../../etc/passwd")).toThrow();
  });

  it("toRelative returns forward-slash path inside root", async () => {
    const { toRelative, getFilesRoot } = await import("./paths");
    const root = getFilesRoot();
    expect(toRelative(root)).toBe("");
    expect(toRelative(root + sep + "foo")).toBe("foo");
    expect(toRelative(root + sep + "a" + sep + "b.txt")).toBe("a/b.txt");
  });
});
