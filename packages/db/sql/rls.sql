-- packages/db/sql/rls.sql

-- RLS Backstop Policies (NFR-S3)
-- Enforced on core tables via `crm_app` role. Superusers (migrations/seed) bypass RLS automatically.
-- The application data-access layer sets `app.role` and `app.user_id` context.

-- 1. Agent Lead Scoping: Agents see only their assigned leads; Owners see all.
ALTER TABLE core.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_agent_scoping ON core.leads
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

-- 2. Lead Events: Agents see only events for their assigned leads; negotiation
--    events are owner-only regardless. Owners see everything.
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

-- 3. Commission Engine: Owner-only reads and modifications.
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

-- 4. Audit Log: Owner-only visibility.
ALTER TABLE core.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_owner_only ON core.audit_log
  FOR ALL TO crm_app
  USING (current_setting('app.role', true) = 'owner');

-- 5. Holds, Bookings, Site Visits, Payment Ledger, Documents
--    Agent scoping based on the lead assigned agent.
ALTER TABLE core.holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY holds_agent_scoping ON core.holds
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR lead_id IN (
      SELECT id FROM core.leads 
      WHERE assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

ALTER TABLE core.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookings_agent_scoping ON core.bookings
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR lead_id IN (
      SELECT id FROM core.leads
      WHERE assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

-- site_visits has no lead_id column; leads are linked via the
-- site_visit_leads junction table. The visit's own agent_id is checked first.
ALTER TABLE core.site_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_visits_agent_scoping ON core.site_visits
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR id IN (
      SELECT svl.visit_id FROM core.site_visit_leads svl
      JOIN core.leads l ON svl.lead_id = l.id
      WHERE l.assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

ALTER TABLE core.payment_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_ledger_agent_scoping ON core.payment_ledger
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR booking_id IN (
      SELECT b.id FROM core.bookings b
      JOIN core.leads l ON b.lead_id = l.id
      WHERE l.assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

ALTER TABLE core.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_agent_scoping ON core.documents
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR scope IN ('project', 'unit')
    OR (
      scope = 'booking' AND booking_id IN (
        SELECT b.id FROM core.bookings b
        JOIN core.leads l ON b.lead_id = l.id
        WHERE l.assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      )
    )
    OR (
      scope = 'client' AND client_id IN (
        SELECT c.id FROM core.clients c
        JOIN core.leads l ON l.client_id = c.id
        WHERE l.assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      )
    )
  );
