// DATABASE_SCHEMA.md
// Complete database schema — `core` + `projection` Postgres schemas.
// Drizzle ORM (drizzle-orm/pg-core), PostgreSQL 15 + PostGIS.
// Money: integer paise (bigint) everywhere — NFR-D1. Timestamps: UTC (timestamptz) — NFR-D6.
// Legally-a-date fields (registration date, EC validity) are `date`, not timestamps — NFR-D6.
// No hard deletes on client/money-adjacent tables: archived_at / voided semantics — NFR-D3.

import { sql } from 'drizzle-orm';
import {
  pgSchema,
  uuid,
  text,
  varchar,
  integer,
  smallint,
  bigint,
  boolean,
  timestamp,
  date,
  jsonb,
  doublePrecision,
  index,
  uniqueIndex,
  primaryKey,
  check,
  customType,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const core = pgSchema('core');
export const projection = pgSchema('projection');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Integer paise. bigint because ₹10 Cr = 1e11 paise overflows int4. JS side is bigint.
const paise = (name: string) => bigint(name, { mode: 'bigint' });

// PostGIS geometry columns (drizzle's built-in geometry only covers points).
// Validity is enforced by CHECK (ST_IsValid(...)) on every geometry column — NFR-D7.
const postgis = (spec: string) =>
  customType<{ data: unknown; driverData: string }>({
    dataType: () => `geometry(${spec}, 4326)`,
  });
const geomPoint = postgis('Point');
const geomPolygon = postgis('Polygon');
const geomMultiPolygon = postgis('MultiPolygon');
const geomAny = postgis('Geometry');

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
// updated_at is maintained by the data-access layer (no DB trigger — app-level per §4.3 rationale).
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// core: enums
// ---------------------------------------------------------------------------

export const userRole = core.enum('user_role', ['owner', 'agent']); // FR-C20 — two roles only
export const assetClass = core.enum('asset_class', ['land', 'commercial', 'luxury_residential']);
export const priceVisibility = core.enum('price_visibility', ['public', 'on_request']); // pushback #3

// FR-C10 state machine. Current status is materialized from unit_status_events.
export const unitStatus = core.enum('unit_status', [
  'available', 'on_hold', 'booked', 'registered', 'sold', 'not_for_sale',
]);

export const unitFacing = core.enum('unit_facing', [
  'north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west',
]);

// Assumption: regional land-extent units common in Telangana; sq_yd is the display default (FR-W3).
export const landExtentUnit = core.enum('land_extent_unit', ['sq_yd', 'sq_ft', 'acre', 'gunta', 'cent']);
export const approvalAuthority = core.enum('approval_authority', ['dtcp', 'hmda', 'rera', 'other']);
export const landConversionStatus = core.enum('land_conversion_status', [
  'not_required', 'pending', 'converted',
]);
// Assumption: OC/CC tracked as one lifecycle enum each (FR-C8 luxury).
export const certStatus = core.enum('cert_status', ['not_applied', 'applied', 'received']);
export const possessionStatus = core.enum('possession_status', [
  'under_construction', 'near_possession', 'ready_to_move',
]);

export const holdStatus = core.enum('hold_status', ['active', 'released', 'expired', 'converted']);
export const bookingStatus = core.enum('booking_status', ['active', 'converted', 'cancelled', 'defaulted']);

export const leadSource = core.enum('lead_source', [
  'website', 'portal_99acres', 'portal_magicbricks', 'portal_housing',
  'referral', 'walk_in', 'channel_partner', 'other',
]); // FR-C1
export const pipelineStage = core.enum('pipeline_stage', [
  'new', 'contacted', 'qualified', 'site_visit', 'negotiation',
  'token', 'agreement', 'registered', 'won', 'lost', 'dormant',
]); // FR-C2
// Assumption: curated lost-reason list (FR-C2 "mandatory reason from a curated list").
export const lostReason = core.enum('lost_reason', [
  'budget', 'location', 'bought_elsewhere', 'postponed', 'unreachable', 'not_interested', 'other',
]);
export const leadTriageStatus = core.enum('lead_triage_status', ['new', 'assigned', 'merged', 'spam']); // FR-C26
export const leadEventType = core.enum('lead_event_type', [
  'stage_change', 'interaction', 'note', 'assignment', 'follow_up_set', 'merge', 'negotiation',
]); // FR-C2/C3/C5/C6
export const interactionType = core.enum('interaction_type', ['call', 'whatsapp', 'meeting', 'site_visit']); // FR-C3
// FR-C6 negotiation events distinguish who moved.
export const negotiationKind = core.enum('negotiation_kind', ['asked_price', 'client_offer', 'concession', 'counter']);

export const visitStatus = core.enum('visit_status', ['scheduled', 'completed', 'cancelled', 'no_show']); // FR-C13/14

export const documentScope = core.enum('document_scope', ['project', 'unit', 'booking', 'client']); // FR-C15/16
export const documentStatus = core.enum('document_status', ['missing', 'pending', 'on_file', 'expired']);

export const ledgerEntryType = core.enum('ledger_entry_type', [
  'token', 'installment', 'registration', 'refund', 'reversal',
]); // FR-C17
export const paymentMode = core.enum('payment_mode', ['cash', 'cheque', 'dd', 'upi', 'bank_transfer', 'other']);

export const payeeType = core.enum('payee_type', ['agent', 'channel_partner', 'referrer']); // FR-C18
export const commissionTranche = core.enum('commission_tranche', ['token', 'agreement', 'registration']);
export const commissionEntryStatus = core.enum('commission_entry_status', ['accrued', 'due', 'paid', 'voided']);

export const rateBasis = core.enum('rate_basis', ['per_sq_yd', 'per_sq_ft', 'lump_sum']); // FR-C9

export const geometryVersionStatus = core.enum('geometry_version_status', ['draft', 'active', 'superseded']); // FR-C32
export const layoutSourceType = core.enum('layout_source_type', ['pdf', 'image', 'dxf']); // FR-C30

// Assumption: POI category list per FR-W5/FR-C29 usage.
export const poiCategory = core.enum('poi_category', [
  'school', 'hospital', 'transit', 'employment_hub', 'shopping', 'leisure', 'connectivity', 'landmark', 'other',
]);

export const mediaKind = core.enum('media_kind', ['hero', 'gallery', 'plan', 'og_image']);
export const mediaStatus = core.enum('media_status', ['uploading', 'processing', 'ready', 'failed']);

// ---------------------------------------------------------------------------
// core: users, sessions, presentation devices
// ---------------------------------------------------------------------------

export const users = core.table(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    phone: varchar('phone', { length: 16 }).notNull(),
    email: varchar('email', { length: 320 }),
    role: userRole('role').notNull().default('agent'),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_phone_live_uq').on(t.phone).where(sql`deactivated_at IS NULL`),
    uniqueIndex('users_email_live_uq').on(t.email).where(sql`deactivated_at IS NULL AND email IS NOT NULL`),
    check('users_phone_format', sql`phone ~ '^\\+[1-9][0-9]{7,14}$'`),
  ],
);

