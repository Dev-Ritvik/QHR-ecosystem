# Essence

What the studios that win Site of the Month, Site of the Year and the Developer
Award actually do — distilled from their own case studies and from jurors'
write-ups — and what it means for this estate. This file is the brief the
exterior (and every later pass) is measured against. The target: Awwwards Site
of the Month with a Developer Award, for a client paying $130K, whose audience
is HNI and NRI buyers. Every frame has to speak money.

---

## 1. What wins (the evidence)

| Site | Studio | Recognition | What it is remembered for |
|---|---|---|---|
| Igloo Inc | Abeto × Bureaux | Site of the Year + Developer SOTY 2024 | One art-directed world, infinite scroll, particle and material craft; score 7.92 |
| Lusion v3 | Lusion | Site of the Year 2023; SOTM | Hybrid rendering — "you don't need to do everything real-time" |
| Oryzo | Lusion | SOTM Apr 2026 + Developer | One hero object with weight and inertia; camera travels through true depth |
| Immersive Garden | Immersive Garden | SOTM Jan 2025; Agency of the Year 2025 | Realism on a GPU budget: KTX2, channel-packed textures; "more time removing than adding" |
| Cartier Watches & Wonders | Immersive Garden | SOTD | Six alcove rooms as a museum; Web Audio score as a narrative layer |
| Explore Primland | Outpost PRO et al. | SOTD Jan + Feb 2026 | A real landscape flown over on scroll, atmospheric fog; place as world, not gallery |
| Hubtown | Unseen Studio | SOTD + Developer, Jun 2026 | A single glowing centerpiece, reflective landscape — dignity through restraint |
| Iventions | — | SOTD + Developer | "Spotlit installations": WebGL atmosphere over spectacle |
| By-Kin, Uncommon | — | SOTD + Developer | Transitions that feel like camera moves; one continuous surface |

The jury weights Design 40%, Usability 30%, Creativity 20%, Content 10%. The
WebGL is a fifth of the score; the design and the usability are seven tenths.
A Developer Award follows only if the developer jury scores above 7: code that
holds up on every device and browser, accessibility, performance, semantics.

## 2. The essence — eight principles

1. **A point of view, not decoration.** Winners are art-directed to one idea
   and remove everything that is not it. Restraint reads as expensive; clutter
   reads as a template. *Spend more time removing than adding.*

2. **One centerpiece, lit like an installation.** Hubtown's monolith, Oryzo's
   object, Iventions' spotlit projects: the frame has one subject, and light —
   not geometry — tells you where to look. The surroundings fall away into
   atmosphere.

3. **Light does the work geometry cannot.** Low raking key light, warm against
   cool, deep shadow with detail in it, contact shadow where things meet the
   ground, practical lights (windows, lamps, pool light) as story. A modest
   asset under great light beats a detailed asset under flat light.

4. **Atmosphere is depth.** Primland is fog over terrain. Aerial perspective,
   haze layers and a true sky make distance real and hide where the world ends.
   A diorama has hard edges; a world dissolves.

5. **Hybrid rendering.** Bake what does not move — light, occlusion, even
   animation — and spend real time only on what the visitor can change. Every
   winner ships compressed textures (KTX2) and a budgeted scene graph.

6. **Motion is choreography.** Transitions carry meaning; the camera moves like
   a person with intent, with weight and inertia, and never just to move. One
   continuous surface from first frame to last.

7. **Editorial typography and silence.** Large, confident serif display, generous
   negative space, small tracked capitals, copy that says one thing per beat.
   Sound, when present, is a score, not effects.

8. **Beauty at 60fps, for everyone.** Performance, accessibility, reduced motion,
   keyboard, mobile — the Developer Award is won or lost here. A slow beautiful
   site loses to a fast beautiful one.

## 3. What this means for the estate

**The idea:** *an estate at the golden hour, becoming evening as you approach;
the lights of the house come on for you.* Old money is not bright and new; it is
warm stone, deep green, long shadows, lamplight, quiet. The house is the only
subject; the land around it is atmosphere.

- **The house is the lit jewel.** Everything else is darker, softer and cooler
  than the house. Exposure is set for the facade, not for the lawn.
- **Evening is the reward.** The film already travels from golden hour to
  evening; the windows, the pool and the path lights coming on are the story
  beat of the exterior, and they must look like light, not paint.
- **Nature is atmosphere, not props.** Trees read as masses of foliage with light
  through them and shadow inside them, never as lollipops; the lawn reads as a
  surface with scale and grain, never as a tiled plane; the far land dissolves
  into haze.
- **Every material has a real-world reference** — Indian sandstone in warm cream,
  slate roof, clipped lawn, still water with depth — and weathering where the
  real thing would have it: darker at the plinth, cleaner up high.
- **Nothing repeats visibly.** No checkerboard mowing tiles, no identical tree
  clones in rows, no uniform scale.

## 4. The exterior — what reads as "PS2" today, and the fix for each

Measured on the production build at nine points of the exterior leg (RTX 4070,
1440x900 @2x), 2026-09-23.

