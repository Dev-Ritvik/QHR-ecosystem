# THE MONOLITH AT DUSK — MASTER BUILD SPECIFICATION

**Version** 1.0.0 · **Status** Contract · **Supersedes** all 11 source documents
**Constraint** ₹50,00,000 build · **Target** Awwwards SOTD → SOTM → SOTY + Developer Award

---

## 0. HOW TO READ THIS

This document is the **single source of truth**. The eleven source documents
(`Routing Arch.md`, `ACT_01`–`ACT_4`, `PHASE_5`–`PHASE_7`, and the three
`LLM COUNCIL/` transcripts) are now **historical provenance only**. Where they
disagree — and they disagree in seventeen places — this document rules.

Every ruling below that overrides a source document is marked **[RESOLVED §n]**
and traced in Appendix A.

Three rules for anyone touching this build:

1. **A number that appears in §3 (The Continuity Table) may not be redefined
   anywhere else.** Not in a component, not in a shader, not in a second doc.
2. **If you find a conflict this document does not resolve, stop and escalate.**
   Do not pick one. Every conflict resolved silently in the source material is
   how a build ends up with two cameras.
3. **No second `requestAnimationFrame`. Ever.** See §4.3.

---

## 1. THE AWARD THESIS

We are not optimising for "looks impressive." We are optimising against a
published rubric. Awwwards SOTD is scored:

| Criterion | Weight | Where cinematic WebGL sites usually lose |
|---|---|---|
| **Design** | 40% | Rarely — this is the easy 40% |
| **Usability** | 30% | **Here.** Most WebGL showcases score 6.0–7.0. Scroll-jacking, no keyboard path, broken mobile, no reduced-motion. |
| **Creativity** | 20% | Rarely |
| **Content** | 10% | Thin or placeholder copy |

**SOTM is voted from SOTD winners. SOTY is voted from SOTM winners.** So the
entire funnel is gated on one SOTD win at a score high enough to be
month-competitive. A site scoring 9.0 on design and 6.5 on usability lands around
7.9 and never leaves the honourable-mention pile.

**Therefore the strategic bet of this build is: win on the 30% everyone else
concedes.** Full keyboard traversal, a genuine reduced-motion path, real mobile
parity, and a no-WebGL fallback that is a legitimate document rather than an
apology. Sections §9 and §10 are not compliance chores — they are the
competitive strategy.

### The Developer Award

Judged separately, on technical merit a jury can *point at*. We ship four things
designed to be pointed at:

1. **Provably seamless freeze** (§4.5) — the freeze and the frame-capture fire on
   the same `onAfterRender` tick, so the crossfade dissolves an image into a
   pixel-identical copy of itself. Seamlessness by construction, not by timing.
2. **One clock** (§4.3) — GSAP ticker drives Lenis drives `invalidate()`. Zero
   competing rAF loops anywhere in the application.
3. **Procedural everything** — no HDRI, no `.mp3`, no water textures. Sky, water,
   caustics and the entire acoustic bed are synthesised. Total media payload
   under 2 MB.
4. **Tier D** (§9.3) — the no-WebGL path renders the same content as a typeset
   architectural document. Not a degradation; a second designed artefact.

### The Content Resolution — [DECIDED] · GROUNDED IN THE REAL INVENTORY

**The three live projects, read from the client's own brochures:**

| Project | Location | Product | Approval | Site features |
|---|---|---|---|---|
| **Kartikeya Water Front** | Poosapatirega, Vizianagaram | Residential plots 30×50, 30×56, 30×60 (~101) | VMRDA / RERA | **A real lake on site.** Swimming pool, cricket nets, basketball, jogging track, model duplex villa, future commercial zone |
| **VSR Gayatri Township** | Bayyannapeta, Pedaraopalle, nr Allinagaram, Srikakulam | Residential plots | SUDA F.L.P. 10/2025/1178/DTCP/DPMS | 2 km from NH-16; ringed by RGUKT IIIT, Ambedkar University, 8+ colleges |
| **Lucky Garden** | Kumaram Village, Garividi, Vizianagaram | **Farmland / plantation plots** (~189 + future extension + resort zone) | — | Avocado, mango, sapota, lemon, mahogany. Duck pond, goshala, meditation mandir, club house |

**This is a better story than the fiction, and it is free.** Four rulings follow.

**① Act I is the CORRIDOR, not an abstract void.** All three projects sit inside
one geography: the Visakhapatnam–Vizianagaram–Srikakulam belt, oriented on NH-16
/ AH-16, converging on **Bhogapuram International Airport** and the new Super
Smelters steel plant at Garividi (1,085 acres, ₹8,570 cr, 2 MT capacity, ~750
jobs). That corridor *is* the investment thesis the company already sells. The
drop descends through it — coast, highway, airport, then one project. Specific,
verifiable, and no competitor can copy it because it is their actual ground.

**② Act II's water is real.** Kartikeya has a lake — the project is literally
named Water Front — and Lucky Garden has a duck pond. Every Gerstner / caustics /
Fresnel / acoustic ruling in the source docs survives intact, and the subject
stops being an invented infinity pool.

**③ Act III is the MODEL DUPLEX VILLA, not a fictional sanctuary.** Kartikeya
lists "Elegant Model Duplex Villa" as a project highlight. This is exactly the
real sales journey: land → your plot → the house you will build on it. The breach
through glass now depicts the moment a buyer walks into the show home. Honest,
and it keeps the entire Act III threshold machinery.

**④ Plantation rows are Act II geometry, not decoration.** Lucky Garden's value
proposition is yield — avocado at ~₹400/kg, mahogany at 20–25 cu ft per tree. The
orbit should pass over planted rows, because the rows *are* the product.

| Act | Scale | Real subject |
|---|---|---|
| I · The Corridor | Region → district | Coast, NH-16, Bhogapuram airport, the steel plant |
| II · The Land | District → parcel | Plotting grid, the lake, plantation rows |
| III · The Threshold | Parcel → building | The model duplex villa |
| IV · The Standoff | Building → decision | Acquisition |

**⑤ Approvals are content, not fine print.** VMRDA/RERA, SUDA F.L.P.
10/2025/1178/DTCP/DPMS — in this market the approval number *is* the trust
signal, and it is the single most checkable fact on the page. Set it in the
spatial typography layer, not the footer.

**Schema note — now confirmed.** `core.asset_class` is `['land', 'commercial',
'luxury_residential']`, and Lucky Garden (agricultural plantation, goshala,
resort zone) and Kartikeya (approved residential plotted) both collapse into
`land`. They are visibly different products and Act II must distinguish them.
`commercial` is also real, not hypothetical — Kartikeya has a Future Commercial
Zone and Lucky Garden a Resort zone. **See §13.5a.**

---

## 2. NON-NEGOTIABLE LAWS

| # | Law | Consequence if broken |
|---|---|---|
| L1 | One `requestAnimationFrame` in the entire app, owned by `gsap.ticker` | Canvas lags DOM by one frame, intermittently. Reads as "floaty." |
| L2 | `q` (0→1) is the only narrative variable. GSAP never tweens camera coordinates. | Acts stop being continuous; every boundary snaps. |
| L3 | The `<Canvas>` mounts exactly once, in `(experience)/layout.tsx`. Never in `template.tsx`. | Context recreation, VRAM dump, full reload cost on every navigation. |
| L4 | Server Components never touch 3D state. Bridges `return null`. | Hydration mismatch. |
| L5 | Zustand holds camera **intent**, never the Three.js camera object. | Store becomes non-serialisable; React and Three fight over one mutable object. |
| L6 | Freeze and capture fire on the same `onAfterRender` tick. | Crossfade pops, intermittently. Passes QA nine times, fails the tenth. |
| L7 | ≥ 2% of **viewing distance** covered per 5% of scroll, outside the designed pause (§3.4). | Motion reads as frozen. See Appendix B. |
| L8 | Max 4 dynamic lights, < 100 draw calls, at all times. | Mobile tiers fall off the 60 fps target. |
| L9 | Nothing non-essential loads before consent resolves. | DPDP / GDPR exposure. |
| L10 | Every Act must be legible with `prefers-reduced-motion: reduce`. | Usability score collapse — the 30% we are betting on. |

