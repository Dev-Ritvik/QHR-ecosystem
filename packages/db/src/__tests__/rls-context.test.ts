// packages/db/src/__tests__/rls-context.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

import { createAuthedCoreAccess } from '../client-core';
import type { AppSession } from '../client-core';
import { leads } from '../schema/core/leads';
import { users } from '../schema/core/auth';
import { holds } from '../schema/core/holds';
import { bookings } from '../schema/core/bookings';
import { siteVisits, siteVisitLeads } from '../schema/core/site-visits';
import { paymentLedger } from '../schema/core/payment-ledger';
import { documents } from '../schema/core/documents';
import { clients } from '../schema/core/clients';
import { projects } from '../schema/core/projects';
import { units } from '../schema/core/units';

// Load .env from packages/db/
config();

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

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

// crm_app-role client — subject to RLS
const dbAccess = createAuthedCoreAccess(crmConn);

// ---------------------------------------------------------------------------
// Test fixture IDs (deterministic UUIDs so cleanup is reliable)
// ---------------------------------------------------------------------------

const OWNER_ID = '00000000-0000-4000-a000-000000000001';
const AGENT_A_ID = '00000000-0000-4000-a000-000000000002';
const AGENT_B_ID = '00000000-0000-4000-a000-000000000003';

const LEAD_1_ID = '00000000-0000-4000-b000-000000000001'; // assigned to Agent A
const LEAD_2_ID = '00000000-0000-4000-b000-000000000002'; // assigned to Agent A
const LEAD_3_ID = '00000000-0000-4000-b000-000000000003'; // assigned to Agent B

const CLIENT_1_ID = '00000000-0000-4000-c000-000000000001';
const CLIENT_2_ID = '00000000-0000-4000-c000-000000000002';
const PROJECT_1_ID = '00000000-0000-4000-9000-000000000001';
const UNIT_1_ID = '00000000-0000-4000-e000-000000000001';
const UNIT_2_ID = '00000000-0000-4000-e000-000000000002';
const UNIT_3_ID = '00000000-0000-4000-e000-000000000003';
const BOOKING_1_ID = '00000000-0000-4000-f000-000000000001';
const BOOKING_2_ID = '00000000-0000-4000-f000-000000000002';
const HOLD_1_ID = '00000000-0000-4000-7000-000000000001';
const HOLD_2_ID = '00000000-0000-4000-7000-000000000002';
const VISIT_1_ID = '00000000-0000-4000-8000-000000000001';
const VISIT_2_ID = '00000000-0000-4000-8000-000000000002';
const DOC_PROJECT_ID = '00000000-0000-4000-d000-000000000001';
const DOC_UNIT_ID = '00000000-0000-4000-d000-000000000002';
const DOC_BOOKING_A_ID = '00000000-0000-4000-d000-000000000003';
const DOC_BOOKING_B_ID = '00000000-0000-4000-d000-000000000004';
const DOC_CLIENT_A_ID = '00000000-0000-4000-d000-000000000005';

// ---------------------------------------------------------------------------
// Seed & Cleanup
// ---------------------------------------------------------------------------

