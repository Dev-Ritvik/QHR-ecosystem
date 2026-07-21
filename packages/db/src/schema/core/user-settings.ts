import { pgSchema, uuid, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './auth';

const core = pgSchema('core');

export const userSettings = core.table('user_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  emailDigest: boolean('email_digest').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
