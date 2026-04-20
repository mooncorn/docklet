import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/docker/client", () => ({
  getDocker: () => globalThis.__testDocker!,
}));

import { POST } from "./route";
import { useTestDb } from "@/test/db";
import { loginAs } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";
import { installFakeDocker, getFakeDocker } from "@/test/docker";

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/containers/[id]/exec", () => {
  const ctx = useTestDb();

  beforeEach(() => {
    installFakeDocker();
  });

  it("when called by a non-admin, returns 403", async () => {
    await loginAs(ctx.get(), { role: "mod" });
    const c = await getFakeDocker().createContainer({ name: "x", Image: "alpine" });

    const res = await callHandler(
      POST,
      buildRequest({ method: "POST", body: { cmd: ["echo", "hi"] } }),
      params(c.id)
    );

    expect(res.status).toBe(403);
  });

  it("when called by admin with a valid command, returns the exec result", async () => {
    await loginAs(ctx.get(), { role: "admin" });
    const c = await getFakeDocker().createContainer({ name: "x", Image: "alpine" });

    const res = await callHandler<{ exitCode: number }>(
      POST,
      buildRequest({ method: "POST", body: { cmd: ["echo", "hi"] } }),
      params(c.id)
    );

    expect(res.status).toBe(200);
    expect(res.body.exitCode).toBe(0);
  });
});
