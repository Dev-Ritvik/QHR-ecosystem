-- packages/db/migrations/0009_media.sql
CREATE TYPE "core"."media_kind" AS ENUM('hero', 'gallery', 'plan', 'og_image');
CREATE TYPE "core"."media_status" AS ENUM('uploading', 'processing', 'ready', 'failed');

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

CREATE INDEX IF NOT EXISTS "media_project_kind_idx" ON "core"."media" USING btree ("project_id", "kind", "sort_order");

ALTER TABLE "core"."media" ADD CONSTRAINT "media_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "core"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "core"."media" ADD CONSTRAINT "media_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "core"."media" ADD CONSTRAINT "media_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "core"."media" ADD CONSTRAINT "media_ready_has_variants" CHECK (status <> 'ready' OR variants IS NOT NULL);
ALTER TABLE "core"."media" ADD CONSTRAINT "media_ready_has_path" CHECK (status <> 'ready' OR storage_path IS NOT NULL);

-- Grant to crm_app (open to role because marketing collateral is not client-sensitive)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "core"."media" TO crm_app;
