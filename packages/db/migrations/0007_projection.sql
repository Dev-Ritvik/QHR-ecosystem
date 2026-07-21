-- packages/db/migrations/0007_projection.sql
CREATE SCHEMA IF NOT EXISTS "projection";

DO $$ BEGIN
 CREATE TYPE "projection"."pub_asset_class" AS ENUM('land', 'commercial', 'luxury_residential');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "projection"."pub_presentation_status" AS ENUM('available', 'selling_fast', 'on_hold', 'booked', 'sold', 'not_for_sale');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "projection"."pub_feature_type" AS ENUM('plot', 'boundary', 'road', 'amenity', 'massing');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "projection"."pub_media_kind" AS ENUM('hero', 'gallery', 'plan', 'og_image');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "projection"."projects_pub" (
    "project_id" uuid PRIMARY KEY NOT NULL,
    "slug" varchar(120) NOT NULL,
    "name" text NOT NULL,
    "asset_class" "projection"."pub_asset_class" NOT NULL,
    "narrative" text NOT NULL,
    "locality" text,
    "city" text,
    "badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "total_units" integer NOT NULL,
    "available_units" integer NOT NULL,
    "is_sold_out" boolean GENERATED ALWAYS AS (available_units = 0) STORED,
    "price_visibility" text NOT NULL,
    "hero_url" text NOT NULL,
    "centroid" geometry(Point, 4326),
    "bbox" jsonb,
    "published_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "projection"."units_pub" (
    "unit_id" uuid PRIMARY KEY NOT NULL,
    "project_id" uuid NOT NULL,
    "unit_number" varchar(40) NOT NULL,
    "presentation_status" "projection"."pub_presentation_status" NOT NULL,
    "facing" text,
    "is_corner" boolean DEFAULT false NOT NULL,
    "road_width_m" double precision,
    "area_sq_yd" double precision,
    "area_sq_ft" double precision,
    "dimensions_label" varchar(40),
    "class_details" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "price_paise" bigint,
    "price_on_request" boolean DEFAULT false NOT NULL,
    "price_version_id" uuid,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "projection"."geometry_pub" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    "project_id" uuid NOT NULL,
    "unit_id" uuid,
    "feature_type" "projection"."pub_feature_type" NOT NULL,
    "geom" geometry(Geometry, 4326) NOT NULL,
    "properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "geometry_version_id" uuid NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "projection"."pois_pub" (
    "poi_id" uuid PRIMARY KEY NOT NULL,
    "project_id" uuid NOT NULL,
    "name" text NOT NULL,
    "category" text NOT NULL,
    "location" geometry(Point, 4326) NOT NULL,
    "distance_m" integer NOT NULL,
    "drive_time_min" smallint,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "projection"."media_manifests" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    "project_id" uuid NOT NULL,
    "unit_id" uuid,
    "kind" "projection"."pub_media_kind" NOT NULL,
    "alt_text" text NOT NULL,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "variants" jsonb NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Foreign keys
DO $$ BEGIN
 ALTER TABLE "projection"."units_pub" ADD CONSTRAINT "units_pub_project_id_projects_pub_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projection"."projects_pub"("project_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "projection"."geometry_pub" ADD CONSTRAINT "geometry_pub_project_id_projects_pub_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projection"."projects_pub"("project_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "projection"."pois_pub" ADD CONSTRAINT "pois_pub_project_id_projects_pub_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projection"."projects_pub"("project_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "projection"."media_manifests" ADD CONSTRAINT "media_manifests_project_id_projects_pub_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projection"."projects_pub"("project_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "projects_pub_slug_uq" ON "projection"."projects_pub" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "units_pub_project_number_uq" ON "projection"."units_pub" ("project_id","unit_number");
CREATE INDEX IF NOT EXISTS "units_pub_project_status_idx" ON "projection"."units_pub" ("project_id","presentation_status");
CREATE UNIQUE INDEX IF NOT EXISTS "geometry_pub_one_plot_per_unit_uq" ON "projection"."geometry_pub" ("unit_id") WHERE feature_type = 'plot';
CREATE INDEX IF NOT EXISTS "geometry_pub_project_type_idx" ON "projection"."geometry_pub" ("project_id","feature_type");
CREATE INDEX IF NOT EXISTS "geometry_pub_gix" ON "projection"."geometry_pub" USING gist ("geom");
CREATE INDEX IF NOT EXISTS "pois_pub_project_idx" ON "projection"."pois_pub" ("project_id","sort_order");
CREATE INDEX IF NOT EXISTS "media_manifests_project_kind_idx" ON "projection"."media_manifests" ("project_id","kind","sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "media_manifests_singleton_kinds_uq" ON "projection"."media_manifests" ("project_id","kind") WHERE kind IN ('hero','og_image') AND unit_id IS NULL;

-- Checks
ALTER TABLE "projection"."projects_pub" ADD CONSTRAINT "projects_pub_counts" CHECK (total_units >= 0 AND available_units BETWEEN 0 AND total_units);
ALTER TABLE "projection"."projects_pub" ADD CONSTRAINT "projects_pub_centroid_valid" CHECK (centroid IS NULL OR ST_IsValid(centroid));

ALTER TABLE "projection"."units_pub" ADD CONSTRAINT "units_pub_price_xor_por" CHECK (
  (price_on_request AND price_paise IS NULL) OR (NOT price_on_request AND price_paise IS NOT NULL)
);
ALTER TABLE "projection"."units_pub" ADD CONSTRAINT "units_pub_price_positive" CHECK (price_paise IS NULL OR price_paise > 0);

ALTER TABLE "projection"."geometry_pub" ADD CONSTRAINT "geometry_pub_valid" CHECK (ST_IsValid(geom));
ALTER TABLE "projection"."geometry_pub" ADD CONSTRAINT "geometry_pub_plot_has_unit" CHECK (feature_type <> 'plot' OR unit_id IS NOT NULL);

ALTER TABLE "projection"."pois_pub" ADD CONSTRAINT "pois_pub_location_valid" CHECK (ST_IsValid(location));
ALTER TABLE "projection"."pois_pub" ADD CONSTRAINT "pois_pub_distance_positive" CHECK (distance_m >= 0);
