import { test } from "@playwright/test";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";
import Docker from "dockerode";

const TEST_DATA_DIR = "./tmp/docklet-e2e-data";

async function removeE2eContainers(): Promise<void> {
  let docker: Docker;
  try {
    docker = new Docker();
    await docker.ping();
  } catch {
    console.warn("[global-setup] Docker unavailable; skipping e2e container cleanup");
    return;
  }
  const containers = await docker.listContainers({ all: true });
  await Promise.all(
    containers
      .filter((c) => c.Names.some((n) => n.replace(/^\//, "").startsWith("e2e-")))
      .map((c) => docker.getContainer(c.Id).remove({ force: true }))
  );
}

test("reset database", async () => {
  await removeE2eContainers();
  const dbPath = join(TEST_DATA_DIR, "db", "docklet.db");

  if (existsSync(dbPath)) {
    // Truncate all tables without deleting the file. The dev server keeps an
    // open SQLite connection across test runs (reuseExistingServer). Deleting
    // the file leaves the server on a stale deleted inode; clearing rows
    // in-place lets every live connection see the empty state immediately.
    const db = new Database(dbPath);
    db.pragma("foreign_keys = OFF");
    db.exec(`
      DELETE FROM sessions;
      DELETE FROM container_templates;
      DELETE FROM users;
      DELETE FROM settings;
    `);
    db.pragma("foreign_keys = ON");
    db.close();
  } else {
    // First run: create directory structure. The server will create and
    // migrate the DB file on its first request.
    await mkdir(join(TEST_DATA_DIR, "db"), { recursive: true });
    await mkdir(join(TEST_DATA_DIR, "certs"), { recursive: true });
    await mkdir(join(TEST_DATA_DIR, "backups"), { recursive: true });
  }
});
