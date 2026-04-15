import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  checkRateLimit,
  getClientIp,
  RateLimitError,
  __resetRateLimits,
} from "./rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    __resetRateLimits();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to max", () => {
    for (let i = 0; i < 5; i++) {
      expect(() => checkRateLimit("k", 5, 60_000)).not.toThrow();
    }
  });

  it("blocks the (max+1)th request", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("k", 5, 60_000);
    expect(() => checkRateLimit("k", 5, 60_000)).toThrow(RateLimitError);
  });

  it("unblocks after the window advances", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("k", 5, 60_000);
    vi.advanceTimersByTime(60_001);
    expect(() => checkRateLimit("k", 5, 60_000)).not.toThrow();
  });

  it("tracks keys independently", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("a", 5, 60_000);
    expect(() => checkRateLimit("b", 5, 60_000)).not.toThrow();
    expect(() => checkRateLimit("a", 5, 60_000)).toThrow(RateLimitError);
  });
});

describe("getClientIp", () => {
  function makeReq(headers: Record<string, string>): Request {
    return new Request("http://x/", { headers });
  }

  it("returns first entry of x-forwarded-for", () => {
    expect(getClientIp(makeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIp(makeReq({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("returns 'unknown' when no header is present", () => {
    expect(getClientIp(makeReq({}))).toBe("unknown");
  });
});
