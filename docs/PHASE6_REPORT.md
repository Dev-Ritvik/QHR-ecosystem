# PHASE 6 — THE CINEMATIC PRESENTATION LAYER

**Status: NOT COMPLETE.** A defined, measured subset is done and committed. What
is outstanding is named in §23, and one deliverable — the new E2E suite — is
written but has not been executed.

---

## 1. Starting HEAD

```
ed7e3e7  docs(phase5): completion report, FIXLOG, and the final promoted captures
```

Branch `main`, working tree clean, Phase 5 promotion present locally, nothing
pushed. The default route served `exterior_mansion_v6_p5m.glb`, confirmed by
request rather than by reading the resolver.

## 2. Repository state at the start

Baseline recorded before any modification (§80):

| check | result |
|---|---|
| typecheck | 5/5 pass |
| tests | 188 domain + 30 db + 48 public = 266 |
| lint | 5/5 pass, 0 errors (warnings only) |
| production build | clean |
| console errors on `/` | 0 |

## 3. Actual pre-Phase-6 implementation state

**The brief assumes far less exists than does.** The forensic pass found a
mature implementation of most of what Phase 6 describes:

- `WorldCanvas.tsx` (84 KB) drives one continuous exterior→interior film on `/`,
  with `journey.ts` owning the crossover (0.46), the veil band and the interior
  pre-arm (0.2 ahead).
- `cameraPath.ts` + `interiorPath.ts` are real typed flight plans with beats,
  FOV warp and per-beat fog. `cameraPath.test.ts` has 29 tests.
- `places.ts` in `packages/domain` is a genuine node registry — 7 places, 14
  surfaces, route→place resolution, 9 tests.
- The preloader reads drei's `useProgress`, i.e. three's own `LoadingManager` —
  real progress, not a timer. It waits for `active` to go false rather than for
  100%, because Draco decode and KTX2 transcode happen after the manager
  reports complete.
- `Constellation`, `Motes`, `PostFX` (selective bloom at threshold 0.85 +
  vignette), `InteriorStage`, `ProjectStation` (turntables with pointer capture,
  scroll lock and inertia), holograms bound to real published projects, the
  founder's portrait, `CursorRing` (magnetic, `pointer: fine` only,
  reduced-motion aware), `SceneFallback`, `useDeviceTier`, `capability-probe.ts`.
- Mobile 390×844, tablet 768×1024, desktop 1440×900 and reduced-motion all boot
  clean: scroll un-trapped, no horizontal overflow, 0 console errors.

**Phase 6 was therefore an audit-and-finish job, not a build.** That framing
determined everything below.

## 4. Discrepancies between the architecture documents and the code

Code wins, per the brief. Recorded, not "fixed":

| document says | code does |
|---|---|
| Fraunces + Inter | **Inter + Playfair Display** (`app/layout.tsx`) |
| seven Tier-1 nodes, one camera flight each | **7 places / 14 surfaces.** `places.test.ts` explicitly defends this: *"~7 places, everything else instant. If this ever inverts, the design has drifted back into a camera flight per page."* |
| `/book-a-visit` | route does not exist; the registry has `/book-a-site-visit`, which **404s** |
| `/projects` listing | **404s.** Registered as a place; `/hall` is the listing |
| `/investment-guide/[chapter]`, `/construction-updates`, `/sitemap` | do not exist |

`/projects`, `/book-a-site-visit` and `/sitemap` are already excluded from
`sitemap.ts` under an `UNBUILT` set, and **nothing in the UI links to any of
them** — verified by grepping every internal `href`. They are registry entries
ahead of their pages, not live 404s.

One stale exclusion found and left alone: `sitemap.ts` lists `/about` and
`/why-us` under `UNWRITTEN` ("still carrying Slice 0 placeholder copy"), but
both now carry researched, sourced copy. They are therefore absent from the
sitemap without cause. Flagged in §23 rather than changed, because SEO exclusion
is the client's call.

