import { sql } from 'drizzle-orm';
import { uuid, text, integer, smallint, timestamp, index, check, customType } from 'drizzle-orm/pg-core';
import { projection } from './enums';
import { projectsPub } from './projects-pub';

const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

const postgis = (spec: string) =>
  customType<{ data: unknown; driverData: string }>({
    dataType: () => `geometry(${spec}, 4326)`,
  });
const geomPoint = postgis('Point');

export const poisPub = projection.table(
  'pois_pub',
  {
    poiId: uuid('poi_id').primaryKey(), // = core.pois.id
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsPub.projectId, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category').notNull(),
    location: geomPoint('location').notNull(),
    distanceM: integer('distance_m').notNull(),
    driveTimeMin: smallint('drive_time_min'),
    sortOrder: smallint('sort_order').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('pois_pub_project_idx').on(t.projectId, t.sortOrder),
    check('pois_pub_location_valid', sql`ST_IsValid(location)`),
    check('pois_pub_distance_positive', sql`distance_m >= 0`),
  ],
);