---

## 3. THE CONTINUITY TABLE

**This is the most important artefact in the build.** Every conflict in the
source documents was a symptom of this table not existing. FOV, exposure, roll,
fog and audio are each ONE continuous function of `q` — not four per-Act curves
that happen to meet.

### 3.1 Master Curve

| `q` | Act / Beat | FOV° | Exposure EV | Roll° | FogExp2 | Sub Hz | Lights |
|---|---|---|---|---|---|---|---|
| 0.00 | I · Void | 28 | −2.40 | 0.00 | 0.022 | 34 | 1 |
| 0.04 | I · Drop begins | 30 | −2.20 | 0.06 | 0.021 | 34 | 1 |
| 0.10 | I · **The punch** | 49 | −1.60 | 0.18 | 0.019 | 34 | 2 |
| 0.18 | I · Scale reveal | 45 | −1.05 | 0.10 | 0.016 | 34 | 3 |
| 0.25 | I · **Settle** | 41 | −0.70 | 0.00 | 0.014 | 34 | 3 |
| 0.32 | II · Orbit entry | 42 | −0.70 | 1.30 | 0.013 | 34 | 3 |
| 0.38 | II · **Bank peak** | 43 | −0.70 | 2.40 | 0.012 | 34 | 3 |
| 0.44 | II · Pool reveal | 44 | −0.70 | 1.80 | 0.011 | 34 | 3 |
| 0.50 | II · **Terminus** | 44 | −0.70 | 1.20 | 0.010 | 34 | 3 |
| 0.58 | III · Approach | 44 | −0.70 | 0.50 | 0.008 | 34 | 4 |
| 0.64 | III · Threshold | 42 | −0.70 | 0.10 | 0.004 | 34→42 | 4 |
| 0.66 | III · **Breach** | 40 | −0.55 | **0.00** | 0.000 | 42 | 4 |
| 0.70 | III · Interior | 38 | −0.10 | 0.00 | 0.000 | 42 | 4 |
| 0.75 | III · **Settle** | 38 | +0.35 | 0.00 | 0.000 | 42 | 4 |
| 0.82 | IV · Pause ends | 38 | +0.35 | 0.00 | 0.000 | 42 | 4 |
| 0.90 | IV · Dolly push | 37.6 | +0.35 | 0.00 | 0.000 | 42→38 | 4 |
| 0.96 | IV · Collapse begins | 37.2 | +0.35 | 0.00 | 0.000 | 36 | 4 |
| 0.985 | IV · **Severance** | 37 | +0.35 | 0.00 | 0.000 | ramp→0 | 4 |
| 1.00 | IV · Silence | 37 | +0.35 | 0.00 | 0.000 | 0 | 4 |

**Interpolation:** Fritsch–Carlson monotone cubic over `q` for FOV, EV, roll and
fog. Linear for sub-bass frequency.

**No ease is applied to `q` before the camera samples the path — [RESOLVED §23].**
The spec originally called for one global ease. Implementation showed it has its
own defect: an ease REMAPS q, so a beat declared at `at: 0.75` does not arrive at
75% of scroll. The Act IV pause was landing at q 0.646–0.700 instead of
0.75–0.82, and every beat was displaced the same way — `at` had silently stopped
meaning "the scroll position where this vantage appears."

Beat spacing already is the velocity design: 0.04→0.10 covers 226 m of travel
while 0.75→0.82 covers zero. That is explicit, inspectable, and editable one
number at a time. Catmull-Rom is C1-continuous, so no ease was needed to smooth
the corners either. Removing it also fixed the distribution — travel had been 97%
concentrated in q 0.15–0.60 with a dead final third.

This is NOT a return to Appendix B failure 3, which was an inOut applied *inside
every segment*. There is now no ease on the camera parameter at all.

### 3.2 What Was Fixed Here

**[RESOLVED §1] FOV.** Sources gave three incompatible sets: `ACT_01` 28→49→41,
`Claude.md` 8→11→65→48, `Gemini.md` 110→35. Worse, `ACT_01` settled at 41° while
`ACT_3` opened at 44° with Act II unspecified — a visible snap at the I/III seam
and a hole in the middle. **Ruling:** `ACT_01`'s values are kept (Gemini's 110°
is a fisheye; Claude's 8° is unusable as an opening frame), Act II is given the
41→44 ramp that was missing, and Act III now opens on the exact value Act II ends
on. Act III terminates at 38 so Act IV's 38 is continuous.

**[RESOLVED §2] Roll.** `ACT_01` 0.18°, `ACT_2` max 2.4°, `Gemini` −4.5°.
**Ruling:** 0.18° micro-roll in the dive, 2.4° peak in the orbit, exactly 0.00° at
the breach (a hard requirement from `ACT_3`, preserved). 4.5° is a helicopter, not
a monolith. Roll is derived from instantaneous angular velocity and critically
damped to lag the motion — it is a *consequence* of the turn, never an input.

**[RESOLVED §3] Light budget.** `ACT_01` capped 4; `ACT_3` specified "3–5 point
lights" *plus* the exterior directional — 4 to 6, breaching its own budget.
**Ruling:** hard cap of 4. Interior gets 3 practicals plus the moon directional
kept outside the glass. The 2700 K warmth comes from colour and falloff, not
count.

### 3.3 Exposure Lag

Exposure does not track the table instantaneously. It chases it:

```
E_actual += (E_target − E_actual) · (1 − exp(−dt / τ))     τ = 1.05 s
```

This is the physiological iris-adaptation model from `ACT_3` and `gpt.md` §9. The
lag is why the interior reads as "the eye hunting for light" rather than a dimmer
switch. **`τ` applies only to exposure.** Nothing else in the table lags.

### 3.4 Scroll Track Length — L7

```
DESKTOP    1000vh    (4 acts × 250vh)
MOBILE      800vh    (touch scroll travels faster; thumb fatigue is real)
```

**The invariant is a RATIO, and it is relative — [RESOLVED §22].**

```
travel per 5% scroll / distance to look target  ≥  0.02
```

The first version of this law was absolute — "≥ 12 metres per viewport" — and
implementation proved it unusable. This narrative spans **district scale** (690 m
viewing distance during the corridor reveal) down to **room scale** (2.6 m at the
final aperture). 0.2 m of travel is invisible at 690 m and is 8% of the frame at
2.6 m. No absolute floor is correct at both ends.

The relative measure is what the eye actually reads: the fraction of the
subject's own scale the camera covers. Asserted by `scripts/rig-check.mjs`,
which also verifies the Act IV pause is present **and confined to its window** —
a stall inside q 0.75–0.82 is the design, a stall anywhere else is the bug.

Measured on the shipped path: never below **12.8%** outside the pause.

This constraint exists because that exact regression shipped on the QHR build in
this repository: a scroll track was lengthened 6× to fix pacing, the camera path
was left at its original length, and the result was reported as a completely dead
camera. **Assert this ratio in CI.** Percentages alone do not protect against it.

---

## 4. SYSTEM ARCHITECTURE

### 4.1 Repository Placement

```
apps/monolith/            ← new workspace member
```

`pnpm-workspace.yaml` globs `apps/*` and `turbo.json` declares only generic
tasks, so the new app is picked up with **zero edits to any existing file**. The
70 commits of `apps/public` are not touched.

- **Port** 3002 (crm 3000, public 3001)
- **Shares** `@estate/db`, `@estate/domain`, `@estate/ui` via `workspace:*`
- **Branch** `feat/monolith` — `main` stays deployable throughout
- **Do not** inherit `@estate/ui`'s Tailwind preset unless it is token-based.
  Monolith's ground is `#050505`; QHR's is `#0A1120`.

### 4.2 Routing Topology

**[RESOLVED §4] Canvas mount point.** `PHASE_5` said `(experience)/layout.tsx`;
`Claude.md` and `Gemini.md` said root `layout.tsx`. **Ruling:
`(experience)/layout.tsx`.** Root placement forces `not-found.tsx` to render
*inside* the canvas tree, which is precisely why `Claude.md` then had to invent an
`isErrorState` Zustand flag to suppress context creation. Mounting inside the
route group deletes that problem: a root-level `not-found.tsx` sits outside the
group and no canvas ever mounts. **One decision removes an entire class of
workaround.**

