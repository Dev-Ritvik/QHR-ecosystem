MASTER DIRECTIVE — QHR IMMERSIVE REAL ESTATE EXPERIENCE
=========================================================

You are now the Lead Technical Director, Creative Developer, 3D WebGL Engineer,
and Digital Experience Art Director for the Quality Homes Realty public website.

THIS IS NOT A NORMAL WEBSITE REDESIGN.

We are building a premium cinematic WebGL real-estate experience for a
high-value luxury real-estate company.

The website is being developed against an extremely high visual benchmark:
Awwwards / FWA / SOTD / SOTM caliber immersive digital experiences.

The current website is technically functional, but visually it is NOT yet
expensive enough.

The current interior especially looks like a technically competent 3D scene,
not like an elite luxury real-estate presentation.

That changes now.

=========================================================
0. ABSOLUTE RULE — INSPECT BEFORE YOU MODIFY
=========================================================

DO NOT START CODING THE NEW EXPERIENCE IMMEDIATELY.

FIRST perform a complete forensic inspection of the existing repository and
the actual 3D assets.

Repository:

https://github.com/Dev-Ritvik/QHR-ecosystem

You have full repository access.

You MUST inspect the actual GLB files before making architectural or visual
decisions.

Known current assets include:

apps/public/public/models/exterior_mansion.glb
apps/public/public/models/interior_hall.glb
apps/public/public/models/interior_hall.manifest.json

Relevant existing experience files include:

apps/public/src/components/experience/ExteriorModel.tsx
apps/public/src/components/experience/HallModel.tsx
apps/public/src/components/experience/cameraPath.ts

There are also existing Blender inspection/export utilities under:

tools/blender/
tools/gltf/

USE THEM.

Do not infer the model structure from screenshots alone.

=========================================================
1. GLB FORENSICS — REQUIRED FIRST STEP
=========================================================

Before changing the experience, inspect BOTH GLBs programmatically.

For each GLB determine:

- exact scene hierarchy
- node names
- mesh names
- material names
- object transforms
- world-space bounds
- origin
- floor elevation
- roof elevation
- highest architectural point
- stair geometry
- doors
- windows
- chandeliers
- tables
- props
- portrait area
- wall panels
- existing project-map surfaces
- existing projector geometry
- existing hologram-related geometry
- existing decorative assets
- existing lights, if any
- cameras, if any
- animations, if any
- texture dependencies
- texture resolution
- texture color spaces
- normal maps
- lightmaps
- instancing
- Draco compression
- KTX2/Basis textures
- triangle count
- draw-call implications
- materials that can safely be manipulated at runtime
- materials that must remain untouched
- geometry that can be independently animated
- geometry that CANNOT be independently animated without Blender changes

Do not assume an object is independently movable merely because it visually
appears separate.

Produce a concise internal asset map before implementation.

For example:

EXTERIOR
---------
Mansion shell:
...
Roof/spire:
...
Ground:
...
Fountain:
...
Landscape:
...

INTERIOR
--------
Stairs:
...
Entry:
...
Left wall:
...
Right wall:
...
Project stations:
...
Portrait:
...
Chandelier:
...
Decor:
...

=========================================================
2. CRITICAL QUESTION — WHAT MUST GO BACK TO BLENDER?
=========================================================

This is extremely important.

The Blender work was commissioned separately and I can hire the Blender artist
again for ONE consolidated modification session.

Therefore:

DO NOT make five separate rounds of "please fix this in Blender."

Before implementing anything that requires new geometry, determine ALL required
Blender-side modifications at once.

Create a consolidated section:

BLENDER HANDOFF — REQUIRED MODIFICATIONS

Only include things that genuinely cannot or should not be solved cleanly
inside Three.js.

Examples may include:

- missing independently movable project tables
- missing projector geometry
- missing hologram anchor points
- missing portrait mount
- missing environmental geometry
- insufficient architectural detail
- stair geometry that cannot achieve the required luxury presentation
- missing pointed roof/spire geometry
- missing independent props
- missing UVs
- missing material separation
- missing animation anchors
- missing collision/proxy geometry
- missing pivot placement
- missing baked lighting requirements
- missing floor-plan display surfaces
- missing environment geometry
- any object that needs to be animated independently but is merged into another
  mesh
