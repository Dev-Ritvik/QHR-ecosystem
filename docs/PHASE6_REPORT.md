# PHASE 6 — THE CINEMATIC PRESENTATION LAYER

**Status: COMPLETE**, as of the Phase 6B completion pass recorded in PART TWO
below, and independently re-verified against `846b029` in PART THREE. Jump to
§6B.29 for the verdict, §6B.28 for what is genuinely still open, and §6B.31 for
Part Two's claims re-measured with different instruments — including the four
places where Part Two's prose is corrected (§6B.34) and the one defect the
re-check found (§6B.33).

PART ONE is the AUDIT pass and is left exactly as it was written. Its verdict —
NOT COMPLETE — was correct at the time and is superseded, not corrected: every
item it left open is closed in Part Two, and where Part Two found Part One's
diagnosis to be wrong it says so and gives the measurement.

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

---

# PART TWO — PHASE 6B: THE COMPLETION PASS

**Status: COMPLETE.** Every system the Phase 6 report named as missing is built,
measured and tested. The E2E suite has been executed and passes 27/27 against a
production build. What remains open is listed in §6B.28 and is limitation rather
than omission.

Part One above is left exactly as written. It is the record of the audit pass
and its verdict was correct at the time.

## 6B.1 Starting HEAD

```
6003712  docs(phase6): the report, the FIXLOG entry, and the final production captures
```

Branch `main`, working tree clean apart from a line-ending-only difference in
`apps/public/next.config.mjs` (empty diff; left untouched).

## 6B.2 Final HEAD

```
b655f0b  fix(phase6b): fit the district field and its copy to a phone
```

## 6B.3 Commits

```
f47aed7  fix(phase6b): run the suite for real, and fix the three things it caught
7867082  feat(phase6b): put the residence back in the constellation chapter, and let evening fall
bbbffa2  feat(phase6b): give the hall a shot, a hierarchy, and light on the third of it the bake never reached
cf6ad81  feat(phase6b): the hologram stops being a lightbox and becomes a site model
0bf01c8  feat(phase6b): the film leaves the house — a district field beyond the threshold
99aee6f  feat(phase6b): selecting a beacon dives toward it and hands over to the veil
429f058  test(phase6b): fix three suite failures at their causes, not at their assertions
bfb8cbc  perf(phase6b): merge the static masonry — 955 draw calls to 233, pixel for pixel
b655f0b  fix(phase6b): fit the district field and its copy to a phone
```

Nine commits, no history rewritten, nothing force-pushed, nothing pushed at all.

## 6B.4 Files changed

21 files under `apps/public/`, +3,171 / −176 lines. New: `CityField.tsx`,
`cityLayout.ts`, `cityLayout.test.ts`, `dive.ts`, `CityLink.tsx`. New tools:
`frame_probe.mjs`, `frame_solve.mjs`, `whatis.mjs`, `station_sweep.mjs`,
`geometry_census.mjs`.

## 6B.5 Systems implemented

| system | state |
| --- | --- |
| E2E suite executed | 27/27 against `next start` |
| Constellation composition | rebuilt — sphere over the spire, camera cranes, evening falls |
| Interior establishing shot | re-posed off-axis, portrait lit, unbaked surfaces given an environment |
| Hologram | rebuilt as a solid extruded site model on an alpha-masked plan |
| City / district field | built — ground, contours, district bands, beacons |
| Project beacons | built — three, derived from published data, routed to real pages |
| Camera dive | built — 620 ms, handing over to the existing route veil at 300 ms |
| Performance | 955 → 233 draw calls at the hero, pixel-identical |
| Responsive | field and copy fitted to 390 / 768 / 1440 |

## 6B.6 Systems deliberately left unchanged

The promoted exterior model and every Phase 5 material decision; the roof,
paving, kerbs and terrain; the hero, quarter and three-quarter camera beats;
the daylight grade at those beats; the dusk rollback; the URL contract; the
route veil; the resume affordance; the chapter fade; the lightmap deduplication;
deterministic Motes; the WebGL fallback; the capability tiers; `places.ts`.

## 6B.7 Visual problems found

