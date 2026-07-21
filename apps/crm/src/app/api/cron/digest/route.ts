import { NextRequest, NextResponse } from 'next/server';
import { systemQuery } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * T86 Cron: Compiles daily notifications into an email digest via Resend.
 * Injects `wa.me` deep links for leads to facilitate instant action without API costs.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.EMAIL_API_KEY || !process.env.EMAIL_FROM) {
    console.warn('Digest Cron skipped: EMAIL_API_KEY or EMAIL_FROM not configured.');
    return NextResponse.json({ error: 'Email configuration missing' }, { status: 500 });
  }

  try {
    // 1. Identify active users who opted into the email digest and have an email address
    const optedInUsers = await systemQuery(async (tx) => tx.execute(sql`
      SELECT u.id, u.name, u.email
      FROM core.users u
      JOIN core.user_settings s ON u.id = s.user_id
      WHERE s.email_digest = true AND u.email IS NOT NULL AND u.deactivated_at IS NULL
    `));

    if (optedInUsers.length === 0) {
      return NextResponse.json({ ok: true, message: 'No eligible users for digest' });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.example.com';

    for (const user of optedInUsers as any[]) {
      // 2. Fetch user's notifications generated in the last 24 hours, plus the
      // leads referenced by them (for wa.me links). Queried inside one
      // system transaction; email dispatch stays outside it.
      const { notifs, leadsMap } = await systemQuery(async (tx) => {
        const notifs = await tx.execute(sql`
          SELECT id, title, body, entity_type, entity_id, created_at
          FROM core.notifications
          WHERE user_id = ${user.id}
          AND created_at > now() - interval '1 day'
          ORDER BY created_at DESC
        `);

        // 3. Batch fetch leads associated with these notifications to construct wa.me links
        const leadIds = (notifs as any[]).filter(n => n.entity_type === 'lead').map(n => n.entity_id).filter(Boolean);
        const leadsMap = new Map();

        if (leadIds.length > 0) {
          const leads = await tx.execute(sql`
            SELECT id, name, phone FROM core.leads WHERE id = ANY(${leadIds})
          `);
          (leads as any[]).forEach((l: any) => leadsMap.set(l.id, l));
        }

        return { notifs, leadsMap };
      });

      if (notifs.length === 0) continue;

      // 4. Construct Email Digest HTML
      let html = `<div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333;">`;
      html += `<h2 style="color: #111;">Hello ${user.name},</h2>`;
      html += `<p>Here is your daily CRM activity digest summary (${notifs.length} new events):</p>`;
      html += `<ul style="list-style-type: none; padding: 0;">`;

      for (const n of notifs as any[]) {
        html += `<li style="padding: 16px; margin-bottom: 12px; border: 1px solid #eaeaea; border-radius: 8px;">`;
        html += `<strong style="display: block; margin-bottom: 6px; color: #111;">${n.title}</strong>`;
        html += `<span style="color: #555; font-size: 14px;">${n.body}</span>`;

        // Inject WhatsApp deep link if the notification pertains to a lead
        if (n.entity_type === 'lead' && leadsMap.has(n.entity_id)) {
          const lead = leadsMap.get(n.entity_id);
          // Strip the + from E.164 for wa.me API format (e.g. +919876543210 -> 919876543210)
          const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
          const waLink = `https://wa.me/${cleanPhone}?text=Hi%20${encodeURIComponent(lead.name)},%20`;

          html += `<div style="margin-top: 14px;">
            <a href="${waLink}" style="display: inline-block; background-color: #25D366; color: white; padding: 8px 14px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold;">
              Message on WhatsApp
            </a>
            <a href="${appUrl}/leads/${n.entity_id}" style="display: inline-block; color: #0066cc; margin-left: 16px; font-size: 13px; text-decoration: none; font-weight: 500;">
              View Lead &rarr;
            </a>
          </div>`;
        } else if (n.entity_id && n.entity_type) {
          // Generic link for non-lead entities
          let href = `${appUrl}/dashboard`;
          if (n.entity_type === 'visit') href = `${appUrl}/visits`;
          else if (n.entity_type === 'document') href = `${appUrl}/dashboard`; // Owner dashboard expiries

          html += `<div style="margin-top: 10px;">
            <a href="${href}" style="color: #0066cc; font-size: 13px; text-decoration: none; font-weight: 500;">View Details &rarr;</a>
          </div>`;
        }

        html += `</li>`;
      }

      html += `</ul>`;
      html += `<hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0 20px 0;" />`;
      html += `<p style="color: #888; font-size: 12px;">You are receiving this because your Email Digest preference is enabled. You can update this in your <a href="${appUrl}/profile" style="color: #0066cc;">Profile Settings</a>.</p>`;
      html += `</div>`;

      // 5. Dispatch via Resend API
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.EMAIL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: user.email,
            subject: 'Your Daily CRM Digest & Actions',
            html: html
          })
        });
      } catch (e) {
        console.error(`Failed to send digest to ${user.email}:`, e);
      }
    }

    return NextResponse.json({ ok: true, message: `Dispatched to ${optedInUsers.length} users` });
  } catch (err: any) {
    console.error('Digest cron failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
