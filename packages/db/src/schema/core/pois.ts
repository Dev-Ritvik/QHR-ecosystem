import { sql } from 'drizzle-orm';
import { uuid, text, integer, smallint, timestamp, index, check, customType } from 'drizzle-orm/pg-core';
import { core } from './enums';
import { poiCategory } from './enums';
import { projects } from './projects';
import { users } from './auth';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

const postgis = (spec: string) =>
  customType<{ data: unknown; driverData: string }>({
    dataType: () => `geometry(${spec}, 4326)`,
  });
const geomPoint = postgis('Point');

export const pois = core.table(
  'pois',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    name: text('name').notNull(),
    category: poiCategory('category').notNull(),
    location: geomPoint('location').notNull(),
    distanceM: integer('distance_m'), // auto-computed from active geometry version
    distanceOverrideM: integer('distance_override_m'), // manual override — FR-C29
    driveTimeMin: smallint('drive_time_min'),
    driveTimeOverrideMin: smallint('drive_time_override_min'),
    sortOrder: smallint('sort_order').notNull().default(0), // per-asset-class relevance ordering
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    index('pois_project_idx').on(t.projectId, t.sortOrder),
    check('pois_location_valid', sql`ST_IsValid(location)`),
    check('pois_distances_positive', sql`
      (distance_m IS NULL OR distance_m >= 0) AND
      (distance_override_m IS NULL OR distance_override_m >= 0) AND
      (drive_time_min IS NULL OR drive_time_min >= 0) AND
      (drive_time_override_min IS NULL OR drive_time_override_min >= 0)
    `),
  ],
);
