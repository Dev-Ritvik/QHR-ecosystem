I'll begin the forensic audit. Read-only throughout — no edits, no commits, no mutations.

Working tree clean, HEAD `8925521`. Now mapping the workspace.

`apps/monolith` is gone from the tree — confirmed out of scope. Reading manifests and mapping the full `apps/public` tree.

`WorldCanvas.tsx` at 943 lines is the center of gravity. Reading the experience layer in full.

`WorldCanvas` is substantive and clearly the live scene. Now checking which experience components are actually wired vs. orphaned.

Confirmed: `ExperienceCanvas.tsx` is orphaned — the host's local const shadows the name but resolves to `WorldCanvas`. Now the route layer.

Critical: there is **no root `page.tsx`** anywhere. Checking whether middleware rewrites `/`.

`/` is rewritten to `/site-home` by middleware. Now reading the remaining experience components in bulk.

Now the asset audit — this is where the mobile budget lives.

Running non-mutating verification: typecheck and lint (both write only to gitignored paths).

`git grep` hit `.ignored_node_modules` — meaning it's tracked. Verifying.

Continuing the audit — error boundaries, interaction, and data integrity.

Now attempting a production build to get the authoritative route table and bundle sizes.

Build is green. Two things stand out: five `(experience)` pages are byte-identical in size, and the project routes carry 435 kB. Investigating both.

The build prerendered `/site-home` against the live projection DB. Reading that output reveals the actual data state.

Correction: the projection DB does hold the three real projects — my earlier concern about wrong project rows was wrong. Checking unit-level data and 3D chunk weight.

`.claude/launch.json` already has a `public` config — no file creation needed. Starting it for runtime verification of the open questions.

Server is up and `/` → `/site-home` rewrite is confirmed working (200). Retrying the browser.

`usePathname()` returns `/` — so the home page resolves to `arrival`/exterior, not the 15 MB hall. Checking asset loading and console.

Canvas is 300×150 (uninitialized default) and **zero** model/texture requests. Investigating whether the scene is actually running.

Canvas parents are correctly sized (1265×720) yet the canvas is stuck at 300×150 with zero model fetches. Re-testing cleanly, allowing for dev-mode lazy compilation.

This is decisive — but I must rule out the preview browser itself. Testing WebGL capability directly.

Reproduced: a single `resize` event brings the canvas from 300×150 to 1581×900 and immediately starts the GLB fetch. Before ruling it a real defect, I must exclude a hidden-tab artifact.

The tab was **hidden** — that alone suppresses ResizeObserver, which fully explains the 300×150 canvas. Fronting the tab and retesting.

Confirmed artifact: the Browser pane can't be displayed in this session, so the page never composites and ResizeObserver never fires. Not a site defect — but it did expose a real preloader/visibility interaction I'll document. Stopping the server.

The dev server replaced the production `.next` output, so runtime meta verification is no longer available — the SEO findings below are source-verified. Final consolidation checks.

One last check the brief specifically asks for — declared vs. actually imported dependencies.

A production API route launches headless Chromium. Reading it.

Audit complete. Repository unmodified — no files created, edited, or deleted; no commits; branch and working tree unchanged.

---

# 1. EXECUTIVE SUMMARY

- `apps/monolith` is **absent from the tree**. Only `apps/crm` and `apps/public` exist. Confirmed out of scope, nothing to restore.
- `apps/public` is a **Next.js 14.2.35 App Router** app. Typecheck passes clean (exit 0), lint yields **7 warnings / 0 errors**, and `next build` **succeeds** — 33 routes generated. This is a working codebase, not a broken one.
- The WebGL experience is **genuinely architected, not decorative**: one persistent `<Canvas>` mounted by a route-group layout that App Router never unmounts, so navigation re-frames the camera instead of reloading a scene.
- The live scene component is **`WorldCanvas.tsx` (943 lines)**. `ExperienceCanvas.tsx` (158 lines) is **dead code** — the host's local `const ExperienceCanvas` shadows the name but resolves to `WorldCanvas`.
- `/` is served by **middleware rewrite** to `/site-home`. There is **no root `page.tsx` anywhere**. Verified at runtime: `location.pathname === "/"`, so the camera resolves to `arrival` → **exterior** set. The 15 MB hall is *not* loaded on the home page.
- **Asset weight is the dominant risk.** `interior_hall.glb` is **14.38 MB**, of which **12.52 MB is 28 KTX2 textures** (6.35 MB of that is normal maps alone). `exterior_mansion.glb` is 2.31 MB.
- Home-page cost to first 3D frame ≈ **150 KB initial JS + ~365 KB gzipped lazy 3D JS + 2.31 MB GLB + 2.74 MB textures**.
- **`maplibre-gl` is 1,012 KB raw / 265 KB gzipped**, driving `/projects/[slug]` to **435 kB First Load JS** and `/p/[slug]` to **491 kB**.
- **`/api/brochure/*` launches headless Chromium per request**, unauthenticated, unrated-limited, with `--no-sandbox`, and **`browser.close()` outside a `finally`** — a process leak on any throw.
- **`useScrollProgress()` is instantiated 3×** inside the canvas (`CameraRig`, `ExteriorLighting`, `Terrain`) — 3 duplicate `useFrame` loops, 3 scroll listeners, and **3 `ResizeObserver`s on `document.body`**.
- **~12 `useFrame` callbacks per frame** on the home page, including a **full-scene recursive raycast every 0.5 s** in `SpatialTelemetry`.
- `Terrain` builds a **321×321 vertex / 204,800-triangle** `PlaneGeometry` imperatively in `useMemo`; it is **never explicitly disposed** and is recreated on every exterior↔interior transition.
- **`SceneFallback` is unreachable**: rendered inside `aria-hidden="true"` at `z-0`, beneath the `z-10` content layer. It contains a focusable `<Link>` inside an aria-hidden subtree — a WCAG violation, and the designed fallback never actually presents.
- **SEO is materially incomplete**: no `metadataBase`, no `openGraph`, no `twitter`, no canonical, **no JSON-LD anywhere**, and the two **project routes — the highest commercial value pages — have no metadata at all**.
- **`/projects/[projectSlug]` is a light-theme Tailwind page** (`text-gray-900`, `bg-gray-50`) outside the `(experience)` group. No canvas, no dark palette — a hard visual break from the rest of the site.
- **`/properties` and `/locations` are fully hardcoded**, deliberately not DB-backed. The source states the projection holds unit inventory for *unrelated* projects. Project-level rows are correct (verified: the three real slugs prerendered).
- **`apps/public/.ignored_node_modules/` is committed to git**: **10,588 tracked files — 92 % of the repo's 11,466**. `.gitignore`'s `node_modules` pattern does not match the leading dot.
- **Public-site E2E coverage is zero.** Playwright `testDir: './e2e'` contains one spec, and it tests the **kiosk**. `apps/public` has **no `test` script**, so `turbo run test` skips it entirely.
- Scroll track is **10,894 px measured at a 720 px viewport ≈ 15.1 viewports**; `min-h-[10000px]` is a hard floor, so mobile pays the same.
- **Runtime visual verification could not be completed** — the Browser pane cannot be displayed in this session, so the page never composites. Everything visual is marked accordingly.

---

# 2. REPOSITORY FACTS

Verified by command, not documentation.

| Fact | Value |
|---|---|
| Repository root | `C:/dev/estate` |
| Branch | `main` |
| HEAD | `8925521050544fdfc273326d3ef3005f0c072c20` |
| Working tree | **Clean** (`git status --porcelain` empty) |
| HEAD subject | `Update: CRM canvas UI components, cleanup monolith, update dependencies` |
| HEAD date | Fri Aug 21 17:22:00 2026 +0530 |
| Node (running) | **v24.11.1** |
| npm | 11.6.2 |
| Declared PM | `pnpm@9.1.0`; engines `node >=20`, `pnpm >=9` |
| Workspaces | `apps/*`, `packages/*` → `apps/crm`, `apps/public`, `packages/db`, `packages/domain`, `packages/ui` |
| Build orchestrator | Turborepo `^2.0.0` |
| `apps/monolith` | **Does not exist** |

### Versions resolved from installed `node_modules` (not manifests)

| Package | Version |
|---|---|
| `next` | 14.2.35 |
| `react` / `react-dom` | 18.3.1 |
| `three` | **0.173.0** |
| `@react-three/fiber` | **8.18.0** |
| `@react-three/drei` | 9.122.0 |
| `@react-three/postprocessing` | 2.19.1 |
| `postprocessing` | 6.39.3 |
| `gsap` | 3.15.0 |
| `lenis` | 1.3.26 |
| `zustand` | 5.0.14 |
| `maplibre-gl` | 5.24.0 |
| `@supabase/supabase-js` | 2.110.4 |
| `leva` (dev) | 0.10.1 |
| `r3f-perf` (dev) | 7.2.3 |
| `@playwright/test` (dev) | ^1.61.1 |
| `vitest` (domain) | ^1.6.0 |

### Declared vs imported vs used

| Package | Declared | Imported in `src/` | Status |
|---|---|---|---|
| `three` | dep | 9 files | **used** |
| `@react-three/fiber` | dep | (via drei/three files) | **used** |
| `@react-three/drei` | dep | 4 files | **used** |
| `@react-three/postprocessing` | dep | 1 file (`PostFX.tsx`) | **used** |
| `postprocessing` | dep | **0** | **transitive peer only — never directly imported** |
| `gsap` | dep | 2 files | used (ticker + `parseEase`) |
| `lenis` | dep | 1 file | used |
| `zustand` | dep | 1 file | used |
| `maplibre-gl` | dep | 7 files | used |
| `@estate/ui` | dep | **0 in `src/`** | **only via `tailwind.config.ts` preset** |
| `leva` | devDep | **0** | **DECLARED, NEVER IMPORTED** |
| `r3f-perf` | devDep | **0** | **DECLARED, NEVER IMPORTED** |
| `playwright` | **runtime `dependency`** | 1 file (`api/brochure`) | **used at runtime — see §19** |

### Verification results

- `npx tsc --noEmit` → **exit 0**, and `--incremental false` → **exit 0**. `strict: true` (`tsconfig.base.json`).
- `npx next lint` → **7 warnings, 0 errors** (5× `no-img-element`, 2× `exhaustive-deps`).
- `npx next build` → **succeeded**, 33 routes.

---

# 3. ROUTE MAP

No root `page.tsx` exists. `src/middleware.ts:78` rewrites `/` → `/site-home`; `:70` rewrites `present.*` host `/` → `/present-home`.

### `(site)/(experience)` — persistent WebGL canvas, dark theme

Layout: `src/app/(site)/(experience)/layout.tsx` — **Server Component**, mounts `<ExperienceCanvasHost />` (client leaf) + `<div className="relative z-10">{children}</div>`.

| Route | File | Boundary | WebGL place → set | Data | Render |
|---|---|---|---|---|---|
| `/` → `/site-home` | `site-home/page.tsx` | Server, `revalidate=3600` | `arrival` → **exterior**, `path:true` | `getPublishedProjects()`, try/catch → `[]` | ○ Static |
| `/hall` | `hall/page.tsx` | Server | `hall` → **interior (14.38 MB)** | hardcoded `PROJECTS` | ○ Static |
| `/properties` | `properties/page.tsx` | Server | `table` → interior | **hardcoded `INVENTORY`** | ○ Static |
| `/locations` | `locations/page.tsx` | Server | `window` → interior | **hardcoded `SITES`** | ○ Static |
| `/branches` | `branches/page.tsx` | Server | `window` → interior | hardcoded `BRANCHES` | ○ Static |
| `/start-here` | `start-here/page.tsx` | Server | `arrival` → exterior | hardcoded | ○ Static |
| `/about`, `/why-us`, `/testimonials` | — | Server + `Surface` client | `approach` → exterior | static copy | ○ Static |
| `/contact`, `/careers` | — | Server + `Surface` | `desk` → interior | static | ○ Static |
| `/investment-guide`, `/knowledge`, `/knowledge/reading-a-layout-plan`, `/faqs`, `/downloads` | — | Server + `Surface` | `study` → interior | static / local PDFs | ○ Static |
| `/gallery` | `gallery/page.tsx` | Server + `Surface` | `hall` → interior | local JPEGs | ○ Static |
| `/privacy`, `/terms`, `/refund-policy` | — | Server + `Surface` | `study` → interior | static, **`robots: {index:false}`** | ○ Static |
| `/cookie-policy` | — | Server + `Surface` | `study` → interior | static | ○ Static |
| — | `error.tsx` | Client | — | segment error boundary | — |

### `(site)/projects` — **outside `(experience)`: no canvas, light theme**

| Route | File | Boundary | Data | Render |
|---|---|---|---|---|
| `/projects/[projectSlug]` | `projects/[projectSlug]/page.tsx` | Server | 5 parallel projection reads | **ƒ Dynamic, 435 kB** |
| `/projects/[projectSlug]/[unitSlug]` | `[unitSlug]/page.tsx` | Server | projection | **ƒ Dynamic, 428 kB** |
| OG image | `opengraph-image.tsx` | Node runtime | projection | ƒ Dynamic |

### `(present)` — staff kiosk, `present.*` host

`/present-home` (ƒ), `/p/[projectSlug]` (ƒ, **491 kB**), `/enroll` (○).

### API + metadata

`/api/brochure/[projectSlug]/[unitSlug]` (ƒ), `/api/health/demo-path` (○), `/api/privacy` (ƒ), `/api/revalidate` (ƒ), `/api/telemetry` (ƒ), `/robots.txt` (○), `/sitemap.xml` (○), `/icon.svg` (○), `/_not-found` (○).

