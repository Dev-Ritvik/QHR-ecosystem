# Exhaustive Route & Link Map — Fable Turborepo

> **Generated:** 2026-07-16  
> **Scope:** `apps/public` (Public Site + Presentation Mode) and `apps/crm` (CRM)  
> **Methodology:** Full filesystem traversal of `src/app` trees for route pages, plus exhaustive grep of all `.tsx`/`.jsx` files for `<Link href>`, `<a href>`, `router.push()`, `router.replace()`, and `redirect()` calls.

---

## Section A: Route Architecture

All routes derived from the Next.js App Router filesystem convention. Route groups (parenthesized folders like `(site)`, `(present)`, `(app)`, `(auth)`) define **layout boundaries** only and do **not** produce URL segments.

### A.1 — Public App (`apps/public`)

```
apps/public/src/app/
├── layout.tsx                          ─ Root layout
├── globals.css
├── robots.ts                           ─ Metadata (not a page)
├── sitemap.ts                          ─ Metadata (not a page)
│
├── (site)/                             ─ Route Group: Public Website
│   ├── layout.tsx                      ─ Layout (PostHog provider)
│   │
│   ├── site-home/
│   │   └── page.tsx                    ─ /site-home
│   │
│   ├── enquiry-form.tsx                ─ Client component (not a route)
│   ├── actions.ts                      ─ Server actions (not a route)
│   ├── posthog-provider.tsx            ─ Provider (not a route)
│   │
│   └── projects/
│       └── [projectSlug]/
│           ├── page.tsx                ─ /projects/[projectSlug]
│           ├── opengraph-image.tsx     ─ OG image generator (not a page)
│           └── [unitSlug]/
│               └── page.tsx            ─ /projects/[projectSlug]/[unitSlug]
│
├── (present)/                          ─ Route Group: Presentation Mode
│   ├── layout.tsx                      ─ Layout (offline mgr, idle attract, error boundary)
│   │
│   ├── present-home/
│   │   └── page.tsx                    ─ /present-home
│   │
│   ├── enroll/
│   │   ├── page.tsx                    ─ /enroll
│   │   └── EnrollClient.tsx            ─ Client component (not a route)
│   │
│   └── p/
│       └── [projectSlug]/
│           ├── page.tsx                ─ /p/[projectSlug]
│           └── PresentationClient.tsx  ─ Client component (not a route)
│
└── api/                                ─ (Excluded per instructions)
```

#### A.1.1 — Public Site Routes (Route Group: `(site)`)

| Route URL                                    | Type    | Page File                                                              |
| :------------------------------------------- | :------ | :--------------------------------------------------------------------- |
| `/site-home`                                 | Static  | `(site)/site-home/page.tsx`                                            |
| `/projects/[projectSlug]`                    | Dynamic | `(site)/projects/[projectSlug]/page.tsx`                               |
| `/projects/[projectSlug]/[unitSlug]`         | Dynamic | `(site)/projects/[projectSlug]/[unitSlug]/page.tsx`                    |

#### A.1.2 — Presentation Mode Routes (Route Group: `(present)`)

| Route URL                                    | Type    | Page File                                                              |
| :------------------------------------------- | :------ | :--------------------------------------------------------------------- |
| `/present-home`                              | Static  | `(present)/present-home/page.tsx`                                      |
| `/enroll`                                    | Static  | `(present)/enroll/page.tsx`                                            |
| `/p/[projectSlug]`                           | Dynamic | `(present)/p/[projectSlug]/page.tsx`                                   |

---

### A.2 — CRM App (`apps/crm`)

