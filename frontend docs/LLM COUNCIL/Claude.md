**ACT I: THE DROP — 0% → 25%**

Breaking this into four scroll-mapped beats. Nolan doesn't cut to black and back — he holds darkness until it's unbearable, then reveals scale in one continuous move. That's the spine of everything below.

**Camera Kinematics**

Start state: camera at `fov: 8` (a telephoto squint — pitch black, no context, feels sealed shut, not just "dark"), positioned extremely close to a single architectural detail (a stone seam, a shadow edge) so the opening frame reads as abstract, not legible.

The drop itself is a *compound* move, not a single tween — this is the detail that separates "camera flies backward" (slop) from a Nolan reveal:

- **0–8% scroll:** FOV holds near-static (8→11), camera performs a slow lateral dolly along the detail. Nothing about scale is revealed yet. This is the "sealed" phase — Zimmer's low-frequency drone should already be present here, sub-40Hz, barely audible, more felt than heard.
- **8–18% scroll:** The punch. FOV opens 11→65 while the camera pulls back and *rises* simultaneously along a non-linear path (not a straight line — bias the Y-rise to lag the Z-pullback using two separate eased tracks, one `power4.out` on Z, one `power2.inOut` on Y so the rise feels like it's catching up to the pullback). This asymmetry is what reads as "heavy" rather than "camera drone shot."
- **18–25% scroll:** Settle. FOV eases 65→48 (final resting focal length), all easing terminates on `power3.out` with **zero overshoot** — no elastic, no back-ease. Nolan weight comes from mass arriving and stopping, never bouncing.

Custom GSAP ease for the punch (register once, reuse across the whole site for consistency — this becomes your house ease):

```js
CustomEase.create("monolith-drop", "M0,0 C0.1,0.02 0.15,0.35 0.3,0.55 0.55,0.85 0.75,0.97 1,1");
```
Slow-building anticipation in the first 30%, then a heavy non-linear deceleration into the last third. No symmetry — symmetric eases read as "animated," asymmetric ones read as "physical."

**Post-Processing Stack** (`@react-three/postprocessing`, EffectComposer order matters — this order):

1. **SSGodRays** (or a cheap procedural volumetric shader if targeting mobile GPUs) — single directional light source, low density, this *is* the "heavy volumetric twilight." Budget concern: godrays are expensive; gate this effect behind a capability check and fall back to a fullscreen radial gradient shader on low-tier devices.
2. **DepthOfField** — racks from a tight near-field blur (matching the FOV-8 opening) to fully resolved by 18% scroll. The rack timing should lag the FOV punch by ~5% scroll, not match it exactly — focus catching up to framing is what makes a reveal feel optical rather than digital.
3. **Bloom** — low threshold, low intensity, restricted to luminance above ~0.8. This is for the one or two practical light sources in the shot, not a glow-everything pass.
4. **ChromaticAberration** — near-zero at rest, offset spikes proportionally to camera angular velocity during the punch phase only (drive its `offset` uniform off the same scroll-velocity value Lenis exposes). Kinetic energy should be legible in the fringing, not constant.
5. **Custom split-tone shader** — this replaces "buy a LUT." A simple 3-way color grade (shadows/mids/highlights, each with an independent tint vector) pushed toward teal in shadows, warm amber restricted to the one practical light. Procedural, CC0-compliant, and it's the single biggest lever for "expensive-looking" per dev-hour spent.
6. **Noise** (grain, overlay blend, ~4% opacity) — IMAX stock has texture; a laser-clean render reads as a video game, not a film.
7. **ToneMapping: ACESFilmic** — non-negotiable, this is what gives you highlight rolloff instead of digital clipping.

**Spatial Typography**

Title card is NOT a screen-space DOM overlay — it's `Text` from Drei, positioned in world-space at a fixed depth in front of the settling camera, so it inherits the DOF rack (starts soft, resolves to crisp exactly as focus lands at 18-25%). Letter-spacing animates from expanded (0.4em) to normal (0.05em) synced to the same `monolith-drop` ease — type contracting as the camera settles reinforces "arrival," and costs nothing extra since it rides the existing timeline.

**Audio Context Init**

Hard constraint: `AudioContext` cannot start without a user gesture — no way around this, don't fight it, design for it. Recommend a minimal pre-Hook gate: a single centered glyph/mark on pure black, "ENTER" — the click both resumes the AudioContext *and* fires the first GSAP timeline frame. This isn't a compromise, it's a feature — it's your Zimmer needle-drop moment, the drone starts exactly when the user commits.

On that gesture:
```js
await audioCtx.resume();
subBassDrone.start(); // looping LFO-modulated sine, ~35-45Hz, gain ramped 0→target over 4s
```
The "impact" hits (heavy reverb tail via ConvolverNode, IR baked from a procedural room-impulse — no purchased samples needed) fire off GSAP `onUpdate` callbacks at the two easing inflection points in the drop, not at fixed scroll percentages — audio should feel welded to the *physics*, not the scrollbar.

**One brutal note before you lock this:** SSGodRays + DepthOfField + Bloom stacked is a real fill-rate cost on mobile. Recommend a device-tier check on mount (rough heuristic: `navigator.hardwareConcurrency` + a one-frame GPU timing probe) that drops godrays and DOF to a baked fallback for anything below a threshold. Don't discover this in QA — build the fallback path into Act I from day one, because every subsequent act inherits this composer stack.

Send **Act II — The Reveal** when ready.**ACT II: THE ARCHITECTURAL REVEAL — 25% → 50%**

Starting from your locked state: `[4.5, 17, 58]`, FOV 41°, -0.7 EV. Four systems to build: the orbital arc, procedural water, CSG lounge, and occlusion-aware world-space UI. Taking them in dependency order — water and geometry first, since the camera path has to be *authored around* what it's revealing, not the other way around.

**1. The Orbital Arc — Camera Kinematics**

The failure mode here is "camera orbits a point at fixed radius" — that's a product demo, not a Nolan sweep. Real weight comes from radius, height, and bank *all* varying independently across the arc, on different eases, so no two frames feel like the same motion repeating.

Parametrize on `t` (0→1 mapped to your 25%–50% scroll range via Lenis progress, not raw scroll pixels):

```js
// Orbital path — NOT a fixed-radius circle
const angle = THREE.MathUtils.degToRad(-15 + t * 145); // ~145° sweep, asymmetric start/end
const radiusEase = CustomEase.create("arc-radius", "M0,0 C0.2,0 0.1,0.3 0.4,0.5 0.7,0.7 0.85,0.95 1,1");
const radius = THREE.MathUtils.lerp(58, 71, radiusEase.getRatio(t)); // pulls OUT during the arc, doesn't hold constant
const height = THREE.MathUtils.lerp(17, 24, easeInOutSine(t)); // slow rise, independent curve entirely

camera.position.x = Math.cos(angle) * radius;
camera.position.z = Math.sin(angle) * radius;
camera.position.y = height;
```

**The bank (roll) is the detail that sells centrifugal mass.** Don't roll the camera object directly — roll is angular velocity-dependent, so derive it from the arc's instantaneous turn rate, not from `t` directly:

```js
const angularVelocity = (angle - prevAngle) / deltaT; // rad/s, sampled per frame
const targetBank = THREE.MathUtils.clamp(angularVelocity * -2.4, -0.09, 0.09); // radians, ~5° max — subtle
camera.rotation.z = THREE.MathUtils.damp(camera.rotation.z, targetBank, 4, deltaT); // critically damped, no oscillation
```

Bank peaks mid-arc where turn rate is highest and relaxes to near-zero at both ends where the camera is entering/settling — exactly like a car banking into and out of a curve, not holding a fixed tilt. This is the single detail most builds skip and it's the one that reads as "physical" vs "keyframed."

`lookAt` target isn't the world origin — it's a point that itself drifts from the building's base toward the infinity pool's edge across the arc, so the framing *composes toward* the reveal rather than just centering on a static pivot.

**2. Procedural Water — Infinity Pool**

Gerstner waves for the surface displacement (cheap, no tessellation needed beyond a modest plane subdivision — 128×128 segments is plenty at this camera distance), raymarched caustics is overkill for a pool viewed from altitude at this point in the sequence — reserve raymarching for the Sanctuary act where you'll presumably get close to water. Here, fake caustics with a scrolling, distorted Voronoi pattern multiplied into the specular term — visually indistinguishable from raymarched at this distance, a fraction of the cost.

```glsl
// vertex shader — Gerstner displacement, 3-4 summed waves breaks the "single sine" tell
vec3 gerstner(vec2 pos, float time) {
  vec3 displaced = vec3(pos.x, 0.0, pos.y);
  for (int i = 0; i < 4; i++) {
    float freq = waveFreq[i];
    float amp = waveAmp[i];
    float speed = waveSpeed[i];
    vec2 dir = waveDir[i];
    float phase = dot(dir, pos) * freq + time * speed;
    displaced.y += amp * sin(phase);
    displaced.x += dir.x * amp * waveSteepness[i] * cos(phase);
    displaced.z += dir.y * amp * waveSteepness[i] * cos(phase);
  }
  return displaced;
}
```

Fragment: Fresnel-driven mix between a deep-teal absorption color and a sky-reflection (use a baked cubemap or your existing scene's environment map via `<Environment>` — don't build a real-time reflection probe here, not worth the cost for this shot). The "infinity edge" illusion is sold entirely by cutting the plane geometry exactly at the architectural ledge and matching the water's fog/absorption falloff to the scene's atmospheric depth fog — a lighting-continuity trick, not a geometry trick.

**3. Sunken Lounge — CSG**

`@react-three/csg` subtraction, single boolean op, cached — do not recompute the CSG mesh per-frame or even per-scroll-tick, it's a static architectural feature:

```jsx
<Geometry useGroups computeVertexNormals>
  <Base geometry={new THREE.BoxGeometry(40, 8, 40)} />
  <Subtraction geometry={new THREE.BoxGeometry(24, 6, 24)} position={[0, 2, 0]} />
</Geometry>
```
Bake this once with `useMemo`, keyed on nothing (it never changes) — CSG boolean ops are expensive enough that doing this reactively would blow frame budget instantly.

**4. World-Space UI with Real Occlusion**

`<Html transform occlude>` from Drei handles this natively via a raycast against a mesh reference — but the naive occlude prop raycasts against the *entire* scene by default, which is wasteful. Scope it:

```jsx
<Html
  transform
  position={[12.4, 19, -8.2]}
  occlude={[pillarRefs]} // explicit array of pillar mesh refs, not the whole scene graph
  distanceFactor={10}
>
  <div className="architectural-label">HEATED INFINITY EDGE // 180° ESCARPMENT VIEW</div>
</Html>
```

`occlude={[refs]}` mode raycasts only against the passed refs instead of every scene child — with 6-8 limestone pillars in frame this is trivial cost, versus occluding against the full mesh count of the estate model. The label should also fade its own opacity (via the `onOcclude` callback Drei exposes) rather than hard-cutting, so occlusion reads as "passing behind stone" rather than a UI element blinking off.

**5. Acoustic Shift — Water Introduction**

The "cheap soundboard" tell is a sample fading in at fixed volume. Avoid it by tying the water bed's filter cutoff and gain to the *camera's proximity and orbital position* relative to the pool, not to scroll percentage directly — the sound should feel like it's *in the space* the camera is moving through, not queued to a timeline.

```js
const poolProximity = 1 - THREE.MathUtils.clamp(camera.position.distanceTo(poolCenter) / 80, 0, 1);
waterFilterNode.frequency.setTargetAtTime(200 + poolProximity * 3400, ctx.currentTime, 0.3); // lowpass opens as camera nears
waterGainNode.gain.setTargetAtTime(poolProximity * 0.35, ctx.currentTime, 0.5);
```

Layer: filtered pink noise through a narrow bandpass (a synthesized "water shimmer," not a sample) + the existing sub-bass drone's gain ducking slightly (`-3dB`) as the water enters — the duck is what makes it feel mixed rather than stacked. Optional: a single sparse high-frequency droplet transient (Web Audio `OscillatorNode`, short envelope, randomized timing) triggered probabilistically during the arc — texture, not a loop.

**Brutal note:** `occlude` with per-frame raycasting against even a small ref array, stacked on top of the Gerstner shader's per-vertex loop and the postprocessing chain from Act I, is where your frame budget actually gets spent in this act — not the CSG (that's free after bake). Profile this act specifically with the Bloom/DoF/Godrays stack *active simultaneously*, not in isolation, before calling it locked.

