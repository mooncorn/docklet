import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("file-type", () => ({
  fileTypeFromFile: vi.fn(async () => undefined),
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
    // Clean volumes dir between tests
    rmSync(volumesDir, { recursive: true, force: true });
    mkdirSync(volumesDir, { recursive: true });
    const { fileTypeFromFile } = await import("file-type");
    vi.mocked(fileTypeFromFile).mockReset().mockResolvedValue(undefined);
  });

  it("listDir returns dirs first, then files, alpha sorted", async () => {
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

  it("writeTextFile + readTextFile round-trip", async () => {
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

  it("readTextFile rejects binary files by mime", async () => {
    const { fileTypeFromFile } = await import("file-type");
    vi.mocked(fileTypeFromFile).mockResolvedValue({ mime: "image/png", ext: "png" });
    writeFileSync(join(volumesDir, "img.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const { readTextFile } = await import("./service");
    await expect(readTextFile("img.png")).rejects.toMatchObject({ status: 415 });
  });

  it("readTextFile accepts explicit text mimes", async () => {
    const { fileTypeFromFile } = await import("file-type");
    vi.mocked(fileTypeFromFile).mockResolvedValue({ mime: "application/json", ext: "json" });
    writeFileSync(join(volumesDir, "data.json"), '{"ok":true}');
    const { readTextFile } = await import("./service");
    const { content } = await readTextFile("data.json");
    expect(content).toBe('{"ok":true}');
  });

  it("readTextFile rejects files larger than max bytes", async () => {
    writeFileSync(join(volumesDir, "big.txt"), "x".repeat(1000));
    const { readTextFile } = await import("./service");
    await expect(readTextFile("big.txt", 100)).rejects.toMatchObject({ status: 413 });
  });

  it("mkdir creates directory", async () => {
    const { mkdir } = await import("./service");
    const entry = await mkdir("new-dir");
    expect(entry.isDir).toBe(true);
    expect(existsSync(join(volumesDir, "new-dir"))).toBe(true);
  });

  it("rename moves file to new path", async () => {
    writeFileSync(join(volumesDir, "old.txt"), "data");
    const { rename } = await import("./service");
    const entry = await rename("old.txt", "sub/new.txt");
    expect(entry.path).toBe("sub/new.txt");
    expect(existsSync(join(volumesDir, "old.txt"))).toBe(false);
    expect(existsSync(join(volumesDir, "sub", "new.txt"))).toBe(true);
  });

  it("remove recursively deletes a directory", async () => {
    mkdirSync(join(volumesDir, "trash", "inner"), { recursive: true });
    writeFileSync(join(volumesDir, "trash", "inner", "a"), "a");
    const { remove } = await import("./service");
    await remove("trash");
    expect(existsSync(join(volumesDir, "trash"))).toBe(false);
  });

  it("remove rejects deletion of root", async () => {
    const { remove } = await import("./service");
    await expect(remove("")).rejects.toMatchObject({ status: 400 });
    await expect(remove(".")).rejects.toMatchObject({ status: 400 });
  });

  it("saveUploadStream aborts and unlinks partial file on overflow", async () => {
    const { saveUploadStream } = await import("./service");
    // Build a web stream that yields 200 bytes
    const chunks = [new Uint8Array(100), new Uint8Array(100)];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(c);
        controller.close();
      },
    });
    await expect(
      saveUploadStream("", "upload.bin", body, 150)
    ).rejects.toMatchObject({ status: 413 });
    expect(existsSync(join(volumesDir, "upload.bin"))).toBe(false);
  });

  it("saveUploadStream writes file within limit", async () => {
    const { saveUploadStream } = await import("./service");
    const payload = new Uint8Array(50).fill(0x41); // 'A' * 50
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

  it("saveUploadStream rejects unsafe filenames", async () => {
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

  it("listDir rejects path traversal", async () => {
    const { listDir } = await import("./service");
    await expect(listDir("../..")).rejects.toMatchObject({ status: 400 });
  });
});