1. **The constellation chapter had no scene in it.** Photographed on the
   shipped build: `mansion_walls` coverage **0.000** from scroll 0.285 onward,
   **4 draw calls** at the constellation against 955 at the hero, sky share
   **64.4 %** rising to 68.3 %. What remained in shot was a terrain plane, a
   stock equirect meadow and a point cloud.
2. **The constellation was never seen at full strength.** Its reveal ramp
   reached 1.0 at legProgress 0.92; the crossover veil starts closing at 0.922.
   Measured: reveal **0.215** at the chapter's opening, **0.726** at its
   midpoint, 0.977 four fifths through.
3. **The interior establishing shot stood on the room's axis of symmetry** —
   both side walls at the same angle and the same value, no foreground, no
   convergence. It was not, however, low on dynamic range: mean 57.6, p05 13.8,
   p95 120.6, 0.2 % crushed. Range is not structure.
4. **The focal hierarchy was inverted.** Region means in that frame: left wall
   99.8, balustrade 89.5, right wall 80.3, **portrait 56.2**, floor 26.3. The
   brightest thing in the shot was the wallpaper and the founder's portrait
   rendered darker than the plaster it hangs on.
5. **A third of the room receives no baked light.** MAT_Trim_Cream 216
   primitives with 0 UV1, MAT_Gold 46, MAT_Wood_Dark 18, MAT_MarbleFloor 2, the
   rug 2 — lit by `ambientLight 0.12` and nothing else. Unlit metal reflects
   nothing and renders black.
6. **The hologram emitted the sheet's PAPER.** 60–89 % of each plan texture is
   transparent — the artist masked the paper out in alpha — and nothing read
   that mask, so the plate emitted the brightest and largest part of the sheet.
7. **Additive overdraw** stacked a hundred plot volumes into a flat white sheet
   from the second station's lower vantage.
8. **Two thirds of the beacons were off screen on a phone** — the vertical fov
   gives a 3.5× narrower horizontal cone at 390×844.
9. **One beacon sat behind the chapter's own copy column**, so a click on it
   landed on the list rather than the scene, for a test and a visitor alike.

## 6B.8 Visual problems fixed

All nine. Measured after:

| measurement | before | after |
| --- | --- | --- |
| mansion on screen at the constellation | 0.000 | in frame, 46 % of frame width |
| draw calls at the constellation | 4 | 246 |
| sky share of frame | 64.4 % | 45.9 % |
| sky mean at the last held frame | 111.8 | 32.2 |
| brightest constellation pixel | 187 | 209 |
| peak-over-sky contrast | 1.67× | 6.5× |
| constellation reveal at its chapter midpoint | 0.726 | 1.000 |
| portrait face vs plaster beside it | 73.1 vs 106.2 | 126.2 vs 108.0 |
| gold in the establishing frame | 83.9 | 103.5 |
| crushed pixels in that frame | 0.22 % | 0.02 % |
| station draw calls (S1/S2/S3) | 72 / 66 / 81 | 70 / 64 / 79 |
| station triangles | 23,752 / 21,328 / 33,840 | 17,750 / 15,458 / 25,652 |

## 6B.9 City architecture

The region is revealed **through the entry doors**, because the hall has no
window: parsed from `interior_hall.glb`, 545 nodes, and the only aperture in the
shell is `int_door_arch` with `int_doors` in it at z 5.25 on the entry axis.

The hall also has no HOLE in it — the arch and the doors are decorative panels
on the face of a solid wall, which a raycast through the threshold frame proved
by returning `int_wall_front` dead centre at 3.69 m. So the wall opens: a clone
of its material discards fragments inside the doorway's own measured rectangle,
and the rectangle widens from the centre line as the chapter arrives. Both that
material and the doors' are cloned for their one mesh — the plaster is on 22
primitives and the dark wood on 18.

The field itself is **abstracted architectural cartography**: one two-triangle
ground quad carrying its relief, its contour lines and its district boundary
entirely in a fragment shader, with instanced shafts and a point cloud of heads
above it. Contours use `fwidth` so a line is one pixel wide at the threshold and
one pixel wide at the horizon; the ground fades to the film's own night in depth
and across width so its finite edge is never seen — the lesson the exterior's
terrain edge taught in Part One.

