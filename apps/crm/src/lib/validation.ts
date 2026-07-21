import { z } from 'zod';

// ---------------------------------------------------------------------------
// Projects & Inventory
// ---------------------------------------------------------------------------

export const ProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Lowercase alphanumeric and dashes only'),
  assetClass: z.enum(['land', 'commercial', 'luxury_residential']),
  narrative: z.string().nullable().optional(),
  locality: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  layoutType: z.enum(['vmrda', 'panchayat', 'farmlands', 'suda', 'buda', 'dtcp', 'private_land', 'other']).nullable().optional(),
  approvalNumber: z.string().nullable().optional(),
  reraNumber: z.string().nullable().optional(),
  priceVisibility: z.enum(['public', 'on_request']).default('on_request'),
  sellingFastThresholdPct: z.coerce.number().min(0).max(100).default(15),
  // Project location pin (drives default map centering across POI picker,
  // digitizer, and distance computations). Set via the map in ProjectForm.
  centroidLng: z.coerce.number().min(-180).max(180).nullable().optional(),
  centroidLat: z.coerce.number().min(-90).max(90).nullable().optional(),
});

export type ProjectFormData = z.infer<typeof ProjectSchema>;

export const PremiumsSchema = z.object({
  corner_pct: z.number().min(0).optional(),
  facing: z.record(z.string(), z.number().min(0)).optional(),
  road_width: z.array(
    z.object({
      min_m: z.number().min(0),
      pct: z.number().min(0)
    })
  ).optional(),
  custom: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      pct: z.number().min(0).optional(),
      flat_paise: z.number().min(0).optional()
    })
  ).optional(),
}).default({});

export const PriceVersionSchema = z.object({
  rateBasis: z.enum(['per_sq_yd', 'per_sq_ft', 'lump_sum']),
  baseRatePaise: z.coerce.number().min(1, 'Base rate must be greater than 0'),
  reason: z.string().min(1, 'Reason for rate change is required'),
  premiums: z.any().transform((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return {};
      }
    }
    return val;
  }).pipe(PremiumsSchema),
});

export const ActivateVersionSchema = z.object({
  versionId: z.string().uuid(),
});

export const UnitSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required'),
  facing: z.enum(['north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west']).optional(),
  isCorner: z.boolean().default(false),
  areaSqYd: z.coerce.number().positive().optional(),
  areaSqFt: z.coerce.number().positive().optional(),
  roadWidthM: z.coerce.number().positive().optional(),
  dimensionsLabel: z.string().optional(),
  overridePricePaise: z.coerce.number().min(0).optional(),
  overrideReason: z.string().optional(),
});

// Per-asset-class detail schemas. Keys match the drizzle detail tables
// (unit_land_details / unit_commercial_details / unit_luxury_details) so the
// parsed output can be inserted/upserted directly.
export const BulkCreateUnitsSchema = z.object({
  prefix: z.string().max(20).default(''),
  startNumber: z.coerce.number().int().min(0),
  count: z.coerce.number().int().min(1).max(200),
  facing: z.enum(['north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west']).optional(),
  areaSqYd: z.coerce.number().positive().optional(),
  areaSqFt: z.coerce.number().positive().optional(),
  roadWidthM: z.coerce.number().positive().optional(),
  // Land projects: survey number is NOT NULL on unit_land_details; one value
  // is applied to every generated unit (edit per unit afterwards).
  surveyNumber: z.string().optional(),
});

export const UnitLandDetailsSchema = z.object({
  surveyNumber: z.string().min(1, 'Survey number is required'),
  subdivisionLineage: z.string().optional(),
  extentValue: z.coerce.number().positive().optional(),
  extentUnit: z.enum(['sq_yd', 'sq_ft', 'acre', 'gunta', 'cent']).optional(),
  approvalAuthority: z.enum(['dtcp', 'hmda', 'rera', 'other']).optional(),
  approvalNumber: z.string().optional(),
  conversionStatus: z.enum(['not_required', 'pending', 'converted']).default('not_required'),
});

