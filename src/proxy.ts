import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // We check for the presence of authentic httpOnly auth tokens (refresh_token or access_token).
  // Client-writable cookies (e.g. ananta_session) are NOT trusted for edge route protection.
  const hasAuthToken =
    request.cookies.has("refresh_token") ||
    request.cookies.has("access_token");

  // ── Protect dashboard routes ────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    if (!hasAuthToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // ── Protect /onboarding ─────────────────────────────────────────
  // Allows new organizations to self-onboard in both production and development.
  // If already logged in AND not explicitly creating a new org, redirect to dashboard.
  if (pathname === "/onboarding") {
    const isNewOrgMode = searchParams.get("mode") === "new_org";

    if (hasAuthToken && !isNewOrgMode) {
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
    // If the user was redirected to /login with expired=1, error, or logout=1,
    // clear the stale session cookies so they don't bounce back to dashboard
    if (
      searchParams.has("expired") ||
      searchParams.has("error") ||
      searchParams.has("logout") ||
      searchParams.has("logged_out")
    ) {
      const response = NextResponse.next();
      response.cookies.delete("refresh_token");
      response.cookies.delete("access_token");
      response.cookies.delete("ananta_session");
      return response;
    }

    if (hasAuthToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // ── Handle root path ──────────────────────────────────────────
  if (pathname === "/") {
    if (hasAuthToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/browse", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/login", "/onboarding"],
};

export default proxy;
