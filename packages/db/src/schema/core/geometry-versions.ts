import { sql } from 'drizzle-orm';
import { uuid, integer, text, jsonb, timestamp, uniqueIndex, check, customType } from 'drizzle-orm/pg-core';
import { core } from './enums';
import { geometryVersionStatus, layoutSourceType } from './enums';
import { projects } from './projects';
import { users } from './auth';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

const postgis = (spec: string) =>
  customType<{ data: unknown; driverData: string }>({
    dataType: () => `geometry(${spec}, 4326)`,
  });
const geomMultiPolygon = postgis('MultiPolygon');

export const geometryVersions = core.table(
  'geometry_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    versionNo: integer('version_no').notNull(),
    status: geometryVersionStatus('status').notNull().default('draft'),
    sourceFilePath: text('source_file_path'), // uploaded surveyor layout in storage
    sourceFileType: layoutSourceType('source_file_type'),
    // Georeferencing transform (FR-C30): {control_points: [{layout:[x,y], map:[lng,lat]}...], affine: [...]}
    georefTransform: jsonb('georef_transform'),
    boundaryGeom: geomMultiPolygon('boundary_geom'), // project boundary traced in this version
    notes: text('notes'), // e.g. "re-survey Mar 2026, road realignment"
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('geometry_versions_project_no_uq').on(t.projectId, t.versionNo),
    uniqueIndex('geometry_versions_one_active_uq').on(t.projectId).where(sql`status = 'active'`),
    check('geometry_versions_boundary_valid', sql`boundary_geom IS NULL OR ST_IsValid(boundary_geom)`),
    check('geometry_versions_active_shape', sql`status <> 'active' OR activated_at IS NOT NULL`),
  ],
);
