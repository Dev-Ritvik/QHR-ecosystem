/**
 * Item 6 regression: Approval Number on the unit form (land details) must
 * never block saving — empty and filled must both persist, through the real
 * createUnit server action against the live database.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import postgres from 'postgres';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../../../../packages/db/.env') });
process.env.DATABASE_URL = process.env.DATABASE_URL_CRM;

const ids = vi.hoisted(() => ({
  OWNER_ID: '50000000-0000-4000-a000-000000000001',
  PROJECT_ID: '50000000-0000-4000-9000-000000000001',
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
if (!suConn || !process.env.DATABASE_URL_CRM) throw new Error('Requires DB URLs in packages/db/.env');
const su = postgres(suConn, { ssl: 'require', max: 1, prepare: false });

const cleanup = async () => {
  await su`DELETE FROM core.units WHERE project_id = ${ids.PROJECT_ID}::uuid`;
  await su`DELETE FROM core.audit_log WHERE actor_id = ${ids.OWNER_ID}::uuid`;
  await su`DELETE FROM core.projects WHERE id = ${ids.PROJECT_ID}::uuid`;
  await su`DELETE FROM core.users WHERE id = ${ids.OWNER_ID}::uuid`;
};

beforeAll(async () => {
  await cleanup();
  await su`INSERT INTO core.users (id, name, phone, role) VALUES (${ids.OWNER_ID}::uuid, 'LandTest Owner', '+919900040001', 'owner')`;
  await su`INSERT INTO core.projects (id, slug, name, asset_class, created_by_id) VALUES
    (${ids.PROJECT_ID}::uuid, 'land-approval-test', 'Land Approval Test', 'land', ${ids.OWNER_ID}::uuid)`;
});

afterAll(async () => {
  await cleanup();
  await su.end();
});

describe('land unit save — approval number is optional', () => {
  it('saves with approval number EMPTY', async () => {
    const { createUnit } = await import('./units');
    const res = await createUnit(ids.PROJECT_ID, {
      unitNumber: 'L-1',
      surveyNumber: 'SY-42/1',
      // approvalNumber deliberately absent
    });
    if (!res.ok) console.error('empty-approval save failed:', JSON.stringify(res));
    expect(res.ok).toBe(true);

    const [row] = await su`SELECT d.approval_number FROM core.units u JOIN core.unit_land_details d ON d.unit_id = u.id WHERE u.project_id = ${ids.PROJECT_ID}::uuid AND u.unit_number = 'L-1'`;
    console.log('L-1 approval_number:', JSON.stringify(row.approval_number));
    expect(row.approval_number).toBeNull();
  });

  it('saves with approval number FILLED', async () => {
    const { createUnit } = await import('./units');
    const res = await createUnit(ids.PROJECT_ID, {
      unitNumber: 'L-2',
      surveyNumber: 'SY-42/2',
      approvalAuthority: 'dtcp',
      approvalNumber: 'LP-2026/173',
    });
    if (!res.ok) console.error('filled-approval save failed:', JSON.stringify(res));
    expect(res.ok).toBe(true);

    const [row] = await su`SELECT d.approval_number FROM core.units u JOIN core.unit_land_details d ON d.unit_id = u.id WHERE u.project_id = ${ids.PROJECT_ID}::uuid AND u.unit_number = 'L-2'`;
    console.log('L-2 approval_number:', JSON.stringify(row.approval_number));
    expect(row.approval_number).toBe('LP-2026/173');
  });
});
