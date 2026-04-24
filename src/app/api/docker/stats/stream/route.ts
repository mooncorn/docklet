import { requireAuth, handleApiError } from "@/lib/auth/middleware";
import { getOverview } from "@/lib/docker/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICK_MS = 1500;
const HEARTBEAT_MS = 30_000;

export async function GET() {
  try {
    await requireAuth();

    let aborted = false;
    let tickTimer: ReturnType<typeof setInterval> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const push = async () => {
          if (aborted) return;
          try {
            const overview = await getOverview();
            if (aborted) return;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(overview)}\n\n`)
            );
          } catch {
            // Skip failed ticks; next tick will retry
          }
        };

        push();

        tickTimer = setInterval(push, TICK_MS);
        heartbeatTimer = setInterval(() => {
          if (aborted) return;
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            // Controller closed
          }
        }, HEARTBEAT_MS);
      },
      cancel() {
        aborted = true;
        if (tickTimer) clearInterval(tickTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
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
