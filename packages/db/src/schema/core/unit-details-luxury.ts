// packages/db/src/schema/core/unit-details-luxury.ts
import { sql } from 'drizzle-orm';
import { uuid, varchar, date, jsonb } from 'drizzle-orm/pg-core';
import { core, possessionStatus, certStatus } from './enums';
import { units } from './units';

export const unitLuxuryDetails = core.table(
  'unit_luxury_details',
  {
    unitId: uuid('unit_id').primaryKey().references(() => units.id, { onDelete: 'cascade' }),
    configuration: varchar('configuration', { length: 40 }),
    possessionStatus: possessionStatus('possession_status').notNull().default('under_construction'),
    reraNumber: varchar('rera_number', { length: 100 }),
    reraCompletionDate: date('rera_completion_date'),
    ocStatus: certStatus('oc_status').notNull().default('not_applied'),
    ccStatus: certStatus('cc_status').notNull().default('not_applied'),
    amenities: jsonb('amenities').notNull().default(sql`'[]'::jsonb`),
  },
);
