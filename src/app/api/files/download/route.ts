import { NextRequest } from "next/server";
import { Readable } from "stream";
import { requireAuth, handleApiError } from "@/lib/auth/middleware";
import { createDownloadStream } from "@/lib/files/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const relPath = request.nextUrl.searchParams.get("path") ?? "";
    const { stream, size, filename } = await createDownloadStream(relPath);

    const webStream = Readable.toWeb(stream as Readable) as unknown as ReadableStream<Uint8Array>;

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(size),
        "Content-Disposition": `attachment; filename="${encodeFilename(filename)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function encodeFilename(name: string): string {
  // Strip quotes and control chars that would break the header
  return name.replace(/["\r\n]/g, "_");
}
