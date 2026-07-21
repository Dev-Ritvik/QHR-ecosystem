-- packages/db/migrations/0009_missing_rls.sql

-- 1. Holds: Agents see only holds for their assigned leads; Owners see all.
ALTER TABLE core.holds ENABLE ROW LEVEL SECURITY;
-- 1. Holds
DROP POLICY IF EXISTS holds_agent_scoping ON core.holds;
CREATE POLICY holds_agent_scoping ON core.holds
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR lead_id IN (
      SELECT id FROM core.leads 
      WHERE assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

-- 2. Bookings
DROP POLICY IF EXISTS bookings_agent_scoping ON core.bookings;
CREATE POLICY bookings_agent_scoping ON core.bookings
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR lead_id IN (
      SELECT id FROM core.leads 
      WHERE assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

-- 3. Site Visits
DROP POLICY IF EXISTS site_visits_agent_scoping ON core.site_visits;
CREATE POLICY site_visits_agent_scoping ON core.site_visits
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR id IN (
      SELECT svl.visit_id FROM core.site_visit_leads svl
      JOIN core.leads l ON svl.lead_id = l.id
      WHERE l.assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

-- 4. Payment Ledger
DROP POLICY IF EXISTS payment_ledger_agent_scoping ON core.payment_ledger;
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

-- 5. Documents
DROP POLICY IF EXISTS documents_agent_scoping ON core.documents;
CREATE POLICY documents_agent_scoping ON core.documents
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR (current_setting('app.role', true) = 'agent' AND scope IN ('project', 'unit'))
    OR (
      scope = 'booking' AND booking_id IN (
        SELECT b.id FROM core.bookings b
        JOIN core.leads l ON b.lead_id = l.id
        WHERE l.assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      )
    )
    OR (
      scope = 'client' AND client_id IN (
        SELECT client_id FROM core.leads 
        WHERE assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      )
    )
  );

-- 6. Missing underlying join tables for subqueries
-- clients
ALTER TABLE core.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clients_agent_scoping ON core.clients;
CREATE POLICY clients_agent_scoping ON core.clients
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR id IN (
      SELECT client_id FROM core.leads
      WHERE assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

-- site_visit_leads
ALTER TABLE core.site_visit_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_visit_leads_agent_scoping ON core.site_visit_leads;
CREATE POLICY site_visit_leads_agent_scoping ON core.site_visit_leads
  FOR ALL TO crm_app
  USING (
    current_setting('app.role', true) = 'owner'
    OR lead_id IN (
      SELECT id FROM core.leads
      WHERE assigned_agent_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

-- projects
ALTER TABLE core.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projects_scoping ON core.projects;
CREATE POLICY projects_scoping ON core.projects
  FOR ALL TO crm_app
  USING (true);

-- units
ALTER TABLE core.units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS units_scoping ON core.units;
CREATE POLICY units_scoping ON core.units
  FOR ALL TO crm_app
  USING (true);
