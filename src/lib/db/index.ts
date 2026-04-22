import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import * as schema from "./schema";

const DATA_DIR = process.env.DOCKLET_DATA_DIR || "/docklet-data";

const MIGRATIONS_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS container_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    config TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

export function getDataDir(): string {
  return DATA_DIR;
}

export function getHostDataDir(): string {
  return process.env.HOST_DATA_DIR || DATA_DIR;
}

export function initDataDirs(): void {
  const dirs = ["db", "certs", "backups"];
  for (const dir of dirs) {
    const path = join(DATA_DIR, dir);
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }
}

export function createDbInstance(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");
  if (dbPath !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
  }
  sqlite.exec(MIGRATIONS_SQL);
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createDbInstance>;

let _db: Db | null = null;

export function getDb(): Db {
  if (!_db) {
    initDataDirs();
    _db = createDbInstance(join(DATA_DIR, "db", "docklet.db"));
  }
  return _db;
}

export function setDb(db: Db): void {
  _db = db;
}

export function resetDb(): void {
  _db = null;
}

export function runMigrations(): void {
  getDb(); // migrations run automatically inside createDbInstance()
}

export { schema };