const cleanup = async () => {
  await suDb.execute(sql`DELETE FROM core.documents WHERE id IN (${DOC_PROJECT_ID}::uuid, ${DOC_UNIT_ID}::uuid, ${DOC_BOOKING_A_ID}::uuid, ${DOC_BOOKING_B_ID}::uuid, ${DOC_CLIENT_A_ID}::uuid)`);
  await suDb.execute(sql`DELETE FROM core.payment_ledger WHERE booking_id IN (${BOOKING_1_ID}::uuid, ${BOOKING_2_ID}::uuid)`);
  await suDb.execute(sql`DELETE FROM core.site_visit_leads WHERE visit_id IN (${VISIT_1_ID}::uuid, ${VISIT_2_ID}::uuid)`);
  await suDb.execute(sql`DELETE FROM core.site_visits WHERE id IN (${VISIT_1_ID}::uuid, ${VISIT_2_ID}::uuid)`);
  await suDb.execute(sql`DELETE FROM core.holds WHERE id IN (${HOLD_1_ID}::uuid, ${HOLD_2_ID}::uuid)`);
  await suDb.execute(sql`DELETE FROM core.bookings WHERE id IN (${BOOKING_1_ID}::uuid, ${BOOKING_2_ID}::uuid)`);
  await suDb.execute(sql`DELETE FROM core.units WHERE id IN (${UNIT_1_ID}::uuid, ${UNIT_2_ID}::uuid, ${UNIT_3_ID}::uuid)`);
  await suDb.execute(sql`DELETE FROM core.projects WHERE id IN (${PROJECT_1_ID}::uuid)`);
  await suDb.execute(sql`DELETE FROM core.leads WHERE id IN (${LEAD_1_ID}::uuid, ${LEAD_2_ID}::uuid, ${LEAD_3_ID}::uuid)`);
  await suDb.execute(sql`DELETE FROM core.clients WHERE id IN (${CLIENT_1_ID}::uuid, ${CLIENT_2_ID}::uuid)`);
  await suDb.execute(sql`DELETE FROM core.users WHERE id IN (${OWNER_ID}::uuid, ${AGENT_A_ID}::uuid, ${AGENT_B_ID}::uuid)`);
};

