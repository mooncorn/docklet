import { test as base, type Page, type APIRequestContext } from "@playwright/test";

export const ADMIN_CREDS = {
  username: "e2e-admin",
  password: "e2epassword1",
} as const;
export const USER_CREDS = {
  username: "e2e-user",
  password: "e2epassword2",
} as const;
export const MOD_CREDS = {
  username: "e2e-mod",
  password: "e2epassword3",
} as const;

type AuthFixtures = {
  adminPage: Page;
  userPage: Page;
  modPage: Page;
};

function normalizeSameSite(value: string | undefined): "Lax" | "Strict" | "None" {
  if (!value) return "Lax";
  const capitalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  if (capitalized === "Strict" || capitalized === "None") return capitalized;
  return "Lax";
}

/**
 * Parses a Set-Cookie header string into Playwright cookie objects.
 * Handles the httpOnly docklet_session cookie that can't be set via document.cookie.
 */
function parseSetCookieHeader(
  setCookieHeader: string,
  domain: string
): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Lax" | "Strict" | "None";
}> {
  return setCookieHeader.split(/,(?=[^ ])/).map((raw) => {
    const parts = raw.split(";").map((p) => p.trim());
    const [nameValue, ...attrParts] = parts;
    const eqIdx = nameValue.indexOf("=");
    const name = nameValue.slice(0, eqIdx).trim();
    const value = nameValue.slice(eqIdx + 1).trim();
    const attrs: Record<string, string> = {};
    for (const attr of attrParts) {
      const i = attr.indexOf("=");
      if (i >= 0) {
        attrs[attr.slice(0, i).toLowerCase()] = attr.slice(i + 1);
      } else {
        attrs[attr.toLowerCase()] = "true";
      }
    }
    return {
      name,
      value,
      domain,
      path: attrs["path"] ?? "/",
      httpOnly: "httponly" in attrs,
      secure: "secure" in attrs,
      sameSite: normalizeSameSite(attrs["samesite"]),
    };
  });
}

/**
 * Logs in via the API and injects the session cookie into the browser context.
 * Avoids UI login entirely: no rate-limit risk, no flaky form interactions.
 */
async function apiLogin(
  request: APIRequestContext,
  page: Page,
  creds: { username: string; password: string }
): Promise<void> {
  const res = await request.post("/api/auth/login", {
    data: { username: creds.username, password: creds.password },
  });
  if (!res.ok()) {
    throw new Error(
      `apiLogin failed for ${creds.username}: ${res.status()} ${await res.text()}`
    );
  }
  const setCookieHeader = res.headers()["set-cookie"];
  if (setCookieHeader) {
    const domain = new URL("http://localhost:3000").hostname;
    const cookies = parseSetCookieHeader(setCookieHeader, domain);
    await page.context().addCookies(cookies);
  }
}

/**
 * Ensures the initial admin account exists. Idempotent: ignores 400 if already set up.
 */
async function ensureAdmin(request: APIRequestContext): Promise<void> {
  await request.post("/api/auth/setup", {
    data: {
      username: ADMIN_CREDS.username,
      password: ADMIN_CREDS.password,
      confirmPassword: ADMIN_CREDS.password,
    },
  });
}

/**
 * Gets an admin session cookie string for use in subsequent API calls.
 */
async function getAdminCookieHeader(
  request: APIRequestContext
): Promise<string> {
  const res = await request.post("/api/auth/login", { data: ADMIN_CREDS });
  if (!res.ok()) {
    throw new Error(`Admin login failed: ${res.status()} ${await res.text()}`);
  }
  return res.headers()["set-cookie"] ?? "";
}

/**
 * Ensures a non-admin user exists. Ignores 409 Conflict (already exists).
 */
async function ensureUser(
  request: APIRequestContext,
  adminCookieHeader: string,
  creds: { username: string; password: string },
  role: "user" | "mod"
): Promise<void> {
  const res = await request.post("/api/users", {
    headers: { Cookie: adminCookieHeader },
    data: { username: creds.username, password: creds.password, role },
  });
  if (!res.ok() && res.status() !== 409) {
    throw new Error(
      `ensureUser failed for ${creds.username}: ${res.status()} ${await res.text()}`
    );
  }
}

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ page, request }, use) => {
    await ensureAdmin(request);
    await apiLogin(request, page, ADMIN_CREDS);
    await use(page);
  },

  userPage: async ({ page, request }, use) => {
    await ensureAdmin(request);
    const adminCookie = await getAdminCookieHeader(request);
    await ensureUser(request, adminCookie, USER_CREDS, "user");
    await apiLogin(request, page, USER_CREDS);
    await use(page);
  },

  modPage: async ({ page, request }, use) => {
    await ensureAdmin(request);
    const adminCookie = await getAdminCookieHeader(request);
    await ensureUser(request, adminCookie, MOD_CREDS, "mod");
    await apiLogin(request, page, MOD_CREDS);
    await use(page);
  },
});

export { expect } from "@playwright/test";
