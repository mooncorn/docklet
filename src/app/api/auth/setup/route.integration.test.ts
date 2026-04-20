import { describe, it, expect } from "vitest";
import { POST } from "./route";
import { useTestDb } from "@/test/db";
import { createTestUser } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";
import { username, password } from "@/test/faker";
import { getAllSettings } from "@/lib/config";

describe("POST /api/auth/setup", () => {
  const ctx = useTestDb();

  describe("when no admin exists yet", () => {
    it("creates the admin user and sets a session cookie", async () => {
      const name = username();
      const pw = password();

      const res = await callHandler<{ user: { id: number; username: string; role: string } }>(
        POST,
        buildRequest({ method: "POST", body: { username: name, password: pw, confirmPassword: pw } })
      );

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ username: name, role: "admin" });
      expect(globalThis.__testCookieJar.get("docklet_session")).toBeDefined();
    });

    it("seeds the app_name setting", async () => {
      const pw = password();

      await callHandler(POST, buildRequest({
        method: "POST",
        body: { username: username(), password: pw, confirmPassword: pw },
      }));

      expect(getAllSettings(ctx.get()).app_name).toBe("Docklet");
    });
  });

  describe("when passwords do not match", () => {
    it("returns 400", async () => {
      const res = await callHandler<{ error: string }>(
        POST,
        buildRequest({
          method: "POST",
          body: { username: username(), password: password(), confirmPassword: password() },
        })
      );

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/password/i);
    });
  });

  describe("when an admin already exists", () => {
    it("returns 400 and refuses to create another admin", async () => {
      await createTestUser(ctx.get(), { role: "admin" });
      const pw = password();

      const res = await callHandler<{ error: string }>(
        POST,
        buildRequest({
          method: "POST",
          body: { username: username(), password: pw, confirmPassword: pw },
        })
      );

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Setup already completed");
    });
  });
});
