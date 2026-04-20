import { describe, it, expect } from "vitest";
import { GET } from "./route";
import { useTestDb } from "@/test/db";
import { loginAs, clearSession } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";

describe("GET /api/auth/me", () => {
  const ctx = useTestDb();

  describe("when the session cookie is valid", () => {
    it("returns the current user", async () => {
      const me = await loginAs(ctx.get(), { role: "mod" });

      const res = await callHandler<{ user: { id: number; username: string; role: string } }>(
        GET,
        buildRequest()
      );

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: me.id, username: me.username, role: "mod" });
    });
  });

  describe("when no session cookie is present", () => {
    it("returns 401", async () => {
      clearSession();

      const res = await callHandler<{ error: string }>(
        GET,
        buildRequest()
      );

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });
  });
});