Send **Act III — The Sanctuary** when ready.
**ACT III: THE SANCTUARY — 50% → 75%**

Four genuinely coupled problems here — the exposure hand-off, the glass breach, and the acoustic seal all need to trigger off the *same* breach-progress value, or you get three systems transitioning on three different clocks and the seam shows. Building that shared value first.

**Shared breach progress:**
```js
const breachT = THREE.MathUtils.smoothstep(cameraZ, glassPlaneZ - 6, glassPlaneZ + 4); // 0→1 over a ~10-unit band straddling the glass
```
Everything below reads off `breachT`, not off raw scroll percentage. This is what keeps the hand-off feeling like one continuous physical event instead of three separate cues that happen to overlap.

**1. Exposure Hand-off**

The eye doesn't cross-dissolve between exposures — it *hunts*, overshoots slightly, and settles. A linear EV interpolation from -0.7 to your interior target will read as a digital cross-fade no matter how well-timed. Fake the hunt:

```js
const exposureEase = CustomEase.create("eye-adjust", "M0,0 C0.15,0.02 0.3,0.65 0.5,0.78 0.65,0.88 0.8,0.68 0.85,0.72 1,0.7");
// note the dip after ~65%: exposure slightly OVERSHOOTS toward the target then settles back — that's the "hunt"
const exposure = THREE.MathUtils.lerp(-0.7, -0.15, exposureEase.getRatio(breachT));
composer.toneMappingExposure = Math.pow(2, exposure);
```

Light intensities don't cross-fade either — they **stagger**. Exterior directional light falls off starting at `breachT: 0.3` (before the glass, not at it — light attenuates through the pane itself), while the tungsten practicals ramp in starting at `breachT: 0.45`, overlapping the exterior falloff for a ~20% window. This overlap is the whole trick: a brief moment where both light qualities coexist is what a real eye actually experiences, and it's the difference between "adjusting" and "scene cut."

```js
exteriorLight.intensity = THREE.MathUtils.lerp(4.2, 0, smoothstep(breachT, 0.3, 0.6));
tungstenLights.forEach(l => l.intensity = THREE.MathUtils.lerp(0, l.baseIntensity, smoothstep(breachT, 0.45, 0.85)));
```
Color temperature: don't just swap light colors — drive the postprocess split-tone shader's highlight tint from cool (5600K-ish blue) to warm (2700K amber) on its own slightly-lagged curve (`smoothstep(breachT, 0.5, 0.9)`), so the *grade* is doing part of the adjustment work, not just the lights. This is cheaper than it sounds since you already built that shader in Act I — you're just driving its uniform.

