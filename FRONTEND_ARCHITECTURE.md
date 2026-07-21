# FRONTEND_ARCHITECTURE.md — "The Residence": apps/public Experience Architecture

> Companion to `BACKEND_CONTRACT_FINAL.md` (the locked data contract) and
> `FRONTEND_BLUEPRINT.md`. This is the build-against document for the Quiet Luxury
> redesign. No component code — architecture, contracts, budgets, sequence.
>
> Repo constraints honored throughout: apps/crm untouched, projection security boundary
> untouched, `(present)` kiosk route group untouched, all Tier-2 data exclusively from the
> verified readers. Stack reality: **Next.js 14.2.35 (App Router, React 18)** — every
> library pin below is chosen for that, not for a hypothetical Next 15.

---

## 0 · The Vision, Acknowledged — and One Honest Reframe

The vision is a single continuous cinematic space: Midnight Navy void, black-glass floor,
copper embers, a frosted-glass villa breathing light every ~2.5s, a wheel that flies a
camera instead of scrolling a page, nodes that bloom into frosted panels, an X-ray cursor,
and a 180° window-pan that reveals the city. That is the product. Nothing below dilutes it.

**The one reframe that makes it shippable, indexable, and accessible — without changing
what the eye sees:** *the WebGL scene never owns the content.* Every word on this site —
Tier 1 panel copy included — lives in the DOM, server-rendered, styled in the design
language, positioned in an overlay layer above the canvas. The canvas is the world; the
DOM is everything readable in it. The user cannot tell. Google, screen readers, a WUST
reviewer on a 2019 Android, and the low-tier fallback all read the exact same HTML. This
single decision dissolves 80% of the "cinematic site vs. SEO" conflict before it starts —
the remaining 20% (routing, persistence, the seam) is solved in §3–§4.

Palette + type tokens (the skin both tiers wear):

| Token | Value | Use |
|---|---|---|
| `--void` | `#0A1120` (Midnight Navy, near-black) | universe background, both tiers |
| `--void-deep` | `#060A14` | floor horizon, gradients |
| `--copper` | `#C08A5D` | emissive, rings, accents, links |
| `--copper-glow` | `#E8B98A` | bloom core, hover states |
| `--cream` | `#F2EDE4` | headlines, X-ray linework |
| `--glass` | `rgba(16,24,42,0.55)` + `backdrop-blur(24px)` + 1px `rgba(232,185,138,0.18)` border | panels, cards |
| Serif | **Fraunces** (variable, optical sizes) | headlines, editorial |
| Sans | **Inter** (tabular numerals ON for data) | unit tables, forms, UI |

---

## 1 · Tier Classification — All Pages

Tier 1 = a node on the camera flight (content appears as a glass panel in the world).
Tier 2 = a real scrolling HTML page in the same skin (ambient world layer, no full 3D).
**Every page in BOTH tiers has a canonical URL, server-rendered metadata, and real HTML
content** (§3). "Tier 1" describes its *presentation on capable hardware*, not its substance.