**Four draw calls, whatever publishes.** Measured at the threshold beat: 20
calls and 4,554 triangles for the whole frame, field and room together.

## 6B.10 Beacon data source

`projection.projects_pub`, read through the same store the hologram tables bind
to. Queried live against the projection this build talks to:

| slug | name | locality | district | total | available | centroid | bbox |
| --- | --- | --- | --- | --- | --- | --- | --- |
| kartikeya-water-front | Kartikeya Water Front | Poosapatirega | Vizianagaram | 113 | 113 | NULL | NULL |
| lucky-garden | Lucky Garden | Kumaram Village, Garividi | Vizianagaram | 181 | 118 | NULL | NULL |
| vsr-gayatri-township | VSR Gayatri Township | Bayyannapeta, near Allinagaram | Srikakulam | 113 | 113 | NULL | NULL |

`projection.geometry_pub` 0 rows. `projection.pois_pub` 0 rows.
`projection.units_pub` 407 rows — which is 113 + 181 + 113, and matches the
constellation chapter's own "PLOTS 407 / OPEN 344".

## 6B.11 Coordinate derivation

**There are no coordinates, so none are used.** Every published project has
`centroid` NULL and `bbox` NULL. There is nothing to project, no datum to choose
and no scale bar to draw, and any "map" of these three would be three dots
invented by whoever wrote the code.

`cityLayout.ts` derives positions from what is real:

* **district** (`projects_pub.city`) → which horizontal band a beacon sits in;
* **publication order** → which band comes first, left to right;
* **slug** → a 32-bit FNV-1a hash, two independent draws, deciding where inside
  its band a project sits;
* **totalUnits** → the beacon's SIZE. 181 against 113 is the data's ratio;
* **availableUnits** → its state, and the DOM's "118 of 181 plots open";
* **locality** → the label.

Collision handling is four fixed relaxation passes with a clamp back into the
band — fixed passes rather than "until settled", because a convergence loop
depends on floating-point ordering and that is exactly what reshuffles a layout
between machines.

The representation is **explicitly abstract and says so on the page**: "Positions
in the scene are a diagram of the network, not a map: the district is real, the
plot counts are real, and the place on the ground is not published." An E2E case
asserts that sentence is present.

`fromCentroids()` is left as a named seam for the day the data supports a real
projection.

Ten unit tests hold the derivation: deterministic across calls, independent of
input order, every district in its own band, every beacon inside the frame, no
two closer than 6 m, weights matching the real unit counts, and it still holds
at 24 projects across 3 districts.

## 6B.12 Camera dive architecture

`dive.ts`. A module-level mutable object read once per frame by the rig — the
same construction as `journeyState`, for the same reason.

* travels for **620 ms**, asks the veil to close at **300 ms**, so the last
  stretch of movement happens behind a closing screen rather than on a held
  frame;
* leaves from where the camera **actually is**, read off the live camera at the
  instant of the click;
* aims at a **stand-off** short of the marker — arriving inside a point sprite
  means arriving inside nothing;
* writes the rig's `desired`/`look`, so the film's own damping carries it —
  except that a dive overrides the 3.1 s scrub with a 0.11 s constant, because
  measured at the film's own lag the camera travelled 9 % of the way before the
  veil closed;
* **interruptible**: any wheel, touch or key cancels it, and it is cancelled on
  unmount;
* under **reduced motion** it does not run at all and the route is taken
  immediately.

It is not a second transition device. Selecting a marker and clicking that
project's link in the copy beside it end in the same veiled client-side push.

## 6B.13 Route behaviour

Unchanged from Part One, and re-proved. Chapters are fragments; projects are
routes. In-page fragments do not veil; project navigation does. The city chapter
adds `#city` to the same registry. Measured in this pass: **zero document
requests** for a beacon selection and for a reduced-motion list click, and back
from a project lands on the film.

## 6B.14 Reduced-motion behaviour

No dive; the route is taken immediately. The veil does not dissolve but still
routes client-side. Two E2E cases cover it, both passing: `reduced motion still
navigates and still reads` and `reduced motion routes from a marker with no
camera animation`, the latter asserting **zero document requests**.

