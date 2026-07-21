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

