import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/docker/client", () => ({
  getDocker: () => globalThis.__testDocker!,
}));

vi.mock("@/lib/docker/containers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/docker/containers")>();
  return { ...actual, isSelfContainer: vi.fn().mockReturnValue(false) };
});

import { GET } from "./route";
import { useTestDb } from "@/test/db";
import { loginAs } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";
import { installFakeDocker, getFakeDocker } from "@/test/docker";
import { callStreamHandler, readSseFrames } from "@/test/sse";
import { isSelfContainer } from "@/lib/docker/containers";
import type { ContainerStats } from "@/lib/docker/stats";

describe("GET /api/containers/[id]/stats", () => {
  const ctx = useTestDb();

  beforeEach(() => {
    installFakeDocker();
    vi.mocked(isSelfContainer).mockReturnValue(false);
  });

  it("when unauthenticated — returns 401", async () => {
    const res = await callHandler(GET, buildRequest(), {
      params: Promise.resolve({ id: "fake1" }),
    });

    expect(res.status).toBe(401);
  });

  it("when a non-admin targets the self container — returns 403", async () => {
    await loginAs(ctx.get(), { role: "mod" });
    vi.mocked(isSelfContainer).mockReturnValue(true);

    const res = await callHandler(GET, buildRequest(), {
      params: Promise.resolve({ id: "fake1" }),
    });

    expect(res.status).toBe(403);
  });

  it("when authenticated and the container has a stats frame — first SSE frame is a normalized ContainerStats payload", async () => {
    await loginAs(ctx.get(), { role: "admin" });
    const fake = getFakeDocker();
    const c = await fake.createContainer({ name: "probe", Image: "alpine" });
    await c.start();

    const { response } = await callStreamHandler(GET, buildRequest(), {
      params: Promise.resolve({ id: "fake1" }),
    });
    const frames = await readSseFrames(response, {
      maxFrames: 1,
      timeoutMs: 500,
    });

    const payload = JSON.parse(frames[0].data) as ContainerStats;
    expect(payload).toMatchObject({
      id: "fake1",
      state: "running",
      memory: { limit: 1_000_000_000 },
    });
  });

  it("when the client cancels the stream — the upstream docker stream is destroyed", async () => {
    await loginAs(ctx.get(), { role: "admin" });
    const fake = getFakeDocker();
    const c = await fake.createContainer({ name: "probe", Image: "alpine" });
    await c.start();

    const { response } = await callStreamHandler(GET, buildRequest(), {
      params: Promise.resolve({ id: "fake1" }),
    });
    await readSseFrames(response, { maxFrames: 1, timeoutMs: 500 });

    expect(fake.getLastStatsStream()?.destroyed).toBe(true);
  });
});
