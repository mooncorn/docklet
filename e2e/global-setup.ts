import { test } from "@playwright/test";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";

const TEST_DATA_DIR = "./tmp/docklet-e2e-data";

test("reset database", async () => {
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
    // First run — create directory structure. The server will create and
    // migrate the DB file on its first request.
    await mkdir(join(TEST_DATA_DIR, "db"), { recursive: true });
    await mkdir(join(TEST_DATA_DIR, "certs"), { recursive: true });
    await mkdir(join(TEST_DATA_DIR, "backups"), { recursive: true });
  }
});
