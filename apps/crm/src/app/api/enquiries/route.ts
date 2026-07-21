import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { leads, leadInterests } from '@estate/db';
import { generateDedupeKey, normalizePhone } from '@estate/domain/leads/dedupe';

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
