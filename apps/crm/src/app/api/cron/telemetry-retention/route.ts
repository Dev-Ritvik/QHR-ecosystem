import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

/**
 * Telemetry retention. Spec §11.
 *
 * Three jobs, run monthly:
 *
 *   1. Keep partitions ahead of time. session_events is partitioned by month,
 *      and an unattended deployment that runs out of partitions starts
 *      REJECTING inserts. This is the failure that silently loses a month of
 *      the highest-value data in the system, so it runs first.
 *
 *   2. Drop raw events older than 13 months, by detaching and dropping whole
 *      partitions rather than deleting rows — a mass DELETE on what will be the
 *      largest table here would bloat it and hold locks for a long time.
 *
 *   3. Delete unstitched sessions older than 90 days. A session that never led
 *      to a form is an anonymous person's browsing history and there is no
 *      reason to keep it once it can no longer be attached to anything.
 *      Stitched sessions follow their lead's retention instead.
 *
 * Deliberately idempotent: running it twice does nothing the second time.
 */

export const runtime = 'nodejs';

const RAW_RETENTION_MONTHS = 13;
const UNSTITCHED_RETENTION_DAYS = 90;

export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Superuser connection: partition DDL is beyond what crm_app is granted, and
  // deliberately so.
  const url = process.env.DATABASE_URL_MIGRATIONS || process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: 'No database URL configured' }, { status: 500 });
  }
  const client = postgres(url);
  const db = drizzle(client);

  try {
    // 1. Partitions ahead
    const [made] = await db.execute(
      sql`SELECT core.ensure_session_event_partitions(3) AS created`,
    );
    const created = Number((made as { created?: number } | undefined)?.created ?? 0);

    // 2. Drop expired partitions. Named session_events_YYYYMM, so the cutoff is
    //    a string comparison on the suffix rather than a catalogue join.
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - RAW_RETENTION_MONTHS);
    const cutoffName = `session_events_${cutoff.getFullYear()}${String(
      cutoff.getMonth() + 1,
    ).padStart(2, '0')}`;

    const parts = await db.execute(sql`
      SELECT c.relname AS name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'core'
        AND c.relname LIKE 'session_events_%'
        AND c.relkind = 'r'
      ORDER BY c.relname
    `);

    const dropped: string[] = [];
    for (const row of parts as unknown as { name: string }[]) {
      if (row.name >= cutoffName) continue;
      await db.execute(
        sql`ALTER TABLE core.session_events DETACH PARTITION core.${sql.raw(row.name)}`,
      );
      await db.execute(sql`DROP TABLE core.${sql.raw(row.name)}`);
      dropped.push(row.name);
    }

    // 3. Unstitched sessions past 90 days
    const purged = await db.execute(sql`
      DELETE FROM core.visitor_sessions
      WHERE lead_id IS NULL
        AND last_seen_at < now() - ${`${UNSTITCHED_RETENTION_DAYS} days`}::interval
      RETURNING id
    `);

    return NextResponse.json({
      ok: true,
      partitionsCreated: created,
      partitionsDropped: dropped,
      unstitchedSessionsPurged: Array.isArray(purged) ? purged.length : 0,
    });
  } catch (err) {
    console.error('Telemetry retention failed:', err);
    return NextResponse.json({ error: 'Retention job failed' }, { status: 500 });
  } finally {
    await client.end();
  }
}
