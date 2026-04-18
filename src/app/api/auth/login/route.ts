import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { checkRateLimit, getClientIp, RateLimitError } from "@/lib/rate-limit";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    if (!process.env.E2E_DISABLE_RATE_LIMIT) {
      checkRateLimit(`login:${getClientIp(request)}`, 5, 15 * 60 * 1000);
    }
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { username, password } = result.data;

    const db = getDb();
    const user = db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .get();

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const token = await createSession(user);
    await setSessionCookie(token);

    return NextResponse.json({
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
