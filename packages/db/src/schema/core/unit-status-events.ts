// packages/db/src/schema/core/unit-status-events.ts
import { sql } from 'drizzle-orm';
import { uuid, text, timestamp, index, check } from 'drizzle-orm/pg-core';
import { core, unitStatus, createdAt } from './enums';
import { units } from './units';
import { holds } from './holds';
import { bookings } from './bookings';
import { clients } from './clients';
import { users } from './auth';

export const unitStatusEvents = core.table(
  'unit_status_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    unitId: uuid('unit_id').notNull().references(() => units.id),
    fromStatus: unitStatus('from_status'),
    toStatus: unitStatus('to_status').notNull(),
    reason: text('reason'),
    holdId: uuid('hold_id').references(() => holds.id),
    bookingId: uuid('booking_id').references(() => bookings.id),
    clientId: uuid('client_id').references(() => clients.id),
    actorId: uuid('actor_id').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('unit_status_events_unit_idx').on(t.unitId, t.createdAt),
    check('unit_status_events_legal_transition', sql`
      (from_status IS NULL AND to_status = 'available')
      OR (from_status = 'available'    AND to_status IN ('on_hold','booked','not_for_sale'))
      OR (from_status = 'on_hold'      AND to_status IN ('available','booked'))
      OR (from_status = 'booked'       AND to_status IN ('registered','available'))
      OR (from_status = 'registered'   AND to_status IN ('sold'))
      OR (from_status = 'not_for_sale' AND to_status IN ('available'))
    `),
    check('unit_status_events_hold_link', sql`to_status <> 'on_hold' OR hold_id IS NOT NULL`),
    check('unit_status_events_booking_link', sql`to_status <> 'booked' OR booking_id IS NOT NULL`),
  ],
);
