CREATE TYPE "core"."notification_type" AS ENUM ('assigned_lead', 'hold_expiring', 'follow_up_due', 'visit_tomorrow', 'document_expiring');

CREATE TABLE IF NOT EXISTS "core"."notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "core"."users"("id") ON DELETE cascade,
  "type" "core"."notification_type" NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "entity_type" varchar(60),
  "entity_id" text,
  "is_read" boolean DEFAULT false NOT NULL,
  "dedupe_key" varchar(128),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "core"."notifications" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_unread_idx" ON "core"."notifications" ("user_id") WHERE is_read = false;
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_uq" ON "core"."notifications" ("dedupe_key") WHERE dedupe_key IS NOT NULL;

-- NFR-S1: Explicit grants to CRM App. Projection Reader receives nothing, physically ensuring FR-PM8.
GRANT SELECT, INSERT, UPDATE ON "core"."notifications" TO crm_app;

-- DB Trigger to handle "assigned_lead" notifications automatically without intercepting application TS code
CREATE OR REPLACE FUNCTION "core"."notify_lead_assigned"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_agent_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assigned_agent_id IS NULL OR NEW.assigned_agent_id <> OLD.assigned_agent_id) THEN
    INSERT INTO "core"."notifications" (user_id, type, title, body, entity_type, entity_id, dedupe_key)
    VALUES (
      NEW.assigned_agent_id,
      'assigned_lead',
      'New Lead Assigned',
      'You have been assigned a new lead: ' || NEW.name,
      'lead',
      NEW.id::text,
      'assigned_lead_' || NEW.id::text || '_' || EXTRACT(EPOCH FROM now())::text
    ) ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_lead_assigned ON "core"."leads";
CREATE TRIGGER trigger_notify_lead_assigned
AFTER INSERT OR UPDATE OF assigned_agent_id ON "core"."leads"
FOR EACH ROW EXECUTE FUNCTION "core"."notify_lead_assigned"();
