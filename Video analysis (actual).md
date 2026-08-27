### 1. Complete Current Experience Timeline

---

#### 00:00–00:10 | Hero Exterior — Classical Heritage Mansion

* **Camera Position & Direction**: High-angle, three-quarter aerial perspective looking down at an exterior neoclassical/traditional stone estate. Fixed focal target centered on the building facade.
* **Camera Movement**: Static hold with minimal to no ambient drift.
* **Scroll Relationship**: Static initialization. At 00:09, user initiates downward scroll, triggering text exit.
* **3D Scene & Objects**: A classical stone palace/estate featuring a traditional tiered roof/shikhara, surrounded by low-poly dark green undulating terrain, simple conical trees, and small lampposts with basic point lights.
* **Lighting & Materials**: Dim ambient lighting. Flat diffuse textures on terrain and building stone. Point lights on lampposts lack realistic photometric falloff and volumetric scattering.
* **Typography & UI**: High-contrast white serif editorial typography on the left (*"Land, in the districts we come from..."*). Top fixed navigation bar (`[ PLOTS | PLANS | KNOWLEDGE | OFFICES ] [ ENQUIRE ]`).
* **Transitions & Pacing**: Static hold transitioning into an orbit upon scroll input.
* **Visual Focal Point**: The front facade and entrance of the heritage building.
* **Why It Matters**: Establishes the real-estate brand's physical presence, but feels visually detached due to the low-fidelity terrain and absence of atmospheric depth.

---

#### 00:10–00:16 | Exterior Camera Orbit & Narrative Statement

* **Camera Position & Direction**: Camera orbits around the right corner of the building, lowering slightly in elevation.
* **Camera Movement**: Smooth radial orbit along a fixed radius.
* **Scroll Relationship**: Direct scroll-driven camera translation along the orbit path.
* **3D Scene & Objects**: Side profile of the building revealed. The background terrain remains dark, unlit, and featureless.
* **Typography & UI**: Editorial text on left fades in: *"TWENTY YEARS, ONE DISTRICT / We do not broker land. We develop it..."*
* **Visual Focal Point**: Side architectural profile and window lighting.
* **Why It Matters**: Continues the brand story, but the camera trajectory does not lead toward a natural architectural entry point.

---

#### 00:16–00:31 | The Data Particle Sphere — *"Every Plot, Plotted"*

* **Camera Position & Direction**: Sudden perspective shift. The camera isolates a rolling dark terrain with a massive floating spherical point-cloud.
* **Camera Movement**: Static hold facing the particle sphere.
* **Scroll Relationship**: Camera settles at a fixed vantage point while the particle sphere animates in place.
* **3D Scene & Objects**: A dense, pulsating spherical lattice of golden/amber glowing particles suspended over empty green hills.
* **Lighting & Materials**: High-contrast dark void. Amber emissive particles with subtle bloom.
* **Typography & UI**: Left panel displays numerical counters (*"LAYOUTS 3 | PLOTS 407 | OPEN 344"*).
* **Interaction**: Cursor hovers over the particle sphere; minimal direct physics or displacement reaction.
* **Visual Focal Point**: The pulsating amber particle sphere.
* **Why It Matters**: Introduces abstract scale and data visualization, directly mirroring the particle sphere mechanic from the benchmark reference.

---

#### 00:31–00:40 | Scene Transition to Grand Hall & Scroll Instability

* **Camera Position & Direction**: Rapid plunge toward blackness, followed by a sudden interior reveal of a grand neoclassical staircase.
* **Camera Movement**: Erratic stepping/flickering between timestamps 00:35 and 00:38 caused by scroll threshold conflicts between the exterior particle scene and the interior scene.
* **Scroll Relationship**: Unstable scroll-trigger threshold causing canvas flickering/z-buffer clipping between two distinct scenes.
* **3D Scene & Objects**: Grand neoclassical hall with a central dual-tier staircase, deep red carpet runner, dark wooden balustrades, classical wall moldings, and stone pedestals.
* **Lighting & Materials**: Warm interior spotlights. Stone walls appear matte and flat; wooden balustrades lack specularity; red carpet texture lacks realistic velvet/pile anisotropy.
* **Typography & UI**: Narrative text appears: *"INSIDE / Each layout stands on its own table..."*
* **Visual Focal Point**: Center landing of the grand staircase.
* **Why It Matters**: Represents the crucial exterior-to-interior transition. The mechanical flickering disrupts immersion and exposes the boundary between discrete scenes.