## 5. What was built

Five commits, in dependency order.

### 5.1 `fc45d73` — the interior lightmap, and ember determinism

**The lightmap was uploaded four times.** `interior_hall.glb` carries ONE
lightmap image (1,472 KB on the wire), one `textures[]` entry, seven materials.
At runtime: **seven `THREE.Texture` objects**, 4096×4096, 13 mip levels,
21,845 KB each — sharing exactly **one ArrayBuffer and one image**, with **four
already holding their own `__webglTexture`**.

Cause is structural, not a defect in the asset or the loader: GLTFLoader clones
a texture whenever a material asks for a non-zero `texCoord`, because `channel`
lives on the texture rather than the binding. Six of the seven declare
`texCoord: 1`. The clone shares its payload — hence one ArrayBuffer — but
`WebGLProperties` keys on the object, so each gets its own upload.

`shareDuplicateTextures` merges textures agreeing on image identity **and** every
property that could change a fetched texel: channel, colour space, wrapping,
filtering, anisotropy, flipY, offset/repeat/rotation. It therefore cannot alter
a pixel. `envMap` is excluded — it is app-assigned and shared with the exterior,
and this pass must not reach outside the hall. Orphans are **disposed**, not
dereferenced: three frees a GL texture only on an explicit `dispose()`.

```
texture objects (the atlas)      7  ->  2
GL uploads of the atlas          4  ->  2       −42.7 MB resident
referenced texture payload   292.85 -> 170.19 MB  (−122.66)
distinct texture objects       118  ->  101
```

`MAT_Ceiling_Plaster_LM` declares no `texCoord` and keeps its own channel-0
texture. Whether that is right for the ceiling is an asset question — see §24.

**Proven visually identical** on three time-pinned runs with camera poses
matching to three decimals: the largest interior difference is **eight pixels
out of 1.28 million** above 8/255, peak 23. Two interior frames differ in zero.

**The ember field was different on every page load.** `Motes` built 2,400 points
from unseeded `Math.random()`. With the pose identical to three decimals and the
capture clock pinned, two loads of the same build still differed by mean 0.045
with 2,945 pixels above 8/255 and peaks of 146. That noise floor is larger than
most changes worth measuring — it hid real differences and manufactured false
ones, flagging this hall-only change as a regression on an exterior frame.

Now seeded (mulberry32, fixed seed): same expressions, same ranges, same low
bias, so the field reads exactly as before. Verified directly rather than by
pixels — the first ember's position is identical to four decimals across loads.
`Constellation.tsx` had already made this choice and says so; this brings the
ember field into line.

### 5.2 `89b234b` — URL synchronization

The film had nine chapters and never touched history.

**A fragment, not a path**, and that is the design decision. Writing `/about`
into the bar while the home page's DOM is on screen means the URL and the
document disagree: reload lands somewhere the visitor was not, a crawler indexes
the wrong markup, back restores a state that never existed. `#constellation` is
a real linkable address for a moment *inside* this document, costs no server
request, and — because each chapter section now carries the matching `id` —
degrades to a plain anchor with JavaScript off.

**`replaceState`, not `pushState`.** Nine chapters would otherwise become nine
history entries and back would step backwards through the film one chapter at a
time. It also buys restoration free: the bar always carries the chapter, so
returning through history returns to it.

**It lives in the page, not the canvas.** The canvas is client-only, tier-gated
and absent without WebGL or under reduced motion; all those visitors still
scroll and still deserve a working address.

Measured (`tools/capture/phase6_url.mjs`):

```
scroll -> URL      /  #constellation  #establish  #station-1..3  #portrait
document requests  0 across the walk
history entries    0 added
back at the top    fragment shed; bar reads `/`
deep links         landed at scrollY 4363 / 8771 / 12570
                   against section tops 4364 / 8771 / 12570
reduced motion     establish and station-3 land exactly, no Lenis
unknown fragment   inert
console errors     0
```

