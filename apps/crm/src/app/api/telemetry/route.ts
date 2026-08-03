import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

// Telemetry intake from the public site. Mirrors the enquiry intake's HMAC
// contract (FR-W4) so there is one authentication pattern between the two apps,
// not two.
//
// The public app has already enforced consent server-side before relaying, but
// this endpoint re-checks the flag it was sent rather than assuming: a caller
// holding the shared secret still cannot write events for a session that did not
// consent.

export const runtime = 'nodejs';

const MAX_EVENTS = 40;

interface RelayEvent {
  event: string;
  placeId: string | null;
  payload: Record<string, unknown>;
  ts: number;
}

export async function POST(request: Request) {
  const secret = process.env.TELEMETRY_INTAKE_SECRET;
  if (!secret) {
    console.error('CRITICAL: TELEMETRY_INTAKE_SECRET is not configured.');
    return NextResponse.json({ ok: false, code: 'SERVER_ERROR' }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-signature');
  if (!signature) {
    return NextResponse.json({ ok: false, code: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (signature.length !== expected.length) {
    return NextResponse.json({ ok: false, code: 'UNAUTHENTICATED' }, { status: 401 });
  }
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return NextResponse.json({ ok: false, code: 'UNAUTHENTICATED' }, { status: 401 });
  }

  let payload: {
    sessionId?: string;
    visitorId?: string | null;
    consent?: {
      version?: number;
      experience?: boolean;
      analytics?: boolean;
      marketing?: boolean;
    };
    events?: RelayEvent[];
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
  }

  const sessionId = payload.sessionId;
  const consent = payload.consent;
  const events = Array.isArray(payload.events) ? payload.events.slice(0, MAX_EVENTS) : [];

  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return NextResponse.json({ ok: false, code: 'VALIDATION_FAILED' }, { status: 422 });
  }
  // Independent check: holding the secret is not the same as having consent.
  if (!consent?.analytics) {
    return NextResponse.json({ ok: true, stored: 0 });
  }
  if (events.length === 0) {
    return NextResponse.json({ ok: true, stored: 0 });
  }

  // The visitor id may exist only under analytics consent — the same rule the
  // visitor_sessions_vid_requires_consent constraint enforces in the database.
  const visitorId =
    payload.visitorId && /^[0-9a-f-]{36}$/i.test(payload.visitorId)
      ? payload.visitorId
      : null;

  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  try {
    await db.transaction(async (tx) => {
      // Session upsert. Consent state is recorded ON the session, so we can
      // later show what was agreed at the time these events were captured —
      // a cookie the visitor has since changed is not evidence.
      await tx.execute(sql`
        INSERT INTO core.visitor_sessions
          (id, visitor_id, consent_version, consent_experience, consent_analytics, consent_marketing)
        VALUES (
          ${sessionId}::uuid,
          ${visitorId}::uuid,
          ${consent.version ?? 0},
          ${consent.experience ?? false},
          true,
          ${consent.marketing ?? false}
        )
        ON CONFLICT (id) DO UPDATE SET
          visitor_id         = COALESCE(EXCLUDED.visitor_id, core.visitor_sessions.visitor_id),
          consent_version    = EXCLUDED.consent_version,
          consent_experience = EXCLUDED.consent_experience,
          consent_analytics  = EXCLUDED.consent_analytics,
          consent_marketing  = EXCLUDED.consent_marketing,
          last_seen_at       = now(),
          updated_at         = now()
      `);

      for (const e of events) {
        if (typeof e?.event !== 'string') continue;
        const occurred = Number.isFinite(e.ts) ? new Date(e.ts) : new Date();
        await tx.execute(sql`
          INSERT INTO core.session_events (session_id, event, place_id, payload, occurred_at)
          VALUES (
            ${sessionId}::uuid,
            ${e.event},
            ${e.placeId ?? null},
            ${JSON.stringify(e.payload ?? {})}::jsonb,
            ${occurred.toISOString()}::timestamptz
          )
        `);
      }
    });

    return NextResponse.json({ ok: true, stored: events.length });
  } catch (err) {
    console.error('Telemetry persist failed:', err);
    return NextResponse.json({ ok: false, code: 'PERSIST_FAILED' }, { status: 500 });
  } finally {
    await client.end();
  }
}
