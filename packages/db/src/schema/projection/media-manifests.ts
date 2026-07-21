import { sql } from 'drizzle-orm';
import { uuid, text, smallint, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { projection, pubMediaKind } from './enums';
import { projectsPub } from './projects-pub';

const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const mediaManifests = projection.table(
  'media_manifests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsPub.projectId, { onDelete: 'cascade' }),
    unitId: uuid('unit_id'), // NULL = project-level media
    kind: pubMediaKind('kind').notNull(),
    altText: text('alt_text').notNull(),
    sortOrder: smallint('sort_order').notNull().default(0),
    variants: jsonb('variants').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('media_manifests_project_kind_idx').on(t.projectId, t.kind, t.sortOrder),
    uniqueIndex('media_manifests_singleton_kinds_uq')
      .on(t.projectId, t.kind)
      .where(sql`kind IN ('hero','og_image') AND unit_id IS NULL`),
  ],
);