export const sessions = core.table(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('sessions_token_uq').on(t.token),
    index('sessions_user_idx').on(t.userId),
    check('sessions_expiry_future', sql`expires_at > created_at`),
  ],
);

export const presentationDevices = core.table(
  'presentation_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    label: text('label').notNull(),
    tokenHash: text('token_hash').notNull(),
    scopes: text('scopes').array().notNull().default(sql`ARRAY['projection:read','prices:read']`),
    approvedById: uuid('approved_by_id').notNull().references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('presentation_devices_token_uq').on(t.tokenHash)],
);

// ---------------------------------------------------------------------------
// core: projects, pricing, units (+ per-asset-class detail tables)
// ---------------------------------------------------------------------------

export const projects = core.table(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: text('name').notNull(),
    assetClass: assetClass('asset_class').notNull(),
    narrative: text('narrative'),
    locality: text('locality'),
    city: text('city'),
    state: text('state'),
    approvalAuthority: approvalAuthority('approval_authority'),
    approvalNumber: varchar('approval_number', { length: 100 }),
    reraNumber: varchar('rera_number', { length: 100 }),
    amenities: jsonb('amenities').notNull().default(sql`'[]'::jsonb`),
    priceVisibility: priceVisibility('price_visibility').notNull().default('on_request'),
    sellingFastThresholdPct: smallint('selling_fast_threshold_pct').notNull().default(15),
    centroid: geomPoint('centroid'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('projects_slug_live_uq').on(t.slug).where(sql`archived_at IS NULL`),
    check('projects_threshold_range', sql`selling_fast_threshold_pct BETWEEN 0 AND 100`),
    check('projects_centroid_valid', sql`centroid IS NULL OR ST_IsValid(centroid)`),
  ],
);

export const priceVersions = core.table(
  'price_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    versionNo: integer('version_no').notNull(),
    rateBasis: rateBasis('rate_basis').notNull(),
    baseRatePaise: paise('base_rate_paise').notNull(),
    premiums: jsonb('premiums').notNull().default(sql`'{}'::jsonb`),
    reason: text('reason').notNull(),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('price_versions_project_no_uq').on(t.projectId, t.versionNo),
    uniqueIndex('price_versions_one_active_uq')
      .on(t.projectId)
      .where(sql`activated_at IS NOT NULL AND superseded_at IS NULL`),
    check('price_versions_rate_positive', sql`base_rate_paise > 0`),
  ],
);

