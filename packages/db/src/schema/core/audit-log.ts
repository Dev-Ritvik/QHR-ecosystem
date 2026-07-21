import { sql } from 'drizzle-orm';
import { uuid, varchar, text, bigint, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { core } from './enums';
import { users } from './auth';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const auditLog = core.table(
  'audit_log',
  {
    id: bigint('id', { mode: 'bigint' }).generatedAlwaysAsIdentity().primaryKey(),
    actorId: uuid('actor_id').references(() => users.id), // NULL = system job (cron, reconciler)
    action: varchar('action', { length: 80 }).notNull(), // 'unit.status_change','ledger.append','export.leads',…
    entityType: varchar('entity_type', { length: 60 }).notNull(),
    entityId: text('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_actor_idx').on(t.actorId, t.createdAt),
    index('audit_log_time_idx').on(t.createdAt),
  ],
);
