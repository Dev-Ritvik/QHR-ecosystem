import { sql } from 'drizzle-orm';
import { uuid, text, varchar, bigint, date, timestamp, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { core } from './enums';
import { payeeType, commissionTranche, commissionEntryStatus } from './enums';
import { bookings } from './bookings';
import { commissionRules } from './commission-rules';
import { users } from './auth';

const paise = (name: string) => bigint(name, { mode: 'bigint' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const commissionEntries = core.table(
  'commission_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id').notNull().references(() => bookings.id),
    ruleId: uuid('rule_id').references(() => commissionRules.id), // NULL = fully manual entry
    payeeType: payeeType('payee_type').notNull(),
    payeeUserId: uuid('payee_user_id').references(() => users.id), // when payee is an agent
    payeeName: text('payee_name'), // external payees
    payeePhone: varchar('payee_phone', { length: 16 }),
    tranche: commissionTranche('tranche').notNull(),
    basisAmountPaise: paise('basis_amount_paise').notNull(),
    computedAmountPaise: paise('computed_amount_paise').notNull(),
    status: commissionEntryStatus('status').notNull().default('accrued'),
    paidOn: date('paid_on'),
    paymentReference: varchar('payment_reference', { length: 120 }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: text('void_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('commission_entries_uq')
      .on(t.bookingId, t.tranche, sql`COALESCE(payee_user_id::text, payee_name)`)
      .where(sql`voided_at IS NULL`),
    index('commission_entries_payee_idx').on(t.payeeUserId).where(sql`payee_user_id IS NOT NULL`),
    check('commission_entries_payee_shape', sql`
      (payee_type = 'agent' AND payee_user_id IS NOT NULL) OR
      (payee_type <> 'agent' AND payee_name IS NOT NULL)
    `),
    check('commission_entries_amounts', sql`basis_amount_paise >= 0 AND computed_amount_paise >= 0`),
    check('commission_entries_paid_shape', sql`(status = 'paid') = (paid_on IS NOT NULL)`),
    check('commission_entries_void_shape', sql`(status = 'voided') = (voided_at IS NOT NULL)`),
  ],
);