```
apps/crm/src/app/
├── layout.tsx                          ─ Root layout
├── globals.css
│
├── (auth)/                             ─ Route Group: Authentication
│   └── login/
│       └── page.tsx                    ─ /login
│
├── (app)/                              ─ Route Group: Authenticated Shell
│   ├── layout.tsx                      ─ Layout (AppShell, GlobalSearch, NotificationBell)
│   ├── page.tsx                        ─ /  (Dashboard)
│   │
│   ├── dashboard/
│   │   └── page.tsx                    ─ /dashboard
│   │
│   ├── projects/
│   │   ├── page.tsx                    ─ /projects
│   │   ├── new/
│   │   │   └── page.tsx               ─ /projects/new
│   │   └── [projectId]/
│   │       ├── page.tsx               ─ /projects/[projectId]
│   │       ├── units/
│   │       │   ├── page.tsx           ─ /projects/[projectId]/units
│   │       │   ├── new/
│   │       │   │   └── page.tsx       ─ /projects/[projectId]/units/new
│   │       │   └── [unitId]/
│   │       │       └── page.tsx       ─ /projects/[projectId]/units/[unitId]
│   │       ├── pricing/
│   │       │   └── page.tsx           ─ /projects/[projectId]/pricing
│   │       ├── pois/
│   │       │   └── page.tsx           ─ /projects/[projectId]/pois
│   │       ├── digitizer/
│   │       │   ├── page.tsx           ─ /projects/[projectId]/digitizer
│   │       │   └── DigitizerClient.tsx ─ Client component (not a route)
│   │       └── commissions/
│   │           └── page.tsx           ─ /projects/[projectId]/commissions
│   │
│   ├── leads/
│   │   ├── page.tsx                    ─ /leads
│   │   ├── inbox/
│   │   │   └── page.tsx               ─ /leads/inbox
│   │   └── [leadId]/
│   │       └── page.tsx               ─ /leads/[leadId]
│   │
│   ├── bookings/
│   │   └── [bookingId]/
│   │       └── page.tsx               ─ /bookings/[bookingId]
│   │
│   ├── visits/
│   │   └── page.tsx                    ─ /visits
│   │
│   ├── audit/
│   │   └── page.tsx                    ─ /audit
│   │
│   ├── profile/
│   │   └── page.tsx                    ─ /profile
│   │
│   └── settings/
│       ├── page.tsx                    ─ /settings
│       ├── users/
│       │   └── page.tsx               ─ /settings/users
│       ├── devices/
│       │   └── page.tsx               ─ /settings/devices
│       ├── commissions/
│       │   └── page.tsx               ─ /settings/commissions
│       └── export/
│           └── page.tsx               ─ /settings/export
│
└── api/                                ─ (Excluded per instructions)
```

#### A.2.1 — CRM Auth Routes (Route Group: `(auth)`)

| Route URL | Type   | Page File                    |
| :-------- | :----- | :--------------------------- |
| `/login`  | Static | `(auth)/login/page.tsx`      |

#### A.2.2 — CRM App Routes (Route Group: `(app)`)

| Route URL                                         | Type    | Page File                                                              |
| :------------------------------------------------ | :------ | :--------------------------------------------------------------------- |
| `/`                                               | Static  | `(app)/page.tsx` — Dashboard                                          |
| `/dashboard`                                      | Static  | `(app)/dashboard/page.tsx`                                             |
| `/projects`                                       | Static  | `(app)/projects/page.tsx`                                              |
| `/projects/new`                                   | Static  | `(app)/projects/new/page.tsx`                                          |
| `/projects/[projectId]`                           | Dynamic | `(app)/projects/[projectId]/page.tsx`                                  |
| `/projects/[projectId]/units`                     | Dynamic | `(app)/projects/[projectId]/units/page.tsx`                            |
| `/projects/[projectId]/units/new`                 | Dynamic | `(app)/projects/[projectId]/units/new/page.tsx`                        |
| `/projects/[projectId]/units/[unitId]`            | Dynamic | `(app)/projects/[projectId]/units/[unitId]/page.tsx`                   |
| `/projects/[projectId]/pricing`                   | Dynamic | `(app)/projects/[projectId]/pricing/page.tsx`                          |
| `/projects/[projectId]/pois`                      | Dynamic | `(app)/projects/[projectId]/pois/page.tsx`                             |
| `/projects/[projectId]/digitizer`                 | Dynamic | `(app)/projects/[projectId]/digitizer/page.tsx`                        |
| `/projects/[projectId]/commissions`               | Dynamic | `(app)/projects/[projectId]/commissions/page.tsx`                      |
| `/leads`                                          | Static  | `(app)/leads/page.tsx`                                                 |
| `/leads/inbox`                                    | Static  | `(app)/leads/inbox/page.tsx`                                           |
| `/leads/[leadId]`                                 | Dynamic | `(app)/leads/[leadId]/page.tsx`                                        |
| `/bookings/[bookingId]`                           | Dynamic | `(app)/bookings/[bookingId]/page.tsx`                                  |
| `/visits`                                         | Static  | `(app)/visits/page.tsx`                                                |
| `/audit`                                          | Static  | `(app)/audit/page.tsx`                                                 |
| `/profile`                                        | Static  | `(app)/profile/page.tsx`                                               |
| `/settings`                                       | Static  | `(app)/settings/page.tsx`                                              |
| `/settings/users`                                 | Static  | `(app)/settings/users/page.tsx`                                        |
| `/settings/devices`                               | Static  | `(app)/settings/devices/page.tsx`                                      |
| `/settings/commissions`                           | Static  | `(app)/settings/commissions/page.tsx`                                  |
| `/settings/export`                                | Static  | `(app)/settings/export/page.tsx`                                       |

