import { existsSync, mkdirSync } from "fs";
import { resolve, sep } from "path";
import { getDataDir } from "@/lib/db";
import { AppError } from "@/lib/errors";

export function getFilesRoot(): string {
  const root = resolve(getDataDir(), "volumes");
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  return root;
}

/** Resolve a user-supplied relative path against the files root, enforcing containment.
 *  Throws AppError(400) if the result escapes the root. */
export function resolveSafePath(userPath: string): string {
  const root = getFilesRoot();
  const cleaned = (userPath ?? "").replace(/^\/+/, "");
  const abs = resolve(root, cleaned);
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new AppError(400, "Invalid path");
  }
  return abs;
}

/** Convert an absolute path under the files root back to a forward-slash relative path. */
export function toRelative(absPath: string): string {
  const root = getFilesRoot();
  if (absPath === root) return "";
  if (!absPath.startsWith(root + sep)) {
    throw new AppError(500, "Path not under root");
  }
  return absPath.slice(root.length + 1).split(sep).join("/");
}
