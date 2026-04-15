import { requireAuth, handleApiError } from "@/lib/auth/middleware";
import { getDocker } from "@/lib/docker/client";

export async function GET() {
  try {
    await requireAuth();
    const docker = getDocker();

    const dockerStream = await docker.getEvents({
      filters: {
        type: ["container"],
        event: ["start", "stop", "die", "destroy", "create", "pause", "unpause"],
      },
    });

    let aborted = false;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        // Send heartbeat every 30s to keep connection alive
        const heartbeat = setInterval(() => {
          if (aborted) return;
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            clearInterval(heartbeat);
          }
        }, 30000);

        dockerStream.on("data", (chunk: Buffer) => {
          if (aborted) return;
          try {
            const event = JSON.parse(chunk.toString("utf-8"));
            const payload = {
              action: event.Action,
              id: event.id,
              name: event.Actor?.Attributes?.name ?? "",
              time: event.time,
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
            );
          } catch {
            // Skip malformed events
          }
        });

        dockerStream.on("end", () => {
          clearInterval(heartbeat);
          if (!aborted) controller.close();
        });

        dockerStream.on("error", () => {
          clearInterval(heartbeat);
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