---

## Section B: Component Links

All unique URLs extracted from `<Link href>`, `<a href>`, `router.push()`, `router.replace()`, and server-side `redirect()` calls across all `.tsx`/`.jsx` files in both apps. Deduplicated and categorized.

---

### B.1 — Public App (`apps/public`) Component Links

#### B.1.1 — `<Link>` and `<a>` hrefs

| Extracted `href` Value                         | Source Component                                                    | Link Type       |
| :--------------------------------------------- | :------------------------------------------------------------------ | :-------------- |
| `` `/projects/${project.slug}` ``              | `components/site/ProjectCard.tsx`                                   | `<Link>` — Dynamic  |
| `#enquiry`                                     | `(site)/projects/[projectSlug]/[unitSlug]/page.tsx`                 | `<a>` — Anchor       |
| `` `https://wa.me/${formattedWaNumber}?text=${encodeURIComponent(contextText)}` `` | `(site)/enquiry-form.tsx`                     | `<a>` — External     |

#### B.1.2 — `router.push()` Navigations

| Destination Value              | Source Component                                   | Context                                     |
| :----------------------------- | :------------------------------------------------- | :------------------------------------------ |
| `'/'`                          | `components/present/IdleAttract.tsx`                | Idle timeout returns user to presentation home |
| `'/'`                          | `(present)/enroll/EnrollClient.tsx`                 | Successful device enrollment redirects home  |

#### B.1.3 — Complete Deduplicated URL Set (Public App)

1. `/projects/${project.slug}` — links to site project detail page
2. `#enquiry` — same-page anchor to enquiry form section
3. `https://wa.me/...` — external WhatsApp deep-link (dynamic)
4. `/` — presentation mode home (via `router.push`)

---

### B.2 — CRM App (`apps/crm`) Component Links

#### B.2.1 — Sidebar Navigation (`AppShell.tsx`)

These links are rendered for every authenticated page via the `AppShell` sidebar:

| `href` Value       | Label        | Visibility         |
| :----------------- | :----------- | :----------------- |
| `/`                | Dashboard    | All roles          |
| `/projects`        | Projects     | All roles          |
| `/leads`           | Leads        | All roles          |
| `/visits`          | Site Visits  | All roles          |
| `/audit`           | Audit Log    | Owner only         |
| `/settings`        | Settings     | Owner only         |

#### B.2.2 — Settings Sub-Navigation (`SettingsNav.tsx`)

| `href` Value              | Label                  |
| :------------------------ | :--------------------- |
| `/settings`               | Office Configuration   |
| `/settings/users`         | User Management        |
| `/settings/devices`       | Presentation Devices   |
| `/settings/commissions`   | Commissions            |
| `/settings/export`        | Data Export             |

#### B.2.3 — Project Sub-Navigation (`ProjectNav.tsx`)

