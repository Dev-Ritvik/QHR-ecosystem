# PROGRESS.md

> **Audited against this working tree (`C:\dev\estate`) on 2026-07-21.** Every line was
> verified by reading files, running tests, or querying the live database. Nothing here is
> inferred from planning documents or commit messages — where those disagree with the code,
> **the code is recorded**.

---

## STATUS AT A GLANCE (30-second read)

| Area | State | Evidence |
|---|---|---|
| **Backend / DB** | ✅ **Real** — 23 migration files (0000–0020), RLS enforced | `packages/db/migrations/` |
| **CRM app** | ✅ **Real** — full ticket sequence T22–T90 shipped | `apps/crm/src/app/` |
| **Public — data layer** | ✅ **Real** — readers + locked contract with captured live output | `BACKEND_CONTRACT_FINAL.md` |
| **Public — presentation (kiosk)** | ✅ **Real** — T49–T64, untouched | `apps/public/src/app/(present)/` |
| **Public — marketing pages** | ⚠️ **5 of 26 routes exist**; 3 are pre-redesign | §2 |
| **3D experience (Slice 0)** | ⚠️ **Step 2 skeleton only** — canvas + probe + 2 nodes. **No villa, no heartbeat, no bloom** | §2 |
| **3D assets (.glb)** | ❌ **None exist**, and no loader path exists | §3 |
| **Domain tests** | ✅ **148 passing** (17 files, ran 2026-07-21, 1.69s) | §4 |
| **🔴 Live bugs in committed code** | **troika/r3f-perf crash** + **invalid Referrer-Policy** — both still present | §1, §6 |

### ⛔ Read this before trusting the git history

**HEAD commit `e6a09dd` is titled** *"Slice 0 Step 2 fully verified: persistent canvas (GEN 1),
**troika removed, referrer-policy bug fixed**, 3/3 tests green"* — **but neither fix is in the
committed code.** Verified directly in the working tree (which is identical to HEAD for these files):

- `apps/public/src/components/experience/ExperienceCanvas.tsx:24` → `import { Perf } from 'r3f-perf';`
- `apps/public/src/components/experience/ExperienceCanvas.tsx:91` → `<Perf position="bottom-right" />`
- `apps/public/package.json` → `"r3f-perf": "7.2.3"` still a dependency
- `apps/public/next.config.mjs:34` → `{ key: 'Referrer-Policy', value: 'DENY' }`

**Consequence:** `/about` and `/why-us` will throw the troika worker error
(*"Worker module function was called but `init` did not return a callable function"*), because
`r3f-perf` → `@react-three/drei` → `troika-three-text` spawns a blob worker that Next 14's
bundler breaks. The fixes for both were performed in a **different working directory** and
were never transferred here. See §6 for the exact remediation.

**One-line summary:** backend and CRM are production-grade; the marketing site is a Step-2
architectural skeleton with ~19% of routes built, and it currently **does not run clean** in
the browser because two known fixes are missing from this checkout.

---

## Phase 1 — Backend & CRM (complete)

*Ticket history T01–T90, preserved verbatim. Note: a few recorded paths have since drifted — `(site)/page.tsx` is now `(site)/site-home/page.tsx`; `next.config.ts` is `next.config.mjs`; and T33–T35's digitizer UI was later removed (§1).*

[x] T01 — Monorepo scaffold + CI skeleton — files: package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, .gitignore, .env.example, .github/workflows/ci.yml, and workspace package.json/tsconfig.json stubs

[x] T02 — packages/ui design tokens — files: packages/ui/src/tokens.ts, packages/ui/src/status-colors.ts, packages/ui/src/tailwind-preset.ts, packages/ui/src/index.ts

[x] T03 — Paise money type — files: packages/domain/vitest.config.ts, packages/domain/src/money/paise.ts, packages/domain/src/money/format.ts, and associated test files

[x] T04 — Unit status state machine — files: packages/domain/src/unit-status/machine.ts, packages/domain/src/unit-status/machine.test.ts

[x] T05 — Presentation label rules — files: packages/domain/src/unit-status/presentation-label.ts, packages/domain/src/unit-status/presentation-label.test.ts

[x] T06 — Hold expiry rules — files: packages/domain/src/holds/expiry.ts, packages/domain/src/holds/expiry.test.ts

[x] T07 — Pricing computation — files: packages/domain/src/pricing/compute.ts, packages/domain/src/pricing/compute.test.ts

[x] T08 — Lead pipeline machine + dedupe — files: packages/domain/src/leads/pipeline.ts, packages/domain/src/leads/pipeline.test.ts, packages/domain/src/leads/dedupe.ts, packages/domain/src/leads/dedupe.test.ts

[x] T09 — Permission matrix — files: packages/domain/src/permissions/matrix.ts, packages/domain/src/permissions/matrix.test.ts

[x] T10 — Geometry validation — files: packages/domain/src/geometry/validate.ts, packages/domain/src/geometry/validate.test.ts

[x] T11 — Drizzle config + auth/users migration — files: packages/db/drizzle.config.ts, packages/db/.env.example, packages/db/src/schema/core/enums.ts, packages/db/src/schema/core/auth.ts, packages/db/migrations/0000_init.sql

[x] T12 — Inventory migration — files: packages/db/src/schema/core/projects.ts, packages/db/src/schema/core/price-versions.ts, packages/db/src/schema/core/units.ts, packages/db/src/schema/core/unit-details-land.ts, packages/db/src/schema/core/unit-details-commercial.ts, packages/db/src/schema/core/unit-details-luxury.ts, packages/db/migrations/0001_inventory.sql

[x] T13 — Clients & leads migration — files: packages/db/src/schema/core/clients.ts, packages/db/src/schema/core/leads.ts, packages/db/src/schema/core/lead-events.ts, packages/db/migrations/0002_clients_leads.sql

[x] T14 — Holds, bookings, status events migration — files: packages/db/src/schema/core/holds.ts, packages/db/src/schema/core/bookings.ts, packages/db/src/schema/core/unit-status-events.ts, packages/db/migrations/0003_holds_bookings.sql

[x] T15 — Site visits & documents migration — files: packages/db/src/schema/core/site-visits.ts, packages/db/src/schema/core/documents.ts, packages/db/migrations/0004_site_visits_documents.sql

[x] T16 — Money migration — files: packages/db/src/schema/core/payment-ledger.ts, packages/db/src/schema/core/commission-rules.ts, packages/db/src/schema/core/commission-entries.ts, packages/db/src/schema/core/commission-overrides.ts, packages/db/migrations/0005_money.sql

[x] T17 — Geometry & POI migration — files: packages/db/src/schema/core/geometry-versions.ts, packages/db/src/schema/core/unit-geometries.ts, packages/db/src/schema/core/pois.ts, packages/db/src/schema/core/audit-log.ts, packages/db/migrations/0006_geometry_pois.sql

[x] T18 — Projection schema migration — files: packages/db/src/schema/projection/enums.ts, packages/db/src/schema/projection/projects-pub.ts, packages/db/src/schema/projection/units-pub.ts, packages/db/src/schema/projection/geometry-pub.ts, packages/db/src/schema/projection/pois-pub.ts, packages/db/src/schema/projection/media-manifests.ts, packages/db/migrations/0007_projection.sql

[x] T19 — Roles, grants, append-only, RLS migration — files: packages/db/sql/roles.sql, packages/db/sql/rls.sql, packages/db/migrations/0008_roles_rls.sql

[x] T20 — DB client factories — files: packages/db/src/client-core.ts, packages/db/src/client-projection.ts, packages/db/src/index.ts

[x] T21 — RLS context wrapper + export lockdown — files: packages/db/src/client-core.ts (withCoreContext, AppSession, CoreDb, CoreTransaction), packages/db/src/index.ts (locked exports), apps/crm/src/server/db.ts (authedQuery singleton), packages/db/src/__tests__/rls-context.test.ts, packages/db/.env.example (DATABASE_URL_CRM)

