import { pgSchema, uuid, text, varchar, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth';

const core = pgSchema('core');

export const notificationType = core.enum('notification_type', [
  'assigned_lead', 'hold_expiring', 'follow_up_due', 'visit_tomorrow', 'document_expiring'
]);

export const notifications = core.table(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    entityType: varchar('entity_type', { length: 60 }),
    entityId: text('entity_id'),
    isRead: boolean('is_read').notNull().default(false),
    // Critical for crons to avoid duplicated fan-out on repeat executions (NFR-D8 idempotency)
    dedupeKey: varchar('dedupe_key', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId, t.createdAt),
    index('notifications_unread_idx').on(t.userId).where(sql`is_read = false`),
    uniqueIndex('notifications_dedupe_uq').on(t.dedupeKey).where(sql`dedupe_key IS NOT NULL`),
  ]
);
