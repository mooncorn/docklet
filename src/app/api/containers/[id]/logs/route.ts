import { NextRequest } from "next/server";
import { requireAuth, handleApiError } from "@/lib/auth/middleware";
import { getContainerLogs } from "@/lib/docker/containers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const tail = parseInt(
      request.nextUrl.searchParams.get("tail") ?? "200",
      10
    );

    const dockerStream = await getContainerLogs(id, { tail });
    let aborted = false;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        // Docker log stream may have 8-byte header per frame (when not TTY)
        // We strip it and send clean text lines
        dockerStream.on("data", (chunk: Buffer) => {
          if (aborted) return;
          const text = chunk.toString("utf-8");
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.trim()) {
              // Strip Docker stream header (8 bytes) if present
              const clean =
                line.length > 8 && line.charCodeAt(0) <= 2
                  ? line.slice(8)
                  : line;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(clean)}\n\n`)
              );
            }
          }
        });

        dockerStream.on("end", () => {
          if (!aborted) controller.close();
        });

        dockerStream.on("error", () => {
          if (!aborted) controller.close();
        });
      },
      cancel() {
        aborted = true;
        if ("destroy" in dockerStream) {
          (dockerStream as NodeJS.ReadableStream & { destroy: () => void }).destroy();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
