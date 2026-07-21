# FRONTEND_BLUEPRINT.md

> **Generated:** 2026-07-19
> **Scope:** `apps/public` (Website + Presentation Mode) · `apps/crm` (CRM)
> **Audience:** Front-end engineering team (Gemini & Kimi)
> **Rule:** This document is the *sole* contract between the backend data layer and the front-end. You never import from `packages/db` directly — use the TypeScript interfaces, server actions, and design tokens defined here.

---

## Table of Contents

1. [§1 — Projection Data Models (Read-Only Interfaces)](#1--projection-data-models)
2. [§2 — Server Action Contracts (The "USB Cables")](#2--server-action-contracts)
3. [§3 — UI Design Tokens](#3--ui-design-tokens)
4. [§4 — MapLibre Geometry Specs](#4--maplibre-geometry-specs)
5. [§5 — Client-Side Utilities (Public App)](#5--client-side-utilities)
6. [§6 — Route Architecture (Reference)](#6--route-architecture)

---

## §1 — Projection Data Models

The public front-end (`apps/public`) exclusively reads from the `projection` schema via a read-only Drizzle client (`createProjectionClient`). This client has `SELECT`-only grants on the `projection` schema and zero grants on `core`.

The CRM publishes data *into* the projection schema via the `publishProject()` function. The public site never writes.

### 1.1 — Enums

```typescript
// projection.pub_asset_class
type PubAssetClass = 'land' | 'commercial' | 'luxury_residential';

// projection.pub_presentation_status
type PubPresentationStatus =
  | 'available'
  | 'selling_fast'
  | 'on_hold'
  | 'booked'
  | 'sold'
  | 'not_for_sale';

// projection.pub_feature_type
type PubFeatureType = 'plot' | 'boundary' | 'road' | 'amenity' | 'massing';

// projection.pub_media_kind
type PubMediaKind = 'hero' | 'gallery' | 'plan' | 'og_image';
```

### 1.2 — `projects_pub`

```typescript
interface ProjectPub {
  /** UUID — primary key, same as core.projects.id */
  projectId: string;
  /** URL-safe slug, unique. Used in routes: /projects/:slug and /p/:slug */
  slug: string;
  /** Display name */
  name: string;
  /** 'land' | 'commercial' | 'luxury_residential' */
  assetClass: PubAssetClass;
  /** Marketing narrative (rich text / plain text body) */
  narrative: string;
  /** e.g. "Bheemili" */
  locality: string | null;
  /** e.g. "Visakhapatnam" */
  city: string | null;
  /**
   * Approval/legal badges with real numbers.
   * Example: [{ label: "DTCP LP No.", value: "123/2026" }]
   */
  badges: Array<{ label: string; value: string }>;
  /**
   * Amenity tags.
   * Example: ["Clubhouse", "Swimming Pool", "Gated Community"]
   */
  amenities: unknown; // JSONB — owner-defined array of strings/objects
  /** Total inventory count (all statuses) */
  totalUnits: number;
  /** Units with presentation_status = 'available' */
  availableUnits: number;
  /** Generated column: true when availableUnits = 0 */
  isSoldOut: boolean | null;
  /** 'public' = show prices; 'on_request' = show "Price on Request" */
  priceVisibility: 'public' | 'on_request';
  /** Absolute URL to the hero image (web variant) */
  heroUrl: string;
  /**
   * PostGIS Point (SRID 4326) — project map centre.
   * Serialized by Drizzle as an opaque driver value; use WKB parsing
   * or query ST_AsGeoJSON(centroid) to extract [lng, lat].
   */
  centroid: unknown | null;
  /**
   * Bounding box for tile prefetch: [minLng, minLat, maxLng, maxLat].
   * Null when no geometry has been published.
   */
  bbox: [number, number, number, number] | null;
  /** Timestamp of last publish */
  publishedAt: Date;
  /** Row-level last-modified */
  updatedAt: Date;
}
```

**Constraints:**
- `slug` has a unique index
- `total_units >= 0 AND available_units BETWEEN 0 AND total_units`
- `centroid IS NULL OR ST_IsValid(centroid)`

### 1.3 — `units_pub`

```typescript
interface UnitPub {
  /** UUID — primary key, same as core.units.id */
  unitId: string;
  /** FK → projects_pub.projectId (CASCADE delete) */
  projectId: string;
  /** Display number e.g. "A-101", "P42" */
  unitNumber: string;
  /** The public-facing status (6-state, never exposes core 'registered' or 'mortgage') */
  presentationStatus: PubPresentationStatus;
  /** Human-readable facing string: "East", "North West" */
  facing: string | null;
  /** Corner plot flag */
  isCorner: boolean;
  /** Road width in metres */
  roadWidthM: number | null;
  /** Area in sq. yards (land projects) */
  areaSqYd: number | null;
  /** Area in sq. feet (commercial/luxury) */
  areaSqFt: number | null;
  /** Freeform dimension string e.g. "30 × 40" */
  dimensionsLabel: string | null;
  /**
   * Asset-class-specific labeled display fields.
   * Shape: Array<{ label: string; value: string }>
   *
   * Land example:
   *   [{ label: "Survey No.", value: "123" }, { label: "Approval", value: "DTCP - LP/45" }]
   *
   * Commercial example:
   *   [{ label: "Carpet Area", value: "1200 sq ft" }, { label: "RERA No.", value: "..." }]
   *
   * Luxury example:
   *   [{ label: "Configuration", value: "3 BHK" }, { label: "Possession", value: "ready to move" }]
   */
  classDetails: Array<{ label: string; value: string }>;
  /**
   * Price in paise (integer, bigint). NULL when priceOnRequest = true.
   * Display with formatPaiseToLakhCrore() — see §5.
   */
  pricePaise: bigint | null;
  /** true → display "Price on Request" instead of a number */
  priceOnRequest: boolean;
  /** Links back to the pricing snapshot used for computation */
  priceVersionId: string | null;
  /** Row-level last-modified */
  updatedAt: Date;
}
```

**Constraints:**
- `(projectId, unitNumber)` is unique
- `(price_on_request AND price_paise IS NULL) OR (NOT price_on_request AND price_paise IS NOT NULL)`
- `price_paise IS NULL OR price_paise > 0`

### 1.4 — `geometry_pub`

```typescript
interface GeometryPub {
  /** UUID — auto-generated primary key */
  id: string;
  /** FK → projects_pub.projectId (CASCADE delete) */
  projectId: string;
  /** Set for feature_type='plot'; NULL for shared layers (boundary, road, etc.) */
  unitId: string | null;
  /** 'plot' | 'boundary' | 'road' | 'amenity' | 'massing' */
  featureType: PubFeatureType;
  /**
   * PostGIS Geometry (SRID 4326) — any geometry type.
   * For MapLibre consumption, query as GeoJSON:
   *   ST_AsGeoJSON(geom)::json
   * or convert from WKB on the client.
   */
  geom: unknown;
  /**
   * Feature-type-specific JSON properties. Shape depends on featureType.
   * See §4 for the full specification per feature type.
   */
  properties: Record<string, unknown>;
  /** Snapshot version that generated this geometry */
  geometryVersionId: string;
  /** Row-level last-modified */
  updatedAt: Date;
}
```

**Constraints:**
- One plot per unit: unique index on `unitId WHERE feature_type = 'plot'`
- `ST_IsValid(geom)`
- `feature_type <> 'plot' OR unit_id IS NOT NULL`

### 1.5 — `pois_pub`

```typescript
interface PoiPub {
  /** UUID — primary key, same as core.pois.id */
  poiId: string;
  /** FK → projects_pub.projectId (CASCADE delete) */
  projectId: string;
  /** Display name: "Apollo Hospital" */
  name: string;
  /** Human-readable category (spaces, not underscores): "school", "hospital", "transit", etc. */
  category: string;
  /**
   * PostGIS Point (SRID 4326) — the POI pin location.
   * Query as ST_AsGeoJSON(location) for map markers.
   */
  location: unknown;
  /** Distance from project centroid in metres */
  distanceM: number;
  /** Estimated drive time in minutes */
  driveTimeMin: number | null;
  /** Owner-defined sort priority (lower = higher) */
  sortOrder: number;
  /** Row-level last-modified */
  updatedAt: Date;
}
```

**Constraints:**
- `ST_IsValid(location)`
- `distance_m >= 0`

### 1.6 — `media_manifests`

```typescript
interface MediaManifest {
  /** UUID — auto-generated primary key */
  id: string;
  /** FK → projects_pub.projectId (CASCADE delete) */
  projectId: string;
  /** NULL = project-level media; UUID = unit-specific media */
  unitId: string | null;
  /** 'hero' | 'gallery' | 'plan' | 'og_image' */
  kind: PubMediaKind;
  /** Accessibility alt text */
  altText: string;
  /** Display ordering within a kind group */
  sortOrder: number;
  /**
   * Multi-resolution variant URLs. Shape:
   * {
   *   presentation_4k?: { url: string; width: number; height: number };
   *   web?:              { url: string; width: number; height: number };
   *   thumb?:            { url: string; width: number; height: number };
   * }
   *
   * The capability probe (§5.2) selects the appropriate variant key.
   */
  variants: {
    presentation_4k?: { url: string; width: number; height: number };
    web?: { url: string; width: number; height: number };
    thumb?: { url: string; width: number; height: number };
  };
  /** Row-level last-modified */
  updatedAt: Date;
}
```

**Constraints:**
- `hero` and `og_image` are singleton per project (unique index on `(projectId, kind) WHERE kind IN ('hero','og_image') AND unit_id IS NULL`)

### 1.7 — Projection Reader Queries

The public app accesses all data through these pre-built helper functions in `apps/public/src/lib/projection.ts`:

```typescript
// All return Drizzle select results matching the interfaces above

getPublishedProjects(): Promise<ProjectPub[]>
getProjectBySlug(slug: string): Promise<ProjectPub | null>
getUnitsByProjectId(projectId: string): Promise<UnitPub[]>
getGeometryByProjectId(projectId: string): Promise<GeometryPub[]>
getMediaByProjectId(projectId: string): Promise<MediaManifest[]>
getPoisByProjectId(projectId: string): Promise<PoiPub[]>  // ordered by sortOrder
```

---

## §2 — Server Action Contracts

All server actions are Next.js `"use server"` functions that run on the server. They are the exclusive mutation API — the front-end never executes raw SQL.

### 2.0 — Universal Return Type Pattern

Every action returns a discriminated union:

```typescript
// Success
{ ok: true; /* ...optional data */ }

// Failure
{
  ok: false;
  code: 'UNAUTHENTICATED' | 'VALIDATION_FAILED' | 'NOT_FOUND' | 'PERSIST_FAILED' | 'HAS_DEPENDENTS' | 'UNAUTHORIZED';
  message?: string;
  issues?: Record<string, string[]>; // Zod field-level errors
}
```

---

### 2.1 — Public Site Actions (`apps/public`)

#### `submitEnquiry` — Website Lead Capture

**Location:** `apps/public/src/app/(site)/actions.ts`

```typescript
// Zod Input Schema
const EnquirySchema = z.object({
  name:          z.string().min(2),
  phone:         z.string().regex(/^\+[1-9][0-9]{7,14}$/),
  preferredTime: z.enum(['morning', 'afternoon', 'evening', 'any']).optional(),
  message:       z.string().optional(),
  honeypot:      z.string().max(0),  // Must be empty (bot trap)
  projectId:     z.string().uuid(),
  unitId:        z.string().uuid().optional(),
});

// Return Type
type EnquiryActionState =
  | { ok: true }
  | {
      ok: false;
      code: 'VALIDATION_FAILED' | 'PERSIST_FAILED';
      message?: string;
      issues?: Record<string, string[]>;
    };

// Signature
async function submitEnquiry(data: z.infer<typeof EnquirySchema>): Promise<EnquiryActionState>
```

**Notes:**
- HMAC-signs the payload and POSTs to the CRM's lead intake webhook.
- Honeypot-filled submissions silently return `{ ok: true }` (bot drops).

---

### 2.2 — CRM Actions (`apps/crm`)

All CRM actions require authentication. They call `getRoleContext()` and return `{ ok: false, code: 'UNAUTHENTICATED' }` if the session is missing.

#### 2.2.1 — Projects

**Location:** `apps/crm/src/server/actions/projects.ts`

| Action | Input Schema | Return |
|---|---|---|
| `createProject(data)` | `ProjectSchema` | `{ ok: true, project }` |
| `updateProject(projectId, data)` | `ProjectSchema` | `{ ok: true, project }` |
| `publishProjectAction(projectId)` | `string` (UUID) | `{ ok: true }` or `{ ok: false, code: 'VALIDATION_FAILED', checklist }` |

```typescript
const ProjectSchema = z.object({
  name:                    z.string().min(1),
  slug:                    z.string().min(1).regex(/^[a-z0-9-]+$/),
  assetClass:              z.enum(['land', 'commercial', 'luxury_residential']),
  narrative:               z.string().nullable().optional(),
  locality:                z.string().nullable().optional(),
  city:                    z.string().nullable().optional(),
  state:                   z.string().nullable().optional(),
  layoutType:              z.enum(['vmrda','panchayat','farmlands','suda','buda','dtcp','private_land','other']).nullable().optional(),
  approvalNumber:          z.string().nullable().optional(),
  reraNumber:              z.string().nullable().optional(),
  priceVisibility:         z.enum(['public', 'on_request']).default('on_request'),
  sellingFastThresholdPct: z.coerce.number().min(0).max(100).default(15),
  centroidLng:             z.coerce.number().min(-180).max(180).nullable().optional(),
  centroidLat:             z.coerce.number().min(-90).max(90).nullable().optional(),
});
```

**Publish Checklist** (returned when publish fails validation):
```typescript
interface PublishChecklist {
  hero:      string | null;  // "A hero image is required."
  narrative: string | null;  // "Project narrative text is required."
  geometry:  string | null;  // (currently always null — digitizer optional)
  pricing:   string | null;  // "Some units have no price…"
  approval:  string | null;  // "Layout type and approval number are required for land projects."
}
```

---

#### 2.2.2 — Units

**Location:** `apps/crm/src/server/actions/units.ts`

| Action | Input | Return |
|---|---|---|
| `createUnit(projectId, data)` | `UnitSchema` + asset-class detail schema | `{ ok: true, unit }` |
| `updateUnit(projectId, unitId, data)` | `UnitSchema` + asset-class detail schema | `{ ok: true, unit }` |
| `bulkCreateUnits(projectId, data)` | `BulkCreateUnitsSchema` | `{ ok: true, count }` |
| `deleteUnit(projectId, unitId)` | — | `{ ok: true }` or `{ ok: false, code: 'HAS_DEPENDENTS', message }` |
| `transitionUnitStatusAction(unitId, toStatus, options?)` | inline | `{ ok: true }` |

```typescript
const UnitSchema = z.object({
  unitNumber:        z.string().min(1),
  facing:            z.enum(['north','south','east','west','north_east','north_west','south_east','south_west']).optional(),
  isCorner:          z.boolean().default(false),
  areaSqYd:          z.coerce.number().positive().optional(),
  areaSqFt:          z.coerce.number().positive().optional(),
  roadWidthM:        z.coerce.number().positive().optional(),
  dimensionsLabel:   z.string().optional(),
  overridePricePaise:z.coerce.number().min(0).optional(),
  overrideReason:    z.string().optional(),
});

const BulkCreateUnitsSchema = z.object({
  prefix:       z.string().max(20).default(''),
  startNumber:  z.coerce.number().int().min(0),
  count:        z.coerce.number().int().min(1).max(200),
  facing:       z.enum(['north','south','east','west','north_east','north_west','south_east','south_west']).optional(),
  areaSqYd:     z.coerce.number().positive().optional(),
  areaSqFt:     z.coerce.number().positive().optional(),
  roadWidthM:   z.coerce.number().positive().optional(),
  surveyNumber: z.string().optional(), // Required for land asset class
});
```

**Per-Asset-Class Detail Schemas** (submitted alongside `UnitSchema`):

```typescript
// Land Projects
const UnitLandDetailsSchema = z.object({
  surveyNumber:        z.string().min(1),
  subdivisionLineage:  z.string().optional(),
  extentValue:         z.coerce.number().positive().optional(),
  extentUnit:          z.enum(['sq_yd','sq_ft','acre','gunta','cent']).optional(),
  approvalAuthority:   z.enum(['dtcp','hmda','rera','other']).optional(),
  approvalNumber:      z.string().optional(),
  conversionStatus:    z.enum(['not_required','pending','converted']).default('not_required'),
});

// Commercial Projects
const UnitCommercialDetailsSchema = z.object({
  reraNumber:            z.string().optional(),
  carpetAreaSqFt:        z.coerce.number().positive().optional(),
  builtUpAreaSqFt:       z.coerce.number().positive().optional(),
  superBuiltUpAreaSqFt:  z.coerce.number().positive().optional(),
  floorNumber:           z.coerce.number().int().optional(),
  farContext:            z.string().optional(),
  isTenanted:            z.boolean().default(false),
  leaseTerms:            z.string().optional(),
});

// Luxury Residential Projects
const UnitLuxuryDetailsSchema = z.object({
  configuration:     z.string().max(40).optional(),
  possessionStatus:  z.enum(['under_construction','near_possession','ready_to_move']).default('under_construction'),
  reraNumber:        z.string().optional(),
  reraCompletionDate:z.string().optional(),
  ocStatus:          z.enum(['not_applied','applied','received']).default('not_applied'),
  ccStatus:          z.enum(['not_applied','applied','received']).default('not_applied'),
});
```

**Unit Status Transition** — The state machine:
```typescript
// transitionUnitStatusAction(unitId, toStatus, options?)
// options?: { reason?: string; holdId?: string; bookingId?: string; clientId?: string }

// Core Status Types (internal, 7-state)
type UnitStatus =
  | 'available' | 'on_hold' | 'booked' | 'registered'
  | 'sold' | 'not_for_sale' | 'mortgage';

// Legal transitions (state machine)
const LEGAL_TRANSITIONS = {
  initial:      ['available'],
  available:    ['on_hold', 'booked', 'not_for_sale', 'mortgage'],
  on_hold:      ['available', 'booked'],
  booked:       ['registered', 'available'],
  registered:   ['sold'],
  sold:         [],
  not_for_sale: ['available'],
  mortgage:     ['available', 'booked'],
};

// on_hold requires holdId
// booked requires bookingId
```

**Presentation Status Mapping** (core → public):
```
available → available (or 'selling_fast' if owner confirmed)
on_hold → on_hold
booked → booked
registered → booked  (merged for public display)
sold → sold
not_for_sale → not_for_sale
mortgage → not_for_sale  (hidden from buyers)
```

**Owner-facing 4-bucket labels** (CRM dashboard):
```
Available     → 'available'
Booked / Advance Paid / Reserved → 'on_hold', 'booked'
Sold Out      → 'registered', 'sold'
Mortgage      → 'mortgage', 'not_for_sale'
```

---

#### 2.2.3 — Holds

**Location:** `apps/crm/src/server/actions/holds.ts`

| Action | Input | Return |
|---|---|---|
| `createHold(unitId, data)` | `HoldSchema` | `{ ok: true, hold }` |
| `extendHold(holdId, data)` | `ExtendHoldSchema` | `{ ok: true, hold }` |
| `releaseHold(holdId, reason?)` | — | `{ ok: true, hold }` |
| `getActiveHold(unitId)` | — | Hold object or `null` |

```typescript
const HoldSchema = z.object({
  clientName:   z.string().min(1),
  clientPhone:  z.string().regex(/^\+[1-9][0-9]{7,14}$/),
  durationDays: z.coerce.number().int().min(1).max(30),
  reason:       z.string().min(1),
});

const ExtendHoldSchema = z.object({
  additionalDays: z.coerce.number().int().min(1).max(14),
});
```

**Business Rules:**
- Agents: max 14 days total hold duration
- Owners: max 30 days
- Extension past 14 days requires owner role
- Read-path expiry: `isEffectivelyExpired(hold, now)` — any hold past `expiresAt` is treated as expired even if the cron hasn't caught it yet

---

#### 2.2.4 — Bookings

**Location:** `apps/crm/src/server/actions/bookings.ts`

| Action | Input | Return |
|---|---|---|
| `createBooking(data)` | `CreateBookingSchema` | `{ ok: true, bookingId }` |
| `cancelBooking(data)` | `CancelBookingSchema` | `{ ok: true }` |
| `defaultBooking(data)` | `DefaultBookingSchema` | `{ ok: true }` |
| `convertBooking(data)` | `ConvertBookingSchema` | `{ ok: true }` |

```typescript
const CreateBookingSchema = z.object({
  unitId:              z.string().uuid(),
  clientId:            z.string().uuid().optional(),
  newClient:           z.object({
    name:  z.string().min(1),
    phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
  }).optional(),
  agentId:             z.string().uuid().optional(),
  leadId:              z.string().uuid().optional(),
  tokenAmountPaise:    z.coerce.bigint().positive(),
  considerationPaise:  z.coerce.bigint().positive().optional(),
  bookedOn:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(d => d.clientId || d.newClient, {
  message: 'Select an existing client or enter new buyer details',
  path: ['clientId'],
});

const CancelBookingSchema = z.object({
  bookingId: z.string().uuid(),
  reason:    z.string().min(1),
});

const DefaultBookingSchema = z.object({
  bookingId: z.string().uuid(),
});

const ConvertBookingSchema = z.object({
  bookingId:    z.string().uuid(),
  registeredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
```

**Booking Lifecycle:**
```
createBooking → unit transitions to 'booked' (any active hold auto-converts)
cancelBooking → unit returns to 'available', booking.status = 'cancelled'
defaultBooking → unit returns to 'available', booking.status = 'defaulted'
convertBooking → unit transitions to 'registered', booking.status = 'converted'
```

---

#### 2.2.5 — Leads & Pipeline

**Location:** `apps/crm/src/server/actions/leads.ts`

| Action | Input | Return |
|---|---|---|
| `createLead(data)` | `LeadSchema` | `{ ok: true, data: { id } }` |
| `logInteraction(data)` | `LogInteractionSchema` | `{ ok: true, data: { id } }` |
| `changeLeadStage(data)` | `ChangeStageSchema` | `{ ok: true }` |
| `logNegotiation(data)` | `LogNegotiationSchema` | `{ ok: true, data: { id } }` |
| `getLeadFloorPrice(leadId)` | `string` (UUID) | `{ ok: true, data: number \| null }` — **owner only** |
| `getLeadPrivilegedEntries(leadId)` | `string` (UUID) | `{ ok: true, data: NegotiationEntry[] }` — **owner only** |
| `reassignSelectedLeads(data)` | `ReassignSelectedLeadsSchema` | `{ ok: true, count }` — **owner only** |
| `bulkReassignLeads(data)` | `BulkReassignSchema` | `{ ok: true, count }` — **owner only** |

```typescript
const LeadSchema = z.object({
  name:               z.string().min(1).max(100),
  phone:              z.string().regex(/^\+[1-9][0-9]{7,14}$/),
  altPhone:           z.string().regex(/^\+[1-9][0-9]{7,14}$/).optional().or(z.literal('')),
  email:              z.string().email().optional().or(z.literal('')),
  source:             z.enum(['website','portal_99acres','portal_magicbricks','portal_housing','referral','walk_in','channel_partner','other']),
  sourceDetail:       z.string().max(255).optional(),
  budgetMinPaise:     z.union([z.string(), z.number(), z.bigint()]).transform(v => BigInt(v)).optional(),
  budgetMaxPaise:     z.union([z.string(), z.number(), z.bigint()]).transform(v => BigInt(v)).optional(),
  assetClassInterest: z.enum(['land','commercial','luxury_residential']).optional(),
  timelineExpectation:z.string().max(60).optional(),
  interests:          z.array(z.object({
    projectId: z.string().uuid(),
    unitId:    z.string().uuid().optional(),
  })).default([]),
  forceDuplicate:     z.boolean().optional(),
});

const LogInteractionSchema = z.object({
  leadId:          z.string().uuid(),
  interactionType: z.enum(['call','whatsapp','meeting','site_visit']),
  outcomes:        z.array(z.string()).min(1),
  note:            z.string().max(2000).optional(),
  nextFollowUpAt:  z.string().datetime().optional(),
});

const ChangeStageSchema = z.object({
  leadId:     z.string().uuid(),
  toStage:    z.enum(['new','contacted','qualified','site_visit','negotiation','token','agreement','registered','won','lost','dormant']),
  lostReason: z.enum(['budget','location','bought_elsewhere','postponed','unreachable','not_interested','other']).optional(),
  note:       z.string().optional(),
}).refine(d => d.toStage !== 'lost' || !!d.lostReason, {
  message: 'A curated reason is required when marking a lead as lost.',
  path: ['lostReason'],
});

const LogNegotiationSchema = z.object({
  leadId:          z.string().uuid(),
  negotiationKind: z.enum(['asked_price','client_offer','concession','counter']),
  amountPaise:     z.number().positive(),
  unitId:          z.string().uuid().optional().or(z.literal('none')),
  note:            z.string().optional(),
});

const ReassignSelectedLeadsSchema = z.object({
  leadIds:   z.array(z.string().uuid()).min(1),
  toAgentId: z.string().uuid(),
});

const BulkReassignSchema = z.object({
  fromAgentId: z.string().uuid(),
  toAgentId:   z.string().uuid(),
}).refine(d => d.fromAgentId !== d.toAgentId, {
  message: 'Source and destination agents must be different',
  path: ['toAgentId'],
});
```

**Pipeline Stage Graph:**
```
new → contacted, qualified, site_visit, lost, dormant
contacted → qualified, site_visit, negotiation, lost, dormant
qualified → site_visit, negotiation, token, lost, dormant
site_visit → negotiation, token, agreement, lost, dormant, qualified
negotiation → token, agreement, lost, dormant, site_visit
token → agreement, registered, lost, dormant, negotiation
agreement → registered, won, lost, dormant
registered → won, lost, dormant
won → registered, lost
lost → new, contacted, qualified (revival)
dormant → contacted, qualified, site_visit (revival)
```

---

#### 2.2.6 — Triage Inbox (Owner Only)

**Location:** `apps/crm/src/server/actions/leads.ts`

| Action | Input | Return |
|---|---|---|
| `triageAssign(data)` | `TriageAssignSchema` | `{ ok: true }` |
| `triageMerge(data)` | `TriageMergeSchema` | `{ ok: true }` |
| `triageSpam(data)` | `TriageSpamSchema` | `{ ok: true }` |

```typescript
const TriageAssignSchema = z.object({
  leadId:  z.string().uuid(),
  agentId: z.string().uuid(),
});

const TriageMergeSchema = z.object({
  leadId:       z.string().uuid(),
  targetLeadId: z.string().uuid(),
});

const TriageSpamSchema = z.object({
  leadId: z.string().uuid(),
});
```

---

#### 2.2.7 — Pricing

**Location:** `apps/crm/src/server/actions/pricing.ts`

| Action | Input | Return |
|---|---|---|
| `createPriceVersion(projectId, data)` | `PriceVersionSchema` | `{ ok: true, version }` |
| `activatePriceVersion(projectId, data)` | `ActivateVersionSchema` | `{ ok: true }` |

```typescript
const PriceVersionSchema = z.object({
  rateBasis:     z.enum(['per_sq_yd', 'per_sq_ft', 'lump_sum']),
  baseRatePaise: z.coerce.number().min(1),
  reason:        z.string().min(1),
  premiums:      PremiumsSchema, // see below
});

const PremiumsSchema = z.object({
  corner_pct: z.number().min(0).optional(),
  facing:     z.record(z.string(), z.number().min(0)).optional(),
  road_width: z.array(z.object({
    min_m: z.number().min(0),
    pct:   z.number().min(0),
  })).optional(),
  custom: z.array(z.object({
    key:        z.string(),
    label:      z.string(),
    pct:        z.number().min(0).optional(),
    flat_paise: z.number().min(0).optional(),
  })).optional(),
}).default({});

const ActivateVersionSchema = z.object({
  versionId: z.string().uuid(),
});
```

---

#### 2.2.8 — Geometry / Digitizer

*(Note: These actions are backend-only. The frontend digitizer surface was removed, but the actions remain for internal/API use. No frontend UI exists for this feature.)*

**Location:** `apps/crm/src/server/actions/geometry.ts`

| Action | Input | Return |
|---|---|---|
| `saveTransform(data)` | `SaveTransformSchema` | `{ ok: true }` |
| `saveTracedUnits(data)` | `SaveTracedUnitsSchema` | `{ ok: true }` |

```typescript
const SaveTransformSchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  transform: z.object({
    control_points: z.array(z.object({
      layout: z.tuple([z.number(), z.number()]),
      map:    z.tuple([z.number(), z.number()]),
      label:  z.string().max(60).optional(),
    })),
    affine: z.array(z.number()).optional(),
  }),
});

const SaveTracedUnitsSchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  features:  z.array(z.object({
    unitNumber: z.string().min(1),
    geom:       z.any(), // GeoJSON Polygon — validated by domain/geometry/validate
  })),
});
```

---

#### 2.2.9 — POIs

**Location:** `apps/crm/src/server/actions/pois.ts`

| Action | Input | Return |
|---|---|---|
| `createPoi(data)` | `PoiSchema` | `{ ok: true, poi }` |
| `updatePoi(data)` | `UpdatePoiSchema` | `{ ok: true, poi }` |
| `deletePoi(data)` | `DeletePoiSchema` | `{ ok: true }` |
| `reorderPois(data)` | `ReorderPoisSchema` | `{ ok: true }` |

```typescript
const PoiSchema = z.object({
  projectId:            z.string().uuid(),
  name:                 z.string().min(1),
  category:             z.enum(['school','hospital','transit','employment_hub','shopping','leisure','connectivity','landmark','other']),
  location:             z.tuple([z.number(), z.number()]),  // [lng, lat]
  distanceOverrideM:    z.coerce.number().min(0).optional().nullable(),
  driveTimeMin:         z.coerce.number().min(0).optional().nullable(),
  driveTimeOverrideMin: z.coerce.number().min(0).optional().nullable(),
});

const UpdatePoiSchema = PoiSchema.omit({ projectId: true, location: true }).extend({
  poiId:    z.string().uuid(),
  location: z.tuple([z.number(), z.number()]).optional(),
});

const DeletePoiSchema = z.object({ poiId: z.string().uuid() });

const ReorderPoisSchema = z.object({
  projectId:  z.string().uuid(),
  orderedIds: z.array(z.string().uuid()),
});
```

---

#### 2.2.10 — Site Visits

**Location:** `apps/crm/src/server/actions/visits.ts`

| Action | Input | Return |
|---|---|---|
| `createVisit(data)` | `CreateVisitSchema` | `{ ok: true, visit }` |
| `updateVisitStatus(data)` | `UpdateVisitStatusSchema` | `{ ok: true }` |
| `captureVisitOutcome(data)` | `CaptureVisitOutcomeSchema` | `{ ok: true }` |

```typescript
const CreateVisitSchema = z.object({
  scheduledAt: z.string().datetime(),
  agentId:     z.string().uuid(),
  leadIds:     z.array(z.string().uuid()).min(1),
  unitIds:     z.array(z.string().uuid()).optional().default([]),
  pickupPoint: z.string().optional(),
  vehicleNote: z.string().optional(),
  generalNote: z.string().optional(),
});

const UpdateVisitStatusSchema = z.object({
  visitId: z.string().uuid(),
  status:  z.enum(['scheduled','completed','cancelled','no_show']),
});

const CaptureVisitOutcomeSchema = z.object({
  visitId:     z.string().uuid(),
  generalNote: z.string().optional(),
  unitOutcomes: z.array(z.object({
    unitId:      z.string().uuid(),
    outcomes:    z.array(z.string()).min(1),
    outcomeNote: z.string().optional(),
  })).default([]),
});
```

---

#### 2.2.11 — Payment Ledger

**Location:** `apps/crm/src/server/actions/ledger.ts`

| Action | Input | Return |
|---|---|---|
| `appendLedgerEntry(data)` | `AppendLedgerSchema` | `{ ok: true }` |

```typescript
const AppendLedgerSchema = z.object({
  bookingId:       z.string().uuid(),
  entryType:       z.enum(['token','installment','registration','refund','reversal']),
  amountPaise:     z.number().int().min(1),
  paidOn:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode:            z.enum(['cash','cheque','dd','upi','bank_transfer','other']),
  reference:       z.string().max(120).optional(),
  note:            z.string().optional(),
  reversesEntryId: z.string().optional(),
});
```

---

#### 2.2.12 — Commissions

**Location:** `apps/crm/src/server/actions/commissions.ts`

| Action | Input | Return |
|---|---|---|
| `saveCommissionRule(data)` | `SaveCommissionRuleSchema` | `{ ok: true }` |
| `updateCommissionEntry(data)` | `UpdateCommissionEntrySchema` | `{ ok: true }` |
| `overrideCommission(data)` | `OverrideCommissionSchema` | `{ ok: true }` |

```typescript
const TrancheSplitSchema = z.object({
  token:        z.number().int().min(0).max(100),
  agreement:    z.number().int().min(0).max(100),
  registration: z.number().int().min(0).max(100),
}).refine(d => d.token + d.agreement + d.registration === 100, {
  message: 'Tranche splits must sum to exactly 100%',
  path: ['registration'],
});

const SaveCommissionRuleSchema = z.object({
  projectId:    z.string().uuid().optional(),
  rateBps:      z.number().int().min(0).max(10000),
  trancheSplit: TrancheSplitSchema,
});

const UpdateCommissionEntrySchema = z.object({
  entryId:          z.string().uuid(),
  status:           z.enum(['due','paid','voided']),
  paidOn:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentReference: z.string().max(120).optional(),
}).refine(d => d.status !== 'paid' || !!d.paidOn, {
  message: 'Payment date is required when marking as paid',
  path: ['paidOn'],
});

const OverrideCommissionSchema = z.object({
  entryId:               z.string().uuid(),
  overriddenAmountPaise: z.number().int().min(0),
  reason:                z.string().min(3),
});
```

---

#### 2.2.13 — Documents

**Location:** `apps/crm/src/server/actions/documents.ts`

| Action | Input | Return |
|---|---|---|
| `initUnitChecklist(data)` | `InitUnitChecklistSchema` | `{ ok: true }` |

```typescript
const InitUnitChecklistSchema = z.object({
  projectId:  z.string().uuid(),
  unitId:     z.string().uuid(),
  assetClass: z.enum(['land','commercial','luxury_residential']),
});
```

---

#### 2.2.14 — Media

**Location:** `apps/crm/src/server/actions/media.ts`

| Action | Input | Return |
|---|---|---|
| `reorderMedia(data)` | `MediaOrderSchema` | `{ ok: true }` |

```typescript
const MediaOrderSchema = z.object({
  projectId:  z.string().uuid(),
  orderedIds: z.array(z.string().uuid()),
});
```

---

#### 2.2.15 — Devices (Presentation Enrollment)

**Location:** `apps/crm/src/server/actions/devices.ts`

| Action | Input | Return |
|---|---|---|
| `enrollDevice(data)` | `EnrollDeviceSchema` | `{ ok: true, token }` |

```typescript
const EnrollDeviceSchema = z.object({
  label:     z.string().min(1).max(100),
  shortCode: z.string().length(6),
});
```

---

#### 2.2.16 — Settings

**Location:** `apps/crm/src/server/actions/settings.ts`

| Action | Input | Return |
|---|---|---|
| `saveOfficeSettings(data)` | `OfficeSettingsSchema` | `{ ok: true }` |

```typescript
const OfficeSettingsSchema = z.object({
  holdMaxDurationDays:             z.number().int().min(1).max(365),
  overdueEscalationDays:           z.number().int().min(1).max(30),
  defaultSellingFastThresholdPct:  z.number().int().min(0).max(100),
});
```

---

#### 2.2.17 — Users

**Location:** `apps/crm/src/server/actions/users.ts`

| Action | Input | Return |
|---|---|---|
| `inviteUser(data)` | `InviteUserSchema` | `{ ok: true }` |

```typescript
const InviteUserSchema = z.object({
  name:  z.string().min(2),
  phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
  email: z.string().email().optional().or(z.literal('')),
  role:  z.enum(['owner', 'agent']),
});
```

---

#### 2.2.18 — User Settings

**Location:** `apps/crm/src/server/actions/user-settings.ts`

| Action | Input | Return |
|---|---|---|
| `saveUserSettings(data)` | `UserSettingsSchema` | `{ ok: true }` |

```typescript
const UserSettingsSchema = z.object({
  emailDigest: z.boolean(),
});
```

---

## §3 — UI Design Tokens

### 3.1 — `packages/ui/src/tokens.ts` (Full Source)

```typescript
// WCAG 2.1 AA compliant color scale (NFR-A1)
export const colors = {
  brand: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6', // Primary brand
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a', // Text against light backgrounds
    950: '#042f2e',
  },
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },
};

export const spacing = {
  '0': '0px',
  '1': '0.25rem',
  '2': '0.5rem',
  '3': '0.75rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '8': '2rem',
  '10': '2.5rem',
  '12': '3rem',
  '16': '4rem',
  '24': '6rem',
  '32': '8rem',
  '64': '16rem',
};

export const typography: Record<string, [string, { lineHeight: string }]> = {
  'xs': ['0.75rem', { lineHeight: '1rem' }],
  'sm': ['0.875rem', { lineHeight: '1.25rem' }],
  'base': ['1rem', { lineHeight: '1.5rem' }],
  'lg': ['1.125rem', { lineHeight: '1.75rem' }],
  'xl': ['1.25rem', { lineHeight: '1.75rem' }],
  '2xl': ['1.5rem', { lineHeight: '2rem' }],
  '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
  '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
  // FR-PM7: 3-metre-readable scale for the presentation kiosk UI
  'presentation-lg': ['3rem', { lineHeight: '1.1' }],
  'presentation-xl': ['4.5rem', { lineHeight: '1.1' }],
};
```

### 3.2 — `packages/ui/src/status-colors.ts` (Full Source)

```typescript
// Presentation status labels (FR-PM4) mapped to dual-channel indicators (NFR-A3)
export type PresentationStatus =
  | 'available'
  | 'selling_fast'
  | 'on_hold'
  | 'booked'
  | 'sold'
  | 'not_for_sale';

export interface StatusStyle {
  backgroundColor: string;
  foregroundColor: string; // NFR-A1 WCAG contrast compliance
  pattern: 'solid' | 'dots' | 'dashed' | 'stripes' | 'crosshatch' | 'checkerboard';
}

export const statusStyles: Record<PresentationStatus, StatusStyle> = {
  available: {
    backgroundColor: '#dcfce7', // Green 100
    foregroundColor: '#14532d', // Green 900
    pattern: 'solid',
  },
  selling_fast: {
    backgroundColor: '#ffedd5', // Orange 100
    foregroundColor: '#7c2d12', // Orange 900
    pattern: 'dots',
  },
  on_hold: {
    backgroundColor: '#fef08a', // Yellow 300
    foregroundColor: '#713f12', // Yellow 900
    pattern: 'dashed',
  },
  booked: {
    backgroundColor: '#dbeafe', // Blue 100
    foregroundColor: '#1e3a8a', // Blue 900
    pattern: 'stripes',
  },
  sold: {
    backgroundColor: '#e5e7eb', // Gray 200
    foregroundColor: '#1f2937', // Gray 800
    pattern: 'crosshatch',
  },
  not_for_sale: {
    backgroundColor: '#f3f4f6', // Gray 100
    foregroundColor: '#9ca3af', // Gray 400
    pattern: 'checkerboard',
  },
};
```

**Usage Notes:**
- Every status has both a color pair AND a pattern — this is the NFR-A3 dual-channel accessibility requirement (colourblind users can distinguish statuses by pattern alone).
- All color pairs are WCAG 2.1 AA compliant for foreground/background contrast.

### 3.3 — Tailwind Preset

Both apps consume the design system through the shared Tailwind preset at `packages/ui/src/tailwind-preset.ts`:

```typescript
// tailwind.config.ts in apps/crm or apps/public:
import tailwindPreset from '@estate/ui/tailwind-preset';

export default {
  presets: [tailwindPreset],
  content: ['./src/**/*.{ts,tsx}'],
};
```

The preset maps:
- `colors.brand.*` → `brand-50` through `brand-950`
- `colors.neutral.*` → `neutral-50` through `neutral-950`
- shadcn/ui CSS-variable semantic tokens (`--primary`, `--secondary`, `--destructive`, `--muted`, `--accent`, `--popover`, `--card`) via `hsl(var(--x))`
- All spacing and typography scales
- Border radius via CSS variable `--radius`

---

## §4 — MapLibre Geometry Specs

### 4.1 — Feature Type Enum

```typescript
type PubFeatureType = 'plot' | 'boundary' | 'road' | 'amenity' | 'massing';
```

### 4.2 — GeoJSON Conversion

All geometry is stored as PostGIS geometries in SRID 4326 (WGS84). To consume in MapLibre:

```sql
-- Server-side query (RSC or API route):
SELECT
  id,
  unit_id,
  feature_type,
  ST_AsGeoJSON(geom)::json AS geometry,
  properties
FROM projection.geometry_pub
WHERE project_id = $1;
```

The result can be assembled into a GeoJSON `FeatureCollection`:

```typescript
interface MapFeature {
  type: 'Feature';
  id: string;            // geometry_pub.id
  geometry: GeoJSON.Geometry;
  properties: {
    featureType: PubFeatureType;
    unitId?: string;
    // ...type-specific properties (see §4.3)
  };
}
```

### 4.3 — Properties Schema per Feature Type

#### `plot` (unit polygons)

```typescript
interface PlotProperties {
  featureType: 'plot';
  unitId: string;
  plotNumber: string;            // = unitNumber
  facing: string | null;         // "east", "north_west", etc.
  edges: {
    edges: Array<{
      length_m: number;          // Edge length in metres
      bearing: number;           // Compass bearing in degrees
    }>;
    adjacent_unit_ids: string[]; // UUIDs of bordering plots
  } | null;
}
```

#### `boundary` (project outline)

```typescript
interface BoundaryProperties {
  featureType: 'boundary';
  // Typically empty {}. The polygon itself IS the data.
}
```

#### `road` (internal roads)

```typescript
interface RoadProperties {
  featureType: 'road';
  widthM?: number;        // Road width for display labelling
  label?: string;          // e.g. "40ft Road"
}
```

#### `amenity` (clubhouse, park, etc.)

```typescript
interface AmenityProperties {
  featureType: 'amenity';
  label?: string;          // e.g. "Clubhouse", "Park"
  icon?: string;           // Icon identifier for the map marker
}
```

#### `massing` (3D building volumes)

```typescript
interface MassingProperties {
  featureType: 'massing';
  /** Height in metres for fill-extrusion-height */
  heightM: number;
  /** Base elevation for fill-extrusion-base */
  baseM?: number;
  /** Rendered color (hex) */
  color?: string;
  label?: string;
}
```

### 4.4 — 2.5D Extrusion Layer Setup (MapLibre GL JS)

```typescript
// Add a fill-extrusion layer for massing features
map.addLayer({
  id: 'massing-3d',
  type: 'fill-extrusion',
  source: 'project-geometry',
  filter: ['==', ['get', 'featureType'], 'massing'],
  paint: {
    'fill-extrusion-color': ['coalesce', ['get', 'color'], '#94a3b8'],
    'fill-extrusion-height': ['get', 'heightM'],
    'fill-extrusion-base': ['coalesce', ['get', 'baseM'], 0],
    'fill-extrusion-opacity': 0.8,
  },
});

// Plot polygons (flat, coloured by status)
map.addLayer({
  id: 'plots-fill',
  type: 'fill',
  source: 'project-geometry',
  filter: ['==', ['get', 'featureType'], 'plot'],
  paint: {
    'fill-color': [
      'match', ['get', 'presentationStatus'],
      'available',    '#dcfce7',
      'selling_fast', '#ffedd5',
      'on_hold',      '#fef08a',
      'booked',       '#dbeafe',
      'sold',         '#e5e7eb',
      'not_for_sale', '#f3f4f6',
      '#f3f4f6', // fallback
    ],
    'fill-opacity': 0.7,
  },
});

// Boundary outline
map.addLayer({
  id: 'boundary-line',
  type: 'line',
  source: 'project-geometry',
  filter: ['==', ['get', 'featureType'], 'boundary'],
  paint: {
    'line-color': '#0d9488', // brand-600
    'line-width': 2,
    'line-dasharray': [4, 2],
  },
});
```

### 4.5 — Capability-Driven Extrusion Toggle

The capability probe (§5.2) determines whether to enable the 3D extrusion layer:

```typescript
const caps = await probeCapabilities();

if (caps.enableExtrusion) {
  map.addLayer(/* massing-3d layer */);
  map.easeTo({ pitch: 45 }); // Enable 2.5D view
}
```

### 4.6 — Bounding Box & Tile Prefetch

`projects_pub.bbox` is `[minLng, minLat, maxLng, maxLat]` and is used to:

1. **Fit the map view** on initial load: `map.fitBounds(bbox)`
2. **Prefetch map tiles** via `prefetchProjectBundle()` for offline presentation (§5.3)

---

## §5 — Client-Side Utilities

### 5.1 — Currency & Area Formatters

```typescript
// apps/public/src/lib/format.ts

/** Converts paise (integer) to Indian Lakh/Crore display: "₹45 L", "₹1.25 Cr" */
function formatPaiseToLakhCrore(paise: bigint | number | null | undefined): string;

/** Formats sq ft with Indian number system: "1,200 sq ft" */
function formatAreaSqFt(sqFt: number | null | undefined): string;

/** Formats sq yd with Indian number system: "200 sq yd" */
function formatAreaSqYd(sqYd: number | null | undefined): string;
```

### 5.2 — Capability Probe

```typescript
// apps/public/src/lib/capability-probe.ts

type CapabilityTier = 'high' | 'medium' | 'low';
type MediaVariant = 'presentation_4k' | 'web' | 'thumb';
type TransitionStyle = 'full' | 'reduced' | 'crossfade';

interface DeviceCapabilities {
  tier: CapabilityTier;
  /** Key to read from media_manifests.variants */
  mediaVariant: MediaVariant;
  /** false on low-tier → skip fill-extrusion layers */
  enableExtrusion: boolean;
  /** 'crossfade' when prefers-reduced-motion is set */
  transitionStyle: TransitionStyle;
}

async function probeCapabilities(): Promise<DeviceCapabilities>;
```

**Tier scoring** (5-point scale):
- Network: +2 (4G), +1 (3G)
- Memory: +2 (≥8 GB), +1 (≥4 GB)
- GPU: +1 (WebGL present), +2 (discrete/Apple M-series detected)
- **high** ≥ 5.5 (and not on slow network) → `presentation_4k`
- **medium** ≥ 3.5 → `web`
- **low** < 3.5 → `thumb`

### 5.3 — Prefetch (Presentation Mode)

```typescript
// apps/public/src/lib/prefetch.ts

/**
 * Focus-triggered prefetch: caches the project page HTML, hero image,
 * map style JSON, and bbox tile pack into Cache Storage for instant
 * offline loads in presentation mode.
 */
async function prefetchProjectBundle(project: ProjectPub, tier: CapabilityTier): Promise<void>;
```

### 5.4 — Realtime Unit Status Sync

```typescript
// apps/public/src/lib/realtime.ts

/**
 * React hook: combines Supabase Realtime Postgres subscription with
 * a 30-second polling fallback. Returns a live-updating unit array.
 */
function useProjectRealtime<T extends {
  unitId: string;
  presentationStatus: string;
  pricePaise?: bigint | null;
  priceOnRequest?: boolean;
}>(projectId: string, initialUnits: T[]): T[];
```

**Subscription target:** `projection.units_pub` — event `UPDATE`, filter `project_id=eq.{projectId}`

### 5.5 — Spatial Navigation (Presentation Mode)

```typescript
// apps/public/src/lib/spatial-nav.ts

/**
 * Mounts a singleton spatial navigation manager for kiosk arrow-key / gamepad
 * D-pad navigation. Elements opt-in with data-spatial attribute + tabIndex={0}.
 *
 * Touch/mouse automatically disables spatial mode (FR-PM1).
 * Gamepad A/Cross = Enter. D-pad = arrow keys.
 */
function SpatialNavInit(): null; // Drop-in React component in layout.tsx
```

**Opt-in elements:**
```tsx
<button data-spatial tabIndex={0}>Select Plot</button>
```

### 5.6 — Device Token Verification (Presentation Mode)

```typescript
// apps/public/src/lib/device-token.ts

/**
 * Ed25519 signature verification + CRM revocation check.
 * Returns true if DEVICE_ENROLLMENT_ENABLED !== 'true' (feature flag off).
 */
async function verifyDeviceToken(token: string | undefined): Promise<boolean>;
```

---

## §6 — Route Architecture

### 6.1 — Public App (`apps/public`)

| Route | Purpose |
|---|---|
| `/site-home` | Project listing homepage |
| `/projects/[projectSlug]` | Project detail page (website) |
| `/projects/[projectSlug]/[unitSlug]` | Unit detail page (website) |
| `/present-home` | Presentation mode project grid (kiosk) |
| `/enroll` | Device enrollment (kiosk setup) |
| `/p/[projectSlug]` | Presentation mode project view (spatial nav, realtime, 2.5D map) |
| `/api/brochure` | Dynamic PDF brochure generation |
| `/api/health` | Health check endpoint |
| `/api/revalidate` | ISR cache flush webhook (HMAC-protected) |

### 6.2 — CRM App (`apps/crm`)

| Route | Purpose |
|---|---|
| `/login` | Authentication (email/phone OTP) |
| `/` or `/dashboard` | Owner/agent dashboard with queues |
| `/projects` | Project listing |
| `/projects/new` | Create project |
| `/projects/[projectId]` | Project detail / edit |
| `/projects/[projectId]/units` | Unit inventory table |
| `/projects/[projectId]/units/new` | Create unit |
| `/projects/[projectId]/units/[unitId]` | Unit detail (status, holds, bookings, documents) |
| `/projects/[projectId]/pricing` | Price version management |
| `/projects/[projectId]/pois` | POI editor with map picker |
| `/projects/[projectId]/commissions` | Per-project commission view |
| `/leads` | Lead pipeline board |
| `/leads/inbox` | Triage inbox (owner only) |
| `/leads/[leadId]` | Lead detail / timeline |
| `/bookings/[bookingId]` | Booking detail & ledger |
| `/visits` | Site visit calendar |
| `/audit` | Immutable audit log viewer (owner only) |
| `/profile` | User profile |
| `/settings` | Office configuration |
| `/settings/users` | User / agent management |
| `/settings/devices` | Presentation device registry |
| `/settings/commissions` | Global commission rules |
| `/settings/export` | Data export |

### 6.3 — Auth & Role Model

```typescript
type UserRole = 'owner' | 'agent';

interface AppSession {
  role: UserRole;
  userId: string; // UUID
}
```

- **Owner:** full access to all CRM features, settings, audit log, triage inbox, floor price visibility, negotiation history, lead reassignment, commission overrides.
- **Agent:** scoped access — sees only own leads, cannot access triage inbox or audit log, hold max 14 days, no floor price visibility, no commission overrides.

---

---

## §7 — Marketing-Site Data Contract (2026-07-20)

**For every marketing-site page in apps/public, the authoritative contract is
[`BACKEND_CONTRACT_FINAL.md`](./BACKEND_CONTRACT_FINAL.md)** — it contains the five new
verified readers (`getProjectUnitSummaries`, `getAllPublishedUnits`, `getLocalities`,
`getAllMedia`, `getProjectMapData`), the `SiteProjectMap` component contract, real captured
live output for each, and **corrections to this document** (notably: §1.6 `variants` keys
are actually `{ h, w, url }`, and the §1.7 readers return raw WKB — not GeoJSON — for
geometry columns). Where the two documents disagree, BACKEND_CONTRACT_FINAL.md wins.

*End of FRONTEND_BLUEPRINT.md — This is the complete contract. Build against these interfaces. If it's not in this document, it's not your concern.*
