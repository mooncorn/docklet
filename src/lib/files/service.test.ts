import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("file-type", () => ({
  fileTypeFromBuffer: vi.fn(async () => undefined),
}));

describe("files/service", () => {
  let tmpDir: string;
  let volumesDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "docklet-fs-test-"));
    process.env.DOCKLET_DATA_DIR = tmpDir;
    volumesDir = join(tmpDir, "volumes");
    mkdirSync(volumesDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DOCKLET_DATA_DIR;
  });

  beforeEach(async () => {
    rmSync(volumesDir, { recursive: true, force: true });
    mkdirSync(volumesDir, { recursive: true });
    const { fileTypeFromBuffer } = await import("file-type");
    vi.mocked(fileTypeFromBuffer).mockReset().mockResolvedValue(undefined);
  });

  describe("listDir", () => {
    it("when directory has both dirs and files — returns dirs first then files, alpha sorted", async () => {
      mkdirSync(join(volumesDir, "zeta"));
      mkdirSync(join(volumesDir, "alpha"));
      writeFileSync(join(volumesDir, "b.txt"), "b");
      writeFileSync(join(volumesDir, "a.txt"), "a");

      const { listDir } = await import("./service");
      const entries = await listDir("");
      expect(entries.map((e) => e.name)).toEqual(["alpha", "zeta", "a.txt", "b.txt"]);
      expect(entries[0].isDir).toBe(true);
      expect(entries[2].isDir).toBe(false);
    });

    it("when path contains traversal — rejects with 400", async () => {
      const { listDir } = await import("./service");
      await expect(listDir("../..")).rejects.toMatchObject({ status: 400 });
    });

    it("when file has no binary signature — entry has isText true", async () => {
      writeFileSync(join(volumesDir, "notes.txt"), "hello world");

      const { listDir } = await import("./service");
      const entries = await listDir("");

      expect(entries).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "notes.txt", isText: true }),
      ]));
    });

    it("when fileTypeFromBuffer detects binary mime — entry has isText false", async () => {
      const { fileTypeFromBuffer } = await import("file-type");
      vi.mocked(fileTypeFromBuffer).mockResolvedValue({ mime: "image/png", ext: "png" });
      writeFileSync(join(volumesDir, "img.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const { listDir } = await import("./service");
      const entries = await listDir("");

      expect(entries).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "img.png", isText: false }),
      ]));
    });

    it("when entry is a directory — isText is false regardless of content", async () => {
      mkdirSync(join(volumesDir, "subdir"));

      const { listDir } = await import("./service");
      const entries = await listDir("");

      expect(entries).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "subdir", isDir: true, isText: false }),
      ]));
    });

    it("when file is empty — entry has isText true", async () => {
      writeFileSync(join(volumesDir, "empty.txt"), "");

      const { listDir } = await import("./service");
      const entries = await listDir("");

      expect(entries).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "empty.txt", isText: true }),
      ]));
    });
  });

  describe("writeTextFile + readTextFile", () => {
    it("round-trip preserves content and encoding", async () => {
      const { writeTextFile, readTextFile } = await import("./service");
      await writeTextFile("hello.txt", "world\n");
      const { content, encoding } = await readTextFile("hello.txt");
      expect(content).toBe("world\n");
      expect(encoding).toBe("utf-8");
    });

    it("writeTextFile creates intermediate directories", async () => {
      const { writeTextFile } = await import("./service");
      await writeTextFile("a/b/c.txt", "nested");
      const buf = await readFile(join(volumesDir, "a", "b", "c.txt"), "utf-8");
      expect(buf).toBe("nested");
    });

    it("readTextFile — when file has binary mime type — rejects with 415", async () => {
      const { fileTypeFromBuffer } = await import("file-type");
      vi.mocked(fileTypeFromBuffer).mockResolvedValue({ mime: "image/png", ext: "png" });
      writeFileSync(join(volumesDir, "img.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      const { readTextFile } = await import("./service");
      await expect(readTextFile("img.png")).rejects.toMatchObject({ status: 415 });
    });

    it("readTextFile — when file has explicit text mime type — returns content", async () => {
      const { fileTypeFromBuffer } = await import("file-type");
      vi.mocked(fileTypeFromBuffer).mockResolvedValue({ mime: "application/json", ext: "json" });
      writeFileSync(join(volumesDir, "data.json"), '{"ok":true}');
      const { readTextFile } = await import("./service");
      const { content } = await readTextFile("data.json");
      expect(content).toBe('{"ok":true}');
    });

    it("readTextFile — when file does not exist — rejects with 404", async () => {
      const { readTextFile } = await import("./service");

      await expect(readTextFile("ghost.txt")).rejects.toMatchObject({ status: 404 });
    });

    it("readTextFile — when file exceeds max bytes — rejects with 413", async () => {
      writeFileSync(join(volumesDir, "big.txt"), "x".repeat(1000));
      const { readTextFile } = await import("./service");
      await expect(readTextFile("big.txt", 100)).rejects.toMatchObject({ status: 413 });
    });
  });

  describe("mkdir", () => {
    it("creates directory and returns a dir entry", async () => {
      const { mkdir } = await import("./service");
      const entry = await mkdir("new-dir");
      expect(entry.isDir).toBe(true);
      expect(existsSync(join(volumesDir, "new-dir"))).toBe(true);
    });
  });

  describe("rename", () => {
    it("moves file to new path", async () => {
      writeFileSync(join(volumesDir, "old.txt"), "data");
      const { rename } = await import("./service");
      const entry = await rename("old.txt", "sub/new.txt");
      expect(entry.path).toBe("sub/new.txt");
      expect(existsSync(join(volumesDir, "old.txt"))).toBe(false);
      expect(existsSync(join(volumesDir, "sub", "new.txt"))).toBe(true);
    });
  });

  describe("remove", () => {
    it("recursively deletes a directory", async () => {
      mkdirSync(join(volumesDir, "trash", "inner"), { recursive: true });
      writeFileSync(join(volumesDir, "trash", "inner", "a"), "a");
      const { remove } = await import("./service");
      await remove("trash");
      expect(existsSync(join(volumesDir, "trash"))).toBe(false);
    });

    it("when path is empty string — rejects with 400", async () => {
      const { remove } = await import("./service");
      await expect(remove("")).rejects.toMatchObject({ status: 400 });
    });

    it("when path is '.' — rejects with 400", async () => {
      const { remove } = await import("./service");
      await expect(remove(".")).rejects.toMatchObject({ status: 400 });
    });
  });

  describe("saveUploadStream", () => {
    it("when stream exceeds byte limit — rejects with 413 and removes partial file", async () => {
      const { saveUploadStream } = await import("./service");
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(100));
          controller.enqueue(new Uint8Array(100));
          controller.close();
        },
      });
      await expect(
        saveUploadStream("", "upload.bin", body, 150)
      ).rejects.toMatchObject({ status: 413 });
      expect(existsSync(join(volumesDir, "upload.bin"))).toBe(false);
    });

    it("when stream is within limit — writes file with correct size", async () => {
      const { saveUploadStream } = await import("./service");
      const payload = new Uint8Array(50).fill(0x41);
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(payload);
          controller.close();
        },
      });
      const entry = await saveUploadStream("", "ok.txt", body, 1024);
      expect(entry.size).toBe(50);
      expect(existsSync(join(volumesDir, "ok.txt"))).toBe(true);
    });

    it("when filename contains path traversal — rejects with 400", async () => {
      const { saveUploadStream } = await import("./service");
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([0x41]));
          controller.close();
        },
      });
      await expect(
        saveUploadStream("", "../evil.txt", body)
      ).rejects.toMatchObject({ status: 400 });
    });
  });
});
