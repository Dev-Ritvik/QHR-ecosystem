import { NextRequest, NextResponse } from 'next/server';
import { systemQuery } from '@/server/db';
import { notifications } from '@estate/db';
import { sql } from 'drizzle-orm';

// notifications_dedupe_uq is a partial index; the predicate is required for
// Postgres to resolve the conflict target
const DEDUPE_CONFLICT = {
  target: notifications.dedupeKey,
  where: sql`dedupe_key IS NOT NULL`
};

/**
 * T85 Cron: Daily sweep for upcoming time-based events (visits, follow-ups, documents).
 */
export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await systemQuery(async (tx) => {
      // 1. Visit tomorrow
      const visits = await tx.execute(sql`
        SELECT id, agent_id FROM core.site_visits
        WHERE status = 'scheduled'
        AND scheduled_at::date = (now() + interval '1 day')::date
      `);

      for (const v of visits as any[]) {
        await tx.insert(notifications).values({
          userId: v.agent_id,
          type: 'visit_tomorrow',
          title: 'Site Visit Tomorrow',
          body: 'You have a site visit scheduled for tomorrow.',
          entityType: 'visit',
          entityId: v.id,
          dedupeKey: `visit_tomorrow_${v.id}`
        }).onConflictDoNothing(DEDUPE_CONFLICT);
      }

      // 2. Follow-up due today/tomorrow
      const followUps = await tx.execute(sql`
        SELECT id, assigned_agent_id, name FROM core.leads
        WHERE archived_at IS NULL
        AND next_follow_up_at::date BETWEEN now()::date AND (now() + interval '1 day')::date
        AND assigned_agent_id IS NOT NULL
      `);

      for (const l of followUps as any[]) {
        await tx.insert(notifications).values({
          userId: l.assigned_agent_id,
          type: 'follow_up_due',
          title: 'Follow-up Due',
          body: `Follow-up is due for lead: ${l.name}.`,
          entityType: 'lead',
          entityId: l.id,
          dedupeKey: `follow_up_due_${l.id}_${new Date().toISOString().split('T')[0]}` // Daily dedupe
        }).onConflictDoNothing(DEDUPE_CONFLICT);
      }

      // 3. Document expiring (Next 30 days)
      const docs = await tx.execute(sql`
        SELECT d.id, d.title, d.uploaded_by_id, p.created_by_id as project_owner
        FROM core.documents d
        LEFT JOIN core.projects p ON d.project_id = p.id
        WHERE d.status = 'on_file'
        AND d.expiry_date BETWEEN now()::date AND (now() + interval '30 days')::date
      `);

      for (const d of docs as any[]) {
        const targetUser = d.uploaded_by_id || d.project_owner;
        if (targetUser) {
          await tx.insert(notifications).values({
            userId: targetUser,
            type: 'document_expiring',
            title: 'Document Expiring',
            body: `Document "${d.title}" is expiring within 30 days.`,
            entityType: 'document',
            entityId: d.id,
            dedupeKey: `doc_expiring_30d_${d.id}`
          }).onConflictDoNothing(DEDUPE_CONFLICT);
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Daily notifications cron failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
