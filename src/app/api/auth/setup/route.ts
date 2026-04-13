import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { setSetting, isSetupCompleted, ensureJwtSecret } from "@/lib/config";
import { cookies } from "next/headers";

const setupSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, hyphens, and underscores"
    ),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: "Passwords do not match" }
);

export async function POST(request: NextRequest) {
  // Prevent re-running setup
  if (isSetupCompleted()) {
    return NextResponse.json(
      { error: "Setup already completed" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const result = setupSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { username, password } = result.data;

    // Ensure JWT secret exists
    ensureJwtSecret();

    // Create admin user
    const db = getDb();
    const passwordHash = await hashPassword(password);
    const now = new Date();

    const inserted = db
      .insert(users)
      .values({
        username,
        passwordHash,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    // Mark setup as completed
    setSetting("setup_completed", "true");
    setSetting("app_name", "Docklet");

    // Create session
    const token = await createSession(inserted);
    await setSessionCookie(token);

    // Set setup cookie for middleware
    const cookieStore = await cookies();
    cookieStore.set("docklet_setup", "true", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60, // 1 year
      path: "/",
    });

    return NextResponse.json({ success: true, user: { id: inserted.id, username: inserted.username, role: inserted.role } });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Failed to complete setup" },
      { status: 500 }
    );
  }
}