export const units = core.table(
  'units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    unitNumber: varchar('unit_number', { length: 40 }).notNull(),
    status: unitStatus('status').notNull().default('available'),
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }).notNull().defaultNow(),
    facing: unitFacing('facing'),
    isCorner: boolean('is_corner').notNull().default(false),
    roadWidthM: doublePrecision('road_width_m'),
    areaSqYd: doublePrecision('area_sq_yd'),
    areaSqFt: doublePrecision('area_sq_ft'),
    dimensionsLabel: varchar('dimensions_label', { length: 40 }),
    priceVersionId: uuid('price_version_id').references(() => priceVersions.id),
    computedPricePaise: paise('computed_price_paise'),
    overridePricePaise: paise('override_price_paise'),
    overrideReason: text('override_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('units_project_number_live_uq').on(t.projectId, t.unitNumber).where(sql`archived_at IS NULL`),
    index('units_project_status_idx').on(t.projectId, t.status),
    check('units_override_needs_reason', sql`override_price_paise IS NULL OR override_reason IS NOT NULL`),
    check('units_areas_positive', sql`
      (area_sq_yd IS NULL OR area_sq_yd > 0) AND
      (area_sq_ft IS NULL OR area_sq_ft > 0) AND
      (road_width_m IS NULL OR road_width_m > 0)
    `),
    check('units_prices_positive', sql`
      (computed_price_paise IS NULL OR computed_price_paise > 0) AND
      (override_price_paise IS NULL OR override_price_paise > 0)
    `),
  ],
);

export const unitLandDetails = core.table(
  'unit_land_details',
  {
    unitId: uuid('unit_id').primaryKey().references(() => units.id, { onDelete: 'cascade' }),
    surveyNumber: varchar('survey_number', { length: 80 }).notNull(),
    subdivisionLineage: text('subdivision_lineage'),
    extentValue: doublePrecision('extent_value'),
    extentUnit: landExtentUnit('extent_unit'),
    approvalAuthority: approvalAuthority('approval_authority'),
    approvalNumber: varchar('approval_number', { length: 100 }),
    conversionStatus: landConversionStatus('conversion_status').notNull().default('not_required'),
  },
  (t) => [
    index('unit_land_survey_idx').on(t.surveyNumber),
    check('unit_land_extent_pair', sql`(extent_value IS NULL) = (extent_unit IS NULL)`),
    check('unit_land_extent_positive', sql`extent_value IS NULL OR extent_value > 0`),
  ],
);

export const unitCommercialDetails = core.table(
  'unit_commercial_details',
  {
    unitId: uuid('unit_id').primaryKey().references(() => units.id, { onDelete: 'cascade' }),
    reraNumber: varchar('rera_number', { length: 100 }),
    carpetAreaSqFt: doublePrecision('carpet_area_sq_ft'),
    builtUpAreaSqFt: doublePrecision('built_up_area_sq_ft'),
    superBuiltUpAreaSqFt: doublePrecision('super_built_up_area_sq_ft'),
    floorNumber: smallint('floor_number'),
    farContext: text('far_context'),
    isTenanted: boolean('is_tenanted').notNull().default(false),
    leaseTerms: text('lease_terms'),
  },
  (t) => [
    check('unit_commercial_area_order', sql`
      (carpet_area_sq_ft IS NULL OR built_up_area_sq_ft IS NULL OR carpet_area_sq_ft <= built_up_area_sq_ft) AND
      (built_up_area_sq_ft IS NULL OR super_built_up_area_sq_ft IS NULL OR built_up_area_sq_ft <= super_built_up_area_sq_ft)
    `),
    check('unit_commercial_tenanted_terms', sql`NOT is_tenanted OR lease_terms IS NOT NULL`),
  ],
);

export const unitLuxuryDetails = core.table(
  'unit_luxury_details',
  {
    unitId: uuid('unit_id').primaryKey().references(() => units.id, { onDelete: 'cascade' }),
    configuration: varchar('configuration', { length: 40 }),
    possessionStatus: possessionStatus('possession_status').notNull().default('under_construction'),
    reraNumber: varchar('rera_number', { length: 100 }),
    reraCompletionDate: date('rera_completion_date'),
    ocStatus: certStatus('oc_status').notNull().default('not_applied'),
    ccStatus: certStatus('cc_status').notNull().default('not_applied'),
    amenities: jsonb('amenities').notNull().default(sql`'[]'::jsonb`),
  },
);

// ---------------------------------------------------------------------------
// core: clients & leads
// ---------------------------------------------------------------------------

