import { AppError } from "@/lib/errors";

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(429, message);
    this.name = "RateLimitError";
  }
}

// In-memory sliding window; single-process only. Per-key array of timestamps.
const buckets = new Map<string, number[]>();

export function checkRateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = buckets.get(key) ?? [];
  // Prune expired
  let i = 0;
  while (i < timestamps.length && timestamps[i] <= cutoff) i++;
  const pruned = i > 0 ? timestamps.slice(i) : timestamps;
  if (pruned.length >= max) {
    buckets.set(key, pruned);
    throw new RateLimitError();
  }
  pruned.push(now);
  buckets.set(key, pruned);
}

export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

// Exported for tests
export function __resetRateLimits(): void {
  buckets.clear();
}
