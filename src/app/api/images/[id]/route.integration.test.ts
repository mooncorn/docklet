import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/docker/client", () => ({
  getDocker: () => globalThis.__testDocker!,
}));

import { DELETE } from "./route";
import { useTestDb } from "@/test/db";
import { loginAs } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";
import { installFakeDocker, getFakeDocker } from "@/test/docker";

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("DELETE /api/images/[id]", () => {
  const ctx = useTestDb();

  beforeEach(() => {
    installFakeDocker();
  });

  it("when called as admin, removes the image", async () => {
    await loginAs(ctx.get(), { role: "admin" });
    getFakeDocker().addImage("nginx:latest");

    const res = await callHandler(
      DELETE,
      buildRequest({ method: "DELETE" }),
      params("nginx:latest")
    );

    expect(res.status).toBe(200);
    expect(await getFakeDocker().listImages()).toHaveLength(0);
  });

  it("when called as a non-admin, returns 403", async () => {
    await loginAs(ctx.get(), { role: "mod" });
    getFakeDocker().addImage("nginx:latest");

    const res = await callHandler(
      DELETE,
      buildRequest({ method: "DELETE" }),
      params("nginx:latest")
    );

    expect(res.status).toBe(403);
    expect(await getFakeDocker().listImages()).toHaveLength(1);
  });
});