**Superseded:** the second case never touched a marker — it clicks the chapter's
DOM list link — and is now titled `reduced motion routes from the chapter list
with no camera animation`. Its assertions are unchanged. The marker path under
reduced motion is measured in §6B.34.3 and is correct.

## 6B.15 Accessibility behaviour

**The list is the interactive layer; the beacon is its rendering.** The canvas is
`aria-hidden`, so the markers are deliberately NOT focusable — putting a
focusable control inside an aria-hidden subtree is not an accessibility win, it
is a defect: the focus ring lands somewhere the accessibility tree says does not
exist.

So the city chapter's copy carries every published project as a real `<Link>`
with its locality, its district and its plot counts, in the same order, and
focusing or hovering one **lifts its marker in the field**. Keyboard visitors
get the identical destination, the identical transition and identical feedback.
An E2E case tabs to the first project and presses Enter.

The skip link remains the first tab stop; `keyboard navigation reaches the
content` still passes.

## 6B.16 Mobile behaviour

The field scales its spread toward its own centre line by the viewport's aspect.
The layout is untouched — which project sits in which band, and where inside it,
is still `cityLayout.ts` and still deterministic — but the arrangement is
reproduced at a smaller scale so it fits the frame. At 768×1024 all three
markers are in shot; at 390×844 two are, with the third inside the jamb.

The chapter's copy is stepped down on small screens: at the reduced measure the
block is 466 px inside an 844 px pane.

`mobile boots, scrolls, and does not overflow sideways` passes.

## 6B.17 Performance, before and after

Measured at the settled hero, 1440×900, production build:

| | before | after |
| --- | --- | --- |
| draw calls | 955 | **233** (−75.6 %) |
| visible meshes | 481 | 120 |
| drawn triangles | 367,558 | 367,558 |
| visible triangles | 185,367 | 185,367 |

The triangle counts are identical because nothing was simplified: the same
geometry is submitted in four buffers instead of 363.

The census decided the target. Three quarters of the meshes the hero draws were
static masonry sharing two materials, and the ashlar blocks carry **22 triangles
each**:

```
ashlar_NORTH  101/101    2,222 tris   MAT_Stone_Wall
ashlar_EAST    62/62     1,364        MAT_Stone_Wall
ashlar_WEST    62/62     1,364        MAT_Stone_Wall
ashlar_SOUTH   42/42       924        MAT_Stone_Wall
rustic_b/f/l/r 96/96    57,984        MAT_Stone_Rustic
```

Full film after the merge:

| frame | draw calls | triangles |
| --- | --- | --- |
| hero | 233 | 367,558 |
| revolution | 239 | 369,478 |
| turn | 244 | 368,488 |
| constellation | 246 | 369,128 |
| **establish** | **552** | **597,477** |
| station 1 / 2 / 3 | 70 / 64 / 79 | 17,750 / 15,458 / 25,652 |
| portrait | 126 | 75,982 |
| city | 20 | 4,554 |

The interior establishing shot is now the film's most expensive frame. It is not
optimised in this pass — see §6B.28.

## 6B.18 Memory

Not re-measured in this pass, and that is stated rather than implied. Part One's
measurement stands: two laps of the segment-crossing loop with every hop a
client navigation gave geometries 0, textures 0, programs 0, canvases 0 and heap
+9 MB against +112 MB for lap 1's one-off cost.

What this pass added is accounted for by construction rather than by
measurement: the district field disposes its four geometries and four materials
on unmount, the threshold's two cloned materials are disposed and their meshes'
originals restored, and the merged masonry geometries are disposed by the effect
that created them — while the originals are **removed from the graph and never
disposed**, because `scene.clone(true)` shares geometry with drei's cached parse
and disposing them would corrupt every later mount.

## 6B.19 E2E command

```
pnpm --filter @estate/public exec playwright test --config=playwright.experience.config.ts
```

Against `pnpm start` — a production build, not `next dev`.

## 6B.20 E2E actual result

```
27 passed (10.7m)
```

Six of those are new and cover the city contract:

* one marker per published project and no others — the count read from the DOM
  list rather than hardcoded;
