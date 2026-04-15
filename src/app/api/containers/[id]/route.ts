import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/auth/middleware";
import { inspectContainer, removeContainer } from "@/lib/docker/containers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
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
    await requireAuth();
    const { id } = await params;
    const force = request.nextUrl.searchParams.get("force") === "true";
    await removeContainer(id, force);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
