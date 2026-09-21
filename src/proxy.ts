import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function nextWithContentSecurityPolicy(request: NextRequest) {
  // Next reads the nonce from the forwarded request CSP and adds it to its own
  // framework scripts. Keep the nonce request-scoped; a static nonce is not a
  // security control.
  const nonce = btoa(crypto.randomUUID());
  const isDevelopment = process.env.NODE_ENV === "development";
  const connectSources = isDevelopment ? "'self' http: https: ws: wss:" : "'self' https: wss:";
  const scriptDirective = isDevelopment
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' https://checkout.razorpay.com https://*.razorpay.com`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://checkout.razorpay.com https://*.razorpay.com`;
  const styleDirective = isDevelopment
    ? "style-src 'self' 'unsafe-inline'"
    : `style-src 'self' 'nonce-${nonce}'`;

  const csp = [
    "default-src 'self'",
    scriptDirective,
    styleDirective,
    "img-src 'self' blob: data: https: https://*.razorpay.com",
    "font-src 'self' data:",
    `connect-src ${connectSources}`,
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Check for the presence of auth tokens (refresh_token, access_token) or session cookie (ananta_session)
  const hasAuthToken =
    request.cookies.has("refresh_token") ||
    request.cookies.has("access_token") ||
    request.cookies.has("ananta_session");

  // ── Protect dashboard routes ────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    if (!hasAuthToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // ── Protect /onboarding ─────────────────────────────────────────
  // Provisioning is a platform-admin workflow. Authorization is enforced by
  // the backend; this guard avoids presenting the form to anonymous visitors.
  if (pathname === "/onboarding") {
    const isNewOrgMode = searchParams.get("mode") === "new_org";

    if (!hasAuthToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (!isNewOrgMode) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
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
      const response = nextWithContentSecurityPolicy(request);
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

  return nextWithContentSecurityPolicy(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

export default proxy;
