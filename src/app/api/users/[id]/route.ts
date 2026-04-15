import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireRole, handleApiError } from "@/lib/auth/middleware";
import { updateUser, deleteUser } from "@/lib/users/service";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    role: z.enum(["admin", "mod", "user"]).optional(),
    password: z.string().min(8).optional(),
  })
  .refine(
    (data) => data.role !== undefined || data.password !== undefined,
    { message: "At least one field (role or password) is required" }
  );

function parseId(id: string): number {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) {
    throw new AppError(400, "Invalid user id");
  }
  return n;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin");
    const { id } = await params;
    const userId = parseId(id);
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const user = await updateUser(userId, parsed.data);
    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("admin");
    const { id } = await params;
    const userId = parseId(id);
    await deleteUser(userId, session.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
