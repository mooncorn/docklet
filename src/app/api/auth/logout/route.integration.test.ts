import { describe, it, expect } from "vitest";
import { POST } from "./route";
import { useTestDb } from "@/test/db";
import { loginAs } from "@/test/auth";
import { callHandler, buildRequest } from "@/test/request";

describe("POST /api/auth/logout", () => {
  const ctx = useTestDb();

  describe("when the user is logged in", () => {
    it("clears the session cookie", async () => {
      await loginAs(ctx.get());
      expect(globalThis.__testCookieJar.has("docklet_session")).toBe(true);

      const res = await callHandler(
        POST,
        buildRequest({ method: "POST" })
      );

      expect(res.status).toBe(200);
      expect(globalThis.__testCookieJar.has("docklet_session")).toBe(false);
    });
  });
});
