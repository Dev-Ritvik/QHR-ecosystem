import { pgSchema, boolean, smallint, timestamp, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const core = pgSchema('core');

export const officeSettings = core.table(
  'office_settings',
  {
    id: boolean('id').primaryKey().default(true),
    holdMaxDurationDays: smallint('hold_max_duration_days').notNull().default(7),
    overdueEscalationDays: smallint('overdue_escalation_days').notNull().default(2),
    defaultSellingFastThresholdPct: smallint('default_selling_fast_threshold_pct').notNull().default(15),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('office_settings_singleton', sql`id = true`)
  ]
);
