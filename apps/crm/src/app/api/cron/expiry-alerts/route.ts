// apps/crm/src/app/api/cron/expiry-alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { systemQuery } from '@/server/db';
import { users, notifications } from '@estate/db';
import { sql } from 'drizzle-orm';

/**
 * T87 Cron: Sweeps for EC/documents that are approaching expiry or have expired.
 * Notifies office owners. Uses CRON_SECRET for auth and pings a Better Stack heartbeat.
 * Maps to FR-C15, FR-C23, NFR-R2.
 */
export async function GET(req: NextRequest) {
  // Validate Vercel Cron Secret
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await systemQuery(async (tx) => {
      // FR-C15: "expiry alerts to owner" — fetch all active owners in the office
      const owners = await tx.select({ id: users.id })
        .from(users)
        .where(
          sql`${users.role} = 'owner' AND ${users.deactivatedAt} IS NULL`
        );

      if (owners.length === 0) return;

      // Find all on-file documents expiring within 30 days, or that just expired recently (up to 1 day ago)
      const docs = await tx.execute(sql`
        SELECT d.id, d.title, d.expiry_date,
               EXTRACT(DAY FROM (d.expiry_date::timestamp - now()::timestamp)) as days_left
        FROM core.documents d
        WHERE d.status = 'on_file'
        AND d.expiry_date IS NOT NULL
        AND d.archived_at IS NULL
        AND d.expiry_date <= (now() + interval '30 days')::date
        AND d.expiry_date >= (now() - interval '1 day')::date
      `);

      const notifsToInsert = [];

      for (const d of docs as any[]) {
        const daysLeft = Number(d.days_left);
        let dedupeSuffix = '';
        let title = '';
        let body = '';

        // Determine escalation level for the alert
        if (daysLeft <= 0) {
          dedupeSuffix = 'expired';
          title = 'Document Expired';
          body = `The document "${d.title}" has officially expired. Action is required.`;
        } else if (daysLeft <= 7) {
          dedupeSuffix = '7d';
          title = 'Document Expiring Soon';
          body = `The document "${d.title}" will expire in ${daysLeft} days.`;
        } else {
          dedupeSuffix = '30d';
          title = 'Document Expiring (30 Days)';
          body = `The document "${d.title}" will expire in ${daysLeft} days.`;
        }

        // Fan out the notification to all owners
        for (const owner of owners) {
          notifsToInsert.push({
            userId: owner.id,
            type: 'document_expiring' as const,
            title,
            body,
            entityType: 'document',
            entityId: d.id,
            dedupeKey: `doc_exp_${d.id}_${dedupeSuffix}_${owner.id}`
          });
        }
      }

      if (notifsToInsert.length > 0) {
        // NFR-D8: Ensure idempotency via dedupeKey; avoid spamming the same alert
        await tx.insert(notifications)
          .values(notifsToInsert)
          .onConflictDoNothing({
            target: notifications.dedupeKey,
            // notifications_dedupe_uq is a partial index; the predicate is
            // required for Postgres to resolve the conflict target
            where: sql`dedupe_key IS NOT NULL`
          });
      }
    });

    // NFR-R2: Ping heartbeat to ensure cron health is monitored
    if (process.env.BETTERSTACK_HEARTBEAT_EXPIRY_ALERTS) {
      await fetch(process.env.BETTERSTACK_HEARTBEAT_EXPIRY_ALERTS);
    }

    return NextResponse.json({ ok: true, message: 'Expiry sweep complete' });
  } catch (err: any) {
    console.error('Document expiry cron failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