**[RESOLVED §5] Slot name and interception shape.** `PHASE_6` used `@modal`;
`Gemini` used `@overlay` and proposed a single dynamic slot
`app/@overlay/[slug]/page.tsx`. **That cannot work** — intercepting routes match
`(.)segment` at the same tree depth, so a dynamic slot cannot intercept a
differently-named top-level route like `/careers`. **Ruling:** slot is `@modal`;
each utility page gets its own interceptor folder. This costs ~15 extra folders
and buys clean top-level URLs (`/careers`, not `/utility/careers`), which for a
₹50L property listing is worth it for SEO and shareability.

```
app/
├── layout.tsx                        root — html/body only, NO canvas
├── not-found.tsx                     DOM-only, outside (experience) → no canvas
├── (experience)/
│   ├── layout.tsx                    ◄── THE CANVAS MOUNTS HERE, ONCE
│   ├── page.tsx                      the 4-act scroll narrative
│   ├── @modal/
│   │   ├── default.tsx               returns null — overlay closed
│   │   ├── layout.tsx                the HUD shell (rail + content pane)
│   │   ├── (.)careers/page.tsx       intercepted → opens in HUD
│   │   └── (.)privacy/page.tsx       …15 total, one per utility page
│   ├── careers/page.tsx              direct-hit → renders same chrome standalone
│   ├── privacy/page.tsx
│   └── syndicate/[slug]/page.tsx     Server Component, DOM only
├── components/
│   ├── experience/                   R3F, shaders, camera, audio
│   └── command/                      HUD, glassmorphic DOM
├── state/
│   ├── sceneStore.ts                 q, camera intent, freeze, error
│   ├── commandStore.ts               overlay open, active route, backdrop
│   └── syndicateStore.ts             active partner, anchor
├── lib/
│   ├── ticker.ts                     ◄── THE ONE CLOCK
│   └── supabase/
└── glsl/                             water, sky, glass, collapse
```

**Direct-hit parity:** `careers/page.tsx` does not inherit `@modal/layout.tsx`. It
must explicitly render the same chrome component the modal layout uses
internally, or a shared link produces an unstyled page.

### 4.3 The Unified Ticker — L1

```
                    gsap.ticker              ← the only rAF in the application
                         │
      ┌──────────────────┼──────────────────┐
      ▼                  ▼                  ▼
  lenis.raf(t*1000)  GSAP timelines    invalidate()
      │                                     │
      └────────► q (0 → 1) ─────────────────┘
```

```ts
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

`lagSmoothing(0)` is mandatory. GSAP otherwise clamps delta after a slow frame —
correct for a tween, wrong for a scroll position, because clamping makes Lenis
integrate less than real elapsed time and drift permanently behind the scrollbar.
Restore `lagSmoothing(500, 33)` on unmount so this does not silently alter every
other tween in the app.

**[RESOLVED §6] `demand` vs `never`.** `ACT_01` / `PHASE_6` specified `"demand"`
with freeze-by-not-invalidating. `ACT_4` specified `"never"`. **These are not
equivalent, and the difference is load-bearing:** drei calls `invalidate()` on its
own — `<Html transform>` on matrix updates, texture and GLTF loads, controls. Acts
II–IV depend heavily on `<Html transform>`, so "stop calling invalidate" will
*not* idle the GPU; a third-party component will wake it. **Ruling:**

```
CINEMATIC ACTIVE   frameloop="demand"  →  ticker calls invalidate()
FROZEN             frameloop="never"   →  invalidate() is ignored entirely
```

Both source documents become true. Corollary: `"never"` also halts `useFrame`, so
anything that must animate *during* the freeze lives in DOM/GSAP, never in R3F.

### 4.4 State Shape

```ts
interface SceneStore {
  q: number;                                   // 0→1, written by ticker only
  frameloop: 'demand' | 'never';
  cameraIntent: { position: Vec3; lookAt: Vec3 } | null;   // INTENT, not camera — L5
  activeAnchor: string | null;
  exposure: number;                            // lagged actual, not target
  audioCut: boolean;
  tier: 'A' | 'B' | 'C' | 'D';
  reducedMotion: boolean;
}

interface CommandStore {
  overlayOpen: boolean;
  frozenBackdrop: string | null;               // data URL, captured once
  lastFov: number;                             // HUD needs this on mount
  activeUtilityRoute: string | null;
}
```

The HUD reads `frozenBackdrop`, `lastFov` and `audioCut` **from the store on
mount** — never via prop-drilling from a component that may unmount on
navigation. This is `Claude.md`'s closing ruling on Act IV and it is correct.

### 4.5 The Freeze State Machine — L6

**[RESOLVED §7] Ordering.** Three sources, three orderings, and one of them cannot
work:

| Source | Order | Verdict |
|---|---|---|
| `gpt.md` §23 | freeze → then capture | **Broken.** After `frameloop="never"` no render occurs, and by WebGL spec the drawing buffer is cleared after compositing. Captures blank. |
| `PHASE_6` §2 | capture → stop ticker → freeze | Ambiguous about whether a render precedes the capture. |
| `Claude.md` §2 | `invalidate()` → capture **and** freeze on the same `onAfterRender` | **Correct.** |

**Ruling — the canonical sequence:**

```
1. openOverlay()                  user gesture
2. invalidate()                   guarantee the CURRENT state renders
3. onAfterRender fires  ─────┐    same tick:
     ├─ gl.domElement.toDataURL('image/webp', 0.85) → frozenBackdrop
     └─ setFrameloop('never')  ◄──┘
4. canvas → opacity 0 (350 ms)    NEVER display:none — see below
   backdrop div → opacity 1 (350 ms), background-image: frozenBackdrop
5. backdrop-filter: blur(18px) brightness(0.58) applied to the STATIC div
6. HUD animates in
```

**Why this is seamless by construction:** the canvas is frozen on the *exact*
frame that was captured. For the whole 350 ms crossfade the live canvas and the
image are pixel-identical — you are dissolving an image into itself. There is no
motion to perceive at any point in the fade, regardless of timing precision.
Split steps 3a and 3b into separately-scheduled effects and you will occasionally
capture one frame and freeze on another, producing a pop that passes QA nine
times and fails the tenth.

**`preserveDrawingBuffer`** — never specified in any source document, and it is a
**context-creation attribute that cannot be changed after mount**. Because the
capture above runs inside `onAfterRender` (same tick as the render), we do NOT set
it — avoiding its memory cost and its habit of disabling mobile driver fast paths.
**This is why the Canvas file must be written before Phase 6, not during it.**

**`opacity: 0`, never `display: none`.** Some browsers deprioritise or lose WebGL
contexts on genuinely undisplayed canvases — the exact expensive rebuild the
freeze exists to avoid.

**[RESOLVED §8] Disposal.** `Gemini` said traverse and `.dispose()` aggressively;
`Claude.md` forbade disposal entirely; `gpt.md` proposed tiers. **Ruling — gpt's
tiers, with Claude's prohibition on `renderer.dispose()`:**

| Tier | When | Action |
|---|---|---|
| 1 | Immediately on freeze | Stop rendering. 0 GPU work/frame. Sufficient for the battery win on its own. |
| 2 | Idle > 60 s | Dispose temporary render targets, post-processing buffers, simulation buffers. Downsample composer to 0.5×. |
| 3 | Never | Canvas, camera, core materials, scene graph. **Never `renderer.dispose()`** — context recreation means re-paying the entire Act I–IV load cost. |

**Resume:** clear idle timer → restore composer size → `opacity: 1` →
`frameloop = 'demand'` → single `invalidate()`. No remount.

---

## 5. THE FOUR ACTS

All numeric values for FOV, EV, roll, fog and audio come from §3 and are not
repeated here. This section specifies only what §3 cannot express.

### ACT I — THE CORRIDOR · `q` 0.00 → 0.25

**Objective:** absolute void → recognition of the ground the company works on.

**Subject: the Visakhapatnam–Vizianagaram–Srikakulam corridor** (§1). The descent
resolves through real, checkable geography — coastline, the NH-16 / AH-16 spine,
Bhogapuram International Airport, the Super Smelters plant at Garividi — before
settling on a single project. This is the investment thesis the company already
sells in person, rendered. It is also unforgeable: a competitor can copy a
cinematic, not a corridor they do not build in.

**Kinematics.** A *compound* descent, not a single tween — this is what separates
a Nolan reveal from a drone shot. Y-drop, Z-penetration and a 4.5-unit lateral
X-drift run on **separate eased tracks**: `power4.out` on Z, `power2.inOut` on Y,
so the rise visibly lags the pullback. That asymmetry reads as mass. A 1.8-unit
downward arrest at the settle establishes kinetic weight. **Zero overshoot** — no
elastic, no back-ease. Mass arrives and stops; it never bounces.

**House ease** (register once, reuse site-wide):

```js
CustomEase.create("monolith",
  "M0,0 C0.1,0.02 0.15,0.35 0.3,0.55 0.55,0.85 0.75,0.97 1,1");
