import { describe, it, expect } from "vitest";
import { GET, PUT, DELETE } from "./route";
import { POST as createTemplate } from "../route";
import { useTestDb } from "@/test/db";
import { loginAs } from "@/test/auth";
import { buildRequest, callHandler } from "@/test/request";

function params(id: number) {
  return { params: Promise.resolve({ id: String(id) }) };
}

async function seed(name: string, config: Record<string, unknown>) {
  const res = await callHandler<{ id: number }>(
    createTemplate,
    buildRequest({ method: "POST", body: { name, config } })
  );
  return res.body.id;
}

describe("/api/templates/[id]", () => {
  const ctx = useTestDb();

  describe("GET", () => {
    it("when template exists, returns it", async () => {
      await loginAs(ctx.get(), { role: "user" });
      const id = await seed("tpl", { image: "nginx" });

      const res = await callHandler<{ name: string }>(
        GET,
        buildRequest(),
        params(id)
      );

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("tpl");
    });

    it("when template does not exist, returns 404", async () => {
      await loginAs(ctx.get(), { role: "user" });

      const res = await callHandler(GET, buildRequest(), params(999));

      expect(res.status).toBe(404);
    });
  });

  describe("PUT", () => {
    it("when renaming an existing template, persists the new name", async () => {
      await loginAs(ctx.get(), { role: "user" });
      const id = await seed("old", { image: "alpine" });

      const res = await callHandler<{ name: string }>(
        PUT,
        buildRequest({ method: "PUT", body: { name: "new" } }),
        params(id)
      );

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("new");
    });
  });

  describe("DELETE", () => {
    it("removes the template", async () => {
      await loginAs(ctx.get(), { role: "user" });
      const id = await seed("doomed", {});

      const del = await callHandler(DELETE, buildRequest({ method: "DELETE" }), params(id));
      expect(del.status).toBe(200);

      const follow = await callHandler(GET, buildRequest(), params(id));
      expect(follow.status).toBe(404);
    });

    it("when not logged in, returns 401", async () => {
      const res = await callHandler(DELETE, buildRequest({ method: "DELETE" }), params(1));
      expect(res.status).toBe(401);
    });
  });
});
