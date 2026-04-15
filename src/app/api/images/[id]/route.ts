import { NextRequest, NextResponse } from "next/server";
import { requireRole, handleApiError } from "@/lib/auth/middleware";
import { removeImage } from "@/lib/docker/images";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin");
    const { id } = await params;
    const force = request.nextUrl.searchParams.get("force") === "true";
    await removeImage(id, force);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