```

**Opening frame.** The camera opens *close* on a single architectural detail — a
stone seam, a shadow edge — at 28°, so the first frame is abstract rather than
legible. Scale is withheld until `q` 0.10. `Gemini`'s aerial `[0,400,150]` open is
rejected: it gives away the scale in frame one and leaves nothing to reveal.

**Post-processing order** — [REVISED §25]. The chain is a camera and is ordered
like one. Everything optical happens in scene-linear HDR; the transform to
display happens exactly once; grain is last so it dithers the final image.

```
Exposure          sensor gain, = gl.toneMappingExposure     HDR
Bloom             veiling glare, threshold 1.0              HDR
ChromaticAberration   dispersion, < 0.001                   HDR
Vignette          optical falloff                           HDR
SplitTone         ACES filmic, then the grade         HDR -> display
Noise             monochromatic grain                       display
```

**Tone mapping is ACES Filmic, once, inside `SplitTone`.** The previous ruling —
"in the material shader, not as a composer pass" — was written against a pipeline
that does not exist. `@react-three/postprocessing`'s `EffectComposer` sets
`gl.toneMapping = NoToneMapping` on mount, unconditionally, with no prop to opt
out; three then compiles `<tonemapping_fragment>` out of every material. The
result was not a double map but **zero** maps, which also made the entire EV
column of §3 inert, since `toneMappingExposure` is only ever read inside a tone
mapping function. The ruling's intent — never map twice, which is what produced
the documented "radioactive glare" failure — is satisfied exactly by mapping
once, here. Asserted by `scripts/grade-check.mjs`.

**Exposure must precede bloom.** `luminanceThreshold` is compared against
whatever reaches it, and the scene is authored to land in range only after being
multiplied by ~0.19. It also buys the §3.3 exposure lag optically for free: as
the eye adapts across the Act III breach, highlights stop blooming because they
stop being over-white.

**The black is not black.** `#0B1118`, the mean shadow value of the four client
reference frames, applied as an additive lift and dithered by the grain pass.
Verified on the GPU at `#0B1018` — within 1/255. Pure `#000000` banding in the
shadows is the most common tell of an amateur WebGL scene.

**The void is `#0A0A0E`** — [ADDED §27] — a bruising dark violet-grey, and it is
the colour of `scene.background`, `FogExp2`, the sky horizon and the terrain's
aerial-perspective target. Do not confuse it with the grade floor above: this is
what the SCENE renders, before exposure, before ACES, before the grade.

**NO WARM SOURCE EXISTS OUTSIDE THE VILLA.** The sky once carried a `#c8642a`
ember across the western horizon at two falloffs, the key light was `#ffb478`,
the hemisphere ground was warm, the water glint was orange and the Act II
plotting grid was drawn amber — while `grade.ts` asserted in prose that the grid
was cool and built its two-tint highlight logic on that claim. All of them are
now cold. The only warm value in the build is `PRACTICAL_2700K` `#FFA957`, on
the point lights inside the model duplex villa, which is exactly the "warm pools
with falloff" Act III calls for. `scripts/grade-check.mjs` scans every colour
literal in `Corridor.tsx`, `Terrain.tsx` and `Massing.tsx` and fails on any with
`r > b`.

*Note on residual warm pixels:* about 0.6% of a typical Act I frame reads warm
under measurement. All of it is `ChromaticAberration` fringing on high-contrast
edges — lens dispersion, paired one-for-one with cool fringing on the opposite
side of each edge. Disabling that one effect takes the count to exactly zero. It
is not a colour cast and it is the spec'd `< 0.001` effect behaving correctly.

### ACT I GEOGRAPHY — [ADDED §28]

Act I resolves the real corridor, not an abstract plane: the coast, the NH-16 /
AH-16 spine, Bhogapuram, the district road network, and the industrial estates
that are the entire reason the land has a price. **"Why here" is the only
question a plot buyer actually asks**, and Act I is where it gets answered.

None of it is modelled.

| Element | How | Draw calls |
|---|---|---|
| Coast, plain, Eastern Ghats | displaced `PlaneGeometry`, ridged multifractal | shares the terrain's 1 |
| NH-16 spine, median, lane dashes, lamp rows | distance field from an analytic curve, fragment stage | 0 |
| Bhogapuram runway, apron, thresholds, approach lights | one rotated rectangle of arithmetic | 0 |
| District road network | modulo grid, fragment stage | 0 |
| ~620 industrial buildings | one `InstancedMesh` of boxes | 1 |

Measured at **30 draw calls** for the whole frame against L8's budget of 100.

Two rules the massing depends on. **Clusters share a yaw** — an estate aligns to
its access road, and uniform-random rotation is the single clearest tell of
procedural scatter. And **the height field is mirrored in TypeScript** so
buildings sit on GPU-displaced ground; that duplication is bounded rather than
trusted, with every box sunk 14 m below its computed height so a mismatch buries
a building instead of floating it.

**Infrastructure fades up across `q` 0.045 → 0.16.** §5 opens on a void and
withholds scale until `q` 0.10; a highway legible in frame one hands over the
scale the descent exists to reveal.

**The grade** — [ADDED §26] — is a three-band split-tone derived entirely from
those four frames; every hex and its provenance live in `src/lib/grade.ts`. Its
one structural decision is that **the highlight band carries two tints, selected
per pixel by the pixel's own `r − b`**, because the references contain two
unrelated highlight families — warm point sources (sodium, 2700 K practicals)
and cool atmosphere (sky, fog crest, the Act II plotting grid). A single
highlight tint cannot serve both: tint everything warm and the plotting grid
turns amber; tint everything cool and the practicals stop being 2700 K.

This is also what makes the Act III ruling below enforceable rather than
aspirational. One grade serves all four acts: §3 already owns everything that
varies with `q`, and a second `q`-varying system competing with it is the exact
failure §3 exists to prevent.

**Ignition.** Consent gate resolves first (§8.2), then a stark `[ ENTER ]` on
black. That gesture unlocks `AudioContext` — browsers block Web Audio without one.
Two gates is deliberate: bundling "authorize telemetry" into "enter the site"
would be a consent dark pattern (§8.2).

### ACT II — THE LAND · `q` 0.25 → 0.50

**Objective:** vertical drop → heavy horizontal orbit, revealing the water and
the plotting grid.

**Subject: the parcel** (§1) — residential plots at Kartikeya and Gayatri,
plantation plots at Lucky Garden. The orbit sweeps a *parcel*, not a courtyard.

**The water is real.** Kartikeya Water Front has a lake on site; Lucky Garden has
a duck pond. Every Gerstner / caustics / Fresnel / acoustic ruling below applies
unchanged — the subject simply stopped being an invented infinity pool and became
the thing the project is named after.

**Plantation rows are geometry, not set dressing.** Lucky Garden's pitch is yield
— avocado at roughly ₹400/kg, mahogany at 20–25 cu ft per tree. Instanced rows on
a grid, one draw call via `InstancedMesh`, and the orbit passes over them because
the rows are the product.

