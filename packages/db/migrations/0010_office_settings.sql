CREATE TABLE IF NOT EXISTS "core"."office_settings" (
  "id" boolean PRIMARY KEY DEFAULT true NOT NULL,
  "hold_max_duration_days" smallint DEFAULT 7 NOT NULL,
  "overdue_escalation_days" smallint DEFAULT 2 NOT NULL,
  "default_selling_fast_threshold_pct" smallint DEFAULT 15 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "office_settings_singleton" CHECK (id = true)
);

INSERT INTO "core"."office_settings" ("id") VALUES (true) ON CONFLICT DO NOTHING;
