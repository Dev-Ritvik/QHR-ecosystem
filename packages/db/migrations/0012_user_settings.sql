CREATE TABLE IF NOT EXISTS "core"."user_settings" (
  "user_id" uuid PRIMARY KEY REFERENCES "core"."users"("id") ON DELETE cascade,
  "email_digest" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "core"."user_settings" TO crm_app;

-- Seed default settings for all existing users to avoid outer-join nulls
INSERT INTO "core"."user_settings" ("user_id") 
SELECT "id" FROM "core"."users" ON CONFLICT DO NOTHING;