All hrefs are relative to `/projects/${projectId}`:

| `href` Value                                     | Label        |
| :----------------------------------------------- | :----------- |
| `` `/projects/${projectId}` ``                   | Details      |
| `` `/projects/${projectId}/units` ``             | Units        |
| `` `/projects/${projectId}/pricing` ``           | Pricing      |
| `` `/projects/${projectId}/pois` ``              | POIs         |
| `` `/projects/${projectId}/digitizer` ``         | Digitizer    |
| `` `/projects/${projectId}/commissions` ``       | Commissions  |

#### B.2.4 — Global Search (`GlobalSearch.tsx`)

| `href` Value                                           | Entity Type | Source     |
| :----------------------------------------------------- | :---------- | :--------- |
| `` `/projects/${p.id}` ``                              | Project     | Search hit |
| `` `/leads/${l.id}` ``                                 | Lead        | Search hit |
| `` `/projects/${u.projectId}/units/${u.id}` ``         | Unit        | Search hit |

#### B.2.5 — Notification Bell (`NotificationBell.tsx`)

Dynamic routing via `getHref()` function:

| `entityType` | Generated `href` Value       |
| :----------- | :--------------------------- |
| `'lead'`     | `` `/leads/${n.entityId}` `` |
| `'visit'`    | `/visits`                    |
| *(default)*  | `/dashboard`                 |

#### B.2.6 — Dashboard Page (`(app)/page.tsx`)

QueueCard items generate hrefs programmatically:

| Target                  | Generated `href` Value                                                | Context                                 |
| :---------------------- | :-------------------------------------------------------------------- | :-------------------------------------- |
| Lead detail             | `` `/leads/${l.id}` ``                                                | Overdue, Due Today, New Leads queues    |
| Capture outcome dialog  | `` `?capture=${v.id}` ``                                              | Completed visit without captured outcome |
| Lead from visit         | `` `/leads/${v.primaryLeadId}` ``                                     | Visit with a linked lead                |
| Fallback                | `#`                                                                   | Visit without a linked lead             |

#### B.2.7 — UpcomingExpiries Component (`components/dashboard/UpcomingExpiries.tsx`)

| `href` Value                                                  | Entity         |
| :------------------------------------------------------------ | :------------- |
| `` `/projects/${h.unit.projectId}/units/${h.unitId}` ``       | Expiring hold  |
| `` `/leads/${l.id}` ``                                        | Follow-up lead |

#### B.2.8 — Projects List Page (`(app)/projects/page.tsx`)

| `href` Value                | Label / Context                |
| :-------------------------- | :----------------------------- |
| `/projects/new`             | "New Project" button           |
| `` `/projects/${project.id}` `` | Project name link in table |

#### B.2.9 — Projects New Page (`(app)/projects/new/page.tsx`)

| `href` Value | Label / Context                  |
| :----------- | :------------------------------- |
| `/projects`  | Breadcrumb back to project list  |

#### B.2.10 — Project Detail Page (`(app)/projects/[projectId]/page.tsx`)

| `href` Value | Label / Context                  |
| :----------- | :------------------------------- |
| `/projects`  | Breadcrumb back to project list  |

#### B.2.11 — Project Pricing Page (`(app)/projects/[projectId]/pricing/page.tsx`)

| `href` Value                       | Label / Context                       |
| :--------------------------------- | :------------------------------------ |
| `` `/projects/${projectId}` ``     | Breadcrumb back to project detail     |

#### B.2.12 — Project Units List Page (`(app)/projects/[projectId]/units/page.tsx`)

| `href` Value                                   | Label / Context                        |
| :--------------------------------------------- | :------------------------------------- |
| `` `/projects/${projectId}` ``                  | Breadcrumb back to project detail      |
| `` `/projects/${projectId}/units/new` ``        | "Add Unit" button                      |

#### B.2.13 — Unit Table Component (`components/units/UnitTable.tsx`)