### 5.3 `3b0a2aa` — the route veil

The existing veil covers only the **scroll crossover**, inside the canvas, on
the home page. Every actual navigation had no visual bridge.

`RouteVeil` is DOM, mounted in the `(site)` layout, because it must survive
navigations that unmount the canvas entirely — `/projects` is outside the
`(experience)` segment — and must exist on pages that never had one. Holograms
go through the same device via `veiledPush`, so a hologram and the link beneath
it do not dissolve differently.

**Everything is biased toward "navigation works" over "navigation is pretty":**
the veil opens on a watchdog regardless; anything it cannot classify
confidently — modifier clicks, `target`, `download`, `/api/`, cross-origin,
same-page fragments — falls through to the browser; reduced motion skips the
dissolve but still navigates client-side.

**A real bug this exposed.** Clicking a project card from a station chapter left
the visitor on `/` with the bar reading `/#station-1` and the veil shut until
the watchdog fired — the navigation did not happen. `ChapterUrl`'s 180 ms settle
timer had fired *inside* the router's push and `replaceState`'d the address out
from under it. The App Router reconciles against `window.history`, so a second
writer during a push loses the navigation. `ChapterUrl` now stands down on a
link click to a different path, on a committed path change, and on
`isNavigating()` — the last covering what a click listener cannot see, a
programmatic push.

**A reduced-motion defect fixed before it shipped.** The first version registered
the controller only when motion was allowed, leaving `veiledPush` with no router
and sending those visitors through `window.location.assign` — a full document
load that tears down the context and re-parses both models.

Measured against a clean production build (`tools/capture/phase6_veil.mjs`):

```
veil closes to        opacity 1.00 (polled peak, not a single sample)
Tier1 -> Tier1        /about -> /why-us, SAME canvas element survives
Tier1 -> Tier2        / -> /projects/kartikeya-water-front
Tier2 -> Tier2        -> /downloads
in-page fragment      does not veil
ctrl-click            not intercepted
reduced motion        navigates, canvas survives, no dissolve
document requests     0 on every one
console errors        0
```

One transition, sampled every 150 ms: click 13.61 s, closed 13.93 s, route
committed 14.27 s, open 14.58 s — **~970 ms** against the ~680 ms target, the
difference being the RSC fetch it exists to hide.

### 5.4 `da8654d` — resume, and the departure fade

**Resume.** The chapter is remembered in `sessionStorage` and offered back in
the header — but only when the visitor is off the film **and** this session has
reached a chapter. A permanent button would be a fifth item in a header that
deliberately carries four, and on a first visit a second home link in costume.
`sessionStorage`, not `localStorage`: this is one visit's position in one film.
Every access is wrapped, because Safari private mode throws rather than
returning null.

```
fresh session, off the film    absent
on the film                    absent
after watching, off the film   present, href "/#station-2"
                               "[<- The residence] - resume at the tables"
following it                   scrollY 10038 vs station-2's offsetTop 10037
```

**The departure fade.** The header is `bg-[#0A1120]/72` with a backdrop blur —
**translucent**. A chapter riding out of frame showed *through* it. On the
station chapters that content is a full-colour sanctioned layout plan:

```
scroll 0.10   21px of the hero h1, 9px of its eyebrow
scroll 0.70   23px of the Kartikeya plan, 15px of its heading
scroll 0.78   62px of the Lucky Garden plan — the whole bar height
scroll 0.87   62px of the VSR Gayatri plan
```

Separately, two chapters were legible at once at 0.60, 0.78 and 0.87 — which
`site-home`'s own comment says a full-viewport sticky pane *cannot* do. It can:
the pane shows one, but a tall pane's **content** overlaps the next chapter's on
the way past. One fade fixes both.