export const clients = core.table(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    phone: varchar('phone', { length: 16 }).notNull(),
    altPhone: varchar('alt_phone', { length: 16 }),
    email: varchar('email', { length: 320 }),
    address: text('address'),
    panMasked: varchar('pan_masked', { length: 12 }),
    aadhaarMasked: varchar('aadhaar_masked', { length: 16 }),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('clients_phone_live_uq').on(t.phone).where(sql`archived_at IS NULL`),
    check('clients_phone_format', sql`phone ~ '^\\+[1-9][0-9]{7,14}$'`),
  ],
);

export const leads = core.table(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    phone: varchar('phone', { length: 16 }).notNull(),
    altPhone: varchar('alt_phone', { length: 16 }),
    email: varchar('email', { length: 320 }),
    source: leadSource('source').notNull(),
    sourceDetail: text('source_detail'),
    budgetMinPaise: paise('budget_min_paise'),
    budgetMaxPaise: paise('budget_max_paise'),
    assetClassInterest: assetClass('asset_class_interest'),
    timelineExpectation: varchar('timeline_expectation', { length: 60 }),
    stage: pipelineStage('stage').notNull().default('new'),
    lostReason: lostReason('lost_reason'),
    assignedAgentId: uuid('assigned_agent_id').references(() => users.id),
    triageStatus: leadTriageStatus('triage_status').notNull().default('new'),
    mergedIntoLeadId: uuid('merged_into_lead_id'),
    clientId: uuid('client_id').references(() => clients.id),
    nextFollowUpAt: timestamp('next_follow_up_at', { withTimezone: true }),
    dedupeKey: varchar('dedupe_key', { length: 128 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('leads_dedupe_uq').on(t.dedupeKey).where(sql`dedupe_key IS NOT NULL`),
    index('leads_phone_idx').on(t.phone),
    index('leads_agent_stage_idx').on(t.assignedAgentId, t.stage),
    index('leads_followup_idx').on(t.nextFollowUpAt).where(sql`next_follow_up_at IS NOT NULL AND archived_at IS NULL`),
    check('leads_lost_needs_reason', sql`stage <> 'lost' OR lost_reason IS NOT NULL`),
    check('leads_budget_order', sql`
      budget_min_paise IS NULL OR budget_max_paise IS NULL OR budget_min_paise <= budget_max_paise
    `),
    check('leads_merged_is_terminal', sql`(triage_status = 'merged') = (merged_into_lead_id IS NOT NULL)`),
  ],
);

export const leadInterests = core.table(
  'lead_interests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    unitId: uuid('unit_id').references(() => units.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('lead_interests_uq').on(t.leadId, t.projectId, t.unitId),
    index('lead_interests_project_idx').on(t.projectId),
  ],
);

export const leadEvents = core.table(
  'lead_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id').notNull().references(() => leads.id),
    type: leadEventType('type').notNull(),
    fromStage: pipelineStage('from_stage'),
    toStage: pipelineStage('to_stage'),
    interactionType: interactionType('interaction_type'),
    outcomes: text('outcomes').array(),
    assignedToId: uuid('assigned_to_id').references(() => users.id),
    negotiationKind: negotiationKind('negotiation_kind'),
    amountPaise: paise('amount_paise'),
    unitId: uuid('unit_id').references(() => units.id),
    note: text('note'),
    nextFollowUpAt: timestamp('next_follow_up_at', { withTimezone: true }),
    actorId: uuid('actor_id').notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('lead_events_lead_idx').on(t.leadId, t.createdAt),
    check('lead_events_stage_shape', sql`type <> 'stage_change' OR to_stage IS NOT NULL`),
    check('lead_events_interaction_shape', sql`type <> 'interaction' OR interaction_type IS NOT NULL`),
    check('lead_events_negotiation_shape', sql`
      type <> 'negotiation' OR (negotiation_kind IS NOT NULL AND amount_paise IS NOT NULL AND amount_paise > 0)
    `),
    check('lead_events_assignment_shape', sql`type <> 'assignment' OR assigned_to_id IS NOT NULL`),
  ],
);

// ---------------------------------------------------------------------------
// core: holds, bookings, unit status events
// ---------------------------------------------------------------------------

