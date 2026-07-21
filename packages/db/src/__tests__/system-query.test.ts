import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from 'dotenv';

import { createAuthedCoreAccess } from '../client-core';
import { leads } from '../schema/core/leads';
import { notifications } from '../schema/core/notifications';

config();

const suConn = process.env.DATABASE_URL_MIGRATIONS;
const crmConn = process.env.DATABASE_URL_CRM;
if (!suConn || !crmConn) {
  throw new Error(
    'Integration tests require DATABASE_URL_MIGRATIONS (superuser) and ' +
      'DATABASE_URL_CRM (crm_app role) in packages/db/.env',
  );
}

const suSql = postgres(suConn, { prepare: false });
const suDb = drizzle(suSql);
const dbAccess = createAuthedCoreAccess(crmConn);

// Fixture IDs distinct from other test files (files run concurrently).
const AGENT_ID = '20000000-0000-4000-a000-000000000001';
const LEAD_ASSIGNED_ID = '20000000-0000-4000-b000-000000000001';
const LEAD_UNASSIGNED_ID = '20000000-0000-4000-b000-000000000002';

const cleanup = async () => {
  await suDb.execute(
    sql`DELETE FROM core.leads WHERE id IN (${LEAD_ASSIGNED_ID}::uuid, ${LEAD_UNASSIGNED_ID}::uuid)`,
  );
  await suDb.execute(sql`DELETE FROM core.users WHERE id = ${AGENT_ID}::uuid`);
};

beforeAll(async () => {
  await cleanup();
  await suDb.execute(sql`
    INSERT INTO core.users (id, name, phone, role) VALUES
      (${AGENT_ID}::uuid, 'SysQuery Agent', '+919900010001', 'agent')
  `);
  await suDb.execute(sql`
    INSERT INTO core.leads (id, name, phone, source, assigned_agent_id) VALUES
      (${LEAD_ASSIGNED_ID}::uuid,   'SysQuery Lead 1', '+919900011001', 'walk_in', ${AGENT_ID}::uuid),
      (${LEAD_UNASSIGNED_ID}::uuid, 'SysQuery Lead 2', '+919900011002', 'walk_in', NULL)
  `);
});

afterAll(async () => {
  await cleanup();
  await suSql.end();
});

describe('systemQuery RLS context', () => {
  it('sees all rows in policy-scoped tables (owner context, not fail-closed)', async () => {
    const rows = await dbAccess.systemQuery(async (tx) => {
      return tx
        .select({ id: leads.id })
        .from(leads)
        .where(sql`${leads.id} IN (${LEAD_ASSIGNED_ID}::uuid, ${LEAD_UNASSIGNED_ID}::uuid)`);
    });

    // Before the fix, systemQuery set no context at all: leads_agent_scoping
    // failed closed and this returned zero rows.
    expect(rows).toHaveLength(2);
  });

  it('inserts notifications idempotently via the cron dedupe pattern', async () => {
    const DEDUPE_KEY = `sysq_test_${AGENT_ID}`;
    const conflict = {
      target: notifications.dedupeKey,
      // notifications_dedupe_uq is a partial index; the predicate is required
      // for Postgres to resolve the conflict target (bare target → 42P10)
      where: sql`dedupe_key IS NOT NULL`,
    };

    const rows = await dbAccess.systemQuery(async (tx) => {
      await tx
        .insert(notifications)
        .values({ userId: AGENT_ID, type: 'follow_up_due', title: 'SysQuery n1', body: 'b1', dedupeKey: DEDUPE_KEY })
        .onConflictDoNothing(conflict);
      await tx
        .insert(notifications)
        .values({ userId: AGENT_ID, type: 'follow_up_due', title: 'SysQuery n2', body: 'b2', dedupeKey: DEDUPE_KEY })
        .onConflictDoNothing(conflict);
      return tx
        .select({ title: notifications.title })
        .from(notifications)
        .where(sql`${notifications.dedupeKey} = ${DEDUPE_KEY}`);
    });

    // Second insert deduped, first one kept. (Rows are removed by cleanup via
    // the users ON DELETE cascade.)
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('SysQuery n1');
  });

  it('control: the same connection with no context returns zero rows', async () => {
    const rawSql = postgres(crmConn, { prepare: false });
    const rawDb = drizzle(rawSql, { schema: { leads } });
    const rows = await rawDb
      .select({ id: leads.id })
      .from(leads)
      .where(sql`${leads.id} IN (${LEAD_ASSIGNED_ID}::uuid, ${LEAD_UNASSIGNED_ID}::uuid)`);
    expect(rows).toHaveLength(0);
    await rawSql.end();
  });
});