| `href` Value                                                | Label / Context                |
| :---------------------------------------------------------- | :----------------------------- |
| `` `/projects/${projectId}/units/${unit.id}` ``             | Unit number link in table row  |

#### B.2.14 — Unit Detail Page (`(app)/projects/[projectId]/units/[unitId]/page.tsx`)

| `href` Value                                    | Label / Context                  |
| :---------------------------------------------- | :------------------------------- |
| `/projects`                                     | Breadcrumb: "Projects"           |
| `` `/projects/${project.id}` ``                  | Breadcrumb: Project name         |
| `` `/projects/${project.id}/units` ``            | Breadcrumb: "Inventory"          |

#### B.2.15 — New Unit Page (`(app)/projects/[projectId]/units/new/page.tsx`)

| `href` Value                                   | Label / Context                      |
| :--------------------------------------------- | :----------------------------------- |
| `` `/projects/${projectId}/units` ``            | Back link to units list              |

#### B.2.16 — Leads List Component (`components/leads/LeadList.tsx`)

| `href` Value                 | Label / Context                     |
| :--------------------------- | :---------------------------------- |
| `` `/leads/${lead.id}` ``    | Lead name link in list              |

#### B.2.17 — Visit Calendar Component (`components/visits/VisitCalendar.tsx`)

| `href` Value                    | Label / Context                                  |
| :------------------------------ | :----------------------------------------------- |
| `` `?capture=${visit.id}` ``    | "CAPTURE OUTCOME" button (search param trigger)  |

#### B.2.18 — `router.push()` Navigations (CRM)

| Destination Value                                     | Source Component                           | Context                                     |
| :---------------------------------------------------- | :----------------------------------------- | :------------------------------------------ |
| `/login`                                              | `components/shell/AppShell.tsx`             | After sign-out                              |
| `/`                                                   | `(auth)/login/page.tsx`                     | After successful login (email or phone)     |
| `` `/projects/${projectId}/units` ``                  | `components/units/UnitForm.tsx`             | After successful unit create/edit           |
| `/projects`                                           | `components/projects/ProjectForm.tsx`       | After successful project create/edit        |
| `/leads`                                              | `components/leads/LeadList.tsx`             | Agent filter reset (`val === 'all'`)        |
| `` `/leads?agentId=${val}` ``                         | `components/leads/LeadList.tsx`             | Agent filter applied                        |

#### B.2.19 — `router.replace()` Navigations (CRM)

| Destination Value                              | Source Component                                | Context                                   |
| :--------------------------------------------- | :---------------------------------------------- | :---------------------------------------- |
| `` `${pathname}?${params.toString()}` ``        | `components/visits/CaptureOutcomeDialog.tsx`     | Updates search params after outcome capture |

#### B.2.20 — Server-Side `redirect()` Calls (CRM)

| Destination | Source File                                             | Trigger Condition                  |
| :---------- | :------------------------------------------------------ | :--------------------------------- |
| `/login`    | `(app)/layout.tsx`                                      | No session                         |
| `/login`    | `(app)/page.tsx` (Dashboard)                            | No role context                    |
| `/login`    | `(app)/projects/page.tsx`                               | No role context                    |
| `/login`    | `(app)/projects/[projectId]/page.tsx`                   | No role context                    |
| `/login`    | `(app)/projects/[projectId]/pois/page.tsx`              | No role context                    |
| `/login`    | `(app)/projects/[projectId]/digitizer/page.tsx`         | No role context                    |
| `/login`    | `(app)/leads/page.tsx`                                  | No role context                    |
| `/login`    | `(app)/visits/page.tsx`                                 | No role context                    |
| `/login`    | `(app)/profile/page.tsx`                                | No role context                    |
| `/login`    | `(app)/audit/page.tsx`                                  | Unauthenticated owner check        |
| `/login`    | `(app)/bookings/[bookingId]/page.tsx`                   | No role context                    |
| `/leads`    | `(app)/leads/inbox/page.tsx`                            | User is not owner (role guard)     |

---

### B.3 — Complete Deduplicated Link Inventory

Below is the full set of unique internal URL patterns actually linked within UI components across both apps, collapsed and deduplicated.