---

#### 00:40–00:55 | Station 1 — Kartikeya Water Front

* **Camera Position & Direction**: Camera tracks left from the center staircase to frame a stone pedestal table on the left flank.
* **Camera Movement**: Linear horizontal pan and subtle push-in toward the pedestal.
* **Scroll Relationship**: Scroll drives camera to the first designated station keyframe.
* **3D Scene & Objects**: Above the stone table floats a rotating 3D wireframe hologram of a layout master plan with glowing white boundary lines.
* **Typography & UI**: At 00:51, a massive flat 2D graphic card (white background, CAD layout plan, green status badges) slides up abruptly from the bottom-left viewport, occluding half of the 3D interior.
* **Interaction**: Hologram rotates continuously along its Y-axis.
* **Visual Focal Point**: The 2D layout card overriding the 3D scene.
* **Why It Matters**: Illustrates the disconnect between the 3D spatial world and 2D UI presentation. The 2D card acts as an opaque overlay rather than an integrated spatial artifact.

---

#### 00:55–00:59 | Station 2 — Lucky Garden

* **Camera Position & Direction**: Camera pans right, tracking past the central staircase.
* **Camera Movement**: Linear horizontal dolly.
* **Scroll Relationship**: Scroll advances to index `02 / 03`.
* **3D Scene & Objects**: Second pedestal table. Wireframe hologram updates.
* **Typography & UI**: The 2D sheet content switches to *"Lucky Garden / Kumaram Village"*, remaining locked as a screen-space overlay.
* **Visual Focal Point**: The 2D layout graphic sheet.
* **Why It Matters**: Re-emphasizes the repetitive presentation pattern; camera framing feels obstructed by the central staircase.

---

#### 00:59–01:02 | Station 3 — VSR Gayatri Township

* **Camera Position & Direction**: Camera continues dolly movement toward the right flank of the staircase.
* **Camera Movement**: Lateral tracking with minimal focal tilt.
* **Scroll Relationship**: Scroll advances to index `03 / 03`.
* **3D Scene & Objects**: Third project station.
* **Typography & UI**: 2D overlay updates to *"VSR Gayatri Township / Bayyannapeta"*.
* **Visual Focal Point**: 2D layout sheet.
* **Why It Matters**: Completes the project showcase loop without spatial progression.

---

#### 01:02–01:05 | Ascending the Staircase — *"At the Top of the Stairs"*

* **Camera Position & Direction**: Camera rotates toward center and tilts upward along the angle of the grand staircase, framing the top wall landing.
* **Camera Movement**: Crane-up and tilt-up.
* **Scroll Relationship**: Continuous scroll advances the camera up the architectural path.
* **3D Scene & Objects**: Empty picture frame / wall molding located at the top staircase landing.
* **Lighting & Materials**: Flat wall texture, dark shadows lacking ambient bounce.
* **Typography & UI**: Text overlay: *"AT THE TOP OF THE STAIRS / The name on the sanction letters has been the same for twenty years. / WHO WE ARE ->"*.
* **Visual Focal Point**: The empty picture frame at the top of the stairs.
* **Why It Matters**: Serves as the narrative culmination of the interior walkthrough, but lacks a resolved visual subject within the frame.

---

#### 01:05–01:08 | Hard Transition to 2D HTML Footer

* **Camera Position & Direction**: 3D Canvas unpins or is pushed off-screen vertically.
* **Camera Movement**: Standard browser window scroll.
* **Scroll Relationship**: Abrupt handover from WebGL timeline control to native DOM document flow.
* **3D Scene & Objects**: None (WebGL canvas is obscured/culled).
* **Typography & UI**: Standard multi-column corporate footer with office addresses (Visakhapatnam, Vizianagaram, Srikakulam), phone numbers, and legal links.
* **Visual Focal Point**: Flat footer typography.
* **Why It Matters**: Breaks the immersive 3D continuous canvas illusion, shifting instantly into a traditional utility webpage layout.

---

### 2. Side-by-Side Gap Analysis

