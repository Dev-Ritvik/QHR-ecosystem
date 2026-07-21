import { sql } from 'drizzle-orm';
import { uuid, varchar, text, boolean, doublePrecision, jsonb, bigint, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { projection, pubPresentationStatus } from './enums';
import { projectsPub } from './projects-pub';

const paise = (name: string) => bigint(name, { mode: 'bigint' });
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const unitsPub = projection.table(
  'units_pub',
  {
    unitId: uuid('unit_id').primaryKey(), // = core.units.id
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsPub.projectId, { onDelete: 'cascade' }),
    unitNumber: varchar('unit_number', { length: 40 }).notNull(),
    presentationStatus: pubPresentationStatus('presentation_status').notNull(),
    facing: text('facing'), // display string: 'East'
    isCorner: boolean('is_corner').notNull().default(false),
    roadWidthM: doublePrecision('road_width_m'),
    areaSqYd: doublePrecision('area_sq_yd'),
    areaSqFt: doublePrecision('area_sq_ft'),
    dimensionsLabel: varchar('dimensions_label', { length: 40 }),
    // Labeled asset-class-specific display fields (FR-W3)
    classDetails: jsonb('class_details').notNull().default(sql`'[]'::jsonb`),
    // Price XOR price-on-request
    pricePaise: paise('price_paise'),
    priceOnRequest: boolean('price_on_request').notNull().default(false),
    priceVersionId: uuid('price_version_id'),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('units_pub_project_number_uq').on(t.projectId, t.unitNumber),
    index('units_pub_project_status_idx').on(t.projectId, t.presentationStatus),
    check('units_pub_price_xor_por', sql`
      (price_on_request AND price_paise IS NULL) OR (NOT price_on_request AND price_paise IS NOT NULL)
    `),
    check('units_pub_price_positive', sql`price_paise IS NULL OR price_paise > 0`),
  ],
);