| Page | Route | Tier | Justification |
|---|---|---|---|
| Home | `/` | **1** | The void + villa IS the homepage. Hero copy/CTAs are DOM overlay. |
| About Us | `/about` | **1** | Short brand narrative — emotional, panel-sized. Perfect node material. |
| Why Choose Us | `/why-us` | **1** | 4–6 proof pillars — sequential panels along one flight segment. |
| Start Here | `/start-here` | **1** | The guided wizard as a node panel (budget → asset → locality), powered by `getProjectUnitSummaries`. Interactive, short, emotional = Tier 1. |
| Investment Guide (gateway) | `/investment-guide` | **1 → 2 split** | Honesty required: nobody reads 4,000 editorial words inside a WebGL panel, and the guide is the site's strongest SEO asset. The NODE is a cinematic gateway (thesis + chapter index). Chapters are Tier 2: `/investment-guide/[chapter]` — long-form MDX, real scroll, crawlable. The gateway panel and chapter pages share the veil transition so it feels like opening a book, not leaving the world. |
| Contact Us | `/contact` | **1** | A form in a glass panel (DOM, fully accessible). `submitEnquiry` with projectId relaxed to optional (the one approved server-file touch, `(site)/actions.ts` only). |
| Book a Site Visit | `/book-a-visit` | **1** | Same as Contact + preferredTime. Copy must promise "we'll call to confirm" (intake drops preferredTime today — verified; don't promise scheduling we can't deliver). |
| Projects listing | `/projects` | **2** | Filterable live data (2 projects today, N tomorrow). Deep-linkable, crawlable ("plots in Visakhapatnam"). Entered via the 180° city-map seam. |
| Project Details | `/projects/[slug]` | **2** | The conversion page. Real data, gallery, map, units. Must load fast cold. |
| Properties listing | `/properties` | **2** | 187 live units, filters, sparse-row reality (null facing/areas on most land rows) — a data UI, not a narrative. |
| Property Details | `/projects/[slug]/[unitNumber]` | **2** | Canonical unit URL (kept — brochure API + sitemap already reference it). |
| Locations | `/locations` | **2** | `getLocalities` — ONE locality live today; page design must be beautiful with a single entry (editorial locality essay + map, not an empty grid). |
| Gallery | `/gallery` | **2** | `getAllMedia` (4 live rows) + curated file-based supplement. Media-heavy = real page. |
| Testimonials | `/testimonials` | **2** | Typed-JSON content. Quiet editorial layout. |
| Blog / Knowledge | `/knowledge`, `/knowledge/[slug]` | **2** | MDX. SEO workhorse. |
| Construction Updates | `/construction-updates` | **2** | Typed-JSON timeline. |
| Downloads | `/downloads` | **2** | `getAllMedia` kind=`plan` + `/api/brochure/...` + file registry. |
| Branches | `/branches` | **2** | Typed JSON + map pins. |
| Careers | `/careers` | **2** | Typed JSON. |
| FAQs | `/faqs` | **2** | Typed JSON. Also feeds JSON-LD FAQ schema. |
| Privacy / Terms / Cookie / Refund | `/privacy-policy` etc. | **2** | MDX, minimal chrome, still in-skin. |
| Sitemap (human) | `/sitemap` | **2** | Static + `getPublishedProjects`. |
| 404 | `not-found.tsx` | **2, in-world** | Styled void fragment: navy, drifting embers (CSS/canvas-2D — no WebGL boot for an error page), serif "This address doesn't exist in the residence," copper links to `/` and `/projects`. |

Tier 1 total: 7 routes on one camera track. Tier 2: everything else. The two tiers ship as
two route-group segments inside the existing `(site)` group (§3); `(present)` untouched.

---

## 2 · The Seam — How Two Systems Feel Like One World

The model seam is the user's own: **the 180° window pan.** Generalized into a system:

**2.1 · The Veil.** One full-viewport transition element (DOM, above everything): a
radial copper-ember dissolve — background `--void` with a masked copper gradient sweep,
680ms, the signature ease (§6). It is the ONLY route-transition device on the site, used
identically for Tier1→Tier2, Tier2→Tier1, and Tier2→Tier2. Because the veil is DOM, it
survives route changes, canvas mounts/unmounts, and even the low-tier path — the illusion
of continuity is carried by the veil + constant palette, not by keeping WebGL alive.

**2.2 · Flight → Utility (the window pan).** The final Tier-1 node is The Window. Camera
pans 180°, looks down: the WebGL city — a stylized dark plane with copper location beacons
at each project's REAL centroid (`getLocalities` → GeoJSON points; two beacons live today)
and faint POI motes around them (`getProjectMapData` per project). **No plot polygons —
`geometry_pub` = 0 rows is the architected reality; beacons + connectivity only, with plot
meshes as dormant enhancement when geometry publishes.** Selecting a beacon: camera dives
toward it → veil closes at the dive's peak velocity → route change to `/projects/[slug]` →
veil opens on the Tier-2 page whose hero is the project's real `heroUrl`. The dive and the
veil overlap by ~200ms, so the cut lands mid-motion — the eye never sees a static swap.
"All projects" from the same node → `/projects` listing.

**2.3 · Utility → Flight.** A persistent copper ring affordance (bottom-left, doubles as
the sound toggle's sibling) labeled "The Residence." Click → veil → Tier 1 boots (or
resumes from the Zustand store — camera restores to the last node, not the start). While
the user reads Tier 2 pages, the experience bundle+GLB preload lazily on idle
(`requestIdleCallback` + `<link rel=prefetch>`), so the return flight starts in <1s warm.