export const UnitCommercialDetailsSchema = z.object({
  reraNumber: z.string().optional(),
  carpetAreaSqFt: z.coerce.number().positive().optional(),
  builtUpAreaSqFt: z.coerce.number().positive().optional(),
  superBuiltUpAreaSqFt: z.coerce.number().positive().optional(),
  floorNumber: z.coerce.number().int().optional(),
  farContext: z.string().optional(),
  isTenanted: z.boolean().default(false),
  leaseTerms: z.string().optional(),
});

export const UnitLuxuryDetailsSchema = z.object({
  configuration: z.string().max(40).optional(),
  possessionStatus: z.enum(['under_construction', 'near_possession', 'ready_to_move']).default('under_construction'),
  reraNumber: z.string().optional(),
  reraCompletionDate: z.string().optional(),
  ocStatus: z.enum(['not_applied', 'applied', 'received']).default('not_applied'),
  ccStatus: z.enum(['not_applied', 'applied', 'received']).default('not_applied'),
});

// ---------------------------------------------------------------------------
// Geometry / Digitizer
// ---------------------------------------------------------------------------

export const SaveTransformSchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  transform: z.object({
    control_points: z.array(z.object({
      layout: z.tuple([z.number(), z.number()]),
      map: z.tuple([z.number(), z.number()]),
      label: z.string().max(60).optional(),
    })),
    affine: z.array(z.number()).optional(),
  }),
});

export const SaveTracedUnitsSchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  features: z.array(
    z.object({
      unitNumber: z.string().min(1, 'Unit number is required'),
      geom: z.any(), // GeoJSON.Polygon loosely validated here, strictly validated by domain logic
    })
  ),
});

// ---------------------------------------------------------------------------
// POIs
// ---------------------------------------------------------------------------

export const PoiSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  category: z.enum([
    'school', 'hospital', 'transit', 'employment_hub',
    'shopping', 'leisure', 'connectivity', 'landmark', 'other'
  ]),
  location: z.tuple([z.number(), z.number()]), // [lng, lat]
  distanceOverrideM: z.coerce.number().min(0).optional().nullable(),
  driveTimeMin: z.coerce.number().min(0).optional().nullable(),
  driveTimeOverrideMin: z.coerce.number().min(0).optional().nullable(),
});

export const DeletePoiSchema = z.object({
  poiId: z.string().uuid(),
});

export const ReassignSelectedLeadsSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1, 'Select at least one lead'),
  toAgentId: z.string().uuid(),
});

export const UpdatePoiSchema = PoiSchema.omit({ projectId: true, location: true }).extend({
  poiId: z.string().uuid(),
  location: z.tuple([z.number(), z.number()]).optional(), // only when the pin moved
});

export const ReorderPoisSchema = z.object({
  projectId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()),
});

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const InitUnitChecklistSchema = z.object({
  projectId: z.string().uuid(),
  unitId: z.string().uuid(),
  assetClass: z.enum(['land', 'commercial', 'luxury_residential']),
});

// ---------------------------------------------------------------------------
// Holds
// ---------------------------------------------------------------------------

export const HoldSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  clientPhone: z.string().regex(/^\+[1-9][0-9]{7,14}$/, 'Must be a valid E.164 phone number'),
  durationDays: z.coerce.number().int().min(1).max(30),
  reason: z.string().min(1, 'Reason is required'),
});

export const ExtendHoldSchema = z.object({
  additionalDays: z.coerce.number().int().min(1).max(14),
});

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export const CreateBookingSchema = z.object({
  unitId: z.string().uuid(),
  // Either an existing client or details for a new one (detailed booking form)
  clientId: z.string().uuid().optional(),
  newClient: z.object({
    name: z.string().min(1, 'Buyer name is required'),
    phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/, 'Must be E.164, e.g. +919876543210'),
  }).optional(),
  // Agent responsible; defaults to the acting user when omitted
  agentId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  tokenAmountPaise: z.coerce.bigint().positive('Token amount must be positive'),
  considerationPaise: z.coerce.bigint().positive('Consideration must be positive').optional(),
  bookedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
}).refine((d) => d.clientId || d.newClient, {
  message: 'Select an existing client or enter new buyer details',
  path: ['clientId'],
});

