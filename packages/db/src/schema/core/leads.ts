// packages/db/src/schema/core/leads.ts
import { sql } from 'drizzle-orm';
import { uuid, text, varchar, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import {
  core,
  leadSource,
  pipelineStage,
  lostReason,
  leadTriageStatus,
  paise,
  assetClass,
  createdAt,
  updatedAt,
} from './enums';
import { users } from './auth';
import { clients } from './clients';
import { projects } from './projects';
import { units } from './units';

export const leads = core.table(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    phone: varchar('phone', { length: 16 }).notNull(),
    altPhone: varchar('alt_phone', { length: 16 }),
    email: varchar('email', { length: 320 }),
    source: leadSource('source').notNull(),
    sourceDetail: text('source_detail'),
    budgetMinPaise: paise('budget_min_paise'),
    budgetMaxPaise: paise('budget_max_paise'),
    assetClassInterest: assetClass('asset_class_interest'),
    timelineExpectation: varchar('timeline_expectation', { length: 60 }),
    stage: pipelineStage('stage').notNull().default('new'),
    lostReason: lostReason('lost_reason'),
    assignedAgentId: uuid('assigned_agent_id').references(() => users.id),
    triageStatus: leadTriageStatus('triage_status').notNull().default('new'),
    mergedIntoLeadId: uuid('merged_into_lead_id'), // self-FK added in migration
    clientId: uuid('client_id').references(() => clients.id),
    nextFollowUpAt: timestamp('next_follow_up_at', { withTimezone: true }),
    dedupeKey: varchar('dedupe_key', { length: 128 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('leads_dedupe_uq').on(t.dedupeKey).where(sql`dedupe_key IS NOT NULL` as any),
    index('leads_phone_idx').on(t.phone),
    index('leads_agent_stage_idx').on(t.assignedAgentId, t.stage),
    index('leads_followup_idx').on(t.nextFollowUpAt).where(sql`next_follow_up_at IS NOT NULL AND archived_at IS NULL` as any),
    check('leads_lost_needs_reason', sql`stage <> 'lost' OR lost_reason IS NOT NULL` as any),
    check('leads_budget_order', sql`
      budget_min_paise IS NULL OR budget_max_paise IS NULL OR budget_min_paise <= budget_max_paise
    ` as any),
    check('leads_merged_is_terminal', sql`(triage_status = 'merged') = (merged_into_lead_id IS NOT NULL)` as any),
  ],
);

export const leadInterests = core.table(
  'lead_interests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    unitId: uuid('unit_id').references(() => units.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('lead_interests_uq').on(t.leadId, t.projectId, t.unitId),
    index('lead_interests_project_idx').on(t.projectId),
  ],
);
