import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { leads, leadInterests } from '@estate/db';
import { generateDedupeKey, normalizePhone } from '@estate/domain/leads/dedupe';
import { OUTBOUND_THRESHOLD } from '@estate/domain/leads/scoring';
import { stitchSessionToLead } from '@/server/leads/stitch';
import { notifications, users } from '@estate/db';
import { eq } from 'drizzle-orm';

/** City-level only, never finer — spec §7 keeps geography as a tiebreak, not a
 *  location trace. Behind a proxy this is whatever the edge resolved; absent
 *  that it is null and routing falls back rather than guessing. */
function geoPlaceFromRequest(req: Request): string | null {
  return (
    req.headers.get('x-vercel-ip-city') ||
    req.headers.get('cf-ipcity') ||
    null
  );
}

// In-memory rate limiting (sufficient for single-region deployment of the CRM API)
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  try {
    const secret = process.env.LEAD_INTAKE_SECRET;
    if (!secret) {
      console.error('CRITICAL: LEAD_INTAKE_SECRET is not configured.');
      return NextResponse.json({ ok: false, code: 'SERVER_ERROR' }, { status: 500 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get('x-signature');

    if (!signature) {
      return NextResponse.json({ ok: false, code: 'UNAUTHENTICATED' }, { status: 401 });
    }

    // FR-W4: HMAC (LEAD_INTAKE_SECRET) verification
    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    
    if (signature.length !== expectedSignature.length) {
      return NextResponse.json({ ok: false, code: 'UNAUTHENTICATED' }, { status: 401 });
    }
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return NextResponse.json({ ok: false, code: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // FR-W4: Honeypot check (anti-spam)
    if (payload._honey) {
      // Silently accept but drop the payload
      return NextResponse.json({ ok: true });
    }

    // Rate limit check
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    let record = rateLimitMap.get(ip);
    
    if (!record || record.resetAt < now) {
      record = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    }
    
    record.count++;
    rateLimitMap.set(ip, record);

    if (record.count > MAX_REQUESTS) {
      return NextResponse.json({ ok: false, code: 'RATE_LIMITED' }, { status: 429 });
    }

    // FR-C5: E.164 phone normalization
    const phone = normalizePhone(payload.phone);
    if (!phone || !payload.name) {
      return NextResponse.json({ 
        ok: false, 
        code: 'VALIDATION_FAILED', 
        issues: { form: 'Invalid phone format or missing name' } 
      }, { status: 422 });
    }

    // NFR-D8: Dedupe-key idempotent generation
    const unitIdStr = payload.unitId ? String(payload.unitId) : undefined;
    const dedupeKey = await generateDedupeKey('website', phone, unitIdStr, new Date());

    // Connect to DB (System bypass for webhooks)
    const client = postgres(process.env.DATABASE_URL!);
    const db = drizzle(client);

    // Idempotent Insert (FR-C26)
    await db.transaction(async (tx) => {
      const insertedLeads = await tx.insert(leads).values({
        name: payload.name,
        phone: phone,
        email: payload.email,
        source: 'website',
        triageStatus: 'new', // Lands in the triage inbox
        stage: 'new',
        dedupeKey: dedupeKey,
        timelineExpectation: payload.message ? payload.message.substring(0, 60) : undefined,
      }).onConflictDoNothing({ target: leads.dedupeKey }).returning({ id: leads.id });

      if (insertedLeads.length > 0) {
        const leadId = insertedLeads[0].id;

        // Link project/unit interest context if provided
        if (payload.projectId) {
          await tx.insert(leadInterests).values({
            leadId: leadId,
            projectId: payload.projectId,
            unitId: payload.unitId || null
          }).onConflictDoNothing();
        }

        // Stitch the visitor session, score and route. Best effort by design:
        // a failed stitch must never fail the enquiry — losing a score is a
        // nuisance, losing a lead is lost revenue.
        let stitched: Awaited<ReturnType<typeof stitchSessionToLead>> = null;
        try {
          stitched = await stitchSessionToLead(
            tx as unknown as Parameters<typeof stitchSessionToLead>[0],
            leadId,
            typeof payload.sessionId === 'string' ? payload.sessionId : null,
            geoPlaceFromRequest(request),
          );
        } catch (e) {
          console.error('Lead stitch/scoring failed (lead kept):', e);
        }

        // Client's instruction for the outbound band: raise a task in the CRM.
        // notifications.user_id is NOT NULL, so this fans out to the owners —
        // at intake there is no assigned agent yet to address it to.
        if (stitched && stitched.score >= OUTBOUND_THRESHOLD) {
          const owners = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.role, 'owner'));

          for (const owner of owners) {
            await tx.insert(notifications).values({
              userId: owner.id,
              type: 'high_intent_lead',
              title: `High-intent enquiry (${stitched.score}/100)`,
              body:
                `${payload.name} scored ${stitched.score}. Routed to ` +
                `${stitched.branch} — ${stitched.reason}. Call today.`,
              entityType: 'lead',
              entityId: leadId,
              // One per owner per lead, so a retried intake cannot spam them.
              dedupeKey: `high_intent_${leadId}_${owner.id}`,
            }).onConflictDoNothing();
          }
        }

        // Owner notification stub (T85 will implement full fan-out)
        console.log(`[STUB: NOTIFY OWNER] New website enquiry received from ${payload.name} (${phone}). Triage Inbox updated.`);
      }
    });

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error('Enquiry intake error:', err);
    return NextResponse.json({ ok: false, code: 'PERSIST_FAILED' }, { status: 500 });
  }
}
