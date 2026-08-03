import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { consentFromRequest, cookieFromRequest } from '@/lib/consent/server';
import { SESSION_COOKIE, VISITOR_COOKIE } from '@/lib/consent/types';

// Visitor rights endpoint. Spec §11.
//
// The DPDP Act grants access, correction, erasure and grievance redressal. Two
// of those can be served automatically for an anonymous visitor and are served
// here; correction and grievance need a human and are handled by the published
// DPO contact.
//
// IDENTITY. An anonymous visitor has no account to authenticate against, so the
// only honest proof they can offer is possession of their own session cookie —
// which is HttpOnly, same-site, and was issued by us. That is enough to act on
// their OWN data and cannot be used to reach anyone else's, because the session
// id never appears in a body we would trust. A request without the cookie gets
// nothing rather than an error, so this cannot be used to probe which sessions
// exist.
//
// GET    — what we hold for this session
// DELETE — erase it. Must reach session_events, not just the session row: an
//          erasure that leaves the telemetry behind is not an erasure.

export const runtime = 'nodejs';

function relayTarget() {
  const secret = process.env.TELEMETRY_INTAKE_SECRET;
  const base = process.env.TELEMETRY_INTAKE_URL;
  if (!secret || !base) return null;
  // Same origin as the telemetry intake, different path.
  return { secret, url: base.replace(/\/telemetry\/?$/, '/privacy') };
}

async function relay(action: 'access' | 'erase', sessionId: string, visitorId: string | null) {
  const t = relayTarget();
  if (!t) {
    console.error('Missing TELEMETRY_INTAKE_SECRET or TELEMETRY_INTAKE_URL');
    return null;
  }
  const body = JSON.stringify({ action, sessionId, visitorId });
  const signature = crypto.createHmac('sha256', t.secret).update(body).digest('hex');
  try {
    const res = await fetch(t.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-signature': signature },
      body,
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch (err) {
    console.error('Privacy relay failed:', err);
    return null;
  }
}

export async function GET(request: Request) {
  const sessionId = cookieFromRequest(request, SESSION_COOKIE);
  if (!sessionId) {
    return NextResponse.json({ ok: true, held: null });
  }
  const visitorId = cookieFromRequest(request, VISITOR_COOKIE);
  const data = await relay('access', sessionId, visitorId);
  return NextResponse.json({
    ok: true,
    consent: consentFromRequest(request),
    held: data,
  });
}

export async function DELETE(request: Request) {
  const sessionId = cookieFromRequest(request, SESSION_COOKIE);
  if (!sessionId) {
    return NextResponse.json({ ok: true, erased: 0 });
  }
  const visitorId = cookieFromRequest(request, VISITOR_COOKIE);
  const result = await relay('erase', sessionId, visitorId);

  // A failed erasure must NOT look like a successful one. relay() returns null
  // when the CRM was unreachable or refused, and reporting ok:true there would
  // tell a visitor their data is gone while it is still sitting in the table.
  //
  // The cookies are deliberately left in place on failure too: the session id is
  // the visitor's only proof of ownership over that data, so clearing it would
  // strand the record beyond their reach and make a retry impossible.
  if (result === null) {
    return NextResponse.json(
      { ok: false, code: 'ERASURE_FAILED' },
      { status: 502 },
    );
  }

  // Drop the identifiers too. Leaving a live visitor id after an erasure would
  // re-link the same browser to whatever it does next, which defeats the point.
  const res = NextResponse.json({ ok: true, erased: result });
  const secure = new URL(request.url).protocol === 'https:';
  for (const name of [SESSION_COOKIE, VISITOR_COOKIE]) {
    res.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 0,
    });
  }
  return res;
}