**A CSS mask was implemented first and does not work**, which is worth recording
because it looks correct and is cheaper. `mask-image` is anchored to the element
box: a `sticky top-0` pane is pinned at viewport 0 for most of its life so the
band lines up, but the moment it unsticks its box top goes negative and the fade
band travels off the top of the screen — gone exactly when needed. A scrim
cannot do it either: a gradient over the content is also over the canvas, since
the world sits at z-0 beneath the page at z-10.

**And the trigger comes from the content, not the pane.** The first working
version read the pane's rect, which looks equivalent and is not: a pinned pane's
top is a constant, so the fade derived from it was a constant. Caught before it
shipped — the constellation and the hall were both being drawn at **0.762
opacity at their held midpoints**, the thing the visitor was looking at.

```
every held chapter        opacity 1.000  (7 of 7)
chapters legible at once  1, everywhere
plan in the header band   0.000 at 0.70, 0.78 and 0.87
console errors            0
```

Two nonzero readings remain deliberately: 0.718 at 0.10 and 0.601 at 0.95, both
the departing chapter's own **text** while it is still the dominant thing on
screen and still being read.

### 5.5 `cb7a13f` — the E2E suite, memory, and Slice-0 removal

Covered in §21 and §19.

## 6. Camera system

**Unchanged.** `cameraPath.ts`, `interiorPath.ts`, `poses.ts` and `journey.ts`
were audited and left alone: they are already a typed flight-plan abstraction
with beats, targets, FOV warp, per-beat fog and a Catmull-Rom spline, tested by
29 unit tests and validated in Blender by `audit_camera_path.py`. Nothing in
Phase 6 justified touching them.

Every capture in this report is taken at a **settled** camera, and every settle
reports which test it passed (`onBeat` vs `asymptote`).

## 7. State system

**Unchanged.** `journeyState` is a module-level mutable object written once per
frame by `JourneyDriver` and read by everything else — one writer, many readers,
no allocation, no re-render. Zustand is used only for `sceneCards`. Phase 6
added one piece of session state (`residence.ts`) and it is deliberately outside
React's render path.

## 8. Route synchronization

See §5.2. Scroll → fragment, fragment → scroll, restoration across a Tier-2
excursion. Back/forward move between routes; chapters do not enter history.

## 9. Preloader

**Unchanged and correct.** Real `useProgress`, waits for `active` rather than
100%, monotonic peak so the counter never runs backwards, a 12 s ceiling and a
2.5 s idle failsafe so a scene that never arrives cannot lock the page shut. The
no-WebGL E2E case asserts that failsafe.

## 10. Exterior presentation

Phase 5's promoted `p5m`, unmodified. Verified live on the default route with no
query parameter.

## 11. Interior presentation

Audited, not redesigned. The lightmap duplication (§5.1) was the one defect
found and fixed. The interior's own art direction — flat, washed establishing
shot; blown-out hologram quads — is recorded in §23 as **assessed and not
addressed**, because fixing it is a lighting and material pass on a locked
asset, not a presentation-layer change, and §67 forbids starting it while
architecture was outstanding.

## 12. Project station system

**Unchanged.** Four pedestals in the GLB, N published projects, one component.
Data comes from `getPublishedProjects()` through the projection boundary;
nothing is fabricated. Three stations are lit because three projects are
published.

## 13. Hologram system

**Unchanged**, except that clicking one now goes through the route veil so it
matches a link click. The holograms carry the real sanctioned layout plans.

## 14. City transition

**NOT BUILT, and deliberately so.** There are no beacons, no city plane and no
dive. Building it means a new scene, real project centroids and a camera dive —
a large system, and §67 forbids starting it while the URL contract, the route
transition and a 42 MB memory defect were outstanding. It is the largest single
item in §23.

## 15. Capability tiers

**Unchanged.** `useDeviceTier` + `capability-probe.ts` drive dpr, antialias,
shadows, mote count, constellation density and the PostFX chain. Low tier keeps
vignette only.

