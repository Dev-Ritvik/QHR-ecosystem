import { sql } from 'drizzle-orm';
import { uuid, text, varchar, bigint, date, timestamp, index, check } from 'drizzle-orm/pg-core';
import { core } from './enums';
import { ledgerEntryType, paymentMode } from './enums';
import { bookings } from './bookings';
import { users } from './auth';

const paise = (name: string) => bigint(name, { mode: 'bigint' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const paymentLedger = core.table(
  'payment_ledger',
  {
    // Identity (not uuid): a gapless-ish monotonic sequence gives the ledger a total order for statements.
    id: bigint('id', { mode: 'bigint' }).generatedAlwaysAsIdentity().primaryKey(),
    bookingId: uuid('booking_id').notNull().references(() => bookings.id),
    entryType: ledgerEntryType('entry_type').notNull(),
    amountPaise: paise('amount_paise').notNull(),
    paidOn: date('paid_on').notNull(),
    mode: paymentMode('mode').notNull(),
    reference: varchar('reference', { length: 120 }), // cheque no / UTR / UPI ref
    note: text('note'),
    // Self-FK for reversals is added in a separate SQL migration (T19) to avoid circular dependencies
    reversesEntryId: bigint('reverses_entry_id', { mode: 'bigint' }),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('payment_ledger_booking_idx').on(t.bookingId, t.createdAt),
    check('payment_ledger_amount_nonzero', sql`amount_paise <> 0`),
    check('payment_ledger_sign_matches_type', sql`
      (entry_type IN ('token','installment','registration') AND amount_paise > 0) OR
      (entry_type IN ('refund','reversal') AND amount_paise < 0)
    `),
    check('payment_ledger_reversal_link', sql`(entry_type = 'reversal') = (reverses_entry_id IS NOT NULL)`),
  ],
);
