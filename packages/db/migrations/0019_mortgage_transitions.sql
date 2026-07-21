-- packages/db/migrations/0019_mortgage_transitions.sql
--
-- The legal-transition matrix is enforced in BOTH the domain state machine
-- and this DB check constraint; 0018 added the 'mortgage' enum value, this
-- adds its transitions (a strict superset of the previous constraint):
--   available -> mortgage
--   mortgage  -> available | booked
-- mortgage -> sold/registered remains impossible (owner rule 2026-07-18).

ALTER TABLE "core"."unit_status_events" DROP CONSTRAINT "unit_status_events_legal_transition";
ALTER TABLE "core"."unit_status_events" ADD CONSTRAINT "unit_status_events_legal_transition" CHECK (
  ((from_status IS NULL) AND (to_status = 'available'::core.unit_status))
  OR ((from_status = 'available'::core.unit_status) AND (to_status = ANY (ARRAY['on_hold'::core.unit_status, 'booked'::core.unit_status, 'not_for_sale'::core.unit_status, 'mortgage'::core.unit_status])))
  OR ((from_status = 'on_hold'::core.unit_status) AND (to_status = ANY (ARRAY['available'::core.unit_status, 'booked'::core.unit_status])))
  OR ((from_status = 'booked'::core.unit_status) AND (to_status = ANY (ARRAY['registered'::core.unit_status, 'available'::core.unit_status])))
  OR ((from_status = 'registered'::core.unit_status) AND (to_status = 'sold'::core.unit_status))
  OR ((from_status = 'not_for_sale'::core.unit_status) AND (to_status = 'available'::core.unit_status))
  OR ((from_status = 'mortgage'::core.unit_status) AND (to_status = ANY (ARRAY['available'::core.unit_status, 'booked'::core.unit_status])))
);
