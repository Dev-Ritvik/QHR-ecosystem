// packages/db/src/schema/core/projects.ts
import { sql } from 'drizzle-orm';
import { uuid, text, varchar, smallint, timestamp, jsonb, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { core, assetClass, approvalAuthority, layoutType, priceVisibility, geomPoint, createdAt, updatedAt } from './enums';
import { users } from './auth';

export const projects = core.table(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: text('name').notNull(),
    assetClass: assetClass('asset_class').notNull(),
    narrative: text('narrative'),
    locality: text('locality'),
    city: text('city'),
    state: text('state'),
    /** @deprecated replaced by layoutType (column kept so no data is lost) */
    approvalAuthority: approvalAuthority('approval_authority'),
    layoutType: layoutType('layout_type'),
    approvalNumber: varchar('approval_number', { length: 100 }),
    reraNumber: varchar('rera_number', { length: 100 }),
    amenities: jsonb('amenities').notNull().default(sql`'[]'::jsonb`),
    priceVisibility: priceVisibility('price_visibility').notNull().default('on_request'),
    sellingFastThresholdPct: smallint('selling_fast_threshold_pct').notNull().default(15),
    centroid: geomPoint('centroid'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('projects_slug_live_uq').on(t.slug).where(sql`archived_at IS NULL`),
    check('projects_threshold_range', sql`selling_fast_threshold_pct BETWEEN 0 AND 100`),
    check('projects_centroid_valid', sql`centroid IS NULL OR ST_IsValid(centroid)`),
  ],
);
