# BACKEND_CONTRACT_FINAL.md — Locked Data Contract for the apps/public Redesign

> **Captured:** 2026-07-20 against the LIVE database (`dhmatgzlqoogsnerdfsl`), executed as
> the app's own `projection_reader` role over the exact connection in `apps/public/.env.local`.
> **Every sample below is real captured output, not a hypothetical.** Reproduce any of it with:
> `pnpm dlx tsx apps/public/scripts/capture-contract.ts` (from repo root).
>
> This document supersedes FRONTEND_BLUEPRINT.md §1.7 for the marketing site and **corrects
> one blueprint error** (§6 below). Build every data-dependent page against THIS file.
> If a field is not here, it does not exist — do not invent fields.

---

## 0. Ground rules for the frontend builder

1. **Read-only.** All readers live in `apps/public/src/lib/projection.ts` and run as
   `projection_reader` (SELECT on `projection` schema only; access to `core` is denied —
   re-verified this session: `select … from core.projects` → `42501`).
2. **Money:** the NEW readers return paise as **`string | null`** (stringified bigint —
   e.g. `"460000000"` = ₹46,00,000). Format with `formatPaiseToLakhCrore(BigInt(v))` from
   `src/lib/format.ts`. Never `parseFloat` money.
   The LEGACY readers (`getUnitsByProjectId`, unit-page join) return `pricePaise` as a JS
   **`BigInt`** — it cannot cross a Server→Client component boundary unserialized; convert
   with `.toString()` at the boundary.
3. **Geometry:** only the new readers return GeoJSON. The legacy readers return raw **WKB
   hex strings** for `centroid`/`geom`/`location` (proof in §5.6) — never feed those to
   MapLibre; that was the bug that broke the old map.
4. **Dates:** all readers return JS `Date` objects for `publishedAt`/`updatedAt` — same
   Server→Client serialization caveat.
5. **Statuses** seen in live data: `available`, `selling_fast`, `booked`, `sold` (full enum:
   + `on_hold`, `not_for_sale`). `priceOnRequest: true` ⇒ `pricePaise` is null (DB CHECK).

## 1. Environment contract (`apps/public/.env.local`)

