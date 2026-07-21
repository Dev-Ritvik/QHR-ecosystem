import { pgSchema, customType, timestamp, bigint } from 'drizzle-orm/pg-core';

export const core = pgSchema('core');
export const projection = pgSchema('projection');

// Integer paise helper
export const paise = (name: string) => bigint(name, { mode: 'bigint' });

// PostGIS geometry custom types
const postgis = (spec: string) =>
  customType<{ data: unknown; driverData: string }>({
    dataType: () => `geometry(${spec}, 4326)`,
  });

export const geomPoint = postgis('Point');
export const geomPolygon = postgis('Polygon');
export const geomMultiPolygon = postgis('MultiPolygon');
export const geomAny = postgis('Geometry');

// Timestamp helpers
export const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

// Core Enums
export const userRole = core.enum('user_role', ['owner', 'agent']);
export const assetClass = core.enum('asset_class', ['land', 'commercial', 'luxury_residential']);
export const priceVisibility = core.enum('price_visibility', ['public', 'on_request']);

export const unitStatus = core.enum('unit_status', [
  'available', 'on_hold', 'booked', 'registered', 'sold', 'not_for_sale', 'mortgage',
]);

export const unitFacing = core.enum('unit_facing', [
  'north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west',
]);

export const landExtentUnit = core.enum('land_extent_unit', ['sq_yd', 'sq_ft', 'acre', 'gunta', 'cent']);
export const approvalAuthority = core.enum('approval_authority', ['dtcp', 'hmda', 'rera', 'other']);
// Project-level layout classification (replaces projects.approval_authority;
// the approval_authority enum remains in use by unit_land_details).
export const layoutType = core.enum('layout_type', [
  'vmrda', 'panchayat', 'farmlands', 'suda', 'buda', 'dtcp', 'private_land', 'other',
]);
export const landConversionStatus = core.enum('land_conversion_status', [
  'not_required', 'pending', 'converted',
]);
export const certStatus = core.enum('cert_status', ['not_applied', 'applied', 'received']);
export const possessionStatus = core.enum('possession_status', [
  'under_construction', 'near_possession', 'ready_to_move',
]);

export const holdStatus = core.enum('hold_status', ['active', 'released', 'expired', 'converted']);
export const bookingStatus = core.enum('booking_status', ['active', 'converted', 'cancelled', 'defaulted']);

export const leadSource = core.enum('lead_source', [
  'website', 'portal_99acres', 'portal_magicbricks', 'portal_housing',
  'referral', 'walk_in', 'channel_partner', 'other',
]);
export const pipelineStage = core.enum('pipeline_stage', [
  'new', 'contacted', 'qualified', 'site_visit', 'negotiation',
  'token', 'agreement', 'registered', 'won', 'lost', 'dormant',
]);
export const lostReason = core.enum('lost_reason', [
  'budget', 'location', 'bought_elsewhere', 'postponed', 'unreachable', 'not_interested', 'other',
]);
export const leadTriageStatus = core.enum('lead_triage_status', ['new', 'assigned', 'merged', 'spam']);
export const leadEventType = core.enum('lead_event_type', [
  'stage_change', 'interaction', 'note', 'assignment', 'follow_up_set', 'merge', 'negotiation',
]);
export const interactionType = core.enum('interaction_type', ['call', 'whatsapp', 'meeting', 'site_visit']);
export const negotiationKind = core.enum('negotiation_kind', ['asked_price', 'client_offer', 'concession', 'counter']);

export const visitStatus = core.enum('visit_status', ['scheduled', 'completed', 'cancelled', 'no_show']);

export const documentScope = core.enum('document_scope', ['project', 'unit', 'booking', 'client']);
export const documentStatus = core.enum('document_status', ['missing', 'pending', 'on_file', 'expired']);

export const ledgerEntryType = core.enum('ledger_entry_type', [
  'token', 'installment', 'registration', 'refund', 'reversal',
]);
export const paymentMode = core.enum('payment_mode', ['cash', 'cheque', 'dd', 'upi', 'bank_transfer', 'other']);

export const payeeType = core.enum('payee_type', ['agent', 'channel_partner', 'referrer']);
export const commissionTranche = core.enum('commission_tranche', ['token', 'agreement', 'registration']);
export const commissionEntryStatus = core.enum('commission_entry_status', ['accrued', 'due', 'paid', 'voided']);

export const rateBasis = core.enum('rate_basis', ['per_sq_yd', 'per_sq_ft', 'lump_sum']);

export const geometryVersionStatus = core.enum('geometry_version_status', ['draft', 'active', 'superseded']);
export const layoutSourceType = core.enum('layout_source_type', ['pdf', 'image', 'dxf']);

export const poiCategory = core.enum('poi_category', [
  'school', 'hospital', 'transit', 'employment_hub', 'shopping', 'leisure', 'connectivity', 'landmark', 'other',
]);
