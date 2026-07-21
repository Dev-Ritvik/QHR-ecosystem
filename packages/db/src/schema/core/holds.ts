// packages/db/src/schema/core/holds.ts
import { sql } from 'drizzle-orm';
import { uuid, text, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { core, holdStatus, createdAt } from './enums';
import { units } from './units';
import { clients } from './clients';
import { leads } from './leads';
import { users } from './auth';

export const holds = core.table(
  'holds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    unitId: uuid('unit_id').notNull().references(() => units.id),
    clientId: uuid('client_id').notNull().references(() => clients.id),
    leadId: uuid('lead_id').references(() => leads.id),
    status: holdStatus('status').notNull().default('active'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    extendedById: uuid('extended_by_id').references(() => users.id),
    extendedAt: timestamp('extended_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    reason: text('reason'),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('holds_one_active_per_unit_uq').on(t.unitId).where(sql`status = 'active'`),
    index('holds_expiry_idx').on(t.expiresAt).where(sql`status = 'active'`),
    check('holds_expiry_after_start', sql`expires_at > starts_at`),
    check('holds_released_shape', sql`(status IN ('released','expired','converted')) = (released_at IS NOT NULL)`),
  ],
);
