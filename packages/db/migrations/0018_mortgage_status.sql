-- packages/db/migrations/0018_mortgage_status.sql
--
-- Owner decision 2026-07-18: "Mortgage" is a status of the UNIT itself — the
-- property is under a mortgage/lien and must not be sold until released.
-- State machine (packages/domain/src/unit-status/machine.ts):
--   available -> mortgage           (place under mortgage)
--   mortgage  -> available | booked (release / sell-subject-to-release)
--   mortgage  -> sold/registered    FORBIDDEN
-- Display: existing internal states are GROUPED for the owner's 4-state view
-- (Available | Booked/Advance Paid/Reserved | Sold Out | Mortgage) without
-- merging the underlying legal states. Additive enum change only.

ALTER TYPE "core"."unit_status" ADD VALUE IF NOT EXISTS 'mortgage';