**The plotting grid is the reveal.** As the orbit passes its bank peak, survey
lines rise out of the terrain — plot boundaries drawn as thin emissive lines on
the ground plane, not as geometry. A shader on the terrain, keyed to `q`, so it
costs one uniform and no draw calls. This is the moment the land becomes
*sellable* in the viewer's mind, and it is the single most product-honest frame
in the whole narrative.

**Kinematics.** A 62° sweep around the **visual centre of gravity of the pool**,
not the geometric centre of the estate. Minimum-jerk trajectory. Y performs a
broad asymmetric lift (17 → 19 → 18) so the viewer momentarily looks *over* the
foreground pillars. The orbit is **non-uniform** — angular velocity is itself
eased, so the camera loads into the turn and coasts out of it.

**Bank.** Derived from instantaneous angular velocity, critically damped to lag
the motion, clamped at 2.4° (§3.2). Never roll the camera object directly from `t`.

**Geometry.**

- **Sunken lounge:** `@react-three/csg` booleans computed **exactly once** at
  mount, result cached as a static `BufferGeometry`. Zero per-frame CSG. Free
  after bake.
- **Infinity pool:** single `PlaneGeometry` 128×64. Three low-amplitude Gerstner
  waves — *surface tension, not ocean*. Normals reconstructed via cross products
  of displaced vertices. Schlick Fresnel against the procedural sky. Caustics
  faked with animated multi-scale Voronoi.

**Spatial typography.** `<Html transform>` with **targeted** occlusion:
`occlude={[pillarsRef]}` — an explicit array of foreground pillar refs, never the
whole scene graph. Plus a **100 ms hysteresis** between geometric intersection and
DOM opacity change, or the label strobes whenever the camera grazes a pillar edge.

**Profiling gate.** Act II must be profiled with the Act I composer stack **active
simultaneously**, not in isolation. Occlusion raycasting stacked on the Gerstner
vertex loop stacked on bloom/DOF is where this act's frame budget actually goes —
and it is invisible when each is measured alone.

### ACT III — THE THRESHOLD · `q` 0.50 → 0.75

**Objective:** breach the glass, transition the optical and acoustic environment,
introduce the Syndicate UI.

**Subject: the model duplex villa** (§1). Kartikeya lists "Elegant Model Duplex
Villa" among its project highlights — a real show home on a real layout, which is
precisely what a buyer walks into on a site visit.

That makes the breach the honest centre of the whole narrative: the camera crosses
the glass at the same instant the story crosses from *the plot you buy* to *the
house you build on it*. The threshold is not a set piece; it is the sales journey,
and every ruling below about exposure lag, glass dissolution and acoustic vacuum
applies to it unchanged.

**Master variable.** The **signed distance from camera to glass plane** drives this
act — not raw scroll percentage. States: Approach (> +0.8), Threshold (+0.8→0),
Breach (0→−0.8), Interior (−0.8→−6), Settle (< −6).

**The glass — never touch `camera.near`.** A custom shader (via `onBeforeCompile`,
needs `worldPosition` from the vertex stage) drops opacity and transmission to
zero via `smoothstep` as distance approaches zero, so the pane phases out before
the camera can clip it. A 120–180 ms optical veil (subtle luminance spike) masks
the geometric penetration.

> **Highest-risk item in the entire build.** A custom glass shader forfeits
> `MeshPhysicalMaterial`'s free PBR transmission. Budget real time to hand-roll
> refraction — a screen-space UV offset sampling a render target of the interior is
> sufficient; **do not raymarch it**. Without this the "glass" reads as a flat
> discard plane the instant the distortion spike ends. **Build and test this in
> isolation before wiring it to the act.**

**Lighting.** 3 clustered 2700 K practicals creating warm pools on walnut and
marble, plus the moon directional kept *outside* the glass = 4 (L8). 2700 K means
warm *pools with falloff*, never a global orange filter.

**Syndicate UI.** `<Html transform distanceFactor={7}>` flattened coplanar against
interior millwork. Purely typographic — `01 / SYNDICATE // MASTER OF BESPOKE
MILLWORK` — 1 px crosshairs, 0.3 opacity, **under 8% of viewport**. UI does not
cast or receive scene shadows. Hover pre-loads partner data into the store; click
opens the overlay.

### ACT IV — THE STANDOFF · `q` 0.75 → 1.00

**Objective:** passive observation → active acquisition.

**Kinematics.** `q` 0.75–0.82 the camera **does not move** — the user sits in the
Sanctuary. 0.82–0.94 a cubic Bezier dolly toward a narrow aperture framing the
exterior. FOV is essentially static (§3): this must feel like a *body moving
through space*, not a digital zoom. The easing accelerates late and **does not ease
out** — it is interrupted by the 100% threshold.

`Gemini`'s 38°→12° violent compression is rejected: it converts a physical push
into a zoom and materially raises motion-sickness risk on a 250vh act.

**The optical collapse.** 0.96→1.00 a custom radial-luminance shader crushes the
screen edges to darkness. The world does not fade. At `q` 1.00 only 5–8% of the
focal point remains — and that dark remnant **is** the physical backdrop the HUD
sits on.

**Acoustic climax.** Crescendo → compression → silence. Sub-bass pitches 42→34 Hz
while *gaining* amplitude (crushing mass), then at `q` 0.985 the master gain ramps
exponentially to zero over 140 ms — fast enough to read as a vault sealing, slow
enough to avoid a digital pop. **250 ms of absolute silence** follows before the
HUD becomes interactive. No triumphant impact. The vacuum is the point.

---

## 6. PHASE 5 — SYNDICATE HUB & LEAD VAULT

### 6.1 Spatial Routing

`/syndicate/[slug]/page.tsx` is a Server Component that fetches partner data and
renders **DOM only**. A zero-output client bridge writes the anchor to Zustand:

```tsx
'use client';
export function CameraBridge({ anchor, slug }) {
  const setAnchor = useSceneStore(s => s.setActiveAnchor);
  useEffect(() => { setAnchor(anchor, slug); }, [slug]);
  return null;                    // ← no DOM output ⇒ no hydration mismatch (L4)
}
```

The camera controller lives inside the canvas, subscribes to the same slice, and
glides using frame-rate-independent exponential smoothing inside `useFrame`.
**Quaternion slerp for rotation** — Euler interpolation gimbal-locks on the steeper
anchors.

**Every tween frame must call `invalidate()`.** Under `frameloop="demand"` a GSAP
tween renders nothing otherwise. This is the single most common bug this
architecture invites.

**[RESOLVED §9] Deep-link precedence** — unspecified in all sources. A visitor
landing directly on `/syndicate/acoustics` has an anchor but `q = 0`; two
authorities want the camera. **Ruling:** the URL anchor wins and `q` is clamped to
the anchor's act until the user's first scroll input, at which point scroll
resumes authority and the anchor releases.

### 6.1a The Socket Registry — [RESOLVED §18]

`PHASE_5` §2 specified *"a hardcoded dictionary within the 3D application maps
string keys to physical vectors."* **That is wrong, and it would have made every
partner change a redeploy.** Syndicate partners are commercial relationships;
they churn. Geometry does not.

**Ruling: hardcode the sockets, not the occupants.**

```
SOCKETS  (code — a manifest of the 3D model's mount points)
  millwork-panel-01   → Vec3, lookAt, distanceFactor
  marble-floor-02     → …
  acoustic-ceiling-03 → …
  ↑ these are properties of the GEOMETRY. They change only when the model does.

PARTNERS (database — syndicate_partners)
  id · slug · display_name · craft · socket_key ─┐
                                                 └─► FK into the socket manifest
  ↑ add, remove, reassign, reorder = one UPDATE. No rebuild, no redeploy.
```

Adding a partner, dropping one, or moving one to a different position in the room
is a row change. The only time anyone touches code is when a **new physical
location** is needed in the architecture — which requires new geometry anyway, so
the code change was unavoidable regardless.

**Three consequences that must be built in from the start:**

1. **Unoccupied sockets render nothing.** A socket with no partner row produces no
   reticle. The room does not show empty labels.