| Phase / Dimension | Reference Benchmark | Current QHR Implementation | What QHR is Missing | What QHR Does Better | Actionable Verdict |
| --- | --- | --- | --- | --- | --- |
| **Hero Landing** | Low-angle, dramatic perspective with dynamic lighting, deep shadows, and subtle particle atmosphere. | High-angle aerial view of a neoclassical mansion on dark green terrain with flat lighting. | Atmospheric depth, dramatic low-angle framing, fog, and ground contact shadow fidelity. | Authentic regional architectural character rather than generic sci-fi blocks. | **Keep architecture; lower camera angle, add volumetric fog and photometric lighting.** |
| **Data / Particle Reveal** | Roof splits mechanically; camera looks down into a glowing, pulsing interior particle core. | Disconnected cut to an isolated particle sphere floating over rolling terrain. | Architectural connection. The particle system exists in an unrelated vacuum. | Clear statistical data typography and regional plot metrics (`407 Plots`, `344 Open`). | **Integrate the particle cloud directly inside/above the mansion architecture.** |
| **Exterior $\rightarrow$ Interior Transition** | Camera pushes along the Z-axis straight through a physical exterior wall acting as a seamless portal mask. | Abrupt cut/fade with visible scroll-threshold flickering (00:35–00:38) into a separate hall. | Smooth portal masking, continuous camera trajectory, and unified scene management. | Traditional grand staircase interior concept with red carpet and architectural symmetry. | **Eliminate the black cut; push camera through the front doors using depth masking.** |
| **Project Showcase** | 3D holographic UI rings and spatial displays integrated natively into room coordinates. | Large 2D CAD graphic cards slide up over the left viewport, obscuring half the 3D scene. | Spatial integration. 2D graphics feel like flat modal overlays rather than physical/holographic elements. | Legible, accurate municipal layout plans that provide transparent real-estate data. | **Project the CAD layout directly onto the 3D table surface as an interactive hologram.** |
| **Final Resolution / Footer** | Camera transitions into dark void with interactive typographic scramble and dynamic cursor shaders. | 3D canvas cuts out abruptly to reveal a standard flat HTML footer. | Continuous canvas background, subtle particle dissipation, and typographic motion design. | Complete and transparent local office directories, branch addresses, and contact info. | **Render the footer over a continuous 3D canvas background with ambient particles.** |

---

### 3. Visual Quality Gap Analysis

```
Current QHR Visual Assessment (Scale 1–10)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Camera Choreography    [5.0/10]  █████░░░░░
Architecture           [6.5/10]  ██████▌░░░
Environment & Terrain  [3.5/10]  ████░░░░░░
Lighting & Shadows     [4.0/10]  ████░░░░░░
Material Quality       [4.0/10]  ████░░░░░░
Animation Rigging      [4.5/10]  ████▌░░░░░
Scene Transitions      [3.0/10]  ███░░░░░░░
Typography             [7.0/10]  ███████░░░
UI Integration         [4.5/10]  ████▌░░░░░
Interaction Design     [4.0/10]  ████░░░░░░
Pacing & Rhythm        [4.0/10]  ████░░░░░░
Photorealism           [4.0/10]  ████░░░░░░
Luxury Perception      [4.5/10]  ████▌░░░░░
Cinematic Depth        [4.0/10]  ████░░░░░░
Originality            [6.0/10]  ██████░░░░
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```

#### Detailed Justifications:

* **Camera Choreography (5.0/10)**: Uses basic circular orbits and discrete linear pans. Lacks dynamic multi-axis Catmull-Rom spline continuity and organic camera inertia.
* **Architecture (6.5/10)**: Strong cultural identity with regional stone palace aesthetics and grand staircase proportions. Mesh topology and edge beveling, however, appear sharp and CG-like.
* **Environment & Terrain (3.5/10)**: Terrain is an undifferentiated dark green surface with low-poly conical trees. Lacks ground micro-detail, foliage density, pathways, and atmospheric horizon blending.
* **Lighting & Shadows (4.0/10)**: Relying on flat ambient illumination and un-attenuated point lights. Lacks directional key-light contrast, soft shadow contact penumbra, and volumetric god-rays.
* **Material Quality (4.0/10)**: Materials rely on basic diffuse color maps without roughness variation, normal maps, or anisotropic reflections (e.g., velvet carpet, polished marble, aged brass).
* **Scene Transitions (3.0/10)**: Severe drop due to threshold flickering at 00:35–00:38 and hard cuts between exterior, data, and interior scenes.
* **Typography (7.0/10)**: Well-crafted editorial typography hierarchy using sophisticated serif headlines and clean sans-serif data labels. Lacks dynamic shader-driven interactions on hover.
* **UI Integration (4.5/10)**: 2D project cards cover the 3D scene like flat modal windows, breaking the spatial immersion of the 3D environment.
* **Pacing & Rhythm (4.0/10)**: Jerky acceleration curves and abrupt scene switches disrupt the cinematic flow of a guided architectural tour.
* **Luxury Perception (4.5/10)**: The narrative voice and typography communicate luxury, but the raw 3D execution (flat lighting, harsh textures) pulls the experience down toward a mid-tier real-estate visualizer.

