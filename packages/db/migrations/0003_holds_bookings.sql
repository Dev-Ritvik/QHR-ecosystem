-- packages/db/migrations/0003_holds_bookings.sql

DO $$ BEGIN
 CREATE TYPE "core"."hold_status" AS ENUM('active', 'released', 'expired', 'converted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."booking_status" AS ENUM('active', 'converted', 'cancelled', 'defaulted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "core"."holds" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "unit_id" uuid NOT NULL,
    "client_id" uuid NOT NULL,
    "lead_id" uuid,
    "status" "core"."hold_status" DEFAULT 'active' NOT NULL,
    "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "extended_by_id" uuid,
    "extended_at" timestamp with time zone,
    "released_at" timestamp with time zone,
    "reason" text,
    "created_by_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "core"."bookings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "unit_id" uuid NOT NULL,
    "client_id" uuid NOT NULL,
    "lead_id" uuid,
    "agent_id" uuid NOT NULL,
    "status" "core"."booking_status" DEFAULT 'active' NOT NULL,
    "token_amount_paise" bigint NOT NULL,
    "consideration_paise" bigint,
    "tds_applicable" boolean GENERATED ALWAYS AS (consideration_paise IS NOT NULL AND consideration_paise > 500000000) STORED,
    "booked_on" date NOT NULL,
    "agreement_date" date,
    "registered_on" date,
    "cancelled_at" timestamp with time zone,
    "cancel_reason" text,
    "defaulted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "core"."unit_status_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "unit_id" uuid NOT NULL,
    "from_status" "core"."unit_status",
    "to_status" "core"."unit_status" NOT NULL,
    "reason" text,
    "hold_id" uuid,
    "booking_id" uuid,
    "client_id" uuid,
    "actor_id" uuid,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "core"."holds" ADD CONSTRAINT "holds_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."holds" ADD CONSTRAINT "holds_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "core"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."holds" ADD CONSTRAINT "holds_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "core"."leads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."holds" ADD CONSTRAINT "holds_extended_by_id_users_id_fk" FOREIGN KEY ("extended_by_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."holds" ADD CONSTRAINT "holds_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."bookings" ADD CONSTRAINT "bookings_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."bookings" ADD CONSTRAINT "bookings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "core"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."bookings" ADD CONSTRAINT "bookings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "core"."leads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."bookings" ADD CONSTRAINT "bookings_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."unit_status_events" ADD CONSTRAINT "unit_status_events_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."unit_status_events" ADD CONSTRAINT "unit_status_events_hold_id_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "core"."holds"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."unit_status_events" ADD CONSTRAINT "unit_status_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "core"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."unit_status_events" ADD CONSTRAINT "unit_status_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "core"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."unit_status_events" ADD CONSTRAINT "unit_status_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "holds_one_active_per_unit_uq" ON "core"."holds" USING btree ("unit_id") WHERE status = 'active';
CREATE INDEX IF NOT EXISTS "holds_expiry_idx" ON "core"."holds" USING btree ("expires_at") WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_one_active_per_unit_uq" ON "core"."bookings" USING btree ("unit_id") WHERE status = 'active';
CREATE INDEX IF NOT EXISTS "bookings_client_idx" ON "core"."bookings" USING btree ("client_id");
CREATE INDEX IF NOT EXISTS "bookings_agent_idx" ON "core"."bookings" USING btree ("agent_id");
CREATE INDEX IF NOT EXISTS "unit_status_events_unit_idx" ON "core"."unit_status_events" USING btree ("unit_id", "created_at");

ALTER TABLE "core"."holds" ADD CONSTRAINT "holds_expiry_after_start" CHECK (expires_at > starts_at);
ALTER TABLE "core"."holds" ADD CONSTRAINT "holds_released_shape" CHECK ((status IN ('released','expired','converted')) = (released_at IS NOT NULL));

ALTER TABLE "core"."bookings" ADD CONSTRAINT "bookings_token_positive" CHECK (token_amount_paise > 0);
ALTER TABLE "core"."bookings" ADD CONSTRAINT "bookings_consideration_positive" CHECK (consideration_paise IS NULL OR consideration_paise > 0);
ALTER TABLE "core"."bookings" ADD CONSTRAINT "bookings_cancel_shape" CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL));
ALTER TABLE "core"."bookings" ADD CONSTRAINT "bookings_cancel_needs_reason" CHECK (status <> 'cancelled' OR cancel_reason IS NOT NULL);
ALTER TABLE "core"."bookings" ADD CONSTRAINT "bookings_converted_registered" CHECK (status <> 'converted' OR registered_on IS NOT NULL);

ALTER TABLE "core"."unit_status_events" ADD CONSTRAINT "unit_status_events_legal_transition" CHECK (
  (from_status IS NULL AND to_status = 'available')
  OR (from_status = 'available'    AND to_status IN ('on_hold','booked','not_for_sale'))
  OR (from_status = 'on_hold'      AND to_status IN ('available','booked'))
  OR (from_status = 'booked'       AND to_status IN ('registered','available'))
  OR (from_status = 'registered'   AND to_status IN ('sold'))
  OR (from_status = 'not_for_sale' AND to_status IN ('available'))
);
ALTER TABLE "core"."unit_status_events" ADD CONSTRAINT "unit_status_events_hold_link" CHECK (to_status <> 'on_hold' OR hold_id IS NOT NULL);
ALTER TABLE "core"."unit_status_events" ADD CONSTRAINT "unit_status_events_booking_link" CHECK (to_status <> 'booked' OR booking_id IS NOT NULL);
