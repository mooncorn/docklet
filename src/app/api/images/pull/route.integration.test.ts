import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/docker/client", () => ({
  getDocker: () => globalThis.__testDocker!,
}));

import { POST } from "./route";
import { useTestDb } from "@/test/db";
import { loginAs } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";
import { installFakeDocker, getFakeDocker } from "@/test/docker";

describe("POST /api/images/pull", () => {
  const ctx = useTestDb();

  beforeEach(() => {
    installFakeDocker();
  });

  it("when called as non-admin, returns 403 and does not pull", async () => {
    await loginAs(ctx.get(), { role: "user" });

    const res = await callHandler(
      POST,
      buildRequest({ method: "POST", body: { image: "nginx:latest" } })
    );

    expect(res.status).toBe(403);
    expect(await getFakeDocker().listImages()).toHaveLength(0);
  });

  it("when called as admin, triggers a pull and adds the image to the store", async () => {
    await loginAs(ctx.get(), { role: "admin" });

    const res = await callHandler(
      POST,
      buildRequest({ method: "POST", body: { image: "busybox:latest" } })
    );

    expect(res.status).toBe(200);
    const images = await getFakeDocker().listImages();
    expect(images.flatMap((i) => i.RepoTags)).toContain("busybox:latest");
  });

  it("when body is missing image, returns 400", async () => {
    await loginAs(ctx.get(), { role: "admin" });

    const res = await callHandler(
      POST,
      buildRequest({ method: "POST", body: {} })
    );

    expect(res.status).toBe(400);
  });
});
