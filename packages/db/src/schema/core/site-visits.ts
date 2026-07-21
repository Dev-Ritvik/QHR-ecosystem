// packages/db/src/schema/core/site-visits.ts
import { sql } from 'drizzle-orm';
import { uuid, text, smallint, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import { core, visitStatus, createdAt, updatedAt } from './enums';
import { users } from './auth';
import { leads } from './leads';
import { units } from './units';

export const siteVisits = core.table(
  'site_visits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    agentId: uuid('agent_id').notNull().references(() => users.id),
    status: visitStatus('status').notNull().default('scheduled'),
    pickupPoint: text('pickup_point'),
    vehicleNote: text('vehicle_note'),
    generalNote: text('general_note'),
    outcomeCapturedAt: timestamp('outcome_captured_at', { withTimezone: true }),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('site_visits_agent_time_idx').on(t.agentId, t.scheduledAt),
    index('site_visits_uncaptured_idx')
      .on(t.agentId)
      .where(sql`status = 'completed' AND outcome_captured_at IS NULL`),
  ],
);

export const siteVisitLeads = core.table(
  'site_visit_leads',
  {
    visitId: uuid('visit_id').notNull().references(() => siteVisits.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').notNull().references(() => leads.id),
  },
  (t) => [primaryKey({ columns: [t.visitId, t.leadId] })],
);

export const siteVisitUnits = core.table(
  'site_visit_units',
  {
    visitId: uuid('visit_id').notNull().references(() => siteVisits.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id').notNull().references(() => units.id),
    sortOrder: smallint('sort_order').notNull().default(0),
    outcomes: text('outcomes').array(),
    outcomeNote: text('outcome_note'),
  },
  (t) => [primaryKey({ columns: [t.visitId, t.unitId] })],
);
