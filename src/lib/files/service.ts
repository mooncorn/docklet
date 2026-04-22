import { createReadStream, createWriteStream } from "fs";
import { readdir, stat, readFile, writeFile, mkdir as fsMkdir, rename as fsRename, rm, unlink, open } from "fs/promises";
import { basename, dirname, join } from "path";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { fileTypeFromBuffer } from "file-type";
import { AppError } from "@/lib/errors";
import { resolveSafePath, toRelative } from "./paths";

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mtime: number;
  mode: string;
  isText: boolean;
}

export const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

async function entryFromAbs(absPath: string, isText = false): Promise<FileEntry> {
  const st = await stat(absPath);
  return {
    name: basename(absPath),
    path: toRelative(absPath),
    isDir: st.isDirectory(),
    size: st.size,
    mtime: st.mtimeMs,
    mode: (st.mode & 0o777).toString(8).padStart(3, "0"),
    isText: st.isDirectory() ? false : isText,
  };
}

async function readFileChunk(absPath: string, bytes = 4100): Promise<Buffer> {
  const chunk = Buffer.alloc(bytes);
  const fd = await open(absPath, "r");
  try {
    const { bytesRead } = await fd.read(chunk, 0, bytes, 0);
    return chunk.subarray(0, bytesRead);
  } finally {
    await fd.close();
  }
}

async function detectIsText(absPath: string): Promise<boolean> {
  let buf: Buffer;
  try {
    buf = await readFileChunk(absPath);
  } catch {
    return false;
  }
  const detected = await fileTypeFromBuffer(buf);
  return detected ? isTextMime(detected.mime) : true;
}

function wrapFsError(err: unknown): never {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new AppError(404, "Not found");
    if (code === "EEXIST") throw new AppError(409, "Already exists");
    if (code === "EACCES" || code === "EPERM") throw new AppError(403, "Permission denied");
    if (code === "ENOTDIR") throw new AppError(400, "Not a directory");
    if (code === "EISDIR") throw new AppError(400, "Is a directory");
  }
  throw err;
}