* every listed project returns 200, so no beacon points at a 404;
* the chapter says in words that it is a diagram and not a map;
* a keyboard reaches a project without touching the scene;
* selecting a marker moves the camera more than 1.2 m before the veil closes,
  lands on that project's page, does it with **zero** document requests, and
  comes back coherently;
* reduced motion routes with no camera animation and still no document load.

## 6B.21 Production build result

```
✓ Compiled successfully
✓ Generating static pages (33/33)
```

## 6B.22 Typecheck result

`pnpm -r typecheck` — 5 of 5 workspaces, clean.

## 6B.23 Lint result

`pnpm -r lint` — 5 of 5 workspaces, **0 errors**. Warnings are the pre-existing
`<img>` and exhaustive-deps set recorded in Part One.

## 6B.24 Unit and integration test result

```
packages/domain   21 files   188 tests   passed
packages/db        4 files    30 tests   passed
apps/public        4 files    61 tests   passed
                              279 total
```

`apps/public` gains 13: ten for the city layout, and the shader scan extended to
`CityField.tsx`.

## 6B.25 Console error result

**Zero** across every capture run in this pass — the ten-frame desktop matrix,
the mobile and tablet runs, and every E2E case that watches for them.

## 6B.26 Document-request result

Zero for a beacon selection, zero for a reduced-motion list click, zero while
scrolling the film. Project pages are real routes and are reached client-side.

## 6B.27 Visual regression result

Ten frames captured at 1440×900 with the camera settled on its beat and the
scene clock pinned: hero, revolution, turn, constellation, establish, station 1,
station 2, station 3, portrait, city. All ten land on their authored pose; every
`lateBy` is inside its slot; zero console errors. Held at
`tools/capture/out6b/matrix-*.png`.

The masonry merge was checked against a **same-build control**, which is the
method Part One established this renderer needs:

| frame | control (same build, 2 runs) | candidate (before vs after) |
| --- | --- | --- |
| hero | mean 0.0260, >8 1434 | mean 0.0255, >8 1402 |
| turn | mean 0.0367, >8 1828 | mean 0.0307, >8 1476 |
| con-early | mean 0.1927, >8 15218 | mean 0.1919, >8 15143 |
| constellation | mean 0.4149, >8 25181 | mean 0.4324, >8 26240 |
| con-late | mean 0.4599, >8 26548 | mean 0.4645, >8 26762 |
| late | mean 0.4593, >8 26612 | mean 0.4664, >8 26903 |

Every frame is inside the build's own run-to-run repeatability. The ember field
moving between runs is a larger difference than the change under test.

The BEACON and DIVE rows of the brief's matrix are proved by measurement rather
than by a still: a hover is a per-marker uniform, and a dive is a camera
displacement. Both are asserted in the E2E suite.

## 6B.28 Known limitations

1. **The interior establishing shot is the film's most expensive frame** — 552
   draw calls and 597,477 triangles. The same merge that took the exterior from
   955 to 233 would very likely apply (MAT_Trim_Cream alone is 216 primitives),
   but the hall's geometry is looked up by name in more places than the
   exterior's — the turntables, the holograms, the doors, the front wall, the
   picture light — so it needs its own family analysis first, and
   `geometry_census.mjs` cannot currently provide one (see 2).
2. **`geometry_census.mjs` misreports on the interior leg.** At the hero it
   reads 481 meshes and 955 calls, matching `frame_probe` exactly; at the
   interior establishing beat it reads 8 meshes and 4 calls for a room with 545
   nodes. The scene it is handed there is the EffectComposer's, and neither a
   mesh-count filter nor picking the largest announced scene recovers the right
   one. The interior's draw cost in §6B.17 comes from `frame_probe`, which reads
   `gl.info` immediately after the world pass and is unaffected.
3. **The film's chapter fractions and the DOM's section offsets are close but
   not equal.** `chapters()` puts the constellation at 0.285–0.460 while its
   section sits at 0.311–0.502 at 1440×900 and 0.288–0.465 at 390×844. The
   camera and the copy therefore drift by a few percent, viewport-dependent,
   because the film's sections are sized in viewport heights while the page's
   tail is not. It is within a chapter's width everywhere measured and reads
   correctly, but it is a real coupling and the honest fix is to derive the
   journey's extent from the film's own measured height rather than from the
   `JOURNEY_END = 0.90` constant. Not attempted here: it touches the scroll
   mapping every other system reads.
