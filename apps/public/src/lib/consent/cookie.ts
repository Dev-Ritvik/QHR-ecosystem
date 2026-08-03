// apps/public/src/lib/consent/cookie.ts
//
// Isomorphic encode/decode for the consent cookie. Deliberately dependency-free
// and total: any malformed, truncated or superseded value decodes to null, which
// the rest of the system treats as "no consent" rather than as an error to
// recover from. Failing open here would mean collecting without permission.

import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_S,
  CONSENT_VERSION,
  type ConsentState,
  type ConsentStatus,
} from './types';

/** Compact on purpose — this rides on every request. */
interface Wire {
  v: number;
  x: 0 | 1; // experience
  a: 0 | 1; // analytics
  m: 0 | 1; // marketing
  t: number;
}

export function encodeConsent(state: ConsentState): string {
  const wire: Wire = {
    v: state.version,
    x: state.experience ? 1 : 0,
    a: state.analytics ? 1 : 0,
    m: state.marketing ? 1 : 0,
    t: state.decidedAt,
  };
  return encodeURIComponent(JSON.stringify(wire));
}

export function decodeConsent(raw: string | undefined | null): ConsentStatus {
  if (!raw) return null;
  let wire: unknown;
  try {
    wire = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (typeof wire !== 'object' || wire === null) return null;
  const w = wire as Partial<Wire>;
  if (typeof w.v !== 'number') return null;

  // A choice made against a different notice is not consent to THIS one.
  if (w.v !== CONSENT_VERSION) return null;

  return {
    version: w.v,
    experience: w.x === 1,
    analytics: w.a === 1,
    marketing: w.m === 1,
    decidedAt: typeof w.t === 'number' ? w.t : 0,
  };
}

export function consentCookieAttributes(secure: boolean): string {
  // Lax, not None: nothing here is needed on a cross-site POST, and Lax keeps
  // the value off third-party contexts entirely.
  return [
    'Path=/',
    `Max-Age=${CONSENT_MAX_AGE_S}`,
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function serializeConsentCookie(
  state: ConsentState,
  secure: boolean,
): string {
  return `${CONSENT_COOKIE}=${encodeConsent(state)}; ${consentCookieAttributes(secure)}`;
}

/** Browser-side read. Server code should use readConsent() from ./server. */
export function readConsentFromDocument(): ConsentStatus {
  if (typeof document === 'undefined') return null;
  const hit = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return decodeConsent(hit ? hit.slice(CONSENT_COOKIE.length + 1) : null);
}

export function writeConsentToDocument(state: ConsentState): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:';
  document.cookie = serializeConsentCookie(state, secure);
}

/** Withdrawal has to actually remove the identifiers, not just flip a flag. */
export function clearCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}