export const CancelBookingSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(1, 'Cancellation reason is required'),
});

export const DefaultBookingSchema = z.object({
  bookingId: z.string().uuid(),
});

export const ConvertBookingSchema = z.object({
  bookingId: z.string().uuid(),
  registeredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
});

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export const MediaOrderSchema = z.object({
  projectId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()),
});

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export const EnrollDeviceSchema = z.object({
  label: z.string().min(1, 'Label is required').max(100),
  shortCode: z.string().length(6, 'Short code must be exactly 6 characters'),
});

// ---------------------------------------------------------------------------
// Leads & Pipeline
// ---------------------------------------------------------------------------

export const LeadSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/, 'Must be a valid E.164 phone number (e.g. +919876543210)'),
  altPhone: z.string().regex(/^\+[1-9][0-9]{7,14}$/, 'Must be a valid E.164 phone number').optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  source: z.enum(['website', 'portal_99acres', 'portal_magicbricks', 'portal_housing', 'referral', 'walk_in', 'channel_partner', 'other']),
  sourceDetail: z.string().max(255).optional(),
  budgetMinPaise: z.union([z.string(), z.number(), z.bigint()]).transform(v => (v === '' || v == null) ? undefined : BigInt(v)).optional(),
  budgetMaxPaise: z.union([z.string(), z.number(), z.bigint()]).transform(v => (v === '' || v == null) ? undefined : BigInt(v)).optional(),
  assetClassInterest: z.enum(['land', 'commercial', 'luxury_residential']).optional(),
  timelineExpectation: z.string().max(60).optional(),
  interests: z.array(z.object({
    projectId: z.string().uuid(),
    unitId: z.string().uuid().optional(),
  })).default([]),
  forceDuplicate: z.boolean().optional(),
}).refine(data => {
  if (data.budgetMinPaise && data.budgetMaxPaise) {
    return data.budgetMaxPaise >= data.budgetMinPaise;
  }
  return true;
}, { message: 'Max budget must be greater than or equal to min budget', path: ['budgetMaxPaise'] });

export const LogInteractionSchema = z.object({
  leadId: z.string().uuid(),
  interactionType: z.enum(['call', 'whatsapp', 'meeting', 'site_visit']),
  outcomes: z.array(z.string()).min(1, 'At least one outcome is required'),
  note: z.string().max(2000).optional(),
  nextFollowUpAt: z.string().datetime().optional(),
});

export const ChangeStageSchema = z.object({
  leadId: z.string().uuid(),
  toStage: z.enum(['new', 'contacted', 'qualified', 'site_visit', 'negotiation', 'token', 'agreement', 'registered', 'won', 'lost', 'dormant']),
  lostReason: z.enum(['budget', 'location', 'bought_elsewhere', 'postponed', 'unreachable', 'not_interested', 'other']).optional(),
  note: z.string().optional(),
}).refine((data) => data.toStage !== 'lost' || !!data.lostReason, {
  message: 'A curated reason is required when marking a lead as lost.',
  path: ['lostReason'],
});

// ---------------------------------------------------------------------------
// Triage Inbox
// ---------------------------------------------------------------------------

export const TriageAssignSchema = z.object({
  leadId: z.string().uuid(),
  agentId: z.string().uuid(),
});

export const TriageMergeSchema = z.object({
  leadId: z.string().uuid(),
  targetLeadId: z.string().uuid(),
});

