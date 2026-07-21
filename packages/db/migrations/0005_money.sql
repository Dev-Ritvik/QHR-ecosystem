-- packages/db/migrations/0005_money.sql

DO $$ BEGIN
 CREATE TYPE "core"."ledger_entry_type" AS ENUM('token', 'installment', 'registration', 'refund', 'reversal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."payment_mode" AS ENUM('cash', 'cheque', 'dd', 'upi', 'bank_transfer', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."payee_type" AS ENUM('agent', 'channel_partner', 'referrer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."commission_tranche" AS ENUM('token', 'agreement', 'registration');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "core"."commission_entry_status" AS ENUM('accrued', 'due', 'paid', 'voided');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "core"."payment_ledger" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY NOT NULL,
    "booking_id" uuid NOT NULL,
    "entry_type" "core"."ledger_entry_type" NOT NULL,
    "amount_paise" bigint NOT NULL,
    "paid_on" date NOT NULL,
    "mode" "core"."payment_mode" NOT NULL,
    "reference" varchar(120),
    "note" text,
    "reverses_entry_id" bigint,
    "created_by_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "core"."commission_rules" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    "project_id" uuid,
    "rate_bps" integer NOT NULL,
    "tranche_split" jsonb DEFAULT '{"token": 0, "agreement": 0, "registration": 100}'::jsonb NOT NULL,
    "effective_from" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "archived_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "core"."commission_entries" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    "booking_id" uuid NOT NULL,
    "rule_id" uuid,
    "payee_type" "core"."payee_type" NOT NULL,
    "payee_user_id" uuid,
    "payee_name" text,
    "payee_phone" varchar(16),
    "tranche" "core"."commission_tranche" NOT NULL,
    "basis_amount_paise" bigint NOT NULL,
    "computed_amount_paise" bigint NOT NULL,
    "status" "core"."commission_entry_status" DEFAULT 'accrued' NOT NULL,
    "paid_on" date,
    "payment_reference" varchar(120),
    "voided_at" timestamp with time zone,
    "void_reason" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "core"."commission_overrides" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    "entry_id" uuid NOT NULL,
    "previous_amount_paise" bigint NOT NULL,
    "overridden_amount_paise" bigint NOT NULL,
    "reason" text NOT NULL,
    "actor_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Foreign keys
DO $$ BEGIN
 ALTER TABLE "core"."payment_ledger" ADD CONSTRAINT "payment_ledger_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "core"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."payment_ledger" ADD CONSTRAINT "payment_ledger_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."commission_rules" ADD CONSTRAINT "commission_rules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "core"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."commission_rules" ADD CONSTRAINT "commission_rules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."commission_entries" ADD CONSTRAINT "commission_entries_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "core"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."commission_entries" ADD CONSTRAINT "commission_entries_rule_id_commission_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "core"."commission_rules"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."commission_entries" ADD CONSTRAINT "commission_entries_payee_user_id_users_id_fk" FOREIGN KEY ("payee_user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."commission_overrides" ADD CONSTRAINT "commission_overrides_entry_id_commission_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "core"."commission_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."commission_overrides" ADD CONSTRAINT "commission_overrides_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "core"."payment_ledger" ADD CONSTRAINT "payment_ledger_reverses_fk" FOREIGN KEY ("reverses_entry_id") REFERENCES "core"."payment_ledger"("id");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "payment_ledger_booking_idx" ON "core"."payment_ledger" ("booking_id","created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "commission_rules_one_live_uq" ON "core"."commission_rules" (COALESCE(project_id::text, 'office_default')) WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "commission_entries_uq" ON "core"."commission_entries" ("booking_id","tranche",COALESCE(payee_user_id::text, payee_name)) WHERE voided_at IS NULL;
CREATE INDEX IF NOT EXISTS "commission_entries_payee_idx" ON "core"."commission_entries" ("payee_user_id") WHERE payee_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "commission_overrides_entry_idx" ON "core"."commission_overrides" ("entry_id");

-- Checks
ALTER TABLE "core"."payment_ledger" ADD CONSTRAINT "payment_ledger_amount_nonzero" CHECK (amount_paise <> 0);
ALTER TABLE "core"."payment_ledger" ADD CONSTRAINT "payment_ledger_sign_matches_type" CHECK (
  (entry_type IN ('token','installment','registration') AND amount_paise > 0) OR
  (entry_type IN ('refund','reversal') AND amount_paise < 0)
);
ALTER TABLE "core"."payment_ledger" ADD CONSTRAINT "payment_ledger_reversal_link" CHECK ((entry_type = 'reversal') = (reverses_entry_id IS NOT NULL));

ALTER TABLE "core"."commission_rules" ADD CONSTRAINT "commission_rules_rate_range" CHECK (rate_bps BETWEEN 0 AND 10000);

ALTER TABLE "core"."commission_entries" ADD CONSTRAINT "commission_entries_payee_shape" CHECK (
  (payee_type = 'agent' AND payee_user_id IS NOT NULL) OR
  (payee_type <> 'agent' AND payee_name IS NOT NULL)
);
ALTER TABLE "core"."commission_entries" ADD CONSTRAINT "commission_entries_amounts" CHECK (basis_amount_paise >= 0 AND computed_amount_paise >= 0);
ALTER TABLE "core"."commission_entries" ADD CONSTRAINT "commission_entries_paid_shape" CHECK ((status = 'paid') = (paid_on IS NOT NULL));
ALTER TABLE "core"."commission_entries" ADD CONSTRAINT "commission_entries_void_shape" CHECK ((status = 'voided') = (voided_at IS NOT NULL));

ALTER TABLE "core"."commission_overrides" ADD CONSTRAINT "commission_overrides_amount_nonnegative" CHECK (overridden_amount_paise >= 0);
