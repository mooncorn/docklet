import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError, handleApiError } from "@/lib/auth/middleware";
import { inspectContainer, removeContainer, isSelfContainer } from "@/lib/docker/containers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    if (session.role !== "admin" && isSelfContainer(id)) {
      throw new AuthError("Forbidden", 403);
    }
    const container = await inspectContainer(id);
    return NextResponse.json(container);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    if (session.role !== "admin" && isSelfContainer(id)) {
      throw new AuthError("Forbidden", 403);
    }
    const force = request.nextUrl.searchParams.get("force") === "true";
    await removeContainer(id, force);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
