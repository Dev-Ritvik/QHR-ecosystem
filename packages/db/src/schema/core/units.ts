// packages/db/src/schema/core/units.ts
import { sql } from 'drizzle-orm';
import { uuid, text, varchar, boolean, doublePrecision, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { core, unitStatus, unitFacing, paise, createdAt, updatedAt } from './enums';
import { projects } from './projects';
import { priceVersions } from './price-versions';

export const units = core.table(
  'units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    unitNumber: varchar('unit_number', { length: 40 }).notNull(),
    status: unitStatus('status').notNull().default('available'),
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }).notNull().defaultNow(),
    facing: unitFacing('facing'),
    isCorner: boolean('is_corner').notNull().default(false),
    roadWidthM: doublePrecision('road_width_m'),
    areaSqYd: doublePrecision('area_sq_yd'),
    areaSqFt: doublePrecision('area_sq_ft'),
    dimensionsLabel: varchar('dimensions_label', { length: 40 }),
    priceVersionId: uuid('price_version_id').references(() => priceVersions.id),
    computedPricePaise: paise('computed_price_paise'),
    overridePricePaise: paise('override_price_paise'),
    overrideReason: text('override_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('units_project_number_live_uq').on(t.projectId, t.unitNumber).where(sql`archived_at IS NULL`),
    index('units_project_status_idx').on(t.projectId, t.status),
    check('units_override_needs_reason', sql`override_price_paise IS NULL OR override_reason IS NOT NULL`),
    check('units_areas_positive', sql`
      (area_sq_yd IS NULL OR area_sq_yd > 0) AND
      (area_sq_ft IS NULL OR area_sq_ft > 0) AND
      (road_width_m IS NULL OR road_width_m > 0)
    `),
    check('units_prices_positive', sql`
      (computed_price_paise IS NULL OR computed_price_paise > 0) AND
      (override_price_paise IS NULL OR override_price_paise > 0)
    `),
  ],
);
