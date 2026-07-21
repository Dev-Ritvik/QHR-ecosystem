-- packages/db/migrations/0002_clients_leads.sql

DO $$ BEGIN
 CREATE TYPE "core"."lead_source" AS ENUM('website', 'portal_99acres', 'portal_magicbricks', 'portal_housing', 'referral', 'walk_in', 'channel_partner', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."pipeline_stage" AS ENUM('new', 'contacted', 'qualified', 'site_visit', 'negotiation', 'token', 'agreement', 'registered', 'won', 'lost', 'dormant');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."lost_reason" AS ENUM('budget', 'location', 'bought_elsewhere', 'postponed', 'unreachable', 'not_interested', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."lead_triage_status" AS ENUM('new', 'assigned', 'merged', 'spam');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."lead_event_type" AS ENUM('stage_change', 'interaction', 'note', 'assignment', 'follow_up_set', 'merge', 'negotiation');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."interaction_type" AS ENUM('call', 'whatsapp', 'meeting', 'site_visit');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."negotiation_kind" AS ENUM('asked_price', 'client_offer', 'concession', 'counter');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "core"."clients" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "phone" varchar(16) NOT NULL,
    "alt_phone" varchar(16),
    "email" varchar(320),
    "address" text,
    "pan_masked" varchar(12),
    "aadhaar_masked" varchar(16),
    "created_by_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "archived_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "core"."leads" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "phone" varchar(16) NOT NULL,
    "alt_phone" varchar(16),
    "email" varchar(320),
    "source" "core"."lead_source" NOT NULL,
    "source_detail" text,
    "budget_min_paise" bigint,
    "budget_max_paise" bigint,
    "asset_class_interest" "core"."asset_class",
    "timeline_expectation" varchar(60),
    "stage" "core"."pipeline_stage" DEFAULT 'new' NOT NULL,
    "lost_reason" "core"."lost_reason",
    "assigned_agent_id" uuid,
    "triage_status" "core"."lead_triage_status" DEFAULT 'new' NOT NULL,
    "merged_into_lead_id" uuid,
    "client_id" uuid,
    "next_follow_up_at" timestamp with time zone,
    "dedupe_key" varchar(128),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "archived_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "core"."lead_interests" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "lead_id" uuid NOT NULL,
    "project_id" uuid NOT NULL,
    "unit_id" uuid,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "core"."lead_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "lead_id" uuid NOT NULL,
    "type" "core"."lead_event_type" NOT NULL,
    "from_stage" "core"."pipeline_stage",
    "to_stage" "core"."pipeline_stage",
    "interaction_type" "core"."interaction_type",
    "outcomes" text[],
    "assigned_to_id" uuid,
    "negotiation_kind" "core"."negotiation_kind",
    "amount_paise" bigint,
    "unit_id" uuid,
    "note" text,
    "next_follow_up_at" timestamp with time zone,
    "actor_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "core"."clients" ADD CONSTRAINT "clients_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."leads" ADD CONSTRAINT "leads_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "core"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."lead_interests" ADD CONSTRAINT "lead_interests_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "core"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."lead_interests" ADD CONSTRAINT "lead_interests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "core"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."lead_interests" ADD CONSTRAINT "lead_interests_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."lead_events" ADD CONSTRAINT "lead_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "core"."leads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."lead_events" ADD CONSTRAINT "lead_events_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."lead_events" ADD CONSTRAINT "lead_events_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."lead_events" ADD CONSTRAINT "lead_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Companion SQL: Self-referencing FK for merged_into_lead_id
DO $$ BEGIN
  ALTER TABLE "core"."leads" ADD CONSTRAINT "leads_merged_into_fk" FOREIGN KEY ("merged_into_lead_id") REFERENCES "core"."leads"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "clients_phone_live_uq" ON "core"."clients" USING btree ("phone") WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "leads_dedupe_uq" ON "core"."leads" USING btree ("dedupe_key") WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS "leads_phone_idx" ON "core"."leads" USING btree ("phone");
CREATE INDEX IF NOT EXISTS "leads_agent_stage_idx" ON "core"."leads" USING btree ("assigned_agent_id", "stage");
CREATE INDEX IF NOT EXISTS "leads_followup_idx" ON "core"."leads" USING btree ("next_follow_up_at") WHERE next_follow_up_at IS NOT NULL AND archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "lead_interests_uq" ON "core"."lead_interests" USING btree ("lead_id", "project_id", "unit_id");
CREATE INDEX IF NOT EXISTS "lead_interests_project_idx" ON "core"."lead_interests" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "lead_events_lead_idx" ON "core"."lead_events" USING btree ("lead_id", "created_at");

ALTER TABLE "core"."clients" ADD CONSTRAINT "clients_phone_format" CHECK (phone ~ '^\+[1-9][0-9]{7,14}$');
ALTER TABLE "core"."leads" ADD CONSTRAINT "leads_lost_needs_reason" CHECK (stage <> 'lost' OR lost_reason IS NOT NULL);
ALTER TABLE "core"."leads" ADD CONSTRAINT "leads_budget_order" CHECK (
      budget_min_paise IS NULL OR budget_max_paise IS NULL OR budget_min_paise <= budget_max_paise
    );
ALTER TABLE "core"."leads" ADD CONSTRAINT "leads_merged_is_terminal" CHECK ((triage_status = 'merged') = (merged_into_lead_id IS NOT NULL));
ALTER TABLE "core"."lead_events" ADD CONSTRAINT "lead_events_stage_shape" CHECK (type <> 'stage_change' OR to_stage IS NOT NULL);
ALTER TABLE "core"."lead_events" ADD CONSTRAINT "lead_events_interaction_shape" CHECK (type <> 'interaction' OR interaction_type IS NOT NULL);
ALTER TABLE "core"."lead_events" ADD CONSTRAINT "lead_events_negotiation_shape" CHECK (
      type <> 'negotiation' OR (negotiation_kind IS NOT NULL AND amount_paise IS NOT NULL AND amount_paise > 0)
    );
ALTER TABLE "core"."lead_events" ADD CONSTRAINT "lead_events_assignment_shape" CHECK (type <> 'assignment' OR assigned_to_id IS NOT NULL);