## 16. Reduced motion

Lenis does not start; `CursorRing` does not mount; the veil does not dissolve
**but still navigates client-side** (§5.3). Deep links land exactly. Verified at
1440×900 with `prefers-reduced-motion: reduce`: 0 console errors, canvas
survives navigation, 0 document requests.

## 17. Mobile

390×844, 768×1024, 1440×900 all boot, scroll on a real wheel gesture, and show
no horizontal overflow. The scroll lock lifts on all three. 0 console errors on
each. The resume affordance moves into the mobile menu panel rather than
crowding a 390 px bar.

## 18. Accessibility

Existing and verified: the skip link is the first tab stop and **moves focus**
(not merely scrolls); the canvas is `aria-hidden` with every destination it can
reach present as a real link; the mobile menu traps and restores focus; the
consent panel is reachable.

Added: chapter sections are real anchors, so fragment addresses work with no
JavaScript; the resume link carries an `sr-only` clause naming what it resumes;
the veil is `aria-hidden` and only takes pointer events while shut.

## 19. Performance

Production build, `next start`, ANGLE / AMD Radeon / D3D11, 1440×900, dpr 1.

**Boot** — six alternating runs, median:

```
cold (cache cleared)   3145 ms   [3145, 3148, 3140]
warm                   3144 ms   [3144, 3137, 3149]
```

Cold and warm are **identical to within 1 ms**, and the spread across six runs
is ±6 ms. On localhost the boot is not network-bound at all: it is Draco decode,
KTX2 transcode and GPU upload, which the HTTP cache does not help. **3145 ms is
therefore a floor, not a visitor's number** — a real first visit adds ~33 MB of
download on top.

A first attempt reported cold 2085 ms and warm 3621 ms. Warm cannot be slower
than cold from caching, so that sample was measuring something else and was
discarded rather than published.

**Scene census, exterior hero:**

```
draw calls          955     (~483 meshes x 2 passes: shadow + colour)
triangles drawn     367,558
meshes              483, all visible
triangles in scene  186,007
material instances  16
textures            47 objects, 61.67 MB payload
geometries / GL textures / programs   387 / 62 / 16
lights              9, 1 shadow caster
```

These match Phase 5's promoted figures exactly (186,007 triangles, 16 materials,
61.65 MB), which is a useful cross-check that the promotion is what is running.

**Interior (scroll 0.87), both models resident:**

```
draw calls          155
triangles drawn     95,010
texture payload     170.19 MB   (was 292.85 before §5.1)
```

A first read of the exterior draw call returned `calls: 1, triangles: 1` — the
composer's final fullscreen quad, because `info.render` resets at the top of
every `render()`. Discarded and re-measured by identifying the world pass.

**Memory** — two laps of the loop that crosses the segment boundary, every hop a
**client** navigation (`tools/capture/phase6_memory.mjs`):

```
lap 2 against lap 1, same point in the cycle
  geometries    0
  textures      0
  programs      0
  canvases      0
  heap        +9 MB   (against +112 MB for lap 1's one-off cost)
  renderers   +1      one per round trip, by design

GLB requests across the whole run   2
console errors                      0
```

**No leak.** `/projects/<slug>` is outside `(experience)`, so leaving the film
unmounts the canvas and returning builds a new context — a real cost, paid once
and reclaimed, not accumulated. drei's module-level GLTF cache survives the
rebuild, which is why both models are fetched exactly once however many times
the world is torn down.

## 20. Visual regression

`tools/capture/phase6_audit.mjs` walks all nine chapters at a settled camera and
a **pinned animation clock**, and `imgdiff.py` compares any two sets against a
same-candidate control.

Two instrument corrections, both from wrong answers:

