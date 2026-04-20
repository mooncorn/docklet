import { getDb, type Db } from "../db";
import { settings, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

export function getSetting(key: string, db: Db = getDb()): string | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

export function setSetting(key: string, value: string, db: Db = getDb()): void {
  const now = new Date();
  db.insert(settings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: now },
    })
    .run();
}

export function getAllSettings(db: Db = getDb()): Record<string, string> {
  const rows = db.select().from(settings).all();
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export function isSetupCompleted(db: Db = getDb()): boolean {
  const admin = db.select().from(users).where(eq(users.role, "admin")).get();
  return admin !== undefined;
}

export function ensureJwtSecret(db: Db = getDb()): void {
  const existing = getSetting("jwt_secret", db);
  if (!existing) {
    const secret = randomBytes(64).toString("hex");
    setSetting("jwt_secret", secret, db);
  }
}

export function getDockerSocket(): string {
  return process.env.DOCKER_SOCKET || "/var/run/docker.sock";
}