- any object whose topology/material assignment makes the intended experience
  impossible

DO NOT ask the Blender artist to "make it look better" generically.

Give exact object-level requirements.

For every Blender request provide:

1. Object name
2. Current problem
3. Required change
4. Required pivot/origin
5. Required material separation
6. Required naming convention
7. Required dimensions/approximate scale if necessary
8. Whether it must remain separate in GLB
9. Whether it needs UV2 / lightmap UV
10. Whether it needs animation
11. Whether it needs collision/proxy geometry
12. Export requirement
13. Why the web implementation cannot safely do it

I want ONE Blender handoff that covers everything.

Do not postpone Blender requirements until after implementation.

=========================================================
3. THE CREATIVE BENCHMARK
=========================================================

Reference:

https://www.vertex3d.asia/

Study the actual site.

Do not clone its branding, text, assets, or exact design.

Study its:

- pacing
- spatial storytelling
- camera choreography
- use of depth
- restraint
- typography
- transitions
- visual hierarchy
- relationship between 3D and HTML
- feeling of controlled discovery
- premium minimalism
- use of scroll as an interaction mechanism

The goal is:

NOT "a website containing a 3D mansion."

The goal is:

"an interactive cinematic property experience that happens to be a website."

The visitor should feel as if they have entered a private digital showroom.

=========================================================
4. BUSINESS POSITIONING
=========================================================

This is a ₹50,00,000-level website contract.

Therefore the visual language cannot communicate:

- template
- startup landing page
- generic real-estate website
- cheap 3D demo
- gaming website
- overdone neon WebGL experiment
- generic glassmorphism
- random gradients
- excessive UI
- stock-looking luxury
- "AI-generated luxury"

The visual language must communicate:

- heritage
- wealth
- permanence
- architectural authority
- private estate
- exclusivity
- craftsmanship
- trust
- sophistication
- scarcity
- high-value property
- Indian luxury with international digital execution

Think:

PRIVATE ESTATE
not
REAL ESTATE TEMPLATE.

=========================================================
5. THE CURRENT INTERIOR MUST BE UPGRADED
=========================================================

This is one of the highest-priority objectives.

The current mansion interior is technically competent but visually too cheap.

The biggest problems are:

- stairs feel inexpensive
- stair carpeting/material treatment looks cheap
- project stations feel like placeholders
- interior lighting does not yet communicate true luxury
- materials lack sufficient richness
- decorative elements don't have enough visual hierarchy
- the room feels like a 3D model instead of a professionally photographed luxury
  estate
- the composition does not yet have enough cinematic depth
- the project displays feel like "3D objects placed in a room"
- the overall room needs stronger architectural authority

DO NOT simply increase exposure.

DO NOT simply add bloom.

DO NOT simply add more lights.

DO NOT make everything gold.

DO NOT add random reflections.

DO NOT add excessive particles.

Those are shortcuts.

Instead evaluate:

- material roughness
- micro-surface response
- marble response
- wood response
- gold response
- fabric response
- stone response
- glass response
- chandelier response
- warm/cool lighting balance
- shadow softness
- indirect illumination
- contrast hierarchy
- composition
- focal depth
- camera height
- lens behavior
- atmospheric depth
- architectural framing

The result should look expensive even when the user stops scrolling.

=========================================================
6. INTERIOR ART DIRECTION
=========================================================

The interior should feel inspired by:

European royal estate
+
Indian luxury hospitality
+
private billionaire residence
+
high-end architectural visualization

WITHOUT becoming kitsch.

Use restraint.

Materials should feel physically believable.

The staircase is a major architectural hero.

It should read as:

MONUMENTAL
not
DECORATIVE.

The stair carpet/material must feel premium.

The handrails, balusters, newels and stone should have distinct material response.

The marble floor should have subtle depth and reflection, not a mirror-floor
effect.

The wood panels should have real depth and controlled specular response.

The gold should be restrained and physically believable.

The chandelier should feel like a luxury architectural centerpiece.

The room should have warm, sophisticated illumination with enough shadow to
create depth.

Do not flatten everything with ambient light.

=========================================================
7. OUTSIDE THE MANSION — OPENING SHOT
=========================================================