export async function listDir(relPath: string): Promise<FileEntry[]> {
  const abs = resolveSafePath(relPath);
  let names: string[];
  try {
    const st = await stat(abs);
    if (!st.isDirectory()) throw new AppError(400, "Not a directory");
    names = await readdir(abs);
  } catch (err) {
    if (err instanceof AppError) throw err;
    wrapFsError(err);
  }
  const entries = await Promise.all(
    names!.map(async (name) => {
      try {
        const filePath = join(abs, name);
        const isText = await detectIsText(filePath).catch(() => false);
        return await entryFromAbs(filePath, isText);
      } catch {
        return null;
      }
    })
  );
  return entries
    .filter((e): e is FileEntry => e !== null)
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export async function statPath(relPath: string): Promise<FileEntry> {
  const abs = resolveSafePath(relPath);
  try {
    return await entryFromAbs(abs);
  } catch (err) {
    wrapFsError(err);
  }
}

export async function readTextFile(
  relPath: string,
  maxBytes: number = MAX_TEXT_FILE_BYTES
): Promise<{ content: string; encoding: "utf-8"; entry: FileEntry }> {
  const abs = resolveSafePath(relPath);
  let entry: FileEntry;
  try {
    entry = await entryFromAbs(abs);
  } catch (err) {
    wrapFsError(err);
  }
  if (entry.isDir) throw new AppError(400, "Is a directory");
  if (entry.size > maxBytes) {
    throw new AppError(413, `File too large (max ${maxBytes} bytes)`);
  }
  let chunk: Buffer;
  try {
    chunk = await readFileChunk(abs);
  } catch (err) {
    wrapFsError(err);
  }
  const detected = await fileTypeFromBuffer(chunk).catch(() => undefined);
  if (detected && !isTextMime(detected.mime)) {
    throw new AppError(415, `Binary file (${detected.mime})`);
  }
  const buf = await readFile(abs);
  return { content: buf.toString("utf-8"), encoding: "utf-8", entry };
}

function isTextMime(mime: string): boolean {
  if (mime.startsWith("text/")) return true;
  const textLike = new Set([
    "application/json",
    "application/xml",
    "application/javascript",
    "application/x-sh",
    "application/x-yaml",
    "application/toml",
  ]);
  return textLike.has(mime);
}

export async function writeTextFile(
  relPath: string,
  content: string
): Promise<FileEntry> {
  if (Buffer.byteLength(content, "utf-8") > MAX_TEXT_FILE_BYTES) {
    throw new AppError(413, `Content too large (max ${MAX_TEXT_FILE_BYTES} bytes)`);
  }
  const abs = resolveSafePath(relPath);
  try {
    await fsMkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf-8");
    return await entryFromAbs(abs);
  } catch (err) {
    wrapFsError(err);
  }
}

export async function mkdir(relPath: string): Promise<FileEntry> {
  const abs = resolveSafePath(relPath);
  try {
    await fsMkdir(abs, { recursive: false });
    return await entryFromAbs(abs);
  } catch (err) {
    wrapFsError(err);
  }
}

export async function rename(relPath: string, newRelPath: string): Promise<FileEntry> {
  const absFrom = resolveSafePath(relPath);
  const absTo = resolveSafePath(newRelPath);
  try {
    await fsMkdir(dirname(absTo), { recursive: true });
    await fsRename(absFrom, absTo);
    return await entryFromAbs(absTo);
  } catch (err) {
    wrapFsError(err);
  }
}

export async function remove(relPath: string): Promise<void> {
  const abs = resolveSafePath(relPath);
  if (relPath === "" || relPath === "/" || relPath === ".") {
    throw new AppError(400, "Cannot delete root");
  }
  try {
    await rm(abs, { recursive: true, force: false });
  } catch (err) {
    wrapFsError(err);
  }
}

export async function createDownloadStream(relPath: string): Promise<{
  stream: NodeJS.ReadableStream;
  size: number;
  filename: string;
}> {
  const abs = resolveSafePath(relPath);
  let st: Awaited<ReturnType<typeof stat>>;
  try {
    st = await stat(abs);
  } catch (err) {
    wrapFsError(err);
  }
  if (st.isDirectory()) {
    throw new AppError(400, "Cannot download a directory");
  }
  const stream = createReadStream(abs);
  return { stream, size: st.size, filename: basename(abs) };
}

/** Stream an HTTP request body into a file under relDir. Enforces max bytes. */
export async function saveUploadStream(
  relDir: string,
  filename: string,
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number = MAX_UPLOAD_BYTES
): Promise<FileEntry> {
  if (!body) throw new AppError(400, "Empty body");
  const safeName = sanitizeFilename(filename);
  const absDir = resolveSafePath(relDir);
  const absFile = resolveSafePath(join(relDir, safeName));
  // Ensure absFile is still within root (redundant but explicit)
  try {
    const st = await stat(absDir);
    if (!st.isDirectory()) throw new AppError(400, "Not a directory");
  } catch (err) {
    if (err instanceof AppError) throw err;
    wrapFsError(err);
  }

  let received = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      received += chunk.length;
      if (received > maxBytes) {
        cb(new AppError(413, `Upload exceeds max size (${maxBytes} bytes)`));
        return;
      }
      cb(null, chunk);
    },
  });

  const source = Readable.fromWeb(body as unknown as import("stream/web").ReadableStream<Uint8Array>);
  const dest = createWriteStream(absFile, { flags: "wx" });

  try {
    await pipeline(source, limiter, dest);
  } catch (err) {
    // Best-effort cleanup of partial file
    try {
      await unlink(absFile);
    } catch {
      // ignore
    }
    if (err instanceof AppError) throw err;
    wrapFsError(err);
  }

  try {
    return await entryFromAbs(absFile);
  } catch (err) {
    wrapFsError(err);
  }
}

function sanitizeFilename(name: string): string {
  if (!name || name === "." || name === "..") {
    throw new AppError(400, "Invalid filename");
  }
  if (
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("\0") ||
    name !== basename(name)
  ) {
    throw new AppError(400, "Invalid filename");
  }
  return name;
}
