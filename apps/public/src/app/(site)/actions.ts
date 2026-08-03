// apps/public/src/app/(site)/actions.ts
"use server";

import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/consent/types';

import { z } from 'zod';
import crypto from 'crypto';

// Stricter than DB: regex for E.164, honeypot required to be empty
const EnquirySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  phone: z
    .string()
    .regex(
      /^\+[1-9][0-9]{7,14}$/,
      'Must be a valid phone number with country code (e.g., +919876543210)'
    ),
  preferredTime: z.enum(['morning', 'afternoon', 'evening', 'any']).optional(),
  message: z.string().optional(),
  honeypot: z.string().max(0, 'Invalid submission'),
  projectId: z.string().uuid(),
  unitId: z.string().uuid().optional(),
});

export type EnquiryActionState =
  | { ok: true }
  | {
      ok: false;
      code: 'VALIDATION_FAILED' | 'PERSIST_FAILED';
      message?: string;
      issues?: Record<string, string[]>;
    };

export async function submitEnquiry(
  data: z.infer<typeof EnquirySchema>
): Promise<EnquiryActionState> {
  const parsed = EnquirySchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  // Silent success for honeypot failures to drop bots
  if (parsed.data.honeypot.length > 0) {
    return { ok: true };
  }

  // Attach the session so the CRM can stitch this enquiry to the visitor's
  // consented spatial history and score it. Read from the HttpOnly cookie
  // server-side, never from the form: a session id in a submitted body would be
  // an identity the caller chose for themselves.
  const sessionId = cookies().get(SESSION_COOKIE)?.value ?? null;

  const payload = {
    source: 'website',
    sessionId,
    name: parsed.data.name,
    phone: parsed.data.phone,
    preferredTime: parsed.data.preferredTime,
    message: parsed.data.message,
    projectId: parsed.data.projectId,
    unitId: parsed.data.unitId,
  };

  const secret = process.env.LEAD_INTAKE_SECRET;
  const url = process.env.LEAD_INTAKE_URL;

  if (!secret || !url) {
    console.error('Missing LEAD_INTAKE_SECRET or LEAD_INTAKE_URL');
    return { ok: false, code: 'PERSIST_FAILED', message: 'Internal configuration error.' };
  }

  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature,
      },
      body: payloadStr,
    });

    if (!res.ok) {
      console.error(`CRM rejected enquiry: HTTP ${res.status}`);
      return {
        ok: false,
        code: 'PERSIST_FAILED',
        message: 'Failed to submit enquiry. Please try again or contact us directly.',
      };
    }

    return { ok: true };
  } catch (err) {
    console.error('Enquiry fetch error:', err);
    return {
      ok: false,
      code: 'PERSIST_FAILED',
      message: 'Network error. Please try again or contact us directly.',
    };
  }
}