2. **Unknown `socket_key` must not crash.** A partner added before its geometry
   exists falls back to a designated default socket and logs a warning. A sales
   deal signed on Tuesday must never be able to white-screen the site on
   Wednesday.
3. **`/syndicate/[slug]` uses ISR with `dynamicParams: true`**, not build-time
   `generateStaticParams` alone. A new partner slug must resolve on first request
   without a deploy. `revalidate` on the partner read so display data updates
   propagate within the hour.

**Socket count is decoupled from partner count.** Build the manifest with more
sockets than there are current partners — spare mount points across the Act III
interior cost nothing when unoccupied and mean the next three deals need no
geometry work at all. `Routing Arch.md`'s "14" is now a *starting occupancy*, not
an architectural constant.

**Per-partner pages:** each `/syndicate/[slug]` already renders DOM-only content
driven by its row, so a bespoke page per partner is a content decision, not a
build one. When the confirmed partner list arrives, the only question is which
socket each occupies — everything else is data.

### 6.2 The Vault

```
syndicate_partners   PUBLIC READ via RLS   id, slug, spatial_anchor, display data
leads_vault          ZERO browser access   no SELECT / UPDATE / DELETE
lead_dispatches      ZERO browser access
audit_receipts       ZERO browser access   append-only, hash-chained
```

- **Server authority.** Browser sends `slug` + `client_intent_id` (idempotency key,
  **server-generated**, never browser-generated). The Edge Function resolves the
  real `partner_id` server-side. The client never names a partner id.
- **No SECURITY DEFINER RPC** for lead insertion — it expands the database attack
  surface for no gain. Path is `Browser → Edge Function → trusted server client →
  Postgres`.
- **Commit first, dispatch second.** The Edge Function writes and commits, then a
  Database Webhook fires post-commit to trigger dispatch. Never call WhatsApp
  before the insert commits — a failed insert after a sent message is an
  unrecoverable attribution dispute.
- **Server-owned timestamps.** `created_at` is `now()` in Postgres, never a client
  value.

### 6.3 On the Word "Zero-Trust" — Say This to the Client

Both `Claude.md` and `gpt.md` reached the same conclusion independently, and it is
correct: **a `prev_hash` chain provides tamper-*evidence*, not
tamper-*prevention*.** Anyone holding the `service_role` key can recompute the
entire chain consistently.

What actually closes it is already in the Phase 5 dispatch design and must be
stated as load-bearing rather than incidental: **the platform owner receives an
external copy of every receipt** (lead UUID, partner, timestamp, receipt hash,
previous hash). The database cannot silently rewrite history without producing a
mismatch against receipts held outside it.

**Undersell the security claim; oversell the experience.** That is the correct
ratio for this build, and misrepresenting it in a ₹50L contract is a commercial
risk, not a technical one.

---

## 7. PHASE 6 — THE COMMAND OVERLAY

**Freeze lifecycle:** §4.5. Not repeated.

**Grid.** `grid-template-columns: minmax(240px, 0.28fr) minmax(0, 1fr)`. The left
rail is **permanently mounted** while inside the HUD — navigating Careers →
Contact re-renders only the right pane, never the rail and never the canvas. This
is the same persistence trick as the canvas itself, one level down.

**URL is the authority.** Navigation via `router.push()`. HUD content swaps because
the URL changed, not because a state flag was toggled. The back button works for
free.

**Bundle quarantine.** All 15 utility pages are Server Components containing
**zero** R3F / GSAP / Zustand imports. Heavy interactive islands (investment
calculator, gallery lightbox) are `next/dynamic({ ssr: false })`. Images via
`next/image` with `loading="lazy"`. The cinematic bundle and the utility bundle
must not intersect — verify with `@next/bundle-analyzer` in CI.

**Acoustic ducking.** Opening the HUD ramps the drone to near-silence over 50 ms.
The world stops; the dossier remains.

**Loading state is typographic.** No spinners anywhere in this build.

---

## 8. PHASE 7 — THE EPILOGUE

### 8.1 The Anti-Footer

No traditional footer — pushing the scroll track past the Act IV climax into a
copyright block destroys the standoff the whole narrative was built to produce.

Instead: a `fixed` micro-rail at `bottom: 2rem`, 9 px highly-tracked type, using
`mix-blend-mode: difference` so it stays legible across every lighting state
without per-act colour overrides. Opacity clamped at 0.2, rising to 1.0 on hover.

**During `q > 0.90` the rail fades to 0.** The links remain in the DOM at every
other scroll position; momentary de-emphasis during a 10% window is not hiding a
required disclosure.

### 8.2 Consent

**[RESOLVED §10] Granularity.** `PHASE_7` specified a binary `[AUTHORIZE]` /
`[ESSENTIAL ONLY]` with equal visual weight. `Claude.md` flagged that binary
consent is likely insufficient under a strict GDPR reading, which expects
per-category toggles.

**Ruling: three independent toggles** — Essential (locked on), Analytics,
Marketing — styled as a security terminal, all three given identical visual
weight, nothing pre-checked. `apps/public` in this repository already has a
working category-gated `ConsentProvider` and `MarketingPixels`; **port it rather
than rebuild it.**

Gate order: **consent resolves → `[ ENTER ]` → AudioContext unlocks → Act I.** No
non-essential script loads before consent resolves (L9).

### 8.2a Jurisdiction — [RESOLVED §19] · CONFIRMED EU TRAFFIC

The client confirms **German and American visitors**; the business targets HNIs
and NRIs. That settles it: **GDPR applies.** This is no longer a hypothetical and
it raises three requirements the source documents did not carry.

**① Consent must be recorded, not just honoured.** GDPR requires demonstrable
consent — *what* was agreed, *when*, and against *which* policy version. The
three toggles satisfy granularity; they do not satisfy the audit trail. Add a
`consent_ledger` row on every resolution:

```
consent_ledger
  id · categories_granted[] · policy_version · granted_at (server now())
  · ip_hash (salted, NOT raw IP) · user_agent_hash
```

Same append-only discipline as the lead vault, and cheap — it reuses machinery
already being built for Phase 5.

**② Withdrawal must be as easy as granting.** A permanent, keyboard-reachable
entry in the Command Directory rail that reopens the terminal with current
selections pre-loaded. Not buried in the privacy page.

**③ Data residency — the item nobody has costed.** India is **not** on the EU
adequacy list. Storing EU residents' personal data (which a lead form collects)
on Indian-region infrastructure requires a lawful transfer mechanism — Standard
Contractual Clauses plus a transfer impact assessment.

**Recommendation: provision the Supabase project in `eu-central-1` (Frankfurt).**
It removes the transfer question for German visitors entirely, gives them lower
latency, and India's DPDP Act 2023 uses a blocklist rather than a whitelist for
cross-border transfer, so EU hosting is permitted from the Indian side. Latency
for Indian users is irrelevant here — this is a lead form, not a trading desk.

**This is an infrastructure decision that must be made before the vault is
provisioned**, because migrating a Supabase project between regions after it
holds real leads is a migration, not a setting.

**On a full CMP:** with confirmed EU traffic there is a legitimate argument for
Cookiebot/Osano over a hand-rolled gate — they maintain the vendor taxonomy and
the audit trail as a product. Against it: a third-party script fights the < 2 MB
budget and the aesthetic. **Ruling: hand-rolled + `consent_ledger` for launch**,
because the vendor surface here is small (analytics + marketing pixels, both
first-party-configured). Revisit if the vendor list grows past ~5.

*Not legal advice. §8.2a is engineering's best reading and it is written to be
handed to counsel, not to substitute for them. Get sign-off on the ledger schema
and the residency decision before launch — both are far more expensive to change
afterwards. US state laws (CCPA/CPRA and successors) may additionally require a
"Do Not Sell or Share" control; confirm whether the company's use of marketing
pixels constitutes "sharing" under those definitions.*

### 8.3 The 404

Pure DOM. Because the canvas mounts in `(experience)/layout.tsx` and
`not-found.tsx` sits at root (§4.2), **no canvas mounts at all** — no Zustand
override, no suppression flag, no workaround. The architecture removes the problem
instead of solving it.

