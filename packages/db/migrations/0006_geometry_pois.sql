-- packages/db/migrations/0006_geometry_pois.sql

DO $$ BEGIN
 CREATE TYPE "core"."geometry_version_status" AS ENUM('draft', 'active', 'superseded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."layout_source_type" AS ENUM('pdf', 'image', 'dxf');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."poi_category" AS ENUM('school', 'hospital', 'transit', 'employment_hub', 'shopping', 'leisure', 'connectivity', 'landmark', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "core"."geometry_versions" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    "project_id" uuid NOT NULL,
    "version_no" integer NOT NULL,
    "status" "core"."geometry_version_status" DEFAULT 'draft' NOT NULL,
    "source_file_path" text,
    "source_file_type" "core"."layout_source_type",
    "georef_transform" jsonb,
    "boundary_geom" geometry(MultiPolygon, 4326),
    "notes" text,
    "created_by_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "activated_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "core"."unit_geometries" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    "geometry_version_id" uuid NOT NULL,
    "unit_id" uuid NOT NULL,
    "geom" geometry(Polygon, 4326) NOT NULL,
    "edge_data" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "core"."pois" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    "project_id" uuid NOT NULL,
    "name" text NOT NULL,
    "category" "core"."poi_category" NOT NULL,
    "location" geometry(Point, 4326) NOT NULL,
    "distance_m" integer,
    "distance_override_m" integer,
    "drive_time_min" smallint,
    "drive_time_override_min" smallint,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "created_by_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "archived_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "core"."audit_log" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY NOT NULL,
    "actor_id" uuid,
    "action" varchar(80) NOT NULL,
    "entity_type" varchar(60) NOT NULL,
    "entity_id" text NOT NULL,
    "before" jsonb,
    "after" jsonb,
    "ip_address" varchar(45),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Foreign keys
DO $$ BEGIN
 ALTER TABLE "core"."geometry_versions" ADD CONSTRAINT "geometry_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "core"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."geometry_versions" ADD CONSTRAINT "geometry_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."unit_geometries" ADD CONSTRAINT "unit_geometries_geometry_version_id_geometry_versions_id_fk" FOREIGN KEY ("geometry_version_id") REFERENCES "core"."geometry_versions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."unit_geometries" ADD CONSTRAINT "unit_geometries_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."pois" ADD CONSTRAINT "pois_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "core"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."pois" ADD CONSTRAINT "pois_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "geometry_versions_project_no_uq" ON "core"."geometry_versions" ("project_id","version_no");
CREATE UNIQUE INDEX IF NOT EXISTS "geometry_versions_one_active_uq" ON "core"."geometry_versions" ("project_id") WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS "unit_geometries_version_unit_uq" ON "core"."unit_geometries" ("geometry_version_id","unit_id");
CREATE INDEX IF NOT EXISTS "unit_geometries_gix" ON "core"."unit_geometries" USING gist ("geom");

CREATE INDEX IF NOT EXISTS "pois_project_idx" ON "core"."pois" ("project_id","sort_order");

CREATE INDEX IF NOT EXISTS "audit_log_entity_idx" ON "core"."audit_log" ("entity_type","entity_id");
CREATE INDEX IF NOT EXISTS "audit_log_actor_idx" ON "core"."audit_log" ("actor_id","created_at");
CREATE INDEX IF NOT EXISTS "audit_log_time_idx" ON "core"."audit_log" ("created_at");

-- Checks
ALTER TABLE "core"."geometry_versions" ADD CONSTRAINT "geometry_versions_boundary_valid" CHECK (boundary_geom IS NULL OR ST_IsValid(boundary_geom));
ALTER TABLE "core"."geometry_versions" ADD CONSTRAINT "geometry_versions_active_shape" CHECK (status <> 'active' OR activated_at IS NOT NULL);

ALTER TABLE "core"."unit_geometries" ADD CONSTRAINT "unit_geometries_valid" CHECK (ST_IsValid(geom));
ALTER TABLE "core"."unit_geometries" ADD CONSTRAINT "unit_geometries_not_empty" CHECK (NOT ST_IsEmpty(geom));

ALTER TABLE "core"."pois" ADD CONSTRAINT "pois_location_valid" CHECK (ST_IsValid(location));
ALTER TABLE "core"."pois" ADD CONSTRAINT "pois_distances_positive" CHECK (
  (distance_m IS NULL OR distance_m >= 0) AND
  (distance_override_m IS NULL OR distance_override_m >= 0) AND
  (drive_time_min IS NULL OR drive_time_min >= 0) AND
  (drive_time_override_min IS NULL OR drive_time_override_min >= 0)
);
