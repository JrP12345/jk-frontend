import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isDev = process.env.NODE_ENV === 'development';

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // We check for the presence of refresh_token cookie as the primary indicator of an active session.
  const hasRefreshToken = request.cookies.has('refresh_token');

  // ── Protect dashboard routes ────────────────────────────────────
  if (pathname.startsWith('/dashboard')) {
    if (!hasRefreshToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // ── Protect /onboarding ─────────────────────────────────────────
  // DEVELOPMENT ONLY: Onboarding is completely disabled in production.
  // In production builds, always redirect to /login — no exceptions.
  // In development: requires the secret key passed as ?key=<ONBOARDING_SECRET>.
  if (pathname === '/onboarding') {
    // If already logged in, redirect to dashboard regardless of env
    if (hasRefreshToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // In production — block entirely, no way to reach onboarding
    if (!isDev) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // In development — still require the secret key
    const providedKey = searchParams.get('key') || '';
    const expectedKey = process.env.ONBOARDING_SECRET || '';

    if (!providedKey || !expectedKey || providedKey !== expectedKey) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Redirect away from login if already logged in ───────────────
  if (pathname === '/login') {
    if (hasRefreshToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/onboarding'],
};