| Var | Status | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ set (projection_reader, pgbouncer) | all readers |
| `NEXT_PUBLIC_APP_URL` | ✅ set | absolute URLs |
| `NEXT_PUBLIC_MAPTILER_API_KEY` | ⚠️ **placeholder added, empty** — owner supplies key from https://cloud.maptiler.com/account/keys/ | basemap style; name verified to match `components/map/*` |
| `LEAD_INTAKE_URL`, `LEAD_INTAKE_SECRET` | ❌ missing | `submitEnquiry` → CRM webhook; the enquiry form returns "Internal configuration error" until set (must match apps/crm's `LEAD_INTAKE_SECRET`; URL = `<crm-origin>/api/enquiries`) |
| Others (`.env.example`) | ❌ missing | Supabase realtime, Sentry, PostHog, site identity — non-blocking for build |

**CSP note (verified live):** `connect-src` allows only `'self'`, `*.supabase.co`,
`*.maptiler.com`, `us.i.posthog.com`. Any third-party map style/tile host will be blocked
by the app itself — MapTiler is the only permitted basemap vendor.

## 2. NEW readers (this session; verified live)

All in `apps/public/src/lib/projection.ts`. Interfaces below are copied from the source —
they are exported, so **import the types, don't redeclare them**.

### 2.1 `getProjectUnitSummaries(): Promise<ProjectUnitSummary[]>`

```typescript
interface ProjectUnitSummary {
  projectId: string; slug: string; name: string;
  assetClass: 'land' | 'commercial' | 'luxury_residential';
  unitCount: number;
  availableCount: number;            // presentation_status IN ('available','selling_fast')
  minPricePaise: string | null;      // over priced units only; null if none priced
  maxPricePaise: string | null;
  hasPriceOnRequest: boolean;
  minAreaSqYd: number | null; maxAreaSqYd: number | null;
  minAreaSqFt: number | null; maxAreaSqFt: number | null;
}
```

**Real output (full, both live projects):**
```json
[
 { "projectId": "e0b1fc7e-d9a0-45b4-8117-2696af0aff61", "slug": "lucky-gardens",
   "name": "lucky gardens", "assetClass": "land", "unitCount": 184, "availableCount": 183,
   "minPricePaise": null, "maxPricePaise": null, "hasPriceOnRequest": true,
   "minAreaSqYd": 100, "maxAreaSqYd": 100, "minAreaSqFt": 999, "maxAreaSqFt": 999 },
 { "projectId": "fae05fea-a561-493a-b2ce-cdd49adcf810", "slug": "the-azure-residences",
   "name": "The Azure Residences", "assetClass": "luxury_residential", "unitCount": 3,
   "availableCount": 1, "minPricePaise": "460000000", "maxPricePaise": "770005500",
   "hasPriceOnRequest": false, "minAreaSqYd": 272.22, "maxAreaSqYd": 466.67,
   "minAreaSqFt": 2450, "maxAreaSqFt": 4200 }
]
```
Note the real-world case Start Here must handle: an entire project (lucky-gardens) is
price-on-request → both min/max are null. Design for it; it is live today.

### 2.2 `getAllPublishedUnits(): Promise<PublishedUnitRow[]>` — 187 rows live

```typescript
interface PublishedUnitRow {
  unitId: string; projectId: string; projectSlug: string; projectName: string;
  locality: string | null; city: string | null;
  assetClass: 'land' | 'commercial' | 'luxury_residential';
  unitNumber: string;
  presentationStatus: 'available' | 'selling_fast' | 'on_hold' | 'booked' | 'sold' | 'not_for_sale';
  facing: string | null;             // lowercase machine values: "north", "north_east", or null
  isCorner: boolean;
  roadWidthM: number | null; areaSqYd: number | null; areaSqFt: number | null;
  dimensionsLabel: string | null;    // e.g. "35x70"
  classDetails: Array<{ label: string; value: string }>;   // [] when unset
  pricePaise: string | null;         // stringified bigint
  priceOnRequest: boolean;
}
```
Ordered by `projectName, unitNumber` (NB: `unitNumber` sorts as text — "10" < "2").

**Real sample (a land row with sparse data + a fully-populated luxury row — both live):**
```json
[
 { "unitId": "451fe2f0-3663-4c75-b330-c6b549a91048", "projectId": "e0b1fc7e-…",
   "projectSlug": "lucky-gardens", "projectName": "lucky gardens",
   "locality": "Seethammadhara", "city": "Visakhapatnam", "assetClass": "land",
   "unitNumber": "1", "presentationStatus": "selling_fast", "facing": null,
   "isCorner": false, "roadWidthM": null, "areaSqYd": null, "areaSqFt": null,
   "dimensionsLabel": null, "classDetails": [], "pricePaise": null, "priceOnRequest": true },
 { "unitId": "16305052-4cd8-4902-b467-b921076aa80b", "projectId": "fae05fea-…",
   "projectSlug": "the-azure-residences", "projectName": "The Azure Residences",
   "locality": "Seethammadhara", "city": "Visakhapatnam", "assetClass": "luxury_residential",
   "unitNumber": "A-102", "presentationStatus": "selling_fast", "facing": "north",
   "isCorner": true, "roadWidthM": 40, "areaSqYd": 272.22, "areaSqFt": 2450,
   "dimensionsLabel": "35x70",
   "classDetails": [ { "label": "Configuration", "value": "4BHK Duplex" },
                     { "label": "Possession", "value": "under construction" } ],
   "pricePaise": "460000000", "priceOnRequest": false }
]
```
Design constraint from live data: many land rows have null facing/areas/dimensions and
empty `classDetails` — the /properties browser must be beautiful with sparse rows.

### 2.3 `getLocalities(): Promise<LocalityGroup[]>`

```typescript
interface LocalityGroup {
  locality: string | null; city: string | null;
  projectCount: number;
  totalAvailableUnits: number;       // sum of projects_pub.available_units
  poiCount: number;
  projects: Array<{
    slug: string; name: string;
    assetClass: 'land' | 'commercial' | 'luxury_residential';
    availableUnits: number; heroUrl: string;
    centroid: { type: 'Point'; coordinates: [number, number] } | null;  // GeoJSON [lng, lat]
  }>;
}
```

**Real output (full — live data has exactly one locality today):**
```json
[
 { "locality": "Seethammadhara", "city": "Visakhapatnam", "projectCount": 2,
   "totalAvailableUnits": 184, "poiCount": 6,
   "projects": [
    { "slug": "lucky-gardens", "name": "lucky gardens", "assetClass": "land",
      "availableUnits": 183,
      "heroUrl": "https://dhmatgzlqoogsnerdfsl.supabase.co/storage/v1/object/public/project-media/e0b1fc7e-d9a0-45b4-8117-2696af0aff61/hero_1784304263382.jpg?width=1200&resize=contain",
      "centroid": { "type": "Point", "coordinates": [83.287968987, 17.689375982] } },
    { "slug": "the-azure-residences", "name": "The Azure Residences",
      "assetClass": "luxury_residential", "availableUnits": 1,
      "heroUrl": "https://dhmatgzlqoogsnerdfsl.supabase.co/storage/v1/object/public/project-media/fae05fea-a561-493a-b2ce-cdd49adcf810/hero_1784299088426.png?width=1200&resize=contain",
      "centroid": { "type": "Point", "coordinates": [83.297422785, 17.741488475] } } ] }
]
```
The /locations page must not assume multiple localities — there is ONE today.

### 2.4 `getAllMedia(): Promise<SiteMediaRow[]>` — 4 rows live

```typescript
interface SiteMediaRow {
  id: string; projectId: string; projectSlug: string; projectName: string;
  unitId: string | null;
  kind: 'hero' | 'gallery' | 'plan' | 'og_image';
  altText: string; sortOrder: number;
  variants: {   // ⚠ REAL keys are h/w/url — see §6 blueprint correction
    presentation_4k?: { url: string; w: number; h: number };
    web?: { url: string; w: number; h: number };
    thumb?: { url: string; w: number; h: number };
  };
}
```

**Real sample (one row, live):**
```json
{ "id": "d3ebe761-2efd-4854-9a02-ac3a27064201", "projectId": "e0b1fc7e-…",
  "projectSlug": "lucky-gardens", "projectName": "lucky gardens", "unitId": null,
  "kind": "plan", "altText": "A premium enclave of ultrj-luxury apartments…", "sortOrder": 0,
  "variants": {
    "web":  { "h": 900,  "w": 1200, "url": "https://dhmatgzlqoogsnerdfsl.supabase.co/storage/v1/object/public/project-media/e0b1fc7e-…/plan_1784304365898.png?width=1200&resize=contain" },
    "thumb":{ "h": 300,  "w": 400,  "url": "…?width=400&resize=contain" },
    "presentation_4k": { "h": 2160, "w": 3840, "url": "…?width=3840&resize=contain" } } }
```
Live gallery reality: 4 rows total (2 hero, 1 gallery, 1 plan) — /gallery needs its
file-based supplement from day one.

### 2.5 `getProjectMapData(projectId: string): Promise<ProjectMapData>`

```typescript
interface ProjectMapData {
  centroid: { type: 'Point'; coordinates: [number, number] } | null;  // REAL centre, never [0,0]
  bbox: [number, number, number, number] | null;                      // null for ALL live projects
  features: Array<{                    // GeoJSON Features, plots enriched with status
    type: 'Feature'; id: string; geometry: Record<string, unknown>;
    properties: Record<string, unknown> & {
      featureType: 'plot' | 'boundary' | 'road' | 'amenity' | 'massing';
      unitId?: string | null; plotNumber?: string | null; presentationStatus?: string | null;
    };
  }>;
  pois: Array<{                        // ordered by sortOrder
    type: 'Feature'; id: string;
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { name: string; category: string; distanceM: number;
                  driveTimeMin: number | null; sortOrder: number };
  }>;
}
```

**Real output (the-azure-residences, full):**
```json
{ "centroid": { "type": "Point", "coordinates": [83.297422785, 17.741488475] },
  "bbox": null,
  "features": [],
  "pois": [
   { "type": "Feature", "id": "8ce9431d-4272-49a4-8175-bdf2c50147cc",
     "geometry": { "type": "Point", "coordinates": [83.299052713, 17.70127173] },
     "properties": { "name": "Apollo Hospital", "category": "leisure",
                     "distanceM": 200, "driveTimeMin": 5, "sortOrder": 0 } },
   { "type": "Feature", "id": "39ee5819-0f69-40c9-a6bc-4ea776e2bea0",
     "geometry": { "type": "Point", "coordinates": [83.299022343, 17.774883532] },
     "properties": { "name": "Apollo Hospital (Main)", "category": "landmark",
                     "distanceM": 60, "driveTimeMin": null, "sortOrder": 1 } },
   { "type": "Feature", "id": "f6fdf18d-7948-4d34-b8b8-09b6fbd5c12d",
     "geometry": { "type": "Point", "coordinates": [83.296800513, 17.740172316] },
     "properties": { "name": "rtuf", "category": "school",
                     "distanceM": 800, "driveTimeMin": null, "sortOrder": 3 } } ] }
```
lucky-gardens: centroid `[83.287968987, 17.689375982]`, bbox null, 0 features, 3 POIs.
POI properties do **not** include `metaLabel` (the presentation helper adds that) —
compose display strings ("200 m · 5 min") client-side.

## 3. Map components (verified this session — real browser)

`components/map/SiteProjectMap.tsx` + `components/map/MapLocationFallback.tsx`.

```typescript
<SiteProjectMap
  data={ProjectMapData}        // from getProjectMapData — the ONLY accepted shape
  projectName={string}
  locality={string | null} city={string | null}
  styleUrl={string?}           // harness/test override only; omit in product code
  className={string?}          // defaults to h-full w-full; container must have height
/>
```

Degradation ladder (each step verified in real Chromium against live data):
1. No `NEXT_PUBLIC_MAPTILER_API_KEY`, no centroid, or fatal engine error →
   `<MapLocationFallback>` renders the SAME location content (project, locality,
   nearest-POI list with distances) as a designed brand-dark panel. No dead images.
2. Key + centroid, zero features (today's live reality) → location/connectivity map:
   basemap centred on the true centroid, POI markers/labels.
3. `features` non-empty → plot/boundary layers (reused pure specs) appear automatically.

Fatal-error policy: failures BEFORE the style loads (bad key, CSP block, WebGL loss) →
fallback + `console.warn('[SiteProjectMap] …', reason)`. Post-load tile/glyph fetch
failures are cosmetic and never hide a working map (verified: glyph 403s rendered text
locally, map stayed live).

DO NOT use `components/map/ProjectMap.tsx` on marketing pages — it is the presentation-mode
component with the legacy raw-row data path, kept untouched for kiosk isolation.

## 4. Enquiry / Book-a-Site-Visit contract (unchanged this session)

`submitEnquiry` (`(site)/actions.ts`): name (min 2), phone (E.164 `+`…), preferredTime?
(`morning|afternoon|evening|any`), message?, honeypot (must be empty), projectId (uuid,
**currently required**), unitId?. Flow: HMAC-sign → POST `LEAD_INTAKE_URL` → CRM inserts
lead (source `website`, triage inbox, deduped) + interest link. Known truths for UX copy:
the CRM currently receives name/phone/project-interest; preferredTime/message do NOT
survive intake (enrichment approved-pending separately). Relaxing projectId→optional for
generic contact is a public-side-only change (CRM tolerates absence) — do it when building
`/contact`, in `actions.ts`, nowhere else.

## 5. Legacy readers (presentation contract — UNCHANGED, with caveats)

`getPublishedProjects`, `getProjectBySlug`, `getUnitsByProjectId`, `getGeometryByProjectId`,
`getMediaByProjectId`, `getPoisByProjectId` — exactly as FRONTEND_BLUEPRINT §1.7.

**§5.6 WKB proof (captured):** `getProjectBySlug('the-azure-residences').centroid` →
`typeof === "string"`, value `"0101000020E61000004CE493F908D3544018CD4D…"`. Raw driver WKB.
Marketing pages must use §2 readers for anything geometric or cross-project.

## 6. Blueprint corrections (reality vs FRONTEND_BLUEPRINT.md)

1. **§1.6 `MediaManifest.variants` is WRONG about key names.** Real stored shape uses
   **`{ h, w, url }`**, not `{ width, height, url }`. Captured above. Trust this document.
2. §1.7's readers return WKB for geometry columns (blueprint §1.2 hints it; §4.2's
   ST_AsGeoJSON guidance was never implemented until `getProjectMapData`).
3. §2.2.7 lists `activatePriceVersion(projectId, data)` with `ActivateVersionSchema` — the
   actual signature is `activatePriceVersion(projectId: string, versionId: string)`. (CRM
   detail; irrelevant to the public site but noted for accuracy.)

## 7. Final live state (2026-07-20, post-cleanup)

| Project | slug | units_pub | available | POIs | media | centroid | bbox | geometry_pub |
|---|---|---|---|---|---|---|---|---|
| lucky gardens | `lucky-gardens` | 184 | 183 | 3 | 2 | ✅ | null | 0 |
| The Azure Residences | `the-azure-residences` | 3 | 1 | 3 | 2 | ✅ | null | 0 |

- The 3 dev fixtures (`test-project`, `luxury-villas`, `budget-apartments`) are **deleted
  from projection** (cascade removed their 200 units); `core` untouched (row count 4 → 4;
  those slugs never existed in core).
- **geometry_pub = 0 rows** → the redesign treats every map as location/connectivity
  (centroid + POIs). Plot polygons and 2.5D are dormant progressive enhancement — do not
  build UI that requires them.
- `Nirvik garden` (40 units, priced) exists in core but is **not published** — it appears
  automatically in every reader above the moment the owner publishes it from the CRM.
- Migration `0020_projection_reader_extensions.sql` applied live: `GRANT USAGE ON SCHEMA
  extensions TO projection_reader` (PostGIS calls). Security boundary re-verified after.

## 8. Hazards for whoever runs tests

- `apps/public/e2e/global-setup.ts` **seeds fixture data into whatever `DATABASE_URL`
  points at** — currently the LIVE database (this is how the deleted fixtures got there).
  Do not run the default Playwright suite against live; point it at a disposable DB first.
- Dev server: `pnpm dev` in apps/public runs on **:3001** (CRM owns :3000).
