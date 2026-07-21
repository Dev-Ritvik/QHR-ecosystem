import { sql } from 'drizzle-orm';
import { uuid, integer, jsonb, timestamp, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { core } from './enums';
import { projects } from './projects';
import { users } from './auth';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const commissionRules = core.table(
  'commission_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => projects.id), // NULL = office-wide default rule
    rateBps: integer('rate_bps').notNull(), // basis points of consideration (100 bps = 1%)
    // Tranche split tied to pipeline stages
    trancheSplit: jsonb('tranche_split')
      .notNull()
      .default(sql`'{"token": 0, "agreement": 0, "registration": 100}'::jsonb`),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    // One live rule per project, and one live office default
    uniqueIndex('commission_rules_one_live_uq')
      .on(sql`COALESCE(project_id::text, 'office_default')`)
      .where(sql`archived_at IS NULL`),
    check('commission_rules_rate_range', sql`rate_bps BETWEEN 0 AND 10000`),
  ],
);
