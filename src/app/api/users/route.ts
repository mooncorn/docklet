import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireRole, handleApiError } from "@/lib/auth/middleware";
import { listUsers, createUser } from "@/lib/users/service";

export const runtime = "nodejs";

const createSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, "Username must be alphanumeric, dash, or underscore"),
  password: z.string().min(8),
  role: z.enum(["admin", "mod", "user"]),
});

export async function GET() {
  try {
    await requireRole("admin");
    const list = await listUsers();
    return NextResponse.json(list);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin");
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const user = await createUser(parsed.data);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
