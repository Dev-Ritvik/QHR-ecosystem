import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decodeConsent } from '@/lib/consent/cookie';
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_S,
  SESSION_COOKIE,
  VISITOR_COOKIE,
  isGranted,
} from '@/lib/consent/types';

/**
 * Attach the two identifiers the analytics layer needs, with the distinction
 * that keeps this lawful (spec §6):
 *
 *   qhr_sid — ephemeral, essential. A session cookie, so it dies with the
 *             browser. Carries no profiling on its own, which is what makes
 *             "strictly necessary" actually strictly necessary.
 *   qhr_vid — persistent, and written ONLY once Analytics consent exists. This
 *             is the whole difference between remembering a returning visitor
 *             and tracking one, so it is minted here rather than client-side,
 *             where a race could create it before the choice has been read.
 *
 * Both are HttpOnly: the browser never needs to read them. Telemetry posts to
 * our own origin and the route handler reads the cookies server-side, so a
 * forged request body cannot claim an identity it was not given.
 */
function attachIdentifiers(req: NextRequest, res: NextResponse): NextResponse {
  const secure = req.nextUrl.protocol === 'https:';
  const base = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
  };

  if (!req.cookies.get(SESSION_COOKIE)) {
    // No maxAge — a true session cookie.
    res.cookies.set(SESSION_COOKIE, crypto.randomUUID(), base);
  }

  const consent = decodeConsent(req.cookies.get(CONSENT_COOKIE)?.value);
  if (isGranted(consent, 'analytics')) {
    if (!req.cookies.get(VISITOR_COOKIE)) {
      res.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
        ...base,
        maxAge: CONSENT_MAX_AGE_S,
      });
    }
  } else if (req.cookies.get(VISITOR_COOKIE)) {
    // Consent withdrawn, or a stale id surviving a notice change. The client
    // clears its own copy, but the server must not depend on the client to
    // honour a withdrawal.
    res.cookies.set(VISITOR_COOKIE, '', { ...base, maxAge: 0 });
  }

  return res;
}

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
    // The kiosk is staff-operated and loads no analytics, so it gets no
    // identifiers — there is nothing here to consent to.
    return NextResponse.rewrite(new URL(target, request.url));
  }

  // Public site: rewrite "/" to "/site-home" which lives under (site)/site-home/page.tsx.
  // All other paths (e.g. /projects/[slug]) pass through directly.
  const target = url.pathname === '/' ? '/site-home' : url.pathname;
  return attachIdentifiers(
    request,
    NextResponse.rewrite(new URL(target, request.url)),
  );
}

export const config = {
  matcher: [
    // Exclude Next.js internals, static assets, and our internal rewrite targets
    // (site-home and present-home) so the middleware does not re-fire on the rewritten URL.
    '/((?!api|_next/static|_next/image|favicon.ico|fallbacks|site-home|present-home).*)',
  ],
};
