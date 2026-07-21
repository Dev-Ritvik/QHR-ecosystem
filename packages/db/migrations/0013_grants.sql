-- packages/db/migrations/0013_grants.sql

-- office_settings was created in 0010_office_settings.sql with no grant at all:
-- crm_app had zero privileges on it (verified live 2026-07-15).
GRANT SELECT, INSERT, UPDATE, DELETE ON core.office_settings TO crm_app;

-- Future tables in core receive crm_app privileges automatically. Previously
-- only the projection schema had this treatment, which is how office_settings
-- ended up unreachable.
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT ALL PRIVILEGES ON TABLES TO crm_app;

-- Re-assert the append-only surfaces so the default grant above can never
-- broaden them (and so a fresh deploy converges to the same state as live).
REVOKE UPDATE, DELETE, TRUNCATE ON core.payment_ledger FROM crm_app;
REVOKE UPDATE, DELETE, TRUNCATE ON core.audit_log FROM crm_app;
REVOKE UPDATE, DELETE, TRUNCATE ON core.unit_status_events FROM crm_app;
REVOKE UPDATE, DELETE, TRUNCATE ON core.lead_events FROM crm_app;
REVOKE UPDATE, DELETE, TRUNCATE ON core.commission_overrides FROM crm_app;
