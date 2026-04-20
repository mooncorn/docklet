import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { useTestDb } from "@/test/db";
import { createTestUser } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";
import { username, password } from "@/test/faker";

describe("POST /api/auth/login", () => {
  const ctx = useTestDb();

  describe("when credentials are valid", () => {
    it("returns the user and sets a session cookie", async () => {
      const user = await createTestUser(ctx.get(), { role: "admin" });

      const res = await callHandler<{ user: { id: number; username: string; role: string } }>(
        POST,
        buildRequest({ method: "POST", body: { username: user.username, password: user.password } })
      );

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ username: user.username, role: "admin" });
      expect(globalThis.__testCookieJar.get("docklet_session")).toBeDefined();
    });
  });

  describe("when password is wrong", () => {
    it("returns 401 with a generic error", async () => {
      const user = await createTestUser(ctx.get());

      const res = await callHandler<{ error: string }>(
        POST,
        buildRequest({ method: "POST", body: { username: user.username, password: password() } })
      );

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid username or password");
    });
  });

  describe("when username does not exist", () => {
    it("returns the same error as wrong password (no user enumeration)", async () => {
      const res = await callHandler<{ error: string }>(
        POST,
        buildRequest({ method: "POST", body: { username: username(), password: password() } })
      );

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid username or password");
    });
  });

  describe("when body is missing username", () => {
    it("returns 400", async () => {
      const res = await callHandler<{ error: string }>(
        POST,
        buildRequest({ method: "POST", body: { password: password() } })
      );

      expect(res.status).toBe(400);
    });
  });

  describe("when the same IP exceeds the rate limit", () => {
    beforeEach(() => {
      delete process.env.E2E_DISABLE_RATE_LIMIT;
    });

    it("returns 429 on the 6th attempt", async () => {
      const ip = "10.0.0.1";
      const attempts = Array.from({ length: 5 }, () =>
        callHandler(POST, buildRequest({
          method: "POST",
          body: { username: username(), password: password() },
          ip,
        }))
      );
      await Promise.all(attempts);

      const sixth = await callHandler<{ error: string }>(
        POST,
        buildRequest({ method: "POST", body: { username: username(), password: password() }, ip })
      );

      expect(sixth.status).toBe(429);
    });
  });
});
