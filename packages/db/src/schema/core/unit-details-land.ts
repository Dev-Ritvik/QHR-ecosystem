// packages/db/src/schema/core/unit-details-land.ts
import { sql } from 'drizzle-orm';
import { uuid, text, varchar, doublePrecision, index, check } from 'drizzle-orm/pg-core';
import { core, landExtentUnit, approvalAuthority, landConversionStatus } from './enums';
import { units } from './units';

export const unitLandDetails = core.table(
  'unit_land_details',
  {
    unitId: uuid('unit_id').primaryKey().references(() => units.id, { onDelete: 'cascade' }),
    surveyNumber: varchar('survey_number', { length: 80 }).notNull(),
    subdivisionLineage: text('subdivision_lineage'),
    extentValue: doublePrecision('extent_value'),
    extentUnit: landExtentUnit('extent_unit'),
    approvalAuthority: approvalAuthority('approval_authority'),
    approvalNumber: varchar('approval_number', { length: 100 }),
    conversionStatus: landConversionStatus('conversion_status').notNull().default('not_required'),
  },
  (t) => [
    index('unit_land_survey_idx').on(t.surveyNumber),
    check('unit_land_extent_pair', sql`(extent_value IS NULL) = (extent_unit IS NULL)`),
    check('unit_land_extent_positive', sql`extent_value IS NULL OR extent_value > 0`),
  ],
);