The experience MUST begin OUTSIDE.

The mansion is present inside a carefully art-directed environment.

It must NOT feel like:

"a GLB floating on a plane."

The environment should feel like a believable private estate.

The mansion should have:

- landscaped surroundings
- controlled atmospheric depth
- architectural framing
- believable ground
- subtle environmental variation
- appropriate horizon treatment
- controlled sky
- visual depth
- premium dusk/evening or editorial daylight grade depending on what works
  best with the actual asset

The mansion is the hero.

The environment supports it.

The environment must never overpower it.

=========================================================
8. MANSION ROOFLINE / POINTED END
=========================================================

The mansion must visibly terminate in the pointed architectural apex/spire
shown in the reference.

Use the actual GLB geometry if it already exists.

Do NOT fake the architectural point with a CSS overlay.

Do NOT add an arbitrary cone in Three.js if the actual model already contains
the architectural feature.

If the current GLB does not contain the required geometry or it is insufficient,
add it to the consolidated Blender handoff.

The roofline must read clearly during the opening camera movement.

=========================================================
9. OPENING CAMERA
=========================================================

Before the first scroll:

The visitor sees the mansion from a cinematic 3/4 elevated bird's-eye view.

Reference starting idea:

camera.position.set(-11, 8, 11)
camera.lookAt(0, 2, 0)

DO NOT blindly use those numbers.

Use them only as the conceptual starting point.

Derive the final camera from the actual GLB bounds.

The opening composition must show:

- enough of the mansion to understand its scale
- roof/spire
- front elevation
- stairs
- landscaping
- environment
- architectural symmetry
- depth

The camera must feel like a high-end architectural film.

No abrupt camera movement.

No mechanical interpolation.

No "camera follows scroll exactly" feeling.

Scroll should control a cinematic timeline.

=========================================================
10. FIRST SCROLL — ORBIT TO THE SPHERE
=========================================================

When the user scrolls:

The camera performs an ultra-smooth cinematic revolution around the mansion.

The mansion remains the visual anchor.

The movement should feel like a luxury architectural reveal.

At the end of this sequence:

the camera arrives approximately at the same height as the sphere.

The sphere is the next focal point.

=========================================================
11. THE GLOWING SPHERE
=========================================================

At the top of the scene there is a glowing spherical structure composed of many
small glowing spheres / points.

Reference concept:

a large dark/transparent environment containing a spherical constellation of
small luminous elements.

It should feel:

- technological
- sophisticated
- architectural
- premium
- restrained

NOT:

- gaming HUD
- cyberpunk
- cheap neon
- nightclub
- particle demo

The sphere should have:

- depth
- subtle bloom
- physically believable glow
- parallax
- internal spatial structure
- controlled motion

The hover interaction shown in the supplied reference must be retained.

Hover should produce a deliberate response.

Not a generic scale-up.

Consider:

- local brightness
- displacement
- particle attraction
- subtle distortion
- halo response
- cursor relationship

The interaction must remain elegant.

Beside the sphere:

place a sophisticated editorial text block.

Typography must feel like an award-winning digital experience.

Minimal text.

Strong hierarchy.

No giant generic hero heading.

=========================================================
12. SECOND SCROLL — ENTER THE MANSION
=========================================================

The next scroll transitions the user from the exterior experience into the
interior.

This transition is one of the most important moments in the entire website.

It must NOT feel like:

Scene A disappears.
Scene B appears.

Instead it must feel like:

the camera is entering the actual building.

The transition should preserve:

- spatial continuity
- scale
- orientation
- architectural identity
- lighting continuity

Use the existing exterior/interior architecture appropriately.

If a perfect physical transition is impossible because the two GLBs are separate
assets, create a cinematic transition that hides the discontinuity through:

- controlled camera movement
- architecture occlusion
- darkness/veil
- doorway framing
- depth
- exposure transition
- focus transition
- environmental continuity

Do NOT fake it with a hard cut.

=========================================================
13. INTERIOR ARRIVAL SHOT
=========================================================

On entering the mansion:

Start with a wide cinematic shot.

The visitor should understand the entire hall.

Composition should communicate:

A2 ---------------- STAIRS ---------------- A3
|                                               |
|                                               |
|                                               |
|                                               |
|                                               |
A1 --------------- ENTRY ---------------- A4

The staircase is the central architectural axis.

The project displays are positioned along the left/right sides.

The camera should initially establish the room.

Then:

transition toward a more cinematic telephoto look.

Conceptual target:

135mm
f/2.8

This is a VISUAL TARGET, not necessarily a literal physical camera setting.

The purpose is:

- compressed architectural perspective
- cinematic subject isolation
- controlled depth of field
- premium editorial feel

Do not make the entire room blurry.

Use depth of field selectively and carefully.

=========================================================
14. PROJECT TABLE SYSTEM
=========================================================

The project stations are central to the commercial purpose of the website.

There are FOUR project stations.

Each station consists of:

- vintage royal circular table
- hologram projector
- floating project hologram
- project name
- project floor/site map
- interaction hotspot

The first project should be visible on the left.

The station should feel like an object from a private estate showroom.

The table should NOT look like a generic 3D asset dropped into the room.

It must feel integrated with the architecture.

=========================================================
15. TABLE ROTATION INTERACTION
=========================================================

When the user clicks and drags/rotates the first table:

ONLY THE TABLE BASE rotates.

The following MUST NOT rotate with it:

- room
- camera
- stairs
- projector
- hologram
- surrounding architecture

The table itself is the interaction surface.

The projector/hologram system should remain spatially anchored unless the asset
structure makes another relationship clearly superior.

This interaction must feel deliberate.

No accidental camera orbit.

No page scrolling while the user is actively manipulating the table.

Use pointer capture appropriately.

Release interaction cleanly.

Support mouse and touch.

=========================================================
16. HOLOGRAM INTERACTION
=========================================================

The hologram displays:

PROJECT NAME
+
PROJECT SITE/FLOOR MAP

Examples include the actual projects already represented by the site's data,
such as:

Kartikeya Water Front
Lucky Garden

Do NOT invent project data.

Use the existing project/data contracts.

The hologram itself must be clickable.

Clicking the project hologram opens the appropriate project route.

The interaction should have:

- hover state
- cursor state
- subtle glow
- depth response
- clear affordance
- accessible fallback
- keyboard-accessible equivalent where appropriate

The hologram should NOT feel like a flat `<img>` floating in the room.

=========================================================
17. PROJECT 1 → PROJECT 2
=========================================================

After the first project station:

the user scrolls.

The camera performs a cinematic pan toward the second station.

The motion should feel like a camera operator intentionally reframing the room.

Not:

"x position += 10."

The second project station uses the exact same physical language.

Only its:

- project
- map
- metadata
- route

changes.

The transition should preserve the user's mental model.

=========================================================
18. PROJECT 2 → PROJECT 3
=========================================================

Next scroll:

camera travels across the hall.

Project 3 becomes the focal point.

The motion should include believable spatial depth.

Use the architecture as framing.

Do not move the camera through walls.

Do not allow the staircase to accidentally occlude the project.

The camera path must be designed around the actual room geometry.

=========================================================
19. PROJECT 3 → PROJECT 4
=========================================================

Next scroll:

camera moves toward the fourth project station.

Same system.

Same table.

Same projector.

Same hologram language.

Different project.

Different project route.

Do not duplicate components with four independent implementations.

Build one robust ProjectStation system driven by data.

=========================================================
20. PROJECT 4 → PORTRAIT
=========================================================

After the fourth project:

the camera moves diagonally back toward the staircase.

The portrait above the staircase becomes the final focal point.

Conceptual path:

                    [PORTRAIT]
                         ↑
                    [STAIR END]
                         ↑
                         ↑
                         ↑
                         ↑
                    [STAIR START]

The camera should move:

from the fourth station
→ across the room
→ toward the staircase
→ upward
→ toward the portrait.

This must feel like the culmination of the interior sequence.

=========================================================
21. PORTRAIT
=========================================================

The portrait is a major emotional anchor.

It should feel like the founder / legacy / authority point of the building.

Do NOT make it look like a random image texture pasted above the stairs.

Treat it as a physically integrated architectural portrait:

- proper frame
- correct scale
- believable mounting
- subtle lighting
- controlled contrast
- visual importance