export const holds = core.table(
  'holds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    unitId: uuid('unit_id').notNull().references(() => units.id),
    clientId: uuid('client_id').notNull().references(() => clients.id),
    leadId: uuid('lead_id').references(() => leads.id),
    status: holdStatus('status').notNull().default('active'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    extendedById: uuid('extended_by_id').references(() => users.id),
    extendedAt: timestamp('extended_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    reason: text('reason'),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('holds_one_active_per_unit_uq').on(t.unitId).where(sql`status = 'active'`),
    index('holds_expiry_idx').on(t.expiresAt).where(sql`status = 'active'`),
    check('holds_expiry_after_start', sql`expires_at > starts_at`),
    check('holds_released_shape', sql`(status IN ('released','expired','converted')) = (released_at IS NOT NULL)`),
  ],
);

export const bookings = core.table(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    unitId: uuid('unit_id').notNull().references(() => units.id),
    clientId: uuid('client_id').notNull().references(() => clients.id),
    leadId: uuid('lead_id').references(() => leads.id),
    agentId: uuid('agent_id').notNull().references(() => users.id),
    status: bookingStatus('status').notNull().default('active'),
    tokenAmountPaise: paise('token_amount_paise').notNull(),
    considerationPaise: paise('consideration_paise'),
    tdsApplicable: boolean('tds_applicable').generatedAlwaysAs(
      sql`consideration_paise IS NOT NULL AND consideration_paise > 500000000`,
    ),
    bookedOn: date('booked_on').notNull(),
    agreementDate: date('agreement_date'),
    registeredOn: date('registered_on'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    defaultedAt: timestamp('defaulted_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('bookings_one_active_per_unit_uq').on(t.unitId).where(sql`status = 'active'`),
    index('bookings_client_idx').on(t.clientId),
    index('bookings_agent_idx').on(t.agentId),
    check('bookings_token_positive', sql`token_amount_paise > 0`),
    check('bookings_consideration_positive', sql`consideration_paise IS NULL OR consideration_paise > 0`),
    check('bookings_cancel_shape', sql`(status = 'cancelled') = (cancelled_at IS NOT NULL)`),
    check('bookings_cancel_needs_reason', sql`status <> 'cancelled' OR cancel_reason IS NOT NULL`),
    check('bookings_converted_registered', sql`status <> 'converted' OR registered_on IS NOT NULL`),
  ],
);

export const unitStatusEvents = core.table(
  'unit_status_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    unitId: uuid('unit_id').notNull().references(() => units.id),
    fromStatus: unitStatus('from_status'),
    toStatus: unitStatus('to_status').notNull(),
    reason: text('reason'),
    holdId: uuid('hold_id').references(() => holds.id),
    bookingId: uuid('booking_id').references(() => bookings.id),
    clientId: uuid('client_id').references(() => clients.id),
    actorId: uuid('actor_id').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('unit_status_events_unit_idx').on(t.unitId, t.createdAt),
    check('unit_status_events_legal_transition', sql`
      (from_status IS NULL AND to_status = 'available')
      OR (from_status = 'available'    AND to_status IN ('on_hold','booked','not_for_sale'))
      OR (from_status = 'on_hold'      AND to_status IN ('available','booked'))
      OR (from_status = 'booked'       AND to_status IN ('registered','available'))
      OR (from_status = 'registered'   AND to_status IN ('sold'))
      OR (from_status = 'not_for_sale' AND to_status IN ('available'))
    `),
    check('unit_status_events_hold_link', sql`to_status <> 'on_hold' OR hold_id IS NOT NULL`),
    check('unit_status_events_booking_link', sql`to_status <> 'booked' OR booking_id IS NOT NULL`),
  ],
);

// ---------------------------------------------------------------------------
// core: site visits
// ---------------------------------------------------------------------------

export const siteVisits = core.table(
  'site_visits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    agentId: uuid('agent_id').notNull().references(() => users.id),
    status: visitStatus('status').notNull().default('scheduled'),
    pickupPoint: text('pickup_point'),
    vehicleNote: text('vehicle_note'),
    generalNote: text('general_note'),
    outcomeCapturedAt: timestamp('outcome_captured_at', { withTimezone: true }),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('site_visits_agent_time_idx').on(t.agentId, t.scheduledAt),
    index('site_visits_uncaptured_idx')
      .on(t.agentId)
      .where(sql`status = 'completed' AND outcome_captured_at IS NULL`),
  ],
);