export const TriageSpamSchema = z.object({
  leadId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Negotiation
// ---------------------------------------------------------------------------

export const LogNegotiationSchema = z.object({
  leadId: z.string().uuid(),
  negotiationKind: z.enum(['asked_price', 'client_offer', 'concession', 'counter']),
  amountPaise: z.number().positive(),
  unitId: z.string().uuid().optional().or(z.literal('none')),
  note: z.string().optional(),
}).transform(data => ({
  ...data,
  unitId: data.unitId === 'none' ? undefined : data.unitId
}));

// ---------------------------------------------------------------------------
// Site Visits
// ---------------------------------------------------------------------------

export const CreateVisitSchema = z.object({
  scheduledAt: z.string().datetime(),
  agentId: z.string().uuid(),
  leadIds: z.array(z.string().uuid()).min(1, 'At least one lead is required'),
  unitIds: z.array(z.string().uuid()).optional().default([]),
  pickupPoint: z.string().optional(),
  vehicleNote: z.string().optional(),
  generalNote: z.string().optional(),
});

export const UpdateVisitStatusSchema = z.object({
  visitId: z.string().uuid(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']),
});

export const CaptureVisitOutcomeSchema = z.object({
  visitId: z.string().uuid(),
  generalNote: z.string().optional(),
  unitOutcomes: z.array(
    z.object({
      unitId: z.string().uuid(),
      outcomes: z.array(z.string()).min(1, 'Select at least one outcome'),
      outcomeNote: z.string().optional(),
    })
  ).default([]),
});

// ---------------------------------------------------------------------------
// Ledger (T76)
// ---------------------------------------------------------------------------

export const AppendLedgerSchema = z.object({
  bookingId: z.string().uuid(),
  entryType: z.enum(['token', 'installment', 'registration', 'refund', 'reversal']),
  amountPaise: z.number().int().min(1, 'Amount must be greater than 0'),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  mode: z.enum(['cash', 'cheque', 'dd', 'upi', 'bank_transfer', 'other']),
  reference: z.string().max(120).optional(),
  note: z.string().optional(),
  reversesEntryId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Commission Rules & Entries (T77)
// ---------------------------------------------------------------------------

export const TrancheSplitSchema = z.object({
  token: z.number().int().min(0).max(100),
  agreement: z.number().int().min(0).max(100),
  registration: z.number().int().min(0).max(100),
}).refine(data => data.token + data.agreement + data.registration === 100, {
  message: "Tranche splits must sum to exactly 100%",
  path: ["registration"]
});

export const SaveCommissionRuleSchema = z.object({
  projectId: z.string().uuid().optional(),
  rateBps: z.number().int().min(0).max(10000, "Rate cannot exceed 10000 bps (100%)"),
  trancheSplit: TrancheSplitSchema
});

export const UpdateCommissionEntrySchema = z.object({
  entryId: z.string().uuid(),
  status: z.enum(['due', 'paid', 'voided']),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date").optional(),
  paymentReference: z.string().max(120).optional(),
}).refine(data => {
  if (data.status === 'paid' && !data.paidOn) return false;
  return true;
}, { message: "Payment date is required when marking as paid", path: ["paidOn"] });

export const OverrideCommissionSchema = z.object({
  entryId: z.string().uuid(),
  overriddenAmountPaise: z.number().int().min(0, "Amount cannot be negative"),
  reason: z.string().min(3, "Reason is required and must be descriptive"),
});

export const BulkReassignSchema = z.object({
  fromAgentId: z.string().uuid("Invalid source agent ID"),
  toAgentId: z.string().uuid("Invalid destination agent ID"),
}).refine(data => data.fromAgentId !== data.toAgentId, {
  message: "Source and destination agents must be different",
  path: ["toAgentId"]
});

export const OfficeSettingsSchema = z.object({
  holdMaxDurationDays: z.number().int().min(1).max(365),
  overdueEscalationDays: z.number().int().min(1).max(30),
  defaultSellingFastThresholdPct: z.number().int().min(0).max(100),
});

export const InviteUserSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/, "Must be E.164 format (e.g. +919876543210)"),
  email: z.string().email("Invalid email").optional().or(z.literal('')),
  role: z.enum(['owner', 'agent']),
});

export const UserSettingsSchema = z.object({
  emailDigest: z.boolean(),
});

