// packages/db/src/schema/core/media.ts
import { sql } from 'drizzle-orm';
import { uuid, text, smallint, timestamp, jsonb, index, check } from 'drizzle-orm/pg-core';
import { core } from './enums';
import { projects } from './projects';
import { units } from './units';
import { users } from './auth';

export const mediaKind = core.enum('media_kind', ['hero', 'gallery', 'plan', 'og_image']);
export const mediaStatus = core.enum('media_status', ['uploading', 'processing', 'ready', 'failed']);

export const media = core.table(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id').references(() => units.id, { onDelete: 'cascade' }),
    kind: mediaKind('kind').notNull(),
    status: mediaStatus('status').notNull().default('uploading'),
    storagePath: text('storage_path'),
    variants: jsonb('variants'),
    altText: text('alt_text').notNull(),
    sortOrder: smallint('sort_order').notNull().default(0),
    uploadedById: uuid('uploaded_by_id').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t: any) => [
    index('media_project_kind_idx').on(t.projectId, t.kind, t.sortOrder),
    check('media_ready_has_variants', sql`status <> 'ready' OR variants IS NOT NULL`),
    check('media_ready_has_path', sql`status <> 'ready' OR storage_path IS NOT NULL`),
  ]
);