export const siteVisitLeads = core.table(
  'site_visit_leads',
  {
    visitId: uuid('visit_id').notNull().references(() => siteVisits.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').notNull().references(() => leads.id),
  },
  (t) => [primaryKey({ columns: [t.visitId, t.leadId] })],
);

export const siteVisitUnits = core.table(
  'site_visit_units',
  {
    visitId: uuid('visit_id').notNull().references(() => siteVisits.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id').notNull().references(() => units.id),
    sortOrder: smallint('sort_order').notNull().default(0),
    outcomes: text('outcomes').array(),
    outcomeNote: text('outcome_note'),
  },
  (t) => [primaryKey({ columns: [t.visitId, t.unitId] })],
);

// ---------------------------------------------------------------------------
// core: documents
// ---------------------------------------------------------------------------

export const documents = core.table(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: documentScope('scope').notNull(),
    projectId: uuid('project_id').references(() => projects.id),
    unitId: uuid('unit_id').references(() => units.id),
    bookingId: uuid('booking_id').references(() => bookings.id),
    clientId: uuid('client_id').references(() => clients.id),
    checklistKey: varchar('checklist_key', { length: 60 }).notNull(),
    title: text('title').notNull(),
    status: documentStatus('status').notNull().default('missing'),
    storagePath: text('storage_path'),
    fileName: text('file_name'),
    mimeType: varchar('mime_type', { length: 100 }),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }),
    validFrom: date('valid_from'),
    expiryDate: date('expiry_date'),
    uploadedById: uuid('uploaded_by_id').references(() => users.id),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    check('documents_exactly_one_owner', sql`num_nonnulls(project_id, unit_id, booking_id, client_id) = 1`),
    check('documents_scope_matches_owner', sql`
      (scope = 'project' AND project_id IS NOT NULL) OR
      (scope = 'unit'    AND unit_id    IS NOT NULL) OR
      (scope = 'booking' AND booking_id IS NOT NULL) OR
      (scope = 'client'  AND client_id  IS NOT NULL)
    `),
    check('documents_on_file_has_file', sql`status <> 'on_file' OR storage_path IS NOT NULL`),
    index('documents_unit_idx').on(t.unitId).where(sql`unit_id IS NOT NULL`),
    index('documents_booking_idx').on(t.bookingId).where(sql`booking_id IS NOT NULL`),
    index('documents_expiry_idx').on(t.expiryDate).where(sql`expiry_date IS NOT NULL AND archived_at IS NULL`),
  ],
);

// ---------------------------------------------------------------------------
// core: money — payment ledger & commissions
// ---------------------------------------------------------------------------

export const paymentLedger = core.table(
  'payment_ledger',
  {
    id: bigint('id', { mode: 'bigint' }).generatedAlwaysAsIdentity().primaryKey(),
    bookingId: uuid('booking_id').notNull().references(() => bookings.id),
    entryType: ledgerEntryType('entry_type').notNull(),
    amountPaise: paise('amount_paise').notNull(),
    paidOn: date('paid_on').notNull(),
    mode: paymentMode('mode').notNull(),
    reference: varchar('reference', { length: 120 }),
    note: text('note'),
    reversesEntryId: bigint('reverses_entry_id', { mode: 'bigint' }),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('payment_ledger_booking_idx').on(t.bookingId, t.createdAt),
    check('payment_ledger_amount_nonzero', sql`amount_paise <> 0`),
    check('payment_ledger_sign_matches_type', sql`
      (entry_type IN ('token','installment','registration') AND amount_paise > 0) OR
      (entry_type IN ('refund','reversal') AND amount_paise < 0)
    `),
    check('payment_ledger_reversal_link', sql`(entry_type = 'reversal') = (reverses_entry_id IS NOT NULL)`),
  ],
);

export const commissionRules = core.table(
  'commission_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => projects.id),
    rateBps: integer('rate_bps').notNull(),
    trancheSplit: jsonb('tranche_split')
      .notNull()
      .default(sql`'{"token": 0, "agreement": 0, "registration": 100}'::jsonb`),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('commission_rules_one_live_uq')
      .on(sql`COALESCE(project_id::text, 'office_default')`)
      .where(sql`archived_at IS NULL`),
    check('commission_rules_rate_range', sql`rate_bps BETWEEN 0 AND 10000`),
  ],
);

export const commissionEntries = core.table(
  'commission_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id').notNull().references(() => bookings.id),
    ruleId: uuid('rule_id').references(() => commissionRules.id),
    payeeType: payeeType('payee_type').notNull(),
    payeeUserId: uuid('payee_user_id').references(() => users.id),
    payeeName: text('payee_name'),
    payeePhone: varchar('payee_phone', { length: 16 }),
    tranche: commissionTranche('tranche').notNull(),
    basisAmountPaise: paise('basis_amount_paise').notNull(),
    computedAmountPaise: paise('computed_amount_paise').notNull(),
    status: commissionEntryStatus('status').notNull().default('accrued'),
    paidOn: date('paid_on'),
    paymentReference: varchar('payment_reference', { length: 120 }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: text('void_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('commission_entries_uq')
      .on(t.bookingId, t.tranche, sql`COALESCE(payee_user_id::text, payee_name)`)
      .where(sql`voided_at IS NULL`),
    index('commission_entries_payee_idx').on(t.payeeUserId).where(sql`payee_user_id IS NOT NULL`),
    check('commission_entries_payee_shape', sql`
      (payee_type = 'agent' AND payee_user_id IS NOT NULL) OR
      (payee_type <> 'agent' AND payee_name IS NOT NULL)
    `),
    check('commission_entries_amounts', sql`basis_amount_paise >= 0 AND computed_amount_paise >= 0`),
    check('commission_entries_paid_shape', sql`(status = 'paid') = (paid_on IS NOT NULL)`),
    check('commission_entries_void_shape', sql`(status = 'voided') = (voided_at IS NOT NULL)`),
  ],
);

