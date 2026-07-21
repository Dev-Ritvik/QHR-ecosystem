import { sql } from 'drizzle-orm';
import { uuid, jsonb, timestamp, uniqueIndex, index, check, customType } from 'drizzle-orm/pg-core';
import { core } from './enums';
import { geometryVersions } from './geometry-versions';
import { units } from './units';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

const postgis = (spec: string) =>
  customType<{ data: unknown; driverData: string }>({
    dataType: () => `geometry(${spec}, 4326)`,
  });
const geomPolygon = postgis('Polygon');

export const unitGeometries = core.table(
  'unit_geometries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    geometryVersionId: uuid('geometry_version_id')
      .notNull()
      .references(() => geometryVersions.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id').notNull().references(() => units.id),
    geom: geomPolygon('geom').notNull(),
    // Cached derivation for the FR-PM6a skeleton view (FR-C33): edge lengths (m), bearings, adjacent plot ids.
    edgeData: jsonb('edge_data'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('unit_geometries_version_unit_uq').on(t.geometryVersionId, t.unitId),
    index('unit_geometries_gix').using('gist', t.geom),
    check('unit_geometries_valid', sql`ST_IsValid(geom)`),
    check('unit_geometries_not_empty', sql`NOT ST_IsEmpty(geom)`),
  ],
);