beforeAll(async () => {
  await cleanup();

  // 1. Users
  await suDb.execute(sql`
    INSERT INTO core.users (id, name, phone, role) VALUES
      (${OWNER_ID}::uuid, 'Test Owner',   '+910000000001', 'owner'),
      (${AGENT_A_ID}::uuid, 'Test Agent A', '+910000000002', 'agent'),
      (${AGENT_B_ID}::uuid, 'Test Agent B', '+910000000003', 'agent')
  `);

  // 2. Clients & Leads
  await suDb.execute(sql`
    INSERT INTO core.clients (id, name, phone, created_by_id) VALUES
      (${CLIENT_1_ID}::uuid, 'Client 1', '+910000002001', ${AGENT_A_ID}::uuid),
      (${CLIENT_2_ID}::uuid, 'Client 2', '+910000002002', ${AGENT_B_ID}::uuid)
  `);
  await suDb.execute(sql`
    INSERT INTO core.leads (id, name, phone, source, assigned_agent_id, client_id) VALUES
      (${LEAD_1_ID}::uuid, 'Lead One',   '+910000001001', 'walk_in', ${AGENT_A_ID}::uuid, ${CLIENT_1_ID}::uuid),
      (${LEAD_2_ID}::uuid, 'Lead Two',   '+910000001002', 'walk_in', ${AGENT_A_ID}::uuid, ${CLIENT_1_ID}::uuid),
      (${LEAD_3_ID}::uuid, 'Lead Three', '+910000001003', 'walk_in', ${AGENT_B_ID}::uuid, ${CLIENT_2_ID}::uuid)
  `);

  // 3. Projects & Units
  await suDb.execute(sql`
    INSERT INTO core.projects (id, slug, name, asset_class, created_by_id) VALUES
      (${PROJECT_1_ID}::uuid, 'test-project', 'Test Project', 'luxury_residential', ${OWNER_ID}::uuid)
  `);
  await suDb.execute(sql`
    INSERT INTO core.units (id, project_id, unit_number) VALUES
      (${UNIT_1_ID}::uuid, ${PROJECT_1_ID}::uuid, '101'),
      (${UNIT_2_ID}::uuid, ${PROJECT_1_ID}::uuid, '102'),
      (${UNIT_3_ID}::uuid, ${PROJECT_1_ID}::uuid, '103')
  `);

  // 4. Bookings & Holds
  await suDb.execute(sql`
    INSERT INTO core.bookings (id, unit_id, client_id, lead_id, agent_id, status, token_amount_paise, booked_on) VALUES
      (${BOOKING_1_ID}::uuid, ${UNIT_1_ID}::uuid, ${CLIENT_1_ID}::uuid, ${LEAD_1_ID}::uuid, ${AGENT_A_ID}::uuid, 'active', 100000, CURRENT_DATE),
      (${BOOKING_2_ID}::uuid, ${UNIT_2_ID}::uuid, ${CLIENT_2_ID}::uuid, ${LEAD_3_ID}::uuid, ${AGENT_B_ID}::uuid, 'active', 100000, CURRENT_DATE)
  `);
  await suDb.execute(sql`
    INSERT INTO core.holds (id, unit_id, client_id, lead_id, status, expires_at, created_by_id) VALUES
      (${HOLD_1_ID}::uuid, ${UNIT_1_ID}::uuid, ${CLIENT_1_ID}::uuid, ${LEAD_1_ID}::uuid, 'active', CURRENT_TIMESTAMP + interval '1 day', ${AGENT_A_ID}::uuid),
      (${HOLD_2_ID}::uuid, ${UNIT_2_ID}::uuid, ${CLIENT_2_ID}::uuid, ${LEAD_3_ID}::uuid, 'active', CURRENT_TIMESTAMP + interval '1 day', ${AGENT_B_ID}::uuid)
  `);

  // 5. Site Visits
  await suDb.execute(sql`
    INSERT INTO core.site_visits (id, agent_id, scheduled_at, created_by_id) VALUES
      (${VISIT_1_ID}::uuid, ${AGENT_A_ID}::uuid, CURRENT_TIMESTAMP, ${AGENT_A_ID}::uuid),
      (${VISIT_2_ID}::uuid, ${AGENT_B_ID}::uuid, CURRENT_TIMESTAMP, ${AGENT_B_ID}::uuid)
  `);
  await suDb.execute(sql`
    INSERT INTO core.site_visit_leads (visit_id, lead_id) VALUES
      (${VISIT_1_ID}::uuid, ${LEAD_1_ID}::uuid),
      (${VISIT_2_ID}::uuid, ${LEAD_3_ID}::uuid)
  `);

  // 6. Payment Ledger
  await suDb.execute(sql`
    INSERT INTO core.payment_ledger (booking_id, entry_type, amount_paise, paid_on, mode, created_by_id) VALUES
      (${BOOKING_1_ID}::uuid, 'token', 100000, CURRENT_DATE, 'bank_transfer', ${AGENT_A_ID}::uuid),
      (${BOOKING_2_ID}::uuid, 'token', 100000, CURRENT_DATE, 'bank_transfer', ${AGENT_B_ID}::uuid)
  `);

  // 7. Documents (Project, Unit, Booking for A, Booking for B, Client for A)
  await suDb.execute(sql`
    INSERT INTO core.documents (id, scope, project_id, unit_id, booking_id, client_id, checklist_key, title, status) VALUES
      (${DOC_PROJECT_ID}::uuid, 'project', ${PROJECT_1_ID}::uuid, NULL, NULL, NULL, 'proj_doc', 'Project Doc', 'missing'),
      (${DOC_UNIT_ID}::uuid, 'unit', NULL, ${UNIT_1_ID}::uuid, NULL, NULL, 'unit_doc', 'Unit Doc', 'missing'),
      (${DOC_BOOKING_A_ID}::uuid, 'booking', NULL, NULL, ${BOOKING_1_ID}::uuid, NULL, 'bk_doc_a', 'Booking Doc A', 'missing'),
      (${DOC_BOOKING_B_ID}::uuid, 'booking', NULL, NULL, ${BOOKING_2_ID}::uuid, NULL, 'bk_doc_b', 'Booking Doc B', 'missing'),
      (${DOC_CLIENT_A_ID}::uuid, 'client', NULL, NULL, NULL, ${CLIENT_1_ID}::uuid, 'client_doc_a', 'Client Doc A', 'missing')
  `);
});

