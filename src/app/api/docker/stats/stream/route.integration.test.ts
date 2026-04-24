import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";

vi.mock("@/lib/docker/client", () => ({
  getDocker: () => globalThis.__testDocker!,
}));

import { GET } from "./route";
import { useTestDb } from "@/test/db";
import { loginAs } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";
import { installFakeDocker, getFakeDocker } from "@/test/docker";
import { callStreamHandler, readSseFrames } from "@/test/sse";
import type { DockerOverview } from "@/lib/docker/stats";

describe("GET /api/docker/stats/stream", () => {
  const ctx = useTestDb();

  beforeEach(() => {
    installFakeDocker();
  });

  it("when unauthenticated — returns 401", async () => {
    const res = await callHandler(GET, buildRequest());

    expect(res.status).toBe(401);
  });

  it("when authenticated and a container is running — first frame contains that container in the overview", async () => {
    await loginAs(ctx.get(), { role: "admin" });
    const fake = getFakeDocker();
    const c = await fake.createContainer({ name: "probe", Image: "alpine" });
    await c.start();

    const { response } = await callStreamHandler(GET, buildRequest());
    const frames = await readSseFrames(response, {
      maxFrames: 1,
      timeoutMs: 500,
    });

    const payload = JSON.parse(frames[0].data) as DockerOverview;
    expect(payload.containers[0]).toMatchObject({
      name: "probe",
      state: "running",
    });
  });

  it("when authenticated — counts include running and stopped containers", async () => {
    await loginAs(ctx.get(), { role: "admin" });
    const fake = getFakeDocker();
    const running = await fake.createContainer({
      name: "up",
      Image: "alpine",
    });
    await running.start();
    await fake.createContainer({ name: "down", Image: "alpine" });

    const { response } = await callStreamHandler(GET, buildRequest());
    const frames = await readSseFrames(response, {
      maxFrames: 1,
      timeoutMs: 500,
    });

    const payload = JSON.parse(frames[0].data) as DockerOverview;
    expect(payload.counts).toEqual({ running: 1, stopped: 1, total: 2 });
  });

  it("when authenticated with no containers — totals are all zero", async () => {
    await loginAs(ctx.get(), { role: "admin" });

    const { response } = await callStreamHandler(GET, buildRequest());
    const frames = await readSseFrames(response, {
      maxFrames: 1,
      timeoutMs: 500,
    });

    const payload = JSON.parse(frames[0].data) as DockerOverview;
    expect(payload.totals.cpuPercent).toBe(0);
  });
});