**2.4 · Cold deep-link into Tier 2.** Server HTML paints immediately (no WebGL cost, no
boot): navy void background, film grain, a *2D ember layer* (canvas-2D/CSS, ~40 particles,
<0.5ms/frame), glass cards, serif headlines. It reads as "a quiet room of the same house."
The Residence affordance is present but the 3D world loads only if invited (or idle-
preloaded). A reviewer opening `/investment-guide/taxes` gets a beautiful, instant,
indexable page — and a doorway back into the film.

**2.5 · Cold deep-link into Tier 1.** `/why-us` server-renders the panel content as a real
HTML article (SEO satisfied before any JS). Then, by capability tier: high/medium — the
experience boots *at that node* (camera initialized to the node's path position; no forced
replay of the whole flight); low/reduced — the page stays as the elegant static article
with the cinematic-still hero (§7). Either way the URL's content was the first paint.

---

## 3 · App Router × Persistent Canvas — the Hard Problem, Solved Explicitly

**3.1 · Segment layout owns the canvas.** Inside the existing `(site)` group:

```
app/(site)/
├── layout.tsx                  ← tokens, fonts, veil controller, ambient 2D ember layer,
│                                  cursor system, sound manager, capability provider
├── (experience)/               ← TIER 1 — one segment, one persistent layout
│   ├── layout.tsx              ← mounts <ExperienceCanvas> (client, dynamic ssr:false)
│   │                              + <PanelOutlet> (DOM overlay slot)
│   ├── site-home/page.tsx      ← "/" via existing middleware rewrite (UNCHANGED middleware)
│   ├── about/  why-us/  start-here/  investment-guide/  contact/  book-a-visit/
├── (utility)/                  ← TIER 2 — ambient layout, normal document scroll
│   ├── layout.tsx              ← header/footer chrome, ambient layer, Residence affordance
│   ├── projects/  projects/[slug]/  projects/[slug]/[unitSlug]/  properties/
│   ├── locations/ gallery/ testimonials/ knowledge/ construction-updates/
│   ├── downloads/ branches/ careers/ faqs/ investment-guide/[chapter]/
│   └── privacy-policy/ terms/ cookie-policy/ refund-policy/ sitemap/
└── not-found.tsx
```

App Router preserves layouts across navigations *within the same segment*: navigating
`/about → /why-us` re-renders only `page.tsx` (the panel article) — **the canvas in
`(experience)/layout.tsx` never remounts, the WebGL context never drops, the camera never
resets.** This is the entire persistence mechanism; no hacks, no portal gymnastics.
Crossing tiers unmounts the canvas *by design* — masked by the veil (§2.1), state parked
in the store (§3.3). Tradeoff named in §11.1 (vs. root-level always-alive canvas).

**3.2 · Scroll-position ↔ URL, two-way.**
- *Scroll drives URL:* Tier 1 has **no document scroll** (`overflow hidden`; wheel/touch
  deltas feed the camera, §5.5). When damped progress crosses a node's threshold, call
  `window.history.replaceState` with the node's URL — Next 14.2 officially syncs
  `usePathname` with pushState/replaceState, and critically this makes **zero server
  round-trip** (a `router.replace` would re-request the RSC payload on every node cross).
  Menu clicks use `router.push` normally.
- *URL drives scroll:* on `popstate` (back/forward) and on cold entry, resolve pathname →
  node → path progress; cold entry snaps, in-session navigation animates the camera along
  the track (never teleport mid-session — back/forward becomes a flight, which turns the
  browser chrome itself into part of the film).
- Node metadata (path position, panel side, camera pose) lives in one typed
  `flight-plan.ts` registry — single source of truth for the track, the URLs, the menu,
  and the preloader's asset manifest.

**3.3 · State model.** One Zustand store (`experience-store`), persisted to
`sessionStorage`: `{ progress, activeNodeId, qualityTier, soundOn, visited[] }`. The
canvas is a pure consumer — remounting it after a Tier-2 excursion rehydrates camera and
scene state in one frame. React Context only for the capability probe result (set once).

**3.4 · SSR/SEO split.**
- Tier 2 pages: normal RSC — server-fetch from the locked readers, stream real HTML,
  `generateMetadata` + JSON-LD (`RealEstateListing` on unit pages, `FAQPage`, `Article`).
  **Serialization discipline from the contract:** legacy readers return `BigInt` prices
  and `Date` objects — convert to string at the RSC boundary before passing to any client
  component (verified caveat, BACKEND_CONTRACT_FINAL §0.2/0.4).
