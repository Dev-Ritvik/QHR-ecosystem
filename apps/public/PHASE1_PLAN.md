# apps/public Redesign — Phase 1 Architecture Plan

> Status: AWAITING OWNER APPROVAL — no component code or tables until approved.
> Scope: marketing site only. apps/crm, packages/db/core, RLS/grants untouched.
> Every data shape below was checked against FRONTEND_BLUEPRINT.md §1 and the
> actual `apps/public/src/lib/projection.ts` + `packages/db/src/schema/projection/*`.

## 1. Page classification table

Legend — **(a)** backed by existing real projection data · **(b)** new content, no backend.
"New reader" = a new SELECT-only helper in `apps/public/src/lib/projection.ts` against
existing projection tables. Zero new tables are proposed in this phase.

| # | Page | Route | Class | Data source (exact) | Content strategy & lean |
|---|------|-------|-------|---------------------|-------------------------|
| 1 | Home | `/` (rewrite → `(site)/site-home`) | (a) | `getPublishedProjects()` → ProjectPub (name, slug, heroUrl, locality, city, assetClass, availableUnits, totalUnits, isSoldOut, priceVisibility) | Hero/signature moments are design work over real project data; copy blocks file-based |
| 2 | Start Here | `/start-here` | (a) | `getPublishedProjects()` + **new reader** `getProjectUnitSummaries()` (per-project min/max `pricePaise`, area range, availability — aggregate over units_pub) | Wizard steps (budget → asset class → locality) are code + static copy; results are live data |
| 3 | Projects | `/projects` | (a) | `getPublishedProjects()`; filters on assetClass / locality / isSoldOut — all existing ProjectPub fields | — |
| 4 | Project Details | `/projects/[projectSlug]` | (a) | Existing: `getProjectBySlug`, `getUnitsByProjectId`, `getMediaByProjectId`, `getPoisByProjectId`; map via **new reader** `getProjectMapData()` returning `ST_AsGeoJSON`-converted geometry/centroid/POI points (see §3) | — |
| 5 | Properties | `/properties` | (a) | **New reader** `getAllPublishedUnits()` — `units_pub ⋈ projects_pub` (unitNumber, presentationStatus, facing, isCorner, areaSqYd/SqFt, classDetails, pricePaise, priceOnRequest + project slug/name/locality). All fields exist; no invention needed | — |
| 6 | Property Details | `/projects/[projectSlug]/[unitNumber]` | (a) | Existing join query in current unit page (units_pub by `(project slug, unitNumber)`), `classDetails`, brochure via existing `/api/brochure/...` | Keep this canonical URL; `/properties` links into it. No duplicate `/properties/[id]` route |
| 7 | Locations | `/locations` | (a) | **New reader** `getLocalities()` — group projects_pub by locality/city + centroid (GeoJSON) + pois_pub counts | Locality descriptions (2–3 paragraphs each) file-based MDX |
| 8 | About Us | `/about` | (b) | — | **MDX** (`content/about.mdx`). Single business, changes ~never. No table |
| 9 | Why Choose Us | `/why-us` | (b) | — | **Typed JSON/TS** (pillars: title, proof point, metric) + MDX intro. No table |
| 10 | Investment Guide | `/investment-guide` | (b) | — | **MDX chapters** with frontmatter (can cite live stats via a small server component). No table |
| 11 | Knowledge Center / Blog | `/knowledge`, `/knowledge/[slug]` | (b) | — | **MDX + frontmatter** (title, date, tags, cover). Static blog is the textbook file-based case. No table |
| 12 | Gallery | `/gallery` | (a)+(b) | **New reader** `getAllMedia()` (media_manifests ⋈ projects_pub, kinds `gallery`/`hero`; `variants.web/thumb`) — only 4 live rows today | Supplement with a file-based curated set until owner uploads more via CRM media pipeline |
| 13 | Testimonials | `/testimonials` | (b) | — | **Typed JSON** now. Flagged: the one page (with Construction Updates) that could justify a table — see §5. Leaning file-based this phase |
| 14 | Construction Updates | `/construction-updates` | (b) | — | **Typed JSON** (date, project slug ref, body, images) now. Strongest future-table candidate — see §5. Leaning file-based this phase |
| 15 | Downloads | `/downloads` | (a)+(b) | media_manifests `kind='plan'` + existing `/api/brochure/[projectSlug]/[unitSlug]` route | File-based registry for static docs (company profile, approval copies) |
| 16 | Branches | `/branches` | (b) | — | **Typed JSON** (name, address, phone, hours, map pin). No table |
| 17 | Careers | `/careers` | (b) | — | **Typed JSON** listings (+ optional `/careers/[slug]` MDX). Applications = mailto/WhatsApp link, NOT a form into the lead pipeline (they're not property leads). No table |
| 18 | FAQs | `/faqs` | (b) | — | **Typed JSON** grouped by topic. No table |
| 19 | Contact Us | `/contact` | (a) | `submitEnquiry` (existing §2.1 contract) with `projectId` relaxed to optional on the public-side schema — CRM intake already tolerates a missing projectId (verified in `apps/crm/src/app/api/enquiries/route.ts`: interest link is conditional) | Office/phone/hours file-based |
| 20 | Book a Site Visit | `/book-a-visit` | (a) | `submitEnquiry` → HMAC → CRM `/api/enquiries` → real lead (details §4) | — |
| F1 | Privacy Policy | `/privacy-policy` | (b) | — | MDX |
| F2 | Terms & Conditions | `/terms` | (b) | — | MDX |
| F3 | Cookie Policy | `/cookie-policy` | (b) | — | MDX |
| F4 | Refund/Cancellation | `/refund-policy` | (b) | — | MDX |
| F5 | Sitemap (human) | `/sitemap` | (a)+(b) | Static route list + `getPublishedProjects()` for project/unit links. XML sitemap already exists (`app/sitemap.ts`) — extend it with the new static routes | — |
| F6 | 404 | `not-found.tsx` | (b) | — | Designed 404 with live "explore projects" links |

**Interfaces that don't cover a need (said explicitly, not invented):**
- No cross-project units query exists (`projection.ts` is per-project only) → new reader #5.
- No aggregate price/area summary exists → new reader #2.
- No media-across-projects query exists → new reader #12.
- Nothing in projection carries testimonials, construction updates, branches, careers, FAQs, or long-form editorial — those are genuinely category (b).

## 2. Live projection data reality (checked 2026-07-20 against `dhmatgzlqoogsnerdfsl`)

- projects_pub: **5 rows — 3 are stale dev fixtures** (`test-project`, `luxury-villas`, `budget-apartments`) that would render on the real marketing site. **Needs approval:** delete those 3 rows from projection only (cascades within projection; core untouched — they aren't real core projects).
- Real: `lucky-gardens` (184 units) and `the-azure-residences` (3 units). *Nirvik garden is not yet published* — owner action in CRM, not code.
- units_pub 387 (incl. fixture units) · pois_pub 6 · media_manifests 4 · **geometry_pub 0** · bbox NULL everywhere; centroid present only on the 2 real projects.

## 3. 2.5D map — diagnosis (audited, not assumed)

**Verdict: KEEP AND FIX.** The MapLibre infrastructure (layer specs, status patterns per
NFR-A3, camera presets, skeleton view) is sound. The feature fails for three independent,
individually fatal, all *boundary-level* reasons — none require a rebuild:

1. **Missing env var.** `NEXT_PUBLIC_MAPTILER_API_KEY` is absent from `apps/public/.env.local`
   (only `DATABASE_URL` + `NEXT_PUBLIC_APP_URL` exist; `.env.example` documents ~15 vars).
   The style URL becomes `?key=undefined` → MapTiler 403 → MapLibre `style` error →
   `mapFailed` → fallback UI… which references `/fallbacks/map-placeholder.jpg`, **which
   doesn't exist** (`public/` contains only `sw.js`). Net: silent dark box. The repeatedly-hit
   missing-env-var class, twice over.
2. **WKB is never converted to GeoJSON.** The projection Drizzle `customType` for PostGIS
   columns has no `fromDriver` — `centroid`, `geom`, `location` come back as raw WKB hex
   strings. `ProjectMap` does `project.centroid?.coordinates` (→ undefined → map centers on
   [0,0], Null Island) and passes raw rows as `features:` to a GeoJSON source;
   `buildPoiGeoJSON` uses `poi.location` as a GeoJSON geometry. **No conversion exists
   anywhere in apps/public** — with a valid key you'd get a basemap of the Gulf of Guinea
   with zero overlays. This latent bug affects (site) and (present) identically; it was
   masked because geometry_pub has always had 0 rows (empty and broken look the same).
3. **No geometry has ever been published** (geometry_pub = 0, bbox NULL). Even fully fixed,
   today's map shows basemap + centroid + 6 POIs — no plot polygons. The redesign must
   treat the map as a location/connectivity feature that *progressively enhances* into the
   plot/2.5D view when geometry exists — not as a page that assumes polygons.

**Fix plan (site-side only):** a new `getProjectMapData()` reader that does the conversion
server-side via `ST_AsGeoJSON(geom)::json` (exactly the pattern already prescribed in
blueprint §4.2 that the current code skipped), a site-owned map component reusing the pure
layer-spec modules (`plot-layers`, `poi-layers`, `camera-presets` — imported, not edited),
the env var added, and a real designed fallback state.

**Presentation Mode isolation — explicit confirmation:** `(present)` is reached only via the
`present.` host rewrite in `middleware.ts` and imports nothing from `(site)`. I will not edit
`ProjectMap.tsx`, the existing five reader functions, anything under `components/present/`,
`(present)/`, or the middleware host logic. New readers are additive functions; the shared
layer-spec modules are imported read-only. Presentation mode therefore cannot change
behavior. (Note: presentation's map has the same latent WKB bug — fixing it there is a
separate, flag-for-approval item, not part of this redesign.)

## 4. Book a Site Visit → real CRM pipeline (confirmed flow)

Verified end-to-end path: `submitEnquiry` (apps/public, §2.1 contract) → HMAC-SHA256
signed POST → **existing** `apps/crm/src/app/api/enquiries/route.ts` → verifies signature +
honeypot + rate limit → E.164 normalize → **idempotent lead insert** (`source='website'`,
`triage_status='new'`, dedupe key) + `lead_interests` link when projectId/unitId present →
lands in the owner's Triage Inbox → owner assigns an agent → agent schedules the actual
visit via the CRM's `createVisit`. The public form must NOT call `createVisit` directly
(authenticated, agent-owned scheduling decision) — the enquiry→triage→assign→schedule flow
IS the designed pipeline, and the form will say so honestly ("we'll call to confirm a slot").

**Gaps found (flagged, fix needs your approval since the intake route is apps/crm):**
- The intake route **drops `preferredTime` entirely** and stores only `message.substring(0,60)`
  into `timeline_expectation` (semantically wrong field). A visitor's requested slot never
  reaches the CRM. Minimal enrichment (map preferredTime + message into `source_detail`
  (varchar 255, already exists on core.leads, unused by intake) or a `note` lead_event) is a
  ~5-line change in the intake route — **out of scope until you approve it**. Until then the
  form works but the CRM sees only name/phone/project.
- `LEAD_INTAKE_URL` / `LEAD_INTAKE_SECRET` are missing from both apps' local `.env` files —
  the enquiry form currently returns "Internal configuration error". Same env-var class as the map.
- Public-side `EnquirySchema` requires `projectId`; for `/contact` and generic `/book-a-visit`
  it becomes optional (public-side change only; intake already tolerates absence).

## 5. Content strategy summary (the "don't build 8 CMSes" answer)

**Default: file-based, all of category (b), this phase.** Two structural reasons beyond
simplicity: (1) this is one business's site where a developer already curates every pixel;
(2) a DB-backed content type is only useful with an admin UI, and the only admin surface is
apps/crm — **which is out of scope** — so any "lightweight table" would either ship without
an editing UI (worse than a file) or violate the scope boundary.

- **MDX** (long-form): about, investment guide, knowledge posts, locality descriptions, policies.
- **Typed JSON/TS modules** (structured lists, typo-checked by `tsc`): FAQs, branches,
  careers, why-us pillars, testimonials, construction updates, downloads registry.
- **Flagged for the future, leaning file-based now:** *Construction Updates* (owner will
  eventually want to post monthly progress photos without a developer — natural future CRM
  module reusing the media pipeline) and *Testimonials* (same, lower frequency). Revisit
  both only when CRM scope reopens; migrating JSON → table later is mechanical.

## 6. Route map (26 routes, consistent with the (site)/(present) split)

```
apps/public/src/app/
├── (site)/                        ← marketing site (default host)
│   ├── site-home/                 ← "/" via middleware rewrite (rebuilt Home)
│   ├── start-here/
│   ├── projects/                  ← listing + filters
│   │   └── [projectSlug]/         ← project details (rebuilt)
│   │       └── [unitSlug]/        ← property details (canonical unit URL, rebuilt)
│   ├── properties/                ← cross-project unit browser → links to canonical URLs
│   ├── locations/
│   ├── about/            ├── why-us/           ├── investment-guide/
│   ├── knowledge/        │   └── [slug]/       ├── gallery/
│   ├── testimonials/     ├── construction-updates/
│   ├── downloads/        ├── branches/         ├── careers/
│   ├── faqs/             ├── contact/          ├── book-a-visit/
│   ├── privacy-policy/ terms/ cookie-policy/ refund-policy/ sitemap/
│   └── not-found.tsx              ← designed 404
├── (present)/                     ← kiosk; present.* host only — UNTOUCHED
│   ├── present-home/  ├── p/[projectSlug]/  └── enroll/
└── api/                           ← brochure, health, revalidate — unchanged
```

Middleware needs zero changes: only `/` is rewritten per host; every new path passes
through and resolves inside `(site)`. On the `present.` host the new marketing routes
don't resolve (they exist only in `(site)`) — the kiosk cannot accidentally serve them.

## 7. Approvals requested before Phase 2

1. This plan overall (classification, file-based content strategy, route map).
2. Delete the 3 stale fixture projects from **projection only** (they'd show on the live site).
3. The ~5-line CRM intake enrichment so preferredTime/message survive into the lead (§4) — or defer.
4. Confirm you'll publish Nirvik garden from the CRM when ready (no code needed).
5. (Deferred, separate) backport the WKB fix to presentation mode's map.