4. **Each film section is only about 1.2 viewports tall**, so its sticky pane
   pins for roughly a fifth of a viewport and then rides up with the section. A
   chapter's copy is read at the START of that window. This is by design and
   works, but it makes the film sensitive to copy length — the city chapter
   needed a reduced measure on small screens to stay inside it.
5. **The equirect sky is a European alpine meadow.** It is Phase 5 material and
   is left alone, and the evening fall now takes it to a tenth of its luminance
   over the last exterior chapter — but at the hero it is still a photograph of
   somewhere that is not Vizianagaram.
6. **Two dark-wood dado panels read as voids** in the establishing frame at
   luma ~30 against plaster at ~100. Raycast to `MAT_Wood_Dark`, `lightMap`
   false, with a real base-colour map: authored dark wood, twelve of them around
   the room. Left alone deliberately — it is a design decision, not a defect.
7. **Memory was not re-measured** this pass. See §6B.18.
8. **The fourth station stays dark.** Three projects are published and there are
   four plinths. This is correct behaviour and is stated here so it is not read
   as a fault.

## 6B.29 Final verdict

**PHASE 6 COMPLETE.**

Every system the Phase 6 report named as missing exists, is derived from real
repository data, is covered by executed tests, and has a measurement behind each
claim made for it. The one performance opportunity the brief singled out is
taken, at 75.6 % of the frame's draw calls, with a same-build control proving
the picture did not change. The limitations above are named, quantified, and
none of them blocks a visitor from entering the residence, reading the film,
turning a table, opening a plan, walking out into the district and selecting a
project — with a keyboard, with reduced motion, or on a phone.

Nothing has been pushed. **Superseded:** that was true when this line was
written; `846b029` was pushed to `origin/main` on 2026-09-09, before the
verification below began. See §6B.37 for the current push status.

---

# PART THREE — INDEPENDENT VERIFICATION OF PART TWO

Part Two was re-checked against `846b029` on the instruction that it might be
wrong and that none of its measurements should be trusted. Nothing below is
quoted from it: every number was re-taken, and where the instrument that
produced the original figure could have been agreeing with itself, a different
instrument was written.

## 6B.30 What was re-measured, and with what

The capture tools in `tools/capture/` produced Part Two's figures, so they were
not used to confirm them. Two throwaway probes were written instead and kept out
of the repository:

* a draw-call probe that identifies the world pass by the presence of a mesh the
  **application named** (`int_`, `merged_`, `city_`, `beacon_`, …) rather than by
  a mesh-count threshold, and reads `gl.info` immediately after each render call.
  This is the failure `geometry_census.mjs` records in §6B.28.2 and it does not
  have it: it reports the interior correctly.
* a dispose probe that patches `dispose()` on the prototypes three actually
  handed out, marks every disposed resource, and then asks the **live scene
  graph** what it is still holding. Nothing else can see this class of fault —
  three re-uploads a disposed geometry and recompiles a disposed material on the
  next frame, so it produces no console error, no visual artefact and no change
  in `gl.info`.

## 6B.31 Result, claim by claim

