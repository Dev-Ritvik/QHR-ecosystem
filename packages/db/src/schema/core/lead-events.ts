// packages/db/src/schema/core/lead-events.ts
import { sql } from 'drizzle-orm';
import { uuid, text, timestamp, index, check } from 'drizzle-orm/pg-core';
import {
  core,
  leadEventType,
  pipelineStage,
  interactionType,
  negotiationKind,
  paise,
  createdAt,
} from './enums';
import { users } from './auth';
import { leads } from './leads';
import { units } from './units';

export const leadEvents = core.table(
  'lead_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id').notNull().references(() => leads.id),
    type: leadEventType('type').notNull(),
    fromStage: pipelineStage('from_stage'),
    toStage: pipelineStage('to_stage'),
    interactionType: interactionType('interaction_type'),
    outcomes: text('outcomes').array(),
    assignedToId: uuid('assigned_to_id').references(() => users.id),
    negotiationKind: negotiationKind('negotiation_kind'),
    amountPaise: paise('amount_paise'),
    unitId: uuid('unit_id').references(() => units.id),
    note: text('note'),
    nextFollowUpAt: timestamp('next_follow_up_at', { withTimezone: true }),
    actorId: uuid('actor_id').notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('lead_events_lead_idx').on(t.leadId, t.createdAt),
    check('lead_events_stage_shape', sql`type <> 'stage_change' OR to_stage IS NOT NULL` as any),
    check('lead_events_interaction_shape', sql`type <> 'interaction' OR interaction_type IS NOT NULL` as any),
    check('lead_events_negotiation_shape', sql`
      type <> 'negotiation' OR (negotiation_kind IS NOT NULL AND amount_paise IS NOT NULL AND amount_paise > 0)
    ` as any),
    check('lead_events_assignment_shape', sql`type <> 'assignment' OR assigned_to_id IS NOT NULL` as any),
  ],
);
