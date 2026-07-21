// packages/db/src/schema/core/price-versions.ts
import { sql } from 'drizzle-orm';
import { uuid, text, integer, timestamp, jsonb, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { core, rateBasis, paise, createdAt } from './enums';
import { users } from './auth';
import { projects } from './projects';

export const priceVersions = core.table(
  'price_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    versionNo: integer('version_no').notNull(),
    rateBasis: rateBasis('rate_basis').notNull(),
    baseRatePaise: paise('base_rate_paise').notNull(),
    premiums: jsonb('premiums').notNull().default(sql`'{}'::jsonb`),
    reason: text('reason').notNull(),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('price_versions_project_no_uq').on(t.projectId, t.versionNo),
    uniqueIndex('price_versions_one_active_uq')
      .on(t.projectId)
      .where(sql`activated_at IS NOT NULL AND superseded_at IS NULL`),
    check('price_versions_rate_positive', sql`base_rate_paise > 0`),
  ],
);