**2. The Glass Breach — solving near-clip without touching `camera.near`**

Don't touch `camera.near` dynamically — that's a global property affecting depth-buffer precision for the *entire* scene, and animating it introduces z-fighting elsewhere for a fix that's local to one mesh. The actual fix is a **custom clip plane on the glass material itself**, not the camera:

```glsl
// glass fragment shader — discard fragments behind a plane that moves WITH breachT
uniform float uBreachProgress;
uniform vec3 uPlaneNormal;
uniform vec3 uPlanePoint;

void main() {
  float d = dot(worldPosition - uPlanePoint, uPlaneNormal);
  if (uBreachProgress > 0.02 && d < 0.0) discard; // glass fragments behind camera's breach point vanish
  ...
}
```
Practically: the glass mesh renders normally until `breachT` starts climbing, at which point you discard the portion of the glass fragment nearest the camera's path — the pane appears to "open" exactly where the camera passes through it rather than the camera clipping through solid geometry. Combine with a **refraction distortion spike** (perturb UV sampling of whatever's behind the glass, amplitude peaking at `breachT: 0.5` and collapsing to 0 by `0.6`) — a half-second of glass-like distortion sells "passing through a material" far better than a hard cut, and it's a single sine-modulated UV offset, near-zero cost.

Bonus physical detail: bias the FOV very slightly narrower (41°→37°) exactly during the breach window (`smoothstep(breachT, 0.4, 0.6)` then back out) — a subtle telephoto compression as you thread a threshold reads as intentionality, not zoom.

**3. Syndicate UI — Anchored, Not Grid**

Same `<Html transform occlude>` pattern from Act II, but the aesthetic constraint here is different: exterior labels were architectural signage (fine to be visible/legible), interior Syndicate nodes need to feel like *discoverable* detail, not a product grid wearing a 3D costume.

```jsx
<Html transform position={[woodPanelAnchor]} occlude={[interiorOccluders]} distanceFactor={6}>
  <div className="syndicate-node" style={{ opacity: nodeOpacity }}>
    <span className="syndicate-mark">M</span> {/* single glyph, not a name — see below */}
  </div>
</Html>
```

Key restraint: don't render the craftsman's name or title at rest. Render a single minimal glyph/mark anchored precisely into the material (a monogram inlaid at the edge of the millwork panel, at the corner of the marble slab) that only expands to reveal "Master of Bespoke Millwork" on hover/proximity — gate the expansion on `distanceFactor` crossing a threshold, so it's the camera's *proximity in the scene* that reveals information, not a UI hover state layered on top. This keeps 14 potential nodes from ever reading as a grid, because at any given camera position only 1-2 are close enough to be legible — the rest are just texture in the environment, exactly like a real interior has small signed details you only notice up close.

Opacity itself should ride the same occlusion fade from Act II (`onOcclude` callback, not hard toggle) plus a `breachT`-gated fade-in so nodes don't exist at all until the camera has fully entered — no exterior label should ever be visible pre-breach.

**4. Acoustic Vacuum**

This is a routing problem, not a single-node trick. Structure:

```
[Exterior bus: wind + water] → [Gain node A] → destination
[Interior bus: room tone]    → [ConvolverNode: interior IR] → [Gain node B] → destination
```

Both buses exist simultaneously; you're crossfading gain, not swapping sources — swapping causes an audible pop/gap that no amount of eased gain can hide, because the underlying buffer discontinuity is instant.