---

### 4. Camera Gap Breakdown

```
Current Camera Trajectory vs Recommended Spline Trajectory

CURRENT:
[Hero: High Orbit] ──(Cut)──> [Particle Sphere Void] ──(Glitch/Cut)──> [Interior Dolly Left/Right] ──(Tilt Up)──> [Empty Frame]

RECOMMENDED:
[Hero: Low Ground Push] ──(Continuous Rise & Tilt)──> [Mansion Roof Opens / Reveal] ──(Smooth Z-Push through Door Portal)──> [Cinematic Interior Steadicam Sweep]

```

* **Opening Composition**:
* *Current*: High-angle camera looking down at the building like a miniature toy model.
* *Requirement*: Low-angle architectural perspective looking slightly upward at the portico. This immediately gives the structure authority, scale, and grandeur.


* **Field of View (FOV) & Lens Feel**:
* *Current*: Narrow FOV (~45°–50°) resulting in an isometric, compressed look.
* *Requirement*: 24mm–28mm equivalent wide-angle architectural lens (~65°–70° FOV) with subtle lens distortion and peripheral falloff to emphasize spatial grandeur.


* **Interior Navigation Path**:
* *Current*: Clunky lateral stepping between left and right flanks of the staircase.
* *Requirement*: A sweeping Steadicam curve that enters through the double doors, drifts smoothly toward the first table, glides across the central rug, and tilts up the stairs in one continuous unbroken motion path.



---

### 5. Interior Gap Breakdown

```
Interior Material & Lighting Architecture

CURRENT:
┌─────────────────────────────────────────────────────────┐
│ Stone Walls (Flat Diffuse, No Specular)                 │
│ Marble Floor (Uniform Gloss, No Roughness Variation)    │
│ Red Carpet (Flat Solid Red Texture, Sharp Edges)        │
│ Lighting (Unattenuated Point Lights, Dark Void Ceiling) │
└─────────────────────────────────────────────────────────┘

UPGRADED LUXURY STANDARD:
┌─────────────────────────────────────────────────────────┐
│ Polished Italian Marble (PBR Roughness Map + Screen SSR)│
│ Crimson Velvet Runner (Normal Micro-fibers + Gold Trim) │
│ Fluted Teak Panels & Warm Ambient Sconces (IES Profiles)│
│ Warm Volumetric Light from Chandelier + Soft Occlusion  │
└─────────────────────────────────────────────────────────┘

```

#### Element-by-Element Forensic Analysis:

1. **Staircase & Carpet**:
* *Current*: The red runner carpet has razor-sharp geometry edges and a flat solid red color, resembling painted plastic.
* *Fix*: Add geometry thickness to the carpet mesh with beveled edges, gold brass stair rods pinning each step, and an anisotropic sheen shader to simulate real velvet/wool pile.


2. **Flooring & Marble**:
* *Current*: Floor tiles lack surface reflection fidelity and depth.
* *Fix*: Implement high-resolution PBR marble materials with distinct roughness maps (fingerprints, subtle foot-traffic wear) and real-time Screen Space Reflections (SSR) or planar reflection probes.


3. **Wall Paneling & Balustrades**:
* *Current*: Wall moldings are flat textures; wooden balustrades appear low-poly with uniform dark brown diffuse colors.
* *Fix*: Model real architectural moldings with proper normal map bevels. Apply dark polished Indian teak wood materials with clearcoat specular reflection.


4. **Lighting & Shadows**:
* *Current*: Harsh contrast between bright point light centers and pitch-black ceiling voids. No soft shadow contact (ambient occlusion).
* *Fix*: Bake ambient occlusion maps (or use ground-truth SSAO/GTAO). Add a central crystal/brass chandelier acting as the primary warm key light ($2700\text{K}$) paired with warm architectural wall sconces.



---

### 6. Project Station Gap Analysis