**Missing special files:** no `not-found.tsx` **anywhere** (so `notFound()` from project routes renders Next's default unstyled page), no `loading.tsx` anywhere, no `error.tsx` outside `(experience)`.

---

# 4. EXPERIENCE ARCHITECTURE

### Runtime chain

```
(site)/layout.tsx  [ConsentProvider → PostHogProvider → TelemetryProvider → SiteHeader/Footer/CursorRing/ConsentPanel]
  └─ (site)/(experience)/layout.tsx  [SERVER]
       ├─ ExperienceCanvasHost  ['use client']
       │    ├─ SmoothScroll                → Lenis on gsap.ticker
       │    ├─ dynamic(ssr:false) WorldCanvas
       │    └─ dynamic(ssr:false) Preloader
       └─ <div class="relative z-10">{page}</div>
```

`ExperienceCanvasHost.tsx:18-24` — the constant is named `ExperienceCanvas` but imports `./WorldCanvas`. This is why `ExperienceCanvas.tsx` appears used and is not.

### `WorldCanvas` internal tree (`WorldCanvas.tsx:853-941`)

```
<div aria-hidden fixed inset-0 z-0 bg-#0A1120>
  <SceneBoundary onError>                      class component, getDerivedStateFromError
    <Canvas shadows dpr gl camera>
      <color background #0A1120>
      <CameraClipping set>                     near/far per set, updateProjectionMatrix
      <Exposure value>                          gl.toneMappingExposure on every change
      <ambientLight intensity={look.ambient}>
      {set==='exterior' && (
        <ExteriorLighting driveByScroll>        fog + 2 dir + 3 rectArea + 2 point + hemi
        <Motes count={tier==='low'?1100:2400}>
        <Terrain />
        {pose.path && <SpatialCards cards>}     zustand store
      )}
      <Suspense fallback={null}>
        {set==='exterior' ? <ExteriorModel/> : <HallModel/>}
        <RoomEnvironmentMap intensity={look.env}>
      </Suspense>
      {look.free ? <FreeCamera/> : <Rig place onTier/>}   Rig = CameraRig + SpatialTelemetry
      {!look.free && <PostFX tier/>}            LAST child, deliberate
    </Canvas>
  </SceneBoundary>
  <div scrim linear/><div scrim radial/>        pointer-events-none z-[1]
</div>
```

### Component forensics

**`WorldCanvas` (943 lines)** — PURPOSE: persistent world host. INPUTS: `usePathname()`. STATE: `tier`, `failed`, `supported`, `look`. OUTPUTS: canvas + 2 DOM scrims. DEPS: three, r3f, gsap, domain `places`/`device-tier`. COST: owns everything below. STATUS: **live, primary**. RISKS: `supported` probed in `useEffect` (`:841`) so first render always attempts the canvas; on `supported===false` returns an aria-hidden `z-0` fallback (§8).

**`ExperienceCanvasHost` (43 lines)** — client boundary quarantining `ssr:false`. **live**.

**`ExperienceCanvas` (158 lines)** — Slice-0 persistence probe with `data-testid="persistence-probe"`, `probe-ctx`, `probe-gen`, a drifting copper orb, `console.warn('[ExperienceCanvas] WebGL context lost')`. **DEAD — zero importers.** It is the *only* place `persistence-probe` exists, and the only place a `webglcontextlost` handler exists.

**`ExteriorModel` (289 lines)** — loads `/models/exterior_mansion.glb` with explicit `'/draco/'`. `scene.clone(true)` in `useMemo`. `applyGrade()` mutates shared materials (guarded by `__graded`/`__pbr`), sets `castShadow`/`receiveShadow` per mesh, **hides `ground_plane`** (`:182`) in favour of `<Terrain/>`, applies emissive + PBR maps from module-level `TEX_CACHE`. Emits `console.info('[exterior_ready] …')` (`:276`) **in production**. **live**.

**`HallModel` (164 lines)** — loads the 14.38 MB GLB; `attachLoaders()` shares KTX2/DRACO singletons; `promoteLightmaps()` moves `aoMap`→`lightMap`, sets `SRGBColorSpace`, `lightMapIntensity = 4.6597`. Emits `console.info('[hall_ready] …')` (`:138`). **live** (interior routes only).

**`Motes` (175 lines)** — one `THREE.Points`, GPU-displaced, additive, `depthWrite:false`, manual `boundingSphere`, `frustumCulled={false}`. One uniform write/frame. **live, cheap, well-built.**

**`Terrain` (293 lines)** — runtime `PlaneGeometry(460,460,320,320)`, custom ridged-multifractal vertex displacement + `dFdx/dFdy` face normals in the fragment stage. **live.** RISK: 204,800 tris, no disposal (§11).

**`PostFX` (155 lines)** — tier-gated `EffectComposer`. `low` → Vignette only. `mid` → Bloom + Vignette. `high` → Bloom + DOF + GodRays + Vignette, plus a `SunDisc` mesh mounted **outside** the composer. **live.**

**`Preloader` (160 lines)** — `useProgress()` from drei, monotonic `peak`, waits for `active===false`, 12 s ceiling + 2.5 s idle failsafe, locks `documentElement.overflow`. **live.** RISK: §8.

**`SpatialCards` (239 lines)** — 3 `<Html transform occlude="blending">` CSS3D cards at fixed world anchors, distance-banded opacity, one `useFrame` **per card**. **live on `/` only.**

**`SceneFallback` (52 lines)** — designed no-WebGL state listing hardcoded `PROJECTS`. **live but unreachable** (§8).

**`SmoothScroll` (79 lines)** — Lenis `lerp:0.1`, `syncTouch:false`, driven from `gsap.ticker` with `lagSmoothing(0)`, restored on unmount. Exports mutable `lenisInstance`. **live.**

**`Surface` (128 lines)** — used by **17** routes. Focus on mount, Escape to close, history-aware close. **live.**

**`PublishSceneCards` (25 lines)** — writes server data into the zustand store, clears on unmount. **live** (`site-home` only).

**`NodePanel` (57 lines)** — **DEAD.** Zero references of any kind.

**`Pending` (`Pending`, `PendingNotice`, `pendingRobots`)** — **live**, used by `/privacy`, `/terms`, `/refund-policy`; supplies `robots:{index:false,follow:false}`.

---

# 5. WEBGL / RENDERING AUDIT

All values read from source, not library defaults.

| Setting | Value | Evidence |
|---|---|---|
| Renderer | r3f `<Canvas>` → `THREE.WebGLRenderer` | `WorldCanvas.tsx:858` |
| WebGL2 assumption | **Hard `webgl2` probe**; `webgl1` never attempted | `:449-456` |
| Antialias | `tier !== 'low'` | `:868` |
| DPR | `[1, tier==='high' ? 2 : 1.5]` | `:866` |
| Power preference | `'high-performance'` | `:869` |
| Tone mapping | `ACESFilmicToneMapping`, stated explicitly | `:874` |
| Exposure | interior **0.6**, exterior **1.0**; reapplied on every change via `<Exposure>` | `:476-514`, `:777-783` |
| Output color space | **Not set** — three r152+ default `SRGBColorSpace` | not in source |
| Color management | **Not set** — relies on three default `enabled=true` | not in source |
| Shadows | `tier==='low' ? false : { type: PCFSoftShadowMap }` | `:863` |
| Shadow map size | `2048×2048`, single directional light | `:675` |
| Shadow frustum | ortho `L-26 R26 T26 B-14`, near 1 far 140 | `:679-684` |
| Shadow bias | `-0.0006`, normalBias `0.03` | `:685-686` |
| Physically-correct lights | **Not set**; `decay={2}` used on point lights | `:743`, `:746` |
| Fog | `THREE.Fog('#0A1120', 34, 190)`, **animated per frame** to `atmosphereAt(scroll)` | `:615`, `:627-636` |
| Clip planes | interior `0.1/60`, exterior `0.5/600`, pushed onto live camera | `:525-528`, `:757-765` |
| FOV | animated 50→68→62→44→48 via `lensAt()`, guarded by `>0.01` delta | `:323-326` |
| Roll / bank | `camera.rotateZ(lens.roll)` **after** `lookAt` | `:332` |
| Environment | `RoomEnvironment` + `PMREMGenerator`, `fromScene(room, 0.04)`, disposed on unmount | `:803-827` |
| MSAA | **Not configured** — `EffectComposer` default | `PostFX.tsx:81` |
| Bloom | `intensity 0.62`, `luminanceThreshold 0.85`, `smoothing 0.28`, `mipmapBlur` | `PostFX.tsx:86-91` |
| DOF | **high tier only**; `target={SUBJECT}`, `focalLength 0.028`, `bokehScale 0.9`, `height 480` | `:109-118` |
| GodRays | **high tier only**; `density .62 decay .88 weight .16 exposure .12 samples 44 clampMax .55 blur` | `:137-150` |
| SSAO | **Absent** | — |
| Vignette | all tiers; `offset .3/.32`, `darkness .66/.62` | `:71`, `:151` |
| Chromatic aberration | **Absent** | — |
| Noise / grain | **Absent** as a pass; procedural `micro` grain in the terrain fragment shader only | `Terrain.tsx:208-211` |
| ToneMapping effect | **Deliberately absent** — three tone-maps in-material; a second pass would double-map | `PostFX.tsx:7-19` |
| Custom shaders | 2 — `Terrain` (VERT+FRAG), `Motes` (VERT+FRAG) | — |
| Render targets | 1 PMREM cube (disposed) + composer-internal | — |
| Resize | delegated entirely to r3f's `react-use-measure` | — |
| **Context loss** | **NOT HANDLED in the live path.** The only `webglcontextlost` listener in the repo is in the **dead** `ExperienceCanvas.tsx:133` | **gap** |
| **Context restore** | **NOT HANDLED anywhere** | **gap** |

---

# 6. SCENE GRAPH

### Exterior set (`/`, `/start-here`, `/about`, `/why-us`, `/testimonials`)

| Node | Type | Detail |
|---|---|---|
| Scene root | r3f | `background = #0A1120`, `fog = Fog(#0A1120, animated)` |
| Architecture | imported GLB clone | `exterior_mansion.glb` — **119 meshes / 119 primitives / 129,471 tris / 10 materials / 11 JPEG textures** |
| Terrain | procedural mesh | `PlaneGeometry(460,460,320,320)` = **204,800 tris / 103,041 verts**, `ShaderMaterial`, `frustumCulled={false}`, `receiveShadow={false}` |
| Ground (GLB) | hidden | `mesh.visible = false` for `ground_plane*` (`ExteriorModel.tsx:182`) |
| Motes | `THREE.Points` | 2,400 (1,100 low), additive, `depthWrite:false`, `renderOrder={2}` |
| Sun disc | `MeshBasicMaterial` sphere | `r=4.2, 20×20 segs` at `(30,15,-80)`, `frustumCulled={false}`, `toneMapped={false}` — **high tier only** |
| Key light | `directionalLight` | `(30,15,-80)`, `#FFB264`, intensity animated 2.3→2.75, **castShadow** |
| Rim light | `directionalLight` | `(34,22,-40)`, `#7FB4D6`, 0.85, no shadow |
| Window spill | `rectAreaLight` ×3 | `(-6.2/0/6.2, ~2.3, 6.35)`, `#FFAA55`/`#FFB068` |
| Side wash | `pointLight` | `(10.9,2.5,0)`, i5.6, `distance 18`, `decay 2` |
| Fountain uplight | `pointLight` | `(0,1.1,13.2)`, i4.4, `distance 14`, `decay 2` |
| Sky/ground | `hemisphereLight` | `#4A6B96` / `#1A1512`, 0.5 |
| Ambient | `ambientLight` | 0.06 exterior / 0.12 interior |
| Camera | `PerspectiveCamera` | seeded `[0,1.65,30]` fov 45; driven by `POSITION_CURVE`/`TARGET_CURVE` |
| Spatial UI | 3 × `<Html transform>` | CSS3D at `[24,8.5,24]`, `[27,5.5,8]`, `[21,3,-10]`, `occlude="blending"` |
| Environment | PMREM cube 256 | `RoomEnvironment`, `environmentIntensity = 0.45` |
| Debug | `FreeCamera` | behind `?free=1`, `OrbitControls`, logs poses |

**Exterior frame totals:** ~119 GLB draw calls + terrain + motes + sun ≈ **122 base draws**, plus a shadow depth pass over every `castShadow` mesh (all but ground) ≈ **~118 more** → **~240 draws/frame**.

### Interior set (`/hall`, `/properties`, `/locations`, `/branches`, and every `Surface`)

| Node | Detail |
|---|---|
| Architecture | `interior_hall.glb` — **212 meshes / 218 primitives / 148,220 uploaded tris / 34 materials / 28 KTX2 / 504 nodes** |
| Manifest-declared | `drawn_triangles: 480,385`, `vertices_uploaded: 214,328`, `vertices_rendered_per_pass: 1,438,890`, `shell_objects_lightmapped: 147` |
| Lighting | **Baked lightmap only** (`aoMap`→`lightMap`, ×4.6597) + `ambientLight 0.12` |
| Not lightmapped | 153 anthemions, 54 balusters, 11 capitals, 6 newels (instanced) |
| Terrain/Motes/Cards | **Not mounted** — exterior-only |
| Environment | PMREM, `environmentIntensity = 0.1` |
| Interactive objects | `holo3d_(S1|S2|S3)_*` — raycast-detected by name regex (`WorldCanvas.tsx:112`), **telemetry only, no click handler** |

Disposal strategy: **none explicit** for `Terrain`/`Motes` geometry or the cloned model roots; only the PMREM target is disposed.

---

# 7. ASSET AUDIT

`apps/public/public` total **24 MB**, 30 files.

### 3D models

| File | Bytes | MB | Format |
|---|---|---|---|
| `models/interior_hall.glb` | 15,078,360 | **14.38** | glTF 2.0 binary |
| `models/exterior_mansion.glb` | 2,426,892 | **2.31** | glTF 2.0 binary |

**`interior_hall.glb`** — generator `glTF-Transform v4.4.2`. `extensionsRequired`: `KHR_draco_mesh_compression`, `KHR_lights_punctual`, `KHR_texture_basisu`, `KHR_texture_transform`. 212 meshes, 218 primitives, **148,220 triangles**, 504 nodes, 34 materials, 30 textures, **28 images (100 % `image/ktx2`)**, 2 samplers, 0 animations, 0 cameras, 0 skins. BIN chunk 14,847,984 B = **98.5 %** of file. Loaded **lazily**, only on interior routes, via `HallModel`.

**Texture breakdown (13,131,480 B = 12.52 MB of the 14.38 MB):**

| Bytes | Image |
|---|---|
| 1,526,170 | `lightmap` (4096², ETC1S, sRGB) |
| 1,355,373 | `Carpet013_2K-PNG_NormalGL` |
| 1,352,520 | `normal` |
| 1,326,961 | `normal` |
| 1,110,922 | `Image_3` |
| 854,965 | `normal` |
| 767,991 | `normal` |
| 501,681 | `normal` |
| 498,292 | `normal` |
| …19 more | 284,102 → 93,824 |

**7 normal maps alone = 6,657,783 B ≈ 6.35 MB (44 % of the entire file)** — a direct consequence of the manifest's UASTC choice for normals.

**`exterior_mansion.glb`** — generator `Khronos glTF Blender I/O v5.2.39`. Required: `KHR_draco_mesh_compression`, `KHR_texture_transform`. 119 meshes/primitives, **129,471 triangles**, 216 nodes, 10 materials, 11 textures, **11 JPEG images**, 0 animations. BIN 2,336,540 B = 96.3 %. Loaded on `/` — **on the critical path**.

### Loose textures — `public/textures/` (4 PBR sets, 12 JPEGs)

| Set | basecolor | normal | roughness | Subtotal |
|---|---|---|---|---|
| limestone | 439,703 | **792,707** | 93,498 | 1,325,908 |
| roof | 213,777 | 307,634 | 323,812 | 845,223 |
| gold | 129,121 | 60,786 | 174,277 | 364,184 |
| wood | 188,253 | 47,094 | 105,442 | 340,789 |
| **Total** | | | | **2,876,104 B ≈ 2.74 MB** |

Loaded eagerly-on-parse by `ExteriorModel.applyGrade()` via a module-level `TextureLoader` + `TEX_CACHE`, `anisotropy = 8`, `RepeatWrapping`. Because `TextureLoader` registers with `DefaultLoadingManager`, these **are** counted by the preloader.

### Decoders (unavoidable, correct to self-host)

`draco/draco_decoder.js` 719,410 · `draco/draco_decoder.wasm` 285,747 · `draco/draco_wasm_wrapper.js` 58,763 · `basis/basis_transcoder.wasm` 527,333 · `basis/basis_transcoder.js` 57,529 → **1,648,782 B ≈ 1.57 MB**

### Other

PDFs `downloads/` 3 files, 1,060,517 B (644,714 + 295,336 + 120,467). Gallery JPEGs 3 files, 1,071,331 B. Brand SVGs 3 files, 24,144 B. `models/interior_hall.manifest.json` 4,136 B. `sw.js` 3,669 B — **registered only by the kiosk** (`present/OfflineManager.tsx:17`), never by the public site.

### Oversized assets (flagged, not modified)

1. **`interior_hall.glb` — 14.38 MB.** The single largest liability. 87 % of it is textures.
2. **7 UASTC normal maps — 6.35 MB.**
3. **`textures/limestone/normal.jpg` — 792,707 B** — the largest loose file, on the home-page path.
4. `draco_decoder.js` 719,410 B — the `.wasm` path should dominate; the JS fallback is nearly as large.

---

# 8. LOADING / FALLBACK AUDIT

### Chain

```
GET /  → middleware rewrite → /site-home (SSR HTML, dark, real copy, real project cards)
  → next/font/google Inter + Playfair, self-hosted, display:swap
  → shared First Load JS 150 kB
  → ExperienceCanvasHost hydrates
      ├─ SmoothScroll: Lenis (skipped entirely under prefers-reduced-motion)
      ├─ dynamic import WorldCanvas  (~365 kB gzipped 3D chunks)
      └─ dynamic import Preloader
  → r3f measures container → creates renderer → sizes canvas
  → useGLTF('/models/exterior_mansion.glb')  2.31 MB  + draco_decoder.wasm 285 KB
  → applyGrade() → 12 loose JPEGs  2.74 MB
  → DefaultLoadingManager active=false → Preloader +220 ms → fade 900 ms → unmount
```

### Measured JS transfer (gzip -9, from `next build` output)

| Chunk | Raw | Gzip | Contents |
|---|---|---|---|
| `f2d2257c` | 329.3 KB | **76.2 KB** | three |
| `9446` | 292.8 KB | **94.9 KB** | three + drei + r3f |
| `5d2ab0b6` | 359.2 KB | **93.8 KB** | (3D path) |
| `3a58ca76` | 242.1 KB | **100.5 KB** | (3D path) |
| `eebbe23b` | 1,012.1 KB | **265.3 KB** | **maplibre-gl** |

**3D lazy JS ≈ 365 KB gzipped.** Home-page total to first lit frame ≈ **150 KB + 365 KB + 2.31 MB GLB + 2.74 MB textures + 285 KB draco ≈ 5.5 MB**.

### Suspense / boundaries

- `<Suspense fallback={null}>` wraps only the model + environment (`WorldCanvas.tsx:910-918`). **`fallback={null}` is correct here** because the Preloader is the visible state.
- `SceneBoundary` (`:431-447`) is a real class boundary — necessary, because a GLB parse throw inside Suspense otherwise hangs forever with nothing in the console.
- No `loading.tsx` at any route level.

### Preloader progress honesty — **it is honest**

`useProgress()` subscribes to `DefaultLoadingManager`, which counts the GLB, its Draco/KTX2 payloads, and the loose `TextureLoader` JPEGs. It waits for **`active === false`, not `progress === 100`** (`Preloader.tsx:53`) — correct, because Draco decode and KTX2 transcode finish on workers *after* the manager reports 100. `peak` is monotonic (`:42-44`) so the counter never runs backwards. This is a well-built loader.

### Failsafes — and the real defect they expose

Two mount-only timers (`Preloader.tsx:74-91`): a **12 s ceiling** and a **2.5 s idle** check reading through refs (`if (!activeRef.current && peakRef.current === 0) setDone(true)`).

**RUNTIME-OBSERVED, HIGH:** r3f only creates its root once `react-use-measure` reports a non-zero container. I observed a state where the canvas sat at its **300×150 HTML default with `__r3f` absent and zero asset requests**, while the Preloader had **already unmounted** (`peak === 0`, idle failsafe fired at 2.5 s) and the scroll lock had been released. Dispatching a single `resize` event immediately took the canvas to **1581×900** and started `exterior_mansion.glb` + `draco_wasm_wrapper.js` + `draco_decoder.wasm` + `limestone/roughness.jpg`.

**I traced the cause and it was NOT a site defect in my case:** `document.visibilityState === "hidden"` — the Browser pane could not be displayed in this session, so the page never composited and `ResizeObserver` never delivered. I am explicitly **not** reporting the blank canvas as a bug.

**What does survive as a real finding:** the *sequence* is reachable in production whenever the canvas is measured late — most obviously a **link opened in a background tab**, which is common. In that case the 2.5 s idle failsafe fires against `peak === 0`, the cover unmounts permanently (`gone` is one-way, `:107`), and when the tab is later focused the **2.31 MB GLB + 2.74 MB of textures download with no cover, no counter, and no indication at all**. The failsafe cannot distinguish "nothing to load" from "not measured yet". **RUNTIME VERIFICATION REQUIRED on a real device to confirm the background-tab path.**

### Fallback experience — **present in code, unreachable in practice**

`WorldCanvas.tsx:845-851`:

```jsx
if (supported === false || failed) {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0">
      <SceneFallback reason={…} />
    </div>
  );
}
```

Three compounding problems:
1. **`aria-hidden="true"`** — invisible to screen readers.
2. **`z-0`**, beneath the layout's `<div className="relative z-10">{children}</div>` — visually occluded by the real page.
3. `SceneFallback` contains a focusable `<Link href="/#enquire">` (`SceneFallback.tsx:43`) — **focusable content inside an `aria-hidden` subtree**, a WCAG 4.1.2 violation.

Mitigating: the DOM page behind it already carries the same commercial content, so no visitor is stranded. But the designed fallback **never presents**, and `SceneFallback` is effectively 52 lines of dead UI plus one a11y violation.

No retry, no timeout, and no `webglcontextlost` handling on the live path.

---

# 9. DEVICE / CAPABILITY AUDIT

**There are two independent capability systems, and the more capable one is not used by the WebGL experience.**

### System A — `useDeviceTier` + `@estate/domain/telemetry/device-tier` (**used by the canvas**)

| Signal | Detected? | Evidence |
|---|---|---|
| WebGL2 | Yes | `gl.capabilities.isWebGL2` (`useDeviceTier.ts:52`) |
| `deviceMemory` | Yes | `:27` |
| `hardwareConcurrency` | Yes | `:28` |
| `prefers-reduced-motion` | Yes | `:29-31` |
| **Measured frame time** | **Yes** — median of 90 frames after 30 warm-up frames | `:21`, `:44-63` |
| GPU tier / renderer string | **Deliberately not** | `device-tier.ts:6-9` |
| Network / `Save-Data` / `effectiveType` | **No** | — |
| DPR | **No** (used, not measured) | — |
| Viewport | **No** | — |
| Touch | **No** | — |

Decision (`device-tier.ts:41-70`): `webgl2===false` → low; `reducedMotion` → **low**; `deviceMemoryGb<=2` → low; `cores<=2` → low; then `medianFrameMs <= 18` → high (demoted to mid if `deviceMemoryGb < 4`), `>= 33` → low, else mid. Default before measurement: **`mid`**. Pure and **unit-tested** (`device-tier.test.ts`).

### System B — `lib/capability-probe.ts` (**NOT used by the public experience**)

Detects `connection.effectiveType`, `saveData`, `downlink`, `deviceMemory`, WebGL1, **`WEBGL_debug_renderer_info` GPU string**, and reduced-motion. Importers: `components/present/ProjectGrid.tsx:6` and `lib/prefetch.ts:2` — **both kiosk-only**. The public site therefore has **no network awareness and no `Save-Data` handling at all**, which is the single most relevant missing signal for the target audience.

### Do tiers actually change rendering? — **Yes, verified**

| Consumer | Effect | Line |
|---|---|---|
| `shadows` | `low` → **false** | `WorldCanvas.tsx:863` |
| `dpr` | `[1, high?2:1.5]` | `:866` |
| `antialias` | `tier!=='low'` | `:868` |
| `Motes count` | `low` → 1100, else 2400 | `:899` |
| `PostFX` | `low` → Vignette only | `PostFX.tsx:68-74` |
| `DepthOfField` | `high` only | `:109` |
| `GodRays` | `high` only | `:137` |

These are real, wired branches — not a utility that exists unused.

### Gaps

- **Tier never re-evaluates.** `settled` latches true (`useDeviceTier.ts:62`) and `reset()` is exported but **never called**. Thermal throttling mid-session cannot demote. Constraint #5 (graceful degradation by capability) is only satisfied for the first ~120 frames.
- **`dpr` is passed as a `<Canvas>` prop.** Because the canvas never unmounts, whether a later tier change actually re-applies DPR is **UNCERTAIN — RUNTIME VERIFICATION REQUIRED**.
- Reduced-motion is honoured in three places independently: tier→low, `SmoothScroll` early-returns (`:38-39`), `CursorRing` early-returns (`:35`), plus CSS `@media` rules. Consistent and correct.
- **The 14.38 MB hall is served identically to every tier.** No LOD, no low-tier model variant, no texture-resolution branch.

---

# 10. PERFORMANCE AUDIT

**No FPS measurements were taken. NOT MEASURED.** The Browser pane could not composite, so runtime frame timing was unavailable. Everything below is static analysis plus build-output measurement.

| # | Concern | Severity | Why |
|---|---|---|---|
| 1 | `interior_hall.glb` = **14.38 MB**, no LOD, no tier variant | **CRITICAL** | On a mid-tier Android over typical Indian 4G this is tens of seconds. Manifest declares 480,385 drawn tris and 1,438,890 verts/pass. Gates `/hall` and **every `Surface` route** (17 pages). |
| 2 | **No WebGL context-loss recovery** on the live path | **CRITICAL** | Loss is routine on mobile (backgrounding, thermal, GPU reset). Result is a permanently black canvas with no recovery and no fallback (§8). Violates non-negotiables #6 and #7. |
| 3 | `SceneFallback` unreachable (aria-hidden, z-0) | **CRITICAL** | The high-end fallback required by #7 does not present. |
| 4 | `useScrollProgress()` × 3 | **HIGH** | `CameraRig:179`, `ExteriorLighting:610`, `Terrain:230`. Each adds a `useFrame`, a `scroll` listener, a `resize` listener, and **a `ResizeObserver` on `document.body`**. Three body observers on a 10,894 px document. |
| 5 | **Full-scene raycast every 0.5 s** | **HIGH** | `WorldCanvas.tsx:393` — `intersectObjects(scene.children, true)` recurses **all 216 exterior / 504 interior nodes** with no layer mask and no `Raycaster.near/far`. Purely for telemetry; on interior routes it walks the entire 504-node graph. |
| 6 | `Terrain` 204,800 tris, `frustumCulled={false}` | **HIGH** | Always drawn in full. 5-octave ridged noise in the **vertex** stage over 103,041 verts, plus 3-octave `fnoise` + `dFdx/dFdy` in the **fragment** stage over a full-screen ground plane — a genuinely expensive fill on mobile. |
| 7 | maplibre-gl **265 KB gzipped** on `/projects/[slug]` | **HIGH** | 435 kB First Load JS on the most commercially important route. |
| 8 | Scroll track **10,894 px ≈ 15.1 viewports** (measured at 720 px) | **HIGH** | `min-h-[10000px]` is a floor, so mobile pays identically. 15 screens of scroll for 3 project cards. |
| 9 | ~**240 draw calls/frame** on `/` | **MEDIUM** | 119 GLB meshes + ~118 shadow-pass draws + terrain + motes + sun. Only 10 materials, so batching potential is unrealised. |
| 10 | ~**12 `useFrame` callbacks/frame** | **MEDIUM** | CameraRig, 3× scroll, SpatialTelemetry, useDeviceTier, ExteriorLighting, Terrain, Motes, 3× SpatialCards. |
| 11 | 3 × `<Html transform occlude="blending">` | **MEDIUM** | CSS3D + `occlude="blending"` forces depth sampling per card; each writes `style.opacity` and `style.pointerEvents` **every frame** (`SpatialCards.tsx:130-131`) — unconditional style writes, no change guard. |
| 12 | `scene.clone(true)` per mount | **MEDIUM** | 216 / 504 `Object3D` allocations per mount. Geometry and materials are shared (correct), but node churn is real on repeated navigation. |
| 13 | `backdrop-filter: blur(20px)` on 3 CSS3D cards | **MEDIUM** | `SpatialCards.tsx:156-157` — compositing a 20 px blur over a live canvas is among the most expensive mobile operations. |
| 14 | 4 `pointermove` listener sets | **MEDIUM** | `CameraRig:199` (window, gated `pointer: fine`), `SpatialTelemetry:370-371` (canvas, `pointermove` **+ `pointerdown`**, ungated), `CursorRing` (rAF). Each does `getBoundingClientRect()` **per event** — a forced layout read on every pointer move. |
| 15 | `RectAreaLight` × 3 | **MEDIUM** | `RectAreaLightUniformsLib.init()` at module scope (`:85`). RectArea lights are the most expensive analytic light type in three and are not tier-gated. |
| 16 | GodRays = second scene render + 44-sample radial blur | **MEDIUM** | Correctly `high` only. |
| 17 | `Motes` `frustumCulled={false}` + manual boundingSphere | **LOW** | Deliberate and documented; 2,400 additive points is cheap. |
| 18 | `console.info` in production | **LOW** | `[exterior_ready]` (`ExteriorModel.tsx:276`), `[hall_ready]` (`HallModel.tsx:138`). Leaks mesh/tri counts and bounding boxes. |
| 19 | Per-frame allocation in `useFrame` | **NONE — verified good** | All scratch vectors pre-allocated (`WorldCanvas.tsx:211-216`, `SpatialCards.tsx:227-228`). `updateProjectionMatrix` guarded by `>0.01` delta (`:323`). Explicitly documented. |
| 20 | Duplicated render loops | **NONE — verified good** | Lenis is driven from `gsap.ticker`, not its own rAF (`SmoothScroll.tsx:64-66`), with `lagSmoothing(0)` and correct restore. Deliberately *not* wired to ScrollTrigger, with a documented reason. |
| 21 | React state at scroll frequency | **NONE — verified good** | `useScrollProgress` returns a **ref**; zero re-renders while scrolling. |
| 22 | Asset duplication | **NONE** | `TEX_CACHE` (`ExteriorModel.tsx:143`) and KTX2/DRACO singletons (`HallModel.tsx:32-33`) prevent it. `useGLTF.preload()` correctly **removed** with a documented reason (`HallModel.tsx:154-165`). |
| 23 | Tier cannot demote after settling | **MEDIUM** | `reset()` exported, never called. |
| 24 | `/api/brochure` spawns Chromium per request | **HIGH** | §19. |

**Overall:** per-frame CPU discipline is genuinely strong — this codebase avoids the usual r3f mistakes deliberately and documents why. The risk is concentrated in **payload weight**, **fill rate**, **draw-call count**, and **absent context-loss recovery**, none of which per-frame discipline addresses.

---

# 11. MEMORY / LIFECYCLE AUDIT

| Resource | Disposed? | Evidence |
|---|---|---|
| PMREM render target | **Yes** — `target.dispose()`, `room.dispose?.()`, `pmrem.dispose()`, `scene.environment = null` | `WorldCanvas.tsx:813-818` |
| `scene.fog` | **Yes** — previous fog restored | `:613-619` |
| `OrbitControls` (free cam) | **Yes** — listener removed, `dispose()`, nulled | `:163-167` |
| Lenis | **Yes** — ticker removed, `lagSmoothing` restored, `destroy()`, instance nulled | `SmoothScroll.tsx:68-75` |
| GSAP timelines | **N/A** — none created; only `ticker` and `parseEase` | — |
| `useScrollProgress` listeners | **Yes** — scroll, resize, `ro.disconnect()` | `useScrollProgress.ts:86-90` |
| `CameraRig` pointer listeners | **Yes** | `WorldCanvas.tsx:202-205` |
| `SpatialTelemetry` listeners | **Yes**, plus a final `hologram_focus` flush | `:374-382` |
| `Preloader` timers + overflow | **Yes** — all `clearTimeout`, overflow restored | `Preloader.tsx:83-86`, `:102-105` |
| `SiteHeader` overflow + keydown | **Yes** | `SiteHeader.tsx:75-79` |
| `Surface` keydown | **Yes** | `Surface.tsx:59` |
| `PublishSceneCards` store | **Yes** — cleared on unmount | `PublishSceneCards.tsx:19` |
| **`Terrain` geometry** | **NOT explicitly** | `new THREE.PlaneGeometry(...)` in `useMemo([])` (`Terrain.tsx:232-235`), passed via `geometry={}` prop |
| **`Motes` geometry** | **NOT explicitly** | `new THREE.BufferGeometry()` in `useMemo([count])` (`:116-145`), passed via `geometry={}` prop |
| **`TEX_CACHE` textures** | **Never** | Module-level `Map` (`ExteriorModel.tsx:143`), 12 textures, no eviction — intentional cache, but permanent |
| **KTX2 / DRACO singletons** | **Never** | `HallModel.tsx:32-33`; KTX2 holds a **worker pool** — intentional, documented |
| **Cloned model roots** | **Not disposed** | `scene.clone(true)` (`ExteriorModel.tsx:257`, `HallModel.tsx:108`) |
| **Composer / effect passes** | **UNCERTAIN** | `PostFX` remounts on tier change and on `low` boundary crossings; whether `@react-three/postprocessing` disposes its render targets is not verifiable from this source |

### Route-transition leak analysis

The canvas **never unmounts**, so there is no per-navigation context leak — this is the architecture's central win, and `e2e-slice0/persistence.spec.ts` was written to prove it (now orphaned, §20).

The real churn is the **exterior ↔ interior set swap**, triggered by navigating e.g. `/` → `/hall`. On each swap:

- `Terrain` unmounts → its 103,041-vertex / 204,800-triangle `PlaneGeometry` is released by `useMemo` and **a brand-new one is constructed on the way back**.
- `Motes` unmounts → same for a 2,400-point `BufferGeometry` with 3 attributes.
- `SpatialCards` unmount → 3 CSS3D nodes.
- `ExteriorModel`/`HallModel` clone a fresh root.

**Whether r3f v8 auto-disposes a geometry supplied via the `geometry={}` prop (rather than constructed by JSX `<planeGeometry/>`) is version-dependent and I could not prove it from this source. UNCERTAIN — RUNTIME VERIFICATION REQUIRED** via `renderer.info.memory.geometries` across repeated `/` ↔ `/hall` navigation. If r3f does not dispose props-supplied geometry, each round trip leaks ~1.2 MB of GPU buffers (103,041 verts × position+normal+uv) — and the site has 17 `Surface` routes on the interior set, so round trips are the normal browsing pattern, not an edge case.

---

# 12. MOTION / SCROLL AUDIT

### Architecture

- **Lenis** `lerp: 0.1`, `smoothWheel: true`, `syncTouch: false` — **native momentum on touch, deliberately** (`SmoothScroll.tsx:41-46`).
- **Single ticker.** `gsap.ticker.add(t => lenis.raf(t*1000))` with `lagSmoothing(0)` (`:64-66`). The file documents the prior two-rAF race explicitly. **Verified: exactly one animation driver.**
- **GSAP is not used for tweening.** Only `gsap.ticker` and `gsap.parseEase('power2.inOut')` (`WorldCanvas.tsx:107`). **ScrollTrigger is deliberately not used**, with a documented rationale (`SmoothScroll.tsx:20-25`).
- **r3f `useFrame`** owns all scene animation.

### DOM↔WebGL synchronisation

`useScrollProgress` samples **inside `useFrame`** (`:46-51`), reading `lenisInstance?.scroll ?? window.scrollY`, normalised by a `scrollHeight - innerHeight` measured on mount/resize and via a `ResizeObserver` on `body` (needed because route changes swap page height without firing `resize`). Returns a **ref** — zero re-renders. This is the correct design and it is documented as a deliberate fix for a prior desync class.

### Camera motion

Two modes (`poses.ts:40-50`):
- **Path mode** (`arrival` / `/` only): `curveT(SWING(t))` → centripetal Catmull-Rom `POSITION_CURVE` / `TARGET_CURVE` through **5 beats** (`cameraPath.ts:64-122`), with per-beat fog, key intensity, FOV (50→68→62→44→48), and roll (0→-0.052→-0.068→+0.030→0).
- **Lerp mode**: `lerpVectors(from, to, t)` for poses with `to`; identical endpoints for still frames.

Then: framing offset `−7.4 m` along the camera's own right vector, recomputed per frame (`WorldCanvas.tsx:278-280`); pointer parallax `±0.42 m` (`pointer: fine` only); frame-rate-independent damping `k = 1 − exp(−delta / (ease × 0.12))`; `lookAt`; then `rotateZ(roll)` **after** `lookAt` (necessary — `lookAt` zeroes roll).

`SWING` is applied **once across the whole 0..1 track**, not per leg — the file explains that per-leg easing drove velocity to zero at every waypoint. This is correct reasoning.

### Findings

- **`SCRUB = 0.12`** (`:64`) after being `2.2`. The 40-line comment block above it still describes the 2.2 rationale ("the room keeps moving after the wheel stops, which is the whole effect") and directly contradicts the live value. **Documentation/code contradiction — code wins.** With Lenis `lerp 0.1` already supplying first-order smoothing, 0.12 is defensible, but the stated cinematic intent no longer matches the constant.
- **Reduced motion disables Lenis entirely** (`:38-39`) but **the camera still animates** — `useScrollProgress` falls back to `window.scrollY` and `CameraRig` keeps running. Reduced-motion users get tier `low` (no shadows/AA/DOF/GodRays) but still receive a **moving camera, FOV warp, and roll**. That is a partial, arguably incorrect honouring of the preference.
- **Three duplicate scroll subscriptions** (§10 #4).
- Motes and Terrain uniforms are updated per frame from `state.clock` / `atmosphereAt(scroll)` — single uniform writes, correct.

---

# 13. INTERACTION AUDIT

| Interaction | Status | Evidence |
|---|---|---|
| Wheel / trackpad scroll | **Implemented** — Lenis smoothed | `SmoothScroll.tsx` |
| Touch scroll | **Implemented** — native momentum, deliberately not hijacked | `:45` |
| Pointer parallax | **Implemented, `pointer: fine` only** | `WorldCanvas.tsx:198-201` |
| Magnetic cursor ring | **Implemented**; `pointer: fine` + non-reduced-motion only; native cursor never hidden | `CursorRing.tsx:35-36` |
| Keyboard scroll | **Implemented** via Lenis | — |
| Escape closes Surface | **Implemented** | `Surface.tsx:54-60` |
| Escape closes mobile menu | **Implemented** | `SiteHeader.tsx:71` |
| Focus on Surface mount | **Implemented** — `panel.current?.focus()` on `tabIndex={-1}` | `Surface.tsx:46` |
| Spatial card link | **Implemented** — real `<a href="/projects/{slug}">`, `pointerEvents` toggled by opacity | `SpatialCards.tsx:131`, `:206` |
| Nav / CTAs | **Implemented** — real `<Link>`, `aria-current="page"` | `SiteHeader.tsx:93` |
| Enquiry form | **Implemented** — server action, zod, honeypot, HMAC | `actions.ts` |
| **Scene object selection** | **VISUALLY REPRESENTED BUT NONFUNCTIONAL** | `stationOf()` + raycast exist **only to emit telemetry** (`WorldCanvas.tsx:392-405`). No `onClick`, no `onPointerOver`, no cursor change, no selection state. The three hologram stations `holo3d_S1/S2/S3` are modelled and named but **cannot be interacted with**. |
| **Hover feedback in 3D** | **MISSING** | No hover state on any scene object. |
| **Drag / orbit** | **Intentionally absent** in production (`?free=1` look-dev only) | `:139-172` |
| **Keyboard access to 3D** | **MISSING** | Canvas is `aria-hidden`, non-focusable. Acceptable given the DOM carries all content — but it means the WebGL layer is 100 % non-interactive for keyboard users. |
| **Mobile: pointer parallax** | Correctly disabled | — |
| **Mobile: spatial cards** | **HIGH RISK** — fixed `width: 420` CSS px at `distanceFactor={9}` | `SpatialCards.tsx:145`, `:151`. On a 360 px viewport a 420 px card exceeds the screen. Occlusion/legibility on small screens is **RUNTIME VERIFICATION REQUIRED**. |
| **Mobile menu focus trap** | **MISSING** | `SiteHeader.tsx:150-186` — overlay opens with no focus trap and no `aria-modal`; links behind remain tabbable. |
| Touch target sizes | Header hamburger is `h-10 w-10` (40 px) — **below the 44 px** WCAG 2.5.5 / iOS guideline | `:130` |

**Net:** DOM interaction is complete and well-built. **3D interaction is essentially nonexistent** — the scene is a choreographed backdrop with telemetry instrumentation, not an interactive space. Against non-negotiable #2 ("WebGL/3D is a CORE EXPERIENCE… not merely a decorative background behind a conventional website"), the *camera choreography* is core, but the *interactivity* is not there.

---

# 14. RESPONSIVE AUDIT

No new tests were created. Existing Playwright config runs **Desktop Chrome only** (`playwright.config.ts:22-25`) — **no mobile viewport is tested anywhere in the repo**.

Measured at runtime: viewport `1280×720` → `document.scrollHeight = 10894` → **15.1 viewports**; `devicePixelRatio = 1.25` → canvas `1581×900`, confirming the `dpr` clamp applied.

| Width | Assessment | Evidence |
|---|---|---|
| **320 px** | **HIGH RISK.** `SpatialCards` fixed `width: 420` px. `min-h-[10000px]` = **31 viewports** at 320×568. Header: logo + Enquire + hamburger in `px-5` on 320 px is tight. | `SpatialCards.tsx:151`, `site-home:78` |
| **360 px** | **HIGH RISK.** Same. 10,000 px ≈ 15.6 viewports. | — |
| **390 px** | Moderate. Copy column is `col-span-12` below `md`, so `max-w-[40vw]` does not apply — correct. | `site-home:107` |
| **430 px** | Moderate. | — |
| **768 px** | **Breakpoint transition.** `md:` engages: nav appears, copy becomes `md:col-span-6 md:max-w-[40vw]` = **307 px** — a narrow measure for `t-lede`. | `site-home:107` |
| **1024 px** | `max-w-[40vw]` = 410 px. `t-display` is `clamp(2.4rem, 4.6vw, 4.6rem)` → 47 px. Comment at `globals.css:47-52` says this was specifically tuned so the hero does not crowd the mansion at 1024. | `globals.css:44` |
| **1280 px** | **Verified working.** Canvas 1581×900. Container `max-w-6xl` (1152 px) inside 1265 px. | measured |
| **1440 px** | `max-w-6xl` caps at 1152 px, but `max-w-[40vw]` = 576 px > the 576 px grid half — the two constraints converge. | — |
| **1920 px** | `max-w-6xl` = 1152 px centred; `max-w-[40vw]` = 768 px, so the **grid span (576 px) dominates**. The stated intent — "copy measured against the VIEWPORT the stage is cut from" — **does not hold above ~1440 px**; the copy occupies 30 % of viewport, not 40 %. Camera framing offset is fixed at 7.4 m regardless. | `site-home:107` |
| **2560 px** | Same divergence, worse. `dpr` capped at 2 (high) → 5120 px canvas backing store — **very expensive fill**, and `Terrain`'s full-screen fragment shader scales directly with it. | `WorldCanvas.tsx:866` |

### Other

- **Canvas sizing / camera aspect / FOV** are delegated to r3f; FOV is animated by scroll, not viewport. **No vertical-FOV compensation for portrait aspect** — on a tall phone the horizontal field narrows substantially, so the "establishing shot" framing tuned at 16:9 will crop. **RUNTIME VERIFICATION REQUIRED.**
- **Horizontal overflow:** only one fixed-px risk found in public code — `SpatialCards` `width: 420`. `StatusLegend` `min-w-[320px]` is kiosk-only.
- **`/projects/[slug]`** uses `h-[600px]` for the map and a `md:grid-cols-3` gallery — conventional and low-risk, but light-themed (§21).
- Type scale is fluid `clamp()` throughout with no breakpoint jumps — genuinely well done (`globals.css:24-31`).

---

# 15. ACCESSIBILITY AUDIT

### Correct

- Semantic `<header>`, `<nav aria-label="Primary">`, `<address>`, `<article>`, `<section>`, `<ul>/<li>`.
- `aria-current="page"` on active nav (`SiteHeader.tsx:93`).
- Decorative bracket glyphs `aria-hidden` so SR hears "Plots" (`:104`, `:106`).
- `aria-expanded` + `aria-controls` on the menu button (`:135-136`).
- `<span className="sr-only">` for the menu button label (`:138`).
- Preloader: `aria-hidden` on the counter + a single `role="status"` "Loading the scene" (`Preloader.tsx:118-120`) — correct, avoids announcing 100 ticks.
- `ConsentPanel`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby` (`:135-138`).
- `Surface`: `aria-labelledby="surface-title"`, focus on mount, Escape close, real `<button>` with `aria-label="Close and return"` and `focus:ring-2` (`Surface.tsx:77`, `:99-100`).
- Reduced motion honoured in JS (Lenis, CursorRing, tier) **and** CSS (`globals.css:117-119`, `:143-145`).
- **Zero clickable `<div>`/`<span>`** — verified by grep. All actions are `<button>` or `<Link>`.
- `alt` present on 8 of 9 `<img>`/`<Image>` occurrences.
- Canvas `aria-hidden` with all content in the DOM above it — the right call.

### Defects

| # | Issue | Severity | Evidence |
|---|---|---|---|
| 1 | **Focusable `<Link>` inside `aria-hidden="true"`** | **HIGH** — WCAG 4.1.2 | `WorldCanvas.tsx:847` wraps `SceneFallback.tsx:43` |
| 2 | **No `<main>` landmark on 17 of 26 pages** | **HIGH** | Only 9 files contain `<main>`. `Surface` renders `<article>` inside a `<div>`; `(site)/layout.tsx:30` wraps children in a plain `<div>`. |
| 3 | **No skip link anywhere** | **MEDIUM** | grep: none. With a fixed header and 15 viewports of content, this matters. |
| 4 | **Mobile menu has no focus trap** and no `aria-modal` | **MEDIUM** | `SiteHeader.tsx:150-186` |
| 5 | **Hamburger 40×40 px** < 44 px minimum | **MEDIUM** | `:130` |
| 6 | **Reduced motion still animates the camera** | **MEDIUM** | §12 |
| 7 | **Contrast: `text-[#F2EDE4]/25` and `/35`** over `#0A1120` | **MEDIUM — UNVERIFIED ratio** | `error.tsx:72`, `site-home:151`, `SiteHeader.tsx:151`. `#F2EDE4` at 25 % opacity over `#0A1120` is very likely **below 4.5:1**. Requires measurement. |
| 8 | **`<h1>` uniqueness / heading order** | **UNVERIFIED** | `Surface` emits `<h1>`; `SiteHeader`'s mobile menu emits `<h2>` group labels **before** it in DOM order when open. |
| 9 | **No `lang` variation, no `prefers-contrast`, no forced-colors** | **LOW** | — |
| 10 | `<img>` over `next/image` in 5 places | **LOW** | lint warnings; `ProjectCard.tsx:53` is deliberate (has `onError` fallback) |

---

# 16. SEO AUDIT

### Correct

- **23 of 26 pages export `metadata`** with real, specific titles and descriptions.
- `robots.ts` **throws** rather than guessing the origin when `NEXT_PUBLIC_SITE_URL` is unset (`:8-10`) — correct, loud failure.
- `sitemap.ts` derives entries from the route registry rather than a hand list, and explicitly **excludes** `NOINDEX_PENDING` (`/privacy`, `/terms`, `/refund-policy`), `UNWRITTEN` (`/about`, `/why-us`, `/site-home`), and `UNBUILT` (`/book-a-site-visit`, `/projects`, `/sitemap`) — the last verified by request, not assumption (`:38-40`).
- `/` emitted once as the origin, with `'/'` filtered from the registry loop to avoid `host` + `host/` duplication (`:58-60`).
- **407 unit pages deliberately excluded** with a stated rationale (thin, unpriced, provisional numbering) — correct judgement.
- Legal pages carry `robots: {index:false, follow:false}` via `pendingRobots` (`Pending.tsx:24`), kept in sync with the sitemap exclusion list.
- All content is **server-rendered** — verified from build output: `site-home.html` contains real `<h3>` project names and `/projects/{slug}` links.
- `opengraph-image.tsx` exists for project routes, pinned to the Node runtime with a documented reason.

### Defects

| # | Issue | Severity | Evidence |
|---|---|---|---|
| 1 | **Project routes have NO metadata at all** | **CRITICAL** | `projects/[projectSlug]/page.tsx` and `[unitSlug]/page.tsx` — no `metadata`, no `generateMetadata`. The two highest-value commercial routes inherit Next's default title. |
| 2 | **No `metadataBase` anywhere** | **HIGH** | grep across `src/`: zero. Without it, the auto-detected `opengraph-image` resolves to a relative/localhost URL. |
| 3 | **No `openGraph` or `twitter` metadata anywhere** | **HIGH** | grep: zero occurrences. Every WhatsApp/Facebook share — the dominant channel for this audience — renders without a title, description, or image. |
| 4 | **No structured data anywhere** | **HIGH** | grep for `application/ld+json` / `schema.org`: zero. No `Organization`, `LocalBusiness` (3 offices with full addresses **already in `branches.ts`**), `RealEstateListing`, or `BreadcrumbList`. This is the largest cheap SEO win available and costs ₹0. |
| 5 | **No canonical / `alternates`** | **HIGH** | `/` and `/site-home` serve **byte-identical** content. `/site-home` is excluded from the sitemap but **not `noindex`'d and not canonicalised**. Duplicate content on the home page. |
| 6 | **Root layout exports no metadata** | **MEDIUM** | `app/layout.tsx` — no `title.template`, no default description, no `metadataBase`. |
| 7 | **Root `<body>` is `bg-white text-gray-900`** | **MEDIUM** | `layout.tsx:20` — contradicts the dark site; a flash of white is likely before segment styles apply. |
| 8 | **`/api/revalidate` busts `/`, but the page is `/site-home`** | **MEDIUM** | `revalidate/route.ts:19` calls `revalidatePath('/', 'page')` while `revalidate=3600` lives on `site-home/page.tsx`. Whether this actually invalidates the rewritten target is **UNCERTAIN — RUNTIME VERIFICATION REQUIRED**. If not, publishes may not appear on the home page for up to an hour. |
| 9 | `/hall`, `/properties`, `/locations`, `/branches` are `○ Static` but read hardcoded data | **LOW** | Correct as built; noted because it will change if they are ever DB-wired. |

---

# 17. ERROR-HANDLING AUDIT

| Failure | Handled? | Behaviour | Evidence |
|---|---|---|---|
| Segment error in `(experience)` | **Yes** | `error.tsx` renders inside the layout — **canvas, header, footer survive**; shows only `error.digest`, never `error.message` (correctly avoids leaking SQL in dev) | `(experience)/error.tsx` |
| Root layout throw | **Yes** | `global-error.tsx` with its own `<html>/<body>` and **fully inlined styles** — no Tailwind, no imports | `global-error.tsx` |
| **Error in `/projects/*`** | **NO nearer boundary** | Bubbles past `(site)` (no `error.tsx`) to `global-error` → **entire page replaced** | no `error.tsx` outside `(experience)` |
| **404 / `notFound()`** | **NO custom page** | `projects/[projectSlug]/page.tsx:27` calls `notFound()` → Next's **default unstyled white 404** on a dark site | no `not-found.tsx` anywhere |
| Route loading | **NO** | No `loading.tsx` anywhere; dynamic project routes have no streaming fallback | — |
| WebGL unsupported | **Partially** | `webglSupported()` probes `webgl2` only; renders `SceneFallback` — but **aria-hidden and behind `z-10` content** (§8) | `WorldCanvas.tsx:449-456`, `:845-851` |
| GLB parse/load failure | **Yes** | `SceneBoundary` catches, `console.error`s, calls `onError` → `setFailed(true)` | `:431-447` |
| **WebGL context loss** | **NO** | No handler on the live path. Only in dead `ExperienceCanvas.tsx:133`. **Violates non-negotiable #6.** | — |
| **Context restoration** | **NO** | Nowhere in the repo | — |
| Texture load failure | **NO** | `texLoader.load(path)` has **no `onError`** (`ExteriorModel.tsx:147`) — a 404 leaves the material with a null map and no signal | `:145-159` |
| Projection read failure (home) | **Yes, 3 layers** | try/catch → `[]`; `Array.isArray` guard against a null-returning driver; then `error.tsx` | `site-home:48-58` |
| Missing project | **Yes** | `notFound()` — but lands on the default 404 | `:27` |
| Invalid slug | **Yes** | Same path | — |
| Preloader stall | **Yes, 2 failsafes** | 12 s ceiling + 2.5 s idle; both mount-only via refs, correctly avoiding the stale-closure bug the comment describes | `Preloader.tsx:74-91` |
| Lead intake down | **Yes** | Typed `PERSIST_FAILED` with a user-facing message; fetch wrapped in try/catch | `actions.ts:88-105` |
| Telemetry intake down | **Yes** | Caught, logged, **always returns 204** — analytics never fails a page | `telemetry/route.ts:127-131` |
| Brochure generation failure | **Partial** | Returns 500 — but **leaks the Chromium process** (§19) | `brochure/route.ts:75-78` |
| Hero image 404 / non-raster | **Yes** | `RASTER` regex + `onError` → designed "drafting paper" placeholder | `ProjectCard.tsx:35`, `:50` |
| Supabase failure | **N/A on public site** | Supabase is imported only by kiosk code (`realtime.ts`, `EnrollClient.tsx`) | — |

---

# 18. DATA-INTEGRITY AUDIT

### Authoritative sources — **there are two, in parallel**

**A. `projection.*` (Postgres via drizzle)** — `lib/projection.ts`. `createProjectionClient(process.env.DATABASE_URL)`, reading `projects_pub`, `units_pub`, `geometry_pub`, `pois_pub`, `media_manifests`. Money is `bigint`→`::text` paise (never `parseFloat`); PostGIS is schema-qualified `extensions.*` and serialised server-side via `ST_AsGeoJSON` so raw WKB never reaches components. Consumers: `/site-home`, `/projects/*`, `sitemap.ts`, `opengraph-image.tsx`, `/api/brochure`.

**B. `@estate/domain/leads/branches` (hardcoded TypeScript)** — `BRANCHES` (3 offices, full addresses + pincodes) and `PROJECTS` (3 projects with slug/locality/district/branch/station). Consumers: `/hall`, `/start-here`, `/branches`, `SceneFallback`.

### Verified: project-level data is consistent

The production build prerendered `/site-home` against the live projection. Extracted from `.next/server/app/site-home.html`:

```
/projects/kartikeya-water-front
/projects/lucky-garden
/projects/vsr-gayatri-township
<h3 …>Kartikeya Water Front</h3>
<h3 …>Lucky Garden</h3>
<h3 …>VSR Gayatri Township</h3>
```

These match `branches.ts` `PROJECTS` exactly. **The DB holds the three real projects; the `/hall` → `/projects/{slug}` links resolve.**

### Findings

| # | Finding | Severity | Evidence |
|---|---|---|---|
| 1 | **`/properties` is entirely hardcoded and deliberately not DB-backed.** The source states: *"The projection database currently holds seed inventory for two unrelated projects, not these three, so wiring this to live unit data would show a buyer the wrong thing with the authority of a real listing."* | **CRITICAL (data, not code)** | `properties/page.tsx:1-12`, `INVENTORY` at `:33` |
| 2 | **`/locations` is entirely hardcoded**, sourced from brochures | **HIGH** | `locations/page.tsx:1-9`, `SITES` at `:30` |
| 3 | **`unitsPub` is therefore untrustworthy** while `projectsPub` is trustworthy — yet `/projects/[projectSlug]/[unitSlug]`, `/api/brochure`, and `getAllPublishedUnits()` all read `units_pub` **without any such guard**. A buyer reaching a unit page or downloading a brochure may receive seed data presented as a real listing. | **CRITICAL** | `projection.ts:115-148`; `[unitSlug]/page.tsx`; `brochure/route.ts:20-32` |
| 4 | **Dual source of truth** — `SceneFallback` renders hardcoded `PROJECTS` while `site-home` renders DB rows. Guaranteed drift if either changes. | **MEDIUM** | `SceneFallback.tsx:13`, `:33` |
| 5 | `getPublishedProjects()` is `db.select().from(projectsPub)` with **no publication filter** — it relies entirely on the `_pub` projection being pre-filtered upstream | **MEDIUM** | `projection.ts:9-11` |
| 6 | `geometry_pub` has **0 rows for every live project** (stated in source), so `/projects/[slug]` always renders `EmptyStates type="map"` | **MEDIUM** | `projection.ts:249-253`; `page.tsx:88-92` |
| 7 | Legal pages correctly use `<Pending>` markers rather than inventing terms, and are `noindex`ed | **GOOD** | `privacy/page.tsx:39`, `refund-policy/page.tsx:41` |
| 8 | `branches.ts` documents provenance per fact (brochure vs. layout sheet, and which wins on conflict) | **GOOD** | `branches.ts:1-9`, `:75-77` |
| 9 | `/properties` publishes plot **sizes** (from approved plans, stable) but explicitly **not availability** | **GOOD** | `properties/page.tsx:4-7` |
| 10 | Phone `+91 95535 13366` hardcoded in `error.tsx:66` and `global-error.tsx:71` | **LOW — UNVERIFIED** against client records |

**No fabricated specifications, prices, approvals, distances, amenities, certifications, or awards were found.** Where a figure was unknown, the code uses a `<Pending>` marker or omits the claim. Non-negotiables #9 and #10 are respected.

---

# 19. SECURITY AUDIT

Static review only. No exploitation attempted.

### Correct

- **No secrets committed.** Only `.env.example` files are tracked (both with `<password>` placeholders). `apps/public/.env.local` is confirmed ignored via `git check-ignore` → `.gitignore:7`.
- **Consent enforced server-side.** `/api/telemetry` re-reads the cookie and returns 204 without consent — the client is never the authority (`telemetry/route.ts:63-69`).
- **Event allowlist** (`ALLOWED`, `:25-30`) — a compromised client cannot invent event types.
- **Input caps** — `MAX_BODY_BYTES 32 KB`, `MAX_EVENTS 40`, key names sliced to 48 chars, string values to 200, payload to 24 keys (`:35-59`).
- **HMAC-SHA256** on both lead (`actions.ts:82`) and telemetry (`:126`) relays.
- **Session id read from an HttpOnly cookie server-side, never from the form body** — explicitly to prevent a caller asserting an identity (`actions.ts:57-59`).
- **Cookies** `HttpOnly`, `SameSite=Lax`, `Secure` when HTTPS; `qhr_vid` minted **only** under analytics consent and **actively cleared** on withdrawal (`middleware.ts:28-58`).
- **Zod validation** on the enquiry action with strict E.164 phone regex.
- **No `dangerouslySetInnerHTML` anywhere** — verified by grep.
- Security headers set for all paths: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` (the last one fixed from an invalid `DENY` token, per the comment) (`next.config.mjs:38-52`).
- `hideSourceMaps: true` for Sentry (`:59`).
- No secrets in `NEXT_PUBLIC_*` beyond a MapTiler key (public by design).

### Findings

| # | Finding | Severity | Evidence |
|---|---|---|---|
| 1 | **`/api/brochure/*` launches headless Chromium per request — unauthenticated, unrate-limited.** Each GET spawns a browser, navigates to a full page, and waits for `networkidle` (which on a MapLibre page can be many seconds). A trivial request loop exhausts CPU/memory. | **CRITICAL** | `brochure/route.ts:45-58` |
| 2 | **`browser.close()` is not in a `finally`.** If `page.goto` or `page.pdf` throws, the Chromium **process leaks permanently**. Combined with #1 this is a fast path to host exhaustion. | **CRITICAL** | `:67` (success path only); catch at `:75` closes nothing |
| 3 | **Chromium sandbox disabled** — `--no-sandbox --disable-setuid-sandbox` — while rendering a URL built from **user-supplied path segments**. | **HIGH** | `:46-47` |
| 4 | **CSP allows `'unsafe-eval'` and `'unsafe-inline'` in `script-src`.** `unsafe-eval` is plausibly needed by the Basis/Draco WASM glue, but it is unqualified and site-wide, substantially weakening XSS defence. | **HIGH** | `next.config.mjs:12` |
| 5 | **`/api/telemetry` has no rate limiting.** Consent-gated, but a consenting client can post 40 events per request indefinitely, each triggering an outbound HMAC'd relay. | **MEDIUM** | `telemetry/route.ts` |
| 6 | **`/api/revalidate` uses timing-unsafe comparison** — `authHeader !== \`Bearer ${secret}\`` instead of `crypto.timingSafeEqual`. | **MEDIUM** | `revalidate/route.ts:10` |
| 7 | **`NEXT_PUBLIC_MAPTILER_API_KEY` is exposed client-side** (unavoidable) — but there is **no evidence of domain restriction**, and MapTiler is a **paid service**, relevant to non-negotiable #8. | **MEDIUM — UNVERIFIED** | `.env.local`, `ProjectMap.tsx:36` |
| 8 | **Production `console.info` leaks scene internals** — `[exterior_ready] meshes=… tris=… size…`, `[hall_ready] …`. Not sensitive, but it is debug instrumentation shipping to production. | **LOW** | `ExteriorModel.tsx:276`, `HallModel.tsx:138` |
| 9 | **Sentry `tracesSampleRate: 1.0`** on both client and server — 100 % trace capture in production. Cost and PII-volume risk. | **MEDIUM** | `sentry.client.config.ts:6`, `sentry.server.config.ts:6` |
| 10 | **Honeypot silent-success branch is unreachable dead code.** `honeypot: z.string().max(0)` fails `safeParse` first, so a filled honeypot returns `VALIDATION_FAILED` — telling the bot it was detected — and `if (parsed.data.honeypot.length > 0) return { ok: true }` can never execute. | **LOW (logic defect)** | `actions.ts:19`, `:44-47` |
| 11 | **`fallbacks` in the middleware matcher references a directory that does not exist** (`public/fallbacks` absent). | **LOW** | `middleware.ts:89` |
| 12 | **`/site-home` bypasses the middleware entirely** (excluded by the matcher), so a direct hit receives **no session/visitor cookies** — inconsistent identity handling versus `/`. | **LOW** | `middleware.ts:89` |
| 13 | **`.ignored_node_modules/` commits a full dependency tree** including `next`, `react`, `typescript`, `playwright`, `maplibre-gl`, `@supabase`, `@sentry`. Supply-chain surface: these bypass lockfile resolution and audit tooling. | **MEDIUM** | 10,588 tracked files |

---

# 20. TESTING AUDIT

**No coverage percentage is claimed — no coverage tooling is configured anywhere in the repo.**

### Inventory

| Kind | Location | Count | Runs by default? |
|---|---|---|---|
| Unit (vitest) | `packages/domain/src/**/*.test.ts` | **21 files** | **Yes** — `"test": "vitest run"` |
| Unit (vitest) | `packages/db` | **0 test files** | script exists, nothing to run |
| **Unit — `apps/public`** | — | **0** | **No `test` script exists** |
| E2E (Playwright) | `apps/public/e2e/presentation-flow.spec.ts` | **1 spec** | Yes — but tests the **kiosk** |
| E2E (orphaned) | `apps/public/e2e-slice0/persistence.spec.ts` | 1 spec | **No** — outside `testDir` |
| Visual / screenshot | — | **0** | — |
| Lint | `next lint`, `next/core-web-vitals` | — | Yes — 7 warnings, 0 errors |
| Typecheck | `tsc --noEmit`, `strict: true` | — | Yes — **exit 0** |
| Build check | `next build` | — | Yes — **succeeds, 33 routes** |

### Domain unit tests (the only real automated coverage)

`clients/kyc`, `commissions/engine`, `commissions/override`, `documents/deals`, `documents/templates`, **`experience/places`**, `geometry/edge-derivation`, `geometry/validate`, `holds/expiry`, `leads/dedupe`, `leads/pipeline`, `leads/scoring`, `ledger/balance`, `money/format`, `money/paise`, `permissions/matrix`, `pricing/compute`, **`telemetry/device-tier`**, `telemetry/scroll`, `unit-status/machine`, `unit-status/presentation-label`.

Only **2 of 21** touch the experience: `places.test.ts` (route→place mapping, dynamic-child inheritance, normalisation, place/surface disjointness, ≥22 route coverage) and `device-tier.test.ts`.

### Critical gaps

1. **`apps/public` has no `test` script.** `turbo run test` (`turbo.json`) silently skips the entire production frontend. `pnpm test` at root exercises `@estate/domain` only.
2. **Zero E2E coverage of the public site.** `playwright.config.ts:13` sets `testDir: './e2e'`, which contains only `global-setup.ts` and the kiosk spec.
3. **The persistence test — the one that validates the whole architecture — is orphaned and stale.** `e2e-slice0/persistence.spec.ts` asserts `probe-ctx`, `probe-gen`, `probe-clock` and `gen === '1'` (exactly one WebGL context). Those test IDs exist **only in the dead `ExperienceCanvas.tsx`** (`:143`, `:147`, `:150`). Running it against the live `WorldCanvas` would **fail immediately** — the probe was deleted with the component. The load-bearing claim of the architecture is therefore **untested in CI**.
4. **`slice0.tmp.config.ts` exists precisely because `e2e/global-setup.ts` seeds fixtures into `DATABASE_URL`, "currently the LIVE database"** (`:1-3`). The default E2E config is **unsafe to run**.
5. **Desktop Chrome only.** No mobile/tablet project, no WebKit, no Firefox — for a build whose primary risk is mid-tier Android.
6. **No visual regression, no performance budget, no Lighthouse/CI gate, no a11y (axe) test.**
7. `.github/` exists — **CI contents UNVERIFIED** (not inspected in this audit).

---

# 21. VISUAL / ART-DIRECTION AUDIT

**RUNTIME VISUAL VERIFICATION REQUIRED for all of §21.** I could not see a rendered frame: the Browser pane cannot be displayed in this session, `computer screenshot` failed with *"the Browser pane is not displayed, so the page is not compositing frames,"* and the page stayed `visibilityState: "hidden"` even after fronting the tab. **I make no claim to have seen the current output.** What follows is inferred from implementation.

### Assessed from source

| Dimension | Assessment |
|---|---|
| **Composition** | Deliberate and unusually rigorous. `FRAME_OFFSET = 7.4 m` applied along the camera's *own right vector*, recomputed per frame so the building holds the right 60 % through a full orbit while the left 40 % stays clear for copy (`WorldCanvas.tsx:70-80`, `:278-280`). The DOM mirrors it (`md:max-w-[40vw]`). This is real compositional thinking, not a backdrop. **Diverges above ~1440 px** (§14). |
| **Lighting** | Genuinely art-directed. Dual-tone by design: amber key `#FFB264` at `(30,15,-80)` **behind** the building so the shell occludes the sun and the copy side falls into shadow, against a cool `#7FB4D6` rim. 3 `rectAreaLight` planes throw the *shape* of the arches onto stone (correct — a point light produces a circular hotspot). Hemisphere `#4A6B96`/`#1A1512`. The rationale for each relocation is recorded. |
| **Architectural realism** | 129,471 tris exterior / 148,220 interior with real PBR sets (limestone, roof, gold, wood) at 1K, normals encoded with **chroma subsampling off** — a detail most pipelines get wrong and which genuinely prevents lighting "swimming". Interior carries a 4096² baked GI lightmap at ×4.6597. |
| **Material realism** | `MAT_Ground` and `MAT_Hedge` arrive white (colour lived in Blender nodes the exporter cannot write) and are graded in code to `#0F1520` / `#16281B`, guarded so a real texture always wins. Emissive is applied to window *interiors*, not glass — correct. Emissive dropped 2.6→0.55 to sit below the bloom threshold. |
| **Depth** | Fog animated 40..210 → 14..95 along the path; motes occupying the near volume; DOF `bokehScale 0.9` (deliberately shallow, Nolan-referenced). Layered and intentional. |
| **Scale** | Anchored to measured geometry: mansion x ±9.55, y 0..6.80, spire 11.72, fountain (0,·,13.2) r≈2.7. Camera beats are collision-checked by `tools/blender/audit_camera_path.py`, which samples *between* keyframes — the right instinct, since Catmull-Rom can pass through solid geometry between two good beats. |
| **Atmosphere** | Fog + 2,400 additive motes swirling around the fountain axis with distance-falloff rotation + GodRays. Coherent dusk. |
| **Typography** | The strongest single element. Two-tier scale (Playfair/Inter), `clamp()` throughout with **no breakpoint jumps**, ratio 1.26 chosen explicitly for phones, tracking tightening with size, sub-pixel `.rule-hair`. Explicitly **rejects unlicensed fonts** (PP Editorial New / Ogg / Neue Montreal) on liability grounds — correct, and consistent with #8. |
| **Hierarchy** | Clear: eyebrow → display → lede → body, applied consistently. |
| **Spatial UI** | 3 CSS3D `<Html transform occlude="blending">` cards on real world anchors with distance-banded opacity. Distance (not speed) is the right signal, for the reason the file gives: speed→0 exactly when the reader stops to read. |
| **Motion** | Documented above. Kinetic energy from FOV warp + bank rather than raw translation — a cinematographer's instinct. |
| **Transitions** | **The weakest area.** Route changes re-aim the camera via damping only. There is **no transition choreography** — no dissolve, no wipe, no timed hand-off. Changing sets swaps a 2.31 MB model for a 14.38 MB one **inside `<Suspense fallback={null}>`**, so `/` → `/hall` will hold the last exterior frame for however long the hall takes to arrive, with **no indicator** (the Preloader is long gone). **HIGH RISK — RUNTIME VERIFICATION REQUIRED.** |
| **Visual noise** | Actively managed: bloom threshold 0.85 to avoid igniting cream stone; GodRays clamped to 0.55 after an over-bright first pass; DOF reduced 2.4→0.9. The build has clearly been corrected away from over-effecting. |
| **DOM ↔ 3D coherence** | Strong on `(experience)`: shared `#0A1120`/`#F2EDE4`/`#E8B98A` palette, per-set scrims, copy confined to the camera's empty half. **Breaks completely on `/projects/[slug]`** — `text-gray-900`, `bg-gray-50`, `border-gray-200`, `text-4xl font-bold`, no canvas, no dark palette, generic Tailwind. The most commercially important route looks like a different website. Root `<body>` is also `bg-white text-gray-900`. |
| **Perceived quality** | Where the system is complete (home, hall, surfaces) the *implementation* is consistent with a premium build. Three things undercut it regardless of how the pixels look: the light-theme project pages, the unstyled default 404, and the undefined `.prose-surface` class. |

### Concrete visual defects found in source (not opinion)

1. **`.prose-surface` is undefined.** Applied to the content wrapper of **all 17 `Surface` pages** (`Surface.tsx:113`). Confirmed absent from `globals.css`, from `@estate/ui/tailwind-preset` (which extends only colours, radius, spacing, fontSize), and from the entire tracked tree. **All prose styling those pages expect does not exist.**
2. **`/projects/[projectSlug]` is light-themed** on a dark site.
3. **Default Next.js 404** — no `not-found.tsx`.
4. **Root `<body className="bg-white text-gray-900">`** (`layout.tsx:20`).
5. **`SCRUB` comment contradicts its value** (§12) — a maintainer reading it will mistune the camera.

---

# 22. VERTEX3D REFERENCE GAP ANALYSIS

**I did not fetch or inspect https://www.vertex3d.asia/ during this audit.** I will not describe its implementation, layouts, assets, or visual identity — anything I asserted about it would be unverified. The comparison below is therefore **strictly conceptual**, against the qualities the brief names, and every row is judged only on what I verified in `apps/public`.

| Dimension | CURRENTLY PRESENT in `apps/public` | MISSING | UNKNOWN |
|---|---|---|---|
| **3D integration** | Persistent single-context canvas mounted in a route-group layout; survives all in-segment navigation; scene is the page ground, not a hero widget. **Architecturally this is the strong form.** | Meaningful 3D *interactivity*. `holo3d_S1/S2/S3` are modelled and raycast-detected but emit **telemetry only** — no click, no hover, no selection (§13). | Whether the reference's 3D is interactive or choreographed. Not verified. |
| **Spatial storytelling** | Genuine place/surface model (`places.ts`): 7 places; ~14 surfaces read *from* a held frame with no travel. Poses chosen so each surface has a plausible vantage. | Interior rooms are **framings within one hall**, not distinct spaces — `window`, `study`, `desk` are camera angles, and `poses.ts:10-14` says so honestly. | — |
| **Camera choreography** | 5-beat centripetal Catmull-Rom with per-beat fog, key intensity, FOV (50→68→62→44→48) and bank (0→−0.068→+0.030→0); single continuous ease; frame-rate-independent damping; collision-audited between keyframes. **This is the most sophisticated part of the build.** | Choreographed **route-to-route transitions** (§21). Only one route (`/`) has a path; every other place is a static or two-point pose. | Perceived quality of the move — RUNTIME VERIFICATION REQUIRED. |
| **Interaction** | Lenis-smoothed scroll on one shared ticker; pointer parallax; magnetic cursor; Escape/focus handling. | 3D hover, 3D selection, drag/orbit, any keyboard path into the scene. | Mobile feel of the CSS3D cards. |
| **Visual hierarchy** | Fluid `clamp()` type system; copy confined to the camera's deliberately empty half; per-set graded scrims replacing a heavy DOM gradient. | Consistency — `/projects/*` breaks the system entirely; `.prose-surface` undefined; default 404. | — |
| **Technical-art sophistication** | Baked 4096² GI promoted `aoMap`→`lightMap` with correct sRGB and ×4.6597; ACES with per-set exposure reciprocal to the bake gain; RectArea lights shaped to the openings; custom terraced-karst terrain shader with derivative normals; GPU-displaced motes; no double tone-mapping; self-hosted Draco/KTX2 after a CSP-blocked CDN failure. **This is genuinely high-calibre.** | LOD, texture streaming, instanced draw batching, occlusion culling, context-loss recovery. | — |
| **Information architecture** | 26 routes registered in one tested map; scarcity of places enforced by a unit test; sitemap derived from the registry so a route cannot ship unlisted. | Canonical handling for `/` vs `/site-home`; structured data; metadata on project routes. | — |
| **Performance philosophy** | Measured-frame-time tiering (explicitly refusing GPU-string profiling); tier genuinely branches shadows/DPR/AA/motes/DOF/GodRays; scratch vectors pre-allocated; refs instead of state at scroll frequency; single rAF. | Network/`Save-Data` awareness on the public site; asset budget (14.38 MB model, 240 draws); tier re-evaluation after settling; **any runtime measurement at all**. | Actual FPS on target hardware — **NOT MEASURED**. |

---

# 23. CURRENT STATE MATRIX

| AREA | STATUS | EVIDENCE | RISK | NOTES |
|---|---|---|---|---|
| architecture | **COMPLETE** | `(experience)/layout.tsx:19`; `ExperienceCanvasHost.tsx:18-24` | LOW | Persistent single-context canvas. Sound and deliberate. |
| routes | **PARTIAL** | 33 routes built; no `not-found.tsx`/`loading.tsx`; no root `page.tsx` (middleware rewrite) | MED | `/projects/*` outside `(experience)`. |
| WebGL | **PARTIAL** | `WorldCanvas.tsx:858-925` | **HIGH** | No context-loss/restore handling anywhere on the live path. |
| scene | **PARTIAL** | §6 | MED | Interior "rooms" are framings of one hall. Stations non-interactive. |
| camera | **COMPLETE** | `cameraPath.ts:64-122`; `WorldCanvas.tsx:247-334` | LOW | Best-executed subsystem. `SCRUB` comment is stale. |
| lighting | **COMPLETE** | `WorldCanvas.tsx:608-753`; `HallModel.tsx:58-81` | LOW | Dual-tone rig + baked GI, both correct. |
| materials | **COMPLETE** | `ExteriorModel.tsx:88-238` | LOW | Grade/emissive/PBR applied idempotently to shared instances. |
| shaders | **COMPLETE** | `Terrain.tsx:61-226`; `Motes.tsx:51-111` | MED | Correct; terrain fragment cost is high on mobile. |
| postFX | **COMPLETE** | `PostFX.tsx` | LOW | Tier-gated; no double tone-mapping. |
| assets | **PARTIAL** | `interior_hall.glb` 15,078,360 B; textures 2,876,104 B | **CRITICAL** | 14.38 MB model, no LOD, no tier variant. |
| loading | **COMPLETE** | `Preloader.tsx` | MED | Honest progress; failsafe cannot distinguish "nothing to load" from "not measured yet". |
| fallback | **BROKEN** | `WorldCanvas.tsx:845-851` + `SceneFallback.tsx:43` | **CRITICAL** | `aria-hidden` + `z-0` → unreachable; focusable link in aria-hidden subtree. |
| capability tiers | **PARTIAL** | `useDeviceTier.ts`; `device-tier.ts:41-70` | MED | Real branches, but latched; two parallel systems; no network/Save-Data on the public site. |
| performance | **UNKNOWN** | **NOT MEASURED** | **HIGH** | ~240 draws, ~12 `useFrame`, 0.5 s full-scene raycast, 204,800-tri terrain. |
| memory | **PARTIAL** | §11 | MED | Listeners/PMREM/Lenis disposed correctly; props-supplied geometry disposal UNCERTAIN. |
| scroll | **COMPLETE** | `SmoothScroll.tsx:64-66`; `useScrollProgress.ts:46-51` | MED | One ticker, verified. Three duplicate subscriptions. |
| interaction | **PARTIAL** | §13 | **HIGH** | DOM complete; **3D interaction essentially absent**. |
| responsive | **PARTIAL** | measured 10,894 px @720 px; `SpatialCards.tsx:151` | **HIGH** | 15.1 viewports; 420 px fixed card; zero mobile tests. |
| accessibility | **PARTIAL** | §15 | **HIGH** | Focusable link in aria-hidden; 17 pages with no `<main>`; no skip link. |
| SEO | **PARTIAL** | §16 | **HIGH** | No metadata on project routes; no OG/Twitter/canonical/JSON-LD/metadataBase. |
| data integrity | **PARTIAL** | `properties/page.tsx:1-12` | **CRITICAL** | `units_pub` holds seed data for unrelated projects, yet unit pages and brochures read it unguarded. |
| security | **PARTIAL** | `brochure/route.ts:45-67`; `next.config.mjs:12` | **CRITICAL** | Unauthenticated Chromium spawn + process leak; `unsafe-eval`. |
| testing | **BROKEN** | `playwright.config.ts:13`; no `test` script in `apps/public` | **CRITICAL** | Zero public-site E2E; the architecture-validating spec is orphaned and stale. |
| visual quality | **UNKNOWN** | **RUNTIME VISUAL VERIFICATION REQUIRED** | **HIGH** | Implementation reads as high-calibre; `.prose-surface` undefined; `/projects/*` light-themed; default 404. |

---

# 24. P0/P1/P2/P3 BLOCKERS

### P0 — can fundamentally invalidate the experience

| # | Blocker | Evidence |
|---|---|---|
| **P0-1** | **No WebGL context-loss or restore handling on the live path.** Context loss is routine on mobile. Result: permanently black canvas, no recovery, no fallback. The only handler in the repo is in the dead `ExperienceCanvas.tsx:133`. **Directly violates non-negotiables #6 and #7.** | `WorldCanvas.tsx` (no `webglcontextlost` listener) |
| **P0-2** | **The high-end fallback never presents.** `SceneFallback` is rendered inside `aria-hidden="true"` at `z-0`, beneath the `z-10` content layer, and contains a focusable link. **Violates #7** and is a WCAG 4.1.2 failure. | `WorldCanvas.tsx:845-851`; `SceneFallback.tsx:43` |
| **P0-3** | **`interior_hall.glb` is 14.38 MB** (12.52 MB textures; 6.35 MB of normal maps), served identically to every device with no LOD or tier variant. It gates `/hall` **and all 17 `Surface` routes**. **Violates #3, #4, #5.** | `models/interior_hall.glb`; `manifest.json` |
| **P0-4** | **`/api/brochure/*` spawns unauthenticated, unrate-limited headless Chromium, with `--no-sandbox`, and leaks the process on any throw** (`browser.close()` not in `finally`). Trivially exhausts the host. | `brochure/route.ts:45-67` |
| **P0-5** | **Unit-level data is known-untrustworthy but read unguarded.** Source states `units_pub` holds seed inventory for two unrelated projects; `/projects/[slug]/[unitSlug]`, `getAllPublishedUnits()` and `/api/brochure` read it and present it as a real listing. **Risks violating #9/#10 at runtime.** | `properties/page.tsx:1-12` vs `projection.ts:115-148` |
| **P0-6** | **Zero automated verification of the production frontend.** `apps/public` has no `test` script; Playwright runs one kiosk spec; the architecture-validating persistence test is orphaned **and stale** (its probe IDs exist only in dead code). **Violates #19.** | `playwright.config.ts:13`; `e2e-slice0/persistence.spec.ts` vs `ExperienceCanvas.tsx:143` |

### P1 — severely damages the commercial product

| # | Blocker | Evidence |
|---|---|---|
| **P1-1** | **`/projects/[projectSlug]` — the highest-value route — is a light-theme generic Tailwind page with no canvas, and no metadata at all.** | `projects/[projectSlug]/page.tsx:44-46` |
| **P1-2** | **No OG/Twitter/canonical/JSON-LD/metadataBase anywhere.** Every WhatsApp share renders bare; `/` and `/site-home` are uncanonicalised duplicates; three offices with full addresses sit in `branches.ts` with no `LocalBusiness` markup. Zero-cost, high-return. | grep across `src/` |
| **P1-3** | **Set-swap transition has no loading state.** `/` → `/hall` swaps 2.31 MB for 14.38 MB inside `<Suspense fallback={null}>` with the Preloader already unmounted. | `WorldCanvas.tsx:910-918`; `Preloader.tsx:107` |
| **P1-4** | **Preloader failsafe can dismiss before loading begins** (e.g. background tab), after which the full payload downloads with no indicator. Failsafe cannot distinguish "nothing to load" from "not measured yet". | `Preloader.tsx:74-91`; runtime-observed |
| **P1-5** | **`.prose-surface` is undefined** — applied to the content wrapper of all 17 `Surface` pages. | `Surface.tsx:113` |
| **P1-6** | **10,894 px scroll (15.1 viewports) enforced identically on mobile** by `min-h-[10000px]`. | measured; `site-home:78` |
| **P1-7** | **Zero mobile/tablet testing.** Playwright is Desktop Chrome only, for a build whose stated primary risk is mid-tier Android. | `playwright.config.ts:22-25` |
| **P1-8** | **`SpatialCards` fixed `width: 420` px** exceeds a 360 px viewport. | `SpatialCards.tsx:151` |
| **P1-9** | **`.ignored_node_modules/` committed** — 10,588 files, **92 % of the repo**, including `next`, `react`, `typescript`, `playwright`. | `git ls-files` |
| **P1-10** | **No custom 404.** `notFound()` renders Next's default white page on a dark cinematic site. | no `not-found.tsx` |
| **P1-11** | **CSP `script-src 'unsafe-eval' 'unsafe-inline'`** site-wide. | `next.config.mjs:12` |
| **P1-12** | **17 of 26 pages have no `<main>` landmark; no skip link.** | grep |

### P2 — meaningful quality/performance debt

**P2-1** `useScrollProgress()` × 3 → 3 `useFrame` + 3 `ResizeObserver`s on `body` (`WorldCanvas.tsx:179`, `:610`, `Terrain.tsx:230`). **P2-2** Full-scene recursive raycast every 0.5 s for telemetry only (`WorldCanvas.tsx:393`). **P2-3** Tier latches and never demotes; `reset()` never called (`useDeviceTier.ts:62`). **P2-4** Terrain 204,800 tris, `frustumCulled={false}`, no disposal. **P2-5** `/projects/[slug]` at 435 kB First Load JS (maplibre 265 KB gz). **P2-6** Reduced-motion still animates the camera. **P2-7** `revalidatePath('/')` may not invalidate `/site-home` — UNCERTAIN. **P2-8** Sentry `tracesSampleRate: 1.0`. **P2-9** Production `console.info` scene dumps. **P2-10** Mobile menu has no focus trap; 40 px touch target. **P2-11** `backdrop-filter: blur(20px)` ×3 over a live canvas. **P2-12** No `onError` on texture loads.

### P3 — hygiene

**P3-1** Dead code: `ExperienceCanvas.tsx` (158), `NodePanel.tsx` (57), `lib/spatial-nav.ts` (238) = **453 lines**. **P3-2** `leva`, `r3f-perf`, `postprocessing` declared, never imported; `@estate/ui` unused in `src/`. **P3-3** `playwright` as a runtime `dependency`. **P3-4** `SCRUB` comment contradicts its value. **P3-5** Unreachable honeypot branch (`actions.ts:44-47`). **P3-6** `fallbacks` matcher references a non-existent directory. **P3-7** `/site-home` bypasses middleware → no cookies. **P3-8** `slice0.tmp.config.ts` exists because default E2E setup seeds the **live** database. **P3-9** Root `<body className="bg-white">`. **P3-10** `sw.js` shipped but only kiosk-registered. **P3-11** Stale header comment in `site-home/page.tsx:1` (wrong path).

---

# 25. UNKNOWN / NEEDS RUNTIME VERIFICATION

Everything below could **not** be proven from source or from the checks I was able to run.

1. **All visual output. RUNTIME VISUAL VERIFICATION REQUIRED.** The Browser pane could not be displayed; `computer screenshot` failed with *"the Browser pane is not displayed, so the page is not compositing frames"*, and the page remained `visibilityState: "hidden"` after `tabs_select`. **I have not seen a rendered frame of this site.**
2. **All FPS / frame-time figures. NOT MEASURED** on any device or tier.
3. **Draw-call and triangle counts at runtime** (`renderer.info.render.calls`/`triangles`). My ~240 figure is derived from GLB primitive counts + shadow-pass reasoning, **not measured**.
4. **Whether r3f v8 disposes a geometry passed via the `geometry={}` prop.** UNCERTAIN. Determines whether `/` ↔ `/hall` leaks ~1.2 MB of GPU buffers per round trip (§11).
5. **Whether `dpr` re-applies when tier changes** after the canvas has mounted (canvas never unmounts). UNCERTAIN.
6. **Whether `revalidatePath('/', 'page')` invalidates the rewritten `/site-home` ISR entry.** UNCERTAIN — determines whether publishes appear within an hour or not at all.
7. **The background-tab preloader path** (P1-4). I observed the exact symptom but traced it to a hidden-tab artifact in my environment; the production reachability of the same sequence is **RUNTIME VERIFICATION REQUIRED**.
8. **Portrait-aspect camera framing.** No vertical-FOV compensation exists; whether the establishing shot crops badly at 9:19.5 is unverified.
9. **`SpatialCards` legibility and occlusion on ≤430 px** viewports.
10. **Actual contrast ratios** for `text-[#F2EDE4]/25` and `/35` over `#0A1120`. Not computed.
11. **Emitted `<meta>` tags at runtime.** I read `.next/server/app/site-home.html` before starting the dev server, but the dev run **overwrote `.next`**, so the meta-tag check could not be completed. The SEO findings in §16 are **source-verified by grep**, not output-verified.
12. **Whether `@react-three/postprocessing` disposes composer render targets** on `PostFX` remount.
13. **Real load times** for 2.31 MB / 14.38 MB payloads on mid-tier Android over Indian 4G.
14. **Thermal behaviour** over a sustained session; whether the latched tier causes sustained frame drops.
15. **`.github/` CI configuration** — not inspected.
16. **MapTiler key domain restriction** and free-tier headroom (relevant to #8).
17. **Whether the production host can run Playwright/Chromium** at all (`/api/brochure` hard-requires it).
18. **`interior_hall.glb` runtime draw calls** — the manifest claims 480,385 drawn triangles via instancing; unverified against `renderer.info`.
19. **Heading order / `<h1>` uniqueness** when the mobile menu is open.
20. **Whether the three `holo3d_S*` stations are visually legible** as interactive affordances despite having no interaction.

---

# 26. FILES THAT MUST NOT BE TOUCHED WITHOUT EXPLICIT AUTHORIZATION

Based on the forensic findings — these encode hard-won, non-obvious correctness. Each carries a documented failure that was already shipped once.

### Tier 1 — changing these silently breaks rendering

| File | Why |
|---|---|
| `src/components/experience/HallModel.tsx` | `promoteLightmaps()` (`:58-81`): `aoMap`→`lightMap`, **`SRGBColorSpace`**, `lightMapIntensity = 4.6597`. Drop any one and the room renders ~2× dark or bands. `attachLoaders()` (`:38-49`) — the explicit `'/draco/'` second arg to `useGLTF` is load-bearing: drei otherwise attaches a **gstatic** decoder *after* `extendLoader`, which the CSP blocks, and the model never decodes. The absence of `useGLTF.preload()` (`:154-165`) is deliberate. |
| `src/components/experience/ExteriorModel.tsx` | Same drei/Draco trap (`:253`). `applyGrade()` idempotency guards `__graded`/`__pbr`; `EMISSIVE` at 0.55 sits **just below** the 0.85 bloom threshold; `MAT_Ground`/`MAT_Hedge` overrides exist because the exporter dropped node-based colour; `ground_plane` hidden for `<Terrain/>`; sRGB vs linear per map type (`:155`). |
| `src/components/experience/WorldCanvas.tsx` | `LOOK` (`:476-514`) — exposure 0.6 is the **reciprocal of the 4.66× lightmap gain**; 1.0 blew to white, 0.32 compounded with the scrim to black. `<Exposure>` (`:777-783`) exists because `onCreated` fires once for a canvas that never unmounts. `CLIP` per set. `FRAME_OFFSET`/`SWING`/`SCRUB`. `RectAreaLightUniformsLib.init()` at module scope (`:85`). Key light at `(30,15,-80)` is coupled to `Terrain`'s `uSunDir` **and** `PostFX`'s `SunDisc`. `RoomEnvironmentMap` replaced a CSP-blocked CDN HDRI that took the whole canvas down. |
| `src/components/experience/PostFX.tsx` | **No `ToneMapping` effect** (`:7-19`) — three tone-maps in-material; adding one reproduces the "radioactive yellow" rejection. `SunDisc` must be **outside** the composer. `sun` must be **state, not a ref**. GodRays clamps are tuned to ACES headroom. |
| `src/components/experience/cameraPath.ts` | Beats are collision-audited against real geometry by `tools/blender/audit_camera_path.py`. **Centripetal** Catmull-Rom is required — uniform overshoots between beats and can fly through the fountain. `curveT()` remaps uneven `at` values onto curve parameter. |
| `src/components/experience/poses.ts` | Every coordinate is Blender→three (`x, z, −y`) and **render-verified**. Three cameras already reached the client aimed at a wall, at nothing, and at the outside of a building. |
| `src/components/experience/SmoothScroll.tsx` | One ticker. `lagSmoothing(0)` then restore. `syncTouch:false`. Deliberately not ScrollTrigger. |
| `src/components/experience/useScrollProgress.ts` | Returns a **ref** by design; samples in `useFrame` not on the scroll event; `ResizeObserver` on `body` handles route-driven height changes. |
| `next.config.mjs` | `blob:` in `connect-src` is **required** — GLTFLoader hands embedded KTX2 to the transcoder worker as blob URLs; without it all 28 textures fail and the WASM transcoder aborts with a misleading `LinkError`. |
| `src/middleware.ts` | The `/` → `/site-home` rewrite is the **only** thing making the home page exist. The matcher must keep excluding `site-home`/`present-home` or it re-fires. |
| `public/models/*.glb`, `public/models/interior_hall.manifest.json`, `public/textures/**`, `public/draco/**`, `public/basis/**` | Binary contract. `4.6597`, `TEXCOORD_1`, ETC1S/UASTC split, and the rebuild pipeline are recorded in the manifest. |

### Tier 2 — data, legal, and contract surfaces

`packages/domain/src/leads/branches.ts` (transcribed client facts; routing a lead to the wrong office is a commercial failure) · `packages/domain/src/experience/places.ts` + `places.test.ts` · `packages/domain/src/telemetry/device-tier.ts` + test · `src/lib/projection.ts` (bigint-as-text paise, schema-qualified PostGIS, server-side GeoJSON) · `src/app/(site)/actions.ts` (HMAC + server-side session) · `src/app/api/telemetry/route.ts` (server-side consent) · `src/lib/consent/**` + `src/components/consent/ConsentPanel.tsx` · `src/app/(site)/(experience)/{privacy,terms,refund-policy}/page.tsx` and `Pending.tsx` (`<Pending>` markers + `noindex` must stay in sync with `sitemap.ts`) · `src/app/sitemap.ts` (`NOINDEX_PENDING`/`UNWRITTEN`/`UNBUILT` are request-verified) · `src/app/robots.ts`.

### Safe to remove once authorised (verified zero importers)

`src/components/experience/NodePanel.tsx` (57) · `src/lib/spatial-nav.ts` (238) · `src/components/experience/ExperienceCanvas.tsx` (158) — **but** it is the sole source of `persistence-probe`/`probe-ctx`/`probe-gen` and the only `webglcontextlost` handler in the repo. **Do not delete before P0-1 is addressed and the persistence test is re-pointed at `WorldCanvas`.**

---

# 27. EXACT EVIDENCE

| Conclusion | File | Lines |
|---|---|---|
| Canvas mounted in layout, never unmounts | `src/app/(site)/(experience)/layout.tsx` | 15-25 |
| `ExperienceCanvas` const resolves to `WorldCanvas` | `src/components/experience/ExperienceCanvasHost.tsx` | 18-24 |
| `ExperienceCanvas.tsx` dead; sole probe IDs; sole context-loss handler | `src/components/experience/ExperienceCanvas.tsx` | 133, 143, 147, 150 |
| `NodePanel` dead | `src/components/experience/NodePanel.tsx` | whole file |
| `spatial-nav` dead | `src/lib/spatial-nav.ts` | whole file |
| `/` rewrite; matcher; `fallbacks` phantom | `src/middleware.ts` | 70, 78, 89 |
| `/` → `arrival` → exterior | `packages/domain/src/experience/places.ts` | 36 |
| Canvas config: shadows/dpr/AA/tone mapping | `src/components/experience/WorldCanvas.tsx` | 858-882 |
| Exposure per set (0.6 = 1/4.66) | ″ | 476-514 |
| Exposure reapplied (not `onCreated`) | ″ | 767-783 |
| Clip planes per set | ″ | 525-528, 757-765 |
| WebGL2-only probe | ″ | 449-456 |
| **Fallback aria-hidden at z-0** | ″ | 845-851 |
| Focusable link inside aria-hidden | `src/components/experience/SceneFallback.tsx` | 43 |
| `SceneBoundary` | `src/components/experience/WorldCanvas.tsx` | 431-447 |
| **Full-scene raycast every 0.5 s** | ″ | 385-406 |
| `useScrollProgress` ×3 | ″ 179, 610; `Terrain.tsx` | 230 |
| Exterior light rig | `src/components/experience/WorldCanvas.tsx` | 608-753 |
| PMREM created + disposed | ″ | 803-827 |
| Scratch vectors pre-allocated | ″ | 211-216 |
| FOV guard + roll after `lookAt` | ″ | 323-332 |
| `SCRUB = 0.12` vs stale comment | ″ | 50-64 |
| 5 camera beats | `src/components/experience/cameraPath.ts` | 64-122 |
| Centripetal Catmull-Rom | ″ | 134-140 |
| Lightmap promotion | `src/components/experience/HallModel.tsx` | 58-81 |
| Draco path trap | ″ | 89-103 |
| `preload()` removed deliberately | ″ | 154-165 |
| `console.info('[hall_ready]')` | ″ | 138 |
| Texture cache, no `onError` | `src/components/experience/ExteriorModel.tsx` | 142-159 |
| Ground hidden for Terrain | ″ | 174-182 |
| `console.info('[exterior_ready]')` | ″ | 276 |
| Terrain 460 m / 320 segs | `src/components/experience/Terrain.tsx` | 44-49, 232-235 |
| Terrain shaders | ″ | 61-226 |
| Motes | `src/components/experience/Motes.tsx` | 39, 51-111, 116-145 |
| PostFX tier gating | `src/components/experience/PostFX.tsx` | 62-151 |
| No ToneMapping pass (rationale) | ″ | 7-19 |
| Preloader failsafes | `src/components/experience/Preloader.tsx` | 52-58, 74-91, 107 |
| Lenis on one ticker | `src/components/experience/SmoothScroll.tsx` | 38-39, 41-46, 64-75 |
| Scroll progress as ref | `src/components/experience/useScrollProgress.ts` | 40-51, 83-90 |
| Tier measurement | `src/components/experience/useDeviceTier.ts` | 21, 44-63 |
| Tier decision (latches) | `packages/domain/src/telemetry/device-tier.ts` | 41-70 |
| Unused capability probe (kiosk only) | `src/lib/capability-probe.ts` | 21-101 |
| `SpatialCards` 420 px, per-frame style writes | `src/components/experience/SpatialCards.tsx` | 61-65, 130-131, 151, 156-157 |
| `.prose-surface` undefined | `src/components/experience/Surface.tsx` | 113 |
| `min-h-[10000px]` | `src/app/(site)/(experience)/site-home/page.tsx` | 78 |
| DB failure degrades in 3 layers | ″ | 48-58 |
| **`/properties` hardcoded (stated reason)** | `src/app/(site)/(experience)/properties/page.tsx` | 1-12, 33 |
| `/locations` hardcoded | `src/app/(site)/(experience)/locations/page.tsx` | 1-9, 30 |
| Hardcoded branches/projects | `packages/domain/src/leads/branches.ts` | 24-88 |
| Light-theme project page, no metadata | `src/app/(site)/projects/[projectSlug]/page.tsx` | 17-46 |
| Projection contract | `src/lib/projection.ts` | 6-11, 115-148, 249-253 |
| Sitemap exclusions | `src/app/sitemap.ts` | 28-40, 58-60 |
| robots throws on missing origin | `src/app/robots.ts` | 6-10 |
| Root layout: no metadata, white body | `src/app/layout.tsx` | 17-25 |
| **Chromium spawn, no-sandbox, close outside finally** | `src/app/api/brochure/[projectSlug]/[unitSlug]/route.ts` | 45-47, 67, 75-78 |
| Telemetry consent + caps + HMAC | `src/app/api/telemetry/route.ts` | 19-30, 35-59, 63-69, 126 |
| Revalidate: timing-unsafe, busts `/` | `src/app/api/revalidate/route.ts` | 10, 19 |
| Lead HMAC + server-side session; dead honeypot | `src/app/(site)/actions.ts` | 19, 44-47, 57-59, 82 |
| CSP `unsafe-eval`; `blob:` rationale | `next.config.mjs` | 12, 21, 24-34 |
| Consent cookie policy | `src/middleware.ts` | 28-58 |
| Type scale | `src/app/globals.css` | 24-31, 44-52 |
| Reduced motion CSS | ″ | 117-119, 143-145 |
| Header: 4 links, no focus trap, 40 px target | `src/components/site/SiteHeader.tsx` | 93, 130, 150-186 |
| Error boundary keeps layout | `src/app/(site)/(experience)/error.tsx` | 17-36 |
| Global error, inlined styles | `src/app/global-error.tsx` | 1-25 |
| Playwright: Desktop Chrome, kiosk testDir | `playwright.config.ts` | 13, 22-25 |
| Orphaned + stale persistence spec | `e2e-slice0/persistence.spec.ts` | 8-40 |
| Temp config exists due to live-DB seeding | `slice0.tmp.config.ts` | 1-3 |
| Sentry 100 % traces | `sentry.client.config.ts`, `sentry.server.config.ts` | 6 |
| GLB stats | `public/models/*.glb` | parsed JSON chunk |
| Asset manifest / bake contract | `public/models/interior_hall.manifest.json` | whole file |

### Commands run (all non-mutating)

`git rev-parse` · `git status --porcelain` · `git log -1` · `git ls-files` · `git check-ignore -v` · `git grep` · `node --version` · `npm --version` · `find` · `wc` · `stat` · `gzip -9 -c | wc -c` · `node -e` (GLB JSON-chunk parse, read-only) · `npx tsc --noEmit` (and `--incremental false`) · `npx next lint` · `npx next build` · dev server via existing `.claude/launch.json` `public` config, then stopped.

**Writes touched only gitignored paths** (`.next/`, `*.tsbuildinfo`). **No file was created, edited, renamed, moved, or deleted. No package was installed or updated. No `package.json` or lockfile was modified. No git history operation was performed. Branch `main` and HEAD `8925521` are unchanged; the working tree remains clean.**

Stopping here as instructed — no roadmap, no redesign, no implementation. Awaiting further instructions.