afterAll(async () => {
  await cleanup();
  await suSql.end();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('withCoreContext RLS enforcement', () => {
  it('agent A sees only leads assigned to them', async () => {
    const session: AppSession = { role: 'agent', userId: AGENT_A_ID };

    const rows = await dbAccess.authedQuery(session, async (tx) => {
      return tx
        .select({ id: leads.id, name: leads.name })
        .from(leads)
        .where(
          sql`${leads.id} IN (${LEAD_1_ID}::uuid, ${LEAD_2_ID}::uuid, ${LEAD_3_ID}::uuid)`,
        );
    });

    expect(rows).toHaveLength(2);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(LEAD_1_ID);
    expect(ids).toContain(LEAD_2_ID);
    expect(ids).not.toContain(LEAD_3_ID);
  });

  it('agent B sees only leads assigned to them', async () => {
    const session: AppSession = { role: 'agent', userId: AGENT_B_ID };

    const rows = await dbAccess.authedQuery(session, async (tx) => {
      return tx
        .select({ id: leads.id, name: leads.name })
        .from(leads)
        .where(
          sql`${leads.id} IN (${LEAD_1_ID}::uuid, ${LEAD_2_ID}::uuid, ${LEAD_3_ID}::uuid)`,
        );
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(LEAD_3_ID);
  });

  it('owner sees all leads', async () => {
    const session: AppSession = { role: 'owner', userId: OWNER_ID };

    const rows = await dbAccess.authedQuery(session, async (tx) => {
      return tx
        .select({ id: leads.id, name: leads.name })
        .from(leads)
        .where(
          sql`${leads.id} IN (${LEAD_1_ID}::uuid, ${LEAD_2_ID}::uuid, ${LEAD_3_ID}::uuid)`,
        );
    });

    expect(rows).toHaveLength(3);
  });

  it('raw query without context returns zero rows (RLS default-deny)', async () => {
    // Querying directly on the crm_app connection without the authed context.
    // With RLS enabled and no session vars set, current_setting('app.role', true)
    // returns '' which doesn't match 'owner', and current_setting('app.user_id', true)
    // returns '' which casts to NULL via NULLIF — matching no assigned_agent_id.
    const rawSql = postgres(crmConn, { prepare: false });
    const rawDb = drizzle(rawSql, { schema: { leads } });

    const rows = await rawDb
      .select({ id: leads.id })
      .from(leads)
      .where(
        sql`${leads.id} IN (${LEAD_1_ID}::uuid, ${LEAD_2_ID}::uuid, ${LEAD_3_ID}::uuid)`,
      );

    expect(rows).toHaveLength(0);
    await rawSql.end();
  });

  describe('holds', () => {
    it('agent A sees only holds for their assigned leads', async () => {
      const session: AppSession = { role: 'agent', userId: AGENT_A_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ id: holds.id }).from(holds);
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(HOLD_1_ID);
    });

    it('agent B sees only holds for their assigned leads', async () => {
      const session: AppSession = { role: 'agent', userId: AGENT_B_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ id: holds.id }).from(holds);
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(HOLD_2_ID);
    });

    it('owner sees all holds', async () => {
      const session: AppSession = { role: 'owner', userId: OWNER_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ id: holds.id }).from(holds);
      });
      expect(rows).toHaveLength(2);
    });

    it('raw query without context returns zero holds', async () => {
      const rawSql = postgres(crmConn, { prepare: false });
      const rawDb = drizzle(rawSql, { schema: { holds } });
      const rows = await rawDb.select({ id: holds.id }).from(holds);
      expect(rows).toHaveLength(0);
      await rawSql.end();
    });
  });

  describe('bookings', () => {
    it('agent A sees only bookings for their assigned leads', async () => {
      const session: AppSession = { role: 'agent', userId: AGENT_A_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ id: bookings.id }).from(bookings);
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(BOOKING_1_ID);
    });

    it('agent B sees only bookings for their assigned leads', async () => {
      const session: AppSession = { role: 'agent', userId: AGENT_B_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ id: bookings.id }).from(bookings);
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(BOOKING_2_ID);
    });

    it('owner sees all bookings', async () => {
      const session: AppSession = { role: 'owner', userId: OWNER_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ id: bookings.id }).from(bookings);
      });
      expect(rows).toHaveLength(2);
    });

    it('raw query without context returns zero bookings', async () => {
      const rawSql = postgres(crmConn, { prepare: false });
      const rawDb = drizzle(rawSql, { schema: { bookings } });
      const rows = await rawDb.select({ id: bookings.id }).from(bookings);
      expect(rows).toHaveLength(0);
      await rawSql.end();
    });
  });

  describe('site_visits', () => {
    it('agent A sees only site visits for their assigned leads', async () => {
      const session: AppSession = { role: 'agent', userId: AGENT_A_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ id: siteVisits.id }).from(siteVisits);
      });
      
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(VISIT_1_ID);
    });

    it('agent B sees only site visits for their assigned leads', async () => {
      const session: AppSession = { role: 'agent', userId: AGENT_B_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ id: siteVisits.id }).from(siteVisits);
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(VISIT_2_ID);
    });

    it('owner sees all site visits', async () => {
      const session: AppSession = { role: 'owner', userId: OWNER_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ id: siteVisits.id }).from(siteVisits);
      });
      expect(rows).toHaveLength(2);
    });

    it('raw query without context returns zero site visits', async () => {
      const rawSql = postgres(crmConn, { prepare: false });
      const rawDb = drizzle(rawSql, { schema: { siteVisits } });
      const rows = await rawDb.select({ id: siteVisits.id }).from(siteVisits);
      expect(rows).toHaveLength(0);
      await rawSql.end();
    });
  });

  describe('payment_ledger', () => {
    it('agent A sees only payment ledger entries for their assigned leads bookings', async () => {
      const session: AppSession = { role: 'agent', userId: AGENT_A_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ bookingId: paymentLedger.bookingId }).from(paymentLedger);
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].bookingId).toBe(BOOKING_1_ID);
    });

    it('agent B sees only payment ledger entries for their assigned leads bookings', async () => {
      const session: AppSession = { role: 'agent', userId: AGENT_B_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ bookingId: paymentLedger.bookingId }).from(paymentLedger);
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].bookingId).toBe(BOOKING_2_ID);
    });

    it('owner sees all payment ledger entries', async () => {
      const session: AppSession = { role: 'owner', userId: OWNER_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ bookingId: paymentLedger.bookingId }).from(paymentLedger);
      });
      expect(rows).toHaveLength(2);
    });

    it('raw query without context returns zero payment ledger entries', async () => {
      const rawSql = postgres(crmConn, { prepare: false });
      const rawDb = drizzle(rawSql, { schema: { paymentLedger } });
      const rows = await rawDb.select({ bookingId: paymentLedger.bookingId }).from(paymentLedger);
      expect(rows).toHaveLength(0);
      await rawSql.end();
    });
  });

  describe('documents', () => {
    it('agent A sees project/unit docs, and their own booking/client docs', async () => {
      const session: AppSession = { role: 'agent', userId: AGENT_A_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ id: documents.id, scope: documents.scope }).from(documents);
      });
      
      const ids = rows.map((r) => r.id);
      expect(ids).toHaveLength(4);
      expect(ids).toContain(DOC_PROJECT_ID);
      expect(ids).toContain(DOC_UNIT_ID);
      expect(ids).toContain(DOC_BOOKING_A_ID);
      expect(ids).toContain(DOC_CLIENT_A_ID);
      expect(ids).not.toContain(DOC_BOOKING_B_ID);
    });

    it('agent B sees project/unit docs, and their own booking/client docs', async () => {
      const session: AppSession = { role: 'agent', userId: AGENT_B_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ id: documents.id }).from(documents);
      });
      
      const ids = rows.map((r) => r.id);
      expect(ids).toHaveLength(3);
      expect(ids).toContain(DOC_PROJECT_ID);
      expect(ids).toContain(DOC_UNIT_ID);
      expect(ids).toContain(DOC_BOOKING_B_ID);
      expect(ids).not.toContain(DOC_BOOKING_A_ID);
      expect(ids).not.toContain(DOC_CLIENT_A_ID);
    });

    it('owner sees all documents', async () => {
      const session: AppSession = { role: 'owner', userId: OWNER_ID };
      const rows = await dbAccess.authedQuery(session, async (tx) => {
        return tx.select({ id: documents.id }).from(documents);
      });
      expect(rows).toHaveLength(5);
    });

    it('raw query without context returns zero documents', async () => {
      const rawSql = postgres(crmConn, { prepare: false });
      const rawDb = drizzle(rawSql, { schema: { documents } });
      const rows = await rawDb.select({ id: documents.id }).from(documents);
      expect(rows).toHaveLength(0);
      await rawSql.end();
    });
  });
});