- Tier 1 pages: `page.tsx` is *also* RSC — it renders the panel article HTML into the
  overlay slot. Only `<ExperienceCanvas>` is `dynamic(..., { ssr: false })`. Crawlers and
  no-JS users get the article; capable browsers get the same article floating in glass.
- OG: extend the existing `opengraph-image.tsx` pattern (already proven on project pages)
  to every route via `ImageResponse` — navy field, serif title, copper rule. No generic cards.

**3.5 · CSP reality (verified this repo):** `connect-src` allows only self/supabase/
maptiler/posthog. Therefore: GLB models, Draco/Meshopt decoder WASM, KTX2 transcoder,
fonts, and the baked fallback video are **all self-hosted in `public/`** — no CDN loaders
(the classic three.js CDN-decoder default would be silently blocked). Villa/media assets
may also live on Supabase storage (allowed origin).

---

## 4 · Tech Stack (pinned for Next 14.2.35 / React 18)

| Concern | Choice | Pin / Note |
|---|---|---|
| 3D runtime | three + **@react-three/fiber v8** | R3F v9 requires React 19 — not this repo. `three@^0.170`, `@react-three/fiber@^8.17`, `@react-three/drei@^9.114` |
| Post-processing | `@react-three/postprocessing@^2.16` (postprocessing ^6.36) | Bloom, Vignette, Noise, ToneMapping in ONE composited pass chain |
| Animation/choreography | **GSAP 3** + CustomEase | One easing definition exported to both GSAP and CSS (§6); timeline choreography for veil/panels/preloader |
| Camera path | `THREE.CatmullRomCurve3` control points in `flight-plan.ts` + a dev-only path editor overlay | Theatre.js deferred — tradeoff §11.2 |
| State | Zustand (+ sessionStorage persist) | tiny, transient-update friendly (per-frame progress writes without React re-render via `store.getState()` in useFrame) |
| Scroll input | Custom wheel/touch → damped progress (spring, §5.5) in Tier 1; **native scroll** in Tier 2 | Lenis deliberately NOT used — tradeoff §11.5 |
| Cursor | DOM ring (rAF lerp) + raycast bridge to shader uniform | §5.2 |
| Maps (Tier 2) | Existing **SiteProjectMap** + `getProjectMapData` (verified this session) | MapLibre 5.24 already installed; designed fallback already built |
| Assets | GLB + **gltfpack/Meshopt** compression, **KTX2/Basis** textures, self-hosted decoders | Villa budget: ≤1.5MB compressed, ≤60k tris |
| Fonts | next/font self-hosted Fraunces + Inter | zero-CLS via `size-adjust` fallbacks |
| Content | MDX (`@next/mdx`) + typed JSON modules | per PHASE1_PLAN — no new tables |
| Analytics | Existing PostHog provider `(site)` only | already isolated from `(present)` |

---

## 5 · Studio-Craft Techniques — Technique · Where · Cost

**5.1 · Villa heartbeat.** Custom `ShaderMaterial` (or `onBeforeCompile` patch of
`MeshPhysicalMaterial` to keep PBR): `uTime` uniform; emissive term = copper ×
`smoothstep` band that rises with `fract(uTime / 2.5)` along the villa's local Y, eased so
the pulse *breathes* (fast attack, long decay). Bloom is **threshold-selective, not
Selection-based**: the scene is authored so ONLY heartbeat emissive exceeds
`luminanceThreshold` (~1.1 in HDR range) — one bloom pass blooms copper only, no second
render pass. Cost: bloom chain ≈ 1.2–2.0ms GPU @1080p (5 mip levels, half-res); the
shader math itself is free. *Junior tell avoided:* whole-scene bloom soup.

