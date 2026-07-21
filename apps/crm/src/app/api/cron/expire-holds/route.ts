import { NextRequest, NextResponse } from 'next/server';
import { systemQuery } from '@/server/db';
import { holds, unitStatusEvents, notifications } from '@estate/db';
import { and, lt, eq, sql } from 'drizzle-orm';

/**
 * T30/T85 Cron: Sweeps expired holds back to 'available' AND handles 48h/6h notification fan-outs.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await systemQuery(async (tx) => {
      // 1. Revert expired active holds
      const expiredHolds = await tx.select().from(holds).where(
        and(eq(holds.status, 'active'), lt(holds.expiresAt, new Date()))
      );

      for (const hold of expiredHolds) {
        await tx.update(holds)
          .set({ status: 'expired', releasedAt: new Date() })
          .where(eq(holds.id, hold.id));

        await tx.insert(unitStatusEvents).values({
          unitId: hold.unitId,
          fromStatus: 'on_hold',
          toStatus: 'available',
          reason: 'Hold expired automatically',
          holdId: hold.id,
          actorId: null // System
        });

        // Notify agent that hold completely expired
        await tx.insert(notifications).values({
          userId: hold.createdById,
          type: 'hold_expiring',
          title: 'Hold Expired',
          body: `An active hold has expired automatically.`,
          entityType: 'hold',
          entityId: hold.id,
          dedupeKey: `hold_expired_${hold.id}`
        }).onConflictDoNothing({
          target: notifications.dedupeKey,
          // notifications_dedupe_uq is a partial index; the predicate is
          // required for Postgres to resolve the conflict target
          where: sql`dedupe_key IS NOT NULL`
        });
      }

      // 2. 48h early warnings (FR-C23)
      const holds48h = await tx.execute(sql`
        SELECT id, created_by_id FROM core.holds
        WHERE status = 'active'
        AND expires_at BETWEEN now() AND now() + interval '48 hours'
      `);
      for (const h of holds48h as any[]) {
        await tx.insert(notifications).values({
          userId: h.created_by_id,
          type: 'hold_expiring',
          title: 'Hold Expiring Soon',
          body: 'A hold is expiring within 48 hours.',
          entityType: 'hold',
          entityId: h.id,
          dedupeKey: `hold_48h_${h.id}`
        }).onConflictDoNothing({
          target: notifications.dedupeKey,
          where: sql`dedupe_key IS NOT NULL`
        });
      }

      // 3. 6h critical warnings (FR-C23)
      const holds6h = await tx.execute(sql`
        SELECT id, created_by_id FROM core.holds
        WHERE status = 'active'
        AND expires_at BETWEEN now() AND now() + interval '6 hours'
      `);
      for (const h of holds6h as any[]) {
        await tx.insert(notifications).values({
          userId: h.created_by_id,
          type: 'hold_expiring',
          title: 'Hold Expiring Very Soon',
          body: 'A hold is expiring within 6 hours. Action required.',
          entityType: 'hold',
          entityId: h.id,
          dedupeKey: `hold_6h_${h.id}`
        }).onConflictDoNothing({
          target: notifications.dedupeKey,
          where: sql`dedupe_key IS NOT NULL`
        });
      }
    });

    if (process.env.BETTERSTACK_HEARTBEAT_HOLD_EXPIRY) {
      await fetch(process.env.BETTERSTACK_HEARTBEAT_HOLD_EXPIRY);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Hold expiry + notification cron failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
