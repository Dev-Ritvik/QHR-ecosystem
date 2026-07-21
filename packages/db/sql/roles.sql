-- packages/db/sql/roles.sql

-- 1. Create DB roles if they don't exist
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

-- 2. Core Schema Grants for CRM
GRANT USAGE ON SCHEMA core TO crm_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA core TO crm_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA core TO crm_app;

-- 4. Append-Only Enforcement (NFR-S7): App role can INSERT and SELECT, never UPDATE/DELETE
REVOKE UPDATE, DELETE ON core.payment_ledger FROM crm_app;
REVOKE UPDATE, DELETE ON core.audit_log FROM crm_app;
REVOKE UPDATE, DELETE ON core.unit_status_events FROM crm_app;
REVOKE UPDATE, DELETE ON core.lead_events FROM crm_app;
REVOKE UPDATE, DELETE ON core.commission_overrides FROM crm_app;

-- Re-grant SELECT/INSERT explicitly to ensure intended access remains
GRANT SELECT, INSERT ON core.payment_ledger, core.audit_log, core.unit_status_events, core.lead_events, core.commission_overrides TO crm_app;

-- 5. The One-Way Valve (NFR-S1): Public/presentation role sees ONLY the projection schema
REVOKE ALL ON SCHEMA core FROM projection_reader;
GRANT USAGE ON SCHEMA projection TO projection_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA projection TO projection_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA projection GRANT SELECT ON TABLES TO projection_reader;

-- 6. Projection Write Access: CRM publish() is the sole writer (§4.3)
GRANT USAGE ON SCHEMA projection TO crm_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA projection TO crm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA projection GRANT ALL PRIVILEGES ON TABLES TO crm_app;
