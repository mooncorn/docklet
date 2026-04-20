import { describe, it, expect } from "vitest";
import { GET, PUT } from "./route";
import { useTestDb } from "@/test/db";
import { loginAs } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";
import { setSetting, getAllSettings } from "@/lib/config";

describe("/api/settings", () => {
  const ctx = useTestDb();

  describe("GET", () => {
    it("when called as admin, returns all settings without jwt_secret", async () => {
      await loginAs(ctx.get(), { role: "admin" });
      setSetting("app_name", "Docklet Test", ctx.get());

      const res = await callHandler<Record<string, string>>(
        GET,
        buildRequest()
      );

      expect(res.status).toBe(200);
      expect(res.body.app_name).toBe("Docklet Test");
      expect(res.body).not.toHaveProperty("jwt_secret");
    });

    it("when called as non-admin, returns 403", async () => {
      await loginAs(ctx.get(), { role: "user" });

      const res = await callHandler(
        GET,
        buildRequest()
      );

      expect(res.status).toBe(403);
    });

    it("when not logged in, returns 401", async () => {
      const res = await callHandler(
        GET,
        buildRequest()
      );

      expect(res.status).toBe(401);
    });
  });

  describe("PUT", () => {
    it("when updating app_name as admin, persists the new value", async () => {
      await loginAs(ctx.get(), { role: "admin" });

      const res = await callHandler(
        PUT,
        buildRequest({ method: "PUT", body: { app_name: "Homelab Hub" } })
      );

      expect(res.status).toBe(200);
      expect(getAllSettings(ctx.get()).app_name).toBe("Homelab Hub");
    });

    it("when attempting to write jwt_secret, silently ignores it", async () => {
      await loginAs(ctx.get(), { role: "admin" });
      const before = getAllSettings(ctx.get()).jwt_secret;

      await callHandler(
        PUT,
        buildRequest({ method: "PUT", body: { jwt_secret: "attempted-override" } })
      );

      expect(getAllSettings(ctx.get()).jwt_secret).toBe(before);
    });

    it("when called as non-admin, returns 403", async () => {
      await loginAs(ctx.get(), { role: "mod" });

      const res = await callHandler(
        PUT,
        buildRequest({ method: "PUT", body: { app_name: "Hijacked" } })
      );

      expect(res.status).toBe(403);
    });
  });
});