1. **A settled camera is not a settled frame.** Embers, constellation and
   turntable drift are time-driven. The first before/after diff was decided
   entirely by 350 ms of ember drift — the pre-change run settled at 1695 ms and
   the two post-change runs at 1327 and 1345 ms, so the two "same build" runs
   agreed far more closely than either agreed with the third. Captures are now
   pinned to a deadline, `lateBy` reports any shot that missed it, and the
   scene's own phase (ember `uTime`, turntable angle) is read at each shutter. A
   later run that missed every deadline differed from a good one by mean 16.2
   with 527,676 pixels above threshold, and was discarded on those numbers.

2. **`imgdiff.py`'s verdict was a pure ratio against the control**, which cannot
   return "identical" when the control is ~0 — exactly what a pinned capture of
   a static interior produces. It flagged four frames whose largest difference
   was eight pixels. It now has an absolute floor.

Final production captures are in `tools/capture/out6/`, all `lateBy: 0`.

## 21. Tests

**Existing, all still green:** typecheck 5/5; 188 domain + 30 db + 48 public =
**266** unit tests; lint 5/5 with 0 errors.

**Removed.** `e2e-slice0/persistence.spec.ts` was the experience's only test and
every case was dead: it read `persistence-probe` testids that live only in
`ExperienceCanvas.tsx` (a Slice-0 skeleton the app stopped importing when
`WorldCanvas` replaced it); it asserted headings `/about` and `/why-us` no
longer carry; and it counted rAF callbacks in a headless browser and called the
result "sustains 60fps on the reference machine". Deleted along with the
skeleton and its temporary config.

**Added.** `e2e-experience/experience.spec.ts` under its own config — own config
because the default installs a `globalSetup` that seeds fixture data into
whatever `DATABASE_URL` points at, locally the live projection. It runs against
`next start`, not `next dev`, because on the dev server a route's first
navigation pays for its webpack compile, which pushed a Tier-1→Tier-2 hop past
three seconds and tripped the veil's watchdog — the suite was reporting a veil
defect that was a compiler.

Twenty cases: home loads and boots WebGL; the page works with JavaScript
disabled; chapters are real anchors; the bar follows the film with zero document
requests and zero history entries; deep links land inside their chapter; an
unknown fragment is inert; the canvas survives in-segment navigation, back and
forward, proved by tagging the live element; the veil closes and reopens; a
fragment link does not veil; a project link reaches real HTML; the residence
link resumes and is absent when there is nothing to resume; the interior arms
before the crossover; dragging a table turns the table and neither the camera
nor the page; reduced motion still navigates client-side; a browser with no
WebGL gets the content and is not left scroll-locked; mobile scrolls without
overflow; Tier-2 pages keep their chrome; the contact form accepts typing; the
skip link is the first tab stop and moves focus; `/hall` stands.

Not covered, named rather than faked: **there are no project beacons and no city
scene, so there is no beacon-routing test to write.**

> **The suite has NOT been executed.** It typechecks and lints; it has not been
> run. `pnpm --filter @estate/public test:experience` against a production
> build. Until that passes, treat §21 as authored, not proven.

## 22. Build

Clean production build from a removed `.next`, twice. 33 static pages
generated. No hydration errors, no client/server boundary errors, no decoder
failures, no shader compile errors. Shared first-load JS 150 kB; `/site-home`
5.74 kB / 158 kB first load.

## 23. Known residuals

**Real, and not addressed:**

1. **The constellation chapter is the weakest composition in the film.** At
   scroll 0.32 the mansion has left frame entirely and a 2K photographic
   backdrop (`env_meadow_bg_2k.jpg` — a European hillside) fills 60 % of the
   frame, blurred by magnification, with the constellation reading as sparse
   orange specks against it. It is the one chapter where the world does not look
   expensive. Fixing it is an art-direction pass on the exterior beat and the
   backdrop, not a presentation-layer change.

2. **The interior establishing shot is flat and washed.** At 0.52 the room reads
   as untextured plaster with black voids where wall panels are and a blown-out
   white quad where a hologram is. The interior *is* well modelled — the
   staircase and portrait frames prove it — so this is lighting and material
   response, diagnosable but not diagnosed here.

