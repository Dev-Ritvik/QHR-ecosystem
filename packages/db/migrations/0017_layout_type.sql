-- packages/db/migrations/0017_layout_type.sql
--
-- Replaces the project-level "Approval Authority" concept with "Layout Type"
-- (owner request). The old core.projects.approval_authority COLUMN is kept
-- in place (deprecated, no longer read/written by the app) so no data is
-- destroyed; drop it later if desired. The approval_authority ENUM TYPE is
-- still used by core.unit_land_details, which is unchanged.

CREATE TYPE "core"."layout_type" AS ENUM (
  'vmrda', 'panchayat', 'farmlands', 'suda', 'buda', 'dtcp', 'private_land', 'other'
);

ALTER TABLE "core"."projects" ADD COLUMN IF NOT EXISTS "layout_type" "core"."layout_type";

-- Map legacy values: dtcp carries over; hmda/rera/other → other.
UPDATE "core"."projects" SET "layout_type" =
  CASE "approval_authority"
    WHEN 'dtcp' THEN 'dtcp'::"core"."layout_type"
    WHEN 'hmda' THEN 'other'::"core"."layout_type"
    WHEN 'rera' THEN 'other'::"core"."layout_type"
    WHEN 'other' THEN 'other'::"core"."layout_type"
    ELSE NULL
  END
WHERE "layout_type" IS NULL;

-- Projects whose approval authority was RERA carried their RERA registration
-- in approval_number; move it into the dedicated rera_number column so the
-- publish check and the new "RERA Approved?" toggle read one source of truth.
UPDATE "core"."projects" SET "rera_number" = "approval_number"
WHERE "approval_authority" = 'rera'
  AND "approval_number" IS NOT NULL
  AND ("rera_number" IS NULL OR btrim("rera_number") = '');
