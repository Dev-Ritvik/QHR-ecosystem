// packages/db/src/schema/core/documents.ts
import { sql } from 'drizzle-orm';
import { uuid, text, varchar, bigint, date, timestamp, index, check } from 'drizzle-orm/pg-core';
import { core, documentScope, documentStatus, createdAt, updatedAt } from './enums';
import { users } from './auth';
import { projects } from './projects';
import { units } from './units';
import { bookings } from './bookings';
import { clients } from './clients';

export const documents = core.table(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: documentScope('scope').notNull(),
    projectId: uuid('project_id').references(() => projects.id),
    unitId: uuid('unit_id').references(() => units.id),
    bookingId: uuid('booking_id').references(() => bookings.id),
    clientId: uuid('client_id').references(() => clients.id),
    checklistKey: varchar('checklist_key', { length: 60 }).notNull(),
    title: text('title').notNull(),
    status: documentStatus('status').notNull().default('missing'),
    storagePath: text('storage_path'),
    fileName: text('file_name'),
    mimeType: varchar('mime_type', { length: 100 }),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }),
    validFrom: date('valid_from'),
    expiryDate: date('expiry_date'),
    uploadedById: uuid('uploaded_by_id').references(() => users.id),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    check('documents_exactly_one_owner', sql`num_nonnulls(project_id, unit_id, booking_id, client_id) = 1`),
    check('documents_scope_matches_owner', sql`
      (scope = 'project' AND project_id IS NOT NULL) OR
      (scope = 'unit'    AND unit_id    IS NOT NULL) OR
      (scope = 'booking' AND booking_id IS NOT NULL) OR
      (scope = 'client'  AND client_id  IS NOT NULL)
    `),
    check('documents_on_file_has_file', sql`status <> 'on_file' OR storage_path IS NOT NULL`),
    index('documents_unit_idx').on(t.unitId).where(sql`unit_id IS NOT NULL`),
    index('documents_booking_idx').on(t.bookingId).where(sql`booking_id IS NOT NULL`),
    index('documents_expiry_idx').on(t.expiryDate).where(sql`expiry_date IS NOT NULL AND archived_at IS NULL`),
  ],
);
