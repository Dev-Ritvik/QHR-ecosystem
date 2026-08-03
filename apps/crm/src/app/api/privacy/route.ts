import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

// Visitor rights handler. Serves the access and erasure rights the DPDP Act
// grants, for the anonymous visitor identified by their own session cookie.
//
// Same HMAC contract as the telemetry and enquiry intakes, so there is one
// authentication pattern across all three rather than three.
//
// Two properties that matter more than the mechanics:
//
//   Erasure must reach session_events. A deletion that removes the session row
//   and leaves the telemetry behind is not an erasure — it just orphans it.
//   The FK from visitor_sessions is ON DELETE SET NULL against leads, not a
//   cascade into events, so the events are deleted explicitly and first.
//
//   A STITCHED session is not erased blindly. Once a form is submitted the
//   session belongs to a named lead with its own retention and, potentially, a
//   contractual basis. The telemetry is still removed, but the lead row is left
//   alone and the response says so, so a visitor asking to erase their browsing
//   history does not silently delete an enquiry the sales team is acting on.

export const runtime = 'nodejs';

interface Body {
  action?: unknown;
  sessionId?: unknown;
  visitorId?: unknown;
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

  let body: Body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
  }

  const action = body.action;
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
  if (!sessionId || (action !== 'access' && action !== 'erase')) {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
  }
  // Reject anything that is not a uuid before it reaches a query.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
  }

  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  try {
    if (action === 'access') {
      const [session] = await db.execute(sql`
        SELECT id, first_seen_at, last_seen_at, consent_analytics, consent_marketing,
               consent_experience, device_tier, total_dwell_ms, places_visited,
               (lead_id IS NOT NULL) AS stitched
        FROM core.visitor_sessions WHERE id = ${sessionId}::uuid
      `);
      if (!session) return NextResponse.json({ ok: true, held: null });

      const events = await db.execute(sql`
        SELECT event, place_id, occurred_at
        FROM core.session_events
        WHERE session_id = ${sessionId}::uuid
        ORDER BY occurred_at DESC LIMIT 500
      `);
      return NextResponse.json({ ok: true, held: { session, events } });
    }

    // --- erase
    const events = await db.execute(sql`
      DELETE FROM core.session_events WHERE session_id = ${sessionId}::uuid
    `);
    const [session] = await db.execute(sql`
      SELECT (lead_id IS NOT NULL) AS stitched FROM core.visitor_sessions
      WHERE id = ${sessionId}::uuid
    `);
    const stitched = Boolean((session as { stitched?: boolean } | undefined)?.stitched);

    if (stitched) {
      // Keep the row so the lead's provenance is not silently rewritten, but
      // strip everything that could re-identify the browser.
      await db.execute(sql`
        UPDATE core.visitor_sessions
        SET visitor_id = NULL, referrer = NULL,
            utm_source = NULL, utm_medium = NULL, utm_campaign = NULL,
            utm_term = NULL, utm_content = NULL, updated_at = now()
        WHERE id = ${sessionId}::uuid
      `);
    } else {
      await db.execute(sql`
        DELETE FROM core.visitor_sessions WHERE id = ${sessionId}::uuid
      `);
    }

    return NextResponse.json({
      ok: true,
      erasedEvents: Array.isArray(events) ? events.length : 0,
      sessionRemoved: !stitched,
      leadRetained: stitched,
    });
  } catch (err) {
    console.error('Privacy request failed:', err);
    return NextResponse.json({ ok: false, code: 'SERVER_ERROR' }, { status: 500 });
  } finally {
    await client.end();
  }
}