Clicking the portrait opens the About Us page.

The portrait should have a subtle interactive response.

No cheesy hover animation.

Think:

slight focus shift
+
light response
+
cursor acknowledgement.

=========================================================
22. SCROLL IS THE CINEMATIC TIMELINE
=========================================================

This is critical.

Do not implement:

scroll event
→ directly set camera position.

The website needs a choreographed timeline.

Use the existing motion architecture where possible.

The experience should have defined cinematic chapters.

For example:

0.000–0.150
EXTERIOR HERO

0.150–0.300
MANSION ORBIT

0.300–0.400
SPHERE REVEAL

0.400–0.500
SPHERE / INFORMATION

0.500–0.600
ENTRY TRANSITION

0.600–0.680
INTERIOR ESTABLISHING SHOT

0.680–0.760
PROJECT 1

0.760–0.820
PROJECT 2

0.820–0.880
PROJECT 3

0.880–0.930
PROJECT 4

0.930–1.000
PORTRAIT / ABOUT

These are conceptual chapter boundaries.

Derive the actual implementation from the existing experience architecture.

The user should feel:

scroll
→ camera breathes
→ composition resolves
→ user understands scene
→ next scroll advances story.

Do not make every pixel of scroll input correspond linearly to camera movement.

=========================================================
23. CAMERA MOTION QUALITY
=========================================================

Camera motion must have:

- acceleration
- deceleration
- anticipation
- settling
- subtle overshoot only where appropriate
- cinematic easing
- controlled gaze

Position and look-at should NOT necessarily follow the same curve.

Use a separate target/look curve where useful.

The camera should sometimes arrive at a composition slightly before the next
focal object becomes active.

This creates anticipation.

No robotic camera.

No jerky lerp.

No constant-speed movement.

No Euler-angle spaghetti.

=========================================================
24. CINEMATIC LENS LANGUAGE
=========================================================

Use lens changes intentionally.

Exterior:

wide architectural lens.

Orbit:

moderate cinematic lens.

Sphere:

normal/portrait-ish framing.

Interior establishing shot:

wide.

Project stations:

telephoto / compressed.

Portrait:

telephoto with shallow but controlled depth.

Do not exaggerate depth of field to the point where the scene looks fake.

Depth of field should communicate focus.

=========================================================
25. LUXURY COLOR GRADE
=========================================================

Establish a coherent color system.

The visual language should be approximately:

warm ivory
+
aged stone
+
deep walnut
+
restrained antique gold
+
soft champagne highlights
+
controlled shadows
+
subtle atmospheric neutrals

Avoid:

- oversaturated gold
- orange everything
- neon
- pure black everywhere
- generic navy gradients
- excessive bloom
- "luxury" beige overload

The website should feel like a luxury editorial film.

=========================================================
26. LIGHTING PHILOSOPHY
=========================================================

Do not solve visual problems by throwing lights at them.

The existing repository has already undergone careful lighting and lightmap
engineering.

Respect the existing interior baked-GI contract.

Inspect it first.

Do not casually change:

- lightmap intensity
- exposure
- tone mapping
- transmission
- color pipeline

unless the actual rendered frame proves it is necessary.

The previous engineering audit established that:

- the interior lightmap pipeline is functional
- the non-lightmapped ornament is not actually flat
- transmission is behaving correctly
- the terrain shader issue was fixed
- the color pipeline survives a real tier change

Treat those as engineering constraints unless new evidence disproves them.

=========================================================
27. MATERIAL QUALITY
=========================================================

Prioritize material realism over additional geometry.

Evaluate:

MARBLE
- subtle roughness variation
- restrained reflections
- realistic scale
- no plastic appearance

WOOD
- visible grain
- correct roughness
- rich but not orange

GOLD
- physically believable
- not yellow paint

STONE
- microvariation
- soft roughness
- controlled specular

GLASS
- transmission where appropriate
- no fake white opacity

FABRIC/CARPET
- soft response
- subtle texture
- no flat color

The goal is to make a still frame look expensive.

=========================================================
28. ENVIRONMENTAL STORY
=========================================================

The exterior environment should tell a story.

It should feel like:

a private estate.

Use:

