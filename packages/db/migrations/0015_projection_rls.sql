-- packages/db/migrations/0015_projection_rls.sql
--
-- Restores RLS on the projection schema after seed.ts's unguarded
-- `DISABLE ROW LEVEL SECURITY` ran against the live database (2026-07-16).
-- No repo file previously enabled RLS or defined policies here — isolation
-- was grant-based only (projection_reader = SELECT-only). This migration
-- makes the RLS layer explicit and functional:
--   projection_reader → SELECT only (the public app's role)
--   crm_app           → full access (publish.ts / reconcile write projections)
-- The postgres role owns these tables and bypasses non-FORCE RLS, which is
-- how seeding works without disabling anything.

ALTER TABLE projection.projects_pub ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projects_pub_public_read ON projection.projects_pub;
CREATE POLICY projects_pub_public_read ON projection.projects_pub
  FOR SELECT TO projection_reader USING (true);
DROP POLICY IF EXISTS projects_pub_crm_writes ON projection.projects_pub;
CREATE POLICY projects_pub_crm_writes ON projection.projects_pub
  FOR ALL TO crm_app USING (true);

ALTER TABLE projection.units_pub ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS units_pub_public_read ON projection.units_pub;
CREATE POLICY units_pub_public_read ON projection.units_pub
  FOR SELECT TO projection_reader USING (true);
DROP POLICY IF EXISTS units_pub_crm_writes ON projection.units_pub;
CREATE POLICY units_pub_crm_writes ON projection.units_pub
  FOR ALL TO crm_app USING (true);

ALTER TABLE projection.geometry_pub ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geometry_pub_public_read ON projection.geometry_pub;
CREATE POLICY geometry_pub_public_read ON projection.geometry_pub
  FOR SELECT TO projection_reader USING (true);
DROP POLICY IF EXISTS geometry_pub_crm_writes ON projection.geometry_pub;
CREATE POLICY geometry_pub_crm_writes ON projection.geometry_pub
  FOR ALL TO crm_app USING (true);

ALTER TABLE projection.pois_pub ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pois_pub_public_read ON projection.pois_pub;
CREATE POLICY pois_pub_public_read ON projection.pois_pub
  FOR SELECT TO projection_reader USING (true);
DROP POLICY IF EXISTS pois_pub_crm_writes ON projection.pois_pub;
CREATE POLICY pois_pub_crm_writes ON projection.pois_pub
  FOR ALL TO crm_app USING (true);

ALTER TABLE projection.media_manifests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS media_manifests_public_read ON projection.media_manifests;
CREATE POLICY media_manifests_public_read ON projection.media_manifests
  FOR SELECT TO projection_reader USING (true);
DROP POLICY IF EXISTS media_manifests_crm_writes ON projection.media_manifests;
CREATE POLICY media_manifests_crm_writes ON projection.media_manifests
  FOR ALL TO crm_app USING (true);
