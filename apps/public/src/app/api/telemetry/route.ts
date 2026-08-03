import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { consentFromRequest, cookieFromRequest } from '@/lib/consent/server';
import { SESSION_COOKIE, VISITOR_COOKIE, isGranted } from '@/lib/consent/types';

// First-party telemetry intake. Spec §8.
//
// Consent is enforced HERE, on the server, by re-reading the cookie — the client
// is never the authority. A forged body claiming consent gets nothing, and a
// blocked client-side pixel and a refused consent produce the same result.
//
// To be explicit, since the original brief framed server-side relay differently:
// this exists for reliability, payload control and keeping third-party JS out of
// the render loop. It is NOT an ad-blocker bypass, and it does not run when
// consent is absent.

export const runtime = 'nodejs';

const MAX_EVENTS = 40;
const MAX_BODY_BYTES = 32 * 1024;

/** Mirrors the taxonomy in lib/telemetry/events.ts. Anything else is dropped
 *  rather than stored, so a compromised client cannot invent event types. */
const ALLOWED = new Set([
  'place_enter', 'place_exit', 'camera_dwell', 'node_focus',
  'hologram_focus', 'hologram_parcel_select', 'media_open', 'cta_hover',
  'route_open', 'route_close',
  'session_start', 'session_end', 'form_start', 'form_submit', 'form_abandon',
]);

interface InEvent {
  event?: unknown;
  placeId?: unknown;
  payload?: unknown;
  ts?: unknown;
}

function sanitise(e: InEvent) {
  if (typeof e.event !== 'string' || !ALLOWED.has(e.event)) return null;
  const payload =
    e.payload && typeof e.payload === 'object' && !Array.isArray(e.payload)
      ? Object.fromEntries(
          Object.entries(e.payload as Record<string, unknown>)
            .filter(
              ([, v]) =>
                v === null ||
                typeof v === 'string' ||
                typeof v === 'number' ||
                typeof v === 'boolean',
            )
            // Cap string length: nothing in the taxonomy needs more, and this
            // stops a client smuggling free text into a telemetry field.
            .map(([k, v]) => [k.slice(0, 48), typeof v === 'string' ? v.slice(0, 200) : v])
            .slice(0, 24),
        )
      : {};
  return {
    event: e.event,
    placeId: typeof e.placeId === 'string' ? e.placeId.slice(0, 64) : null,
    payload,
    ts: typeof e.ts === 'number' && Number.isFinite(e.ts) ? e.ts : Date.now(),
  };
}

export async function POST(request: Request) {
  // 1. Consent, before anything else is even parsed.
  const consent = consentFromRequest(request);
  if (!isGranted(consent, 'analytics')) {
    // 204, not 403: the visitor made a valid choice and the client is behaving
    // correctly by asking. There is nothing to report as an error.
    return new NextResponse(null, { status: 204 });
  }

  const sessionId = cookieFromRequest(request, SESSION_COOKIE);
  if (!sessionId) return new NextResponse(null, { status: 204 });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, code: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
  }

  const incoming = (parsed as { events?: unknown })?.events;
  if (!Array.isArray(incoming)) {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
  }

  const events = incoming
    .slice(0, MAX_EVENTS)
    .map((e) => sanitise(e as InEvent))
    .filter((e): e is NonNullable<ReturnType<typeof sanitise>> => e !== null);

  if (events.length === 0) return new NextResponse(null, { status: 204 });

  const url = process.env.TELEMETRY_INTAKE_URL;
  const secret = process.env.TELEMETRY_INTAKE_SECRET;
  if (!url || !secret) {
    // Never surface a configuration problem to the visitor, and never fail a
    // page because analytics is misconfigured.
    console.error('Missing TELEMETRY_INTAKE_URL or TELEMETRY_INTAKE_SECRET');
    return new NextResponse(null, { status: 204 });
  }

  const body = JSON.stringify({
    sessionId,
    // Present only under analytics consent by construction: the middleware does
    // not mint it otherwise.
    visitorId: cookieFromRequest(request, VISITOR_COOKIE),
    consent: {
      version: consent?.version ?? 0,
      experience: consent?.experience ?? false,
      analytics: true,
      marketing: consent?.marketing ?? false,
    },
    events,
  });
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-signature': signature },
      body,
    });
  } catch (err) {
    console.error('Telemetry relay failed:', err);
  }

  return new NextResponse(null, { status: 204 });
}