| # | Tell | Why it reads as a game | Fix |
|---|---|---|---|
| 1 | Trees: smooth blob canopies, identical clones in rows | Low-poly lollipops with no gaps, no translucency, no variation | Canopies shaded as foliage masses — leaf-card breakup, subsurface backlight, per-tree hue and scale variation, wind; then better tree assets (§5) |
| 2 | Lawn: a flat green plane tiled into a giant checkerboard | Visible repetition at huge scale, uniform saturation, hard edges | Lawn shader: stripes at true mower scale (1.5–2 m) that fade with distance, multi-octave colour variation, clover and wear, darker and less saturated |
| 3 | Pool: flat cyan paint | No depth, no reflection, no light | Deep teal with depth falloff, sky reflection by Fresnel, rippled normals, underwater lights that come on at evening |
| 4 | Flat, even light; nothing grounded | No contact shadow, no occlusion in corners | Screen-space ambient occlusion (high tier), stronger key-to-fill ratio, warm key / cool fill |
| 5 | Windows: flat emissive rectangles | Uniform glow, no interior depth | Warm lamplight with falloff, curtain variation, not every window lit |
| 6 | Uniform materials | Cream paint, grey roof, blob car | Plinth weathering and grime by height, roof variation, sheen on the car |
| 7 | The world's edge | Estate wall and planted belt as hard cut-outs | Stronger aerial perspective and haze layering; the far belt as silhouette |

## 5. The plan

**Stage 1 — light, atmosphere and surfaces (code only, now).** The fixes to
tells 1–7 that live in shaders, light and post: foliage shading, lawn, water,
AO, windows, weathering, haze. The biggest change a frame can take without new
assets.

*Status, 2026-09-23.* Done: foliage cards rendered from modelled leaf
clusters (tools/blender/render_foliage_v7.py), crowns grown as lobed card
clusters with baked occlusion (build_estate_v7.card_tree_mesh), runtime
light-through-leaves, per-tree variation, wind and distance coverage
(exteriorFoliage.ts); lawn without baked stripes, world-space mowing bands and
macro variation, 8x anisotropic filtering everywhere (exteriorLawn.ts); a dark
reflecting pool. 60fps on the RTX 4070 and the integrated GPU at 1440x900 @2x.
Open: crowns still too dark at evening; the light's direction (front-left, so
both faces the hero sees are lit and nothing models); the white compound wall
across the middle distance; windows, weathering, sky.

*Status, 2026-09-24 (the art-direction critique).* Done: the sun moved to
front-right (one warm raking face, one cool shaded face) and the sky repainted
to match; contact occlusion from the depth the lens already carries; the pool
rippled, deep, with shallows and caustics; lamplit rooms behind every window
(interior mapping, one room per window, with drapes); stone weathered, slate
varied, hedges leafed, all in world space; kerbs on every walk; the loungers
set as people leave them; a lacquered car; the shade trees rebuilt from Poly
Haven's CC0 scans (Stage 2, below). Hero typography, grid, drawn arrows,
structured calls to action and scrims. Open: the sky (a photographic HDRI
needs a download decision), the car's geometry, the far horizon, the logo
(a brand decision).

**Stage 2 — assets (needs a decision).** Stage 1 lifts the trees as far as
shading can; the silhouettes stay low-poly. Real foliage needs new tree models:
CC0 downloads (e.g. Poly Haven), models generated by Tripo AI / the 3D-generation
tool connected here, or a Blender artist. Downloads and paid generation need the
client's go-ahead.

**Stage 3 — motion and sound.** Camera weight and inertia reviewed beat by beat;
an optional ambient score (off by default, one tap to enable).

**Acceptance for every stage:** judged on rendered frames of the production
build at the film's beats; no frame regresses; 60fps on the RTX 4070 at 1440x900
@2x and a playable frame rate on the integrated GPU; reduced motion, keyboard
and screen reader paths intact; the E2E suite green.

---

### Sources

- [Awwwards — Sites of the Year](https://www.awwwards.com/websites/sites_of_the_year/)
- [Awwwards — Sites of the Month](https://www.awwwards.com/websites/sites_of_the_month/)
- [Case study: Lusion by Lusion, Site of the Month](https://www.awwwards.com/case-study-for-lusion-by-lusion-winner-of-site-of-the-month-may.html)
- [Case study: Immersive Garden's new website](https://www.awwwards.com/case-study-immersive-gardens-new-website.html)
- [Igloo Inc — Awwwards SOTD](https://www.awwwards.com/sites/igloo-inc) and [Annual Awards 2024](https://annuals.awwwards.com/site-nominees/igloo-inc)
- [Explore Primland — Awwwards SOTD](https://www.awwwards.com/sites/explore-primland)
- [Utsubo — Best Three.js websites 2026](https://www.utsubo.com/blog/best-threejs-websites-2026)
- [Hon Tran — Best award-winning websites of 2026 (judged by a juror)](https://www.hontran.dev/blog/best-award-winning-websites-2026)
- [Awwwards — Developer Award](https://www.awwwards.com/developer-award/) and [evaluation system](https://www.awwwards.com/about-evaluation/)
- [Psychoactive — Best WebGL & interactive 3D agencies 2026](https://www.psychoactive.co.nz/content-hub/best-webgl-interactive-3d-agencies)
