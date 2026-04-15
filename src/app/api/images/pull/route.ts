import { NextRequest } from "next/server";
import { requireRole, handleApiError } from "@/lib/auth/middleware";
import { pullImage } from "@/lib/docker/images";

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin");
    const body = await request.json();
    const image = body.image;
    if (!image || typeof image !== "string") {
      return new Response(JSON.stringify({ error: "image is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const dockerStream = await pullImage(image);

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        dockerStream.on("data", (chunk: Buffer) => {
          const lines = chunk.toString("utf-8").trim().split("\n");
          for (const line of lines) {
            if (line) {
              controller.enqueue(encoder.encode(`data: ${line}\n\n`));
            }
          }
        });

        dockerStream.on("end", () => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ complete: true })}\n\n`)
          );
          controller.close();
        });

        dockerStream.on("error", (err: Error) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: err.message })}\n\n`
            )
          );
          controller.close();
        });
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
