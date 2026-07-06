import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // We check for the presence of refresh_token cookie as the primary indicator of an active session.
  // The access_token expires quickly, but as long as refresh_token is there, the Axios interceptor
  // will transparently get a new access_token on the first API call.
  const hasRefreshToken = request.cookies.has('refresh_token');

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!hasRefreshToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Redirect away from auth routes if already logged in
  if (pathname === '/login' || pathname === '/onboarding') {
    if (hasRefreshToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/onboarding'],
};
