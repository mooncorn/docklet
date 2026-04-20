import { describe, it, expect } from "vitest";
import { PATCH, DELETE } from "./route";
import { useTestDb } from "@/test/db";
import { loginAs, createTestUser } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";
import { password } from "@/test/faker";
import { POST as loginPost } from "../../auth/login/route";

function params(id: number) {
  return { params: Promise.resolve({ id: String(id) }) };
}

describe("/api/users/[id]", () => {
  const ctx = useTestDb();

  describe("PATCH", () => {
    it("when called as admin, changes the user role", async () => {
      await loginAs(ctx.get(), { role: "admin" });
      const target = await createTestUser(ctx.get(), { role: "user" });

      const res = await callHandler<{ role: string }>(
        PATCH,
        buildRequest({ method: "PATCH", body: { role: "mod" } }),
        params(target.id)
      );

      expect(res.status).toBe(200);
      expect(res.body.role).toBe("mod");
    });

    it("when resetting a password, the user can log in with the new one", async () => {
      await loginAs(ctx.get(), { role: "admin" });
      const target = await createTestUser(ctx.get(), { role: "user" });
      const newPassword = password();

      await callHandler(PATCH, buildRequest({ method: "PATCH", body: { password: newPassword } }), params(target.id));

      globalThis.__testCookieJar.clear();
      const login = await callHandler(
        loginPost,
        buildRequest({ method: "POST", body: { username: target.username, password: newPassword } })
      );
      expect(login.status).toBe(200);
    });

    it("when demoting the last admin, returns 400", async () => {
      const onlyAdmin = await loginAs(ctx.get(), { role: "admin" });

      const res = await callHandler<{ error: string }>(
        PATCH,
        buildRequest({ method: "PATCH", body: { role: "user" } }),
        params(onlyAdmin.id)
      );

      expect(res.status).toBe(400);
    });

    it("when called by a non-admin, returns 403", async () => {
      await loginAs(ctx.get(), { role: "mod" });
      const target = await createTestUser(ctx.get(), { role: "user" });

      const res = await callHandler(
        PATCH,
        buildRequest({ method: "PATCH", body: { role: "admin" } }),
        params(target.id)
      );

      expect(res.status).toBe(403);
    });

    it("when patch body is empty, returns 400", async () => {
      await loginAs(ctx.get(), { role: "admin" });
      const target = await createTestUser(ctx.get(), { role: "user" });

      const res = await callHandler(
        PATCH,
        buildRequest({ method: "PATCH", body: {} }),
        params(target.id)
      );

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE", () => {
    it("when called as admin on another user, removes them", async () => {
      await loginAs(ctx.get(), { role: "admin" });
      const target = await createTestUser(ctx.get(), { role: "user" });

      const res = await callHandler(DELETE, buildRequest({ method: "DELETE" }), params(target.id));

      expect(res.status).toBe(200);
    });

    it("when deleting self, returns 400", async () => {
      const me = await loginAs(ctx.get(), { role: "admin" });
      // Keep another admin so we wouldn't trip the last-admin guard first
      await createTestUser(ctx.get(), { role: "admin" });

      const res = await callHandler<{ error: string }>(
        DELETE,
        buildRequest({ method: "DELETE" }),
        params(me.id)
      );

      expect(res.status).toBe(400);
    });

    it("when called by a non-admin, returns 403", async () => {
      await loginAs(ctx.get(), { role: "user" });
      const target = await createTestUser(ctx.get(), { role: "user" });

      const res = await callHandler(DELETE, buildRequest({ method: "DELETE" }), params(target.id));

      expect(res.status).toBe(403);
    });
  });
});