Pitch black. Monospace. `SIGNAL LOST. 404. RETURN TO APEX.` A single red CSS
`radial-gradient` as a mock cinematic light source — zero render budget. No web
font, no image, no WebGL: the fastest-painting screen on the site, which is exactly
right for the one page whose job is telling the user something already went wrong.

---

## 9. PERFORMANCE CONTRACT

### 9.1 Hard Budgets

| Metric | Target | Gate |
|---|---|---|
| Draw calls | < 100 | CI assert |
| Dynamic lights | ≤ 4 | CI assert |
| Frame time, Tier A | ≤ 16.7 ms | Lighthouse + manual |
| Frame time, Tier C | ≤ 16.7 ms | **Real device, not emulation** |
| Total media payload | < 2 MB | CI assert |
| LCP | < 2.5 s | Lighthouse |
| CLS | 0 | Lighthouse |
| Freeze transition | ≤ 1 controlled capture spike | Profiler |

**On the capture spike:** demanding zero GPU sync cost from a readback is
physically unrealistic. The correct target is **no recurring cost, one controlled
transition cost.** If capture costs 10–20 ms on target hardware, optimise that
implementation — do not pretend readback is free.

### 9.2 Media Budget — Why < 2 MB Is Achievable

Everything is procedural. No HDRI (procedural sky). No `.mp3` (synthesised audio).
No water textures (Gerstner + Voronoi). No baked lightmaps. The only binary payload
is fonts and a small number of photographic assets in the HUD, which are
lazy-loaded and outside the cinematic bundle entirely.

### 9.3 Device Tiers — The Usability Bet

Detected on mount: `navigator.hardwareConcurrency`, `deviceMemory`, a one-frame GPU
timing probe, and `matchMedia('(pointer: coarse)')`. **Build the fallback paths in
Act I from day one** — every subsequent act inherits the composer stack, and
retrofitting tiers in QA is how this build fails.

| Tier | Target | Composer | Water | Lights | DPR |
|---|---|---|---|---|---|
| **A** | Desktop, dGPU | Full stack | Gerstner + Voronoi caustics | 4 | 2.0 |
| **B** | Laptop iGPU, flagship phone | Drop DOF + godrays; composer at 0.75× | Gerstner, no caustics | 3 | 1.5 |
| **C** | Mid-range phone | Vignette + grain only | Static normal map, animated UV | 2 | 1.25 |
| **D** | No WebGL, or `prefers-reduced-motion` | — | — | — | — |

**Tier D is not a failure state.** It renders the same narrative as a typeset
architectural document: full copy, real images, the four acts as chapters. It is a
second designed artefact, and it is what a jury tests when they turn on
reduced-motion. Most cinematic sites show a blank screen or an apology here.
**This is where the 30% usability weighting is won.**

### 9.4 Mobile — The Largest Gap in the Source Material

**Not one of the eleven source documents addresses touch, mobile viewports, or the
HUD on a 375 px screen.** Rulings:

- **Lenis smooths wheel and keyboard only.** `syncTouch: false`. Hijacking momentum
  scrolling on a phone fights the OS and is the fastest way to make a site feel
  broken.
- **Scroll track 800vh on mobile** (§3.4), not 1000.
- **HUD grid collapses to a single column** below 768 px; the rail becomes a top
  sheet.
- **`<Html transform>` labels capped at 2 on screen** at Tier C — CSS3D nodes are
  the dominant mobile cost in Acts II–III.
- **Cursor parallax is desktop-only** (`pointer: fine`). On touch the finger *is*
  the scroll.
- **Test on a real mid-range Android**, not desktop emulation. Emulated throttling
  does not reproduce mobile GPU fill-rate limits or thermal throttling.

### 9.5 The Sub-Bass Problem — Nobody Caught This

The acoustic design rests on 34–42 Hz. **Laptop speakers roll off below ~150 Hz;
phone speakers below ~400 Hz.** On the majority of devices that will view this
site, Acts I–IV are *silent*. The entire Zimmer-pressure layer is inaudible to most
of the audience and to at least some of the jury.

**Ruling:** every sub-bass fundamental ships with **harmonic reinforcement** — 2nd
and 3rd harmonics at 2× and 3× the fundamental (68 Hz / 102 Hz for the 34 Hz
exterior drone; 84 Hz / 126 Hz for the 42 Hz interior). The ear reconstructs the
missing fundamental from its harmonics, so the *perception* of sub-bass survives on
hardware that cannot reproduce it, while full-range systems still get the real
thing. Harmonic gain sits ~9 dB below the fundamental so it never colours the tone
on good monitoring.

---

## 10. ACCESSIBILITY CONTRACT — L10

Not a compliance chore. This is 30% of the score.

- **`prefers-reduced-motion: reduce` → Tier D.** No camera motion, no scroll
  hijack, no parallax. Full content.
- **Full keyboard traversal.** Every Syndicate anchor and every HUD route is
  reachable by Tab. Visible focus rings that survive the dark palette.
- **The scroll narrative has a skip link.** First Tab stop: "Skip to directory."
- **`<Html>` content is real DOM** — selectable, screen-reader legible. That is the
  reason for choosing it over textures on quads, and it must not be undone with
  `aria-hidden`.
- **Server-rendered content parity.** Every fact in the 3D scene exists in the
  served HTML. `<Html>` renders client-only; without DOM parity, crawlers and no-JS
  readers get an empty page.
- **Contrast.** All HUD and legal type meets WCAG AA (4.5:1) against its *actual*
  composited backdrop — measured against the blurred frozen frame, not a flat
  swatch.
- **Audio never autoplays.** Gated behind `[ ENTER ]`, with a persistent,
  keyboard-reachable mute.
- **The 250 ms silence at `q` 1.00 is not a dead interface.** Focus moves to the
  dossier form on entry so a screen-reader user is not stranded.

---

## 11. BUILD SEQUENCE

Order is load-bearing. Each file depends on the ones above it.

| # | File | Why here |
|---|---|---|
| 1 | `lib/ticker.ts` | L1. Nothing else may create a rAF. Everything subscribes. |
| 2 | `state/sceneStore.ts` | The DOM↔WebGL contract. Define before either side exists. |
| 3 | `app/(experience)/layout.tsx` + `CanvasHost` | Fixes `frameloop`, DPR, tone mapping and the capture strategy — context-creation decisions that cannot be changed later. |
| 4 | `lib/continuity.ts` | §3 as executable code. One table, imported everywhere. |
| 5 | `components/experience/CameraController.tsx` | Reads `q`, samples §3, applies FOV and roll. |
| 6 | Tier detection + Tier D shell | Before Act I, per §9.3. Retrofitting tiers fails. |
| 7 | Act I | First visual milestone. |
| 8 | Freeze machine + HUD shell | Before any utility page. |
| 9 | Acts II → III → IV | III's glass shader prototyped in isolation first. |
| 10 | Phase 5 vault | Independent of the cinematic; can run in parallel. |
| 11 | Phase 6 pages, Phase 7 | Content-bound. |

---

## 12. DEFINITION OF DONE

A gate is not passed by looking at it.

- [ ] Exactly one `requestAnimationFrame` in the built bundle (grep the output)
- [ ] `q` sweeps 0→1 with **no discontinuity** in FOV, EV, roll, fog (assert numerically, do not eyeball)
- [ ] Camera travel ≥ 12 m per viewport (L7, CI assert)
- [ ] Draw calls < 100 and lights ≤ 4 at every `q` in 0.05 increments
- [ ] Freeze → capture verified pixel-identical (diff the captured frame against the final rendered frame)
- [ ] 60 fps sustained on a real mid-range Android at Tier C
- [ ] Tier D renders complete content with WebGL disabled
- [ ] Full keyboard traversal, no trap, visible focus throughout
- [ ] Every 3D fact present in server-rendered HTML
- [ ] Lighthouse ≥ 95 across all four categories
- [ ] Consent blocks all non-essential scripts (verify in the Network panel, not in code)
- [ ] Audio perceptible on laptop speakers (§9.5 — verify by ear on a real laptop)

