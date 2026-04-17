import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError, handleApiError } from "@/lib/auth/middleware";
import { stopContainer, isSelfContainer } from "@/lib/docker/containers";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    if (session.role !== "admin" && isSelfContainer(id)) {
      throw new AuthError("Forbidden", 403);
    }
    await stopContainer(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
