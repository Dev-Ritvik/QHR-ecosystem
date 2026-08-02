-- packages/db/migrations/0010_media.sql
CREATE TYPE "core"."media_kind" AS ENUM('hero', 'gallery', 'plan', 'og_image');
--> statement-breakpoint
CREATE TYPE "core"."media_status" AS ENUM('uploading', 'processing', 'ready', 'failed');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"unit_id" uuid,
	"kind" "core"."media_kind" NOT NULL,
	"status" "core"."media_status" DEFAULT 'uploading' NOT NULL,
	"storage_path" text,
	"variants" jsonb,
	"alt_text" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"uploaded_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_project_kind_idx" ON "core"."media" USING btree ("project_id","kind","sort_order");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core"."media" ADD CONSTRAINT "media_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "core"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core"."media" ADD CONSTRAINT "media_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core"."media" ADD CONSTRAINT "media_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "core"."media" ADD CONSTRAINT "media_ready_has_variants" CHECK (status <> 'ready' OR variants IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "core"."media" ADD CONSTRAINT "media_ready_has_path" CHECK (status <> 'ready' OR storage_path IS NOT NULL);
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "projection"."pub_media_kind" AS ENUM('hero', 'gallery', 'plan', 'og_image');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projection"."media_manifests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"unit_id" uuid,
	"kind" "projection"."pub_media_kind" NOT NULL,
	"alt_text" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"variants" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_manifests_project_kind_idx" ON "projection"."media_manifests" USING btree ("project_id","kind","sort_order");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "media_manifests_singleton_kinds_uq" ON "projection"."media_manifests" USING btree ("project_id","kind") WHERE kind IN ('hero','og_image') AND unit_id IS NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projection"."media_manifests" ADD CONSTRAINT "media_manifests_project_id_projects_pub_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projection"."projects_pub"("project_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
