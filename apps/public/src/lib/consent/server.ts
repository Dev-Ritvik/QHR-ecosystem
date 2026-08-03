// apps/public/src/lib/consent/server.ts
//
// Server-side consent read. The client is never the authority: the telemetry
// endpoint re-reads the cookie here and enforces on its own, so a forged request
// body claiming consent gets nothing. See spec §3.3 and §8.

import { cookies } from 'next/headers';
import { decodeConsent } from './cookie';
import {
  CONSENT_COOKIE,
  SESSION_COOKIE,
  VISITOR_COOKIE,
  isGranted,
  type ConsentCategory,
  type ConsentStatus,
} from './types';

export function readConsent(): ConsentStatus {
  return decodeConsent(cookies().get(CONSENT_COOKIE)?.value);
}

export function serverIsGranted(category: ConsentCategory): boolean {
  return isGranted(readConsent(), category);
}

export function readSessionId(): string | null {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}

/** Only ever present when Analytics was granted — see the middleware. */
export function readVisitorId(): string | null {
  return cookies().get(VISITOR_COOKIE)?.value ?? null;
}

/** Parse a cookie header directly, for route handlers that have a Request but
 *  no next/headers store. */
export function consentFromRequest(req: Request): ConsentStatus {
  const header = req.headers.get('cookie');
  if (!header) return null;
  const hit = header
    .split('; ')
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return decodeConsent(hit ? hit.slice(CONSENT_COOKIE.length + 1) : null);
}

export function cookieFromRequest(req: Request, name: string): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  const hit = header.split('; ').find((c) => c.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}