**5.2 · X-ray flashlight cursor.** DOM ring cursor lerps toward pointer (`0.12` lerp/frame,
magnetism: within 48px of `[data-magnetic]`, ring eases onto the target's center and
scales — same signature ease). Each frame (throttled to pointer-move + camera-move), one
raycast against a low-poly proxy of the villa (not the visual mesh — 200 tris, invisible)
→ hit point written to `uCursorWorld`. Villa fragment shader: interior line-work (authored
as a second UV set / detail texture, cream) revealed by
`1.0 - smoothstep(r0, r1, distance(vWorldPos, uCursorWorld))`, masked to villa geometry
because it lives *in the villa's material* — nothing else can catch it. Cost: raycast vs
200-tri proxy ≈ 0.02ms CPU; shader adds ~4 ALU ops/fragment — negligible. Falls back to
plain cursor glow (no reveal) on medium tier if fragment cost ever shows on profile.

**5.3 · Ember particles.** ONE draw call: `THREE.Points` (or InstancedMesh for soft
quads), 1,200 particles high / 500 medium. All motion in the vertex shader: per-particle
seed attribute → curl-ish drift = `sin/cos(uTime × freq + seed)` offsets + slow upward
bias with wrap; size attenuation by depth; soft circular alpha in fragment. **Zero CPU
per-particle work, zero allocations per frame.** Cost: <0.3ms GPU. Tier 2's ambient layer
is a separate 40-particle canvas-2D system (no WebGL context on content pages).

**5.4 · Reflective black-glass floor.** Truth table, because this is the most expensive
pixel on screen:
- *High tier:* planar reflection (drei `MeshReflectorMaterial`) — re-renders the scene
  from the mirrored camera into a **0.5× res** target with blur+depth fade. Cost ≈ 40–60%
  of scene GPU time again (≈ +2.5–4ms @1080p on the mirrored pass' reduced res). Villa +
  embers only on the reflection layer (layers mask) to cap it.
- *Medium tier:* **fake it** — mirrored villa instance (1 extra draw call, y-scaled −1,
  opacity gradient to `--void-deep`) + static baked environment glint. Cost ≈ 0.3ms.
  Visually ~90% of the effect for ~10% of the price. This is the default; real planar
  reflection is a high-tier luxury.
- *SSR (screen-space):* rejected — SSRPass in postprocessing is noisy on sparse dark
  scenes (exactly ours: mostly void), costs more than planar here, and its edge artifacts
  read as jank, not luxury.

**5.5 · Scroll-throttle camera.** Wheel/touch/keyboard deltas accumulate into
`targetProgress` (clamped 0–1, delta normalized across devices, trackpad pinch guarded).
Per frame: `progress = damp(progress, targetProgress, λ=3.5, dt)` (critically-damped
exponential — frame-rate independent, no spring overshoot; overshoot on a camera reads as
nausea, not weight). Camera pose = position on `CatmullRomCurve3` + lookAt on a *second*
offset curve (so gaze leads position through doorways — the cinematic trick). Near nodes,
progress gains a soft magnet (ease toward node center when |Δ| < threshold and input
idle) so panels present themselves composed, never half-arrived. Panels: node proximity
drives a GSAP timeline (slide + blur-in of the DOM panel, staggered serif lines). Cost:
all CPU math < 0.1ms; the camera is free — the *discipline* is that nothing else in the
scene ticks per-scroll (no React state per frame; store writes bypass render).

**5.6 · The details juniors skip.**
- *Preloader:* branded overture — the villa silhouette drawn as a copper stroke
  (SVG `stroke-dashoffset`) whose progress = **real weighted bytes** from a manifest-based
  loader (GLB weight 0.6, KTX2 0.25, fonts 0.1, shader compile 0.05 — compile measured via
  `renderer.compileAsync` before reveal, killing the first-interaction jank juniors never
  notice). Minimum display 1.2s (no flash), reveal = the first heartbeat pulse, which
  doubles as the "scene is alive" proof. Never a spinner, never a fake percentage.
- *Zero layout shift:* Tier 1 overlays are absolutely positioned (cannot shift); Tier 2
  images always sized from the contract's real `variants.{w,h}` (**note: keys are `w`/`h`
  — the corrected shape**); fonts via next/font with adjusted fallbacks; the ambient layer
  is `position:fixed` behind everything.
- *404 in-world:* §1 table. No WebGL boot on an error page — grief costs nothing.
- *Typographic hierarchy:* Fraunces optical sizing (display 72–96/soft, text 18–20),
  copper rules, `hanging-punctuation` where supported, real drop caps in Investment Guide
  chapters, `font-variant-numeric: tabular-nums` on every price/area column.
