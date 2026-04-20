import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/docker/client", () => ({
  getDocker: () => globalThis.__testDocker!,
}));

import { GET } from "./route";
import { useTestDb } from "@/test/db";
import { loginAs } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";
import { installFakeDocker, getFakeDocker } from "@/test/docker";

describe("GET /api/images", () => {
  const ctx = useTestDb();

  beforeEach(() => {
    installFakeDocker();
  });

  it("when logged in, returns the image list", async () => {
    await loginAs(ctx.get(), { role: "user" });
    getFakeDocker().addImage("nginx:latest");
    getFakeDocker().addImage("redis:7");

    const res = await callHandler<Array<{ repoTags: string[] }>>(
      GET,
      buildRequest()
    );

    expect(res.status).toBe(200);
    const tags = res.body.flatMap((i) => i.repoTags).sort();
    expect(tags).toEqual(["nginx:latest", "redis:7"]);
  });

  it("when not logged in, returns 401", async () => {
    const res = await callHandler(
      GET,
      buildRequest()
    );
    expect(res.status).toBe(401);
  });
});
