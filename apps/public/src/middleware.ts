import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // NFR-S1/S2 Host-based routing for presentation mode subdomain
  if (hostname.startsWith('present.')) {
    // Route group names (parentheses) are filesystem-only — not real URL paths.
    // Rewrite "/" to "/present-home" which lives under (present)/present-home/page.tsx.
    // All other paths (e.g. /p/[slug], /enroll) pass through directly; Next.js
    // resolves them against the (present) route group because they exist only there.
    const target = url.pathname === '/' ? '/present-home' : url.pathname;
    return NextResponse.rewrite(new URL(target, request.url));
  }

  // Public site: rewrite "/" to "/site-home" which lives under (site)/site-home/page.tsx.
  // All other paths (e.g. /projects/[slug]) pass through directly.
  const target = url.pathname === '/' ? '/site-home' : url.pathname;
  return NextResponse.rewrite(new URL(target, request.url));
}

export const config = {
  matcher: [
    // Exclude Next.js internals, static assets, and our internal rewrite targets
    // (site-home and present-home) so the middleware does not re-fire on the rewritten URL.
    '/((?!api|_next/static|_next/image|favicon.ico|fallbacks|site-home|present-home).*)',
  ],
};

