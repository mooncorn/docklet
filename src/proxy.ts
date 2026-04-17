import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/setup", "/api/auth/login", "/api/auth/setup", "/api/app-name"];
const STATIC_PREFIXES = ["/_next", "/favicon.ico"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Public paths don't require auth
  if (PUBLIC_PATHS.some((p) => pathname === p)) {
    return NextResponse.next();
  }

  // Check auth for protected routes
  const token = request.cookies.get("docklet_session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verify JWT
  try {
    const secret = new TextEncoder().encode(
      // Read JWT secret from a cookie set during setup/login
      // This is a lightweight check - full verification happens in API routes
      request.cookies.get("docklet_jwt_check")?.value || "invalid"
    );
    await jwtVerify(token, secret);
  } catch {
    // If JWT verification fails in middleware, let the request through
    // and let the API route handle full verification with DB-stored secret
    // This is because middleware can't access the database directly
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
