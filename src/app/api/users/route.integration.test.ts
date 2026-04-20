import { describe, it, expect } from "vitest";
import { GET, POST } from "./route";
import { useTestDb } from "@/test/db";
import { loginAs, createTestUser } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";
import { username, password } from "@/test/faker";

describe("/api/users (collection)", () => {
  const ctx = useTestDb();

  describe("GET", () => {
    it("when called as admin, returns the user list without password hashes", async () => {
      await loginAs(ctx.get(), { role: "admin" });
      await createTestUser(ctx.get(), { role: "user" });

      const res = await callHandler<Array<Record<string, unknown>>>(
        GET,
        buildRequest()
      );

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      for (const row of res.body) {
        expect(row).not.toHaveProperty("passwordHash");
      }
    });

    it("when called as a non-admin, returns 403", async () => {
      await loginAs(ctx.get(), { role: "user" });

      const res = await callHandler<{ error: string }>(
        GET,
        buildRequest()
      );

      expect(res.status).toBe(403);
    });

    it("when not logged in, returns 401", async () => {
      const res = await callHandler<{ error: string }>(
        GET,
        buildRequest()
      );

      expect(res.status).toBe(401);
    });
  });

  describe("POST", () => {
    it("when called as admin with valid input, creates the user", async () => {
      await loginAs(ctx.get(), { role: "admin" });
      const name = username();

      const res = await callHandler<{ username: string; role: string }>(
        POST,
        buildRequest({ method: "POST", body: { username: name, password: password(), role: "mod" } })
      );

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ username: name, role: "mod" });
    });

    it("when username already exists, returns 409", async () => {
      await loginAs(ctx.get(), { role: "admin" });
      const existing = await createTestUser(ctx.get(), { role: "user" });

      const res = await callHandler<{ error: string }>(
        POST,
        buildRequest({
          method: "POST",
          body: { username: existing.username, password: password(), role: "user" },
        })
      );

      expect(res.status).toBe(409);
    });

    it("when password is shorter than 8 characters, returns 400", async () => {
      await loginAs(ctx.get(), { role: "admin" });

      const res = await callHandler<{ error: string }>(
        POST,
        buildRequest({ method: "POST", body: { username: username(), password: "abc", role: "user" } })
      );

      expect(res.status).toBe(400);
    });

    it("when called as non-admin, returns 403 without creating the user", async () => {
      await loginAs(ctx.get(), { role: "mod" });

      const res = await callHandler(
        POST,
        buildRequest({ method: "POST", body: { username: username(), password: password(), role: "user" } })
      );

      expect(res.status).toBe(403);
    });
  });
});