- terrain
- landscaping
- atmospheric perspective
- trees/hedges where the asset supports them
- fountain
- controlled sky
- subtle background depth

Avoid a visible giant plane edge.

Avoid "Unity demo scene" appearance.

Avoid generic HDRI-only lighting if it produces a flat result.

=========================================================
29. TYPOGRAPHY
=========================================================

Typography must be editorial.

Do not cover the screen with UI.

Use:

- restrained labels
- tiny uppercase metadata
- generous tracking
- elegant serif display typography where appropriate
- clean sans-serif supporting typography

Text should feel like an architecture publication.

Not a SaaS dashboard.

Not a gaming interface.

Not a real-estate brochure website.

=========================================================
30. UI / HUD
=========================================================

The UI must stay subordinate to the 3D scene.

The user should primarily perceive:

SPACE.

Not:

CARDS.

Use UI only when it improves:

- navigation
- context
- interaction
- accessibility
- conversion

Do not add floating glass panels everywhere.

Do not add generic gradient buttons.

Do not add unnecessary navigation chrome over the cinematic sequence.

=========================================================
31. HOVER / CURSOR LANGUAGE
=========================================================

The cursor system should have one coherent interaction language.

For:

- holograms
- portrait
- sphere
- table
- links

Use subtle state changes.

Avoid generic:

transform: scale(1.1)

as the entire interaction.

Prefer:

- light
- depth
- magnetic movement
- glow
- line drawing
- material response
- focus
- cursor ring changes

The user should feel that the world responds to them.

=========================================================
32. ACCESSIBILITY
=========================================================

Do NOT sacrifice accessibility for the visual experience.

All important interactive 3D objects need:

- accessible labels
- keyboard equivalent
- visible focus
- appropriate ARIA
- screen-reader fallback
- route fallback

The canvas must not trap keyboard navigation.

Reduced motion must produce a coherent editorial version of the same experience.

=========================================================
33. MOBILE
=========================================================

Do NOT attempt to force the desktop cinematic camera choreography unchanged
onto a 320px phone.

Mobile needs a deliberately art-directed composition.

The experience may simplify:

- camera path
- particle count
- post-processing
- DOF
- interaction
- hologram complexity

But it must NOT look like a broken desktop page.

Maintain:

- mansion identity
- project stations
- project navigation
- portrait
- visual hierarchy
- luxury aesthetic

=========================================================
34. PERFORMANCE
=========================================================

Do not destroy the engineering work already done.

Maintain the existing capability tiers.

Respect:

HIGH
MEDIUM
LOW

Do not add expensive effects without profiling them.

Every major visual effect must have a fallback.

Especially:

- bloom
- DOF
- transmission
- reflections
- particles
- environment
- holograms

No per-frame React state updates.

No per-frame allocations.

No unnecessary raycasts against the entire mansion.

Use proxies where appropriate.

Use instancing where appropriate.

Reuse assets.

Preserve KTX2/Draco loading.

Preserve loader caching.

=========================================================
35. DO NOT REBUILD THE ARCHITECTURE
=========================================================

Do NOT restart the project.

Do NOT replace the stack.

Do NOT migrate React versions.

Do NOT replace R3F.

Do NOT replace the existing camera architecture without proving it necessary.

Do NOT replace the data contracts.

Do NOT redesign the entire repository.

Do NOT create a second competing 3D engine.

Do NOT duplicate the entire scene into another implementation.

Extend the existing architecture.

If something is wrong, fix it at the correct layer.

=========================================================
36. DATA-DRIVEN PROJECT STATIONS
=========================================================

Build:

<ProjectStation project={...} />

rather than:

<Project1 />
<Project2 />
<Project3 />
<Project4 />

The station should derive:

- project name
- project ID
- map
- metadata
- route
- hologram content

from the existing project data.

Do NOT invent a parallel project data model.

=========================================================
37. HOLOGRAM ARCHITECTURE
=========================================================

Separate:

PROJECT DATA
from
HOLOGRAM PRESENTATION.

The hologram presentation should be reusable.

Possible structure:

ProjectStation
 ├── RoyalTable
 ├── Projector
 ├── Hologram
 │    ├── ProjectTitle
 │    ├── FloorMap
 │    ├── POILabels
 │    └── InteractionSurface
 └── InteractionController

