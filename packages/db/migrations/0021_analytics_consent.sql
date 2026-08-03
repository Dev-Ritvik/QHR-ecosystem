-- packages/db/migrations/0021_analytics_consent.sql
--
-- Spatial analytics + consent storage. See docs/analytics-and-consent-spec.md.
--
-- Every statement is idempotent, per the convention the rest of this directory
-- follows (and which 0009/0010 broke badly enough that the set could not be
-- applied to an empty server until it was fixed).

-- =============================================================================
-- PART 1: VISITOR SESSIONS
-- =============================================================================
-- One row per browser session. `id` IS the qhr_sid cookie value, minted by the
-- public site's middleware, so no extra lookup is needed to stitch.
--
-- The consent columns are stored per session rather than only in the cookie
-- because we must be able to prove, later, what a given visitor had agreed to
-- at the moment each event was recorded. A cookie the visitor has since changed
-- is not evidence.
CREATE TABLE IF NOT EXISTS core.visitor_sessions (
  id                  uuid PRIMARY KEY,
  visitor_id          uuid,
  consent_version     smallint NOT NULL,
  consent_experience  boolean  NOT NULL DEFAULT false,
  consent_analytics   boolean  NOT NULL DEFAULT false,
  consent_marketing   boolean  NOT NULL DEFAULT false,
  first_seen_at       timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at        timestamp with time zone NOT NULL DEFAULT now(),
  referrer            text,
  utm_source          varchar(120),
  utm_medium          varchar(120),
  utm_campaign        varchar(160),
  utm_term            varchar(160),
  utm_content         varchar(160),
  -- Measured, never inferred from a GPU model string: spec §9 rules out
  -- hardware-based profiling, and §10 requires frame-time tiering instead.
  device_tier         varchar(8),
  viewport_w          smallint,
  viewport_h          smallint,
  total_dwell_ms      integer NOT NULL DEFAULT 0,
  places_visited      smallint NOT NULL DEFAULT 0,
  max_scroll_pct      smallint,
  lead_id             uuid,
  created_at          timestamp with time zone NOT NULL DEFAULT now(),
  updated_at          timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE core.visitor_sessions
    ADD CONSTRAINT visitor_sessions_lead_id_leads_id_fk
    FOREIGN KEY (lead_id) REFERENCES core.leads(id)
    ON DELETE SET NULL ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE core.visitor_sessions
    ADD CONSTRAINT visitor_sessions_scroll_pct_range
    CHECK (max_scroll_pct IS NULL OR (max_scroll_pct BETWEEN 0 AND 100));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE core.visitor_sessions
    ADD CONSTRAINT visitor_sessions_device_tier_valid
    CHECK (device_tier IS NULL OR device_tier IN ('high', 'mid', 'low'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- A visitor_id may only exist where analytics consent was given. Enforced here
-- rather than trusted from the app, because this is the single constraint that
-- separates "remembering a returning visitor" from "tracking one".
DO $$ BEGIN
  ALTER TABLE core.visitor_sessions
    ADD CONSTRAINT visitor_sessions_vid_requires_consent
    CHECK (visitor_id IS NULL OR consent_analytics);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS visitor_sessions_visitor_idx
  ON core.visitor_sessions USING btree (visitor_id) WHERE visitor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS visitor_sessions_lead_idx
  ON core.visitor_sessions USING btree (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS visitor_sessions_last_seen_idx
  ON core.visitor_sessions USING btree (last_seen_at);

-- =============================================================================
-- PART 2: SESSION EVENTS
-- =============================================================================
-- Partitioned monthly on occurred_at. Retention (spec §11: 13 months raw) then
-- becomes DETACH + DROP of a whole partition rather than a mass DELETE over a
-- table that will be the largest in the database.
--
-- The partition key must be part of the primary key, hence (id, occurred_at).
CREATE TABLE IF NOT EXISTS core.session_events (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL,
  event        varchar(48) NOT NULL,
  place_id     varchar(64),
  -- Free-form per event type. Deliberately NOT a wide column set: the taxonomy
  -- will grow, and a jsonb payload keeps that from being a migration each time.
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at  timestamp with time zone NOT NULL DEFAULT now(),
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- No FK to visitor_sessions: Postgres cannot enforce a foreign key from a
-- partitioned table onto another table's primary key without pinning every
-- partition, and the collector already refuses events whose session it did not
-- itself create. Orphan sweep belongs in the retention job.
CREATE INDEX IF NOT EXISTS session_events_session_idx
  ON core.session_events USING btree (session_id, occurred_at);
CREATE INDEX IF NOT EXISTS session_events_event_idx
  ON core.session_events USING btree (event, occurred_at);

-- Creates any missing monthly partitions from one month back to `ahead` months
-- forward. Called once here and intended to be called by the monthly cron, so
-- an unattended deployment cannot start rejecting inserts because nobody
-- remembered to add next month's partition.
CREATE OR REPLACE FUNCTION core.ensure_session_event_partitions(ahead integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  i          integer;
  start_ts   timestamptz;
  end_ts     timestamptz;
  part_name  text;
  made       integer := 0;
BEGIN
  FOR i IN -1..ahead LOOP
    start_ts := date_trunc('month', now()) + (i || ' month')::interval;
    end_ts   := start_ts + interval '1 month';
    part_name := format('session_events_%s', to_char(start_ts, 'YYYYMM'));

    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'core' AND c.relname = part_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE core.%I PARTITION OF core.session_events FOR VALUES FROM (%L) TO (%L)',
        part_name, start_ts, end_ts);
      EXECUTE format('GRANT SELECT, INSERT ON core.%I TO crm_app', part_name);
      made := made + 1;
    END IF;
  END LOOP;
  RETURN made;
END;
$$;

SELECT core.ensure_session_event_partitions(3);

-- =============================================================================
-- PART 3: LEAD SCORING + ROUTING
-- =============================================================================
ALTER TABLE core.leads ADD COLUMN IF NOT EXISTS lead_score smallint;
ALTER TABLE core.leads ADD COLUMN IF NOT EXISTS lead_score_breakdown jsonb;
ALTER TABLE core.leads ADD COLUMN IF NOT EXISTS session_id uuid;
-- Text, not an FK: there is no branches table yet. When one lands, this becomes
-- a real reference. Recorded as a known gap rather than inventing a table the
-- CRM has not asked for.
ALTER TABLE core.leads ADD COLUMN IF NOT EXISTS routed_branch varchar(60);
ALTER TABLE core.leads ADD COLUMN IF NOT EXISTS routing_reason text;

DO $$ BEGIN
  ALTER TABLE core.leads
    ADD CONSTRAINT leads_lead_score_range
    CHECK (lead_score IS NULL OR (lead_score BETWEEN 0 AND 100));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS leads_lead_score_idx
  ON core.leads USING btree (lead_score DESC NULLS LAST);

-- =============================================================================
-- PART 4: GRANTS + RLS
-- =============================================================================
GRANT SELECT, INSERT, UPDATE ON core.visitor_sessions TO crm_app;
GRANT SELECT, INSERT ON core.session_events TO crm_app;
GRANT EXECUTE ON FUNCTION core.ensure_session_event_partitions(integer) TO crm_app;

ALTER TABLE core.visitor_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS visitor_sessions_scoping ON core.visitor_sessions;
-- Agents see a session only once it is stitched to a lead assigned to them.
-- Raw, unstitched telemetry is owner-scope only: before a form is submitted it
-- belongs to an anonymous person, and the sales floor has no business browsing it.
CREATE POLICY visitor_sessions_scoping ON core.visitor_sessions
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR EXISTS (
      SELECT 1 FROM core.leads l
      WHERE l.id = core.visitor_sessions.lead_id
        AND l.assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

ALTER TABLE core.session_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_events_scoping ON core.session_events;
CREATE POLICY session_events_scoping ON core.session_events
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR EXISTS (
      SELECT 1
      FROM core.visitor_sessions s
      JOIN core.leads l ON l.id = s.lead_id
      WHERE s.id = core.session_events.session_id
        AND l.assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );
