-- packages/db/migrations/0004_site_visits_documents.sql

DO $$ BEGIN
 CREATE TYPE "core"."visit_status" AS ENUM('scheduled', 'completed', 'cancelled', 'no_show');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."document_scope" AS ENUM('project', 'unit', 'booking', 'client');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."document_status" AS ENUM('missing', 'pending', 'on_file', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "core"."site_visits" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "agent_id" uuid NOT NULL,
    "status" "core"."visit_status" DEFAULT 'scheduled' NOT NULL,
    "pickup_point" text,
    "vehicle_note" text,
    "general_note" text,
    "outcome_captured_at" timestamp with time zone,
    "created_by_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "core"."site_visit_leads" (
    "visit_id" uuid NOT NULL,
    "lead_id" uuid NOT NULL,
    PRIMARY KEY ("visit_id", "lead_id")
);

CREATE TABLE IF NOT EXISTS "core"."site_visit_units" (
    "visit_id" uuid NOT NULL,
    "unit_id" uuid NOT NULL,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "outcomes" text[],
    "outcome_note" text,
    PRIMARY KEY ("visit_id", "unit_id")
);

CREATE TABLE IF NOT EXISTS "core"."documents" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "scope" "core"."document_scope" NOT NULL,
    "project_id" uuid,
    "unit_id" uuid,
    "booking_id" uuid,
    "client_id" uuid,
    "checklist_key" varchar(60) NOT NULL,
    "title" text NOT NULL,
    "status" "core"."document_status" DEFAULT 'missing' NOT NULL,
    "storage_path" text,
    "file_name" text,
    "mime_type" varchar(100),
    "size_bytes" bigint,
    "valid_from" date,
    "expiry_date" date,
    "uploaded_by_id" uuid,
    "uploaded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "archived_at" timestamp with time zone
);

DO $$ BEGIN
 ALTER TABLE "core"."site_visits" ADD CONSTRAINT "site_visits_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."site_visits" ADD CONSTRAINT "site_visits_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."site_visit_leads" ADD CONSTRAINT "site_visit_leads_visit_id_site_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "core"."site_visits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."site_visit_leads" ADD CONSTRAINT "site_visit_leads_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "core"."leads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."site_visit_units" ADD CONSTRAINT "site_visit_units_visit_id_site_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "core"."site_visits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."site_visit_units" ADD CONSTRAINT "site_visit_units_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "core"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."documents" ADD CONSTRAINT "documents_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."documents" ADD CONSTRAINT "documents_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "core"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "core"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."documents" ADD CONSTRAINT "documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "site_visits_agent_time_idx" ON "core"."site_visits" USING btree ("agent_id", "scheduled_at");
CREATE INDEX IF NOT EXISTS "site_visits_uncaptured_idx" ON "core"."site_visits" USING btree ("agent_id") WHERE status = 'completed' AND outcome_captured_at IS NULL;

CREATE INDEX IF NOT EXISTS "documents_unit_idx" ON "core"."documents" USING btree ("unit_id") WHERE unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "documents_booking_idx" ON "core"."documents" USING btree ("booking_id") WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "documents_expiry_idx" ON "core"."documents" USING btree ("expiry_date") WHERE expiry_date IS NOT NULL AND archived_at IS NULL;

ALTER TABLE "core"."documents" ADD CONSTRAINT "documents_exactly_one_owner" CHECK (num_nonnulls(project_id, unit_id, booking_id, client_id) = 1);
ALTER TABLE "core"."documents" ADD CONSTRAINT "documents_scope_matches_owner" CHECK (
  (scope = 'project' AND project_id IS NOT NULL) OR
  (scope = 'unit'    AND unit_id    IS NOT NULL) OR
  (scope = 'booking' AND booking_id IS NOT NULL) OR
  (scope = 'client'  AND client_id  IS NOT NULL)
);
ALTER TABLE "core"."documents" ADD CONSTRAINT "documents_on_file_has_file" CHECK (status <> 'on_file' OR storage_path IS NOT NULL);
