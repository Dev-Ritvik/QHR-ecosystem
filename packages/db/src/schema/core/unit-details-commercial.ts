// packages/db/src/schema/core/unit-details-commercial.ts
import { sql } from 'drizzle-orm';
import { uuid, text, varchar, boolean, doublePrecision, smallint, check } from 'drizzle-orm/pg-core';
import { core } from './enums';
import { units } from './units';

export const unitCommercialDetails = core.table(
  'unit_commercial_details',
  {
    unitId: uuid('unit_id').primaryKey().references(() => units.id, { onDelete: 'cascade' }),
    reraNumber: varchar('rera_number', { length: 100 }),
    carpetAreaSqFt: doublePrecision('carpet_area_sq_ft'),
    builtUpAreaSqFt: doublePrecision('built_up_area_sq_ft'),
    superBuiltUpAreaSqFt: doublePrecision('super_built_up_area_sq_ft'),
    floorNumber: smallint('floor_number'),
    farContext: text('far_context'),
    isTenanted: boolean('is_tenanted').notNull().default(false),
    leaseTerms: text('lease_terms'),
  },
  (t) => [
    check('unit_commercial_area_order', sql`
      (carpet_area_sq_ft IS NULL OR built_up_area_sq_ft IS NULL OR carpet_area_sq_ft <= built_up_area_sq_ft) AND
      (built_up_area_sq_ft IS NULL OR super_built_up_area_sq_ft IS NULL OR built_up_area_sq_ft <= super_built_up_area_sq_ft)
    `),
    check('unit_commercial_tenanted_terms', sql`NOT is_tenanted OR lease_terms IS NOT NULL`),
  ],
);