But use the repository's existing conventions where better.

=========================================================
38. TABLE ROTATION ARCHITECTURE
=========================================================

The table should have an isolated transform hierarchy.

Conceptually:

ProjectStation
 ├── StaticStationRoot
 │    ├── Projector
 │    └── Hologram
 │
 └── RotatingTableRoot
      └── TableGeometry

DO NOT place projector/hologram underneath the rotating table if they must
remain stationary.

If the actual GLB hierarchy prevents this cleanly, determine whether a Blender
change is required and put it in the ONE Blender handoff.

=========================================================
39. CAMERA PATH IMPLEMENTATION
=========================================================

Use the existing camera path system if suitable.

The final path must be authored around actual model geometry.

The path must be checked against:

- stair railings
- columns
- walls
- tables
- projectors
- portrait
- ceiling
- exterior roof
- fountain
- ground

No camera clipping.

No camera inside architecture.

No accidental near-plane clipping.

No "floating camera" feeling.

=========================================================
40. VISUAL VALIDATION
=========================================================

Do not declare success because:

- TypeScript passes
- tests pass
- build passes
- GLB loads
- renderer.info looks healthy

Those are engineering gates.

This project has an additional gate:

DOES IT LOOK EXPENSIVE?

Use every available visual verification method.

Capture frames at the important camera nodes.

Inspect:

1. Exterior opening
2. Exterior orbit
3. Sphere
4. Entry transition
5. Interior establishing shot
6. Project 1
7. Project 2
8. Project 3
9. Project 4
10. Portrait

Compare each frame against the intended art direction.

If a frame looks like a cheap 3D demo, do not rationalize it.

Fix it.

=========================================================
41. AWWWARDS / SOTD TARGET
=========================================================

The objective is to build toward:

Awwwards Developer Award caliber
+
SOTD/SOTM caliber
+
FWA-level interaction quality

This is NOT a guarantee of winning.

The standard means:

- exceptional craft
- original interaction
- strong art direction
- technical execution
- coherent motion language
- performance
- accessibility
- originality
- no obvious template patterns
- no "AI slop"
- no generic WebGL gimmicks

Every decision should survive the question:

"Would an experienced Awwwards jury immediately recognize this as a
highly art-directed custom experience?"

If not, improve it.

=========================================================
42. WHAT COUNTS AS CHEAP
=========================================================

You must actively reject these patterns:

- generic glassmorphism
- random glowing lines
- excessive bloom
- neon particles everywhere
- giant text covering 50% of the screen
- floating cards
- random gradients
- excessive border radius
- stock 3D icons
- fake metallic gold
- flat marble
- plastic stone
- overexposed interiors
- excessive depth of field
- random camera movement
- generic cursor effects
- "AI luxury" visual language
- excessive UI
- template-like sections
- abrupt scene cuts
- fake loading animations
- decorative effects with no narrative purpose

=========================================================
43. WHAT COUNTS AS PREMIUM
=========================================================

Prioritize:

- composition
- silence
- negative space
- material realism
- architecture
- scale
- controlled lighting
- cinematic camera work
- subtle motion
- spatial continuity
- hierarchy
- typography
- tactile interaction
- believable physical relationships
- restrained effects
- intentional transitions

Premium does not mean "more effects."

Premium means:

EVERYTHING LOOKS INTENTIONAL.

=========================================================
44. IMPLEMENTATION ORDER
=========================================================

Follow this exact order.

PHASE 0
--------
Forensic asset inspection.

PHASE 1
--------
Produce the consolidated Blender handoff.

Do NOT proceed with Blender-dependent implementation until the requirements
are known.

PHASE 2
--------
Exterior art direction and opening camera.

PHASE 3
--------
Exterior orbit → sphere.

PHASE 4
--------
Sphere interaction and information layer.

PHASE 5
--------
Exterior → interior transition.

PHASE 6
--------
Interior luxury-grade lighting/material/composition pass.

PHASE 7
--------
Interior establishing shot.

PHASE 8
--------
ProjectStation architecture.

PHASE 9
--------
Project 1 choreography.

PHASE 10
---------
Project 2 choreography.

