/**
 * Money-path integration test (mirror of unit-price-override.test.ts):
 * a human types RUPEES into the negotiation form; the persisted
 * core.lead_events.amount_paise must be exactly ×100.
 *
 * Exercises the real path both negotiation forms use since the
 * parseFloat×100 fix: rupeesToPaise(typed string) → logNegotiation server
 * action (real validation + drizzle insert, as crm_app under RLS) → live
 * database row, asserted via an independent superuser connection. Only the
 * Next.js runtime shims (session/headers/cache) are mocked — none of the
 * money code is.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import postgres from 'postgres';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../../../../packages/db/.env') });

// The server action must run as crm_app (RLS enforced), like the real app.
process.env.DATABASE_URL = process.env.DATABASE_URL_CRM;

const ids = vi.hoisted(() => ({
  OWNER_ID: '41000000-0000-4000-a000-000000000001',
  LEAD_ID: '41000000-0000-4000-9000-000000000001',
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('@/server/session', () => ({
  getSession: async () => null,
  getRoleContext: async () => ({ userId: ids.OWNER_ID, role: 'owner' as const }),
  requireOwner: async () => ({ ok: true as const, session: { user: { id: ids.OWNER_ID, role: 'owner' } } }),
}));

const suConn = process.env.DATABASE_URL_MIGRATIONS;
if (!suConn || !process.env.DATABASE_URL_CRM) {
  throw new Error('Requires DATABASE_URL_MIGRATIONS and DATABASE_URL_CRM in packages/db/.env');
}
const su = postgres(suConn, { ssl: 'require', max: 1, prepare: false });

const cleanup = async () => {
  await su`DELETE FROM core.lead_events WHERE lead_id = ${ids.LEAD_ID}::uuid`;
  await su`DELETE FROM core.audit_log WHERE actor_id = ${ids.OWNER_ID}::uuid`;
  await su`DELETE FROM core.leads WHERE id = ${ids.LEAD_ID}::uuid`;
  await su`DELETE FROM core.users WHERE id = ${ids.OWNER_ID}::uuid`;
};

beforeAll(async () => {
  await cleanup();
  await su`INSERT INTO core.users (id, name, phone, role) VALUES
    (${ids.OWNER_ID}::uuid, 'NegotiationTest Owner', '+919900040001', 'owner')`;
  await su`INSERT INTO core.leads (id, name, phone, source, assigned_agent_id) VALUES
    (${ids.LEAD_ID}::uuid, 'Negotiation Money Test Lead', '+919900040002', 'walk_in', ${ids.OWNER_ID}::uuid)`;
});

afterAll(async () => {
  await cleanup();
  await su.end();
});

describe('negotiation amount: rupees in the form, paise in the database', () => {
  it('persists a typed decimal rupee amount as exactly rupees × 100 paise', async () => {
    const { rupeesToPaise } = await import('@estate/domain/money/paise');
    const { logNegotiation } = await import('./leads');

    // What a human types into the negotiation form: ₹55,12,345.75.
    // rupeesToPaise parses the decimal text (never multiplies floats) and
    // rejects the garbage parseFloat silently accepted (e.g. '55,00,000' → 55).
    const TYPED_RUPEES = '5512345.75';
    const EXPECTED_PAISE = 551234575n;

    // Boundary conversion exactly as NegotiationLogger/PrivilegedEntries do it
    const amountPaise = Number(rupeesToPaise(TYPED_RUPEES));
    expect(amountPaise).toBe(Number(EXPECTED_PAISE));

    const res = await logNegotiation({
      leadId: ids.LEAD_ID,
      negotiationKind: 'client_offer',
      amountPaise,
      unitId: 'none',
      note: 'money-path integration test',
    });
    if (!res.ok) console.error('logNegotiation failed:', JSON.stringify(res));
    expect(res.ok).toBe(true);

    const [row] = await su`
      SELECT negotiation_kind, amount_paise
      FROM core.lead_events
      WHERE lead_id = ${ids.LEAD_ID}::uuid AND type = 'negotiation'`;
    expect(row).toBeDefined();

    console.log(
      `typed ₹${TYPED_RUPEES} in the form → persisted amount_paise = ${row.amount_paise}`,
    );
    expect(BigInt(row.amount_paise)).toBe(EXPECTED_PAISE);
  });
});
