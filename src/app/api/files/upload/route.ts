import { NextRequest, NextResponse } from "next/server";
import { requireRole, handleApiError } from "@/lib/auth/middleware";
import { AppError } from "@/lib/errors";
import { saveUploadStream, MAX_UPLOAD_BYTES } from "@/lib/files/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "mod");
    const relDir = request.nextUrl.searchParams.get("path") ?? "";
    const filename = request.headers.get("x-filename");
    if (!filename) {
      throw new AppError(400, "Missing X-Filename header");
    }

    // Fast reject oversize via Content-Length if present
    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_UPLOAD_BYTES) {
      throw new AppError(413, `Upload exceeds max size (${MAX_UPLOAD_BYTES} bytes)`);
    }

    const entry = await saveUploadStream(relDir, filename, request.body);
    return NextResponse.json({ entry });
  } catch (error) {
    return handleApiError(error);
  }
}
