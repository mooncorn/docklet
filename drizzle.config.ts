import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DOCKLET_DATA_DIR
      ? `${process.env.DOCKLET_DATA_DIR}/db/docklet.db`
      : "/docklet-data/db/docklet.db",
  },
});
