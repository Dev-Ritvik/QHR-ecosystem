import { sql } from 'drizzle-orm';
import { uuid, jsonb, timestamp, uniqueIndex, index, check, customType } from 'drizzle-orm/pg-core';
import { projection, pubFeatureType } from './enums';
import { projectsPub } from './projects-pub';

const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

const postgis = (spec: string) =>
  customType<{ data: unknown; driverData: string }>({
    dataType: () => `geometry(${spec}, 4326)`,
  });
const geomAny = postgis('Geometry');

export const geometryPub = projection.table(
  'geometry_pub',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsPub.projectId, { onDelete: 'cascade' }),
    unitId: uuid('unit_id'), // set for feature_type='plot'; NULL for shared layers
    featureType: pubFeatureType('feature_type').notNull(),
    geom: geomAny('geom').notNull(),
    properties: jsonb('properties').notNull().default(sql`'{}'::jsonb`),
    geometryVersionId: uuid('geometry_version_id').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('geometry_pub_one_plot_per_unit_uq').on(t.unitId).where(sql`feature_type = 'plot'`),
    index('geometry_pub_project_type_idx').on(t.projectId, t.featureType),
    index('geometry_pub_gix').using('gist', t.geom),
    check('geometry_pub_valid', sql`ST_IsValid(geom)`),
    check('geometry_pub_plot_has_unit', sql`feature_type <> 'plot' OR unit_id IS NOT NULL`),
  ],
);
