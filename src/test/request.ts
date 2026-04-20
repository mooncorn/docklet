import { NextRequest } from "next/server";

interface BuildRequestOpts {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
  ip?: string;
}

export function buildRequest(opts: BuildRequestOpts = {}): NextRequest {
  const {
    method = "GET",
    url = "http://localhost:3000/api",
    body,
    headers = {},
    ip,
  } = opts;

  const h = new Headers(headers);
  const init: { method: string; headers: Headers; body?: string } = {
    method,
    headers: h,
  };

  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!h.has("content-type")) h.set("content-type", "application/json");
  }

  if (ip && !h.has("x-forwarded-for")) h.set("x-forwarded-for", ip);

  return new NextRequest(new URL(url), init);
}

export interface RouteResponse<T = unknown> {
  status: number;
  headers: Headers;
  body: T;
}

type RouteHandler = (
  req: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any
) => Promise<Response> | Response;

export async function callHandler<T = unknown>(
  handler: RouteHandler,
  req: NextRequest,
  ctx?: unknown
): Promise<RouteResponse<T>> {
  const res = await handler(req, ctx);
  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return {
    status: res.status,
    headers: res.headers,
    body: body as T,
  };
}