```
Project Station Experience Architecture

CURRENT IMPLEMENTATION:
┌──────────────────────────────────────────────────────────────┐
│ [Pedestal Table] ──> [Floating Wireframe] ──> [2D Card Pop] │
│ (Feels like a website modal window covering the 3D model)    │
└──────────────────────────────────────────────────────────────┘

UPGRADED LUXURY STANDARD:
┌──────────────────────────────────────────────────────────────┐
│ [Polished Teak Table] ──> [Interactive Holographic Masterplan]│
│ [Physical Glass Holo-Display with Depth & Spatial Labels]    │
│ (Feels like an interactive tactile architectural table)      │
└──────────────────────────────────────────────────────────────┘

```

* **Station 1 (Kartikeya Water Front)**:
* *Current*: Stone pedestal is under-lit; the 3D wireframe layout rotates without scale context; the sliding 2D CAD sheet completely blocks the 3D environment.
* *Verdict*: Feels like a standard 2D website modal pasted over a canvas.


* **Station 2 & 3 (Lucky Garden & VSR Gayatri)**:
* *Current*: Repetitive layout; camera struggles with framing because the staircase geometry occludes the station view.
* *Verdict*: Poor spatial staging.


* **The Solution**: Convert project stations into **Architectural Hologram Tables**:
* Project the sanctioned layout plan *onto the table surface* as a luminous architectural blueprint.
* Extrude plot boundaries into delicate glowing 3D volumes.
* Display plot metrics (e.g., *115 Available*) as floating spatial typography pinned in 3D world space above each plot quadrant.
* Allow click-to-expand interactions that zoom the 3D camera into a specific plot zone rather than opening an opaque 2D image sheet.



---

### 7. Motion Gap Analysis

```
Scroll Playhead to Animation Curve

CURRENT:
Scroll Input ──[Linear Stepping]──> Abrupt Cut ──[Stutter/Threshold Conflict]──> Sudden Stop

RECOMMENDED:
Scroll Input ──[Damped Inertia (Lerp 0.05)]──> [Continuous Catmull-Rom Spline] ──[Cubic Ease-Out]──> Smooth Hold

```

* **Scroll-Jacking & Threshold Stutter (00:35–00:38)**:
* *Issue*: Scroll progress triggers conflicting visibility states between Scene 1 (Exterior) and Scene 2 (Interior), causing violent frame flickering.
* *Correction*: Consolidate all scenes into a **single continuous timeline** driven by normalized scroll progress ($0.0 \rightarrow 1.0$). Never toggle canvas visibility or unmount scenes during transitions.


* **Camera Damping & Settling**:
* *Issue*: Camera stops instantly when scroll input ceases, producing a mechanical, robotic feel.
* *Correction*: Implement continuous exponential damping (Lerp damping factor: `0.05` to `0.08`). The camera must smoothly decelerate to its target hold position with natural momentum.


* **UI Motion**:
* *Issue*: 2D cards slide in with linear transform transitions.
* *Correction*: Stagger text elements using custom cubic bezier easing (`cubic-bezier(0.16, 1, 0.3, 1)`), revealing typography line-by-line with subtle Y-axis translation and opacity fades.



---

### 8. What Is Already Good (Must Preserve)

> **Mandatory Preservation Directives**:
> 1. **Regional Cultural Authenticity**: The neoclassical Telugu/colonial estate architecture and stone shikhara roof elements give QHR a distinct identity. Do NOT replace this with generic sci-fi cyberpunk architecture.
> 2. **Editorial Typography**: The combination of elegant high-contrast serif headlines and clean technical sans-serif metrics is well-executed and communicates institutional trust.
> 3. **The Core Data Concept (*"Every Plot, Plotted"*)**: Translating 407 physical land parcels into an interactive particle lattice is a compelling creative concept. It needs technical refinement and architectural integration, not removal.
> 4. **Factual Integrity & Transparency**: Presenting real sanctioned layout numbers, plot dimensions, and official branch locations (Vizianagaram, Srikakulam, Vizag) builds genuine buyer trust.
> 
> 

---

### 9. Priority Matrix