| Part Two claim | independently measured | verdict |
| --- | --- | --- |
| E2E `27 passed` | **27 passed (10.3m)**, exit 0, `next start` | confirmed |
| build clean, 33/33 static pages | `✓ Compiled successfully`, `✓ 33/33`, exit 0 | confirmed |
| typecheck 5/5 | 5/5, exit 0 | confirmed |
| lint 5/5, 0 errors | 5/5, 0 errors, exit 0 | confirmed |
| 188 + 30 + 61 = 279 tests | 188 + 30 + 61 = **279** | confirmed |
| hero 233 calls / 367,558 tris | **233 / 367,558** | confirmed exactly |
| establish 552 calls / 597,477 tris | **553 / 597,489** | confirmed (one mote apart) |
| city 20 calls / 4,554 tris | **20 / 4,554** | confirmed exactly |
| one marker per published project | 3 markers, 3 list entries, same slugs | confirmed |
| every beacon routes to a real page | `/projects/{kartikeya-water-front, lucky-garden, vsr-gayatri-township}` → **200**; an unknown slug → 404 | confirmed |
| beacon weight is the real unit count | page renders 113/113, 118/181, 113/113 — the numbers `cityLayout.ts` documents | confirmed |
| mobile fits, no horizontal overflow | 390×844: `scrollWidth` 390 = `innerWidth` 390, zero overflowing elements at the city chapter | confirmed |
| the city copy is 466 px in an 844 px pane | ink **466 px**, pane **844 px** | confirmed exactly |
| §6B.28.4 — a chapter is read at the START of its pin window | swept the whole section: readable at 390×844 across frac **0.828–0.866** (3/3 links in frame), at 1440×900 across **0.904–0.928**; unreadable at the section midpoint in both | confirmed, including the failure it predicts |

The one figure Part Two did not put a measurement behind is now measured.

## 6B.32 Memory, measured

§6B.18 declined to re-measure and rested on "accounted for by construction".
Three laps of the hardest available loop — film → hall → district field → select
a beacon → project page (which is outside `(experience)`, so the entire canvas is
torn down) → back → film:

| | geometries | textures | programs | canvases | heap |
| --- | --- | --- | --- | --- | --- |
| lap 1 | 390 | 101 | 58 | 1 | 230 MB |
| lap 2 | 134 | 62 | 20 | 1 | 232 MB |
| lap 3 | 134 | 62 | 20 | 1 | 234 MB |

Flat from lap 2. Lap 1 is the one-off cost of a first load with both models
resident. One canvas throughout, so no WebGL context is leaked across teardown;
+2 MB of heap per lap is ordinary churn against a 230 MB working set. **The
construction argument holds, and now has a number behind it.**

## 6B.33 The one defect the verification found

**`CityField` disposed live GPU resources on every viewport aspect change.**

Its six memoized resources shared one cleanup with all six in the dependency
array, and they are not replaced together: `spread` is a function of aspect, so a
resize rebuilds the beacon head geometry and the ground material while the ground
geometry, the shaft geometry and two materials keep their identity — and were
disposed anyway, still in the scene and still being drawn.

Measured with the dispose probe, one aspect change:

```
before   6 dispose() calls, 4 STILL IN THE SCENE and visible:
           city_ground   geometry PlaneGeometry
           city_shafts   geometry CylinderGeometry
           city_shafts   material ShaderMaterial
           city_beacons  material ShaderMaterial
         a second resize took city_ground's geometry to its THIRD disposal
after    2 dispose() calls — exactly the two resources being replaced —
         and 0 still in the scene
```

It was invisible by every other means: three re-uploads the geometry from its
attributes and recompiles the program on the next frame, so the cost was a
shader recompile and a buffer re-upload per resize rather than a missing frame.
Fixed by giving each resource its own effect and its own dependency, so a
resource is released exactly when it is replaced. Every one is still released on
unmount.

## 6B.34 Corrections to Part Two

1. **§6B.18 says the district field "disposes its four geometries and four
   materials".** It disposed three of each explicitly; the invisible pointer
   proxies' geometry and material are created in JSX and released by
   react-three-fiber. After §6B.33 it is six one-line effects. The count was
   wrong in a paragraph arguing that the accounting was right, which is the
   reason §6B.32 exists.
2. **`cityLayout.ts`'s `FIELD` comment says the band is "20..54 and +/-15".** The
   code is `near: 24, far: 56`. The reasoning in that comment is sound and the
   values it argues for are not the values below it. Left as found — it changes
   no behaviour and correcting prose was out of this pass's scope — but it should
   not be read as a measurement.
