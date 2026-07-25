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
`FIXLOG.md` (chronological fix record, 30 entries through 2026-07-20).*