```js
gainA.gain.setTargetAtTime(0, ctx.currentTime, 0.15); // exterior seals FAST — 150ms time constant, not gradual
gainB.gain.setTargetAtTime(0.4, ctx.currentTime, 0.4); // interior blooms in SLOWER
```
Note the asymmetry: exterior cutoff is fast (a door swinging shut, acoustically), interior reverb bloom is slower (a room's reflections need time to "fill"). Symmetric crossfade here is the tell that gives away it's a mix trick — real acoustic transitions aren't symmetric.

The `ConvolverNode`'s impulse response is the whole ballgame for "expensive acoustically-treated room" vs "generic reverb." Procedurally generate it rather than sourcing a sample: short pre-delay (~15ms, simulating the room's size), fast initial decay (heavy absorption from soft furnishing/acoustic treatment — this is what makes it read as *luxury* rather than *empty warehouse*, where you'd instead want a long, ringing decay), synthesized as filtered noise with an exponential envelope:

```js
function generateLuxuryRoomIR(ctx, duration = 1.2, decay = 3.2) {
  const length = ctx.sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}
```
A high decay exponent (3.2 vs a typical 2.0) is what gives you the *fast absorption* character — tune this by ear against `duration`, it's the single parameter doing the most acoustic-character work.

**Brutal note before you lock this act:** the glass discard shader needs `worldPosition` passed from the vertex stage, which means the glass material can't be a stock `MeshPhysicalMaterial` — you're writing (or extending via `onBeforeCompile`) a custom shader for it. That's fine, but it also means the glass loses whatever PBR transmission/roughness Three.js's built-in physical material gives you for free. Budget real time to hand-roll refraction (a simple screen-space UV offset sampling a render-target of the interior is enough — don't raymarch this) or the "glass" reads as a flat discard-plane the moment the distortion spike ends. This is the highest-risk item in Act III — test it in isolation before wiring it to `breachT`.

Send **Act IV — The Standoff** when ready.**ACT IV: THE STANDOFF — 75% → 100%**

This act has a different job than the first three. Acts I–III built *credibility* — established that the world is real, heavy, and worth $50L of trust. Act IV's job is not to impress further; spectacle has already been spent. Its job is to narrow the user's attention until the only remaining action is the CTA. That reframing decides all four answers below.

**1. Final Kinematics — Push In, Not Pull Out**

Ruling: **push into the marble grain until dissolve.** The reverse-pullout is the wrong move, and here's the actual reasoning, not just taste — a wide reveal is an *establishing* shot. It re-opens scope right when you need to be closing it. You'd be ending your climax on the same gesture (camera pulls back, world gets bigger) that Act I already used to open the experience. Structurally that reads as a loop, not an arrival — and psychologically, showing the user "everything at once" one more time gives them permission to keep browsing rather than commit. High-net-worth conversion psychology doesn't run on "look how much there is" at the close — it runs on exclusivity and narrowing: *this one detail, this one seam of stone, is the whole world now.*

Spatial math — this is a **dolly-only push with FOV held nearly static**, not a zoom. A zoom (FOV change with fixed position) reads as artificial and flat; a physical dolly toward a fixed point with FOV *barely* tightening reads as your body moving through space:

```js
const pushEase = CustomEase.create("final-push", "M0,0 C0.05,0.01 0.2,0.08 0.35,0.22 0.6,0.55 0.8,0.9 1,1");
// near-flat start, then aggressive late acceleration — this is the ONE curve in the whole
// site that's allowed to feel unstoppable rather than settled, because it never resolves —
// it hands off mid-motion, which is the point.

const t = pushEase.getRatio(scrollT); // scrollT: 75%→100% remapped 0→1
camera.position.lerpVectors(sanctuaryRestPos, marbleDetailTarget, t);
camera.fov = THREE.MathUtils.lerp(38, 24, t); // tightens, doesn't zoom-punch
camera.near = THREE.MathUtils.lerp(0.5, 0.02, Math.pow(t, 3)); // near-plane collapses late, lets you get IN close without clipping
```

Note the curve **never eases out to a settle** — every prior transition in Acts I–III terminated on `power3.out` with zero overshoot, deliberately. This is the one place you break your own house rule, and you break it on purpose: the push doesn't resolve, it gets *interrupted* by the dissolve at 100%. That interruption is what makes the handoff feel like a cut to black mid-sentence rather than a scene ending — which is exactly the tension you want bleeding into the CTA.

**2. The Dissolve → UI Handoff**

Don't cross-fade to a flat overlay — that's the "standard popup" tell you're trying to avoid. Instead: the marble surface itself *becomes* the overlay's background. Concretely —

- At `scrollT: 0.85`, start rendering the marble close-up to an offscreen render target instead of directly to canvas.
- A custom fragment shader on that render target applies a **noise-driven dissolve** (fractal Voronoi threshold, animated) that eats the marble detail from the edges inward — not a uniform fade, an *erosion*, so it still reads as material breaking apart rather than opacity dropping.
- At `scrollT: 1.0`, freeze that render target as a static texture and hand it to the DOM layer as a CSS `background-image` (via `canvas.toDataURL()` or a captured `WebGLRenderTarget` blit) on the Command Overlay's backdrop, *behind* the glassmorphic panel.

```js
// on breach into overlay
const frozenFrame = gl.domElement.toDataURL('image/jpeg', 0.85);
overlayStore.setBackdrop(frozenFrame); // Zustand — DOM layer picks this up
canvas.style.transition = 'opacity 0.8s ease-out';
canvas.style.opacity = 0; // WebGL canvas itself fades OUT, but the DOM inherits its last frame
frameloop.current = 'never';
```

The result: the user never sees "3D world" replaced by "website." They see the marble they were just pushing into literally becoming the frosted glass texture behind the form. Continuity of *material*, not continuity of camera — that's what avoids the popup read. The CTA typography (`REQUEST PRIVATE DOSSIER`) then materializes via `mix-blend-mode: overlay` against that frozen marble backdrop, so even the button looks carved from the same stone the whole site has been built from.

**3. Acoustic Climax — Swell, Then Cut, Not Either/Or**

Your framing offers a false binary. The Nolan/Zimmer move (Dunkirk's ending is the reference point) is neither pure crescendo nor pure silence — it's a **Shepard-tone swell that gets cut at its peak**, leaving one bare tone hanging. The rising-forever illusion builds unbearable tension without ever resolving upward, and *then* you don't let it resolve at all — you kill it. That unresolved cut is more unsettling and more attention-grabbing than either a full swell or a fade to silence, because the ear expects continuation and doesn't get it.

```js
// Shepard tone: stacked oscillators, octaves apart, each fading in as it enters
// the audible band and out as it exits — creates the illusion of infinite rise
const shepardOscs = [0,1,2,3,4].map(i => {
  const osc = ctx.createOscillator();
  osc.frequency.value = baseFreq * Math.pow(2, i);
  const gain = ctx.createGain();
  osc.connect(gain).connect(shepardBus);
  return { osc, gain, octave: i };
});

// per-frame, driven by scrollT 0.75→1.0:
shepardOscs.forEach(({ gain, octave }) => {
  const phase = (scrollT * 5 + octave) % 5; // each osc cycles through the audible window
  const envelope = Math.sin((phase / 5) * Math.PI); // fades in/out at band edges
  gain.gain.setTargetAtTime(envelope * 0.15, ctx.currentTime, 0.05);
});

// THE CUT — at scrollT === 1.0, not eased, not faded:
if (scrollT >= 0.999 && !hasCut.current) {
  shepardBus.gain.setValueAtTime(shepardBus.gain.value, ctx.currentTime);
  shepardBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.06); // 60ms — fast enough to
  // read as a CUT, not a fade, but long enough to avoid a digital click/pop
  singleSustainedTone.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1); // one bare
  // tone survives the cut, sustained under the CTA — this is what's still playing while
  // they read "REQUEST PRIVATE DOSSIER"
  hasCut.current = true;
}
```

That surviving bare tone under the CTA is doing real psychological work — total silence after a swell feels like *relief* (tension resolved, user relaxes, momentum lost); one thin sustained tone feels like *held breath* (tension suspended, not resolved) — which is what you want a user staring at a lead-capture form to feel.

**4. WebGL Suspension — Correct Scope, Not Over-Aggressive Disposal**

Be precise about what "suspend" should mean here, because full disposal is the wrong tool and will cause a worse problem than the one you're solving.

`frameloop="never"` (already your Act I ruling) means **zero render calls fire** — that alone stops the GPU compute and battery drain almost entirely, since an idle WebGL context with no draw calls costs approximately nothing. You do **not** need to dispose textures, geometries, or the renderer to get the battery win — that win already exists from the ticker discipline you locked three acts ago.

What you should NOT do: call `renderer.dispose()` or unmount the R3F canvas root when the overlay opens. Context recreation on WebGL is expensive (shader recompilation, texture re-upload) — if the user closes the dossier form and scrolls back up 5 minutes later, a disposed context means re-paying the entire Act I–IV load cost, and a visible stutter/pop-in exactly where you least want one.

The correct scope of "suspend":

```js
function onOverlayOpen() {
  frameloopRef.current = 'never';          // stop rendering — already ruled
  canvasEl.style.opacity = '0';             // hide via CSS, don't unmount
  canvasEl.style.pointerEvents = 'none';    // stop it intercepting overlay interaction

  // Optional, only if idle > 60s (a real "gone to fill the form" signal, not just "reached 100%"):
  idleTimer.current = setTimeout(() => {
    composer.setSize(width * 0.5, height * 0.5); // downsample offscreen targets — cuts
    // fill-rate cost if/when it DOES resume, without destroying anything
  }, 60_000);
}

function onOverlayClose() {
  clearTimeout(idleTimer.current);
  composer.setSize(width, height);          // restore full res
  canvasEl.style.opacity = '1';
  canvasEl.style.pointerEvents = 'auto';
  frameloopRef.current = 'demand';
  invalidate();                              // single frame to resume, not a full remount
}
```

`display: none` is deliberately avoided too — some browsers deprioritize or lose WebGL contexts on genuinely undisplayed canvases, which risks the exact expensive-rebuild problem you're trying to prevent. `opacity: 0` + `pointer-events: none` gets you the same visual and interaction result while keeping the context warm.

**Brutal note, and this closes the four-act arc:** everything above assumes `breachT`-style shared progress values and the render-target-to-DOM handoff are wired through Zustand as the single source of truth the Command Overlay HUD reads from — not local component state. The overlay needs to know the frozen backdrop, the last camera FOV, and whether audio has cut, and it needs that on mount, not via prop-drilling from a component that may unmount when the route changes. If your state architecture isn't already centralized this way, that's the actual next task — before Command Overlay page 1.

Four acts locked. The scroll narrative is architecturally complete end-to-end. Next council session is your call: **Command Overlay HUD shell** (the z-999 glassmorphic system all 20+ pages inherit), or the first **Syndicate `/syndicate/[slug]` template**?**THE SYNDICATE HUB & ZERO-TRUST LEAD VAULT**

Four problems, but they split into two different domains that shouldn't be solved with the same rigor — routing/canvas persistence is an engineering problem with a correct answer; "zero-trust" and "impossible to steal" are marketing language that needs translating into what's actually achievable with Postgres + RLS. I'll solve the first two precisely and be straight with you about the second two.

**1. Canvas Persistence — Root Layout, Never `template.tsx`**

The failure mode to avoid explicitly: `template.tsx` exists specifically to remount on every navigation — using it here would be the single fastest way to destroy this entire architecture. Never let anything WebGL-related touch a `template.tsx` file.

The fix is placement, not cleverness: the `<Canvas>` lives in the **root** `layout.tsx`, as a sibling of `{children}`, not nested inside `/syndicate/`. App Router only remounts a layout when the layout itself changes — navigating between two leaf pages that share an ancestor layout re-renders that ancestor, it doesn't destroy and recreate it. Since `/`, `/syndicate/[slug]`, and your 20+ utility pages all share the root layout, the Canvas persists across literally the entire site, which is also what your Command Overlay architecture from council session 1 already assumed.

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PersistentCanvas /> {/* fixed position, z-index 0, owns the R3F scene */}
        {children}            {/* z-index 999, normal document flow — page.tsx leaves swap here */}
      </body>
    </html>
  );
}
```

`PersistentCanvas` is a client component, mounted exactly once for the lifetime of the session. `/syndicate/[slug]/page.tsx` never renders 3D content directly — it renders DOM overlay content only (partner bio, craft description) and dispatches into the persistent scene via Zustand. This is the core discipline: **page components never own 3D state, they only publish to it.**

**2. Camera Hijacking Without Hydration Mismatch**

The mismatch risk is real but avoidable with one rule: **Server Components never make decisions that depend on 3D/client state.** `page.tsx` stays "dumb" — it fetches `partner` data server-side from Supabase and renders static DOM markup. A zero-output client bridge component is the only thing that touches the camera:

```tsx
// app/syndicate/[slug]/page.tsx — Server Component
export default async function SyndicatePage({ params }: { params: { slug: string } }) {
  const partner = await getPartnerBySlug(params.slug); // server-side Supabase read

  return (
    <>
      <CameraBridge anchor={partner.anchor_position} slug={params.slug} />
      <PartnerOverlayContent partner={partner} />
    </>
  );
}
```

```tsx
// CameraBridge.tsx — "use client", renders NOTHING, zero hydration surface
'use client';
export function CameraBridge({ anchor, slug }: { anchor: Vec3; slug: string }) {
  const setActiveAnchor = useSceneStore(s => s.setActiveAnchor);
  useEffect(() => { setActiveAnchor(anchor, slug); }, [slug]);
  return null;
}
```

`return null` is the whole trick — a component with no DOM output can't hydrate-mismatch, because there's nothing to compare between server and client render. The camera controller itself lives inside `PersistentCanvas`, subscribes to the same Zustand slice, and drives the actual GSAP tween:

```tsx
function CameraRig() {
  const activeAnchor = useSceneStore(s => s.activeAnchor);
  useEffect(() => {
    gsap.to(camera.position, {
      x: activeAnchor.x, y: activeAnchor.y, z: activeAnchor.z,
      duration: 1.8, ease: "monolith-drop", // reuse your Act I house ease — consistency
      onUpdate: () => invalidate(), // frameloop="demand" — must manually pump frames during the tween
    });
  }, [activeAnchor]);
}
```

Don't forget `invalidate()` on every tween frame — this is Act I's ruling coming back around. A GSAP tween running against a `frameloop="demand"` canvas renders nothing unless something explicitly invalidates each frame.

**3. The Schema — What "Zero-Trust" Actually Buys You**

Brutal note before the SQL: **"make lead theft impossible" isn't an achievable engineering target — treat it as marketing copy, not a spec.** What's actually achievable, and what I'm building below, is: (a) writes are only possible through a server-controlled path, never directly from an anon client, (b) rows are never mutated, only appended to, so tampering is detectable rather than prevented, and (c) each partner can only read their own leads via RLS. That's a real, defensible security posture. "Impossible" isn't — plan the pitch deck copy accordingly, not the schema.

Core design principle: **leads_vault is a ledger, not a record.** Nothing gets `UPDATE`d, including status — every state change is a new appended event, hash-chained to the previous one so any retroactive edit breaks the chain and is detectable.

```sql
create table syndicate_partners (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  display_name  text not null,
  craft_title   text not null,
  whatsapp_number text not null,           -- consider pgsodium/Vault for at-rest encryption
  anchor_position jsonb not null,          -- {x,y,z} camera anchor
  created_at    timestamptz not null default now()
);

create table leads_vault (
  id            uuid primary key default gen_random_uuid(),  -- the cryptographic token
  partner_id    uuid not null references syndicate_partners(id),
  lead_name     text not null,
  lead_contact  text not null,
  lead_message  text,
  genesis_hash  text not null,   -- sha256(id || partner_id || created_at || server_secret)
  created_at    timestamptz not null default now()
);

-- append-only ledger of everything that happens to a lead AFTER creation
create table leads_vault_events (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads_vault(id),
  event_type    text not null check (event_type in
                  ('dispatched_partner','dispatched_owner','acknowledged')),
  event_hash    text not null,   -- sha256(prev_event_hash || event_type || lead_id || created_at)
  created_at    timestamptz not null default now()
);

-- hard immutability: nothing, not even service_role by accident, updates or deletes
create or replace function reject_mutation() returns trigger as $$
begin raise exception 'leads_vault is append-only'; end;
$$ language plpgsql;

create trigger no_update_leads  before update or delete on leads_vault        execute function reject_mutation();
create trigger no_update_events before update or delete on leads_vault_events execute function reject_mutation();

alter table leads_vault enable row level security;
alter table leads_vault_events enable row level security;

-- anon gets ZERO direct access — writes only happen via a SECURITY DEFINER RPC, see below
revoke all on leads_vault, leads_vault_events from anon;

create policy "partner reads own leads only"
  on leads_vault for select
  using (partner_id::text = auth.jwt() ->> 'partner_id');

create policy "platform owner reads everything"
  on leads_vault for select
  using (auth.jwt() ->> 'role' = 'platform_owner');
```

The insert path is the part that actually earns the "tamper-proof" claim: the client **never** gets a direct table grant. It calls a `SECURITY DEFINER` function through an Edge Function, so the token, timestamp, and hash are all generated server-side — a client can't forge `partner_id` or backdate `created_at`, because the client never sets those fields at all:

```sql
create or replace function create_lead(
  p_partner_id uuid, p_name text, p_contact text, p_message text
) returns uuid
language plpgsql security definer as $$
declare v_id uuid := gen_random_uuid();
declare v_hash text;
begin
  v_hash := encode(digest(v_id::text || p_partner_id::text || now()::text || current_setting('app.lead_secret'), 'sha256'), 'hex');
  insert into leads_vault (id, partner_id, lead_name, lead_contact, lead_message, genesis_hash)
  values (v_id, p_partner_id, p_name, p_contact, p_message, v_hash);
  return v_id;
end;
$$;
```

**4. Dual Dispatch — Database Webhook → Edge Function, Not Client-Triggered**

Critical rule: the dispatch must fire off the **database insert**, not off the client's "button clicked" event. If the client triggers the WhatsApp send directly, you have no ledger entry proving dispatch actually happened, and a flaky network means the lead exists in your DB but the partner never got notified with no record of the gap. Supabase Database Webhooks (on `leads_vault` INSERT) calling an Edge Function is the correct trigger point — dispatch becomes a *consequence of the write existing*, not a separate, unreliable client action.

```
Client → create_lead() RPC → INSERT leads_vault
                                     ↓ (Database Webhook, INSERT event)
                          Edge Function: dispatch-lead
                                     ↓
                    ┌────────────────┴────────────────┐
              WhatsApp Business API              Audit receipt (email/Resend)
              → partner_id's number                → platform owner
                    ↓                                    ↓
        INSERT event 'dispatched_partner'    INSERT event 'dispatched_owner'
        (hash chained to genesis_hash)        (hash chained to prior event)
```

```ts
// Edge Function: dispatch-lead
serve(async (req) => {
  const { lead_id, partner_id } = await req.json();
  const idempotencyKey = lead_id; // use the lead UUID — retries never double-send

  const lead = await supabase.from('leads_vault').select('*').eq('id', lead_id).single();
  const partner = await supabase.from('syndicate_partners').select('*').eq('id', partner_id).single();

  await sendWhatsApp({
    to: partner.data.whatsapp_number,
    idempotencyKey,
    payload: { lead_token: lead_id, name: lead.data.lead_name, contact_masked: mask(lead.data.lead_contact) },
  });
  await appendEvent(lead_id, 'dispatched_partner');

  await sendOwnerReceipt({ lead_id, partner_id, genesis_hash: lead.data.genesis_hash, timestamp: new Date().toISOString() });
  await appendEvent(lead_id, 'dispatched_owner');
});
```

Two things worth naming precisely rather than glossing over: "encrypted WhatsApp payload" in your brief — WhatsApp Business API traffic is already TLS-transported and end-to-end encrypted by WhatsApp itself; there's nothing meaningful to add on top of that at the payload level. What you *should* do instead is minimize what's in the payload — send the lead token and masked contact info, not raw PII, so a compromised webhook log doesn't leak full contact details. That's the realistic version of "encrypted payload" here.

Second: **WhatsApp Business API is not a zero-budget item** — unlike your shaders and Poly Haven textures, this is a real external dependency with actual API costs (via Twilio, Gupshup, or Meta's Cloud API directly, which has a free tier but rate limits). Flag this to the client now; it's the one place the "zero-budget" constraint from council session 1 doesn't hold, and it needs a decision before this system goes live.

**Brutal note closing this session:** the hash-chain gives you *tamper-evidence* — if someone alters `leads_vault_events` history, the chain breaks and it's detectable on audit. It does not give you *tamper-prevention* at the infrastructure level — anyone with the Postgres service_role key (i.e., you, or anyone who compromises your Supabase project) could still rewrite the whole chain consistently. True tamper-proofing would mean anchoring hashes to something outside your own infrastructure's control (a public timestamping service, e.g.) — almost certainly overkill for a real-estate lead-gen system, but say so explicitly to the client rather than letting "zero-trust" imply more than the architecture delivers. Undersell the security claim, oversell the experience — that's the correct ratio for this build.

Routing tree and schema are locked. Next session: **Command Overlay HUD shell**, or start wiring the first live `/syndicate/[slug]` template against this schema?**THE Z-AXIS COMMAND OVERLAY — GLOBAL HUD**

Constraint #1 is actually the load-bearing one — get the routing topology right and #2, #3, and #4 mostly fall out of it for free. Solving in that order.

**1. Routing Topology — Parallel + Intercepting, and Where Each Earns Its Keep**

First, a clarification worth stating precisely: the Canvas persisting is **already guaranteed** the moment it lives in root `layout.tsx` (your session-6 ruling) — Next.js only remounts a layout when the layout segment itself changes, so any leaf swap under root layout leaves Canvas untouched, with zero parallel-route machinery required. That's not what parallel/intercepting routes solve here.

What they *do* solve: preserving the **underlying leaf's mounted state** — scroll position inside Act I–IV, an active `CameraBridge` anchor on `/syndicate/[slug]` — while the overlay is open on top of it. Without interception, navigating to `/careers` via a normal `<Link>` replaces the `children` slot entirely; the home page's scroll-driven leaf unmounts, and reopening `/` later means re-deriving 3D state from Zustand rather than it simply still being there. Interception avoids that unmount.

```
app/
  layout.tsx                          # <PersistentCanvas/> + {children} + {overlay}
  page.tsx                            # Act I–IV scroll experience
  syndicate/[slug]/page.tsx           # camera-hijack page from session 5

  @overlay/
    default.tsx                      # returns null — no overlay active
    layout.tsx                       # <OverlayChrome> — persistent rail, see §3
    (.)careers/page.tsx              # intercepted — renders on top, base leaf stays mounted
    (.)contact/page.tsx
    (.)investment-guide/page.tsx
    (.)knowledge-center/page.tsx
    ... (11 more, same shape)

  careers/page.tsx                   # direct-hit fallback (hard load / shared link)
  contact/page.tsx
  investment-guide/page.tsx
  knowledge-center/page.tsx
  ... (11 more)

  _content/
    CareersContent.tsx                # shared — imported by BOTH the intercepted
    ContactContent.tsx                # and direct-hit variant of each page
    ...
```

The two entries per utility page (`(.)careers/page.tsx` and `careers/page.tsx`) are near-identical wrappers — one renders inside the parallel slot (intercepted, base leaf survives), one renders as a standalone route (direct hit, no base leaf exists to preserve). Don't hand-author 30 files: this is genuinely boilerplate, generate both from a single `pages.config.ts` registry (`{slug, title, ContentComponent}[]`) via a small Node codegen script run at build time. Flag this now — authoring 15×2 nearly-identical files by hand is where copy-paste drift creeps in and one page silently ends up without the direct-hit fallback.

**Brutal note on the URL shape:** intercepting routes match `(.)segment` at the *same tree depth* as the interceptor — which is exactly why each of your 15 pages needs its own interceptor folder rather than one dynamic catch-all. If clean top-level URLs (`/careers`, not `/utility/careers`) matter for marketing/SEO — and for a ₹50L listing they probably do — this per-slug folder cost is the price of that URL shape. The alternative (collapsing all 15 into `app/utility/[page]/page.tsx` with one interceptor `(.)utility/[page]`) cuts the file count by ~14 but pushes every utility URL under `/utility/`. That's a client-facing decision, not an engineering one — worth a one-line email to confirm before you generate 30 files in the wrong shape.

**2. The Freeze & Blur Handoff — Zustand + Lifecycle**

```ts
interface SceneStore {
  frameloop: 'demand' | 'never';
  overlayOpen: boolean;
  frozenBackdrop: string | null; // captured data URL
  openOverlay: () => void;
  closeOverlay: () => void;
}
```

The sequence, and the detail that actually eliminates stutter rather than just minimizing it:

1. `openOverlay()` fires — from the `[ DIRECTORY ]` button, or from a route-change effect if the overlay was entered via a shared `/careers` link that then opens the drawer chrome.
2. One final `invalidate()` — guarantees the *current* scroll/camera state is what gets captured, not a stale frame (same discipline as Act III's transition-frame ordering).
3. Inside `PersistentCanvas`, an R3F `onAfterRender` callback (fires once, after that invalidated frame is actually rasterized to the backbuffer) triggers the capture:
   ```ts
   gl.domElement.toDataURL('image/jpeg', 0.85) // JPEG, not PNG — one-time cost, luxury photography compresses fine
   ```
4. Store the result as `frozenBackdrop`. Set `frameloop = 'never'`.
5. Canvas fades via CSS (`opacity: 0`, ~350ms), while the overlay's backdrop div — `background-image: url(frozenBackdrop)` — fades in over the *same* 350ms.

**Here's the part that makes "not a single frame stutter" true by construction, not just well-timed:** the canvas was frozen at the *exact* frame that got captured into `frozenBackdrop`. For the entire 350ms crossfade, the live (now-static) canvas and the JPEG underneath it are pixel-identical. You're cross-fading an image with itself — there is no motion to perceive, mid-fade or otherwise, regardless of timing precision. This is why the freeze has to happen at the *same instant* as the capture (step 3 and 4 firing off the same `onAfterRender` tick) rather than being two independently-timed operations — get that ordering wrong and you'll capture one frame, let a few more render, then freeze on a different one, and the crossfade will visibly pop.

`backdrop-filter: blur()` then applies to that static backdrop div — compositing cost against a single raster image, decoupled entirely from the WebGL context, which by this point isn't compositing at all (`opacity: 0` stops paint, doesn't just visually hide).

Close is the mirror: drawer slides out, backdrop fades, canvas `opacity: 1`, `frameloop = 'demand'`, single `invalidate()` to resume — no remount, same context, same discipline as Act IV's suspend logic.

**3. HUD Internal Architecture — the Rail Persistence Is the Same Trick, One Level Down**

Worth naming explicitly: this is architecturally identical to problem #1, recursed. Just as root `layout.tsx` keeps the Canvas mounted across leaf changes, `app/@overlay/layout.tsx` keeps the **left rail** mounted across intercepted-route changes within the overlay:

```tsx
// app/@overlay/layout.tsx
export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="overlay-grid" data-open={useOverlayStore(s => s.overlayOpen)}>
      <nav className="overlay-rail">
        <NavIndex active={usePathname()} /> {/* "01 — ABOUT", "02 — INVESTMENT GUIDE"... */}
      </nav>
      <div className="overlay-content">{children}</div>
    </div>
  );
}
```

Each `(.)slug/page.tsx` renders *only* its content component — the rail is inherited, not re-rendered — so clicking "Contact Us" from inside "Investment Guide" swaps `overlay-content` while `overlay-rail` (and its hover states, scroll position, active-index animation) never unmounts. This is what makes the navigation frictionless: you're not closing and reopening a modal, you're swapping one grid cell inside a layout that's already stable.

Grid, Swiss-precision rather than decorative:

```css
.overlay-grid {
  position: fixed; inset: 0; z-index: 999;
  display: grid;
  grid-template-columns: 280px 1fr;
  backdrop-filter: blur(24px);
  transform: translateX(100%);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.overlay-grid[data-open="true"] { transform: translateX(0); }
.overlay-rail {
  border-right: 1px solid rgba(255,255,255,0.08);
  padding: 4rem 2rem;
  display: flex; flex-direction: column; gap: 1px; /* hairline dividers, not spacing */
}
```

No rounded corners, no drop shadows beyond what the blur itself implies, numbered index (`01, 02, 03...`) rather than icons — the negative space in the unused grid cells is doing as much psychological work as the content in the filled ones.

**Standalone parity:** `app/careers/page.tsx` (direct-hit) doesn't inherit `@overlay/layout.tsx` — that layout only wraps the parallel slot. So the standalone variant explicitly renders the same chrome component the layout uses internally:

```tsx
// app/careers/page.tsx
export default function CareersDirect() {
  return <OverlayChrome standalone><CareersContent /></OverlayChrome>;
}
```
`OverlayChrome` is the shared component; `@overlay/layout.tsx` is just its intercepted-mode wiring. Keep the visual logic in one place, don't let the two entry paths drift into two different-looking HUDs.

**4. Payload Splitting**

The framing to correct here: the risk isn't really "bundle size" in the traditional client-JS sense — it's **accidentally importing the R3F/GSAP/Zustand client bundle into content that doesn't need it.** `CareersContent`, `KnowledgeCenterContent`, etc. should default to **Server Components** — plain text and images fetched server-side (Supabase or a CMS), rendered to HTML, shipping close to zero client JS. As long as none of them `import` anything from the 3D layer, Next.js's per-route chunking already keeps that JS out — no special lazy-loading needed for the common case.

Reach for `next/dynamic({ ssr: false })` only for the genuinely interactive pieces — an investment ROI calculator, an embedded gallery lightbox — not for the surrounding prose:

```tsx
const InvestmentCalculator = dynamic(() => import('@/components/InvestmentCalculator'), {
  ssr: false,
  loading: () => <CalculatorSkeleton />,
});
```

For image-heavy sections (Knowledge Center galleries), `next/image` with `loading="lazy"` and correct `sizes` handles the actual weight — that's a media problem, not a JS-bundling problem, and conflating the two is the usual mistake here.

**Brutal note closing this session:** the crossfade-of-identical-frames trick in §2 only holds if `invalidate()` and the `toDataURL` capture fire on the *same* render tick. If you implement these as two separately-scheduled effects (say, `invalidate()` in a click handler and the capture in a `useEffect` with its own timing), you will occasionally capture a different frame than the one the canvas freezes on, and the crossfade seam will show up intermittently — the kind of bug that passes QA nine times and fails the tenth. Wire both through the single `onAfterRender` callback, not through independent effects, or this becomes the flakiest part of an otherwise deterministic system.

Overlay architecture locked. That closes the full stack — scroll narrative, lead vault, and HUD are all specified end-to-end. Next council session is genuinely open: first live implementation pass, or a design-QA sweep across all six sessions to catch cross-act inconsistencies before you start writing code against this?**THE EPILOGUE — FOOTER, COMPLIANCE, COOKIE CLEARANCE, 404**

These four are smaller in engineering surface than the previous six sessions, but they're where "cinematic immersion" claims get tested against real legal obligations — GDPR/DPDP consent has to actually function, not just look severe. Solving each, and flagging precisely where aesthetic and compliance genuinely conflict rather than pretending they don't.

**1. The Footer — Fixed Micro-Typography, Not a Section**

Correct instinct in your framing: a footer is a *scroll section*, and Act IV cannot end on a scroll section without undoing everything session 4 built toward a frozen standoff. So it isn't one — it's a fixed-position UI chrome element, same z-tier as the `[ DIRECTORY ]` trigger, present at all scroll positions simultaneously rather than arrived-at:

```css
.legal-strip {
  position: fixed; bottom: 2rem; left: 2rem;
  z-index: 500; /* above WebGL (0), below overlay drawer (999) */
  font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase;
  opacity: 0.35; mix-blend-mode: difference; /* legible on both light + dark frames without a manual color per-act */
  transition: opacity 0.3s ease;
}
.legal-strip:hover { opacity: 0.9; }
```

`mix-blend-mode: difference` is doing real work here beyond aesthetics — Acts I–IV cycle through genuinely different backdrop luminance (pitch black opening, twilight exterior, warm interior), and a fixed-opacity white or black label would go illegible against at least one of them. Difference-blending guarantees contrast against any backdrop without you hand-tuning per-act color.

**During the Act IV climax specifically** (`breachT`-equivalent for the final push, `scrollT > 0.9`): fade `.legal-strip` opacity to 0 entirely, driven off the same scroll-progress value Act IV's kinematics already read from. This isn't compliance risk — the links remain in the DOM and in every other scroll position; a brief disappearance during a ten-percent scroll window while the user is mid-conversion-push doesn't constitute hiding required disclosures, it's momentary de-emphasis during the one moment you've deliberately designed for zero peripheral distraction.

Contents: `PRIVACY · TERMS · SITEMAP` — three links only. Cookie Policy and Refund Policy don't need strip presence; they're reachable via the Command Directory like everything else, and stacking six links at 9px starts failing basic legibility regardless of tracking.

**2. Compliance Routing — Same Architecture, Deliberately, With One Addition**

Yes: exact reuse of session 6's `@overlay` interception pattern, no new layout. Privacy, Terms, Cookie Policy, Refund Policy, Sitemap all become additional entries in the `pages.config.ts` registry from session 6's codegen — `PrivacyPolicyContent`, `TermsContent`, etc., same Server Component discipline, same direct-hit fallback route. This is the payoff of having built that registry-driven pattern rather than one-off files: six more legal pages is a config-array addition, not new engineering.

One addition specific to *legal* content that wasn't a hard requirement for Careers or the Investment Guide: **the direct-hit fallback route is not optional polish here, it's the compliance-critical path.** Search engines, screen readers, and legal/regulatory review processes need to reach Terms & Conditions without executing a WebGL context, waiting on a JS bundle, or passing through a client-side interception layer at all. Since `app/terms/page.tsx` is already a plain Server Component per the session-6 pattern, this is satisfied by construction — but worth stating as a hard requirement rather than an incidental benefit, because it's the one place in this entire build where "works without JS" isn't a nice-to-have, it's closer to a legal expectation in most jurisdictions' accessibility guidance.

**3. Cookie Clearance — Terminal Framing, With the Compliance Substance Intact**

Aesthetic reframing is fine; what it must not do is compromise two non-negotiable mechanics: (a) a genuine, equally-weighted decline option — no dark-pattern styling where "Accept" is a solid button and "Decline" is a ghost-text afterthought — and (b) non-essential scripts (analytics, ad pixels, WhatsApp SDK if it sets tracking cookies) must not fire until consent is actually given, not just until the UI closes.

Structure it as a terminal boot sequence that **precedes** Act I's `ENTER` gesture, not merged into it — combining "authorize non-essential cookies" and "start the audio-gated cinematic experience" into one button is exactly the dark-pattern shape (bundling consent with an unrelated desired action) that regulators specifically flag:

```tsx
function ClearanceGate() {
  const [phase, setPhase] = useState<'boot' | 'prompt' | 'resolved'>('boot');
  // typewriter reveal, ~40ms/char, monospace — "ESTABLISHING SECURE CONNECTION..."
  // then: "NON-ESSENTIAL DATA COLLECTION REQUIRES AUTHORIZATION"

  return (
    <div className="clearance-terminal">
      <TerminalLine text="ESTABLISHING SECURE CONNECTION" onComplete={() => setPhase('prompt')} />
      {phase === 'prompt' && (
        <div className="clearance-actions"> {/* equal visual weight, non-negotiable */}
          <button onClick={() => resolveConsent('granted')} className="clearance-btn">AUTHORIZE</button>
          <button onClick={() => resolveConsent('essential-only')} className="clearance-btn">ESSENTIAL ONLY</button>
        </div>
      )}
    </div>
  );
}
```

Both buttons identical in size, weight, and visual prominence — same border treatment, same typography scale, difference only in label. That's the actual compliance requirement wearing the terminal costume; the costume is free, the equal-weighting is not negotiable.

`resolveConsent()` gates a Zustand flag that any analytics/tracking initialization checks before running — not after the modal closes, but as the actual load condition:

```ts
if (useConsentStore.getState().status === 'granted') {
  initAnalytics(); // only path that ever calls this
}
```

`ENTER` (Act I's audio gesture) only becomes interactive once `phase === 'resolved'` — sequential, not merged, so a court or regulator reviewing the flow sees two distinct, separately-justified user actions rather than one gesture papering over both.

**Brutal note, stated plainly because it matters more than any of the styling above:** a binary Authorize/Essential-only toggle is very likely **not sufficient** for strict GDPR compliance if this platform serves EU visitors (plausible for a luxury property marketed to NRI buyers) — GDPR's stricter reading generally expects **granular, per-category** consent (analytics vs. marketing vs. functional, toggled independently), not one bundled switch. What's specified above is a legitimate, good-faith consent gate for a general or India-first audience; if EU traffic is a real audience segment for this listing, budget in a proper CMP (Cookiebot, Osano, or similar) rather than the hand-rolled version — the terminal aesthetic can skin a real CMP's UI just as easily as a custom component, but the underlying granularity and audit trail a CMP provides isn't something worth rebuilding from scratch under a 75-day deadline. I'm not your lawyer and this isn't legal advice — flag this specific question (which jurisdictions' visitors this needs to satisfy) to the client and counsel before launch, not after.

**4. The 404 — DOM-Only, and a Non-Obvious Next.js Wrinkle Worth Naming**

Ruling: **stark DOM-only, no standalone WebGL context.** Two reasons, one aesthetic and one purely technical, and the technical one is the more important:

*Aesthetic:* an error page requesting a fresh shader compile and texture load is asking the client's GPU to do more work exactly when something has already gone wrong — the wrong moment to add a new failure surface. "SIGNAL LOST" as pure CSS interference/static is also, if anything, more conceptually correct than a 3D scene would be: a lost signal looks like noise, not architecture.

*Technical, and this is the part worth being precise about:* `app/not-found.tsx` at the root renders **inside your root layout**, not as a fully separate tree — meaning `<PersistentCanvas>` in `layout.tsx` will still mount as JSX regardless of whether `not-found.tsx` or your normal page fills `{children}`. A plain conditional inside `not-found.tsx` can't prevent that, because it doesn't control the layout's own JSX. The fix is the same zero-render-bridge pattern you already have from `CameraBridge` (session 5):

```tsx
// app/not-found.tsx
'use client';
export default function NotFound() {
  useEffect(() => {
    useSceneStore.getState().setErrorState(true);
    return () => useSceneStore.getState().setErrorState(false); // cleared on navigate-away
  }, []);

  return (
    <div className="signal-lost">
      <div className="static-noise" /> {/* CSS steps() keyframe glitch, GPU-cheap */}
      <h1>SIGNAL LOST</h1>
      <a href="/" className="return-link">RETURN TO APEX</a>
    </div>
  );
}
```

```tsx
// PersistentCanvas.tsx — inside root layout
function PersistentCanvas() {
  const errorState = useSceneStore(s => s.errorState);
  if (errorState) return null; // don't even attempt context creation
  return <Canvas frameloop="demand">{/* ... */}</Canvas>;
}
```

This is the **one deliberate exception** to the "never dispose/unmount the Canvas" rule from Act IV — and it's the correct exception, not a violation of that ruling, because the reasoning behind "never unmount" was preserving resumability of a *valid* scroll/camera state. A 404 means the user hit a route with no valid scroll state to preserve in the first place; there's nothing to resume. Clicking "RETURN TO APEX" navigates to `/`, `errorState` clears on unmount, and `PersistentCanvas` remounts fresh — a genuine one-time init cost, paid once, in the one scenario where paying it is actually correct rather than wasteful.

```css
.signal-lost {
  position: fixed; inset: 0; background: #050505; color: #ff2b2b;
  display: grid; place-items: center; font-family: 'Courier New', monospace;
}
.static-noise {
  position: absolute; inset: 0; opacity: 0.06; mix-blend-mode: screen;
  background: repeating-linear-gradient(0deg, #fff 0px, transparent 1px, transparent 2px);
  animation: glitch-shift 0.15s steps(2) infinite;
}
@keyframes glitch-shift { 0% { transform: translateY(0); } 100% { transform: translateY(2px); } }
```

No web font load, no image assets, no WebGL — this is the fastest-painting screen on the entire site, which is exactly the correct priority for the one page whose entire job is telling the user something already went wrong.

**Council closed.** Seven sessions, full stack specified end-to-end — scroll narrative physics, procedural shaders, Zustand-bridged routing, the lead vault schema, the HUD, and now the compliance layer, all load-bearing decisions made and defended. Nothing left to architect in the abstract; what's left is implementation.

Given the 75-day clock, I'd suggest the next session be a **build-order sequencing pass** — not new design, but ordering these seven sessions' worth of decisions into a critical path (what has to exist before what can be tested), since several of these systems have hard dependencies on each other (the freeze-state Zustand slice underpins Acts I–IV *and* the Overlay *and* the 404 exception) that are easy to build out of order and end up integration-testing twice.