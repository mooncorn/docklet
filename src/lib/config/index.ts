import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  const now = new Date();
  db.insert(settings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: now },
    })
    .run();
}

export function getAllSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.select().from(settings).all();
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export function isSetupCompleted(): boolean {
  return getSetting("setup_completed") === "true";
}

export function ensureJwtSecret(): void {
  const existing = getSetting("jwt_secret");
  if (!existing) {
    const secret = randomBytes(64).toString("hex");
    setSetting("jwt_secret", secret);
  }
}

export function getDockerSocket(): string {
  return process.env.DOCKER_SOCKET || "/var/run/docker.sock";
}