[x] T22 — CRM app scaffold — files: apps/crm/package.json, apps/crm/tsconfig.json, apps/crm/next.config.ts, apps/crm/tailwind.config.ts, apps/crm/postcss.config.mjs, apps/crm/components.json, apps/crm/.env.example, apps/crm/src/app/layout.tsx, apps/crm/src/app/globals.css, apps/crm/src/server/db.ts, apps/crm/instrumentation.ts, apps/crm/sentry.client.config.ts, apps/crm/sentry.server.config.ts — note: adopted @estate/* scope, fixed tailwind presets key, adapted db.ts to createAuthedCoreAccess API

[x] T23 — Better Auth: login + sessions — files: apps/crm/src/server/auth.ts, apps/crm/src/app/api/auth/[...all]/route.ts, apps/crm/src/lib/auth-client.ts, apps/crm/src/app/(auth)/login/page.tsx, apps/crm/src/server/session.ts

[x] T24 — Authenticated shell + audit helper — files: apps/crm/src/server/audit.ts, apps/crm/src/components/shell/RoleContext.tsx, apps/crm/src/components/shell/AppShell.tsx, apps/crm/src/app/(app)/layout.tsx, apps/crm/src/app/(app)/page.tsx

[x] T25 — Projects CRUD — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/projects.ts, apps/crm/src/app/(app)/projects/page.tsx, apps/crm/src/app/(app)/projects/new/page.tsx, apps/crm/src/app/(app)/projects/[projectId]/page.tsx, apps/crm/src/components/projects/ProjectForm.tsx

[x] T26 — Price versions — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/pricing.ts, apps/crm/src/components/pricing/PriceVersionForm.tsx, apps/crm/src/app/(app)/projects/[projectId]/pricing/page.tsx

[x] T27 — Unit inventory CRUD — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/units.ts, apps/crm/src/components/units/UnitForm.tsx, apps/crm/src/components/units/UnitTable.tsx, apps/crm/src/app/(app)/projects/[projectId]/units/page.tsx, apps/crm/src/app/(app)/projects/[projectId]/units/new/page.tsx, apps/crm/src/app/(app)/projects/[projectId]/units/[unitId]/page.tsx

[x] T28 — Status transition service — files: apps/crm/src/server/actions/units.ts, apps/crm/src/components/units/StatusBadge.tsx, apps/crm/src/components/units/TransitionDialog.tsx

[x] T29 — Holds — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/holds.ts, apps/crm/src/components/units/HoldDialog.tsx

[x] T30 — Hold-expiry cron — files: apps/crm/src/app/api/cron/expire-holds/route.ts, apps/crm/vercel.json — Replicated T28 DB transaction logic inline as system-level execution bypassing standard session auth.

[x] T31 — Bookings — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/bookings.ts

[x] T32 — Media pipeline — files: packages/db/src/schema/core/media.ts, packages/db/migrations/0009_media.sql, apps/crm/src/server/actions/media.ts, apps/crm/src/components/projects/ProjectGallery.tsx — RLS omitted for core.media (marketing assets) matching projects/units pattern. DATABASE_SCHEMA.md updated.

[x] T33 — Layout upload + georeferencing — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/geometry.ts, apps/crm/src/components/digitizer/DigitizerCanvas.tsx, apps/crm/src/components/digitizer/GeoreferencePanel.tsx, apps/crm/src/app/(app)/projects/[projectId]/digitizer/page.tsx

[x] T34 — Polygon tracing + unit linking — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/geometry.ts, apps/crm/src/components/digitizer/snapping.ts, apps/crm/src/components/digitizer/TracePanel.tsx, apps/crm/src/app/(app)/projects/[projectId]/digitizer/page.tsx

[x] T35 — Geometry activation + edge derivation — files: packages/domain/src/geometry/edge-derivation.ts, packages/domain/src/geometry/edge-derivation.test.ts, apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/geometry.ts, apps/crm/src/components/digitizer/TracePanel.tsx

[x] T36 — POI curation — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/pois.ts, apps/crm/src/components/pois/PoiMapPicker.tsx, apps/crm/src/components/pois/PoiForm.tsx, apps/crm/src/app/(app)/projects/[projectId]/pois/page.tsx

[x] T37 — publish() service — files: apps/crm/src/server/publish.ts

[x] T38 — Publish UI + inline republish hooks — files: apps/crm/src/components/publish/PublishChecklist.tsx, apps/crm/src/server/actions/projects.ts, apps/crm/src/server/actions/units.ts, apps/crm/src/server/actions/pricing.ts, apps/crm/src/server/actions/geometry.ts

[x] T39 — Reconciliation cron — files: apps/crm/src/app/api/cron/reconcile/route.ts

[x] T40 — Public app scaffold — files: apps/public/package.json, apps/public/next.config.ts, apps/public/tailwind.config.ts, apps/public/postcss.config.mjs, apps/public/.env.example, apps/public/sentry.client.config.ts, apps/public/sentry.server.config.ts, apps/public/instrumentation.ts, apps/public/src/middleware.ts, apps/public/src/app/globals.css, apps/public/src/app/layout.tsx, apps/public/src/app/(site)/posthog-provider.tsx, apps/public/src/app/(site)/layout.tsx, apps/public/src/app/(site)/page.tsx, apps/public/src/app/(present)/layout.tsx, apps/public/src/app/(present)/page.tsx, apps/public/src/lib/projection.ts, apps/public/src/lib/format.ts

[x] T41 — Project catalog (home) — files: apps/public/src/app/(site)/page.tsx, apps/public/src/components/site/ProjectCard.tsx, apps/public/src/app/api/revalidate/route.ts

[x] T42 — Read-only project map component — files: apps/public/src/components/map/plot-layers.ts, apps/public/src/components/map/ProjectMap.tsx

[x] T43 — Project detail page — files: apps/public/src/components/site/EmptyStates.tsx, apps/public/src/components/site/ApprovalBadges.tsx, apps/public/src/app/(site)/projects/[projectSlug]/page.tsx

[x] T44 — Unit detail page — files: apps/public/src/components/site/UnitSpecs.tsx, apps/public/src/app/(site)/projects/[projectSlug]/[unitSlug]/page.tsx

[x] T45 — Enquiry intake API (CRM side) — files: apps/crm/src/app/api/enquiries/route.ts

[x] T46 — Enquiry form (public side) — files: apps/public/src/app/(site)/actions.ts, apps/public/src/app/(site)/enquiry-form.tsx

[x] T47 — SEO & sharing — files: apps/public/src/app/sitemap.ts, apps/public/src/app/robots.ts, apps/public/src/app/(site)/projects/[projectSlug]/opengraph-image.tsx, apps/public/src/app/(site)/projects/[projectSlug]/[unitSlug]/page.tsx

[x] T48 — Location & connectivity section — files: apps/public/src/lib/projection.ts, apps/public/src/components/site/LocationSection.tsx, apps/public/src/app/(site)/projects/[projectSlug]/page.tsx

[x] T49 — Presentation shell + capability probe — files: apps/public/src/app/(present)/layout.tsx, apps/public/src/lib/capability-probe.ts

[x] T50 — Spatial navigation module — files: apps/public/src/app/(present)/layout.tsx, apps/public/src/lib/spatial-nav.ts

[x] T51 — Presentation project grid + prefetch — files: apps/public/src/lib/prefetch.ts, apps/public/src/components/present/ProjectCard.tsx, apps/public/src/components/present/ProjectGrid.tsx, apps/public/src/app/(present)/page.tsx

[x] T52 — Bird's-eye map + legend — files: apps/public/src/components/present/StatusLegend.tsx, apps/public/src/app/(present)/p/[projectSlug]/PresentationClient.tsx, apps/public/src/app/(present)/p/[projectSlug]/page.tsx

[x] T53 — Unit info panel — files: apps/public/src/components/present/UnitPanel.tsx, apps/public/src/app/(present)/p/[projectSlug]/PresentationClient.tsx

[x] T54 — View mode: top-down skeleton — files: apps/public/src/components/map/skeleton-view.ts, apps/public/src/components/map/ProjectMap.tsx

[x] T55 — View mode: 2.5D extrusion — files: apps/public/src/components/map/camera-presets.ts, apps/public/src/components/map/ProjectMap.tsx

[x] T56 — View mode: connectivity — files: apps/public/src/components/map/poi-layers.ts, apps/public/src/components/map/ProjectMap.tsx, apps/public/src/app/(present)/p/[projectSlug]/PresentationClient.tsx

[x] T57 — Cinematic entry transition — files: apps/public/src/components/map/camera-presets.ts, apps/public/src/components/map/ProjectMap.tsx, apps/public/src/app/(present)/p/[projectSlug]/PresentationClient.tsx

[x] T58 — Keyboard-only E2E (the pacemaker test) — files: apps/public/e2e/presentation-flow.spec.ts, apps/public/playwright.config.ts, .github/workflows/ci.yml

[x] T59 — Realtime status sync — files: apps/public/src/lib/realtime.ts, apps/public/src/app/(present)/p/[projectSlug]/PresentationClient.tsx

[x] T60 — Offline resilience — files: apps/public/src/app/(present)/layout.tsx, apps/public/src/components/present/OfflineManager.tsx, apps/public/public/sw.js

[x] T61 — Failure choreography + hidden diagnostics — files: apps/public/src/app/(present)/layout.tsx, apps/public/src/components/present/SilentErrorBoundary.tsx, apps/public/src/components/present/DiagnosticsOverlay.tsx, apps/public/src/components/map/ProjectMap.tsx, apps/public/src/components/present/ProjectCard.tsx

[x] T62 — Idle attract state — files: apps/public/src/app/(present)/layout.tsx, apps/public/src/components/present/IdleAttract.tsx

[x] T63 — Device enrollment (CRM mint + settings) — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/devices.ts, apps/crm/src/components/devices/EnrollDeviceModal.tsx, apps/crm/src/components/devices/RevokeDeviceButton.tsx, apps/crm/src/app/(app)/settings/devices/page.tsx

[x] T64 — Device enrollment (public verify + price unlock) — files: apps/crm/src/app/api/devices/verify/route.ts, apps/public/src/lib/device-token.ts, apps/public/src/app/(present)/enroll/page.tsx, apps/public/src/app/(present)/enroll/EnrollClient.tsx, apps/public/src/app/(present)/p/[projectSlug]/page.tsx, apps/public/src/app/(present)/p/[projectSlug]/PresentationClient.tsx, apps/public/src/components/present/UnitPanel.tsx

[x] T65 — Lead record + creation — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/leads.ts, apps/crm/src/app/(app)/leads/[leadId]/page.tsx

[x] T66 — Role-scoped lead list — files: apps/crm/src/app/(app)/leads/page.tsx, apps/crm/src/components/leads/LeadList.tsx, packages/db/src/sql/rls.test.ts

[x] T67 — Interaction logger — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/leads.ts, apps/crm/src/components/leads/InteractionLogger.tsx, apps/crm/src/app/(app)/leads/[leadId]/page.tsx

[x] T68 — Stage stepper + pipeline events — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/leads.ts, apps/crm/src/components/leads/StageStepper.tsx, apps/crm/src/components/leads/LeadTimeline.tsx, apps/crm/src/app/(app)/leads/[leadId]/page.tsx

[x] T69 — Triage inbox — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/leads.ts, apps/crm/src/app/(app)/leads/inbox/page.tsx, apps/crm/src/components/leads/TriageTable.tsx

[x] T70 — Follow-up queue home — files: apps/crm/src/app/(app)/page.tsx, apps/crm/src/components/dashboard/QueueCard.tsx

[x] T71 — Negotiation history — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/leads.ts, apps/crm/src/components/leads/NegotiationLogger.tsx, apps/crm/src/components/leads/FloorPriceReveal.tsx, apps/crm/src/components/leads/LeadTimeline.tsx, apps/crm/src/app/(app)/leads/[leadId]/page.tsx

[x] T72 — Site visit scheduling — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/visits.ts, apps/crm/src/components/visits/ScheduleVisitDialog.tsx, apps/crm/src/components/visits/VisitCalendar.tsx, apps/crm/src/app/(app)/visits/page.tsx

[x] T73 — Visit outcome capture — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/visits.ts, apps/crm/src/components/visits/CaptureOutcomeDialog.tsx, apps/crm/src/app/(app)/page.tsx, apps/crm/src/components/visits/VisitCalendar.tsx, apps/crm/src/app/(app)/visits/page.tsx

[x] T74 — Unit document checklists — files: packages/domain/src/documents/templates.ts, packages/domain/src/documents/templates.test.ts, apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/documents.ts, apps/crm/src/components/documents/DocumentChecklist.tsx, apps/crm/src/app/(app)/projects/[projectId]/units/[unitId]/page.tsx

[x] T75 — Deal documents + TDS — files: packages/domain/src/clients/kyc.ts, packages/domain/src/documents/deals.ts, apps/crm/src/server/actions/clients.ts, apps/crm/src/server/actions/deal-documents.ts, apps/crm/src/components/clients/KycForm.tsx, apps/crm/src/components/documents/SyncChecklistButton.tsx, apps/crm/src/app/(app)/bookings/[bookingId]/page.tsx

[x] T76 — Payment ledger — files: apps/crm/src/lib/validation.ts, packages/domain/src/ledger/balance.ts, packages/domain/src/ledger/balance.test.ts, apps/crm/src/server/actions/ledger.ts, apps/crm/src/components/ledger/BookingLedger.tsx, apps/crm/src/app/(app)/bookings/[bookingId]/page.tsx, packages/db/src/__tests__/ledger-append-only.test.ts

[x] T77 — Commission engine — files: apps/crm/src/lib/validation.ts, packages/domain/src/commissions/engine.ts, packages/domain/src/commissions/engine.test.ts, apps/crm/src/server/actions/commissions.ts, apps/crm/src/components/commissions/CommissionRuleForm.tsx, apps/crm/src/components/commissions/CommissionEntriesTable.tsx, apps/crm/src/app/(app)/settings/commissions/page.tsx, apps/crm/src/app/(app)/projects/[projectId]/commissions/page.tsx, apps/crm/src/app/(app)/bookings/[bookingId]/page.tsx

[x] T78 — Commission overrides — files: apps/crm/src/lib/validation.ts, packages/domain/src/commissions/override.ts, packages/domain/src/commissions/override.test.ts, apps/crm/src/server/actions/commissions.ts, apps/crm/src/components/commissions/OverrideCommissionDialog.tsx, apps/crm/src/components/commissions/CommissionEntriesTable.tsx, apps/crm/src/app/(app)/bookings/[bookingId]/page.tsx

[x] T79 — Global search — files: apps/crm/src/server/actions/search.ts, apps/crm/src/components/shell/GlobalSearch.tsx, apps/crm/src/app/(app)/layout.tsx

[x] T80 — Bulk lead reassignment — files: apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/leads.ts, apps/crm/src/components/leads/BulkReassignModal.tsx, apps/crm/src/components/leads/BulkReassignButton.tsx, apps/crm/src/app/(app)/leads/page.tsx

[x] T81 — User management + office settings — files: packages/db/src/schema/core/office-settings.ts, packages/db/migrations/0010_office_settings.sql, apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/settings.ts, apps/crm/src/server/actions/users.ts, apps/crm/src/components/settings/OfficeSettingsForm.tsx, apps/crm/src/components/settings/InviteUserDialog.tsx, apps/crm/src/components/settings/UserManagementList.tsx, apps/crm/src/components/settings/SettingsNav.tsx, apps/crm/src/app/(app)/settings/page.tsx, apps/crm/src/app/(app)/settings/users/page.tsx

[x] T82 — Audit log viewer — files: apps/crm/src/app/(app)/audit/page.tsx, apps/crm/src/components/audit/AuditLogViewer.tsx, apps/crm/src/components/audit/DiffViewer.tsx

[x] T83 — Owner dashboard — files: apps/crm/src/server/actions/dashboard.ts, apps/crm/src/components/dashboard/InventoryFunnel.tsx, apps/crm/src/components/dashboard/PipelineValue.tsx, apps/crm/src/components/dashboard/AgentActivity.tsx, apps/crm/src/components/dashboard/LeadSourceRoi.tsx, apps/crm/src/components/dashboard/UpcomingExpiries.tsx, apps/crm/src/app/(app)/dashboard/page.tsx

[x] T84 — Brochure PDF — files: apps/public/src/app/api/brochure/[projectSlug]/[unitSlug]/route.ts, apps/public/src/components/site/DownloadBrochureButton.tsx, apps/public/src/app/(site)/projects/[projectSlug]/[unitSlug]/page.tsx

[x] T85 — In-app notifications — files: packages/db/src/schema/core/notifications.ts, packages/db/migrations/0011_notifications.sql, apps/crm/src/server/actions/notifications.ts, apps/crm/src/components/shell/NotificationBell.tsx, apps/crm/src/app/(app)/layout.tsx, apps/crm/src/app/api/cron/expire-holds/route.ts, apps/crm/src/app/api/cron/daily-notifications/route.ts

[x] T86 — Email/WhatsApp digest — files: packages/db/src/schema/core/user-settings.ts, packages/db/migrations/0012_user_settings.sql, apps/crm/src/lib/validation.ts, apps/crm/src/server/actions/user-settings.ts, apps/crm/src/components/settings/UserSettingsForm.tsx, apps/crm/src/app/(app)/profile/page.tsx, apps/crm/src/app/api/cron/digest/route.ts

[x] T87 — Document-expiry cron — files: apps/crm/src/app/api/cron/expiry-alerts/route.ts

[x] T88 — Data export — files: apps/crm/src/server/actions/export.ts, apps/crm/src/components/settings/DataExportPanel.tsx, apps/crm/src/app/(app)/settings/export/page.tsx, apps/crm/src/components/settings/SettingsNav.tsx

[x] T89 — Weekly static demo export cron — files: apps/crm/src/app/api/cron/demo-export/route.ts, apps/public/src/app/api/cron/demo-export/route.ts, vercel.json

[x] T90 — Ops hardening pass — files: apps/public/next.config.ts, apps/crm/next.config.ts, apps/public/src/app/api/health/demo-path/route.ts, scripts/ops/backup-restore-rehearsal.sh, scripts/ops/restore-log.md, docs/runbook.md, docs/promotion.md


---

## §1 — POST-TICKET FIXES (after T90)

From `FIXLOG.md` — **30 dated entries, 2026-07-15 → 2026-07-20**. Each line below is a fix
that is present *in this checkout*, verified against the code, not just the log.

### Security & data integrity

| Fix | Outcome | Verified |
|---|---|---|
| **Audit atomicity** | 21 `writeAudit` calls ran *outside* their transactions — business data could commit with no audit row. All moved inside `authedQuery` with `tx` passed explicitly, done manually incl. money paths (bookings, commissions, ledger). | FIXLOG 2026-07-16 |
| **RLS policy gaps** | 15 core tables had RLS *enabled* with **zero policies**. `0014_missing_policies.sql` added per-table policies with agent scoping; `0013_grants.sql` fixed missing `crm_app` grants + default privileges. | ✅ both migrations on disk |
| **Seed-script guard** | `seed.ts` ran `DISABLE ROW LEVEL SECURITY` against **production**. The statements were removed entirely — the file now carries an explicit note at line 25 that they must never return. | ✅ no `DISABLE` statements remain |
| **Projection RLS — `0015_projection_rls.sql`** | Projection schema enforces RLS independently of core, so the public reader can never reach unpublished rows. | ✅ migration on disk |
| **`systemQuery` failing closed** | Claimed to bypass RLS for cron but blocked itself; fixed, covered by `system-query.test.ts`. | ✅ test file exists |
| **Cron routes context-less** | All six cron routes used raw connections with no RLS context (plus latent `42P10` in `ON CONFLICT`). Moved to `systemQuery`. | FIXLOG 2026-07-16 |
| **PostGIS grant — `0020`** | `projection_reader` lacked `USAGE` on `extensions`, so server-side `ST_AsGeoJSON` threw `42501`. Schema usage granted; core access re-verified as denied. | ✅ migration on disk |

### Money & correctness

| Fix | Outcome | Verified |
|---|---|---|
| **Rupees/paise form boundary** | Unit price override took rupees and stored them as paise — a **100× error**. Conversion now happens once at the form boundary via `rupeesToPaise()` (string-parsing, no float multiply). | ✅ `unit-price-override.test.ts` asserts `4500000.50 → 450000050` |
| **Negotiation amount** | Same class of bug: `parseFloat × 100`, which also silently accepted `'55,00,000'` as `55`. Now uses `rupeesToPaise`. | ✅ `negotiation-amount.test.ts` |
| **BigInt audit crash** | `BigInt` in the audit `jsonb` payload crashed serialization; fixed with a BigInt-safe replacer. | FIXLOG 2026-07-16 |
| **Price recompute on activation** | Activating a price version never recomputed existing units → inventory showed "—" forever. `recomputeUnitPrices` now runs on both create and activate. | FIXLOG 2026-07-19 |

### CRM features

| Fix | Outcome | Verified |
|---|---|---|
| **Unit CRUD** | Edit + delete added to the inventory table; unit *creation* was fully broken (wrong detail schema) and repaired. | FIXLOG 2026-07-17 |
| **Layout-type enum — `0017`** | `core.layout_type` (vmrda/panchayat/farmlands/suda/buda/dtcp/private_land/other) replaced `approval_authority` across schema, form, publish readiness, projection badge. Old column kept, not dropped. | ✅ migration on disk |
| **Mortgage status — `0018` + `0019`** | New unit status; transitions `mortgage → available\|booked`, never → sold. Required the domain machine **and** the DB `CHECK` constraint to change in lockstep. "Not For Sale" retired into the Mortgage bucket (amber). | ✅ both migrations; `machine.test.ts` covers it |
| **Digitizer removed** | T33–T35's UI route + components deleted; DB tables kept; publish no longer requires geometry. | ✅ no digitizer dir in `apps/crm` |
| **Booking form + documents** | Detailed Booked/Sold-Out form extending the real `bookings` table. Revealed the `private-docs` storage bucket had never been created in live. | FIXLOG 2026-07-19 |
| **`initUnitChecklist` 23514** | Inserted both `project_id` and `unit_id`, violating `documents_exactly_one_owner` — unit-scope checklists had **never** worked. Now `unit_id` only. | FIXLOG 2026-07-20 |

### Public site

| Fix | Outcome | Verified |
|---|---|---|
| **2.5D map root causes** | Three faults: missing MapTiler key, raw WKB fed to MapLibre instead of GeoJSON (map centred on Null Island), and a fallback pointing at a non-existent image. `getProjectMapData()` now serialises GeoJSON server-side; `SiteProjectMap` + `MapLocationFallback` replace the dead path. | ✅ both components exist |
| **Stale projection fixtures** | 3 dev fixtures (`test-project`, `luxury-villas`, `budget-apartments`) were live in projection and would have rendered publicly. Deleted from projection only; core untouched. | ✅ live DB shows 2 real projects |

### 🔴 In the request but **NOT present in this checkout**

| Fix | Status here |
|---|---|
| **Referrer-Policy header** | ❌ **NOT APPLIED.** `next.config.mjs:34` still sets `Referrer-Policy: DENY` — an `X-Frame-Options` value in the wrong key. Browsers reject it on every page load and fall back to default. Should be `strict-origin-when-cross-origin`. |
| **troika / r3f-perf removal** | ❌ **NOT APPLIED.** `r3f-perf` is still imported (`ExperienceCanvas.tsx:24`, used line 91) and still in `package.json`. Its transitive `troika-three-text` worker crashes under Next 14, so the experience routes error at runtime. |

Both fixes were made in a previous working directory and never landed here, despite HEAD's
commit message claiming otherwise.

---

## §2 — FRONTEND STATE (verified file-by-file)

### Routes that exist under `apps/public/src/app/`

**`(site)` — marketing, pre-redesign design (T41/T43/T44 originals):**
- `site-home/page.tsx` · `projects/[projectSlug]/page.tsx` ·
  `projects/[projectSlug]/[unitSlug]/page.tsx` · `projects/[projectSlug]/opengraph-image.tsx`
- `layout.tsx`, `actions.ts` (`submitEnquiry`), `enquiry-form.tsx`, `posthog-provider.tsx`

**`(site)/(experience)` — Tier 1 / 3D (Slice 0 Step 2):**
- `layout.tsx` — server component mounting the persistent canvas
- `about/page.tsx` · `why-us/page.tsx` — server-rendered node panels

**`(present)` — kiosk, untouched since T64:**
- `present-home/page.tsx` · `p/[projectSlug]/page.tsx` · `enroll/page.tsx` · `layout.tsx`

**`api/` + root:** `brochure/[projectSlug]/[unitSlug]` · `health/demo-path` · `revalidate` ·
`sitemap.ts` · `robots.ts` · `layout.tsx` · `globals.css`
**No `not-found.tsx` exists anywhere.**

### Experience canvas + persistence probe — ✅ present (Step 2 form)

| Component | Present | Notes |
|---|---|---|
| `ExperienceCanvas.tsx` | ✅ | Navy void, `planeGeometry` floor, `sphereGeometry` **placeholder orb**, `<Perf>` overlay |
| `ExperienceCanvasHost.tsx` | ✅ | `ssr:false` client boundary |
| `NodePanel.tsx` | ✅ | Frosted DOM panel (all readable text in DOM) |
| **Persistence probe** | ✅ | **4** test IDs: `persistence-probe`, `probe-ctx`, `probe-gen`, `probe-clock` |
| `probe-fps` | ❌ | Absent — the DOM FPS readout was part of the un-transferred troika fix |
| `Villa.tsx` | ❌ | **Does not exist** |
| `heartbeat-shader.ts` | ❌ | **Does not exist** |
| Bloom / `EffectComposer` | ❌ | Not wired — no post-processing in the canvas |

**Installed but never imported:** `gsap` 3.15.0, `zustand` 5.0.14, `@react-three/postprocessing`
2.19.1, `postprocessing` 6.39.3. Three.js 0.173.0 / R3F 8.18.0 / drei 9.122.0 are in use.

### The planned routes — build status

> `PHASE1_PLAN.md` lists **20 numbered pages + 6 footer routes = 26** (not 21).

| # | Page | Status |
|---|---|---|
| 1 | Home (`/` → `site-home`) | ⚠️ **Exists, pre-redesign** — old catalog, not the Tier-1 experience |
| 4 | Project Details | ⚠️ **Exists, pre-redesign** |
| 6 | Property Details | ⚠️ **Exists, pre-redesign** |
| 8 | About Us | ✅ **Built** (Slice 0 node, placeholder copy) |
| 9 | Why Choose Us | ✅ **Built** (Slice 0 node, placeholder copy) |
| 2, 3, 5, 7, 10–20 | Start Here · Projects listing · Properties · Locations · Investment Guide · Knowledge/Blog · Gallery · Testimonials · Construction Updates · Downloads · Branches · Careers · FAQs · Contact · Book a Site Visit | ❌ **Not built** (readers exist for Properties, Locations, Gallery) |
| F1–F4 | Privacy · Terms · Cookie · Refund | ❌ Not built |
| F5 | Human `/sitemap` page | ❌ Not built (`sitemap.ts` is the XML route — different thing) |
| F6 | 404 | ❌ Not built |

**Score: 2 built to the new design · 3 exist in the old design · 21 not started.**

---

## §3 — 3D ASSETS

### ❌ There are no 3D asset files in this repository.

Exhaustive search across the tree (excluding `node_modules`, `.git`, `blender-skills`):

```
*.glb  → 0        *.gltf → 0        *.blend → 0
*.fbx  → 0        *.obj  → 0
```

There is also **no GLB loading path**: no `useGLTF`, no `GLTFLoader`, no `.glb` reference in
`apps/public/src`. **Nothing has been delivered, verified, or rejected — no asset pipeline
exists yet.** If a model was commissioned or reviewed outside this repo, that history is not
recorded here and I cannot confirm it.

### What currently renders instead

| Asset | Implementation | Triangles |
|---|---|---|
| Placeholder orb | 1 × `<sphereGeometry args={[0.2, 32, 32]}>` | ~1,984 |
| Floor | 1 × `<planeGeometry>` | 2 |
| **Total scene** | — | **~1,986** |

There is **no villa** in this checkout. `FRONTEND_ARCHITECTURE.md` §11.3 specifies a
*parametric* villa for Slice 0 with a Blender GLB as a Phase-5 drop-in; neither exists here.

### `blender-skills/` is **not** project assets

It is a **third-party repository cloned into the working tree** —
`https://github.com/arjun988/blender-skills.git`, a 94-skill Blender toolkit for AI editors.
It has its own `.git`, is **untracked** by this repo, and its `assets/` folder contains a
single `Blender.png` logo. It contributes no models to the project.

⚠️ **CSP note for whoever builds the loader:** `connect-src` allows only self /
`*.supabase.co` / `*.maptiler.com` / posthog. Draco + KTX2 decoders must be **self-hosted**;
three.js's default CDN decoders will be silently blocked.

---

## §4 — VERIFIED TESTS

### `packages/domain` — pure logic, no DB, no browser ✅

**Ran 2026-07-21 in this repo: 17 files, 148 tests, all passing in 1.69s.**

| Spec | Tests | Asserts |
|---|---|---|
| `unit-status/machine.test.ts` | 52 | Every legal/illegal transition incl. mortgage; `booked` requires bookingId, `on_hold` requires holdId |
| `holds/expiry.test.ts` | 13 | Read-path expiry; agent 14-day vs owner 30-day caps |
| `money/paise.test.ts` | 11 | String-parsed rupee→paise; rejects malformed input |
| `permissions/matrix.test.ts` | 11 | Owner vs agent capability matrix |
| `pricing/compute.test.ts` | 10 | Base rate × area + corner/facing/road premiums, integer paise |
| `unit-status/presentation-label.test.ts` | 9 | Core→public mapping; mortgage hidden as not_for_sale |
| `leads/dedupe.test.ts` | 8 | Dedupe key generation, phone normalisation |
| `leads/pipeline.test.ts` | 6 | Stage graph incl. revival paths |
| `geometry/validate.test.ts` | 6 | GeoJSON Feature validation, self-intersection |
| `money/format.test.ts` | 4 | Lakh/Crore display |
| `clients/kyc.test.ts` | 4 | PAN/Aadhaar masking |
| `commissions/engine.test.ts` | 3 | Tranche splits, bps math (÷10000) |
| `documents/templates.test.ts` · `documents/deals.test.ts` | 3 + 3 | Per-asset-class checklists; TDS threshold |
| `commissions/override.test.ts` | 2 | Effective amount resolution |
| `ledger/balance.test.ts` | 2 | Running balance incl. reversals |
| `geometry/edge-derivation.test.ts` | 1 | Edge length/bearing derivation |

### 🔴 Require a LIVE DATABASE (8 suites — fail or mutate data without one)

| Spec | Asserts |
|---|---|
| `packages/db/__tests__/rls-context.test.ts` | RLS wrapper sets `app.role` / `app.user_id` |
| `packages/db/__tests__/ledger-append-only.test.ts` | Ledger rows cannot be updated or deleted |
| `packages/db/__tests__/system-query.test.ts` | `systemQuery` genuinely bypasses RLS for cron |
| `packages/db/sql/rls.test.ts` | Agent sees only own leads; owner sees all |
| `apps/crm/.../unit-price-override.test.ts` | `4500000.50` persists as exactly `450000050` paise |
| `apps/crm/.../negotiation-amount.test.ts` | `5512345.75` persists as exactly `551234575` paise |
| `apps/crm/.../unit-land-approval.test.ts` | Land approval number optional, both directions |
| `apps/crm/src/server/publish-readiness.test.ts` | Real `checkPublishReadiness` against a live row |

### 🟡 Browser specs — `apps/public/e2e-slice0/`

**Only `persistence.spec.ts` exists** (3 tests). There is **no `villa.spec.ts`** in this checkout.

| Test | Asserts |
|---|---|
| canvas survives navigation | Same WebGL context across `/about ↔ /why-us` and back-button; `GEN = 1`; clock monotonic; zero console errors |
| sustains 60fps | rAF-measured FPS > 55 |
| server-renders with JS disabled | `/about` returns full article HTML with JavaScript off |

**Two caveats verified in the config, both of which will make this spec unreliable as written:**

1. `slice0.tmp.config.ts` **does not set `headless: false`.** Headless Chromium falls back to
   SwiftShader (software GL) and measures ~54fps for a scene that runs far faster on a GPU —
   so the `> 55` gate is not meaningful headless. It needs `headless:false` + ANGLE args.
2. The spec **does not pre-warm routes**, and `toHaveURL` uses the default 5s timeout. A cold
   `next dev` route can take >10s to compile, so the navigation test is expected to fail
   intermittently for reasons unrelated to persistence.
3. The **console-error assertion will currently fail outright** because of the unfixed
   Referrer-Policy header (§1), which logs an error on every page load.

### ⚠️ Legacy E2E — DO NOT RUN CASUALLY

| Spec | Hazard |
|---|---|
| `apps/public/e2e/presentation-flow.spec.ts` (T58) | Uses the **default** `playwright.config.ts`, whose `globalSetup` runs `seed.ts` against `DATABASE_URL` — currently the **LIVE** database. This is how fixture projects previously reached production projection. Point it at a disposable DB first. |
| `apps/crm/e2e/deep-crawl.spec.ts`, `visual-crawler.spec.ts` | Present; not run this session — status unverified. |

---

## §5 — NOT STARTED (no code exists)

**Marketing pages (21 routes):** Start Here · Projects listing · Properties · Locations ·
Investment Guide (+ chapters) · Knowledge/Blog (+ posts) · Gallery · Testimonials ·
Construction Updates · Downloads · Branches · Careers · FAQs · Contact · Book a Site Visit ·
Privacy · Terms · Cookie · Refund · human Sitemap · **404 page**

**Slice 0 remainder (Step 3 onward — none of this exists here):**
- Parametric villa geometry
- Heartbeat emissive shader (`uTime` rising pulse)
- Selective bloom / any post-processing wiring
- Scroll-throttle camera + Catmull-Rom flight path (`flight-plan.ts` does not exist)
- X-ray flashlight cursor / magnetic ring cursor
- The Veil route-transition system
- The Window node + 180° pan to the WebGL city map
- Branded preloader tied to real asset progress
- Sound design + toggle
- Zustand experience store (dependency installed, **no store file**)
- GSAP choreography (dependency installed, **never imported**)
- Planar floor reflection
- Low-tier baked video / cinematic-still fallback

**Content system:** no MDX pipeline, no typed-JSON content modules, no `content/` directory.

**Infrastructure:** per-route OG images (only the project one exists) · JSON-LD structured
data · ambient 2D ember layer for Tier 2 · idle preloading of the experience bundle.

---

## §6 — BLOCKED / NEEDS INPUT

### 🔴 Broken right now — fix before any browser work

| Item | Impact | Remediation |
|---|---|---|
| **`r3f-perf` still imported** | `/about` and `/why-us` throw the troika worker error at runtime. | Remove the import at `ExperienceCanvas.tsx:24` and the `<Perf>` usage at line 91; drop `r3f-perf` from `apps/public/package.json`; re-run `pnpm install`. (Optionally re-add a DOM FPS readout — it must not be in-canvas text.) |
| **`Referrer-Policy: DENY`** | Console error on every page load; policy silently falls back to browser default. | `apps/public/next.config.mjs:34` → `strict-origin-when-cross-origin` |
| **`LEAD_INTAKE_URL` + `LEAD_INTAKE_SECRET` missing** | `submitEnquiry` returns *"Internal configuration error"* — **the enquiry form is dead**. Blocks Contact and Book-a-Visit. | Set in `apps/public/.env.local`; secret must match `apps/crm`'s value; URL = `<crm-origin>/api/enquiries` |

### ✅ Previously blocked, now resolved

- **`NEXT_PUBLIC_MAPTILER_API_KEY` is now set** in `apps/public/.env.local` (non-empty).
  Basemaps can render; the designed fallback remains for failure cases.

### 🟡 Decisions pending

| Decision | Context |
|---|---|
| Drop deprecated `approval_authority` column? | Superseded by `layout_type` since `0017`; kept because dropping a data-bearing column is stop-list |
| Enrich CRM enquiry intake? | `preferredTime` is **discarded**; `message` is truncated to 60 chars into `timeline_expectation` (wrong field). Book-a-Visit copy must not promise scheduling until fixed. ~5-line change in `apps/crm` |
| Backport WKB→GeoJSON fix to presentation mode? | `(present)`'s map has the same latent bug the site map had; deferred to preserve kiosk isolation |
| Blender villa vs. parametric? | Phase-5 swap; needs a loader path + self-hosted decoders (§3) |
| Can Booked units enter Mortgage? | Currently only `available → mortgage` |
| Publish "Nirvik garden"? | Priced units sit in core, unpublished — owner action in CRM, no code needed |

### ⚙️ Repo hygiene

- **Duplicate migration numbers:** `0009_media.sql` + `0009_missing_rls.sql`, and
  `0010_media.sql` + `0010_office_settings.sql`. There is **no migration tracking table**, so
  drift must be checked per-object.
- **`apps/public/.ignored_node_modules/`** — a stray copy of `maplibre-gl` sources. Not
  referenced by the build; it pollutes repo-wide searches and should be deleted.
- **`blender-skills/`** — third-party clone with its own `.git`, untracked. Either remove it
  or add it to `.gitignore`; a nested repo inside the tree is a footgun.
- **HEAD commit message is inaccurate** (see the banner at the top). Worth a follow-up commit
  that either applies the two fixes or amends the record.
- `apps/public/public/` contains only `sw.js` — no favicon, no OG fallback, no fonts.

---

## Live database state (queried 2026-07-21)

| | |
|---|---|
| Published projects | **2** — `lucky-gardens` (184 units / 183 available), `the-azure-residences` (3 / 1) |
| `units_pub` | 187 |
| `pois_pub` | 6 |
| `media_manifests` | **4** — Gallery will need a file-based supplement |
| `geometry_pub` | **0** — maps are location/connectivity only; plot polygons are dormant enhancement |
| `core.projects` | 4 (1 unpublished) |

---

*Authoritative companions: `BACKEND_CONTRACT_FINAL.md` (data contract with verified samples) ·
`FRONTEND_ARCHITECTURE.md` (experience design) · `apps/public/PHASE1_PLAN.md` (page plan) ·
`FIXLOG.md` (chronological fix record, 39 entries through 2026-08-02) · `§7` below for the
2026-08-02 session.*

---

# §7 — SESSION 2026-08-02: 3D delivery, web export pipeline, and first CI run

> Appended, not rewritten. Where this section contradicts an earlier one, **this section is
> current** — the superseded claims are named explicitly below so the audit trail stays honest.
> Every line was verified by rendering, querying the scene, running the tool, or reading the
> CI log. Full per-bug detail with evidence is in `FIXLOG.md` (9 new entries, all 2026-08-02).

## What changed in the repo

| | Before | After | Evidence |
|---|---|---|---|
| **Git remote** | 🔴 none — everything local-only | ✅ `github.com/Dev-Ritvik/QHR-ecosystem` (private) | `git remote -v` |
| **CI** | 🔴 had never run | ✅ **both jobs green on `main`** | Actions run on `06f1d7b` |
| **3D assets in repo** | ❌ none | ✅ `apps/public/public/models/interior_hall.glb` (14.4 MB) | §7.2 |
| **Blender/glTF automation** | 🔴 20 scripts on `C:\` only | ✅ `tools/blender/` (18) + `tools/gltf/` (3) | `git ls-files tools/` |
| **Hologram source sheets** | 🔴 unversioned under ignored `assets/` | ✅ tracked; ignore rule narrowed | `.gitignore` |

### ⛔ Claims in earlier sections that are now WRONG

- **§3 "There are no 3D asset files in this repository."** — no longer true. See §7.2.
- **§6 repo hygiene, "Duplicate migration numbers: `0009_media.sql` + `0009_missing_rls.sql`"** —
  `0009_media.sql` has been **deleted** (it was a content duplicate, not just a number clash),
  so `0009_missing_rls.sql` is now unambiguous. `0010_media.sql` + `0010_office_settings.sql`
  still share a prefix but create disjoint objects.
- **§4 "`packages/db` — 8 suites require a live database"** — still true, but they no longer
  *throw at import* without one. They are now skipped, and consequently `packages/db` runs
  **zero tests in CI**. See §7.4.
- **§6 "`*.tsbuildinfo`"** was not previously listed; it *was* tracked, and is now untracked.

---

## §7.1 — Hologram displays rebuilt (client defect, closed)

The two layout stations were flat textured quads lying horizontally. At standing eye height the
grazing angle is ~6°, so the layouts foreshortened into a line and disappeared entirely from a
side approach. Rebuilt as **raked, extruded tables**:

- **38° rake about the near edge** (not the centre — that would drop the near edge through the
  pedestal cap). Grazing angle ~6° → ~31°.
- **Real prisms** from the drawings' closed cells: 114 on Kartikeya, 183 on Lucky Garden. Roads
  are deliberately not built — they read as negative space, as on a physical model.
- **Upright callout cards** on leader rods, world-vertical and square to the approach vector.

Six bugs were found and fixed *while* building this, each caught by rendering and looking rather
than by trusting the code — a falsy-list trap that silently produced zero cells, a global
threshold that could not serve both sheets, status colours misread as terrain, mask fences
extruding as ghost geometry, texture/geometry masks drifting apart, and leader rods lying flat.
Detail in `FIXLOG.md`.

**Status: client approved and locked.**

Still open on the 3D set (unchanged from before this session):
- 🔴 **Patterned rug asset never delivered** — foreground remains placeholder maroon.
- 🔴 **S3 / S4 pedestals have no artwork** — VSR Gayatri Township layout never supplied; they
  render bare.
- 🟡 **"CLUB HOUSE" and "PARK" on S1 are inferred** from what the drawing depicts (a pool with a
  structure; playground equipment), not label text. Editable in `STATIONS` in
  `tools/blender/build_holo3d.py`.
- 🟡 **Kartikeya source is only 745×725** after crop — adequate at delivered framings, the
  limiting factor for closer inserts.

---

## §7.2 — `interior_hall.glb` — baked GI, KTX2, Draco

`apps/public/public/models/interior_hall.glb` — **14.4 MB**, down from a 235 MB raw export.

| | |
|---|---|
| Drawn triangles | **480k** (was 2.01M) |
| Vertices uploaded | **214k** — instancing survives the pipeline |
| Lightmap | 4096² atlas, Cycles DIFFUSE direct+indirect, 1024 samples, OptiX |
| Textures | 28, all KTX2 — UASTC for normals, ETC1S for the rest |
| glTF validation | **0 errors** (Khronos glTF-Validator 2.0.0-dev.3.9) |

**Correction to a figure stated earlier in this session:** unique geometry is **519k triangles,
not 2.01M**. The 2.01M counts *instances* — the heavy repeats already share mesh data (153
anthemions off one 2.5k mesh, 54 balusters off one, 11 capitals off one). Decimation was
therefore applied to the shared **datablocks**, so one pass propagates through every instance.

**Only the 147 unique shell objects are lightmapped.** A lightmap needs per-placement UVs, which
would have destroyed the instancing that keeps the upload at 214k vertices against 1.44M
rendered. Ornament and props are lit at runtime.

### Integration contract — read before wiring this up

Baked GI rides in the **occlusion slot**, because glTF has no lightmap slot. Both loaders are
mandatory (`KHR_texture_basisu` and `KHR_draco_mesh_compression` are in `extensionsRequired`):

```js
const ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);
loader.setKTX2Loader(ktx2).setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));

gltf.scene.traverse((o) => {
  const m = o.material;
  if (!m?.aoMap) return;
  m.lightMap = m.aoMap;
  m.lightMap.colorSpace = THREE.SRGBColorSpace;   // required — see below
  m.lightMapIntensity = 4.6597;                   // the bake's normalisation divisor
  m.aoMap = null;
  m.needsUpdate = true;
});
```

`colorSpace` must be set explicitly: GLTFLoader treats occlusion as linear data, but this atlas
is sRGB-encoded, because normalised against its 99.5th percentile the room sits near 0.05 —
value ≈13 in linear 8-bit, which bands visibly.

Decoders are served from `apps/public/public/basis/` and `apps/public/public/draco/` (decode
only — the Draco *encoder* is deliberately not shipped). Full contract and the six rebuild
commands are in `apps/public/public/models/interior_hall.manifest.json`.

### Scene defects found only because the exporter tripped over them

- **`EXT_HAZE`** — a 480 m volumetric box living in the Scene Collection, not `COL_Exterior`, so
  excluding the exterior never dropped it. It shipped, blowing scene bounds to ±240 m. Fixed.
- **`KIT_` instancing masters** — parked at z=−50 and not hidden, so they exported as real
  geometry 50 m under the floor. Fixed.
- **Both rug materials had the wrong normal map** — they drive a Bump node from a 16-bit
  *displacement* map, and since glTF has no bump node the exporter wrote that height map into
  `normalTexture`. Both already carry a proper `NormalGL` map. **Fixed on the export path only;
  `mansion_exterior.blend` is untouched** — if the interactive build ever bakes from the .blend
  directly, fix the material there too.
- **`pedestal_inlay_S1/S3/S4`** were authored in world space *and* given the pedestal yaw, so
  they were rotated twice and sat on the open entrance floor. Fixed.

### 🟡 Known-benign validator noise (do not re-open)

56 warnings, all from the validator build predating `KHR_texture_basisu` — it cannot follow
references made through the Basis and Draco extensions, so it reports the 28 images and 218
bufferViews they reach as "unused" and calls `image/ktx2` an invalid mime type. The extension is
declared correctly. Recorded in the manifest.

One genuine finding, left alone: a single primitive carries a `TEXCOORD_1` its material does not
sample — one unused attribute, not worth hand-editing the buffer for.

---

## §7.3 — Tooling notes for anyone re-running the pipeline

These cost a full cycle each and are recorded so they do not cost another:

| Trap | Symptom |
|---|---|
| `nodes.new()` returns a **stale pointer** | `nd is n` matches nothing → bake target never selected → Cycles bakes a **black atlas and reports success** |
| Depsgraph skips **hidden objects** | Decimation silently returns the original mesh while printing a plausible ratio |
| `colorspace_settings.name` set **after** `img.pixels` | Invalidates the buffer → saves a black PNG |
| `gltf-transform` 4.4.2 vs **KTX-Software v5** | Calls `--assign-oetf`, renamed to `--assign-tf` → every texture fails to encode |
| `gltf-transform` `resize`/`webp` → **sharp/libvips** | Fails on *every* PNG here with `colourspace: parameter space not set` |

Consequently the texture stage runs in Pillow (`tools/gltf/optimize_textures.py`) and KTX2
encoding drives `ktx` directly (`tools/gltf/encode_ktx2.py`), which also allows per-slot codec
choice the wrapper does not expose usefully.

🟡 **`tools/blender/decimate_chandelier.py` is still missing the world-transform bake** its
siblings have. Nothing is broken in the scene today — it was corrected downstream by hand — but
any asset re-run through it will come out rotated 90°.

---

## §7.4 — CI: first execution, five nested failures

CI had **never run on this code** — the remote repo previously held only a README. Neither
failing job was a regression from the 3D work; both were latent, and each failure was hiding the
next.

| # | Job | Cause | Status |
|---|---|---|---|
| 1 | Lint | No ESLint config or dependency anywhere → `next lint` opened its **interactive setup prompt** on a TTY-less runner | ✅ fixed |
| 2 | Unit tests | Every `packages/db` spec **throws at import** without a database; would have failed the instant lint was fixed | ✅ fixed |
| 3 | E2E | No database on the runner | ✅ fixed (PR #1) |
| 4 | E2E | **Migrations had never applied to an empty server** | ✅ fixed |
| 5 | E2E | Tests hit port 3000; dev server listens on **3001** | ✅ fixed |

### 🔴 The migration set could not build a database from scratch

A static pass over every `CREATE TYPE` / `CREATE TABLE` / `ADD CONSTRAINT` across all 23
migrations found **twelve objects created by more than one migration**. `0009_media.sql` was a
content duplicate of half of `0010_media.sql` and — alone among every migration in the repo —
carried **no idempotency guards at all**, so it could not even be re-run by itself. Removed;
`0010`'s three collisions with `0007` are now guarded in the repo's existing
`DO $$ ... EXCEPTION WHEN duplicate_object` style.

Practical consequence of the bug: **nobody could stand up a fresh environment.** The schema had
only ever existed through incremental application on machines that already had most of it.

False positive, recorded so it is not "fixed" later: `unit_status_events_legal_transition`
appears in `0003` and `0019`, but `0019` DROPs it before re-adding to widen the check. Correct
as written.

### 🔴 CI was not testing the database shape we deploy

Production is Supabase, which installs PostGIS into an **`extensions` schema** rather than
`public`. The codebase depends on that layout in two ways: two migrations grant USAGE on it
(`0016`, `0020`), and application SQL is schema-qualified in **five places** (`publish.ts`
ST_Extent, `geometry.ts` ST_SetSRID/ST_GeomFromGeoJSON, `projection.ts` ST_AsGeoJSON). The stock
`postgis/postgis` image uses `public`.

Relaxing the grants would have gone green **while testing a shape we never deploy** — every
`extensions.ST_*` call would then fail at runtime. `packages/db/ci/bootstrap_extensions.sql`
recreates the Supabase layout before the migration loop instead. It lives in `packages/db/ci/`,
not `migrations/`, because it describes the managed platform rather than our schema.

### 🟡 Open decisions left from the CI work

- **`packages/db` now runs zero tests in CI.** Its specs are all integration tests and stay
  skipped without a database. Scaffolding is in place: give the validate job a Postgres service
  and set `DATABASE_URL_MIGRATIONS` + `DATABASE_URL_CRM` and they run unchanged. A scope call,
  not a CI fix.
- **`apply_migration.ts` keeps no record of what it has applied**, so every run re-executes every
  file. Survivable now the statements are idempotent; a migrations table would be better.
- **Lint warnings are not enforced** — mostly `<img>` vs `next/image` across both apps, plus two
  `react-hooks/exhaustive-deps`. They do not fail the build.
- **`main` is not branch-protected** (GitHub is showing the prompt). Direct pushes are possible.

---

## §7.5 — Repo hygiene resolved this session

- ✅ `*.tsbuildinfo` untracked and ignored — the tracked copies made a rebase abort with
  "untracked working tree files would be overwritten".
- ✅ Hologram **inputs** versioned, not just the scripts: the pipeline is deterministic, so it is
  reproducible only for as long as its source sheets survive. The `assets/` ignore rule was
  narrowed rather than dropped (`assets/` is 1.9 GB and stays out).
- 🟡 The issued Lucky Garden PDF is **deliberately not tracked** — 26 MB, larger than everything
  else in the repo combined. `lucky_garden_raw.png` (2.6 MB, 300 dpi) is what the pipeline
  actually reads. Keep the PDF in document storage.
- 🔴 Still outstanding from §6: `apps/public/.ignored_node_modules/` (stray maplibre-gl sources)
  and `blender-skills/` (third-party clone with its own `.git`). Neither was touched.
- 🟡 `.claude/` remains untracked pending a decision.

---

# §8 — OUTSTANDING: documents awaited from the client

> Added 2026-08-03. **These are the only things standing between three legal
> pages and publication.** The client was asked on 2026-08-03 and expects to
> take about a week, so this is due back around **2026-08-10**.

## Why this cannot quietly slip

`/privacy`, `/terms` and `/refund-policy` are live routes today, but every
unresolved fact in them renders as a loud amber `<Pending>` marker **and forces
the whole page to `noindex`** (`apps/public/src/components/experience/Pending.tsx`).

That was deliberate: a placeholder that looks like prose eventually ships as
prose, and an invented cancellation window is a binding representation to a
consumer. The consequence is that **these three pages are invisible to search
until the gaps are filled** — so leaving them is not a cosmetic debt, it is
three missing pages.

**How to check the current count at any time:**

```bash
pnpm --filter @estate/public dev
# then, per route:
curl -s localhost:3001/privacy | grep -c '<mark'
```

Zero marks on a page ⇒ remove `...pendingRobots` from its `metadata` and it
becomes indexable. Nothing else is required.

## What is needed, by page

### `/privacy` — 5 outstanding

| Fact | Who has it |
|---|---|
| Registered entity name | Client |
| CIN / GST identifiers | Client |
| Retention period for lead records | Client (a business decision, not a technical one) |
| Response period for a data-subject request | Client — the DPDP Act expects one to be stated |
| Hosting, CRM and storage processors | Us, once deployment targets are fixed |

*Already resolved:* Data Protection Officer — **Dev Ritvik,
devritvik70@gmail.com** (supplied 2026-08-03).

### `/terms` — 9 outstanding

Registered entity and identifiers · RERA registration numbers per project ·
booking terms (what a booking amount actually reserves, and for how long) ·
payment terms and schedule · amenity delivery and construction-status
commitments · limitation of liability · governing law and jurisdiction ·
dispute-resolution mechanism · publication date.

### `/refund-policy` — 11 outstanding

Pre-agreement cancellation terms · cooling-off or notice period ·
post-agreement cancellation terms and the clause reference in the sale
agreement · **seller-side cancellation terms** · refund processing period ·
required documents · tax and statutory treatment · named refund contact ·
grievance and escalation route · publication date.

> The seller-side clause is the one buyers weigh most heavily. It is worth
> stating generously and plainly rather than minimally — it is the cheapest
> trust the client can buy on that page.

## Everything else that is still open

- **Marketing account IDs** — Meta Pixel + CAPI token, GA4 / Google Ads,
  LinkedIn Partner ID, Microsoft Clarity. The loader ships as a working shell
  and turns on with env vars alone; no code change at that point. Client is
  supplying these *after* production, by their own decision.
- **Call tracking** (CallRail / WhatConverts) — a paid subscription. Confirm
  the client wants it before anything is built against it.
- **Live chat vendor** — Intercom, Crisp, or none.
- **`/hall` has never been confirmed in a real browser.** The preview pane
  reports WebGL2 available but never fires `requestAnimationFrame`, so r3f
  cannot render there. See §7.2.
- **Patterned rug asset** and **site photography** — still absent. `/gallery`
  states the absence rather than using stock imagery.

## Two defects found on the client's own live sites

Reported 2026-08-03, both on the existing public sites rather than in this repo:

1. **`qualityhomesreality.com` has placeholder text in production.** Slides 4
   and 5 of the home-page testimonial carousel read *"Lorem De Ipsum"* and
   *"Ms. Lorem R. Ipsum"* with Latin filler. Not carried into this build.
2. **`.in` and `.com` do not serve the same content.** A fetch of
   `qualityhomesreality.in` returned a different navigation and two testimonials
   ("Rajesh Kumar, Hyderabad", "Priya Sharma, Vijayawada") that appear nowhere
   on `.com` and nowhere in the screenshots supplied. Those were discarded.
   **Treat `.in` as an untrusted content source** until someone establishes what
   it is actually serving. Everything used in this build came from `.com`.

## Route status at 2026-08-03

| State | Routes |
|---|---|
| ✅ Complete, indexable | `/hall` `/faqs` `/cookie-policy` `/branches` `/locations` `/contact` `/gallery` `/investment-guide` `/knowledge` `/knowledge/reading-a-layout-plan` `/testimonials` `/careers` `/downloads` `/properties` `/start-here` |
| 🟡 Live but `noindex` pending client documents | `/privacy` `/terms` `/refund-policy` |
| ⚪ Pre-redesign, not yet surfaces | `/` (site-home) `/projects/[slug]` `/projects/[slug]/[unit]` |
| ❌ Dropped by agreement | `/construction-updates` |

---

# §9 — Phase A: real inventory replaces the demo data

> 2026-08-04. Canonical domain confirmed as **qualityhomesreality.in**.

## What changed

The database held four demo projects — `the-azure-residences` (fictional),
`lucky-gardens`, `nirvik-garden`, `dev-ritvik` — and 187 demo units. Every
`/projects/<slug>` link on `/start-here` and `/properties` pointed at the three
real layouts and returned **404**, while the sitemap published the fictional
project and 187 thin unit pages under `https://example.com`.

All four demo projects are gone. The three real layouts are in `core` and
published through `publishProject()` — the same gate the CRM's publish button
uses, not a direct write to `projection`, so the script cannot publish anything
the CRM would have refused.

| Project | Plots | Available | Layout | Approval |
|---|---|---|---|---|
| Kartikeya Water Front | 113 | 113 | VMRDA | VMRDA approved layout |
| Lucky Garden | 181 | 118 | Panchayat | on the sanctioned plan |
| VSR Gayatri Township | 113 | 113 | SUDA | F.L.P. No. 10/2025/1178/DTCP/DPMS |

**407 plots total.** All three are `price_on_request`; no price is published
anywhere on the site.

## Where the plot counts come from

Not from marketing material. They are the closed cells detected in the client's
own approved layout sheets by `tools/blender/make_holo3d.py` — the same cells
extruded into the 3D hall, so the website, the hologram and the CRM count the
same plots:

```
assets/floorplans/kartikeya_cells.json   113 plot
assets/floorplans/lucky_cells.json       118 plot + 63 plot_hot
assets/floorplans/gayatri_cells.json     113 plot
```

`plot_hot` is a plot the sheet has coloured in — Lucky Garden's sheet marks
status that way. Which colour means sold and which means booked is in the sheet
legend, which has not been transcribed, so those 63 are imported as `sold`.
Understating availability costs a phone call; overstating it means telling a
buyer a plot is free when the client's own drawing says otherwise.

## ⚠ PROVISIONAL — plot numbers must be replaced

**Plot numbers are sequential 1..N and are almost certainly not the numbers
printed on the sheets.** The cell classifier reads geometry; it never read the
numbers. The cardinality is right, the identity is not.

Nothing public exposes them — `/properties` publishes sizes only — so the
exposure is limited to the CRM. **Before any agent quotes a plot number to a
buyer, re-import from the client's plot register.** Add it to the document
request in §8.

Re-import with:

```bash
pnpm dlx tsx packages/db/src/seed/import-real-projects.ts
```

## Also in this phase

- **Sitemap rewritten.** Was 190 URLs, mostly fictional; now 18, every one
  verified to return 200. Derived from the `places.ts` route registry rather
  than a hand-kept list, minus three sets: `NOINDEX_PENDING` (the legal pages
  from §8), `UNWRITTEN` (`/about`, `/why-us`, `/site-home`), and `UNBUILT`
  (`/book-a-site-visit`, `/projects`, `/sitemap` — registered in the registry
  with no page behind them). **Delete an entry from `UNBUILT` the day its page
  lands and the sitemap picks it up with no other change.**
- Individual plot pages are deliberately **not** in the sitemap. 407 thin pages
  with no price and no copy would dilute the three project pages that rank, and
  would publish plot numbers we have just said are provisional.
- **`sitemap.ts` and `robots.ts` now throw** if `NEXT_PUBLIC_SITE_URL` is unset
  rather than falling back to `example.com`. A robots.txt naming
  `example.com/sitemap.xml` tells every crawler the site has no sitemap.
- Three demo bookings (2026-07-18, on fictional projects, zero payment-ledger
  rows) were deleted. The import script refuses outright if a payment ledger
  entry exists, and requires `--delete-demo-bookings` to remove a booking at
  all — the deletion order came from `pg_constraint`, not from guessing until
  the errors stopped.

## Known gaps left open by this phase

- **Project pages have no `<title>`** — `metadata` is missing on
  `/projects/[slug]`. Phase G.
- **Hero images are the layout PDFs.** The publish gate requires a hero and no
  site photography exists. It is the real drawing rather than stock imagery,
  which is the rule `/gallery` already follows — but it is not a photograph.
- No geometry version, so every project page shows "Map Unavailable". The plot
  polygons exist in the `*_cells.json` files; wiring them to
  `core.unit_geometries` would light up the master plan map. Not in Phase A.
