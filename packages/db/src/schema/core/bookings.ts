// packages/db/src/schema/core/bookings.ts
import { sql } from 'drizzle-orm';
import { uuid, text, boolean, date, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { core, bookingStatus, paise, createdAt, updatedAt } from './enums';
import { units } from './units';
import { clients } from './clients';
import { leads } from './leads';
import { users } from './auth';

export const bookings = core.table(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    unitId: uuid('unit_id').notNull().references(() => units.id),
    clientId: uuid('client_id').notNull().references(() => clients.id),
    leadId: uuid('lead_id').references(() => leads.id),
    agentId: uuid('agent_id').notNull().references(() => users.id),
    status: bookingStatus('status').notNull().default('active'),
    tokenAmountPaise: paise('token_amount_paise').notNull(),
    considerationPaise: paise('consideration_paise'),
    tdsApplicable: boolean('tds_applicable').generatedAlwaysAs(
      sql`consideration_paise IS NOT NULL AND consideration_paise > 500000000`
    ),
    bookedOn: date('booked_on').notNull(),
    agreementDate: date('agreement_date'),
    registeredOn: date('registered_on'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    defaultedAt: timestamp('defaulted_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('bookings_one_active_per_unit_uq').on(t.unitId).where(sql`status = 'active'`),
    index('bookings_client_idx').on(t.clientId),
    index('bookings_agent_idx').on(t.agentId),
    check('bookings_token_positive', sql`token_amount_paise > 0`),
    check('bookings_consideration_positive', sql`consideration_paise IS NULL OR consideration_paise > 0`),
    check('bookings_cancel_shape', sql`(status = 'cancelled') = (cancelled_at IS NOT NULL)`),
    check('bookings_cancel_needs_reason', sql`status <> 'cancelled' OR cancel_reason IS NOT NULL`),
    check('bookings_converted_registered', sql`status <> 'converted' OR registered_on IS NOT NULL`),
  ],
);