| Priority | Problem Description | Why It Matters | Proposed Technical Fix | Domain | Expected Impact |
| --- | --- | --- | --- | --- | --- |
| **P0** | **Scene transition flickering & hard cuts** (00:35–00:38). | Breaks immersion; destroys technical credibility. | Merge exterior and interior into a single continuous scene coordinates setup; use a stencil portal shader on the entrance door. | **WebGL (Three.js)** | Seamless, award-winning cinematic transition. |
| **P0** | **2D CAD cards occluding the 3D scene**. | Destroys spatial immersion; feels like a generic 2D template. | Convert 2D layout sheets into spatial 3D holographic projection tables with world-space UI anchors. | **WebGL + Blender** | Transforms the site into a high-end interactive virtual sales gallery. |
| **P1** | **Flat exterior lighting and low-poly terrain**. | First impressions feel like an unrendered CAD model. | Add high-res displaced terrain mesh, volumetric height fog, ambient occlusion, and directional moonlight. | **Blender + Three.js** | Instant dramatic luxury atmosphere. |
| **P1** | **Flat interior materials (Carpet, Wood, Marble)**. | Interior hall looks like unfinished CG. | Re-texture with PBR workflow: normal maps, roughness maps, anisotropic carpet sheen, and real-time floor reflections. | **Blender (PBR Bake)** | Tactile, tangible architectural photorealism. |
| **P1** | **High-angle "toy model" opening camera**. | Diminishes the perceived grandeur and scale of the estate. | Lower camera to human eye-level ($Y = 1.6\text{m}$), wide FOV ($68^\circ$), looking up at the portico with smooth crane-rise on scroll. | **WebGL (Camera Spline)** | Dramatic architectural presence and scale. |
| **P2** | **Isolated floating particle sphere**. | Particle data feels disconnected from the physical real estate. | Position the particle system directly emerging from the roof of the building upon scroll reveal. | **WebGL + Blender** | Clear visual metaphor linking physical land to digital data. |
| **P2** | **Empty portrait frame at top of stairs**. | Narrative build-up (*"At the top of the stairs"*) leads to a visual anti-climax. | Place an interactive 3D brass crest / founder plaque or holographic archive terminal inside the frame. | **Blender + WebGL** | Satisfying narrative and visual resolution. |
| **P3** | **Static typography hover states**. | Missed opportunity for micro-delight and premium finish. | Implement GLSL text distortion/liquid hover shader on key headline elements. | **WebGL (GLSL Shader)** | Awwwards/FWA-level interactive polish. |

---

### 10. Blender Requirements & Consolidated Handoff

```
Blender Asset Re-Engineering Specifications
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Scene 1: Exterior Compound]           [Scene 2: Grand Interior Hall]
├── Ground: Displaced PBR Terrain     ├── Staircase: Beveled Teak + Brass Rods
├── Foliage: Instanced Palms & Flora   ├── Carpet: Velvet PBR + Micro-Normal
├── Architecture: Beveled Facade       ├── Tables: 3x Ornate Teak Pedestals
└── Lighting: Baked Ambient Occlusion  └── Top Landing: Ornate Gold Frame & Crest
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```

#### What Can Be Fixed in Three.js vs What Must Be Fixed in Blender:

* **Three.js Fixes**: Camera paths, scroll interpolation, post-processing bloom, SSAO/GTAO, lighting colors, particle dynamics, holographic table shaders, HTML UI overlays.
* **Blender Fixes**: Mesh geometry bevels, UV unwrap optimization, PBR texture map baking (diffuse, normal, roughness, metallic, AO), lightmap baking for static architectural bounce.

#### Consolidated Blender Handoff Directive:

1. **File Format & Export**: Single optimized `.glb` file using Draco compression and KTX2 texture compression.
2. **Exterior Geometry**:
* Bevel all sharp building edges ($2\text{cm}$ radius bevel modifier).
* Replace flat green plane with a sculpted terrain mesh containing gravel pathway curves leading to the entrance.
* Create separable front double-door meshes (`Door_Left`, `Door_Right`) with origin points set at hinges to allow programmatic opening.


3. **Interior Geometry**:
* **Staircase**: Add geometry bevels to balustrades and steps.
* **Carpet Runner**: Extrude a separate mesh over steps with $5\text{mm}$ thickness and gold brass retainer rods at step crevices.
* **Project Tables**: Model three distinct ornate heritage display tables with a top glass surface plate for holographic projection anchoring.
* **Top Landing**: Model an ornate classical gold-leaf frame containing a sculpted 3D emblem or high-res heritage seal.


4. **Texture Baking**:
* Bake full 32-bit Ambient Occlusion (AO) maps into UV Channel 2 for both exterior and interior structures.
* Provide $2048\times2048$ PBR texture sets (Albedo, Normal, Roughness, Metallic) for:
* `M_Heritage_Stone`
* `M_Polished_Teak`
* `M_Italian_Marble`
* `M_Crimson_Velvet`
* `M_Aged_Brass`