3. **The hologram is a bright quad**, not a spatial object. §25 of the brief is
   explicit about this and it is unaddressed.

4. **No city / window / beacon scene** (§14).

5. **955 draw calls at the hero** — essentially one per mesh per pass, across a
   shadow pass and a colour pass, with no merging or instancing of 483 static
   meshes. A real optimisation opportunity in Phase 5's geometry.

6. **Leaving the film costs a full canvas rebuild.** `/projects` is outside
   `(experience)` by design; the rebuild is clean and leak-free, but it is
   seconds of Draco and KTX2 work. Moving `/projects` inside the segment would
   remove it and is a route-architecture decision, not a Phase 6 one.

7. **`sitemap.ts` still excludes `/about` and `/why-us`** as "unwritten". Both
   now carry researched copy. One-line fix; left because SEO exposure is the
   client's call.

8. **The E2E suite is unrun** (§21).

9. **`ChapterFade` writes opacity from a scroll-coalesced rAF** — ~30 rects and
   6 writes per frame on the main thread. Negligible against a 955-call frame,
   but it is main-thread work that a `animation-timeline: view()` implementation
   would not need once browser support is universal.

**Assessed and deliberately not changed:**

- The `/projects`, `/book-a-site-visit` and `/sitemap` registry entries. They
  404 but are unreachable and already excluded from the sitemap.
- Fonts (Playfair, not Fraunces). The design system is coherent; changing it on
  a document's say-so would be churn.
- The places/surfaces model. It is a considered refinement of the node idea and
  its test defends it explicitly.

## 24. Blender handoff

**No consolidated handoff is required for the work done in Phase 6.** Everything
this phase needed was solvable at runtime or in the DOM.

**One candidate item, flagged rather than requested**, because it was found by
inspection and has not been visually confirmed as a defect:

> `MAT_Ceiling_Plaster_LM` in `interior_hall.glb` is the only one of the seven
> lightmapped materials whose `occlusionTexture` declares **no `texCoord`**. The
> other six declare `texCoord: 1`. glTF defaults an absent `texCoord` to 0, so
> the ceiling samples the 4096² lightmap atlas with UV0 — the tiling material
> UV — rather than the lightmap UV set. If that is unintended it is an export
> setting, and it is also why the ceiling keeps its own texture object rather
> than joining the merged one (§5.1). **Not changed here**: the interior is a
> locked asset and "the ceiling looks wrong" has not been established, only "the
> ceiling is wired differently from its six neighbours".

## 25. Final architecture

```
(site) layout ............ consent, header, footer, cursor, RouteVeil
  └ (experience) layout .. ExperienceCanvasHost  <- the persistent canvas
      ├ site-home ........ the film: 9 chapters, ChapterUrl, ChapterFade
      ├ about / why-us ... surfaces read from a held frame
      └ hall / etc.
  └ projects/[slug] ...... OUTSIDE the segment: canvas unmounts by design
```

One transition device (`RouteVeil`, DOM, watchdogged). One chapter registry
(`journey.chapters()`), feeding the camera, the section heights, the address bar
and the fade. One route registry (`places.ts`). One scroll driver.

## 26. Final recommendation

**Do not promote.** Phase 6 is not complete: the city layer does not exist, two
named art-direction problems are open, and the E2E suite is unrun.

What *is* done is safe to keep. Every change is measured, every measurement has
a stated control, and three of them corrected an earlier wrong answer rather
than shipping it. The architectural gaps the brief named — no URL contract, no
route transition, no way back into the film — are closed and proved. The one
significant performance defect found is fixed with 42.7 MB freed and a
pixel-level identity check behind it.

The next session should, in order: run the E2E suite; fix the constellation
composition; diagnose the interior lighting; then decide whether the city layer
is worth its cost.
