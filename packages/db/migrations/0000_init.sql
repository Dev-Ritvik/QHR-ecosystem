-- packages/db/migrations/0000_init.sql
CREATE SCHEMA IF NOT EXISTS "core";
CREATE SCHEMA IF NOT EXISTS "projection";
CREATE EXTENSION IF NOT EXISTS "postgis";

DO $$ BEGIN
 CREATE TYPE "core"."user_role" AS ENUM('owner', 'agent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "core"."users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "phone" varchar(16) NOT NULL,
    "email" varchar(320),
    "role" "core"."user_role" DEFAULT 'agent' NOT NULL,
    "deactivated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "core"."sessions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "token" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "ip_address" varchar(45),
    "user_agent" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "core"."presentation_devices" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "label" text NOT NULL,
    "token_hash" text NOT NULL,
    "scopes" text[] DEFAULT ARRAY['projection:read','prices:read'] NOT NULL,
    "approved_by_id" uuid NOT NULL,
    "approved_at" timestamp with time zone DEFAULT now() NOT NULL,
    "last_seen_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "core"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."presentation_devices" ADD CONSTRAINT "presentation_devices_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_live_uq" ON "core"."users" USING btree ("phone") WHERE deactivated_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_live_uq" ON "core"."users" USING btree ("email") WHERE deactivated_at IS NULL AND email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_uq" ON "core"."sessions" USING btree ("token");
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "core"."sessions" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "presentation_devices_token_uq" ON "core"."presentation_devices" USING btree ("token_hash");

ALTER TABLE "core"."users" ADD CONSTRAINT "users_phone_format" CHECK (phone ~ '^\+[1-9][0-9]{7,14}$');
ALTER TABLE "core"."sessions" ADD CONSTRAINT "sessions_expiry_future" CHECK (expires_at > created_at);