---

### 11. Final Technical Directive for Developer AI

```
================================================================================
FINAL TECHNICAL & CREATIVE DIRECTIVE FOR SYSTEM RE-ENGINEERING
================================================================================

KEEP:
- The heritage Telugu/colonial neoclassical architectural identity.
- The high-contrast serif editorial typography hierarchy and narrative copy.
- The "Every Plot, Plotted" particle data visualization concept.
- The authentic project layout plans and municipal data transparency.

CHANGE:
- Consolidate all independent canvas scenes into a single unified 3D coordinate space.
- Replace discrete scroll scene-triggers with a continuous master GSAP timeline mapped to scroll progress (0.0 to 1.0).
- Replace flat 2D layout card popups with spatial holographic table projections in 3D world space.
- Eliminate the high-angle miniature camera view in favor of an authoritative low-angle entrance perspective.

ADD:
- Seamless portal door transition: Camera glides through opening front double-doors directly into the grand hall without black cuts or flickering.
- UnrealBloomPass post-processing on particle spheres and holographic blueprint lines.
- Screen Space Reflections (SSR) or Planar Reflection Probes on the interior marble floor.
- Custom GLSL liquid/dispersion hover shader on interactive typography.
- Continuous exponential camera damping (Lerp damping factor: 0.06).

REMOVE:
- Remove hard scene-switching triggers that cause canvas flickering (00:35–00:38).
- Remove static low-poly green terrain and un-attenuated basic point lights.
- Remove full-screen blocking 2D image overlays during project station inspection.
- Remove abrupt canvas unpinning at footer; render footer over the continuous WebGL canvas.

BLENDER:
- Apply 2cm edge bevels to all exterior and interior architectural geometry.
- Model separate hinged front doors (`Door_Left`, `Door_Right`).
- Add carpet runner geometry with gold brass stair rods.
- Bake Ambient Occlusion (AO) maps to UV2 and export as a single Draco-compressed GLB.

CAMERA:
- Hero: Position at X: 0, Y: 1.6, Z: 18 (FOV: 68°), looking slightly upward at the mansion portico.
- Scroll 0.0–0.25: Crane upward smoothly while tracking the roof as it mechanically opens to reveal the glowing plot particle core.
- Scroll 0.25–0.45: Descend rapidly along a Catmull-Rom spline toward the front double-doors; doors pivot open as camera passes through portal threshold.
- Scroll 0.45–0.80: Smooth Steadicam glide across the interior hall, panning sequentially across the three holographic project tables.
- Scroll 0.80–1.0: Ascend the grand staircase, framing the illuminated gold heritage seal at the landing before easing to a final hold.

SCROLL:
- Drive the master timeline via Lenis smooth scroll coupled with GSAP ScrollTrigger.
- Normalize total scroll distance to 600vh with designated resting snap-zones at Hero, Data Core, Station 1, Station 2, Station 3, and Grand Landing.

LIGHTING:
- Exterior: Dark twilight skybox; directional cool moonlight (5500K, intensity: 1.8) casting long soft contact shadows; warm architectural interior spill (2700K).
- Interior: Central warm crystal chandelier key-light (2700K) + subtle cool fill + baked ambient occlusion.

MATERIALS:
- Floor: Black/White Italian marble with roughness texture map (0.15–0.45) and real-time screen-space reflections.
- Carpet: Deep crimson with anisotropic micro-roughness shader simulating velvet pile.
- Woodwork: Dark polished teak with clearcoat reflection layer.

PROJECT STATIONS:
- Project the CAD layout directly onto the glass pedestal table using an additive blending line shader (`THREE.AdditiveBlending`).
- Extrude 3D bounding boxes for individual plots; hovering over a plot highlights its perimeter and floats a 3D tooltip displaying plot dimensions and price.

PORTRAIT / TOP LANDING:
- Replace the empty frame with a high-relief 3D gold brass Quality Homes seal with subtle specular shimmer and volumetric light beam illumination.

PERFORMANCE:
- Target steady 60 FPS on mid-tier mobile and desktop GPUs.
- Utilize KTX2 texture compression for all PBR maps.
- Implement an adaptive pixel ratio limiter (`Math.min(window.devicePixelRatio, 2)`).
================================================================================

```