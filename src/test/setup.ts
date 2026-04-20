import { vi } from "vitest";

declare global {
  var __testCookieJar: Map<string, string>;
}

globalThis.__testCookieJar = new Map();

vi.mock("next/headers", () => {
  const jar = () => globalThis.__testCookieJar;

  const cookiesApi = {
    get(name: string) {
      const v = jar().get(name);
      return v !== undefined ? { name, value: v } : undefined;
    },
    getAll() {
      return Array.from(jar().entries()).map(([name, value]) => ({
        name,
        value,
      }));
    },
    set(
      nameOrObj: string | { name: string; value: string },
      value?: string
    ) {
      if (typeof nameOrObj === "string") {
        jar().set(nameOrObj, String(value ?? ""));
      } else {
        jar().set(nameOrObj.name, nameOrObj.value);
      }
    },
    delete(name: string | { name: string }) {
      jar().delete(typeof name === "string" ? name : name.name);
    },
    has(name: string) {
      return jar().has(name);
    },
  };

  return {
    cookies: async () => cookiesApi,
    headers: async () => new Headers(),
  };
});