- *Sound:* off by default, one visible toggle (persisted): room-tone pad −38dB, node
  chime, panel whoosh — all < 200KB, WebAudio, gain-ramped by the same easing. Never
  autoplay; respects `prefers-reduced-motion` by staying off.
- *OG images:* per-route `ImageResponse` on brand (already proven pattern in repo).

---

## 6 · One Motion Language (the system's fingerprint)

- **The Signature Ease:** `cubic-bezier(0.76, 0, 0.22, 1)` — defined ONCE as
  `EASE_SIGNATURE` and exported three ways: CSS custom property `--ease-signature`,
  GSAP `CustomEase("signature")`, and the numeric damping λ=3.5 tuned to match its feel
  for continuous (camera/cursor) motion. Panels, veil, cursor magnetism, hover states,
  heartbeat attack — everything moves on this curve or its damped analog. No exceptions;
  a second curve requires a design review.
- **Timing scale:** 240ms (micro: hovers, cursor), 480ms (element: panel lines, cards),
  680ms (the veil), 1200ms (camera node-to-node minimum). Multiples only.
- **Stagger constant:** 60ms between siblings (serif line reveals, card grids).
- **Heartbeat:** 2.5s period, everywhere — the loader pulse, the villa, the beacon pings
  on the city map, the caret blink in forms (1.25s half-period). The whole site shares
  one pulse; this is the subliminal continuity between tiers.

---

## 7 · Capability Fallback Ladder (binds to the EXISTING probe — verified fields)

The existing `capability-probe.ts` returns `{ tier: high|medium|low, mediaVariant,
enableExtrusion, transitionStyle }` and honors `prefers-reduced-motion` → `crossfade`.
Boot order: server shell + preloader first → probe runs during preload → branch **before**
first experience paint (no downgrade flash; the preloader is tier-agnostic).

