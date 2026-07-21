/**
 * Regression test for the RERA readiness check: a commercial/luxury project
 * whose Approval Authority is RERA with a filled Approval Number must pass
 * the approval item even when the dedicated rera_number column is empty
 * (the form historically had no input for it).
 */
import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from 'dotenv';
import path from 'path';

import { coreSchema } from '@estate/db';
import { checkPublishReadiness } from './publish';

config({ path: path.resolve(__dirname, '../../../../packages/db/.env') });

const crmConn = process.env.DATABASE_URL_CRM;
if (!crmConn) throw new Error('Requires DATABASE_URL_CRM in packages/db/.env');

const client = postgres(crmConn, { ssl: 'require', max: 1, prepare: false });
const db = drizzle(client, { schema: coreSchema });

// The Azure Residences (live): luxury_residential, approval_authority='rera',
// approval_number='AP-RERA-2026-00452', rera_number='' — the exact repro row.
const AZURE_ID = 'fae05fea-a561-493a-b2ce-cdd49adcf810';

afterAll(async () => {
  await client.end();
});

describe('checkPublishReadiness — RERA via approval fields', () => {
  it('does not flag RERA for a rera-authority project with an approval number', async () => {
    // set_config so RLS policies see an owner context on this crm_app conn
    await client`SELECT set_config('app.role', 'owner', false)`;
    const { checklist } = await checkPublishReadiness(db as any, AZURE_ID);
    console.log('approval item:', JSON.stringify(checklist.approval));
    console.log('full checklist:', JSON.stringify(checklist));
    expect(checklist.approval).toBeNull();
  });
});