#### B.3.1 — Public App Internal Links

| #  | URL Pattern                                          | Mechanism       |
| :- | :--------------------------------------------------- | :-------------- |
| 1  | `/`                                                  | `router.push`   |
| 2  | `/projects/${slug}`                                  | `<Link>`        |
| 3  | `#enquiry`                                           | `<a>`           |

#### B.3.2 — Public App External Links

| #  | URL Pattern                                          | Mechanism       |
| :- | :--------------------------------------------------- | :-------------- |
| 1  | `https://wa.me/${number}?text=${message}`            | `<a>`           |

#### B.3.3 — CRM App Internal Links (All Mechanisms Combined)

| #  | URL Pattern                                                    | Mechanism(s)                           |
| :- | :------------------------------------------------------------- | :------------------------------------- |
| 1  | `/`                                                            | `<Link>`, `router.push`, `redirect`   |
| 2  | `/login`                                                       | `router.push`, `redirect`             |
| 3  | `/dashboard`                                                   | `<Link>` (notification fallback)       |
| 4  | `/projects`                                                    | `<Link>`, `router.push`               |
| 5  | `/projects/new`                                                | `<Link>`                               |
| 6  | `/projects/${id}`                                              | `<Link>`                               |
| 7  | `/projects/${id}/units`                                        | `<Link>`, `router.push`               |
| 8  | `/projects/${id}/units/new`                                    | `<Link>`                               |
| 9  | `/projects/${id}/units/${unitId}`                              | `<Link>`                               |
| 10 | `/projects/${id}/pricing`                                      | `<Link>`                               |
| 11 | `/projects/${id}/pois`                                         | `<Link>`                               |
| 12 | `/projects/${id}/digitizer`                                    | `<Link>`                               |
| 13 | `/projects/${id}/commissions`                                  | `<Link>`                               |
| 14 | `/leads`                                                       | `<Link>`, `router.push`, `redirect`   |
| 15 | `/leads?agentId=${val}`                                        | `router.push`                          |
| 16 | `/leads/${id}`                                                 | `<Link>`                               |
| 17 | `/leads/inbox`                                                 | *(route exists, no direct links found)* |
| 18 | `/bookings/${bookingId}`                                       | *(route exists, no direct links found)* |
| 19 | `/visits`                                                      | `<Link>`                               |
| 20 | `/audit`                                                       | `<Link>`                               |
| 21 | `/profile`                                                     | *(route exists, no direct links found)* |
| 22 | `/settings`                                                    | `<Link>`                               |
| 23 | `/settings/users`                                              | `<Link>`                               |
| 24 | `/settings/devices`                                            | `<Link>`                               |
| 25 | `/settings/commissions`                                        | `<Link>`                               |
| 26 | `/settings/export`                                             | `<Link>`                               |
| 27 | `?capture=${visitId}`                                          | `<Link>` (search param, same page)    |
| 28 | `#`                                                            | `<Link>` (fallback for unlinked visit) |

---

## Appendix: Routes Without Inbound Links

The following page routes exist in the filesystem but have **no** `<Link>`, `router.push`, or `redirect` pointing to them from any scanned component:

| App     | Route                    | Notes                                                  |
| :------ | :----------------------- | :----------------------------------------------------- |
| Public  | `/present-home`          | Entry point for kiosk devices; navigated to directly via browser URL |
| Public  | `/enroll`                | Navigated to directly on kiosk setup; no in-app link   |
| Public  | `/p/[projectSlug]`       | Presentation mode uses focus-based navigation from `ProjectGrid` → `ProjectCard`, not `<Link>` hrefs |
| CRM     | `/dashboard`             | Only reached via NotificationBell fallback; the root `/` also serves as dashboard |
| CRM     | `/leads/inbox`           | Owner-only triage page; discoverable but not linked from sidebar |
| CRM     | `/bookings/[bookingId]`  | Deep-linked from external sources or programmatic contexts not scanned here |
| CRM     | `/profile`               | Not linked from sidebar or any scanned component       |
