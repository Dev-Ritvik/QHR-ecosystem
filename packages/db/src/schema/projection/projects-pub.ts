import { sql } from 'drizzle-orm';
import { uuid, varchar, text, jsonb, integer, boolean, timestamp, uniqueIndex, check, customType } from 'drizzle-orm/pg-core';
import { projection, pubAssetClass } from './enums';

const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

const postgis = (spec: string) =>
  customType<{ data: unknown; driverData: string }>({
    dataType: () => `geometry(${spec}, 4326)`,
  });
const geomPoint = postgis('Point');

export const projectsPub = projection.table(
  'projects_pub',
  {
    projectId: uuid('project_id').primaryKey(), // = core.projects.id
    slug: varchar('slug', { length: 120 }).notNull(),
    name: text('name').notNull(),
    assetClass: pubAssetClass('asset_class').notNull(),
    narrative: text('narrative').notNull(),
    locality: text('locality'),
    city: text('city'),
    // Approval/legal badges with real numbers — FR-W2: [{label: "DTCP LP No.", value: "..."}]
    badges: jsonb('badges').notNull().default(sql`'[]'::jsonb`),
    amenities: jsonb('amenities').notNull().default(sql`'[]'::jsonb`),
    totalUnits: integer('total_units').notNull(),
    availableUnits: integer('available_units').notNull(),
    isSoldOut: boolean('is_sold_out').generatedAlwaysAs(sql`available_units = 0`),
    priceVisibility: text('price_visibility').notNull(), // 'public' | 'on_request' (kept text: display-only)
    heroUrl: text('hero_url').notNull(),
    centroid: geomPoint('centroid'),
    // [minLng, minLat, maxLng, maxLat] — presentation prefetch tile pack (FR-PM2)
    bbox: jsonb('bbox'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('projects_pub_slug_uq').on(t.slug),
    check('projects_pub_counts', sql`total_units >= 0 AND available_units BETWEEN 0 AND total_units`),
    check('projects_pub_centroid_valid', sql`centroid IS NULL OR ST_IsValid(centroid)`),
  ],
);
