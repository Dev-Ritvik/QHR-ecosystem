/**
 * Money-path integration test: a human types RUPEES into the unit form;
 * the persisted core.units.override_price_paise must be exactly ×100.
 *
 * Exercises the real path the form uses: buildUnitPayload(FormData) →
 * createUnit server action (real validation + drizzle insert, as crm_app
 * under RLS) → live database row, asserted via an independent superuser
 * connection. Only the Next.js runtime shims (session/headers/cache) are
 * mocked — none of the money code is.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import postgres from 'postgres';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../../../../packages/db/.env') });

// The server action must run as crm_app (RLS enforced), like the real app.
process.env.DATABASE_URL = process.env.DATABASE_URL_CRM;

const ids = vi.hoisted(() => ({
  OWNER_ID: '40000000-0000-4000-a000-000000000001',
  PROJECT_ID: '40000000-0000-4000-9000-000000000001',
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
  await su`DELETE FROM core.units WHERE project_id = ${ids.PROJECT_ID}::uuid`;
  await su`DELETE FROM core.audit_log WHERE actor_id = ${ids.OWNER_ID}::uuid`;
  await su`DELETE FROM core.projects WHERE id = ${ids.PROJECT_ID}::uuid`;
  await su`DELETE FROM core.users WHERE id = ${ids.OWNER_ID}::uuid`;
};

beforeAll(async () => {
  await cleanup();
  await su`INSERT INTO core.users (id, name, phone, role) VALUES
    (${ids.OWNER_ID}::uuid, 'PriceTest Owner', '+919900030001', 'owner')`;
  await su`INSERT INTO core.projects (id, slug, name, asset_class, created_by_id) VALUES
    (${ids.PROJECT_ID}::uuid, 'price-override-test', 'Price Override Test', 'luxury_residential', ${ids.OWNER_ID}::uuid)`;
});

afterAll(async () => {
  await cleanup();
  await su.end();
});

describe('unit price override: rupees in the form, paise in the database', () => {
  it('persists a typed rupee amount as exactly rupees × 100 paise', async () => {
    const { buildUnitPayload } = await import('@/lib/unit-payload');
    const { createUnit } = await import('./units');

    // What a human types into the form: ₹45,00,000.50
    const TYPED_RUPEES = '4500000.50';
    const EXPECTED_PAISE = 450000050n; // 4,500,000.50 × 100

    const formData = new FormData();
    formData.set('unitNumber', 'PRICE-T1');
    formData.set('areaSqYd', '200');
    formData.set('overridePriceRupees', TYPED_RUPEES);
    formData.set('overrideReason', 'money-path integration test');

    const payload = buildUnitPayload(formData);
    // Boundary conversion happened; nothing rupee-named crosses to the server
    expect(payload.overridePricePaise).toBe(Number(EXPECTED_PAISE));
    expect('overridePriceRupees' in payload).toBe(false);

    const res = await createUnit(ids.PROJECT_ID, payload);
    if (!res.ok) console.error('createUnit failed:', JSON.stringify(res));
    expect(res.ok).toBe(true);

    const [row] = await su`
      SELECT unit_number, override_price_paise
      FROM core.units
      WHERE project_id = ${ids.PROJECT_ID}::uuid AND unit_number = 'PRICE-T1'`;
    expect(row).toBeDefined();

    console.log(
      `typed ₹${TYPED_RUPEES} in the form → persisted override_price_paise = ${row.override_price_paise}`,
    );
    expect(BigInt(row.override_price_paise)).toBe(EXPECTED_PAISE);
  });
});
