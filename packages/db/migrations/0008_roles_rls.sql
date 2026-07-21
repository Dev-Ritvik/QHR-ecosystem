-- packages/db/migrations/0008_roles_rls.sql

-- ==============================================================================
-- PART 1: ROLES & GRANTS (from packages/db/sql/roles.sql)
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'crm_app') THEN
    EXECUTE 'CREATE ROLE crm_app';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'projection_reader') THEN
    EXECUTE 'CREATE ROLE projection_reader';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA core TO crm_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA core TO crm_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA core TO crm_app;

REVOKE UPDATE, DELETE ON core.payment_ledger FROM crm_app;
REVOKE UPDATE, DELETE ON core.audit_log FROM crm_app;
REVOKE UPDATE, DELETE ON core.unit_status_events FROM crm_app;
REVOKE UPDATE, DELETE ON core.lead_events FROM crm_app;
REVOKE UPDATE, DELETE ON core.commission_overrides FROM crm_app;

GRANT SELECT, INSERT ON core.payment_ledger, core.audit_log, core.unit_status_events, core.lead_events, core.commission_overrides TO crm_app;

REVOKE ALL ON SCHEMA core FROM projection_reader;
GRANT USAGE ON SCHEMA projection TO projection_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA projection TO projection_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA projection GRANT SELECT ON TABLES TO projection_reader;

GRANT USAGE ON SCHEMA projection TO crm_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA projection TO crm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA projection GRANT ALL PRIVILEGES ON TABLES TO crm_app;

-- ==============================================================================
-- PART 2: ROW LEVEL SECURITY (from packages/db/sql/rls.sql)
-- ==============================================================================

ALTER TABLE core.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_agent_scoping ON core.leads
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

ALTER TABLE core.lead_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_events_negotiation ON core.lead_events
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR (
      type != 'negotiation'
      AND EXISTS (
        SELECT 1 FROM core.leads
        WHERE core.leads.id = core.lead_events.lead_id
          AND core.leads.assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      )
    )
  );

ALTER TABLE core.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_rules_owner_only ON core.commission_rules
  FOR ALL TO crm_app
  USING (current_setting('app.role', true) = 'owner');

ALTER TABLE core.commission_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_entries_owner_only ON core.commission_entries
  FOR ALL TO crm_app
  USING (current_setting('app.role', true) = 'owner');

ALTER TABLE core.commission_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_overrides_owner_only ON core.commission_overrides
  FOR ALL TO crm_app
  USING (current_setting('app.role', true) = 'owner');

ALTER TABLE core.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_owner_only ON core.audit_log
  FOR ALL TO crm_app
  USING (current_setting('app.role', true) = 'owner');
