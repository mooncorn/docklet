import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/docker/client", () => ({
  getDocker: () => globalThis.__testDocker!,
}));

vi.mock("@/lib/docker/containers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/docker/containers")>();
  return { ...actual, isSelfContainer: vi.fn().mockReturnValue(true) };
});

import { POST as startPost } from "./start/route";
import { POST as stopPost } from "./stop/route";
import { POST as restartPost } from "./restart/route";
import { useTestDb } from "@/test/db";
import { loginAs } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";
import { installFakeDocker } from "@/test/docker";

describe("/api/containers/[id] isSelfContainer guard", () => {
  const ctx = useTestDb();

  beforeEach(() => {
    installFakeDocker();
  });

  it("POST /start — when a mod user targets the self container, returns 403", async () => {
    await loginAs(ctx.get(), { role: "mod" });

    const res = await callHandler(
      startPost,
      buildRequest({ method: "POST" }),
      { params: Promise.resolve({ id: "fake1" }) }
    );

    expect(res.status).toBe(403);
  });

  it("POST /stop — when a mod user targets the self container, returns 403", async () => {
    await loginAs(ctx.get(), { role: "mod" });

    const res = await callHandler(
      stopPost,
      buildRequest({ method: "POST" }),
      { params: Promise.resolve({ id: "fake1" }) }
    );

    expect(res.status).toBe(403);
  });

  it("POST /restart — when a mod user targets the self container, returns 403", async () => {
    await loginAs(ctx.get(), { role: "mod" });

    const res = await callHandler(
      restartPost,
      buildRequest({ method: "POST" }),
      { params: Promise.resolve({ id: "fake1" }) }
    );

    expect(res.status).toBe(403);
  });
});