3. **The E2E case named "reduced motion routes from a marker with no camera
   animation" does not touch a marker** — it clicks the chapter's DOM list link,
   as its own comment says. The list path is genuinely covered; the marker path
   under reduced motion (`startDive` returning false, the caller routing at once)
   is asserted nowhere in the suite. So it was measured directly for this pass,
   projecting a beacon through the live camera and clicking it at the same point
   under both settings:

   | | max camera displacement | destination | document requests |
   | --- | --- | --- | --- |
   | reduced motion | **0.237 m** | `/projects/kartikeya-water-front` | 0 |
   | motion allowed | **25.386 m** | same | 0 |

   0.237 m is pointer parallax, which the suite itself bounds at ~0.42 m. **The
   behaviour is correct**; it was the coverage claim in §6B.20's last bullet
   that was not. **Fixed here:** the case is now titled *"reduced motion routes
   from the chapter list with no camera animation"*, which is what it clicks,
   and its comment names the marker path as measured-but-unasserted. The
   assertions are untouched — the title was the false part, not the test.
4. **§6B.29 ends "Nothing has been pushed."** `846b029` was pushed to
   `origin/main` before this verification began.

## 6B.35 What was checked and found NOT to be a defect

* **The masonry merge is not idempotent across an effect re-run** — the originals
  are removed from the graph on the first pass, so a second pass has nothing to
  merge, and `applyGrade`'s paving pass would then miss the 96 `rustic_*` blocks
  it looks up by name. Reachability was measured rather than argued:
  `[exterior_batched]` logs **once** on `/` and **once** on `/?grade=dusk`
  (merged=2, meshesRemoved=363, 231 calls / 367,534 triangles at dusk), because
  `ExteriorModel` suspends on its GLB and does not commit until after `useLook`
  has already settled the grade. Latent, not live. **Not changed** — the fix is a
  re-entrancy guard on a path nothing reaches, and this pass was not scoped to
  add one.
* **A scroll or keypress cancels a dive but not the navigation it started.**
  `select()` schedules `onOpen` at 300 ms and `cancelDive` only stops the camera.
  Reading the comment as scoped to the camera, this is as designed: the click was
  a decision to navigate.
* **The `?grade=dusk` frame** — 231 calls / 367,534 triangles, within two motes
  of daylight's 233 / 367,558. The merge serves both grades.

## 6B.36 Verdict of the verification pass

Part Two's acceptance claims are **accurate**. Every headline number reproduced,
two of them exactly; the establishing frame differs by one draw call and twelve
triangles, which is the ember field between two runs. The suite runs and passes
as reported. One genuine defect was found in the memory lifecycle — the one area
Part Two argued for instead of measuring — and it is fixed and re-measured. Four
statements in Part Two's prose are corrected above; none of them changes a
verdict.

Regression after the fix, on a fresh production build: typecheck **5/5**, lint
**5/5 / 0 errors**, **279** unit tests, `✓ Compiled successfully` / `✓ 33/33`,
and the experience suite **27 passed** against `next start` — the same 27 that
passed before it, run twice at 10.1m and once at 15.8m.

**The suite is sensitive to the machine it runs on, and that is worth recording
rather than hiding.** One run in the middle of this pass returned 24/27 with the
host down to **1.0 GB of free RAM**: two failures were unambiguous environment
(`net::ERR_NETWORK_CHANGED`, and a page closed under it) and the third was
`follows the film without a request or a history entry` hitting its 120 s cap.
That case walks every chapter through a settle wait and spends **1.9m of its 2m
budget** even on a clean run, so it has almost no headroom. With memory freed it
passes. Not changed here — raising a timeout to buy margin is exactly the kind
of edit that makes a suite stop reporting — but anyone who sees it fail should
check free memory before reading it as a regression.

**PART TWO'S VERDICT STANDS. PHASE 6 COMPLETE.**

## 6B.37 Push status

Stated accurately here because §6B.29 got it wrong the moment the branch moved,
and because "nothing has been pushed" is the kind of line that is true for
exactly as long as nobody reads it.

| | |
| --- | --- |
| `846b029` — the Phase 6B completion pass | pushed to `origin/main`, 2026-09-09 |
| this correction set — the `CityField` lifecycle fix, PART THREE, the four prose corrections and the E2E title | pushed to `origin/main` in the same operation that recorded this line |

Branch `main`, remote `origin` = `github.com/Dev-Ritvik/QHR-ecosystem`. The only
thing left in the working tree afterwards is a **zero-byte line-ending
difference** on `apps/public/next.config.mjs` that predates both passes and is
deliberately not committed by either.
