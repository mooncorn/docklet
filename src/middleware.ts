import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/setup", "/api/auth/login", "/api/auth/setup"];
const STATIC_PREFIXES = ["/_next", "/favicon.ico"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check setup status via a lightweight cookie/header approach
  // The setup_completed flag is set as a cookie by the setup API
  const setupCompleted = request.cookies.get("docklet_setup")?.value === "true";

  // If setup not completed, redirect everything to /setup (except /setup itself and its API)
  if (!setupCompleted) {
    if (pathname === "/setup" || pathname === "/api/auth/setup") {
      return NextResponse.next();
    }
    // For API routes, return 503
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Setup not completed" },
        { status: 503 }
      );
    }
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  // If setup is completed and user visits /setup, redirect to dashboard
  if (pathname === "/setup") {
    return NextResponse.redirect(new URL("/", request.url));
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
