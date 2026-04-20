import { eq, and, ne, sql } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/errors";

export type Role = "admin" | "mod" | "user";

export interface UserDTO {
  id: number;
  username: string;
  role: Role;
  createdAt: number;
  updatedAt: number;
}

const USERNAME_RE = /^[a-zA-Z0-9_-]+$/;

function toDTO(row: {
  id: number;
  username: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}): UserDTO {
  return {
    id: row.id,
    username: row.username,
    role: row.role as Role,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function listUsers(db: Db = getDb()): Promise<UserDTO[]> {
  const rows = db.select().from(users).all();
  return rows
    .map((r) => toDTO(r))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function createUser(
  input: {
    username: string;
    password: string;
    role: Role;
  },
  db: Db = getDb()
): Promise<UserDTO> {
  if (!USERNAME_RE.test(input.username)) {
    throw new AppError(400, "Invalid username");
  }
  if (input.password.length < 8) {
    throw new AppError(400, "Password must be at least 8 characters");
  }
  const existing = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, input.username))
    .get();
  if (existing) {
    throw new AppError(409, "Username already exists");
  }
  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  try {
    const row = db
      .insert(users)
      .values({
        username: input.username,
        passwordHash,
        role: input.role,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    return toDTO(row);
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "SQLITE_CONSTRAINT_UNIQUE"
    ) {
      throw new AppError(409, "Username already exists");
    }
    throw err;
  }
}

export async function updateUser(
  id: number,
  patch: { role?: Role; password?: string },
  db: Db = getDb()
): Promise<UserDTO> {
  if (patch.role === undefined && patch.password === undefined) {
    throw new AppError(400, "No fields to update");
  }
  if (patch.password !== undefined && patch.password.length < 8) {
    throw new AppError(400, "Password must be at least 8 characters");
  }
  const target = db.select().from(users).where(eq(users.id, id)).get();
  if (!target) {
    throw new AppError(404, "User not found");
  }

  if (patch.role && patch.role !== "admin" && target.role === "admin") {
    const otherAdmins = db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.role, "admin"), ne(users.id, id)))
      .get();
    if (!otherAdmins || otherAdmins.count === 0) {
      throw new AppError(400, "Cannot demote the last admin");
    }
  }

  const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (patch.role !== undefined) updates.role = patch.role;
  if (patch.password !== undefined) {
    updates.passwordHash = await hashPassword(patch.password);
  }

  const row = db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning()
    .get();
  return toDTO(row);
}

export async function deleteUser(
  id: number,
  actingUserId: number,
  db: Db = getDb()
): Promise<void> {
  if (id === actingUserId) {
    throw new AppError(400, "Cannot delete your own account");
  }
  const target = db.select().from(users).where(eq(users.id, id)).get();
  if (!target) {
    throw new AppError(404, "User not found");
  }
  if (target.role === "admin") {
    const otherAdmins = db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.role, "admin"), ne(users.id, id)))
      .get();
    if (!otherAdmins || otherAdmins.count === 0) {
      throw new AppError(400, "Cannot delete the last admin");
    }
  }
  db.delete(users).where(eq(users.id, id)).run();
}
