-- packages/db/migrations/0014_missing_policies.sql
--
-- Live drift repair (verified 2026-07-15): RLS was enabled directly on the live
-- database for 15 core tables that no migration file covers, with zero policies —
-- default-deny for crm_app. This migration records the ENABLE in the file history
-- and adds the missing policies.
--
-- Scoping logic:
--   notifications, user_settings  → owning user (plus the system/'owner' context,
--                                    which crons and the notify_lead_assigned
--                                    trigger path depend on)
--   presentation_devices          → owner-only
--   everything else               → USING (true), matching the projects/units
--                                    precedent in 0009_missing_rls.sql

-- 1. notifications: read/update own; INSERT is open because notifications are
-- created FOR other users (assigned-lead trigger fires as the assigning actor,
-- cron fan-outs run as system) — a WITH CHECK tied to app.user_id would reject
-- exactly those writes. crm_app has no DELETE grant on this table.
ALTER TABLE core.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_select_own ON core.notifications;
CREATE POLICY notifications_select_own ON core.notifications
  FOR SELECT TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );
DROP POLICY IF EXISTS notifications_insert_any ON core.notifications;
CREATE POLICY notifications_insert_any ON core.notifications
  FOR INSERT TO crm_app
  WITH CHECK (true);
DROP POLICY IF EXISTS notifications_update_own ON core.notifications;
CREATE POLICY notifications_update_own ON core.notifications
  FOR UPDATE TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

-- 2. user_settings: own row only; system/'owner' context included because the
-- digest cron reads settings across all users.
ALTER TABLE core.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_settings_scoping ON core.user_settings;
CREATE POLICY user_settings_scoping ON core.user_settings
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

-- 3. presentation_devices: owner-only (device approval is an owner action;
-- the public revocation check runs via systemQuery's owner context).
ALTER TABLE core.presentation_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS presentation_devices_owner_only ON core.presentation_devices;
CREATE POLICY presentation_devices_owner_only ON core.presentation_devices
  FOR ALL TO crm_app
  USING (current_setting('app.role', true) = 'owner');

-- 4. Role-internal tables: open to all crm_app connections.
ALTER TABLE core.office_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS office_settings_scoping ON core.office_settings;
CREATE POLICY office_settings_scoping ON core.office_settings
  FOR ALL TO crm_app USING (true);

ALTER TABLE core.media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS media_scoping ON core.media;
CREATE POLICY media_scoping ON core.media
  FOR ALL TO crm_app USING (true);

ALTER TABLE core.price_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS price_versions_scoping ON core.price_versions;
CREATE POLICY price_versions_scoping ON core.price_versions
  FOR ALL TO crm_app USING (true);

ALTER TABLE core.pois ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pois_scoping ON core.pois;
CREATE POLICY pois_scoping ON core.pois
  FOR ALL TO crm_app USING (true);

ALTER TABLE core.geometry_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geometry_versions_scoping ON core.geometry_versions;
CREATE POLICY geometry_versions_scoping ON core.geometry_versions
  FOR ALL TO crm_app USING (true);

ALTER TABLE core.unit_geometries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS unit_geometries_scoping ON core.unit_geometries;
CREATE POLICY unit_geometries_scoping ON core.unit_geometries
  FOR ALL TO crm_app USING (true);

ALTER TABLE core.unit_land_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS unit_land_details_scoping ON core.unit_land_details;
CREATE POLICY unit_land_details_scoping ON core.unit_land_details
  FOR ALL TO crm_app USING (true);

ALTER TABLE core.unit_commercial_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS unit_commercial_details_scoping ON core.unit_commercial_details;
CREATE POLICY unit_commercial_details_scoping ON core.unit_commercial_details
  FOR ALL TO crm_app USING (true);

ALTER TABLE core.unit_luxury_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS unit_luxury_details_scoping ON core.unit_luxury_details;
CREATE POLICY unit_luxury_details_scoping ON core.unit_luxury_details
  FOR ALL TO crm_app USING (true);

ALTER TABLE core.lead_interests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_interests_scoping ON core.lead_interests;
CREATE POLICY lead_interests_scoping ON core.lead_interests
  FOR ALL TO crm_app USING (true);

ALTER TABLE core.site_visit_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_visit_units_scoping ON core.site_visit_units;
CREATE POLICY site_visit_units_scoping ON core.site_visit_units
  FOR ALL TO crm_app USING (true);

ALTER TABLE core.unit_status_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS unit_status_events_scoping ON core.unit_status_events;
CREATE POLICY unit_status_events_scoping ON core.unit_status_events
  FOR ALL TO crm_app USING (true);

-- 5. Agent-scoping fixes (priority item #3): bookings.agent_id and
-- site_visits.agent_id are NOT NULL direct owner columns; check them first,
-- keeping the lead-based paths as the secondary case. Previously a booking
-- with NULL lead_id, or a visit with no site_visit_leads rows, was invisible
-- to its own assigned agent.
ALTER POLICY bookings_agent_scoping ON core.bookings
  USING (
    current_setting('app.role', true) = 'owner'
    OR agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR lead_id IN (
      SELECT id FROM core.leads
      WHERE assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

ALTER POLICY site_visits_agent_scoping ON core.site_visits
  USING (
    current_setting('app.role', true) = 'owner'
    OR agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR id IN (
      SELECT svl.visit_id FROM core.site_visit_leads svl
      JOIN core.leads l ON svl.lead_id = l.id
      WHERE l.assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );
