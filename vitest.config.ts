import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.integration.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.integration.test.ts",
        "src/test/**",
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/instrumentation.ts",
      ],
    },
  },
});