export const commissionOverrides = core.table(
  'commission_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id').notNull().references(() => commissionEntries.id),
    previousAmountPaise: paise('previous_amount_paise').notNull(),
    overriddenAmountPaise: paise('overridden_amount_paise').notNull(),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('commission_overrides_entry_idx').on(t.entryId),
    check('commission_overrides_amount_nonnegative', sql`overridden_amount_paise >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// core: geometry (digitizer) & POIs
// ---------------------------------------------------------------------------

export const geometryVersions = core.table(
  'geometry_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    versionNo: integer('version_no').notNull(),
    status: geometryVersionStatus('status').notNull().default('draft'),
    sourceFilePath: text('source_file_path'),
    sourceFileType: layoutSourceType('source_file_type'),
    georefTransform: jsonb('georef_transform'),
    boundaryGeom: geomMultiPolygon('boundary_geom'),
    notes: text('notes'),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('geometry_versions_project_no_uq').on(t.projectId, t.versionNo),
    uniqueIndex('geometry_versions_one_active_uq').on(t.projectId).where(sql`status = 'active'`),
    check('geometry_versions_boundary_valid', sql`boundary_geom IS NULL OR ST_IsValid(boundary_geom)`),
    check('geometry_versions_active_shape', sql`status <> 'active' OR activated_at IS NOT NULL`),
  ],
);

export const unitGeometries = core.table(
  'unit_geometries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    geometryVersionId: uuid('geometry_version_id')
      .notNull()
      .references(() => geometryVersions.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id').notNull().references(() => units.id),
    geom: geomPolygon('geom').notNull(),
    edgeData: jsonb('edge_data'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('unit_geometries_version_unit_uq').on(t.geometryVersionId, t.unitId),
    index('unit_geometries_gix').using('gist', t.geom),
    check('unit_geometries_valid', sql`ST_IsValid(geom)`),
    check('unit_geometries_not_empty', sql`NOT ST_IsEmpty(geom)`),
  ],
);

export const pois = core.table(
  'pois',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    name: text('name').notNull(),
    category: poiCategory('category').notNull(),
    location: geomPoint('location').notNull(),
    distanceM: integer('distance_m'),
    distanceOverrideM: integer('distance_override_m'),
    driveTimeMin: smallint('drive_time_min'),
    driveTimeOverrideMin: smallint('drive_time_override_min'),
    sortOrder: smallint('sort_order').notNull().default(0),
    createdById: uuid('created_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    index('pois_project_idx').on(t.projectId, t.sortOrder),
    check('pois_location_valid', sql`ST_IsValid(location)`),
    check('pois_distances_positive', sql`
      (distance_m IS NULL OR distance_m >= 0) AND
      (distance_override_m IS NULL OR distance_override_m >= 0) AND
      (drive_time_min IS NULL OR drive_time_min >= 0) AND
      (drive_time_override_min IS NULL OR drive_time_override_min >= 0)
    `),
  ],
);

// ---------------------------------------------------------------------------
// core: media
// ---------------------------------------------------------------------------

export const media = core.table(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id').references(() => units.id, { onDelete: 'cascade' }),
    kind: mediaKind('kind').notNull(),
    status: mediaStatus('status').notNull().default('uploading'),
    storagePath: text('storage_path'),
    variants: jsonb('variants'),
    altText: text('alt_text').notNull(),
    sortOrder: smallint('sort_order').notNull().default(0),
    uploadedById: uuid('uploaded_by_id').notNull().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    index('media_project_kind_idx').on(t.projectId, t.kind, t.sortOrder),
    check('media_ready_has_variants', sql`status <> 'ready' OR variants IS NOT NULL`),
    check('media_ready_has_path', sql`status <> 'ready' OR storage_path IS NOT NULL`)
  ],
);

// ---------------------------------------------------------------------------
// core: audit log
// ---------------------------------------------------------------------------

export const auditLog = core.table(
  'audit_log',
  {
    id: bigint('id', { mode: 'bigint' }).generatedAlwaysAsIdentity().primaryKey(),
    actorId: uuid('actor_id').references(() => users.id),
    action: varchar('action', { length: 80 }).notNull(),
    entityType: varchar('entity_type', { length: 60 }).notNull(),
    entityId: text('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_actor_idx').on(t.actorId, t.createdAt),
    index('audit_log_time_idx').on(t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// projection: enums
// ---------------------------------------------------------------------------
export const pubAssetClass = projection.enum('pub_asset_class', ['land', 'commercial', 'luxury_residential']);
export const pubPresentationStatus = projection.enum('pub_presentation_status', [
  'available', 'selling_fast', 'on_hold', 'booked', 'sold', 'not_for_sale',
]);
export const pubFeatureType = projection.enum('pub_feature_type', [
  'plot', 'boundary', 'road', 'amenity', 'massing',
]);
export const pubMediaKind = projection.enum('pub_media_kind', ['hero', 'gallery', 'plan', 'og_image']);

// ---------------------------------------------------------------------------
// projection: tables
// ---------------------------------------------------------------------------
export const projectsPub = projection.table(
  'projects_pub',
  {
    projectId: uuid('project_id').primaryKey(),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: text('name').notNull(),
    assetClass: pubAssetClass('asset_class').notNull(),
    narrative: text('narrative').notNull(),
    locality: text('locality'),
    city: text('city'),
    badges: jsonb('badges').notNull().default(sql`'[]'::jsonb`),
    amenities: jsonb('amenities').notNull().default(sql`'[]'::jsonb`),
    totalUnits: integer('total_units').notNull(),
    availableUnits: integer('available_units').notNull(),
    isSoldOut: boolean('is_sold_out').generatedAlwaysAs(sql`available_units = 0`),
    priceVisibility: text('price_visibility').notNull(),
    heroUrl: text('hero_url').notNull(),
    centroid: geomPoint('centroid'),
    bbox: jsonb('bbox'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('projects_pub_slug_uq').on(t.slug),
    check('projects_pub_counts', sql`total_units >= 0 AND available_units BETWEEN 0 AND total_units`),
    check('projects_pub_centroid_valid', sql`centroid IS NULL OR ST_IsValid(centroid)`),
  ],
);

export const unitsPub = projection.table(
  'units_pub',
  {
    unitId: uuid('unit_id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsPub.projectId, { onDelete: 'cascade' }),
    unitNumber: varchar('unit_number', { length: 40 }).notNull(),
    presentationStatus: pubPresentationStatus('presentation_status').notNull(),
    facing: text('facing'),
    isCorner: boolean('is_corner').notNull().default(false),
    roadWidthM: doublePrecision('road_width_m'),
    areaSqYd: doublePrecision('area_sq_yd'),
    areaSqFt: doublePrecision('area_sq_ft'),
    dimensionsLabel: varchar('dimensions_label', { length: 40 }),
    classDetails: jsonb('class_details').notNull().default(sql`'[]'::jsonb`),
    pricePaise: paise('price_paise'),
    priceOnRequest: boolean('price_on_request').notNull().default(false),
    priceVersionId: uuid('price_version_id'),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('units_pub_project_number_uq').on(t.projectId, t.unitNumber),
    index('units_pub_project_status_idx').on(t.projectId, t.presentationStatus),
    check('units_pub_price_xor_por', sql`
      (price_on_request AND price_paise IS NULL) OR (NOT price_on_request AND price_paise IS NOT NULL)
    `),
    check('units_pub_price_positive', sql`price_paise IS NULL OR price_paise > 0`),
  ],
);

export const geometryPub = projection.table(
  'geometry_pub',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsPub.projectId, { onDelete: 'cascade' }),
    unitId: uuid('unit_id'),
    featureType: pubFeatureType('feature_type').notNull(),
    geom: geomAny('geom').notNull(),
    properties: jsonb('properties').notNull().default(sql`'{}'::jsonb`),
    geometryVersionId: uuid('geometry_version_id').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('geometry_pub_one_plot_per_unit_uq').on(t.unitId).where(sql`feature_type = 'plot'`),
    index('geometry_pub_project_type_idx').on(t.projectId, t.featureType),
    index('geometry_pub_gix').using('gist', t.geom),
    check('geometry_pub_valid', sql`ST_IsValid(geom)`),
    check('geometry_pub_plot_has_unit', sql`feature_type <> 'plot' OR unit_id IS NOT NULL`),
  ],
);

export const poisPub = projection.table(
  'pois_pub',
  {
    poiId: uuid('poi_id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsPub.projectId, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category').notNull(),
    location: geomPoint('location').notNull(),
    distanceM: integer('distance_m').notNull(),
    driveTimeMin: smallint('drive_time_min'),
    sortOrder: smallint('sort_order').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('pois_pub_project_idx').on(t.projectId, t.sortOrder),
    check('pois_pub_location_valid', sql`ST_IsValid(location)`),
    check('pois_pub_distance_positive', sql`distance_m >= 0`),
  ],
);

export const mediaManifests = projection.table(
  'media_manifests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsPub.projectId, { onDelete: 'cascade' }),
    unitId: uuid('unit_id'),
    kind: pubMediaKind('kind').notNull(),
    altText: text('alt_text').notNull(),
    sortOrder: smallint('sort_order').notNull().default(0),
    variants: jsonb('variants').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('media_manifests_project_kind_idx').on(t.projectId, t.kind, t.sortOrder),
    uniqueIndex('media_manifests_singleton_kinds_uq')
      .on(t.projectId, t.kind)
      .where(sql`kind IN ('hero','og_image') AND unit_id IS NULL`),
  ],
);