PHASE 11
---------
Project 3 choreography.

PHASE 12
---------
Project 4 choreography.

PHASE 13
---------
Project 4 → portrait choreography.

PHASE 14
---------
Portrait → About Us.

PHASE 15
---------
Mobile/reduced-motion/accessibility.

PHASE 16
---------
Performance profiling.

PHASE 17
---------
Visual QA.

=========================================================
45. IMPORTANT — DO NOT STOP AFTER MAKING IT FUNCTIONAL
=========================================================

A technically functional implementation is NOT the acceptance criterion.

Do not stop at:

"the camera moves."

It must be:

"the camera moves like a film."

Do not stop at:

"the hologram works."

It must be:

"the hologram feels like a premium interactive sales instrument."

Do not stop at:

"the interior renders."

It must be:

"the interior looks like an expensive private estate."

Do not stop at:

"the project route opens."

It must be:

"the transition makes the project discovery feel intentional."

=========================================================
46. EXISTING ENGINEERING WORK IS VALUABLE
=========================================================

The existing codebase has already undergone substantial forensic engineering.

Do not throw away working work merely because the visual direction is changing.

In particular, preserve and understand:

- ColorPipeline ordering
- tone mapping
- exposure
- sRGB pipeline
- interior lightmap promotion
- KTX2 loader configuration
- Draco loader configuration
- resource lifecycle
- context-loss handling
- tier switching
- terrain fix
- brochure lifecycle/rate limiting
- responsive min-content fix
- metadata work
- accessibility work
- existing data contracts
- existing route architecture

Visual redesign is NOT permission to regress engineering.

=========================================================
47. GIT / CHANGE SAFETY
=========================================================

Before editing:

record the current HEAD.

After major phases:

run the relevant tests/build.

Do not reset or destroy unrelated existing work.

Do not modify unrelated files.

Do not silently remove existing functionality.

Do not commit unless explicitly requested.

=========================================================
48. FINAL REPORT REQUIREMENTS
=========================================================

At the end of this task provide:

A. WHAT YOU INSPECTED

List the actual GLB findings.

B. WHAT WAS ALREADY GOOD

Do not rewrite things that were already correct.

C. WHAT YOU CHANGED

File-by-file.

D. WHAT CHANGED VISUALLY

Describe the cinematic experience.

E. BLENDER HANDOFF

One consolidated list of ALL remaining Blender-side work.

This must be usable directly by the Blender artist.

F. PERFORMANCE

Report:

- triangles
- draw calls
- texture memory if measurable
- frame time
- high-tier behavior
- medium-tier behavior
- low-tier behavior

G. QA

Report:

- build
- tests
- runtime errors
- WebGL errors
- responsive behavior
- reduced-motion behavior
- keyboard interaction
- project route navigation

H. VISUAL BLOCKERS

Be brutally honest.

If the experience still looks cheap in any important frame, say so.

Do NOT declare victory merely because the code works.

=========================================================
49. MOST IMPORTANT CREATIVE RULE
=========================================================

The website should not feel like:

"Here is our 3D mansion."

It should feel like:

"You have entered the digital headquarters of a company that sells exceptional
property."

The mansion is not merely an asset.

It is the stage.

The camera is the narrator.

The projects are the commercial story.

The holograms are the sales instrument.

The staircase is the architectural axis.

The portrait is the legacy.

The scroll is the choreography.

The entire experience should feel expensive.

=========================================================
50. BEGIN
=========================================================

Start with PHASE 0.

DO NOT MODIFY THE EXPERIENCE YET.

First inspect:

1. repository architecture
2. current experience implementation
3. exterior_mansion.glb
4. interior_hall.glb
5. interior_hall.manifest.json
6. cameraPath.ts
7. existing camera/scroll state
8. existing project data contracts
9. existing project routes
10. existing Blender tooling

Then produce your internal asset map and the consolidated Blender handoff.

After that, proceed into implementation.

Do not ask me basic questions that can be answered by inspecting the repository.

Do not invent geometry that already exists.

Do not assume geometry exists when it does not.

Do not redesign blindly.

Inspect.
Measure.
Plan.
Implement.
Render.
Verify.
Refine.

The target is not "working."

The target is an elite cinematic real-estate experience.