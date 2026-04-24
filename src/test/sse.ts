import { NextRequest } from "next/server";

export interface SseFrame {
  data: string;
}

export async function readSseFrames(
  res: Response,
  opts: { maxFrames: number; timeoutMs?: number }
): Promise<SseFrame[]> {
  const timeoutMs = opts.timeoutMs ?? 1000;
  if (!res.body) throw new Error("SSE response has no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  const frames: SseFrame[] = [];
  let buffer = "";
  const deadline = performance.now() + timeoutMs;

  try {
    while (frames.length < opts.maxFrames) {
      const remaining = deadline - performance.now();
      if (remaining <= 0) break;

      const readPromise = reader.read();
      const timeoutPromise = new Promise<{ done: true; value: undefined }>(
        (resolve) =>
          setTimeout(
            () => resolve({ done: true, value: undefined }),
            remaining
          )
      );
      const result = await Promise.race([readPromise, timeoutPromise]);
      if (result.done) break;

      buffer += decoder.decode(result.value as Uint8Array, { stream: true });

      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawFrame = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        for (const line of rawFrame.split("\n")) {
          if (line.startsWith("data:")) {
            frames.push({ data: line.slice(5).trimStart() });
          }
        }
        if (frames.length >= opts.maxFrames) break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return frames;
}

export interface RouteStreamResponse {
  status: number;
  headers: Headers;
  response: Response;
}

type StreamRouteHandler = (
  req: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any
) => Promise<Response> | Response;

/** Invoke an SSE route handler and return the raw Response so the caller
 *  can stream frames with `readSseFrames`. Unlike `callHandler`, this does
 *  not await `.text()` (which would hang on an open stream). */
export async function callStreamHandler(
  handler: StreamRouteHandler,
  req: NextRequest,
  ctx?: unknown
): Promise<RouteStreamResponse> {
  const res = await handler(req, ctx);
  return { status: res.status, headers: res.headers, response: res };
}
