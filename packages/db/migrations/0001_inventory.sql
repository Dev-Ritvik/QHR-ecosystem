-- packages/db/migrations/0001_inventory.sql

DO $$ BEGIN
 CREATE TYPE "core"."asset_class" AS ENUM('land', 'commercial', 'luxury_residential');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."price_visibility" AS ENUM('public', 'on_request');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."unit_status" AS ENUM('available', 'on_hold', 'booked', 'registered', 'sold', 'not_for_sale');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."unit_facing" AS ENUM('north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."land_extent_unit" AS ENUM('sq_yd', 'sq_ft', 'acre', 'gunta', 'cent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."approval_authority" AS ENUM('dtcp', 'hmda', 'rera', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."land_conversion_status" AS ENUM('not_required', 'pending', 'converted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."cert_status" AS ENUM('not_applied', 'applied', 'received');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."possession_status" AS ENUM('under_construction', 'near_possession', 'ready_to_move');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."rate_basis" AS ENUM('per_sq_yd', 'per_sq_ft', 'lump_sum');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "core"."projects" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "slug" varchar(120) NOT NULL,
    "name" text NOT NULL,
    "asset_class" "core"."asset_class" NOT NULL,
    "narrative" text,
    "locality" text,
    "city" text,
    "state" text,
    "approval_authority" "core"."approval_authority",
    "approval_number" varchar(100),
    "rera_number" varchar(100),
    "amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "price_visibility" "core"."price_visibility" DEFAULT 'on_request' NOT NULL,
    "selling_fast_threshold_pct" smallint DEFAULT 15 NOT NULL,
    "centroid" geometry(Point, 4326),
    "published_at" timestamp with time zone,
    "created_by_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "archived_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "core"."price_versions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" uuid NOT NULL,
    "version_no" integer NOT NULL,
    "rate_basis" "core"."rate_basis" NOT NULL,
    "base_rate_paise" bigint NOT NULL,
    "premiums" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "reason" text NOT NULL,
    "created_by_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "activated_at" timestamp with time zone,
    "superseded_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "core"."units" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" uuid NOT NULL,
    "unit_number" varchar(40) NOT NULL,
    "status" "core"."unit_status" DEFAULT 'available' NOT NULL,
    "status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
    "facing" "core"."unit_facing",
    "is_corner" boolean DEFAULT false NOT NULL,
    "road_width_m" double precision,
    "area_sq_yd" double precision,
    "area_sq_ft" double precision,
    "dimensions_label" varchar(40),
    "price_version_id" uuid,
    "computed_price_paise" bigint,
    "override_price_paise" bigint,
    "override_reason" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "archived_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "core"."unit_land_details" (
    "unit_id" uuid PRIMARY KEY NOT NULL,
    "survey_number" varchar(80) NOT NULL,
    "subdivision_lineage" text,
    "extent_value" double precision,
    "extent_unit" "core"."land_extent_unit",
    "approval_authority" "core"."approval_authority",
    "approval_number" varchar(100),
    "conversion_status" "core"."land_conversion_status" DEFAULT 'not_required' NOT NULL
);

CREATE TABLE IF NOT EXISTS "core"."unit_commercial_details" (
    "unit_id" uuid PRIMARY KEY NOT NULL,
    "rera_number" varchar(100),
    "carpet_area_sq_ft" double precision,
    "built_up_area_sq_ft" double precision,
    "super_built_up_area_sq_ft" double precision,
    "floor_number" smallint,
    "far_context" text,
    "is_tenanted" boolean DEFAULT false NOT NULL,
    "lease_terms" text
);

CREATE TABLE IF NOT EXISTS "core"."unit_luxury_details" (
    "unit_id" uuid PRIMARY KEY NOT NULL,
    "configuration" varchar(40),
    "possession_status" "core"."possession_status" DEFAULT 'under_construction' NOT NULL,
    "rera_number" varchar(100),
    "rera_completion_date" date,
    "oc_status" "core"."cert_status" DEFAULT 'not_applied' NOT NULL,
    "cc_status" "core"."cert_status" DEFAULT 'not_applied' NOT NULL,
    "amenities" jsonb DEFAULT '[]'::jsonb NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "core"."projects" ADD CONSTRAINT "projects_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."price_versions" ADD CONSTRAINT "price_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "core"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."price_versions" ADD CONSTRAINT "price_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."units" ADD CONSTRAINT "units_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "core"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."units" ADD CONSTRAINT "units_price_version_id_price_versions_id_fk" FOREIGN KEY ("price_version_id") REFERENCES "core"."price_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."unit_land_details" ADD CONSTRAINT "unit_land_details_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."unit_commercial_details" ADD CONSTRAINT "unit_commercial_details_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."unit_luxury_details" ADD CONSTRAINT "unit_luxury_details_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "projects_slug_live_uq" ON "core"."projects" USING btree ("slug") WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "price_versions_project_no_uq" ON "core"."price_versions" USING btree ("project_id", "version_no");
CREATE UNIQUE INDEX IF NOT EXISTS "price_versions_one_active_uq" ON "core"."price_versions" USING btree ("project_id") WHERE activated_at IS NOT NULL AND superseded_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "units_project_number_live_uq" ON "core"."units" USING btree ("project_id", "unit_number") WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS "units_project_status_idx" ON "core"."units" USING btree ("project_id", "status");
CREATE INDEX IF NOT EXISTS "unit_land_survey_idx" ON "core"."unit_land_details" USING btree ("survey_number");

ALTER TABLE "core"."projects" ADD CONSTRAINT "projects_threshold_range" CHECK (selling_fast_threshold_pct BETWEEN 0 AND 100);
ALTER TABLE "core"."projects" ADD CONSTRAINT "projects_centroid_valid" CHECK (centroid IS NULL OR ST_IsValid(centroid));
ALTER TABLE "core"."price_versions" ADD CONSTRAINT "price_versions_rate_positive" CHECK (base_rate_paise > 0);
ALTER TABLE "core"."units" ADD CONSTRAINT "units_override_needs_reason" CHECK (override_price_paise IS NULL OR override_reason IS NOT NULL);
ALTER TABLE "core"."units" ADD CONSTRAINT "units_areas_positive" CHECK (
  (area_sq_yd IS NULL OR area_sq_yd > 0) AND
  (area_sq_ft IS NULL OR area_sq_ft > 0) AND
  (road_width_m IS NULL OR road_width_m > 0)
);
ALTER TABLE "core"."units" ADD CONSTRAINT "units_prices_positive" CHECK (
  (computed_price_paise IS NULL OR computed_price_paise > 0) AND
  (override_price_paise IS NULL OR override_price_paise > 0)
);
ALTER TABLE "core"."unit_land_details" ADD CONSTRAINT "unit_land_extent_pair" CHECK ((extent_value IS NULL) = (extent_unit IS NULL));
ALTER TABLE "core"."unit_land_details" ADD CONSTRAINT "unit_land_extent_positive" CHECK (extent_value IS NULL OR extent_value > 0);
ALTER TABLE "core"."unit_commercial_details" ADD CONSTRAINT "unit_commercial_area_order" CHECK (
  (carpet_area_sq_ft IS NULL OR built_up_area_sq_ft IS NULL OR carpet_area_sq_ft <= built_up_area_sq_ft) AND
  (built_up_area_sq_ft IS NULL OR super_built_up_area_sq_ft IS NULL OR built_up_area_sq_ft <= super_built_up_area_sq_ft)
);
ALTER TABLE "core"."unit_commercial_details" ADD CONSTRAINT "unit_commercial_tenanted_terms" CHECK (NOT is_tenanted OR lease_terms IS NOT NULL);
