// packages/db/src/schema/core/clients.ts
import { sql } from 'drizzle-orm';
import { uuid, text, varchar, timestamp, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { core, createdAt, updatedAt } from './enums';
import { users } from './auth';

export const clients = core.table(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    phone: varchar('phone', { length: 16 }).notNull(),
    altPhone: varchar('alt_phone', { length: 16 }),
    email: varchar('email', { length: 320 }),
    address: text('address'),
    panMasked: varchar('pan_masked', { length: 12 }),
    aadhaarMasked: varchar('aadhaar_masked', { length: 16 }),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('clients_phone_live_uq').on(t.phone).where(sql`archived_at IS NULL` as any),
    check('clients_phone_format', sql`phone ~ '^\\+[1-9][0-9]{7,14}$'` as any),
  ],
);
