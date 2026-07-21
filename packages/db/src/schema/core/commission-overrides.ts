import { sql } from 'drizzle-orm';
import { uuid, text, bigint, timestamp, index, check } from 'drizzle-orm/pg-core';
import { core } from './enums';
import { commissionEntries } from './commission-entries';
import { users } from './auth';

const paise = (name: string) => bigint(name, { mode: 'bigint' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const commissionOverrides = core.table(
  'commission_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id').notNull().references(() => commissionEntries.id),
    previousAmountPaise: paise('previous_amount_paise').notNull(),
    overriddenAmountPaise: paise('overridden_amount_paise').notNull(),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull().references(() => users.id), // owner-only, enforced in DAL + RLS
    createdAt: createdAt(),
  },
  (t) => [
    index('commission_overrides_entry_idx').on(t.entryId),
    check('commission_overrides_amount_nonnegative', sql`overridden_amount_paise >= 0`),
  ],
);