---

## 13. DECISIONS TAKEN

All four blocking questions are closed. Recorded here with their consequences.

| # | Question | Decision | Consequence |
|---|---|---|---|
| 13.1 | Narrative / inventory | **Villas, farmland, plots.** Four Acts = a descent through the product ladder | §1 Content Resolution · Act II is now The Land · Act III is villas |
| 13.2 | URL shape | **Clean top-level URLs** | §4.2 stands. ~15 interceptor folders. `/careers`, not `/utility/careers` |
| 13.3 | Jurisdiction | **German + American visitors. GDPR applies.** | §8.2a — consent ledger, withdrawal path, EU data residency |
| 13.4 | Syndicate partners | **Must be dynamic** | §6.1a — socket registry. Sockets in code, partners in the database |

### 13.5 What Is Still Open

One item, small, not blocking the build sequence.

*(Telugu/bilingual was raised and then **withdrawn** — client confirmed English only.)*

**13.5a Asset-class granularity — CONFIRMED REAL.** The brochures settle it:
Lucky Garden is an agricultural plantation layout (avocado/mahogany, goshala,
duck pond, resort zone) and Kartikeya/Gayatri are approved residential plotted
layouts. Both currently map to `asset_class = 'land'`. They look nothing alike
and no buyer confuses them, so Act II must render them differently.

Options: add `agricultural` to the enum, or derive it from `layout_type` if that
already distinguishes them. **Check `core.layout_type` first — the comment in
`enums.ts` says it replaced `projects.approval_authority`, so it may already
carry the distinction and cost nothing.** Needed before Act II geometry; not
before Act I or the shell.

Neither blocks files 1–8 in §11.

---

## APPENDIX A — CONFLICTS RESOLVED

| § | Conflict | Sources | Ruling |
|---|---|---|---|
| 1 | FOV curve | `ACT_01` 28→49→41 / `Claude` 8→65→48 / `Gemini` 110→35 | `ACT_01` values; Act II gap filled 41→44; I/III seam closed |
| 2 | Roll magnitude | `ACT_01` 0.18° / `ACT_2` 2.4° / `Gemini` 4.5° | 0.18 dive, 2.4 orbit peak, 0.00 at breach |
| 3 | Light count | `ACT_01` max 4 / `ACT_3` 3–5 + directional | Hard cap 4 |
| 4 | Canvas mount | `PHASE_5` `(experience)` / `Claude` + `Gemini` root | `(experience)/layout.tsx` — deletes the 404 workaround |
| 5 | Route slot | `PHASE_6` `@modal` / `Gemini` `@overlay` + dynamic slot | `@modal`, per-slug interceptors; Gemini's dynamic slot cannot intercept |
| 6 | `demand` vs `never` | `ACT_01` + `PHASE_6` demand / `ACT_4` never | Both: demand running, never frozen |
| 7 | Freeze ordering | `gpt` freeze→capture / `PHASE_6` capture→freeze / `Claude` same tick | Same `onAfterRender` tick |
| 8 | Disposal | `Gemini` aggressive / `Claude` none / `gpt` tiered | gpt's tiers; never `renderer.dispose()` |
| 9 | Deep-link vs scroll | unspecified everywhere | URL wins until first scroll input |
| 10 | Consent granularity | `PHASE_7` binary / `Claude` flags GDPR | Three toggles |
| 11 | Sub-bass frequency | 25 / 32–38 / 34 / 42 / 45 Hz across sources | §3 table + harmonic reinforcement |
| 12 | Act IV FOV | `ACT_4` 38→37 / `Gemini` 38→12 | 38→37; 12° is a zoom, not a push |
| 13 | Act I opening | `Claude` macro detail / `Gemini` aerial | Macro detail; aerial gives away scale in frame one |
| 14 | Scroll length | unspecified everywhere | 1000vh / 800vh + the 12 m/viewport invariant |
| 15 | Mobile | absent from all 11 | §9.4 |
| 16 | `preserveDrawingBuffer` | absent from all 11 | Not set; capture inside `onAfterRender` |
| 17 | Sub-bass audibility | absent from all 11 | Harmonic reinforcement (§9.5) |
| 18 | Anchor registry | `PHASE_5` "hardcoded dictionary" | **Overturned.** Sockets in code, partners in DB (§6.1a) — partner churn must never be a redeploy |
| 19 | Data residency | absent from all 11 | Supabase in `eu-central-1` (§8.2a) — India is not EU-adequate and the lead form collects personal data |
| 20 | Consent audit trail | `PHASE_7` had UI only | `consent_ledger` table (§8.2a) — GDPR requires *demonstrable* consent, not just honoured consent |
| 21 | Act II subject | all 11 assumed one estate | The Land — farmland and plots (§1, §5) |
| 22 | L7 metric | spec said 12 m/viewport absolute | **Relative** — 2% of viewing distance per 5% scroll. Absolute cannot serve 690 m and 2.6 m in one narrative |
| 23 | Global ease on `q` | spec §3.1 required one | **Removed.** It displaced every beat; the Act IV pause landed at q 0.65 instead of 0.75. Beat spacing is the velocity design |
| 24 | Fog scale | spec authored for estate scale | Rescaled per beat against real viewing distance — seven beats were rendering 100% fogged |
| 25 | Tone mapping location | spec §5: "material shader, **not** a composer pass" | **Overturned — it was happening nowhere.** `@react-three/postprocessing` forces `NoToneMapping` on mount, so three compiled the tone map out of every material. Nothing rolled off, and the whole EV column of §3 was inert because `toneMappingExposure` is only read inside a tone mapping function. Now ACES once, in `SplitTone`, after bloom |
| 26 | Colour grade | absent from all 11 | Three-band split-tone derived from the four client reference frames (§5 Act I, `src/lib/grade.ts`). Highlight band carries **two** tints selected per pixel — the references contain warm point sources and cool atmosphere, and one tint cannot serve both |
| 27 | Warm sources | spec forbade a "global orange filter" but never said where warmth *may* live | **Exactly one place: the villa practicals.** Sky ember, key light, hemisphere ground, water glint and the Act II grid were all warm and all outside the villa. Now gated per colour literal by `grade-check.mjs` |
| 28 | Act I subject | spec said "corridor" but the build showed bare terrain | The real geography — NH-16, Bhogapuram, district roads, ~620 industrial buildings. All shader-drawn or instanced; 30 draw calls total (§5 Act I Geography) |
| 29 | Acoustic ramp | table held `hz: 34` across **ten** consecutive keyframes (q 0 → 0.58) | **34 → 42 at the breach → 36 at the collapse → 0.** The flat run passed every existing continuity check, because a flat channel has no jumps and no C1 breaks: continuity is necessary, not sufficient. `continuity-check.mjs` now asserts the ramp's *shape*, not just its smoothness |

---

## APPENDIX B — FAILURES ALREADY PAID FOR

All four from `apps/public` in this repository. None are hypothetical.

**1. Two rAF loops.** Lenis ran its own rAF while R3F ran another. Two loops
reading and writing the same scroll position within a frame have no defined order;
on frames where R3F ran first the camera sampled the *previous* frame's scroll. The
canvas lagged the DOM by one frame, intermittently. Invisible in code review,
reported by the client as "floaty and uncoordinated." → **L1.**

**2. Scroll track lengthened without lengthening the camera path.** The track grew
6× to fix pacing; the camera path stayed at 12 m. Travel per screen dropped to a
sixth and the camera was reported as completely frozen — while moving correctly.
→ **L7.**

**3. Per-segment easing.** `power4.inOut` applied to each spline leg individually.
An `inOut` ease has zero derivative at *both* ends, so velocity hit zero at every
waypoint — five brakes in what was meant to be one continuous sweep. → **§3.1, one
continuous ease.**

**4. Double tone mapping.** A `ToneMapping` composer pass added on top of three's
in-shader ACES. Produced the "radioactive glare" rejection. → **Act I,
post-processing order.**

---

*End of specification. Everything above is load-bearing. If a decision here looks
arbitrary, Appendix A records what it replaced and why.*
