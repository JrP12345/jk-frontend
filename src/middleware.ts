import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isDev = process.env.NODE_ENV === "development";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // We check for the presence of refresh_token, access_token, or ananta_session cookie as an indicator of an active session.
  const hasRefreshToken =
    request.cookies.has("refresh_token") ||
    request.cookies.has("access_token") ||
    request.cookies.has("ananta_session");

  // ── Protect dashboard routes ────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    if (!hasRefreshToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // ── Protect /onboarding ─────────────────────────────────────────
  // Allows new organizations to self-onboard in both production and development.
  // If already logged in AND not explicitly creating a new org, redirect to dashboard.
  if (pathname === "/onboarding") {
    const isNewOrgMode = searchParams.get("mode") === "new_org";

    if (hasRefreshToken && !isNewOrgMode) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // If an ONBOARDING_SECRET is configured, require it unless creating a new tenant org
    const expectedKey = process.env.ONBOARDING_SECRET;
    if (expectedKey && !isNewOrgMode) {
      const providedKey = searchParams.get("key") || "";
      if (providedKey !== expectedKey) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "unauthorized");
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // ── Redirect away from login if already logged in ───────────────
  if (pathname === "/login") {
    // If the user was redirected to /login with expired=1 or an error,
    // clear the stale session cookies so they don't bounce back to dashboard
    if (searchParams.has("expired") || searchParams.has("error")) {
      const response = NextResponse.next();
      response.cookies.delete("refresh_token");
      response.cookies.delete("access_token");
      response.cookies.delete("ananta_session");
      return response;
    }

    if (hasRefreshToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/onboarding"],
};

export default middleware;