| | HIGH (desktop dGPU/M-series, good net) | MEDIUM (mid Android/iGPU) | LOW / WebGL-fail / save-data |
|---|---|---|---|
| World | Full 3D, DPR ≤ 2 | Full 3D, DPR ≤ 1.5, fog pulls horizon in | **No WebGL.** Cinematic still/video path |
| Floor | Planar reflection 0.5× | Mirrored-mesh fake | Gradient + grain |
| Bloom | Half-res, 5 mips | Quarter-res, 3 mips, or sprite-glow swap | Baked into imagery |
| Embers | 1,200 GPU | 500 GPU | 40 × canvas-2D |
| X-ray cursor | Full shader reveal | Cursor glow only (no reveal pass) | System cursor, styled focus rings |
| Camera | Continuous flight | Continuous flight, cheaper scene | **None** — Tier 1 pages render as elegant scroll articles (their real HTML, §0) with a full-bleed cinematic hero: Phase-1 = authored still + parallax + CSS embers; Phase-2 = 6–8s baked loop (H.265/VP9 ≤ 2.5MB, self-hosted) captured FROM the finished high-tier scene |
| Media | `presentation_4k`→as probe says | `web` | `thumb`/`web` |
| Panels | Glass blur 24px | Blur 12px | Solid `--glass` (blur is the #1 mid-Android GPU killer — verified class of cost, not guess) |
| `prefers-reduced-motion` (any tier) | → | → | Camera flight replaced by **crossfade between node compositions** (probe's `transitionStyle:'crossfade'` — discrete states, no continuous motion), heartbeat becomes a 4s opacity breathe, magnetism off, embers static, veil becomes a 300ms fade. Content identical. |

The LOW path is not a punishment tier: it is the same serif, same palette, same veil (CSS),
same content — an "editorial print edition" of the same house. It must be art-directed
with the same care, because Awwwards judges throttle, and most real Visakhapatnam buyers
live here.

---

## 8 · Tier-2 Data Mapping (against the LOCKED contract — no invented fields)

| Page | Readers (verified) | Contract caveats that shape the UI |
|---|---|---|
| `/projects` | `getPublishedProjects()` + `getProjectUnitSummaries()` | Summaries: lucky-gardens is ALL price-on-request → min/max null → card shows "Price on request", never "₹0". Dates are `Date` objects — serialize at boundary. |
| `/projects/[slug]` | `getProjectBySlug` + `getUnitsByProjectId` + `getMediaByProjectId` + `getPoisByProjectId` + `getProjectMapData` | Unit `pricePaise` is **BigInt** from legacy reader → `.toString()` before client. Map = SiteProjectMap (already verified, designed fallback included). NEVER read `centroid` from the legacy project row (WKB string — proven). |
| `/projects/[slug]/[unitNumber]` | existing units_pub⋈projects_pub join pattern | `classDetails` may be `[]`; land rows sparse. Brochure via existing API route. |
| `/properties` | `getAllPublishedUnits()` (187 live rows) | Sparse-row design mandate: null facing/areas/dimensions common; `unitNumber` sorts as text; filter facets from real fields only (status/assetClass/facing/area/price-string). |
| `/locations` | `getLocalities()` | ONE locality live — single-entry layout first. `projects[].centroid` is proper GeoJSON here (safe for map). |
| `/gallery` | `getAllMedia()` + file supplement | 4 live rows; variants keys are **`{h,w,url}`**. |
| `/downloads` | `getAllMedia()` kind=`plan` + `/api/brochure/...` + JSON registry | — |
| City-map node (Tier 1 seam) | `getLocalities()` for beacons; `getProjectMapData(projectId)` per project for POI motes | No all-POIs reader exists — acceptable at 2 projects (2 calls, server-side, cached); flagged as a future reader IF project count grows, **not** invented now. |
| `/start-here` (T1) | `getProjectUnitSummaries()` | Handle all-null price project (live case). |
| `/contact`, `/book-a-visit` (T1) | `submitEnquiry` | projectId→optional is a public-side schema edit in `(site)/actions.ts` ONLY (CRM intake verified tolerant). Requires `LEAD_INTAKE_URL/SECRET` env (currently missing — form errors until set). preferredTime/message don't survive intake yet: copy must not overpromise. |
| Testimonials / Updates / Branches / Careers / FAQs / legal / blog / guide chapters | typed JSON / MDX in repo | No reader needed by design (PHASE1_PLAN §5). |
| **Coverage gaps flagged** | — | (1) all-POIs-across-projects reader (workaround above); (2) gallery volume is a *content* gap, not contract; (3) site-visit preferredTime persistence needs the approved-pending 5-line CRM intake change — out of scope here. Nothing else missing; no fields invented. |

---

## 9 · Performance Budgets (enforced, not aspirational)

- Frame: **≤ 16.6ms total on the reference machine** (M-series/desktop dGPU @1080p):
  scene GPU ≤ 6ms, bloom ≤ 2ms, reflection ≤ 4ms (high only), JS/frame ≤ 3ms, zero
  per-frame allocations (profiled — the GC hitch is the FWA killer). Medium target:
  60fps on a Pixel-6a-class device with the medium column of §7.
- Payload: experience bundle (three+r3f+post+GSAP) ≤ 450KB gz, lazy — **never loaded on
  Tier 2 cold entry**; villa GLB ≤ 1.5MB; KTX2 set ≤ 2MB; Tier 2 page JS ≤ 130KB gz.
- Web vitals on Tier 2: LCP < 2.0s (4G mid-device), CLS = 0.00, INP < 200ms.
- Tooling: `r3f-perf` in dev, Lighthouse CI on Tier 2 routes, a `?tier=low|medium|high`
  override param for testing every ladder rung on one machine.

---

## 10 · Build Sequence — Vertical Slice First

**SLICE 0 — "The Overture" (build & perfect before anything else).**
Scope: boot → branded real-progress preloader → void + floor (medium-tier fake floor
first) + embers + **parametric villa** (§11.3) + heartbeat with selective bloom + ring
cursor with magnetism + X-ray reveal + ONE flight segment (Home hero → About node) + one
glass panel sliding in/out with staggered serif + URL sync (`/` ↔ `/about`) + reduced-
motion crossfade variant + LOW-tier static rendition of the same two pages.
**Acceptance:** 60fps sustained on reference hardware AND a mid Android with the medium
ladder; zero per-frame allocations; preloader tracks real bytes; back/forward flies the
camera; JS-disabled crawl of `/about` returns the full article HTML; both `?tier`
overrides beautiful. *This slice is itself the WUST/client demo.*
Everything after is replication of proven patterns — no new hard problems remain.

**PHASE 1 — The Seam + first real data.** The Window node + WebGL city beacons (real
centroids) + the veil system + Tier-2 ambient layout + `/projects` + `/projects/[slug]`
(readers wired with serialization discipline, SiteProjectMap embedded) + Residence-return
affordance + idle preloading.
**PHASE 2 — Full inventory.** `/properties` (sparse-row design), unit page restyle,
remaining Tier-1 nodes (Why Us, Start Here wizard, Investment gateway, Contact,
Book-a-Visit wired to `submitEnquiry` incl. projectId-optional edit + env vars).
**PHASE 3 — Content corpus.** Investment Guide chapters (MDX system + drop caps),
Knowledge, FAQs (+JSON-LD), Testimonials, Construction Updates, Branches, Careers, legal,
human sitemap, 404.
**PHASE 4 — Media & place.** Gallery (+file supplement), Locations, Downloads.
**PHASE 5 — The craft pass.** Sound design + toggle, per-route OG images, high-tier
planar floor upgrade, Blender villa swap *if* Phase-5 time allows (§11.3), bake the
low-tier hero video from the finished scene, a11y audit (focus order through panels,
`inert` on canvas, skip links), Lighthouse/waterfall pass, content zero-lorem audit.

---

## 11 · Named Tradeoffs (impressive vs. shippable — with recommendations)

1. **Canvas in root layout (never unmounts anywhere) vs. experience-segment layout
   (unmounts on Tier 2).** Root-persistent keeps the WebGL context warm for instant
   returns but burns GPU/battery behind every data page, complicates Tier-2 scroll, and
   fights SSR hydration ordering. **Recommend segment-scoped + veil + store-resume** —
   the veil makes the unmount invisible, and Tier 2 stays fast. (Revisit only if
   return-to-flight ever measures > 1.5s warm.)
2. **Theatre.js keyframed camera vs. code-authored Catmull-Rom + dev editor.** Theatre is
   the studio tool but a real learning-curve tax on a solo deadline. **Recommend code
   path now**; the `flight-plan.ts` abstraction means Theatre can replace the interpolator
   later without touching consumers.
3. **Blender-sculpted villa vs. parametric in-code abstraction** (composed frosted-glass
   volumes + brushed-copper mullions + interior line texture). Sculpted is "most
   impressive"; parametric is shippable this decade by a solo dev, *and the brief's
   aesthetic is abstract-luxury, where parametric honestly excels*. **Recommend
   parametric for the slice**, budget a Blender upgrade in Phase 5 behind the same GLB
   loading path (drop-in swap).
4. **SSR floor reflections vs. planar vs. faked mirror.** **Recommend fake-by-default,
   planar as high-tier luxury, SSR rejected** (§5.4 has the numbers).
5. **Lenis smooth-scroll on Tier 2 vs. native.** Lenis on long data/legal pages hurts
   input latency on mid devices and screen-reader/keyboard ergonomics — and Tier 2's job
   is *fast*. **Recommend native scroll** with CSS `scroll-behavior` and the signature
   ease reserved for element transitions. (Tier 1 doesn't scroll at all — §5.5.)
6. **View Transitions API vs. custom veil.** VTA is experimental in this Next line and
   unreliable across canvas mounts. **Recommend the custom veil** — it also works on the
   LOW tier, which VTA-on-canvas never would.
7. **R3F v9/React 19 upgrade vs. stay on v8.** Upgrading Next/React mid-project to
   chase r3f v9 features risks the whole app for zero visible gain. **Stay on v8.**

## 12 · Risks Register

| Risk | Mitigation |
|---|---|
| Villa asset quality makes-or-breaks the aesthetic | Parametric approach de-risks; slice proves it before replication |
| Mid-Android GPU (backdrop-blur + bloom) | Ladder §7 has explicit cheaper substitutes per rung; test with `?tier` override early |
| Solo-dev scope creep across 26 routes | Slice-first gate; Phases 3–4 are pattern replication with file-based content |
| Data sparsity reads as "unfinished" (null-heavy land rows, 4 media rows, 1 locality) | Designed-for explicitly in §8 — sparse states are art-directed, never empty-looking |
| iOS Safari WebGL quirks (context loss on tab switch) | `webglcontextlost` handler → veil → soft reboot from store; test in slice |
| Env not set (`MAPTILER key`, `LEAD_INTAKE_*`) | Forms/maps already have designed fallbacks; envs listed in BACKEND_CONTRACT_FINAL §1 |

---

*Build the Overture. Everything else is repetition of a proven pattern.*
