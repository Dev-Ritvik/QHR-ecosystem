import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from 'dotenv';

import { createAuthedCoreAccess } from '../client-core';
import type { AppSession } from '../client-core';
import { leads } from '../schema/core/leads';

config();

const suConn = process.env.DATABASE_URL_MIGRATIONS;
const crmConn = process.env.DATABASE_URL_CRM;
if (!suConn || !crmConn) {
  throw new Error(
    'Integration tests require DATABASE_URL_MIGRATIONS (superuser) and ' +
      'DATABASE_URL_CRM (crm_app role) in packages/db/.env',
  );
}

// Superuser client — for seeding and cleanup (bypasses RLS automatically)
const suSql = postgres(suConn, { prepare: false });
const suDb = drizzle(suSql);

// crm_app-role client — subject to RLS, context set via authedQuery (set_config
// of app.role / app.user_id), exactly the mechanism rls.sql policies check.
const dbAccess = createAuthedCoreAccess(crmConn);

// Fixture IDs deliberately distinct from rls-context.test.ts (test files run
// concurrently against the same database).
const OWNER_ID = '10000000-0000-4000-a000-000000000001';
const AGENT_A_ID = '10000000-0000-4000-a000-000000000002';
const AGENT_B_ID = '10000000-0000-4000-a000-000000000003';

const LEAD_A1_ID = '10000000-0000-4000-b000-000000000001'; // assigned to Agent A
const LEAD_A2_ID = '10000000-0000-4000-b000-000000000002'; // assigned to Agent A
const LEAD_B1_ID = '10000000-0000-4000-b000-000000000003'; // assigned to Agent B
const LEAD_UNASSIGNED_ID = '10000000-0000-4000-b000-000000000004'; // no agent

const ALL_LEAD_IDS = sql`${LEAD_A1_ID}::uuid, ${LEAD_A2_ID}::uuid, ${LEAD_B1_ID}::uuid, ${LEAD_UNASSIGNED_ID}::uuid`;

const cleanup = async () => {
  await suDb.execute(sql`DELETE FROM core.leads WHERE id IN (${ALL_LEAD_IDS})`);
  await suDb.execute(
    sql`DELETE FROM core.users WHERE id IN (${OWNER_ID}::uuid, ${AGENT_A_ID}::uuid, ${AGENT_B_ID}::uuid)`,
  );
};

beforeAll(async () => {
  await cleanup();
  await suDb.execute(sql`
    INSERT INTO core.users (id, name, phone, role) VALUES
      (${OWNER_ID}::uuid,   'Backstop Owner',   '+919900000001', 'owner'),
      (${AGENT_A_ID}::uuid, 'Backstop Agent A', '+919900000002', 'agent'),
      (${AGENT_B_ID}::uuid, 'Backstop Agent B', '+919900000003', 'agent')
  `);
  await suDb.execute(sql`
    INSERT INTO core.leads (id, name, phone, source, assigned_agent_id) VALUES
      (${LEAD_A1_ID}::uuid,         'Backstop Lead A1', '+919900001001', 'walk_in', ${AGENT_A_ID}::uuid),
      (${LEAD_A2_ID}::uuid,         'Backstop Lead A2', '+919900001002', 'walk_in', ${AGENT_A_ID}::uuid),
      (${LEAD_B1_ID}::uuid,         'Backstop Lead B1', '+919900001003', 'walk_in', ${AGENT_B_ID}::uuid),
      (${LEAD_UNASSIGNED_ID}::uuid, 'Backstop Lead U',  '+919900001004', 'walk_in', NULL)
  `);
});

afterAll(async () => {
  await cleanup();
  await suSql.end();
});

describe('RLS Backstop Integration: core.leads', () => {
  it('prevents agent from reading unassigned leads or leads assigned to others (NFR-S3)', async () => {
    const session: AppSession = { role: 'agent', userId: AGENT_A_ID };

    const rows = await dbAccess.authedQuery(session, async (tx) => {
      return tx
        .select({ id: leads.id, assignedAgentId: leads.assignedAgentId })
        .from(leads)
        .where(sql`${leads.id} IN (${ALL_LEAD_IDS})`);
    });

    // The DB forcibly filters any rows out of this agent's purview:
    // Agent B's lead and the unassigned lead must be invisible.
    expect(rows).toHaveLength(2);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(LEAD_A1_ID);
    expect(ids).toContain(LEAD_A2_ID);
    expect(ids).not.toContain(LEAD_B1_ID);
    expect(ids).not.toContain(LEAD_UNASSIGNED_ID);
    for (const row of rows) {
      expect(row.assignedAgentId).toBe(AGENT_A_ID);
    }
  });

  it('allows owner to read all leads', async () => {
    const session: AppSession = { role: 'owner', userId: OWNER_ID };

    const rows = await dbAccess.authedQuery(session, async (tx) => {
      return tx
        .select({ id: leads.id })
        .from(leads)
        .where(sql`${leads.id} IN (${ALL_LEAD_IDS})`);
    });

    // True policy permits the owner to observe all lead records (assigned or otherwise)
    expect(rows).toHaveLength(4);
  });
});
