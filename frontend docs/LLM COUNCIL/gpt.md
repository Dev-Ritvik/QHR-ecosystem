## ACT I — THE DROP

### 0–25% Scroll Architecture

The opening should **not** be designed as “camera moves forward while text fades in.”

That is the first thing I would reject.

The viewer should experience a three-stage perceptual event:

**absence → scale recognition → architectural threat/presence**

The key is that the estate is initially **larger than the camera's perceptual field**. We reveal it by controlling FOV, camera translation, exposure, fog density, and silhouette—not by simply moving the camera toward a building.

---

# 1. The 0–25% Timeline

I would divide Act I into four physically distinct states.

|   Scroll | State       | Viewer perception                    |
| -------: | ----------- | ------------------------------------ |
|   `0–4%` | VOID        | Almost nothing exists                |
|  `4–10%` | DROP        | Camera descends through darkness     |
| `10–18%` | SCALE       | Architectural silhouette emerges     |
| `18–25%` | RECOGNITION | Estate becomes unmistakably enormous |

The important distinction is that **scroll percentage is not camera distance**.

Define normalized narrative progress:

```text
u = clamp(scrollProgress / 0.25, 0, 1)
```

Then remap it independently for every subsystem.

For example:

```text
uCamera
uFOV
uExposure
uFog
uTypography
uAudio
uParticles
```

Each gets its own response curve.

That prevents the common mistake where *everything changes at exactly the same rate*.

That synchronized motion is what makes cinematic WebGL feel like a website animation rather than a controlled shot.

---

# 2. Camera Architecture

## Starting camera

I would **not** begin with a conventional 60° perspective camera.

Start with something closer to:

```text
FOV = 28°
near = 0.1
far  = 1200
```

The narrow FOV initially compresses the world.

The user sees darkness with perhaps a tiny architectural suggestion in the center.

Then the camera begins its descent.

### Initial position

Assume the primary estate axis is:

```text
+Z = architectural depth
+Y = vertical
```

Initial camera:

```text
C0 = (0, 42, 108)
```

Target:

```text
T0 = (0, 9, 0)
```

So the camera is already **above** the estate.

But we deliberately point it slightly downward:

```text
lookAt(C0 → T0)
```

The viewer does not immediately understand the geometry because the dominant information is silhouette and negative space.

---

# 3. The Drop Is Not Linear Translation

The camera path should contain **three simultaneous components**:

### Vertical descent

```text
Y(u) = lerp(42, 17, E_drop(u))
```

### Forward penetration

```text
Z(u) = lerp(108, 58, E_depth(u))
```

### Slight lateral drift

```text
X(u) = 0 + 4.5 * E_drift(u)
```

The lateral movement is extremely small.

We're not doing:

> left → right cinematic slider shot

We're creating **parallax uncertainty**.

The viewer shouldn't consciously notice the X displacement.

They should only feel that the geometry has started to acquire dimensionality.

---

# 4. The Critical Easing Curve

Do **not** use:

```js
power2.out
power3.out
```

for the entire drop.

Too conventional.

The camera needs an initial gravitational acceleration followed by a controlled deceleration.

Conceptually:

```text
          velocity
             /\
            /  \
           /    \
__________/      \________
        drop     arrest
```

I would construct the shot from two quintic segments.

### Phase 1 — gravitational acceleration

```glsl
float dropIn =
    1.0 - pow(1.0 - u, 3.8);
```

This causes the camera to initially accelerate into the shot.

### Phase 2 — impact arrest

At approximately:

```text
u = 0.72
```

introduce a second easing function:

```glsl
float arrest =
    1.0 - pow(1.0 - smoothstep(0.72, 1.0, u), 2.4);
```

Then combine them:

```text
cameraY = mix(
    startY,
    midY,
    dropIn
);

cameraY -=
    arrest * 1.8;
```

That final 1.8-unit displacement is the **weight**.

Not a bounce.

Not a shake.

Just a tiny downward settling.

The viewer should subconsciously interpret it as:

> this thing has mass.

---

# 5. FOV Warp

This is where we create the "drop" sensation without needing ridiculous camera velocity.

Starting:

```text
FOV = 28°
```

Peak:

```text
FOV = 49°
```

Ending:

```text
FOV = 41°
```

So:

```text
28° → 49° → 41°
```

The sequence matters.

### Why?

A pure translation gives:

```text
distance changes
```

A FOV expansion gives:

```text
distance + perceptual expansion
```

The viewer feels the world suddenly becoming much larger.

Use a smooth bell-shaped response:

```text
f = sin(π * u)
```

Then:

```text
FOV = 28 + 21f - 8u
```

approximately produces:

```text
u=0.00 → 28°
u=0.25 → ~43°
u=0.50 → ~47°
u=0.75 → ~42°
u=1.00 → ~41°
```

That gives the shot an initial **optical opening** before the FOV settles.

---

# 6. Camera Rotation

This is another place where amateur implementations become obvious.

Do not directly manipulate:

```js
camera.rotation.x
camera.rotation.y
```

as independent values.

Calculate a target vector.

For example:

```text
T(u) =
(
  sin(uπ) * 3.5,
  11 - 4u,
  0
)
```

Then:

```text
quaternion = lookAt(cameraPosition, target)
```

This produces coherent rotational motion.

The target itself moves.

The camera therefore doesn't feel like it is on a mechanical gimbal.

---

# 7. The "Eye Drop"

Between approximately:

```text
u = 0.12 → 0.30
```

I want a very subtle rotational acceleration.

Not camera shake.

Instead:

```text
yaw   ≈ +0.7°
pitch ≈ -1.4°
roll  ≈ +0.18°
```

The roll is particularly important.

**0.18° is enough.**

Anything around:

```text
1–2°
```

starts looking like a VFX preset.

We want **imperceptible instability**, not instability as spectacle.

---

# 8. Twilight Lighting Architecture

We should keep the lighting system brutally simple.

I would use four major layers.

### Layer A — physical sky contribution

Very low intensity.

```text
Environment intensity ≈ 0.04–0.08
```

Not enough to illuminate the building.

Just enough to prevent completely clipped blacks.

### Layer B — enormous directional moon-like source

One directional light:

```text
intensity ≈ 1.2
angle ≈ 0.15°
```

Position it thousands of units away.

Example:

```text
(-180, 300, 120)
```

This gives the architecture a coherent single-direction silhouette.

### Layer C — architectural practicals

Extremely sparse emissive windows.

Not lights everywhere.

Instead:

```text
98% dark
2% selectively emissive
```

This creates scale.

A building with 1,000 bright windows looks like a game environment.

A building with 8–20 strategically placed light sources looks expensive.

### Layer D — volumetric atmosphere

This is the actual twilight.

Not massive fog.

A **distance-based density field**.

Conceptually:

```glsl
density =
    baseDensity
    * heightFalloff
    * distanceFalloff
    * twilightMask;
```

---

# 9. Twilight Shader

I would not initially use a full volumetric raymarch.

That is unnecessary expense during the opening shot.

Instead:

### Base atmosphere

Use exponential height fog:

```glsl
fogDensity =
    0.0035
    * exp(-worldPosition.y * 0.025);
```

Then introduce a twilight vertical gradient:

```glsl
float horizon =
    smoothstep(
        0.0,
        45.0,
        worldPosition.y
    );

vec3 twilight =
    mix(
        lowAtmosphereColor,
        upperAtmosphereColor,
        horizon
    );
```

This gives:

```text
ground → dense blue-black
middle → cold twilight
sky → slightly lighter desaturated blue
```

No purple neon nonsense.

---

# 10. Post-Processing Stack

This needs to be extremely restrained.

I would use:

```text
RenderPass
   ↓
Tone Mapping
   ↓
Bloom
   ↓
Vignette
   ↓
Chromatic Aberration
   ↓
Film Grain
```

But several of those are essentially disabled during Act I.

### Tone mapping

Use:

```text
ACES
```

because we want highlight compression rather than a clipped digital image.

### Bloom

Very low threshold.

Something around:

```text
threshold ≈ 0.92
intensity ≈ 0.08–0.15
radius ≈ small
```

The bloom should mainly affect:

* practical lights
* tiny emissive surfaces
* atmospheric highlights

Not the architecture itself.

If the walls glow, we've failed.

### Vignette

Approximately:

```text
darkness ≈ 0.25
```

with a wide falloff.

The vignette should reinforce the 2.39:1 composition rather than scream “Instagram filter.”

### Chromatic aberration

Almost nothing:

```text
offset ≈ 0.0003–0.0008
```

Only visible during the most aggressive portion of the drop.

Then return toward:

```text
0
```

### Grain

Extremely fine monochromatic noise.

Approximately:

```text
0.02–0.035
```

The grain isn't there to look “cinematic.”

It prevents perfect CG smoothness from exposing the procedural origin of the scene.

---

# 11. I Would Add One More Node

A **very subtle exposure adaptation pass**.

But not automatic exposure.

We want deterministic cinematic control.

Define:

```text
exposure(u)
```

starting around:

```text
-2.4 EV
```

and gradually reaching:

```text
-0.7 EV
```

over Act I.

Therefore:

```text
blackness
   ↓
silhouette
   ↓
geometry
   ↓
material recognition
```

The audience feels as though their eyes are adapting.

It's an extremely powerful illusion.

---

# 12. The Black Is Not Actually Black

Important.

Do **not** render:

```text
RGB = (0,0,0)
```

everywhere.

Our dark baseline should be something like:

```text
RGB ≈ (0.004, 0.006, 0.009)
```

in linear space.

That tiny distinction matters enormously once grading and bloom begin interacting with the image.

Absolute black destroys the atmosphere.

Near-black preserves volume.

---

# 13. Spatial Typography

The opening typography should be **sparse enough that it feels like information emerging from the void**.

At 0%:

```text
NO TITLE
```

Only a tiny location marker perhaps:

```text
00°00'00"
```

But even that is optional.

At approximately:

```text
u = 0.08
```

introduce:

```text
A LEGACY
```

At:

```text
u = 0.20
```

the primary statement:

```text
BUILT
TO REMAIN.
```

I would avoid writing:

> "Welcome to..."

> "Discover..."

> "Experience..."

That's real-estate website language.

We're establishing mythology, not selling a brochure.

---

# 14. Typography Must Not Fight the Architecture

The text belongs to the **negative space**.

Conceptually:

```text
              ARCHITECTURE
                    ███
                    ███
             ███    ███
         ███ ███    ███


   BUILT
   TO REMAIN.
```

The typography should remain approximately:

```text
screen occupancy < 14%
```

during the first 25%.

That's important.

The architecture must win.

---

# 15. Typography Animation

Never:

```text
opacity 0 → 1
```

alone.

Use three variables:

```text
opacity
tracking
vertical displacement
```

Example:

```text
opacity:      0 → 1
letterSpacing: 0.14em → 0.04em
Y:             +32px → 0
```

But the motion happens in **different phases**.

```text
0–35%    position
25–55%   tracking
45–100%  opacity
```

That means the text appears to **assemble** rather than simply fade.

---

# 16. The Audio System

This is where I would make one correction to the earlier ruling.

We should **not try to start the audible sound automatically on page load**.

Browsers generally require user interaction before Web Audio can reliably start/resume an audible context. ([MDN Web Docs][1])

So the architecture should be:

```text
PAGE LOAD
    ↓
AudioContext created/suspended
    ↓
User interaction
    ↓
resume()
    ↓
audio engine armed
```

This is compatible with the browser's autoplay model. ([MDN Web Docs][2])

---

# 17. Audio Graph

For Act I:

```text
Oscillator
   ↓
Low-pass filter
   ↓
Gain envelope
   ↓
Convolver
   ↓
Master gain
   ↓
Destination
```

I'd actually use **two drones**.

### Sub layer

```text
frequency ≈ 32–38 Hz
```

Extremely quiet.

It should be more *felt* than heard on capable systems.

### Upper pressure layer

```text
frequency ≈ 58–72 Hz
```

Slowly modulated.

Then a filtered noise layer:

```text
Brown noise
      ↓
Low-pass ~180 Hz
```

The noise gives the soundbed physical texture.

---

# 18. The Drop Sound Should Be Scroll-Derived

Don't play:

```text
sound.start()
```

when scroll reaches a percentage.

Instead derive audio intensity from camera velocity.

Define:

```text
v = |cameraVelocity|
```

then:

```text
audioGain =
    smoothstep(
        V_MIN,
        V_MAX,
        v
    );
```

Now the sound physically responds to the movement.

Fast camera descent:

```text
more pressure
```

Camera deceleration:

```text
pressure collapses
```

Camera arrest:

```text
deep impact
```

That's vastly more convincing than timeline-triggered sound effects.

---

# 19. The Impact

At approximately:

```text
u ≈ 0.72
```

the camera's vertical acceleration approaches its minimum.

That's where we place the first tactile impact.

Not a loud boom.

A **35–60 ms low-frequency impulse** into a convolution reverb.

Think:

```text
THUMM
```

rather than:

```text
BOOM
```

The impact should also slightly affect the image.

Approximately:

```text
exposure -0.06 EV
```

for ~80 ms.

And:

```text
chromatic aberration +0.0004
```

for ~60 ms.

Then recover.

The audience shouldn't consciously notice any of this.

---

# 20. One Clock — Revised Implementation

Your unified ticker ruling is correct.

But I would be precise about the R3F side.

R3F explicitly supports:

```text
always
demand
never
```

and exposes:

```text
invalidate()
advance()
setFrameloop()
```

for manually controlling rendering. ([Poimandres Documentation][3])

For the active cinematic state:

```text
GSAP ticker
      ↓
Lenis.raf()
      ↓
scroll state
      ↓
camera/material/audio state
      ↓
R3F invalidate()
```

`frameloop="demand"` is exactly appropriate for this architecture because R3F only renders when invalidated. ([Poimandres Documentation][4])

---

# 21. Important Correction: Don't Create a Second RAF Through Lenis

Lenis itself documents the GSAP integration as:

```text
gsap.ticker
      ↓
lenis.raf()
```

and the integration explicitly exists to synchronize Lenis with GSAP's timing. ([GitHub][5])

Therefore:

```text
❌ GSAP ticker
       +
   Lenis RAF
       +
   R3F RAF
```

is forbidden.

Instead:

```text
GSAP TICKER
     │
     ├── Lenis.raf()
     │
     ├── GSAP animation evaluation
     │
     └── R3F invalidate()
               ↓
        Browser render
```

One driving clock.

One scheduling authority.

---

# 22. But There Is an Important Distinction

You said:

> Lenis will manually trigger R3F's invalidate() or advance()

For our primary mode I choose:

```text
invalidate()
```

not:

```text
advance()
```

because:

```text
frameloop = demand
```

is our normal operating state.

`advance()` belongs to the `never` model and manually advances a R3F frame. R3F explicitly documents that distinction. ([Poimandres Documentation][3])

So the state machine becomes:

```text
CINEMATIC ACTIVE
frameloop = demand
→ invalidate()

DOSSIER FROZEN
frameloop = never
→ no advancement
```

When the directory opens:

```text
setFrameloop("never")
```

Then capture the current visual state and apply the overlay.

---

# 23. The Freeze Should Happen Before the Blur

Sequence matters.

Not:

```text
open overlay
→ blur
→ freeze
```

Instead:

```text
user pointerdown
      ↓
freeze R3F
      ↓
capture current frame
      ↓
activate overlay
      ↓
animate DOM opacity
      ↓
apply blur
```

The freeze becomes the **cause** of the time dilation.

The blur becomes its visual consequence.

That makes the interaction conceptually coherent.

---

# 24. Performance Budget for Act I

I'd establish these hard ceilings immediately.

```text
GPU frame target       < 16.6 ms
CPU frame target       < 8 ms
Draw calls             < 100
4K texture count       ≈ minimal
Dynamic lights         ≤ 4
Shadow-casting lights  ≤ 1
Post FX passes         ≤ 5
DPR                    adaptive, capped
```

For desktop:

```text
DPR = min(devicePixelRatio, 1.75)
```

Then dynamically regress toward:

```text
1.0–1.25
```

under sustained GPU pressure.

The goal isn't:

> maintain 60 FPS at all costs

The goal is:

> preserve the *cinematic perceptual hierarchy* when the hardware cannot maintain full fidelity.

So the degradation order should be:

```text
grain
↓
chromatic aberration
↓
bloom quality
↓
DPR
↓
shadow quality
↓
volumetric quality
```

Never sacrifice:

```text
camera
silhouette
composition
architecture
```

Those are the identity of the project.

---

# 25. Final Shot Specification

The first 25% should therefore feel approximately like:

```text
0%
│
│   BLACK
│   barely perceptible volume
│
├── 4%
│
│   first movement
│   28° FOV
│   extremely low exposure
│
├── 10%
│
│   camera descends
│   FOV expanding
│   atmospheric depth appears
│
├── 15%
│
│   first architectural silhouette
│   typography begins assembling
│
├── 20%
│
│   estate scale becomes legible
│   cold directional edge lighting
│   sub-bass pressure rising
│
└── 25%
    │
    │   camera begins arrest
    │   FOV stabilizes
    │   typography fully resolves
    │   architecture dominates frame
    │
    ▼
    ACT II READY
```

### The governing perceptual equation

The opening should effectively behave like:

```text
PERCEIVED SCALE
=
CAMERA DESCENT
×
FOV EXPANSION
×
CONTRAST ADAPTATION
×
PARALLAX
×
ATMOSPHERIC DEPTH
```

—not:

```text
PERCEIVED SCALE = camera.position.z -= 10
```

That distinction is the difference between **a 3D website** and **a cinematic spatial experience**.

And the unified-clock architecture is sound: GSAP's ticker is itself synchronized to browser rendering, while Lenis officially supports being driven from that ticker; R3F then exposes the exact manual invalidation/framerate controls needed for the demand-driven model. ([GSAP][6])

For Act I, I would therefore lock the core values to:

```text
Initial FOV        28°
Peak FOV           ~47–49°
Final FOV          ~41°
Initial camera     (0, 42, 108)
Final camera       (~4.5, 17, 58)
Max roll           0.18°
Exposure           -2.4 EV → -0.7 EV
Bloom              0.08–0.15
Chromatic aberr.   < 0.001
Fog                exponential + height falloff
Primary lights     1 directional + sparse practicals
R3F                demand
Audio driver       GSAP → Lenis → state → R3F invalidate
```

[1]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices?utm_source=chatgpt.com "Web Audio API best practices - Web APIs | MDN"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume?utm_source=chatgpt.com "AudioContext: resume() method - Web APIs | MDN"
[3]: https://r3f.docs.pmnd.rs/api/hooks?utm_source=chatgpt.com "Hooks - React Three Fiber"
[4]: https://r3f.docs.pmnd.rs/advanced/scaling-performance?utm_source=chatgpt.com "Scaling performance - React Three Fiber"
[5]: https://github.com/darkroomengineering/lenis?utm_source=chatgpt.com "GitHub - darkroomengineering/lenis: Smooth scroll at it should be · GitHub"
[6]: https://gsap.com/docs/v3/GSAP/gsap.ticker/?utm_source=chatgpt.com "gsap.ticker | GSAP | Docs & Learning"
## ACT II — THE ARCHITECTURAL REVEAL

**Director's ruling:** Act II should not read as “orbit camera around building.” The camera becomes a **heavy observer moving on a constrained architectural rail**, while the architecture itself becomes the thing that creates motion through foreground parallax.

The critical transition is:

```text
ACT I
vertical momentum
      ↓
settled observation
      ↓
ACT II
lateral momentum
      ↓
architectural occlusion
      ↓
water / void / negative space
      ↓
new spatial axis
```

The orbital arc should expose the pool and sunken lounge **because the foreground disappears and reappears**, not because we deliberately point the camera at them.

---

# 1. Act II Spatial Contract

At `25%`, we inherit:

```text
camera ≈ (4.5, 17, 58)
FOV    = 41°
```

Define the architectural orbit center around the pool/lounge axis:

```text
O = (0, 8.5, 18)
```

I would not orbit around the geometric center of the estate.

That would produce a theme-park camera.

We orbit around the **visual center of gravity** of the reveal.

Let:

```text
r0 = camera25 - O
```

and project the horizontal component:

```text
rh = vec2(r0.x, r0.z)
R  = length(rh)
```

Then the camera follows:

```text
x(θ) = Ox + R cos(θ)
z(θ) = Oz + R sin(θ)
```

with independent vertical motion:

```text
y(θ) = 17 + 2.4 * H(θ)
```

where `H` is not a generic sine wave; it is a broad, asymmetric lift used to prevent the camera from behaving like a flat mechanical orbit.

---

# 2. Arc Length and Angular Range

The visible sweep should be approximately:

```text
θ0 = 0°
θ1 = -62°
```

So the viewer experiences roughly a **60° exterior reveal**.

Do not go to `90°+`.

That changes the shot from:

> discovering the architecture

to:

> showing off the model.

The pool should become progressively more exposed while the estate remains dominant.

---

# 3. The Actual Camera Function

Normalize Act II:

```text
u = clamp(
  (scroll - 0.25) / 0.25,
  0.0,
  1.0
)
```

Now use a **minimum-jerk trajectory**:

```glsl
float minJerk(float x) {
    x = clamp(x, 0.0, 1.0);
    return x * x * x * (10.0 - 15.0 * x + 6.0 * x * x);
}
```

This is preferable to `power3.out` because the derivative and acceleration are controlled at the endpoints.

Define:

```glsl
float q = minJerk(u);
float theta = mix(theta0, theta1, q);
```

Therefore:

```text
25%
θ = 0°
angular velocity = 0

≈32%
motion begins

≈38%
velocity becomes substantial

≈44%
maximum orbital authority

50%
velocity returns toward zero
```

The camera therefore **accelerates out of Act I, performs the sweep, and settles before Act III**.

That matters.

If angular velocity is still high at 50%, Act II will feel like it is simply being cut off.

---

# 4. Add Architectural Vertical Drift

The camera should not remain at a constant `Y`.

Use a broad asymmetric function:

```glsl
float rise =
    sin(q * PI * 0.82)
    * smoothstep(0.0, 0.35, q);

float cameraY =
    17.0
    + 2.4 * rise;
```

Result:

```text
25% → 17.0
~38% → ~18.8
~45% → ~19.3
50% → ~17.7
```

That gives the viewer a brief ability to see **over the foreground limestone**, exposing the pool without abandoning the low-angle power established in Act I.

This is a controlled **parallax window**.

---

# 5. Look Target Must Also Orbit

The camera position alone should never define the shot.

Use a moving target:

```text
T(u) =
(
    0.0,
    9.5 + 1.2*q,
    19.0
)
```

Then perturb it very subtly toward the pool:

```glsl
target.x += sin(q * PI) * 2.0;
target.y += sin(q * PI * 0.8) * 0.8;
```

Then:

```ts
camera.lookAt(target)
```

or, preferably, calculate the target quaternion and slerp toward it.

This ensures the camera is **looking through the architecture**, rather than behaving like an object attached to a circular rail.

---

# 6. The Z-Axis Bank

This is the important part.

Do not arbitrarily say:

```js
rotation.z = -10 * progress
```

That's fake.

The roll should derive from **angular velocity**.

For circular motion:

```text
v = Rω
```

and the centripetal acceleration magnitude is:

```text
a = Rω²
```

We can map that normalized acceleration into cinematic bank:

```glsl
float bank =
    sign(thetaVelocity)
    * atan(
        kBank * R * thetaVelocity * thetaVelocity,
        gravityProxy
    );
```

But because the real-world gravitational/centripetal relationship would produce a surprisingly small bank for a camera at this scale, we use a **cinematic gain**:

```text
kBank = 0.06–0.09
```

Then clamp:

```glsl
bank = clamp(bank, radians(-3.2), radians(3.2));
```

My target:

```text
maximum roll ≈ 2.4°
```

Not 6°.

Not 10°.

At 2.4° the viewer feels the acceleration.

At 8° they notice the camera.

The latter is wrong.

---

# 7. Make the Bank Lag the Velocity

Even better:

```text
roll_target = f(angularVelocity²)
```

then:

```text
roll = damp(
    previousRoll,
    roll_target,
    7.0,
    dt
);
```

This produces:

```text
velocity rises
    ↓
bank follows
    ↓
velocity peaks
    ↓
bank peaks slightly afterward
    ↓
velocity falls
    ↓
bank settles
```

That microscopic lag gives the camera mass.

---

# 8. The Camera Should Not Orbit Uniformly

Uniform angular velocity is too clean.

Use:

```glsl
float velocityProfile =
    0.55
    + 0.45 * sin(PI * q);
```

Then:

```glsl
theta = theta0
      + (theta1 - theta0)
      * integral(velocityProfile)
```

For implementation, precompute or use a normalized analytical approximation rather than numerically integrating every frame.

A practical version:

```glsl
float arcProfile =
    q
    + 0.12 * sin(TAU * q) / TAU;

theta = mix(theta0, theta1, arcProfile);
```

Now the sweep has a subtle:

```text
launch → weight → acceleration → cruise → arrest
```

rather than:

```text
same speed
same speed
same speed
```

---

# 9. Infinity Pool — Do NOT Raymarch the Entire Surface

This is where I would shoot down an easy mistake.

A full-screen raymarched water solution is absolutely unnecessary for this shot.

We're rendering a **known planar body of water**.

Use:

```text
PlaneGeometry
+ vertex displacement
+ procedural fragment shading
```

The expensive architectural complexity belongs elsewhere.

The water shader should not exceed approximately:

```text
~40–60 ALU-ish operations/pixel
```

depending on the final composition and GPU tier.

---

# 10. Water Geometry

Use a moderate grid:

```tsx
<planeGeometry
  args={[42, 18, 128, 64]}
/>
```

Rotate horizontal:

```tsx
rotation-x={-Math.PI / 2}
```

This is only:

```text
8,385 vertices
```

before indexing considerations.

More than enough for a slow luxury pool viewed from a distance.

Do **not** use:

```text
512 × 512
```

water geometry.

The extra tessellation is wasted.

---

# 11. Gerstner Displacement

Use only 3 waves.

Not 12.

Luxury architecture water should be almost still.

For each wave:

```glsl
vec3 gerstnerWave(
    vec3 p,
    vec2 direction,
    float steepness,
    float wavelength,
    float speed,
    float time
)
{
    float k = TAU / wavelength;

    float c = sqrt(9.81 / k);

    float phase =
        k * dot(direction, p.xz)
        - speed * time * c;

    float a =
        steepness / k;

    vec3 displacement;

    displacement.x =
        direction.x * a * cos(phase);

    displacement.z =
        direction.y * a * cos(phase);

    displacement.y =
        a * sin(phase);

    return displacement;
}
```

Then:

```glsl
p += gerstnerWave(...);
p += gerstnerWave(...);
p += gerstnerWave(...);
```

But the amplitude remains tiny:

```text
A1 ≈ 0.025
A2 ≈ 0.012
A3 ≈ 0.006
```

We're creating **surface tension**, not an ocean.

---

# 12. Water Normal Reconstruction

Don't use an expensive dynamic normal-map system.

Calculate normals from nearby displaced positions.

Conceptually:

```glsl
vec3 p  = displaced(position);
vec3 px = displaced(position + vec3(EPS, 0, 0));
vec3 pz = displaced(position + vec3(0, 0, EPS));

vec3 normal =
    normalize(
        cross(
            pz - p,
            px - p
        )
    );
```

Then use:

```glsl
N = normalize(normal)
```

for the water lighting.

This gives us the actual geometric wave normal.

---

# 13. The Pool Reflection Strategy

Do **not** create a real-time planar reflection camera unless profiling proves we need it.

That adds another major scene render.

Instead use a hybrid:

```text
Fresnel
+
procedural sky reflection
+
low-frequency blurred architectural reflection
+
specular response
```

The key equation is Schlick Fresnel:

```glsl
float fresnel =
    pow(
        1.0 - max(dot(V, N), 0.0),
        5.0
    );
```

Then:

```glsl
vec3 waterColor =
    mix(
        deepPool,
        environmentReflection,
        fresnel
    );
```

This is enough because the audience sees the water primarily as a **dark reflective plane**, not as an explicit reflection showcase.

---

# 14. Procedural Caustics

The phrase “raymarched caustics” is tempting.

I reject it for Act II.

We don't need raymarching.

Use animated multi-scale Voronoi/noise projected along the pool surface.

Conceptually:

```glsl
float c1 = cellular(uv * 3.0 + time * 0.015);
float c2 = cellular(uv * 7.0 - time * 0.025);

float caustic =
    smoothstep(
        0.55,
        0.78,
        c1 * 0.65 + c2 * 0.35
    );
```

Then:

```glsl
color += caustic * causticStrength;
```

But:

```text
causticStrength ≈ 0.04–0.07
```

The caustics should barely appear.

They are there for subconscious material recognition.

---

# 15. Pool Edge — Where the Real Cinematic Detail Goes

The water itself should be restrained.

The **infinity edge** gets the attention.

Create a narrow procedural edge band:

```glsl
float edge =
    1.0 - smoothstep(
        0.0,
        0.12,
        distanceToInfinityEdge
    );
```

Then mix in a slightly brighter reflective response.

At night:

```text
water = dark
edge = readable
```

That's much more luxurious than making the whole pool glow blue.

Avoid blue pool lighting entirely.

That immediately pushes the scene toward resort-render territory.

---

# 16. Pool Color Architecture

Think:

```text
Base:

near-black
↓
blue-grey reflection
↓
cold silver highlights

Forbidden:

electric cyan
saturated aqua
bright blue
neon teal
```

The viewer should initially wonder:

> Is that water?

Then the moving specular response answers:

> Yes.

That's the reveal.

---

# 17. Sunken Lounge CSG

`@react-three/csg` is a good choice **provided the geometry is static**.

The package exposes `Geometry`, `Base`, `Subtraction`, `Addition`, etc., and specifically warns that repeated runtime CSG updates should be avoided. ([GitHub][1])

Therefore:

```text
BUILD TIME
   ↓
CSG
   ↓
final BufferGeometry
   ↓
static runtime mesh
```

Not:

```text
scroll
 ↓
move cutter
 ↓
CSG update
 ↓
rebuild mesh
 ↓
render
```

That would be unacceptable.

---

# 18. Lounge Construction

Use one architectural volume:

```tsx
<Geometry>
  <Base>
    <boxGeometry args={[26, 5, 14]} />
  </Base>

  <Subtraction position={[0, 1.8, 0]}>
    <boxGeometry args={[18, 3.5, 9]} />
  </Subtraction>

  <Subtraction position={[0, 3.2, 0]}>
    <boxGeometry args={[20, 1.4, 10]} />
  </Subtraction>
</Geometry>
```

Then add separate structural elements:

```text
structural shell
sunken void
stairs
bench volumes
pool wall
limestone pillars
```

Don't force the entire estate into one CSG tree.

One large architectural CSG operation is manageable.

An entire estate represented as one constantly evaluated Boolean graph is not.

---

# 19. CSG Geometry Budget

The lounge should ideally collapse to:

```text
1 final mesh
1 material
1 draw call
```

The subtraction operations cease to matter once the final geometry is generated.

This is exactly the right use case for CSG.

The current `@react-three/csg` API supports `Geometry` with `Base` and chained subtraction operations, and can optionally recompute normals/groups. ([GitHub][1])

---

# 20. The Limestone Pillars Become a Visual Instrument

The pillars are not decoration.

They are our **optical shutter**.

During Act II:

```text
camera
 ↓
pillar
 ↓
label
 ↓
pool
```

Then:

```text
camera rotates
 ↓
pillar leaves frame
 ↓
label becomes visible
 ↓
pool is revealed
```

Therefore the pillars should be intentionally positioned to create **occlusion windows**.

That's cinematography implemented through geometry.

---

# 21. Spatial HTML Architecture

Drei's `<Html>` supports:

```text
transform
occlude
onOcclude
distanceFactor
```

and can perform real scene occlusion. ([Poimandres Documentation][2])

Our structure should be:

```tsx
<group name="ActII">

  <Architecture>
    <LimestonePillars ref={occludersRef} />
    <SunkenLounge />
    <InfinityPool />
  </Architecture>

  <ArchitecturalAnnotations>
    <PoolAnnotation />
    <LoungeAnnotation />
  </ArchitecturalAnnotations>

</group>
```

---

# 22. Exact Annotation Structure

```tsx
function PoolAnnotation({
  occluder
}: {
  occluder: React.RefObject<THREE.Object3D | null>
}) {
  return (
    <group position={[6.5, 11.2, 15.5]}>
      <Html
        transform
        distanceFactor={8}
        occlude={occluder.current ? [occluder.current] : undefined}
        onOcclude={(hidden) => {
          // Feed state machine rather than forcing React re-render
          annotationState.setHidden(hidden)
        }}
        className="architectural-data"
      >
        <div className="annotation">
          HEATED INFINITY EDGE
          <span>180° ESCARPMENT VIEW</span>
        </div>
      </Html>
    </group>
  )
}
```

The important point is:

**the text lives at a real 3D coordinate.**

It is not a fixed DOM element pretending to be spatial.

---

# 23. Occlusion Strategy

For these labels I would use:

```tsx
occlude={[pillarsRef]}
```

rather than:

```tsx
occlude="blending"
```

for the majority of annotations.

Drei's regular occlusion mode hides the HTML when geometry lies between the camera and its position; `"blending"` is a different visual mode with a backing geometry/material system. ([Poimandres Documentation][2])

We do not need the latter.

We're asking:

> “Is the label behind this architectural geometry?”

not:

> “Can I blend this DOM panel into the 3D framebuffer?”

Regular occlusion is cheaper and conceptually cleaner.

---

# 24. Important HTML Performance Rule

Do **not** place 30 `<Html>` nodes in Act II.

Use:

```text
2–4 active annotations
```

maximum.

And only enable annotations that belong to the current shot.

For example:

```text
25–31%:
none

31–38%:
POOL

38–44%:
LOUNGE

44–50%:
POOL + LOUNGE
```

We're creating a cinematic annotation system, not a HUD.

---

# 25. Typography Should Obey Perspective

Because `transform` mode makes the HTML participate in the scene transform, its apparent size depends on camera FOV and distance. Drei documents this behavior explicitly. ([Poimandres Documentation][2])

Therefore:

```tsx
<Html
  transform
  distanceFactor={8}
/>
```

is fundamentally different from putting the text at:

```text
position: fixed
```

The annotation naturally shrinks as the camera moves away.

That is exactly what we want.

---

# 26. Pillar Occlusion Should Be Deliberately Designed

I'd create a dedicated group:

```tsx
const occluders = useRef<THREE.Group>(null)

<group ref={occluders}>
  <LimestonePillar position={...} />
  <LimestonePillar position={...} />
  <LimestonePillar position={...} />
</group>
```

Then:

```tsx
<Html
  transform
  occlude={[occluders.current!]}
>
```

The architectural group becomes the **occlusion authority**.

Do not use the entire scene as the occluder.

That creates unnecessary intersection tests and produces undesirable hiding behavior.

---

# 27. One More Occlusion Trick

The annotation should not instantly pop out when a pillar clears it.

Use a tiny hysteresis layer:

```text
geometry visibility
       ↓
0.00–0.08 s delay
       ↓
DOM opacity
```

So:

```text
pillar clears label
     ↓
label remains 100ms
     ↓
label resolves
```

This is long enough to prevent flickering when the ray grazes an edge.

But short enough to remain physically believable.

---

# 28. Water Audio — Do Not Add a “Wave.wav”

This is where cheap implementations betray themselves.

We don't want:

```text
<ocean-wave.mp3>
```

looping underneath the drone.

Instead build the water from **continuous stochastic components**.

Web Audio graph:

```text
Brown noise
      │
      ├── Low-pass ──┐
      │              │
      └── Band-pass ─┤
                     ↓
                Water bus
                     ↓
                Convolver
                     ↓
               Master output
```

---

# 29. Water Noise Layer 1 — Low-Frequency Mass

Brown noise:

```text
10–140 Hz
```

low-pass around:

```text
~90 Hz
```

Gain:

```text
very low
```

This creates the sense of **water mass**.

It should occupy the same acoustic space as the sub-bass drone.

---

# 30. Water Noise Layer 2 — Edge Texture

Second noise source:

```text
pink / filtered white noise
```

band-pass:

```text
1.2–3.5 kHz
```

This is the audible “fizz” of water hitting the edge.

But its gain is controlled by camera proximity to the infinity edge.

Define:

```glsl
d = distance(camera, waterEdge);

waterPresence =
    1.0 - smoothstep(
        30.0,
        65.0,
        d
    );
```

Then map:

```text
waterPresence
      ↓
filter frequency
      ↓
gain
```

So the water doesn't suddenly appear as an audio clip.

The **acoustic environment changes as the camera enters the architecture's water zone.**

---

# 31. Make the Water Audio Non-Periodic

Amplitude modulation should not be:

```text
sin(time)
```

That creates obvious pulsing.

Use several irrational-frequency LFOs:

```text
LFO1 = 0.17 Hz
LFO2 = 0.29 Hz
LFO3 = 0.43 Hz
```

Combine:

```js
modulation =
    0.55
    + 0.2 * Math.sin(t * 0.17)
    + 0.15 * Math.sin(t * 0.29)
    + 0.1  * Math.sin(t * 0.43)
```

Normalize.

Then apply to gain.

The listener perceives **irregular water**, not a repeating animation.

---

# 32. Preserve the Act I Drone

Don't crossfade the drone out.

Instead:

```text
Act I
SUB DRONE 100%
WATER      0%

Act II
SUB DRONE 92%
WATER     12%

Mid Act II
SUB DRONE 86%
WATER     22%

50%
SUB DRONE 82%
WATER     28%
```

The drone remains the psychological foundation.

Water becomes the first environmental evidence that this fortress contains a **human sanctuary**.

That's the narrative transition.

---

# 33. Audio Spatialization

Do not pan water left/right according to screen coordinates.

Pan using the **world-space edge position** relative to the camera.

For example:

```text
camera → nearest point on water edge
```

Then derive:

```text
azimuth
distance
```

and feed those into a `PannerNode`.

Use:

```text
distanceModel = "inverse"
refDistance   ≈ 8
maxDistance   ≈ 80
rolloffFactor ≈ 0.8
```

Now when the pool appears to the right of the camera, the acoustic field shifts accordingly.

That's spatial storytelling.

---

# 34. Act II Unified Ticker

The architecture remains:

```text
GSAP ticker
     ↓
Lenis.raf()
     ↓
normalized scroll
     ↓
Act II state
     ├── camera
     ├── water uniforms
     ├── audio
     └── annotation visibility
     ↓
R3F invalidate()
```

Lenis' current React documentation explicitly shows disabling its autonomous RAF and driving `lenis.raf()` from the GSAP ticker, which matches the unified-clock architecture. ([GitHub][3])

---

# 35. Do NOT Put the Entire Camera Animation Into GSAP

This is an architectural distinction I would lock now.

GSAP should own:

```text
narrative timeline
```

It should **not** own:

```text
camera position every frame
```

Instead:

```text
GSAP
→ act progress

CameraController
→ evaluates physics from act progress
```

So:

```ts
const q = actProgress;
const theta = orbitalPosition(q);
const velocity = derivative(theta);
const bank = bankingFromVelocity(velocity);
```

This gives us an actual **kinematic camera system**.

GSAP becomes the clock/timeline authority rather than a pile of transform tweens.

---

# 36. R3F Scene Structure

The scene should resolve into something like:

```tsx
<Canvas frameloop="demand">

  <ActIIEnvironment />

  <Architecture>

    <EstateShell />

    <LimestoneOccluders>
      <Pillars />
    </LimestoneOccluders>

    <SunkenLounge />

    <InfinityPool>
      <PoolWater />
      <InfinityEdge />
    </InfinityPool>

  </Architecture>

  <ArchitecturalAnnotations>
    <PoolAnnotation />
    <LoungeAnnotation />
  </ArchitecturalAnnotations>

  <ActIIPostFX />

</Canvas>
```

And internally:

```text
ActIIEnvironment
│
├── atmosphere
├── directional key
├── sparse practicals
└── reflection environment

Architecture
│
├── static meshes
├── static CSG lounge
└── occlusion geometry

InfinityPool
│
├── static pool shell
├── dynamic water plane
└── edge detail

Annotations
│
├── Html #1
└── Html #2
```

---

# 37. Act II GPU Budget

My target:

| System          |       Budget |
| --------------- | -----------: |
| Architecture    |  20–35 draws |
| Pool            |          1–2 |
| Lounge CSG      |            1 |
| Pillars         |          1–4 |
| Practicals      |    instanced |
| Water shader    |       1 draw |
| Post-processing |   3–5 passes |
| HTML            |    2–4 nodes |
| Dynamic shadows | 1 key source |

The water is deliberately:

```text
1 mesh
1 shader
1 draw call
```

The lounge:

```text
1 static CSG result
1 material
1 draw call
```

That leaves the GPU budget for the thing that actually matters:

**the architectural image.**

---

# 38. The Most Important Visual Trick

At approximately `37–42%`, the camera should pass behind the **largest foreground pillar**.

For perhaps:

```text
120–250 ms
```

the pool disappears.

Do not fix that.

**That's the shot.**

Then the camera clears the pillar:

```text
LIMESTONE
   ↓
dark void
   ↓
thin silver water line
   ↓
infinity edge
   ↓
sunken lounge
```

The eye suddenly understands the scale relationship.

This is more cinematic than any amount of volumetric post-processing.

---

# 39. Act II Ending State

At `50%`:

```text
camera velocity → 0
roll → 0
FOV → ~44°
```

I would slightly increase FOV from Act I's `41°` to approximately:

```text
44°
```

because we're transitioning from:

```text
fortress inspection
```

to:

```text
environmental reveal
```

The pool should now occupy roughly:

```text
15–22%
```

of the frame.

The estate still occupies the majority.

And the final acoustic state should be:

```text
sub-bass drone
       +
room tone
       +
faint water edge
       +
architectural reverb
```

No music cue yet.

That belongs to the next dramatic transition.

---

## Director's Lock

**Act II is approved with these architectural invariants:**

```text
ORBIT
θ:          0° → -62°
trajectory: minimum-jerk + asymmetric velocity
radius:     fixed architectural orbit
Y:          17 → ~19 → ~18
roll:       velocity-derived, max ~2.4°
FOV:        41° → ~44°

WATER
geometry:   128 × 64
waves:      3 Gerstner components
caustics:   procedural, non-raymarched
reflection: Fresnel + procedural environment
draws:      1

LOUNGE
CSG:        build once
runtime:    static BufferGeometry
draws:      1

HTML
transform:  true
occlude:    explicit pillar group
active:     2–4 annotations
mode:       raycast occlusion, not blending

AUDIO
drone:      persistent
water:      stochastic filtered noise
spatial:    world-relative PannerNode
modulation: non-periodic
transition: continuous, not sample-triggered

CLOCK
GSAP ticker
    ↓
Lenis RAF
    ↓
scene state
    ↓
R3F invalidate()
```

One correction to the brief is particularly important: **do not raymarch the infinity pool simply because “cinematic water” sounds like a raymarching problem.** A planar water surface with controlled Gerstner displacement, procedural caustic modulation, Fresnel response, and disciplined lighting gives us nearly all of the perceptual value at a fraction of the cost.

And the current `@react-three/csg` implementation is suitable precisely because its operations can be composed into a final geometry, while its own documentation cautions against frequent runtime recomputation. ([GitHub][1])

**Act II's defining idea is therefore not “camera reveals pool.”**

It is:

> **The architecture itself becomes the shutter that reveals the water.**

That is the mechanic I'd carry into the actual implementation.

[1]: https://github.com/pmndrs/react-three-csg?utm_source=chatgpt.com "GitHub - pmndrs/react-three-csg: 🚧 Constructive solid geometry for React · GitHub"
[2]: https://drei.docs.pmnd.rs/misc/html?utm_source=chatgpt.com "Html - Drei"
[3]: https://github.com/darkroomengineering/lenis/blob/main/packages/react/README.md?utm_source=chatgpt.com "lenis/packages/react/README.md at main · darkroomengineering/lenis · GitHub"
# ACT III — THE SANCTUARY
## 50% → 75% : Exterior Mass → Interior Silence

**Director's ruling:** the threshold is not a scene transition.

It is a **controlled change of optical environment**.

The viewer crosses one physical plane and, over roughly 1–2 seconds of cinematic time, four systems simultaneously change state:

```text
EXTERIOR
cold / wide / reflective / noisy
          ↓
       GLASS
          ↓
INTERIOR
warm / compressed / absorptive / quiet
```

The critical mistake would be to implement this as:

```text
scroll %
    ↓
hide exterior
    ↓
show interior
```

That is explicitly rejected.

The correct model is:

```text
camera position
      ↓
distance to threshold
      ↓
continuous blend parameter B
      ├── exposure
      ├── light contribution
      ├── glass transmission
      ├── atmosphere
      ├── audio routing
      └── Syndicate activation
```

The glass itself becomes the **state interpolator**.

---

# 1. ACT III MASTER TIMELINE

Normalize:

```ts
const u = clamp(
  (scrollProgress - 0.50) / 0.25,
  0,
  1
)
```

But don't drive every subsystem directly from `u`.

Define four sub-progressions:

```text
uApproach
uBreach
uInterior
uSettle
```

Recommended windows:

```text
50–58%   APPROACH
58–64%   BREACH
64–70%   ENTRY
70–75%   SANCTUARY SETTLE
```

That gives the shot four distinct physical states.

---

# 2. CAMERA PATH: DON'T TELEPORT THROUGH THE WALL

The camera should travel on a **curved penetration vector**.

At 50%:

```text
C0 ≈ edge of infinity pool
```

Define the glass threshold plane:

```text
Pglass = (0, 10.5, 9)
```

and its normal pointing inward:

```text
Nglass = normalize((0, 0, -1))
```

The approach trajectory is:

```glsl
vec3 C =
    C0
    + tangent * s
    + Nglass * depth;
```

where `depth` transitions:

```text
0 → +0.8    exterior approach
+0.8 → -0.8 threshold crossing
-0.8 → -8.5 interior penetration
```

The camera physically crosses the threshold.

No camera cut.

---

# 3. THE BREACH SHOULD HAPPEN QUICKLY

The approach should be slow.

The actual glass crossing should be comparatively fast.

Use:

```glsl
float breach = smoothstep(
    0.42,
    0.62,
    u
);
```

Then give the threshold crossing a slightly asymmetric response:

```glsl
float breachK =
    1.0 - pow(
        1.0 - breach,
        2.8
    );
```

This creates:

```text
slow approach
    ↓
decisive penetration
    ↓
immediate interior deceleration
```

That is far more believable than having the camera slowly crawl through glass.

---

# 4. FOV MUST COMPRESS INDOORS

Act II ended around:

```text
FOV ≈ 44°
```

Don't keep that.

A wide FOV inside the Sanctuary will destroy the intended architectural intimacy.

Use:

```text
50%       44°
58%       45°
64%       41°
70%       37°
75%       38°
```

So:

```text
exterior:
44–45°

interior:
37–38°
```

The optical compression makes the interior feel **denser and more expensive**.

We aren't shrinking the room.

We're changing the viewer's lens relationship to it.

---

# 5. THE SANCTUARY CAMERA PATH

Once inside, target:

```text
TargetInterior ≈ (0, 5.8, -1.5)
```

Camera:

```text
Cinterior ≈ (2.8, 4.8, -6.5)
```

This is a crucial transition.

The viewer begins:

```text
looking toward the estate
```

and ends:

```text
inside the estate, looking across the living core
```

The camera should slightly **overshoot the geometric center** of the room.

Otherwise the room feels like a showroom.

We want an observer inhabiting the space.

---

# 6. NO STRAIGHT-LINE INTERIOR ENTRY

Use a cubic Bézier trajectory:

```text id="q4q4rj"
P0 = exterior position
P1 = threshold tangent
P2 = interior offset
P3 = sanctuary settle
```

with:

```glsl
B(t) =
(1-t)^3 P0
+ 3(1-t)^2 t P1
+ 3(1-t)t^2 P2
+ t^3 P3;
```

But make the path **slightly asymmetrical in X**.

For example:

```text
P0 = ( 4.0, 17.0, 12.0)
P1 = ( 2.8, 12.0,  9.0)
P2 = ( 1.0,  7.0,  2.0)
P3 = (-2.5,  4.8,-6.5)
```

The small lateral drift causes the interior geometry to parallax across the lens.

That is critical.

---

# 7. ROLL SHOULD DIE AT THE THRESHOLD

Act II ended with lateral/orbital momentum.

Do not carry that bank straight into the house.

That would feel like a roller coaster entering a museum.

Instead:

```glsl
float exteriorRoll =
    actIIAngularVelocity * bankGain;

float interiorRoll =
    mix(
        exteriorRoll,
        0.0,
        smoothstep(0.0, 0.22, u)
    );
```

At the threshold:

```text
roll → 0°
```

The camera becomes **stable at the exact instant the environment becomes intimate**.

That is an extremely useful psychological signal.

---

# 8. EXPOSURE: NEVER CHANGE LIGHT AND EXPOSURE SIMULTANEOUSLY AT THE SAME RATE

This is the core exposure problem.

Three.js exposes both the renderer tone-mapping mode and `toneMappingExposure`; changing exposure is deterministic and independent of the geometry itself. 

At 50%:

```text
Exterior EV ≈ -0.7
```

For the interior, don't jump immediately to:

```text
EV = +1.0
```

Instead create an adaptation state:

```text
EV_target(u)
```

with a delayed response.

---

# 9. Exposure Adaptation Model

Define:

```glsl
float b =
    smoothstep(
        0.48,
        0.76,
        u
    );
```

Then:

```glsl
float exposureEV =
    mix(
        -0.7,
        0.35,
        b
    );
```

But **this is only the target**.

Actual exposure should lag behind it:

```text
dExposure/dt =
    (targetExposure - exposure)
    / tau
```

Use:

```text
tau ≈ 0.9–1.2 seconds
```

This gives the optical sensation of adaptation.

So:

```text
camera crosses threshold
       ↓
interior appears initially underexposed
       ↓
warm practicals begin resolving
       ↓
eyes “adapt”
       ↓
interior reaches final luminance
```

There should never be a white flash.

---

# 10. Use Two Exposure States, Not One

I would maintain:

```text
E_external
E_internal
```

and blend between them:

```glsl
E =
    mix(
        E_external,
        E_internal,
        b
    );
```

But then apply temporal smoothing.

This creates a **continuous photometric field**.

The exposure is therefore responding to architectural occupancy, not to a page number.

---

# 11. LIGHT INTENSITY MUST ALSO BE STAGGERED

The biggest mistake would be:

```text
interiorLights *= b;
```

at the same time as exposure.

That effectively doubles the illumination response.

Instead:

### Exterior contribution

```text
100% → 25%
```

during:

```text
52–68%
```

### Interior practicals

```text
0% → 100%
```

during:

```text
56–72%
```

But practical intensity reaches:

```text
~70%
```

before exposure finishes adapting.

Thus:

```text
warm light appears
    ↓
camera enters
    ↓
exposure catches up
    ↓
warm room settles
```

That is the human-like sequence.

---

# 12. 2700K DOES NOT MEAN “ORANGE EVERYTHING”

This is crucial.

A 2700K practical should have:

```text
warm direct source
+
neutral bounced architecture
+
dark shadow regions
```

not:

```text
entire room = orange filter
```

The marble might remain:

```text
warm neutral
```

while walnut reads:

```text
deep amber-brown
```

and black steel remains:

```text
near-neutral
```

Warmth comes from the **sources**, not from putting an orange grade over the entire image.

---

# 13. INTERIOR LIGHT SETUP

Use very few lights.

### Primary practicals

Three to five clustered point/area sources.

For example:

```text
P1
position = [-3.5, 5.2, -1.0]

P2
position = [ 3.0, 4.8, -2.0]

P3
position = [ 0.0, 4.5,  2.5]
```

The point isn't photorealistic lighting.

It's **hierarchical lighting**.

Each should create:

```text
localized warm pool
```

rather than bathing the entire room.

---

# 14. Keep THE MOON OUTSIDE

The cold exterior directional source should not suddenly vanish.

Instead allow it to remain as a faint rim through the glass:

```text
exterior directional
100%
      ↓
glass threshold
      ↓
interior contribution
~5–12%
```

This gives the room a subtle cool/warm split:

```text
WINDOW SIDE
cold blue

INTERIOR CORE
warm tungsten
```

That contrast is extremely cinematic.

---

# 15. GLASS: DON'T SOLVE THIS WITH `near = 0.001`

This is important.

A PerspectiveCamera's near plane determines what enters the frustum, and Three.js explicitly warns that an excessively tiny near plane combined with a huge far plane sacrifices depth precision. 

So:

```text
❌ near = 0.00001
```

is not our solution.

For this world scale:

```text
near ≈ 0.05–0.08
far  ≈ 600–1000
```

is sufficient **if the architecture is scaled sensibly**.

The glass artifact is not fundamentally a near-plane problem.

It is a **material + depth + transmission** problem.

---

# 16. The Glass Should Become “Non-Visual” at the Crossing

Do not literally make the camera intersect the glass while retaining a normal transparent material.

Instead define a proximity variable:

```glsl
float d =
    dot(
        worldPosition - glassPlaneOrigin,
        glassNormal
    );
```

and:

```glsl
float pass =
    smoothstep(
        0.35,
       -0.35,
        cameraPlaneDistance
    );
```

Then use:

```glsl
glassOpacity =
    mix(
        0.18,
        0.0,
        pass
    );
```

As the camera approaches:

```text
glass becomes visually lighter
```

At the crossing:

```text
glass contribution ≈ 0
```

Immediately afterward:

```text
glass restores behind camera
```

The user experiences:

> entering through a plane of atmosphere

rather than:

> clipping through transparent geometry.

---

# 17. Use a Fake Breach Layer

This is one of the few places where a tiny controlled post effect earns its cost.

At the threshold:

```text
~120–180 ms
```

introduce:

```text
luminance veil
+
very subtle bloom
+
slight desaturation
```

Not white.

Something closer to:

```text
cold exterior →
neutral veil →
warm interior
```

The veil hides the microscopic discontinuities created by intersecting the transparent surface.

It is effectively a **photographic gate**.

---

# 18. Don't Use Full-Screen Motion Blur

Rejected.

It would:

- increase fill-rate;
- smear the glass transition;
- weaken the architectural silhouettes;
- make the camera feel artificially fast.

The breach is already physically interesting enough.

---

# 19. Better Glass Material

Use a custom physical material or shader with:

```text
transmission
IOR
roughness
attenuation
```

But keep transmission resolution deliberately constrained.

Three.js currently exposes a `transmissionResolutionScale` specifically for transmissive materials, and its documentation notes that reducing it can significantly improve performance. 

For this shot I'd begin around:

```text
transmissionResolutionScale ≈ 0.5
```

and profile.

The glass should read as:

```text
reflection
+
slight distortion
+
edge highlight
```

not as a perfectly invisible transparent sheet.

---

# 20. Glass Surface Shader

Use a very subtle Fresnel:

```glsl
float f =
    pow(
        1.0 - max(dot(V, N), 0.0),
        5.0
    );
```

Then:

```glsl
vec3 glassColor =
    mix(
        neutralGlass,
        coolReflection,
        f
    );
```

At grazing angles:

```text
glass strengthens
```

head-on:

```text
glass almost disappears
```

That gives us the correct behavior without requiring a huge refraction effect.

---

# 21. THE GLASS BREACH EVENT

At approximately:

```text
58–64%
```

our state machine should look like:

```text
EXTERIOR 1.0
INTERIOR 0.0
GLASS     1.0
```

then:

```text
EXTERIOR 0.5
INTERIOR 0.5
GLASS     0.4
```

then:

```text
EXTERIOR 0.1
INTERIOR 1.0
GLASS     0.0
```

This is a continuous state transformation.

No boolean scene switching.

---

# 22. The Syndicate Enters as ARCHITECTURAL ANNOTATION

Do not introduce partner cards.

The first Syndicate members should feel like **people encoded into the architecture**.

For example:

```text
WOOD PANEL
    │
    │
    └── MASTER OF BESPOKE MILLWORK
        CARVED OAK / HAND-FINISHED
```

And:

```text
MARBLE FLOOR
    │
    └── MASTER STONEMASON
        QUARRIED / HONED / EDGE-MATCHED
```

The architecture becomes the index.

---

# 23. Drei Spatial UI

Drei `Html` supports `transform`, `occlude`, and `onOcclude`; transform mode causes size to depend on camera distance/FOV, which is exactly the behavior we want here. 

Structure:

```tsx
<SanctuarySyndicate>

  <MillworkAnchor position={[-3.8, 3.8, -2.4]} />

  <StoneAnchor position={[2.8, 0.22, -1.0]} />

  <LightingAnchor position={[0.5, 4.2, 2.2]} />

</SanctuarySyndicate>
```

Each annotation gets:

```tsx
<Html
  transform
  distanceFactor={7}
  occlude={[sanctuaryGeometryRef]}
>
```

Now the text exists **inside the architectural coordinate system**.

---

# 24. Make Syndicate UI Extremely Small

At any given moment:

```text
max 2 active nodes
```

and each should occupy:

```text
< 8% viewport area
```

The label should resemble:

```text
01 / SYNDICATE

MASTER OF
BESPOKE MILLWORK

OAK / WALNUT / HAND JOINERY
```

Small.

Editorial.

No glowing cards.

No glassmorphic rectangles.

No floating buttons.

---

# 25. Interaction Model

The node itself should have only:

```text
hover
click
```

Hover:

```text
thin underline
+ slight letter-spacing contraction
```

Click:

```text
camera attention shifts
```

We should not open a conventional modal.

The eventual route:

```text
/syndicate/[slug]
```

can occupy the Command Overlay architecture already established.

Thus:

```text
3D world
  ↓
spatial syndicate anchor
  ↓
selection
  ↓
Command Overlay / dossier
```

The world remains continuous.

---

# 26. Occlusion Strategy

Use specific architecture as occluders:

```tsx
const sanctuaryOccluders = useRef<THREE.Group>(null)
```

containing:

```text
wood wall
marble column
stone divider
ceiling volume
```

Then:

```tsx
<Html
  transform
  occlude={[sanctuaryOccluders.current!]}
  onOcclude={handleOcclusion}
/>
```

Drei explicitly supports passing specific object refs in `occlude`, rather than only using the entire scene. 

This is important for both semantics and performance.

---

# 27. UI Should NOT Cast or Receive Scene Shadows

Drei's `Html` can use a blending mode with material/shadow behavior, but that's not what this interface needs. 

Use normal spatial HTML plus raycast occlusion.

We need:

```text
physical position
physical scale
physical occlusion
```

not:

```text
DOM pretending to be mesh
```

---

# 28. THE ACOUSTIC VACUUM

This is the strongest part of Act III.

We need to make the listener feel:

```text
outside world sealed away
```

before the interior room is fully audible.

The correct graph is:

```text
EXTERIOR SOURCES
│
├── water
├── wind
└── exterior drone
│
↓
EXTERIOR BUS
│
├── high-frequency attenuation
├── lowpass
└── gain
│
↓
THRESHOLD ROUTER
│
├───────────────┐
↓               ↓
EXTERIOR        INTERIOR
BUS             BUS
                │
                ├── direct dry
                └── room IR
                      ↓
                  ROOM REVERB
```

Web Audio's graph model is explicitly designed around interconnected `AudioNode`s, and `ConvolverNode` performs convolution against an impulse response to produce reverb. 

---

# 29. DO NOT MUTE WATER INSTANTLY

This would sound fake:

```text
water gain:
1 → 0
```

Instead:

```text
water
1.00
 ↓
0.65
 ↓
0.25
 ↓
0.04
```

over the breach.

Simultaneously:

```text
exterior lowpass:
8 kHz
 ↓
2.8 kHz
 ↓
700 Hz
 ↓
220 Hz
```

This produces the acoustic sensation of a wall closing between the listener and the environment.

The listener doesn't hear:

> water switched off.

They hear:

> water became physically isolated.

---

# 30. Add A Glass-Barrier Filter

Create:

```text
outsideFilter = BiquadFilterNode
```

type:

```text
lowpass
```

During exterior:

```text
frequency ≈ 12–16 kHz
```

During threshold:

```text
frequency ≈ 800 Hz
```

Immediately after:

```text
frequency ≈ 150–250 Hz
gain very low
```

Then leave it nearly inaudible.

A BiquadFilter is explicitly intended for frequency-domain shaping and its frequency/Q parameters are controllable `AudioParam`s. 

---

# 31. The Room Should Initially Be TOO Quiet

This is important.

At:

```text
64–68%
```

don't immediately introduce a huge reverb tail.

Instead:

```text
direct interior signal
≈ -30 dB
reverb
≈ -36 dB
```

Then slowly increase.

Psychologically:

```text
outside disappears
      ↓
vacuum
      ↓
ear recalibrates
      ↓
room exists
```

That's much stronger than immediately hearing:

> luxury room reverb.wav.

---

# 32. Sanctuary Impulse Response

We want a relatively short but dense IR.

Conceptually:

```text
RT60 ≈ 0.8–1.2 s
```

Not a cathedral.

A treated luxury interior with:

```text
stone
marble
wood
textiles
upholstery
```

has a complex decay, but not an enormous tail.

Use one stereo `ConvolverNode`.

Then filter the reverb return:

```text
highpass ≈ 80 Hz
lowpass  ≈ 7–9 kHz
```

This removes muddy and overly bright tails.

`ConvolverNode` accepts mono, stereo, or 4-channel impulse responses, so a stereo room IR is perfectly valid here. 

---

# 33. CREATE A PREDELAY

Between:

```text
dry room
```

and:

```text
reverb
```

insert:

```text
DelayNode
```

around:

```text
18–28 ms
```

That creates separation between the source and the room.

The result:

```text
close
↓
clean
↓
expands
```

rather than:

```text
everything sounds wet.
```

---

# 34. Acoustic Routing Mathematics

Define:

```glsl
B = breachProgress
```

Then:

```text
ExteriorGain =
    1.0 - smoothstep(0.35, 0.75, B)

InteriorGain =
    smoothstep(0.48, 0.82, B)
```

But use equal-power crossfade:

```text
Gext = cos(B * π/2)
Gint = sin(B * π/2)
```

That prevents the midpoint from becoming acoustically empty.

Then deliberately **override** it with the vacuum:

```text
during 62–67%:
both gains temporarily reduced
```

That gives us the acoustic vacuum.

---

# 35. THE “VACUUM” IS A NEGATIVE SPACE EVENT

At the exact threshold:

```text
water gain ↓
wind gain ↓
exterior reverb ↓
interior direct ↓
interior reverb ↓
```

Everything briefly contracts.

Then the room reappears.

This is the acoustic equivalent of the Act I blackness.

---

# 36. Sub-Bass Must Change Character

Do not remove the sub-bass drone.

Instead move it from:

```text
external environmental pressure
```

to:

```text
internal architectural resonance
```

For example:

```text
EXTERIOR:
34 Hz
high low-end spatial width

INTERIOR:
42 Hz
narrower
lower gain
more room reverb
```

So the exact same musical identity exists in both worlds, but its acoustic enclosure changes.

That makes the entire experience feel like one continuous physical universe.

---

# 37. AUDIO GRAPH — FINAL

```text
                 ┌── water ─────────────┐
                 │                      ↓
                 ├── wind ─────────> EXTERIOR BUS
                 │                      │
                 └── ext drone ────────┤
                                        ↓
                                  Lowpass / Gain
                                        ↓
                                     ROUTER
                                        │
                         ┌──────────────┴──────────────┐
                         ↓                             ↓
                   INTERIOR BUS                 EXTERIOR BUS
                         │
              ┌──────────┴───────────┐
              ↓                      ↓
           DIRECT                  REVERB SEND
                                      ↓
                                   Delay
                                      ↓
                                 Convolver
                                      ↓
                               Reverb EQ
                                      ↓
                                  Room Bus
                                      │
                                      └──────→ MASTER
```

Gain changes must be scheduled through `AudioParam` rather than abruptly assigning audio gain values, because instantaneous changes can create clicks; ramping is the correct approach. 

---

# 38. WATER AUDIO DOES NOT DIE — IT GOES BEHIND THE WALL

This distinction matters enough to lock.

The water source continues running.

We merely change:

```text
gain
frequency response
spatial presence
```

Therefore if the camera somehow turns back toward the window, the exterior sound can naturally return.

That makes the acoustic environment **reversible**.

---

# 39. MATERIAL TRANSITION

The scene itself also needs a material transition.

Exterior:

```text
wet stone
cold limestone
glass
water
```

Interior:

```text
walnut
warm limestone
dark marble
brushed metal
textiles
```

Do not switch materials at `u = 0.6`.

Instead, visibility and lighting reveal them naturally.

The interior materials should already exist **before** the camera enters.

They were simply unlit.

This is the same principle we used for exposure:

> reveal existing reality; never spawn reality.

---

# 40. Interior Atmosphere

Exterior fog must not simply continue indoors.

Reduce it sharply:

```text
fogDensity:

exterior  = 0.0035
threshold = 0.0012
interior  = ~0.00015
```

Instead use a very subtle interior haze:

```glsl
float interiorHaze =
    exp(-distanceToCamera * 0.012)
    * 0.015;
```

The interior should feel **crystalline and dense**, not foggy.

---

# 41. DOF

This is the one post-process I would permit becoming slightly more visible.

Outside:

```text
DOF = nearly invisible
```

Inside:

```text
focusDistance ≈ sanctuary focal plane
aperture ≈ subtle
```

The Syndicate annotation attached to a wood panel can therefore sit within a convincing focal hierarchy.

But avoid shallow depth of field over the entire interior.

The architecture must remain readable.

---

# 42. SANCTUARY SETTLE

At 70–75%:

```text
camera velocity → 0
roll → 0
FOV ≈ 38°
exposure → stable
exterior audio → near-silent
interior room → fully established
```

The final pose should feel like:

```text
camera has entered
      ↓
camera has been accepted by the space
```

not:

```text
camera stopped because animation ended.
```

This is why the final position should have a very small damped settling motion:

```glsl
float settle =
    exp(-7.0 * t)
    * sin(9.0 * t)
    * 0.05;
```

Maximum positional displacement:

```text
≈ 5 cm
```

Not visible as an animation.

Only enough to eliminate mechanical stopping.

---

# 43. React Three Fiber Architecture

I would now formalize Act III as:

```tsx
<Canvas frameloop="demand">

  <SceneLighting />

  <ActIIIWorld>

    <Exterior>
      <Pool />
      <GlassFacade />
    </Exterior>

    <Threshold>
      <GlassPlane />
      <ThresholdVolume />
    </Threshold>

    <Sanctuary>
      <StructuralShell />
      <InteriorMaterials />
      <PracticalLights />

      <SyndicateAnchors />

      <InteriorAtmosphere />
    </Sanctuary>

  </ActIIIWorld>

  <ActIIIPostFX />

</Canvas>
```

And outside the canvas:

```text
AudioEngine
CameraState
SyndicateState
ScrollState
```

all remain independent.

---

# 44. The State Machine

Don't use dozens of booleans.

Use one architectural state:

```ts
type SanctuaryPhase =
  | "approach"
  | "threshold"
  | "breach"
  | "interior"
  | "settle"
```

Derived from signed distance to the threshold:

```ts
distance =
  plane.normal.dot(camera.position) - plane.constant
```

Then:

```text
distance > +0.8 → approach
+0.8 → 0.0      → threshold
0.0 → -0.8      → breach
-0.8 → -6       → interior
< -6            → settle
```

Now every subsystem receives the **same physical state**.

This is much stronger than five independent scroll ranges.

---

# 45. Performance Budget

Act III has more potential performance traps than Act II.

The hard ceilings remain:

```text
CPU frame            < 8 ms
GPU frame            < 16.6 ms
dynamic lights       ≤ 4
shadow lights        ≤ 1
active Html nodes    ≤ 2
interior transparent
surfaces             minimal
post-process         ≤ 5 passes
```

The specific traps:

### Transmission

Expensive.

Keep:

```text
glass surfaces = 1 major facade
```

not dozens of transparent panels.

Three.js explicitly exposes a resolution scale for transmission precisely because transmission render cost can be significant. 

### Audio

Web Audio processing is outside the WebGL GPU budget, but don't create a new filter/reverb graph every frame.

Create nodes once.

Animate `AudioParam`s.

### HTML

Only active Syndicate anchors exist.

### Lighting

Do not create every practical as a dynamic shadow-casting light.

Use emissive geometry for most fixtures.

---

# 46. The 60 FPS Decision Hierarchy

If the scene begins missing the budget, degrade in this order:

```text
1. transmission resolution
2. DOF quality
3. subtle interior haze
4. bloom quality
5. DPR
6. shadow-map resolution
```

Never sacrifice:

```text
camera path
glass threshold
practical lighting hierarchy
architectural silhouettes
```

Those four constitute the entire Act III identity.

---

# 47. Final Act III Frame

At 75%, the frame should read:

```text
┌──────────────────────────────────────────────┐
│                                              │
│        warm darkness                         │
│                                              │
│      ┌───────────────┐                       │
│      │   SANCTUARY   │                       │
│      │               │                       │
│      │      ●        │  ← practical          │
│      │               │                       │
│      └───────────────┘                       │
│                                              │
│  01 / SYNDICATE                              │
│  MASTER OF BESPOKE MILLWORK                  │
│                                              │
└──────────────────────────────────────────────┘
```

But the UI itself remains tiny.

The architectural volume remains dominant.

The viewer has crossed from:

```text
FORTRESS
```

into:

```text
HOME
```

without a single conventional page transition.

---

# Director's Lock

### Camera

```text
50% FOV             44°
Interior FOV        37–38°

Breaching path      cubic Bézier
Threshold crossing  ~58–64%
Interior settle      ~70–75%

Roll                 → 0° at threshold
Final camera         low, intimate, slightly off-axis
```

### Exposure

```text
Exterior EV          -0.7
Interior target      +0.35 EV
Adaptation            ~0.9–1.2 s
Method                delayed target tracking
```

Three.js supports `toneMappingExposure` directly on the renderer; we retain the same tone-mapping pipeline and vary exposure continuously rather than swapping render pipelines. 

### Glass

```text
near                  ~0.05–0.08
glass                  Fresnel/transmission
threshold              opacity → 0
breach                  120–180 ms optical veil
NO                      extreme near-plane hacks
NO                      full-screen motion blur
```

### Syndicate

```text
Drei Html
transform              true
occlude                explicit sanctuary refs
active nodes            ≤ 2
screen occupancy        < 8% each
```

Drei's current `Html` implementation supports exactly the spatial transform and explicit-object occlusion model required here. 

### Audio

```text
Exterior water      ↓↓↓
Exterior wind       ↓↓↓
Glass low-pass      ↓↓↓
Acoustic vacuum      brief
Interior direct      ↑
Room convolution     ↑
Pre-delay            ~18–28 ms
RT60                 ~0.8–1.2 s
```

The Web Audio architecture supports this cleanly through `GainNode`, `BiquadFilterNode`, `DelayNode`, and `ConvolverNode`; `ConvolverNode` is specifically intended for impulse-response reverb. 

**The defining mechanism of Act III is therefore not “enter the house.”**

It is:

> **The glass separates two physical acoustic and photometric worlds, and the camera crosses the boundary while both worlds remain continuously present.**

That keeps the entire 0–75% sequence one uninterrupted physical reality—and that continuity is exactly what will make Act IV's eventual standoff feel earned.
# ACT IV — THE STANDOFF
## 75% → 100% — Observation → Decision

**Council ruling: reject both proposed extremes as the primary shot.**

A violent reverse-pullout would undermine the psychological progression we built in Acts I–III. The user has spent 75% of the experience moving **toward** the estate. Suddenly throwing them kilometers backward turns the property into an object again.

The microscopic marble dissolve has the opposite problem: it becomes abstract art at precisely the moment we need **intent**.

### The correct finale is a controlled forward compression.

The camera moves deeper into the Sanctuary, approaches one architecturally significant object, then uses that object as the **optical aperture into the acquisition state**.

In other words:

```text
ACT I       FALL
             ↓
ACT II      REVEAL
             ↓
ACT III     ENTER
             ↓
ACT IV      APPROACH
             ↓
100%        STANDOFF
             ↓
             DOSSIER
```

The final psychological message is:

> **You are no longer looking at the estate. You have arrived at the point where a decision is made.**

---

# 1. FINAL KINEMATICS — THE CONTROLLED APPROACH

At 75% we have:

```text
Camera ≈ (−2.5, 4.8, −6.5)
FOV    ≈ 38°
Roll   ≈ 0°
```

Don't accelerate immediately.

First create **stillness**.

From 75–82%:

```text
camera velocity ≈ 0
```

The user sees the Sanctuary.

This pause is important because anticipation requires contrast.

Then:

```text
82–94%
```

camera moves toward a selected architectural focal object.

I'd choose something with symbolic weight:

- a monumental stone table;
- a sculptural stair junction;
- a bespoke timber wall;
- or a narrow architectural aperture framing the night exterior.

**My preferred choice: the architectural aperture.**

Why?

Because it preserves the core metaphor:

```text
outside world
      ↓
estate
      ↓
sanctuary
      ↓
private access
```

The user approaches the final boundary.

---

# 2. THE CAMERA PATH

Define:

```ts
P0 = camera.position
Ptarget = final architectural focal point
```

but don't interpolate linearly.

Use a cubic Bézier:

```text
P0
 ↓
C1
 ↓
C2
 ↓
P3
```

with:

```glsl
vec3 bezier(
    vec3 p0,
    vec3 p1,
    vec3 p2,
    vec3 p3,
    float t
) {
    float i = 1.0 - t;

    return
        i*i*i*p0 +
        3.0*i*i*t*p1 +
        3.0*i*t*t*p2 +
        t*t*t*p3;
}
```

For example:

```text
P0 = (-2.5, 4.8, -6.5)
C1 = (-2.2, 4.7, -5.0)
C2 = (-1.2, 4.4, -2.8)
P3 = ( 0.0, 4.2, -0.8)
```

The important property is:

```text
velocity starts near zero
       ↓
accelerates
       ↓
reaches maximum around 90%
       ↓
decelerates sharply before 100%
```

---

# 3. THE EASING CURVE

Do **not** use:

```ts
power2.inOut
```

as the final cinematic motion.

It is too generic.

Use a custom velocity profile.

Conceptually:

```glsl
float cinematicEase(float t) {
    float a = smoothstep(0.0, 0.28, t);
    float b = 1.0 - smoothstep(0.72, 1.0, t);

    return a * b;
}
```

Then integrate that into the position rather than simply using it as a conventional easing function.

The desired velocity graph:

```text
velocity
   │             /\
   │           /    \
   │         /        \
   │_______/            \_______
   └────────────────────────────── time
       75       90       100%
```

This is the **last breath of motion**.

---

# 4. WHY NOT THE VIOLENT REVERSE PULLOUT?

Rejected for four reasons.

### 1. It reverses the psychological vector

Acts I–III establish:

```text
distance → proximity
```

Reverse-pulling creates:

```text
proximity → distance
```

at the exact moment we want ownership intent.

### 2. It makes the property feel like a marketing render

The user becomes a spectator again.

### 3. It increases motion sickness risk

A high-speed reverse camera combined with a wide architectural environment creates enormous optic flow.

### 4. It wastes the Sanctuary

We spent an entire act earning the interior.

Don't throw it away.

---

# 5. WHY NOT MARBLE MICRO-DISSOLVE?

Also rejected as the primary ending.

It could be used as a **secondary shader transition**, however.

That's the distinction.

The camera can approach the marble and the shader can progressively lose physical detail.

At:

```text
94–98%
```

we introduce:

```text
micro-normal reduction
+
specular compression
+
depth fade
```

The physical world starts becoming **less literal**.

But the camera remains architecturally anchored.

---

# 6. THE FINAL OPTICAL COLLAPSE

At approximately:

```text
97–100%
```

the WebGL world shouldn't simply fade to black.

Instead compress its luminance range.

Conceptually:

```glsl
vec3 finalColor = sceneColor;

float collapse = smoothstep(
    0.0,
    1.0,
    finalProgress
);

finalColor *= 1.0 - collapse * 0.92;

finalColor = mix(
    finalColor,
    vec3(0.012, 0.012, 0.012),
    collapse
);
```

But keep a tiny amount of architectural information.

At 100%:

```text
≈ 5–8%
```

of the final scene remains perceptually visible behind the overlay.

That is important.

The world hasn't disappeared.

**Access to it has become conditional.**

---

# 7. THE 100% FRAME

The final composition should become:

```text
┌─────────────────────────────────────────────┐
│                                             │
│        nearly black Sanctuary               │
│                                             │
│                  ┌──────────┐               │
│                  │          │               │
│                  │  DOSSIER │               │
│                  │          │               │
│                  └──────────┘               │
│                                             │
│          PRIVATE ACCESS REQUEST             │
│                                             │
└─────────────────────────────────────────────┘
```

But **not a card**.

The Command Overlay should behave like a **security interface occupying the architectural plane**.

---

# 8. COMMAND OVERLAY — NOT A MODAL

At 100%:

```text
z-index 999
```

but don't animate:

```text
opacity: 0 → 1
```

like a website modal.

Instead use three simultaneous transitions:

```text
WEBGL:
luminance ↓

DOM:
spatial opacity ↑

BACKGROUND:
contrast ↓
```

The overlay should feel as though the architecture has opened a **private access layer**.

---

# 9. THE OVERLAY GEOMETRY

Use an enormous DOM plane:

```text
position: fixed;
inset: 0;
```

but visually divide it into architectural regions.

For example:

```text
left 65%
    dossier information

right 35%
    acquisition interface
```

No floating glass card.

No 24px border radius.

No generic SaaS form.

Instead:

```text
thin rules
large typography
deep negative space
precise alignment
minimal controls
```

The interface should resemble a **private architectural dossier**, not a CRM.

---

# 10. THE TRANSITION

At:

```text
98%
```

start:

```text
overlay opacity = 0
canvas = 1
```

At:

```text
99%
```

begin:

```text
overlay = 0.15
canvas = 0.92
```

At:

```text
99.5%
```

```text
overlay = 0.65
canvas = 0.45
```

At:

```text
100%
```

```text
overlay = 1.0
canvas = frozen
```

But the key is that the overlay doesn't appear **on top of** the scene.

The scene appears to **recede behind it**.

---

# 11. THE FINAL SHADER

Introduce a very subtle radial compression:

```glsl
vec2 p = uv - 0.5;

float r = length(p);

float vignette =
    smoothstep(
        0.15,
        0.78,
        r
    );

float collapse =
    smoothstep(
        0.0,
        1.0,
        handoff
    );

float luminance =
    mix(
        1.0,
        0.08,
        collapse
    );

color.rgb *= luminance;

color.rgb *=
    1.0 - vignette * collapse * 0.35;
```

The edges disappear first.

The architectural focal point remains visible longest.

That creates the sensation that the world is being **compressed into the dossier**.

---

# 12. THE ACOUSTIC CLIMAX — NEITHER EXTREME

Again, reject both options as stated.

A giant Zimmer-style crescendo would feel like:

> movie trailer → sales form.

Dead silence from nowhere would feel like:

> animation ended → webpage started.

Instead:

## **Crescendo → compression → silence.**

Three phases.

```text
75–88%
Architectural resonance
        ↓
88–96%
Musical pressure increases
        ↓
96–99%
Everything compresses
        ↓
99–100%
hard acoustic vacuum
        ↓
DOSSIER
```

---

# 13. SUB-BASS CURVE

The Sanctuary starts at:

```text
42 Hz
```

Don't simply increase volume.

Move the resonance slightly downward:

```text
42 Hz → 38 Hz → 34 Hz
```

while increasing amplitude.

This gives the sensation of increasing physical mass.

Conceptually:

```text
frequency
42 ──────────╲
              ╲
38             ╲
                ╲
34               ╲________
──────────────────────────
```

The final resonance becomes almost subliminal.

---

# 14. THE FINAL SUB-BASS RELEASE

At ~98.5%:

```text
gain:
1.0
 ↓
0.7
 ↓
0.25
 ↓
0
```

over approximately:

```text
120–180 ms
```

Then:

```text
silence ≈ 250–400 ms
```

before the Command Overlay's first interaction sound.

That gap is crucial.

It creates:

> **attention vacuum.**

The user has nothing auditory competing with the acquisition decision.

---

# 15. WEB AUDIO GRAPH FOR THE CLIMAX

```text
                  ┌── 42Hz Drone
                  │
                  ├── Interior Room
                  │
                  ├── Architectural Texture
                  │
                  └── UI Micro-Detail
                           │
                           ↓
                    MASTER PRE-FADER
                           │
                           ↓
                    CLIMAX COMPRESSOR
                           │
                           ↓
                    MASTER OUTPUT
```

Then automate:

```ts
droneGain.gain.cancelScheduledValues(now);

droneGain.gain.setValueAtTime(
  currentGain,
  now
);

droneGain.gain.exponentialRampToValueAtTime(
  0.0001,
  now + 0.16
);
```

The use of an exponential ramp is preferable for a perceptually natural decay toward silence; don't use an instantaneous assignment.

---

# 16. DO NOT ADD A BIG “SUCCESS” IMPACT

Rejected.

No:

```text
BOOM
```

No cinematic trailer hit.

Instead, after the silence:

```text
subtle mechanical / tactile click
```

when the dossier becomes interactive.

Something almost like:

```text
metal latch
```

or:

```text
heavy architectural switch
```

at extremely low level.

The psychological message becomes:

> **The vault is now open.**

Not:

> Congratulations, you clicked a website.

---

# 17. AUDIO ROUTING AFTER HANDOFF

Once the Command Overlay owns the interaction:

```text
WORLD BUS
gain → -∞

UI BUS
gain → -18 dB

MASTER
normal
```

The room reverb doesn't need to disappear completely.

Keep:

```text
room tail ≈ -45 dB
```

for a few hundred milliseconds.

Then terminate it.

This preserves continuity.

---

# 18. THE FREEZE STATE

This part should be stricter than Act III.

At:

```text
progress >= 0.999
```

enter:

```ts
WORLD_STATE = "FROZEN"
```

Immediately:

```text
Lenis
   ↓
continues normally

GSAP
   ↓
DOM only

R3F
   ↓
NO RENDER LOOP
```

The canvas must become visually inert.

---

# 19. R3F `frameloop="demand"`

Your existing architecture already gives us the correct foundation.

The canvas stays:

```tsx
<Canvas frameloop="demand">
```

and the unified ticker controls invalidation.

At the handoff:

```ts
worldFrozen = true;
```

and the ticker stops calling:

```ts
invalidate();
```

Therefore:

```text
RAF
 ↓
GSAP
 ↓
Lenis
 ↓
worldFrozen?
 ↓
YES
 ↓
NO R3F invalidate
```

The DOM continues functioning normally.

---

# 20. BUT DON'T “DUMP GPU MEMORY” BLINDLY

This requires nuance.

Calling:

```ts
renderer.dispose()
```

on the entire renderer is **not** something I'd do while keeping the canvas mounted.

It can invalidate the renderer and associated resources in ways that make reactivation unnecessarily expensive.

Instead implement **tiered disposal**.

### Tier 1 — stop rendering

Immediate.

```text
0 GPU work/frame
```

### Tier 2 — dispose disposable resources

Dispose:

```text
temporary render targets
post-processing buffers
procedural simulation buffers
unused geometries
unused materials
```

### Tier 3 — keep the architectural shell

Keep:

```text
canvas
camera
core materials
essential scene graph
```

if the user may return to the cinematic world.

---

# 21. WHY KEEP THE CORE WORLD?

Because if the user closes the dossier after five minutes, we don't want:

```text
DOSSIER
 ↓
blank canvas
 ↓
rebuild entire world
 ↓
compile shaders
 ↓
re-upload textures
 ↓
wait
```

That would destroy the illusion.

Instead:

```text
DOSSIER
 ↓
world frozen
 ↓
resources retained
 ↓
close dossier
 ↓
single invalidate()
 ↓
cinematic world resumes
```

That's dramatically cleaner.

---

# 22. IF MEMORY PRESSURE IS ACTUALLY HIGH

Then introduce a second state:

```text
FROZEN
```

and:

```text
SUSPENDED
```

### Frozen

```text
rendering: OFF
core GPU resources: retained
```

### Suspended

```text
rendering: OFF
non-essential GPU resources: disposed
```

Only enter `SUSPENDED` if profiling demonstrates the retained resources are actually problematic.

Don't optimize imaginary problems.

---

# 23. THE CANVAS SHOULD ALSO STOP POST-PROCESSING

Post-processing render targets are unnecessary when the image isn't changing.

At handoff:

```text
EffectComposer
   ↓
inactive
```

Keep the final canvas bitmap.

The browser can then display the last rendered frame essentially as a static image beneath the DOM.

This is the actual performance win.

---

# 24. CSS BLUR NOW BECOMES CHEAP

This is where the Act I architectural decision pays off.

At 100%:

```text
WebGL:
FROZEN
```

Then:

```css
.command-overlay {
    backdrop-filter: blur(18px);
}
```

The expensive moving-background case no longer exists.

The user is reading a static frame.

This makes the blur a **cinematic material**, rather than a continuous GPU tax.

---

# 25. BUT DON'T BLUR THE ENTIRE CANVAS 30PX

That would destroy the architectural silhouette.

Use:

```text
8–14px
```

as the starting range.

Then darken:

```text
rgba(0,0,0,0.30–0.50)
```

over it.

The actual effect becomes:

```text
sharp frozen architecture
       ↓
controlled depth veil
       ↓
dossier typography
```

not:

```text
everything is blurry.
```

---

# 26. THE DOSSIER FORM

This is where the high-net-worth psychology matters.

Don't ask:

```text
Name
Email
Phone
Message
```

like a generic lead form.

Frame the interaction as **private access**.

For example:

```text
PRIVATE DOSSIER REQUEST

Access is reserved for qualified
private enquiries.

────────────────────────

FULL NAME

EMAIL

DIRECT CONTACT

INTEREST

[ PRIVATE RESIDENCE ]
[ INVESTMENT ]
[ SYNDICATE ]

────────────────────────

REQUEST ACCESS
```

Minimal.

Controlled.

No marketing language.

No fake scarcity.

No countdown timers.

No “ONLY 2 LEFT.”

Those immediately cheapen the entire experience.

---

# 27. THE FINAL CTA

Primary:

```text
REQUEST PRIVATE DOSSIER
```

Secondary:

```text
CONNECT WITH SYNDICATE
```

The primary action should occupy approximately:

```text
30–40% of the form's visual hierarchy
```

not half the screen.

---

# 28. SECURITY PSYCHOLOGY

The interface should visually communicate:

```text
controlled
private
deliberate
```

not:

```text
exclusive
exclusive
exclusive
```

That means typography and spacing do more work than decorative effects.

For example:

```text
PRIVATE ACCESS
────────────────────

REQUEST PRIVATE DOSSIER

[ form ]

ACCESS REQUESTED
```

The restraint is what makes the ₹50L positioning credible.

---

# 29. SUPABASE HANDOFF

The WebGL experience should know **nothing** about business attribution.

At the DOM boundary:

```text
Syndicate node
      ↓
selected partner slug
      ↓
Zustand acquisition state
      ↓
Next.js Server Action / API route
      ↓
Supabase
```

The client should send something conceptually like:

```ts
{
  syndicateSlug,
  source,
  campaign,
  sessionId,
  acquisitionIntent
}
```

The server establishes the authoritative attribution.

Do **not** trust a client-provided:

```text
ownerId
commission
conversionValue
```

Those belong on the server side.

---

# 30. ACT IV STATE MACHINE

This is what I would actually lock into the architecture:

```text
75%
│
├── SANCTUARY HOLD
│   camera almost stationary
│
├── 82%
│
├── ARCHITECTURAL APPROACH
│   camera moves toward final aperture
│
├── 90%
│
├── PRESSURE
│   drone deepens
│   image contrast increases
│
├── 96%
│
├── OPTICAL COLLAPSE
│   world begins receding
│
├── 98.5%
│
├── ACOUSTIC RELEASE
│   drone → silence
│
├── 99%
│
├── COMMAND HANDOFF
│   DOM emerges
│
└── 100%
    WORLD FROZEN
    DOSSIER ACTIVE
```

---

# 31. THE MOST IMPORTANT DETAIL: 100% MUST NOT FEEL LIKE THE END

This is subtle.

The user should not perceive:

> “The animation finished.”

They should perceive:

> “I reached the access point.”

Therefore the final DOM layer should inherit the **same spatial vocabulary**.

Same:

```text
typography
line weights
spacing
dark palette
warm accent
architectural alignment
```

Different:

```text
interaction
```

The WebGL world is the **environment**.

The Command Overlay is the **instrument panel**.

---

# 32. FINAL ARCHITECTURAL DIAGRAM

```text
                         SCROLL
                           │
                           ▼
                ┌────────────────────┐
                │   ACT IV CAMERA    │
                │                    │
                │ Sanctuary          │
                │      ↓             │
                │ Architectural      │
                │ focal point        │
                │      ↓             │
                │ Optical collapse   │
                └─────────┬──────────┘
                          │
                    99–100%
                          │
            ┌─────────────┴─────────────┐
            │                           │
            ▼                           ▼
       WEBGL WORLD                  COMMAND DOM
       Z = 0                        Z = 999
            │                           │
       FREEZE                    PRIVATE DOSSIER
            │                           │
       last frame                acquisition
            │                           │
       GPU idle                         │
                                        ▼
                                   SUPABASE
                                        │
                                        ▼
                               SYNDICATE ATTRIBUTION
```

---

# FINAL COUNCIL RULING

**Act IV is not a cinematic spectacle. It is a controlled surrender of spectacle to intent.**

The camera **does not flee the estate**.

It moves deeper.

The architecture **does not disappear suddenly**.

It contracts.

The music **does not explode**.

It builds pressure and then disappears.

The UI **does not pop up**.

It assumes control of the visual field.

The WebGL scene **does not get destroyed**.

It becomes a frozen physical memory beneath the dossier.

So the complete emotional trajectory becomes:

```text
ACT I
"I have encountered something enormous."

        ↓

ACT II
"I understand its scale."

        ↓

ACT III
"I am inside it."

        ↓

ACT IV
"This place is not asking for attention anymore."

        ↓

100%
"Access requires a decision."
```

That is the conversion mechanism I would lock.

And critically, **the ₹50L positioning comes from restraint, not from adding more effects**. The moment Act IV starts behaving like a luxury-car advertisement, a crypto landing page, or a conventional real-estate funnel, the entire 75-day technical-art investment becomes self-defeating.# PHASE 5 — SYNDICATE HUB & ZERO-TRUST LEAD VAULT

**Council ruling:** the architecture should have exactly one persistent 3D shell, one authoritative acquisition boundary, and one server-controlled attribution path.

One correction before locking this: **“lead theft impossible” is not a technically honest guarantee.** No internet system can make compromise mathematically impossible. What we *can* do is make client-side attribution tampering ineffective: the browser never chooses the authoritative partner, commission owner, audit timestamp, or dispatch destination. PostgreSQL creates the immutable identity, and the server resolves the partner and dispatches from trusted database state.

That is the architecture I would approve.

---

# 1. ROUTING TREE — THE CANVAS LIVES ABOVE THE SYNDICATE ROUTES

The most important Next.js decision is:

> **Do not put `<Canvas>` inside `/syndicate/[slug]/page.tsx`.**

It belongs in a persistent layout above the dynamic segment.

Next.js layouts persist across client navigation, while page components change; this is precisely the partial-rendering behavior we need. 

I would structure the application like this:

```text
app/
│
├── layout.tsx
│
├── (experience)/
│   ├── layout.tsx
│   │
│   ├── page.tsx
│   │
│   ├── command/
│   │   └── ...
│   │
│   └── syndicate/
│       ├── layout.tsx
│       │
│       └── [slug]/
│           └── page.tsx
│
├── api/
│   └── ...
│
└── ...
```

But I would make the **experience shell** the persistent boundary:

```tsx
// app/(experience)/layout.tsx

export default function ExperienceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <ExperienceCanvas />
      <ExperienceStateBridge />
      <main className="experience-content">
        {children}
      </main>
    </>
  )
}
```

Then:

```text
/syndicate/master-stonemason
```

and:

```text
/syndicate/bespoke-millwork
```

both remain underneath the same layout.

Therefore:

```text
Navigation
    │
    ├── page component changes
    │
    ├── URL changes
    │
    └── persistent layout remains mounted
                         │
                         ▼
                    R3F Canvas
                    NEVER UNMOUNTS
```

---

# 2. DO NOT USE `template.tsx` HERE

`template.tsx` is precisely the wrong primitive for the Canvas.

The requirement is:

```text
route changes
     ↓
content changes
     ↓
Canvas remains
```

A template is intended for a remounting boundary.

We want the opposite.

So:

```text
layout.tsx      YES
template.tsx    NO
page.tsx        NO Canvas
```

---

# 3. THE CANVAS BECOMES AN APPLICATION SHELL

I'd formalize:

```tsx
<ExperienceRuntime>
  <R3FCanvas />
  <CameraController />
  <ScrollController />
  <AudioEngine />
  <CommandOverlay />
  {children}
</ExperienceRuntime>
```

The architecture becomes:

```text
                EXPERIENCE RUNTIME
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
     R3F             Zustand          Audio
     Canvas          State            Engine
       │               │
       │               │
       └───────┬───────┘
               │
               ▼
        Route-specific
        spatial state
```

This is much cleaner than trying to make every route understand R3F.

---

# 4. ZUSTAND IS THE BRIDGE — NOT PROPS

The Server Component knows:

```text
params.slug
```

The R3F client runtime knows:

```text
camera
scene
anchors
scroll
animation
```

Don't try to directly pass a Server Component parameter into a Three.js controller.

Instead:

```text
URL
 ↓
Server Component
 ↓
validated slug
 ↓
Client boundary
 ↓
Zustand
 ↓
R3F controller
```

---

# 5. ROUTE DATA

Your Server Component:

```tsx
// app/(experience)/syndicate/[slug]/page.tsx

import { notFound } from "next/navigation";
import { getPartnerBySlug } from "@/lib/syndicate";

export default async function SyndicatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const partner = await getPartnerBySlug(slug);

  if (!partner) {
    notFound();
  }

  return (
    <SyndicateRouteBridge
      partner={partner}
    />
  );
}
```

The important thing is that `partner` is **trusted server-resolved data**, not arbitrary client input.

---

# 6. THE CLIENT BRIDGE

```tsx
"use client";

import { useEffect } from "react";
import { useSyndicateStore } from "@/state/syndicate";

export function SyndicateRouteBridge({
  partner,
}: {
  partner: {
    id: string;
    slug: string;
    anchor_key: string;
  };
}) {
  const setActivePartner = useSyndicateStore(
    s => s.setActivePartner
  );

  useEffect(() => {
    setActivePartner({
      id: partner.id,
      slug: partner.slug,
      anchorKey: partner.anchor_key,
    });

    return () => {
      setActivePartner(null);
    };
  }, [
    partner.id,
    partner.slug,
    partner.anchor_key,
    setActivePartner,
  ]);

  return null;
}
```

Now the route has no knowledge of:

```text
camera position
camera quaternion
GSAP timeline
R3F invalidate()
```

Excellent separation.

---

# 7. ZUSTAND STATE

Something like:

```ts
type SpatialTarget = {
  position: [number, number, number];
  lookAt: [number, number, number];
};

type SyndicateState = {
  activePartner: string | null;
  target: SpatialTarget | null;

  setActivePartner: (
    partner: {
      id: string;
      slug: string;
      anchorKey: string;
    } | null
  ) => void;
};
```

But here's an important architectural rule:

## Don't store the actual Three.js camera in Zustand.

Never:

```ts
camera: PerspectiveCamera
```

inside the global store.

The store contains **intent**.

R3F owns the physical camera.

---

# 8. ANCHOR REGISTRY

Create a deterministic registry:

```ts
const SYNDICATE_ANCHORS = {
  "master-stonemason": {
    position: [3.2, 0.4, -2.1],
    lookAt: [2.8, 1.0, -1.8],
  },

  "bespoke-millwork": {
    position: [-2.4, 3.1, -3.2],
    lookAt: [-2.2, 2.8, -3.5],
  },

  acoustics: {
    position: [4.5, 2.4, 1.8],
    lookAt: [4.2, 2.0, 1.5],
  },
} as const;
```

This registry belongs to the **3D application**, not the database.

The database says:

```text
anchor_key = "home-theater"
```

The scene resolves:

```text
home-theater → physical coordinates
```

This prevents your database from becoming coupled to world-space mathematics.

---

# 9. CAMERA HIJACK

The R3F controller subscribes to the store:

```tsx
function SyndicateCameraController() {
  const camera = useThree(state => state.camera);

  const target = useSyndicateStore(
    state => state.target
  );

  useFrame((_, delta) => {
    if (!target) return;

    // physical interpolation
  });

  return null;
}
```

But remember our locked unified ticker.

Therefore don't independently introduce another animation clock here.

The existing GSAP → Lenis → R3F invalidation chain remains authoritative.

---

# 10. CAMERA INTERPOLATION SHOULD BE SPRING-LIKE

Don't do:

```ts
camera.position.lerp(target, 0.1);
```

That makes the behavior dependent on frame rate.

Instead use a delta-aware exponential response:

```ts
const k = 6.5;

const alpha = 1 - Math.exp(-k * delta);

camera.position.lerp(
  targetPosition,
  alpha
);
```

This gives frame-rate-independent convergence.

For rotation, use quaternion slerp:

```ts
camera.quaternion.slerp(
  targetQuaternion,
  alpha
);
```

Now:

```text
route changes
     ↓
target changes
     ↓
camera has inertia
     ↓
R3F evaluates physical state
```

No snapping.

---

# 11. URL HYDRATION SAFETY

The Server Component should **never mutate Zustand during server rendering**.

Bad:

```tsx
// server
useSyndicateStore(...)
```

Never.

Instead:

```text
Server
  ↓
serializable partner data
  ↓
Client Bridge mounts
  ↓
useEffect()
  ↓
Zustand mutation
```

The initial HTML therefore remains deterministic.

The camera movement happens only after the client runtime exists.

No server-side Three.js object.

No hydration mismatch.

---

# 12. THE ROUTE SHOULD ALSO BE DEEP-LINKABLE

This is important.

A user can directly open:

```text
/syndicate/acoustics
```

and the experience should become:

```text
page loads
 ↓
persistent world initializes
 ↓
Sanctuary state established
 ↓
Acoustics target registered
 ↓
camera moves there
```

Not:

```text
page loads
 ↓
random camera
 ↓
hydration
 ↓
jump
```

So the experience runtime needs a deterministic initialization phase.

---

# 13. `loading.tsx` SHOULD NOT REPLACE THE CANVAS

Do not put an independent full-screen loading scene under `[slug]`.

That can produce:

```text
Canvas
↓
route loading UI
↓
route loaded
↓
DOM replacement
```

Instead the persistent experience shell owns the loading state.

The route-specific content is simply unavailable until ready.

---

# 14. THE DATABASE — TWO PUBLICLY DIFFERENT WORLDS

I would not expose `leads_vault` through the browser Data API at all.

The architecture should be:

```text
PUBLIC
syndicate_partners
     │
     ▼
browser

PRIVATE
leads_vault
lead_dispatches
audit_receipts
     │
     ▼
Edge Function / trusted backend
```

Supabase explicitly recommends RLS for exposed tables, and secret/service-role keys must never be exposed to the browser because they bypass RLS. 

---

# 15. SCHEMA — `syndicate_partners`

Here is the production-oriented version I'd lock:

```sql
create extension if not exists pgcrypto;

create table public.syndicate_partners (
    id uuid primary key
        default gen_random_uuid(),

    slug text not null unique,

    display_name text not null,

    title text not null,

    description text,

    anchor_key text not null unique,

    active boolean not null default true,

    sort_order integer not null default 0,

    created_at timestamptz not null
        default timezone('utc', now()),

    updated_at timestamptz not null
        default timezone('utc', now())
);
```

`gen_random_uuid()` gives us UUID generation in PostgreSQL.

---

# 16. DO NOT PUT PARTNER SECRETS HERE

This table should **not** contain:

```text
WhatsApp API token
phone credentials
webhook secrets
commission percentages
owner payout destination
private API credentials
```

Those belong in:

```text
Supabase secrets
```

or a properly protected private schema.

Supabase Edge Functions have server-side secrets available through environment variables, and their secret/service keys must never be placed in browser code. 

---

# 17. LEADS VAULT

Now the important table.

```sql
create table public.leads_vault (
    id uuid primary key
        default gen_random_uuid(),

    attribution_token uuid not null
        default gen_random_uuid()
        unique,

    partner_id uuid not null
        references public.syndicate_partners(id),

    partner_slug_snapshot text not null,

    full_name text not null,

    email text,

    phone text,

    enquiry_type text,

    message text,

    source text,

    landing_path text,

    user_agent_hash text,

    ip_hash text,

    created_at timestamptz not null
        default timezone('utc', now()),

    dispatched_at timestamptz,

    status text not null default 'pending'
        check (
            status in (
                'pending',
                'dispatching',
                'dispatched',
                'partial_failure',
                'failed'
            )
        )
);
```

---

# 18. WHY TWO UUIDS?

This is intentional.

```text
id
```

is the database identity.

```text
attribution_token
```

is the **external cryptographic correlation identifier**.

The browser can receive:

```text
attribution_token
```

without learning internal database relationships.

But there's an even better version.

## Do not let the browser generate it.

The browser asks:

```text
INITIATE SECURE COMMUNIQUÉ
```

The Edge Function creates:

```text
UUIDv4
```

at the moment the acquisition transaction begins.

Therefore:

```text
click
 ↓
Edge Function
 ↓
UUID generated
 ↓
DB INSERT
```

The timestamp is database-controlled, not browser-controlled.

---

# 19. MAKE THE PARTNER RESOLUTION SERVER-SIDE

The client should send:

```json
{
  "partnerSlug": "acoustics",
  "fullName": "...",
  "email": "...",
  "phone": "..."
}
```

But the server does:

```sql
select id, slug
from syndicate_partners
where slug = $1
  and active = true;
```

Then:

```text
resolvedPartner.id
```

is inserted.

The browser cannot say:

```json
{
  "partnerId": "partner-of-my-choice"
}
```

and redirect attribution.

That field simply isn't accepted.

---

# 20. SNAPSHOT THE PARTNER SLUG

This field:

```sql
partner_slug_snapshot
```

is deliberate.

Suppose six months later someone renames:

```text
acoustics
```

to:

```text
architectural-acoustics
```

Historical attribution must remain historically readable.

So the lead contains:

```text
partner_id
partner_slug_snapshot
```

The UUID identifies the partner.

The snapshot preserves the historical context.

---

# 21. RLS — LEADS ARE NOT BROWSER-READABLE

```sql
alter table public.leads_vault
enable row level security;
```

Then:

```sql
revoke all
on public.leads_vault
from anon, authenticated;
```

And don't create a browser `SELECT` policy.

The browser has:

```text
ZERO SELECT
ZERO UPDATE
ZERO DELETE
```

on the vault.

---

# 22. PARTNER TABLE RLS

This one can safely be public:

```sql
alter table public.syndicate_partners
enable row level security;

create policy "public can read active partners"
on public.syndicate_partners
for select
to anon, authenticated
using (active = true);
```

No insert/update/delete policies.

The public can discover:

```text
partner
slug
title
anchor_key
```

but cannot mutate them.

---

# 23. IMPORTANT: DON'T CREATE A SECURITY-DEFINER RPC FOR LEAD INSERTION

You could.

I wouldn't.

It unnecessarily expands your database attack surface.

The clean architecture is:

```text
Browser
 ↓
Edge Function
 ↓
trusted server client
 ↓
Postgres
```

Supabase Edge Functions are specifically designed for low-latency server-side logic and third-party integrations. 

---

# 24. EDGE FUNCTION — `initiate-communique`

The browser calls:

```text
POST /functions/v1/initiate-communique
```

with:

```json
{
  "partnerSlug": "acoustics",
  "fullName": "...",
  "email": "...",
  "phone": "...",
  "enquiryType": "private_residence",
  "message": "..."
}
```

The function:

```text
1. authenticate / rate-limit
2. validate schema
3. resolve partner
4. generate UUID
5. insert vault record
6. create immutable audit hash
7. dispatch partner message
8. dispatch owner receipt
9. update dispatch status
10. return attribution token
```

---

# 25. DON'T CALL WHATSAPP BEFORE THE DATABASE INSERT

The order is critical.

Wrong:

```text
WhatsApp
 ↓
DB
```

If WhatsApp succeeds and the database fails:

```text
lead exists externally
but no authoritative record
```

Catastrophic for attribution.

Correct:

```text
DB commit
 ↓
authoritative lead exists
 ↓
dispatch
```

The vault is the source of truth.

---

# 26. DUAL DISPATCH NEEDS A DISPATCH TABLE

Don't cram delivery information into `leads_vault`.

Create:

```sql
create table public.lead_dispatches (
    id uuid primary key
        default gen_random_uuid(),

    lead_id uuid not null
        references public.leads_vault(id),

    destination_type text not null
        check (
            destination_type in (
                'syndicate_whatsapp',
                'platform_owner_audit'
            )
        ),

    destination_ref text not null,

    status text not null default 'pending'
        check (
            status in (
                'pending',
                'sent',
                'failed'
            )
        ),

    provider_message_id text,

    payload_hash text not null,

    created_at timestamptz not null
        default timezone('utc', now()),

    sent_at timestamptz,

    error_code text,

    unique (
        lead_id,
        destination_type
    )
);
```

Now every lead has two independently auditable dispatch records.

---

# 27. IMMUTABLE AUDIT RECEIPT

Now we go one level deeper.

Create:

```sql
create table public.audit_receipts (
    id uuid primary key
        default gen_random_uuid(),

    lead_id uuid not null
        references public.leads_vault(id),

    attribution_token uuid not null,

    event_type text not null,

    event_payload_hash text not null,

    previous_receipt_hash text,

    receipt_hash text not null unique,

    created_at timestamptz not null
        default timezone('utc', now())
);
```

The receipt contains a chain:

```text
receipt N
    │
    ├── payload hash
    │
    └── previous receipt hash
             ↓
         receipt N+1
```

That's a lightweight append-only hash chain.

---

# 28. RECEIPT HASH

Conceptually:

```text
receipt_hash =
SHA256(
    lead_id
    || attribution_token
    || event_type
    || payload_hash
    || previous_receipt_hash
    || created_at
)
```

PostgreSQL can perform hashing using `pgcrypto`, or the Edge Function can generate the canonical digest.

The important part isn't merely “SHA-256.”

The important part is:

> **The receipt contains the hash of the previous receipt.**

Now modifying history becomes detectable.

---

# 29. BUT DON'T CLAIM BLOCKCHAIN IMMUTABILITY

This is important.

A sufficiently privileged database administrator can technically alter PostgreSQL data.

Therefore the stronger architecture is:

```text
Postgres audit chain
       ↓
periodic external owner receipt
```

For example, the Platform Owner receives:

```text
RECEIPT
Lead: UUID
Partner: Acoustics
Created: timestamp
Receipt Hash: SHA-256(...)
Previous Hash: SHA-256(...)
```

The owner has an external copy of the receipt.

Now the database cannot silently rewrite history without producing a mismatch.

That is actual tamper **evidence**, rather than marketing-language “immutable.”

---

# 30. THE ENCRYPTED WHATSAPP PAYLOAD

Do not send the entire raw lead object around internally.

Create a canonical payload:

```json
{
  "receipt": "uuid",
  "partner": "acoustics",
  "name": "...",
  "contact": "...",
  "intent": "private_residence",
  "timestamp": "..."
}
```

Then encrypt it before dispatch if the downstream WhatsApp integration supports encrypted payload transport.

But note:

**WhatsApp itself is not your cryptographic vault.**

The authoritative sensitive record remains in Supabase.

The WhatsApp message is merely a notification channel.

---

# 31. EDGE FUNCTION DISPATCH

Conceptually:

```ts
const lead = await createLeadTransaction(...);

const partnerPayload = encrypt({
  leadId: lead.id,
  attributionToken: lead.attribution_token,
  ...
});

const ownerPayload = {
  leadId: lead.id,
  attributionToken: lead.attribution_token,
  partnerId: lead.partner_id,
  receiptHash: lead.receiptHash,
};
```

Then:

```text
                LEAD VAULT
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
      PARTNER              OWNER
      DISPATCH             RECEIPT
          │                   │
          ▼                   ▼
      WhatsApp           immutable audit
```

---

# 32. DON'T MAKE THE USER WAIT FOR BOTH NETWORK CALLS

This is where Edge Functions matter.

The HTTP request should establish the authoritative record first.

Then dispatch.

For a low-latency experience:

```text
browser
 ↓
Edge Function
 ↓
DB transaction
 ↓
return accepted
 ↓
dispatch worker/webhook
```

Supabase Database Webhooks fire after database changes and are asynchronous through `pg_net`, so they are appropriate for kicking off external delivery without blocking the database transaction. 

---

# 33. THE BEST DISPATCH ARCHITECTURE

I would actually use:

```text
Browser
   │
   ▼
initiate-communique
   │
   ▼
Postgres transaction
   │
   ├── leads_vault
   │
   ├── dispatch rows
   │
   └── audit_receipt
   │
   ▼
COMMIT
   │
   ▼
Database Webhook
   │
   ▼
dispatch-communique
   │
   ├───────────────┐
   ▼               ▼
Partner          Owner
WhatsApp         Audit receipt
```

This separates:

**transactional truth**

from:

**network delivery.**

---

# 34. IDEMPOTENCY

This is mandatory.

Imagine the Edge Function receives:

```text
same request
same network retry
same user click
```

twice.

Without idempotency:

```text
2 leads
2 WhatsApps
2 commissions
```

Disaster.

The acquisition request therefore needs an idempotency key.

For example:

```text
client_intent_id
```

generated when the user begins the form session.

Then enforce:

```sql
unique(client_intent_id)
```

in the vault.

But the **attribution token remains server-generated**.

---

# 35. ADD IT TO THE SCHEMA

```sql
alter table public.leads_vault
add column client_intent_id uuid not null;

create unique index
leads_vault_client_intent_unique
on public.leads_vault(client_intent_id);
```

Now:

```text
same intent
 ↓
same DB row
```

instead of:

```text
duplicate lead.
```

---

# 36. SERVER-OWNED TIMESTAMPS

Never accept:

```json
{
  "createdAt": "2026..."
}
```

from the browser.

Database:

```sql
created_at timestamptz
default timezone('utc', now())
```

owns it.

Same for:

```text
dispatched_at
sent_at
receipt created_at
```

This closes an entire class of attribution manipulation.

---

# 37. WHO OWNS THE LEAD?

Not the browser.

Not the URL.

Not Zustand.

Not the Syndicate page.

The authoritative chain is:

```text
slug
 ↓
syndicate_partners.id
 ↓
leads_vault.partner_id
 ↓
audit receipt
 ↓
dispatch destination
```

The partner destination itself should be resolved from trusted server-side configuration.

---

# 38. WHAT ZUSTAND IS ALLOWED TO KNOW

Zustand can know:

```text
activePartner
activeAnchor
selectedSyndicate
UI state
```

It must **not** be the source of truth for:

```text
partner ownership
commission
lead attribution
recipient WhatsApp number
audit identity
receipt hash
```

Zustand is presentation state.

Postgres is business truth.

---

# 39. REAL-TIME WEBSOCKETS — WHERE THEY ACTUALLY BELONG

I would **not** use WebSockets for lead creation.

That's unnecessary complexity.

Use them for:

```text
owner dashboard
```

if the owner wants:

```text
NEW PRIVATE COMMUNIQUÉ
```

to appear instantly.

Architecture:

```text
lead inserted
      ↓
Supabase Realtime
      ↓
Owner dashboard
      ↓
NEW LEAD
```

The acquisition transaction itself remains HTTP/Edge Function.

This distinction matters.

---

# 40. REALTIME SECURITY

The owner dashboard subscribes only to an appropriately protected channel/table.

Never make:

```text
leads_vault
```

publicly realtime-readable.

The lead vault remains server-controlled.

Realtime is a **notification mechanism**, not an authorization mechanism.

---

# 41. FINAL DATABASE TOPOLOGY

```text
                 PUBLIC
                   │
                   ▼
        syndicate_partners
                   │
                   │
                   ▼
              Edge Function
                   │
            SERVER RESOLUTION
                   │
                   ▼
              leads_vault
                   │
          ┌────────┴─────────┐
          ▼                  ▼
  lead_dispatches      audit_receipts
          │                  │
          ▼                  ▼
      WhatsApp           Owner receipt
          │
          ▼
     Syndicate Partner
```

And:

```text
audit_receipts
      ↓
hash chain
      ↓
external owner receipt
      ↓
tamper evidence
```

---

# 42. THE COMPLETE ROUTING + 3D ARCHITECTURE

```text
app/
│
├── layout.tsx
│
├── (experience)/
│   │
│   ├── layout.tsx
│   │       │
│   │       ├── ExperienceRuntime
│   │       │      ├── R3F Canvas
│   │       │      ├── Camera Controller
│   │       │      ├── Audio Engine
│   │       │      └── Zustand
│   │       │
│   │       ├── page.tsx
│   │       │
│   │       └── syndicate/
│   │              │
│   │              └── [slug]/
│   │                     └── page.tsx
│   │
│   └── command/
│
└── api/
```

The runtime persists.

The route changes.

The camera receives a new target.

The scene does not reload.

---

# 43. THE FINAL NAVIGATION FLOW

User is looking at:

```text
/syndicate/master-stonemason
```

Then clicks:

```text
/acoustics
```

Actual behavior:

```text
Next.js
   │
   ├── Server resolves "acoustics"
   │
   ▼
Client Bridge
   │
   ▼
Zustand:
activePartner = acoustics
   │
   ▼
R3F Controller
   │
   ▼
anchor registry:
home-theater
   │
   ▼
GSAP / physical interpolation
   │
   ▼
camera moves
```

No:

```text
Canvas destroy
Canvas recreate
shader compile
texture upload
camera reset
```

That is the difference between a cinematic application and a collection of pages with a Three.js background.

---

# 44. SECURITY BOUNDARY — FINAL LOCK

The browser is trusted with:

```text
presentation
navigation
public partner metadata
user-entered lead fields
```

The browser is **not trusted** with:

```text
partner ownership
lead ID
attribution token generation
recipient destination
audit timestamp
receipt generation
dispatch authorization
commission data
database credentials
```

The Edge Function is trusted to orchestrate.

Postgres is trusted to establish state.

The audit chain proves history.

Supabase's current security model explicitly supports putting privileged server logic in Edge Functions and keeping secret keys server-side; secret keys bypass RLS and therefore must never enter client code. 

---

# COUNCIL VERDICT

### LOCKED

**Canvas persistence**

```text
Persistent `(experience)/layout.tsx`
        ↓
R3F Canvas
        ↓
never mounted beneath [slug]
```

**Route → camera**

```text
Server params
 → validated partner
 → Client Bridge
 → Zustand intent
 → R3F camera controller
 → delta-aware interpolation
```

**Lead attribution**

```text
Browser slug
     ↓
server resolves partner
     ↓
Postgres creates UUID
     ↓
lead_vault
     ↓
audit receipt
     ↓
dispatch records
```

**Dispatch**

```text
COMMIT FIRST
     ↓
Database Webhook
     ↓
Edge Function
     ├── Partner WhatsApp
     └── Platform Owner receipt
```

**Anti-theft**

```text
RLS
+
no client vault access
+
server-generated attribution token
+
server-resolved partner
+
idempotency
+
append-only audit chain
+
external owner receipt
```

**Realtime**

```text
Realtime = owner notification
NOT lead authorization
NOT lead creation
```

And one final architectural rule should be carved into the project:

> **The Syndicate route is a view into the world. It is never the owner of the world.**

That keeps the 14 partner pages from fragmenting the cinematic runtime, while the Zero-Trust boundary ensures that changing `/syndicate/acoustics` to `/syndicate/master-stonemason` in a browser cannot silently redirect the resulting lead to the wrong commercial owner.

For the Supabase implementation, the current platform documentation also supports the exact separation we're using here: RLS for exposed data, Edge Functions for privileged server-side orchestration, and Database Webhooks for asynchronous post-commit dispatch. # PHASE 6 — THE Z-AXIS COMMAND OVERLAY

**Council ruling:** this should **not** be implemented as a conventional modal.

The Command Overlay is a **second spatial layer of the application**:

```text
Z = 0       Cinematic WebGL world
Z = 999     Command/Dossier layer
Z = 1000    Persistent directory control
```

The URL remains authoritative. The overlay is simply the visual representation of a utility route while the persistent experience shell remains alive.

One important correction to the proposed implementation: **do not make Zustand the source of truth for which utility page is open.** The URL is the source of truth. Zustand owns the *transition/freeze state*. This prevents `/careers` and `overlay.open = false` from becoming contradictory states.

---

# 1. THE ROUTING ARCHITECTURE

I would use **Parallel Routes + Intercepting Routes**, but with a specific division of responsibility.

```text
app/
│
├── layout.tsx
│
├── (experience)/
│   │
│   ├── layout.tsx
│   │
│   ├── @modal/
│   │   ├── default.tsx
│   │   │
│   │   └── (.)careers/
│   │       └── page.tsx
│   │
│   ├── page.tsx
│   │
│   ├── careers/
│   │   └── page.tsx
│   │
│   ├── about/
│   │   └── page.tsx
│   │
│   ├── investment-guide/
│   │   └── page.tsx
│   │
│   ├── knowledge-center/
│   │   └── page.tsx
│   │
│   ├── contact/
│   │   └── page.tsx
│   │
│   └── ...
│
└── ...
```

The critical relationship is:

```text
                    (experience)/layout.tsx
                              │
              ┌───────────────┴───────────────┐
              │                               │
          {children}                       {@modal}
              │                               │
              ▼                               ▼
       Web/utility route               intercepted route
```

Next.js Parallel Routes allow a layout to render multiple slots simultaneously, while Intercepting Routes allow a route to be presented in a different UI context during client navigation. That combination is specifically suited to this pattern.

---

# 2. WHY BOTH `careers/page.tsx` AND `@modal/(.)careers/page.tsx` EXIST

They have different responsibilities.

### Direct navigation

User enters:

```text
https://domain.com/careers
```

The actual route is:

```text
/careers/page.tsx
```

### Cinematic navigation

User is currently at:

```text
/
```

and clicks:

```text
[ DIRECTORY ]
        ↓
CAREERS
```

The navigation is intercepted:

```text
/(current)
      ↓
/careers
      ↓
@modal/(.)careers
```

So the URL becomes:

```text
/careers
```

while the current page remains mounted underneath.

That distinction is important.

---

# 3. THE PERSISTENT EXPERIENCE LAYOUT

```tsx
// app/(experience)/layout.tsx

import { ExperienceRuntime } from "@/components/experience/ExperienceRuntime";
import { CommandOverlay } from "@/components/command/CommandOverlay";

export default function ExperienceLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <ExperienceRuntime>
      <div className="experience-root">
        <div className="webgl-layer">
          <ExperienceCanvas />
        </div>

        <main className="route-layer">
          {children}
        </main>

        <CommandOverlay>
          {modal}
        </CommandOverlay>
      </div>
    </ExperienceRuntime>
  );
}
```

The fundamental invariant:

```text
ROUTE CHANGE
    ↓
layout.tsx stays mounted
    ↓
ExperienceCanvas stays mounted
    ↓
GPU resources stay resident
```

No:

```text
Canvas destroy
↓
WebGL context destroy
↓
shader compilation
↓
texture upload
↓
Canvas recreate
```

That would completely violate the project's visual-performance architecture.

---

# 4. `default.tsx` IS IMPORTANT

The parallel slot needs a default state.

```tsx
// app/(experience)/@modal/default.tsx

export default function DefaultModal() {
  return null;
}
```

This means:

```text
no intercepted utility route
        ↓
@modal = null
```

The persistent directory button can therefore exist independently of the modal slot.

---

# 5. INTERCEPTED CAREERS ROUTE

```tsx
// app/(experience)/@modal/(.)careers/page.tsx

import CareersPage from "@/components/command/pages/CareersPage";

export default function CareersModalRoute() {
  return <CareersPage />;
}
```

And the canonical route:

```tsx
// app/(experience)/careers/page.tsx

import CareersPage from "@/components/command/pages/CareersPage";

export default function CareersRoute() {
  return <CareersPage />;
}
```

Same content.

Different routing context.

---

# 6. THE IMPORTANT PART — DON'T DUPLICATE THE HUD

The intercepted route should **not** contain:

```text
backdrop
drawer
close button
menu
blur
animation
```

It contains only:

```text
CAREERS CONTENT
```

The parent layout owns:

```text
HUD
├── navigation rail
├── content pane
├── close
└── visual treatment
```

This gives you one HUD implementation.

---

# 7. THE COMMAND OVERLAY IS A SPATIAL SHELL

The visual structure should be:

```text
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  [ DIRECTORY ]                              [ × CLOSE ]  │
│                                                          │
│  ┌────────────────┐  ┌────────────────────────────────┐ │
│  │                │  │                                │ │
│  │  COMMAND       │  │                                │ │
│  │  DIRECTORY     │  │         CONTENT                │ │
│  │                │  │                                │ │
│  │  ABOUT         │  │         CAREERS                │ │
│  │  PROJECTS      │  │                                │ │
│  │  INVESTMENT    │  │         ...                    │ │
│  │  KNOWLEDGE     │  │                                │ │
│  │  CAREERS       │  │                                │ │
│  │  CONTACT       │  │                                │ │
│  │                │  │                                │ │
│  └────────────────┘  └────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Not a centered dialog.

Not a standard drawer.

It should feel like the user has entered a **second operating layer**.

---

# 8. GRID MATHEMATICS

Use:

```css
.command-hud {
  position: fixed;
  inset: 0;
  z-index: 999;

  display: grid;
  grid-template-columns:
    minmax(240px, 0.28fr)
    minmax(0, 1fr);

  padding:
    clamp(32px, 4vw, 72px)
    clamp(32px, 5vw, 96px);
}
```

The content pane should have a strict maximum reading width:

```css
.command-content {
  max-width: 1100px;
  width: 100%;
  justify-self: center;
}
```

For long-form material:

```css
.command-reading-column {
  max-width: 720px;
}
```

The visual rule is:

> **The HUD may occupy the viewport; the typography should not.**

That negative space is doing much of the luxury work.

---

# 9. TYPOGRAPHIC GEOMETRY

Don't use giant SaaS-style headings everywhere.

Use a controlled hierarchy:

```text
MICRO LABEL
11–12px
tracking: 0.16em

SECTION TITLE
clamp(32px, 4vw, 64px)

BODY
16–18px
line-height: 1.7

METADATA
12–13px
```

The interface should feel engineered rather than decorated.

---

# 10. URL IS THE SOURCE OF TRUTH

The state model should be:

```ts
type CommandState = {
  phase:
    | "closed"
    | "opening"
    | "open"
    | "closing"
    | "frozen";

  freezeRequested: boolean;
};
```

Notice what's missing:

```text
currentPage
```

Do **not** put:

```ts
currentPage: "careers"
```

in Zustand.

Instead:

```text
URL
 ↓
Next.js router
 ↓
route content
```

Zustand controls:

```text
WebGL freeze
audio freeze
overlay transition
```

---

# 11. ZUSTAND STORE

```ts
import { create } from "zustand";

type CommandPhase =
  | "closed"
  | "opening"
  | "open"
  | "closing"
  | "frozen";

type CommandStore = {
  phase: CommandPhase;

  requestOpen: () => void;
  markFrozen: () => void;
  markOpen: () => void;
  requestClose: () => void;
  reset: () => void;
};

export const useCommandStore = create<CommandStore>((set) => ({
  phase: "closed",

  requestOpen: () =>
    set({
      phase: "opening",
    }),

  markFrozen: () =>
    set({
      phase: "frozen",
    }),

  markOpen: () =>
    set({
      phase: "open",
    }),

  requestClose: () =>
    set({
      phase: "closing",
    }),

  reset: () =>
    set({
      phase: "closed",
    }),
}));
```

---

# 12. THE FREEZE IS A STATE MACHINE

Do **not** do this:

```ts
setOverlayOpen(true);
setCanvasFrozen(true);
setBlur(true);
stopGSAP();
```

all in one React click handler.

That's how timing bugs happen.

Instead:

```text
                    CLICK
                      │
                      ▼
                  OPENING
                      │
                      ▼
             capture current frame
                      │
                      ▼
                stop ticker
                      │
                      ▼
             freeze WebGL updates
                      │
                      ▼
                  FROZEN
                      │
                      ▼
                animate HUD
                      │
                      ▼
                    OPEN
```

The visual transition and simulation transition become deterministic.

---

# 13. ONE AUTHORITATIVE FREEZE CONTROLLER

Because we already locked:

```text
GSAP
 ↓
Lenis
 ↓
R3F invalidate
```

the freeze operation should happen at the **top of that pipeline**.

Conceptually:

```ts
function freezeExperience() {
  lenis.stop();

  gsap.globalTimeline.pause();

  gsap.ticker.remove(unifiedTicker);

  setExperienceFrozen(true);
}
```

But there's one refinement:

**Don't permanently remove the ticker if other non-experience UI animation requires GSAP.**

Instead maintain a single runtime ticker:

```ts
function unifiedTicker(time: number) {
  if (experienceFrozen) return;

  lenis.raf(time * 1000);

  invalidate();
}
```

Then:

```text
GSAP ticker still exists
        │
        ▼
unifiedTicker
        │
        ├── frozen? YES → return
        │
        └── NO
             ↓
          Lenis
             ↓
          R3F invalidate
```

This preserves the **one-clock architecture** without creating a second animation system.

---

# 14. R3F FREEZE

At runtime:

```tsx
<Canvas
  frameloop="demand"
>
```

remains the configuration.

When frozen:

```text
invalidate()
      ↓
NOT CALLED
      ↓
no render requests
```

That's preferable to constantly mounting/unmounting the Canvas.

If your R3F version/runtime exposes an explicit internal advance mechanism, don't invoke it while frozen.

---

# 15. THE STATIC BACKDROP

Here's where I would modify the earlier ruling slightly.

Simply doing:

```css
backdrop-filter: blur(24px);
```

over a live WebGL canvas isn't the architecture I want.

Instead create:

```text
WebGL frame
    ↓
snapshot
    ↓
HTML image layer
    ↓
blur
    ↓
HUD
```

So after the final frame:

```text
┌───────────────────────────┐
│ WebGL Canvas              │
│ FROZEN                    │
└───────────────────────────┘
             │
             ▼
┌───────────────────────────┐
│ static snapshot           │
│ <img>                     │
└───────────────────────────┘
             │
             ▼
        CSS blur
             │
             ▼
       Command HUD
```

The actual WebGL canvas can then sit behind the snapshot.

---

# 16. IMPORTANT: SNAPSHOT WITHOUT RANDOM GPU STALLS

Don't continuously capture frames.

Only capture **once** at the freeze boundary.

And don't run:

```ts
setInterval(canvas.toDataURL)
```

or anything remotely similar.

The snapshot operation should happen exactly once:

```text
OPEN REQUEST
     ↓
next rendered frame
     ↓
capture
     ↓
stop runtime
```

For the highest-quality implementation, I'd test two approaches on the actual target hardware:

### A. Canvas capture

Simple:

```ts
canvas.toDataURL("image/webp", 0.85)
```

But WebGL framebuffer preservation must be handled correctly.

### B. Dedicated compositing render target

More deterministic:

```text
scene
 ↓
final render target
 ↓
GPU → image capture
```

The latter gives you more control but can introduce a synchronous readback cost.

For this project I'd prototype both and measure the freeze boundary rather than assuming either is free.

---

# 17. WHY THE FREEZE STUTTER IS ALLOWED ON ONE FRAME

The performance requirement should be:

```text
NORMAL EXPERIENCE
60 FPS

FREEZE TRANSITION
≤ one controlled capture/readback event

HUD READING
0 WebGL rendering
```

Trying to demand **zero GPU synchronization cost** from a screenshot/readback operation is physically unrealistic.

The correct optimization target is:

> **No recurring cost. One controlled transition cost.**

If the capture produces a 10–20 ms spike on the target hardware, we optimize that implementation rather than pretending readback has zero cost.

---

# 18. BLUR THE SNAPSHOT, NOT THE LIVE WORLD

Then:

```css
.command-backdrop {
  position: absolute;
  inset: 0;

  background-image: var(--frozen-frame);
  background-size: cover;
  background-position: center;

  filter: blur(18px);
  transform: scale(1.035);
}
```

The `scale()` prevents blur-edge exposure.

Then add an independent darkening layer:

```css
.command-veil {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
}
```

The final composition:

```text
static 3D frame
       ↓
blur
       ↓
dark veil
       ↓
glass HUD
       ↓
typography
```

No cheap white modal backdrop.

---

# 19. GLASS SHOULD BE STRUCTURAL

Don't make the entire viewport:

```css
background: rgba(...);
backdrop-filter: blur(...);
```

Instead use architectural planes.

For example:

```css
.command-sidebar {
  background: rgba(12, 14, 16, 0.62);
  border-right: 1px solid rgba(255,255,255,0.10);
}

.command-content {
  background: rgba(12, 14, 16, 0.34);
}
```

This gives:

```text
SIDEBAR
████████
████████    translucent structural plane
████████

CONTENT
░░░░░░░░
░░░░░░░░
```

rather than:

```text
giant frosted glass rectangle
```

which immediately becomes generic.

---

# 20. THE HUD ENTRANCE

The overlay shouldn't simply:

```text
opacity: 0 → 1
```

Instead use spatial displacement.

Let:

```text
u = 0 → 1
```

and:

```text
x_sidebar = -40px * (1-u)
opacity = smoothstep(0, 1, u)
```

For the content pane:

```text
x_content = +32px * (1-u)
```

And scale:

```text
scale = 0.985 + 0.015u
```

So the entire interface feels like it is entering a controlled coordinate system.

GSAP:

```ts
gsap.timeline({
  defaults: {
    duration: 0.9,
    ease: "power4.out",
  },
});
```

No elastic easing.

No bounce.

No springy SaaS UI.

---

# 21. DIRECTORY → CONTENT TRANSITION

The master directory stays permanently mounted.

Only the content pane changes.

Therefore:

```text
INVESTMENT GUIDE
      │
      │ click CONTACT
      ▼
URL → /contact
      │
      ▼
content pane transition
```

The sidebar doesn't disappear.

The HUD doesn't close.

The WebGL world doesn't resume.

The experience remains frozen.

---

# 22. CONTENT PANE AS A ROUTING SLOT

Conceptually:

```tsx
<div className="command-hud">

  <CommandDirectory />

  <section className="command-content">
    {modal}
  </section>

</div>
```

The `modal` parallel route is the dynamic content surface.

This is the key architectural trick.

---

# 23. NO PAGE RELOAD

Clicking:

```text
CONTACT
```

should perform:

```ts
router.push("/contact");
```

not:

```ts
window.location.href = "/contact";
```

The App Router changes the route while preserving the persistent layout.

Therefore:

```text
Canvas
Audio engine
Command shell
Directory

all remain mounted.
```

Only:

```text
content route
```

changes.

---

# 24. ACTIVE DIRECTORY ITEM

The sidebar should derive its state from:

```ts
usePathname()
```

not Zustand.

Example:

```tsx
const pathname = usePathname();

const active =
  pathname === "/investment-guide";
```

Therefore browser refreshes, deep links, history navigation and client navigation all remain consistent.

---

# 25. BACK BUTTON BEHAVIOR

This is another reason URL authority matters.

If the user goes:

```text
/
 ↓
/investment-guide
 ↓
/contact
```

browser back gives:

```text
/contact
 ↓
/investment-guide
```

The HUD remains open.

Another back:

```text
/investment-guide
 ↓
/
```

Now the overlay closes.

This feels natural because browser history is actually controlling the dossier.

---

# 26. DIRECT `/CAREERS` NAVIGATION

Direct navigation:

```text
domain.com/careers
```

still loads:

```text
root layout
    ↓
experience layout
    ↓
Canvas
    ↓
careers route
```

The Canvas therefore survives because it is above the route page.

Then the route-shell detects:

```text
pathname !== "/"
```

and the command layer presents the utility page.

This is where I'd make one additional architectural distinction:

```text
intercepted navigation
      ↓
true modal route

hard navigation
      ↓
same CommandShell
      ↓
utility page rendered as its content
```

The user sees the same visual result.

The underlying Next.js rendering context differs.

---

# 27. DYNAMIC PAYLOAD SPLITTING

This is critical.

Do **not** do:

```tsx
import KnowledgeCenter from
  "@/components/command/pages/KnowledgeCenter";
```

inside the global client HUD if that component drags massive client-side dependencies into the bundle.

The utility content should be **Server Components wherever possible**.

For example:

```tsx
// app/(experience)/knowledge-center/page.tsx

import { KnowledgeCenter } from "@/components/command/pages/KnowledgeCenter";

export default async function KnowledgeCenterRoute() {
  const articles = await getKnowledgeArticles();

  return (
    <KnowledgeCenter
      articles={articles}
    />
  );
}
```

No `"use client"`.

The browser receives rendered HTML/RSC payload rather than shipping the entire knowledge system as client JavaScript.

---

# 28. CLIENT COMPONENTS ONLY WHERE INTERACTION EXISTS

For example:

```text
KnowledgeCenter
│
├── ArticleList       Server
├── Article           Server
├── Image             Server
│
└── SearchFilter      Client
```

Not:

```text
KnowledgeCenter
   ↓
"use client"
   ↓
2,000 lines of everything
```

That distinction will matter enormously.

---

# 29. LAZY-LOAD HEAVY INTERACTIVE PIECES

If the Investment Guide contains an interactive calculator:

```tsx
const InvestmentCalculator =
  dynamic(
    () => import("./InvestmentCalculator"),
    {
      ssr: false,
      loading: () => <CalculatorPlaceholder />,
    }
  );
```

But only use `dynamic()` for actual client-heavy modules.

Don't blindly dynamic-import every paragraph of text.

Server Components already solve the bulk of the payload problem.

---

# 30. IMAGES

For large content:

```tsx
import Image from "next/image";
```

Use:

```text
priority
```

only for genuinely above-the-fold images.

Everything below the initial reading region should lazy-load.

The user opening:

```text
/careers
```

shouldn't download:

```text
all 15 utility page images
```

---

# 31. KNOWLEDGE CENTER ARCHITECTURE

I'd structure:

```text
knowledge-center/
│
├── page.tsx
│
├── [article]/
│   └── page.tsx
│
└── loading.tsx
```

Then:

```text
Knowledge Center
       ↓
article index
       ↓
user selects article
       ↓
/knowledge-center/[article]
```

This means a 200-page knowledge repository doesn't become a single giant DOM tree.

---

# 32. INVESTMENT GUIDE

Likewise:

```text
investment-guide/
│
├── page.tsx
├── [topic]/
│   └── page.tsx
└── loading.tsx
```

Now:

```text
INVESTMENT GUIDE
      │
      ├── Land
      ├── Development
      ├── NRI
      ├── Legal
      └── Due Diligence
```

each becomes independently addressable and streamable.

---

# 33. LOADING STATE SHOULD BE TYPOGRAPHIC

Don't use:

```text
████████████
████████
spinner
```

Instead:

```text
INVESTMENT GUIDE

LOADING DOSSIER
──────────────
```

with a restrained progress line.

This maintains the cinematic language.

---

# 34. THE FULL COMMAND STATE MACHINE

```text
                 CLOSED
                    │
              DIRECTORY CLICK
                    │
                    ▼
                 OPENING
                    │
             capture frame
                    │
             freeze runtime
                    │
                    ▼
                 FROZEN
                    │
             animate HUD
                    │
                    ▼
                   OPEN
                    │
       ┌────────────┴────────────┐
       │                         │
   route change              CLOSE
       │                         │
       ▼                         ▼
   OPEN / same              CLOSING
       │                         │
       │                   restore runtime
       │                         │
       │                         ▼
       │                      CLOSED
       │
       └─────────────────────────
```

---

# 35. CLOSE BEHAVIOR

Closing shouldn't destroy the world.

It should reverse the transition:

```text
OPEN
 ↓
HUD exits
 ↓
snapshot removed
 ↓
GSAP runtime resumes
 ↓
Lenis resumes
 ↓
R3F invalidated once
 ↓
live world continues
```

The order matters.

Don't resume WebGL first and then animate the HUD away.

Otherwise the background starts moving behind a closing interface.

---

# 36. RESUME SEQUENCE

```ts
function resumeExperience() {
  removeFrozenBackdrop();

  experienceStore.setState({
    frozen: false,
  });

  lenis.start();

  gsap.ticker.add(unifiedTicker);

  invalidate();
}
```

If GSAP remains globally registered, simply switch:

```ts
experienceFrozen = false;
```

and allow the unified ticker to resume.

---

# 37. AUDIO MUST FREEZE TOO

The visual freeze is incomplete if the audio continues.

The command state should therefore control:

```text
WebGL
Lenis
GSAP experience clock
audio spatial simulation
```

When the HUD opens:

```text
42Hz interior drone
       ↓
gain envelope
       ↓
-∞ / near silence
```

or hold an extremely low-level room bed.

Don't abruptly kill the audio buffer.

Use:

```text
20–50ms
```

gain ramp.

The psychological result:

```text
world stops
sound recedes
dossier remains
```

---

# 38. THE HIGH-NET-WORTH PSYCHOLOGY

The mistake would be making the directory feel like:

> “Here are our website pages.”

Instead:

```text
DIRECTORY

THE ESTATE
THE ARCHITECTURE
THE SYNDICATE
THE INVESTMENT
THE KNOWLEDGE
THE COMPANY
THE CONTACT
```

The language should frame utility as **access to information**, not navigation.

The user isn't “opening a menu.”

They're accessing the **private dossier system**.

---

# 39. THE VISUAL HIERARCHY

At 100%:

```text
                frozen estate
                     ↓
              darkened / blurred
                     ↓

       ┌───────────────────────────────┐
       │ DIRECTORY                     │
       │                               │
       │ 01 THE ESTATE                 │
       │ 02 THE SYNDICATE              │
       │ 03 INVESTMENT                 │
       │ 04 KNOWLEDGE                  │
       │ 05 COMPANY                    │
       │ 06 CONTACT                    │
       │                               │
       │────────────────────────────── │
       │                               │
       │  PRIVATE DOSSIER              │
       │                               │
       │  INVESTMENT GUIDE             │
       │                               │
       │  ...                          │
       └───────────────────────────────┘
```

No cards.

No shadows everywhere.

No rounded SaaS containers.

No giant hamburger menu.

No gradient blobs.

---

# 40. FINAL ARCHITECTURE

The complete Phase 6 system becomes:

```text
                        NEXT.JS APP ROUTER
                              │
                              ▼
                   persistent experience layout
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
          R3F Canvas       @modal            Audio
             │                │
             │                ▼
             │         Command Shell
             │                │
             │        ┌───────┴────────┐
             │        │                │
             │        ▼                ▼
             │     Directory       Content
             │                         │
             │                         ▼
             │                    Server Route
             │                         │
             │                 ┌───────┴───────┐
             │                 │               │
             │              Server          Client
             │              content         islands
             │
             ▼
       Unified Runtime
             │
       GSAP → Lenis → R3F
             │
             ▼
       FREEZE CONTROLLER
             │
       ┌─────┼─────────┐
       ▼     ▼         ▼
      R3F   Lenis    Audio
       │
       ▼
   static snapshot
       │
       ▼
   CSS treatment
       │
       ▼
   Z = 999 HUD
```

## Final Council verdict

**Use Parallel Routes + Intercepting Routes.**  
`layout.tsx` owns the persistent experience. `@modal` owns intercepted utility content. `default.tsx` returns nothing.

**URL owns navigation.**  
Zustand owns only the temporal state of the experience.

**Freeze the simulation, not the application.**  
Stop Lenis advancement and R3F invalidation through the existing unified ticker. Capture exactly one backdrop frame at the transition boundary, then operate the HUD against that static image.

**Keep the Canvas mounted.**  
Never tear down the WebGL runtime merely because `/investment-guide` was opened.

**Keep the HUD shell mounted.**  
Only its content route changes. `/investment-guide → /contact` should feel like changing dossier chapters, not opening and closing websites.

**Keep heavy content server-side.**  
Server Components handle the text and imagery; client components are isolated to genuinely interactive islands. Dynamic imports are reserved for expensive client functionality.

And the most important invariant for the entire 75-day build:

> **The Command Overlay is not a modal sitting above the website. It is the website's second coordinate system.**

The WebGL estate is the **world**.  
The Command Overlay is the **instrument panel**.  
The URL is the **navigation state**.  
Zustand is the **temporal controller**.  
Supabase is the **commercial truth**.

That keeps the entire ₹50L experience architecturally coherent rather than allowing the 15 corporate pages to collapse it back into a conventional website.# PHASE 7 — THE EPILOGUE

**Council ruling:** the legal/compliance layer must be **structurally invisible during the cinematic narrative and immediately authoritative when accessed**.

The mistake would be treating legal pages as an afterthought appended to the bottom of the homepage.

The correct model is:

```text
                    THE MONOLITH
                         │
             ┌───────────┴───────────┐
             │                       │
       CINEMATIC WORLD          COMMAND SYSTEM
             │                       │
          Acts I–IV              Directory
                                     │
                          ┌──────────┴──────────┐
                          │                     │
                       BUSINESS              LEGAL
                       PAGES                  PAGES
```

Legal information becomes another **dossier class** inside the Command System.

---

# 1. THE FOOTER ANTI-PATTERN

## Verdict: absolutely no traditional footer

Do **not** create:

```text
Hero
↓
Act I
↓
Act II
↓
Act III
↓
Act IV
↓
300px footer
```

That destroys the final composition.

The cinematic track should terminate exactly where the acquisition mechanism terminates.

Instead, establish a **Legal Perimeter**.

```text
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                                                         │
│                    THE ESTATE                           │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│  PRIVACY · TERMS · COOKIES                © 2026       │
└─────────────────────────────────────────────────────────┘
```

But even that should **not** permanently occupy the screen during Acts I–IV.

---

# 2. TWO-LEVEL LEGAL ACCESS

There should be two access mechanisms.

### Level 1 — Command Directory

Primary:

```text
DIRECTORY
│
├── THE ESTATE
├── THE SYNDICATE
├── INVESTMENT
├── KNOWLEDGE
├── COMPANY
├── CONTACT
│
└── LEGAL
    ├── Privacy Policy
    ├── Terms & Conditions
    ├── Cookie Policy
    ├── Refund & Cancellation
    └── Sitemap
```

This is the **canonical interface**.

### Level 2 — Micro Legal Rail

At the appropriate end-state of the experience, expose an extremely restrained legal rail:

```text
PRIVACY   TERMS   COOKIES   REFUNDS
```

Something around:

```css
font-size: 10px;
letter-spacing: 0.14em;
```

No giant footer.

No social-media wall.

No newsletter.

No “Subscribe Now”.

---

# 3. WHERE THE MICRO RAIL LIVES

I would **not permanently pin it over the cinematic experience**.

Instead:

```text
Acts I–III
    ↓
NO FOOTER

Act IV
    ↓
NO FOOTER

100% / acquisition state
    ↓
legal perimeter becomes available
```

That preserves the psychological progression:

```text
DISCOVER
   ↓
UNDERSTAND
   ↓
TRUST
   ↓
DESIRE
   ↓
ACQUIRE
```

The legal layer doesn't interrupt discovery.

---

# 4. ROUTING — REUSE PHASE 6

Yes.

The legal pages should use the **same Command Overlay architecture**.

Do not create a second modal system.

```text
/careers
/investment-guide
/contact

/privacy
/terms
/cookies
/refund-cancellation
/sitemap
```

All should enter the same command coordinate system.

Conceptually:

```text
                     /privacy
                        │
                        ▼
               Next.js App Router
                        │
                        ▼
                 Experience Layout
                        │
              ┌─────────┴─────────┐
              │                   │
          Canvas              @modal
              │                   │
          FROZEN            Legal Content
```

This gives the entire application one interaction grammar.

---

# 5. THE ROUTING TREE

I'd formalize Phase 7 as:

```text
app/
│
├── layout.tsx
│
├── (experience)/
│   │
│   ├── layout.tsx
│   │
│   ├── @modal/
│   │   │
│   │   ├── default.tsx
│   │   │
│   │   ├── (.)privacy/
│   │   │   └── page.tsx
│   │   │
│   │   ├── (.)terms/
│   │   │   └── page.tsx
│   │   │
│   │   ├── (.)cookies/
│   │   │   └── page.tsx
│   │   │
│   │   ├── (.)refund-cancellation/
│   │   │   └── page.tsx
│   │   │
│   │   └── (.)sitemap/
│   │       └── page.tsx
│   │
│   ├── privacy/
│   │   └── page.tsx
│   │
│   ├── terms/
│   │   └── page.tsx
│   │
│   ├── cookies/
│   │   └── page.tsx
│   │
│   ├── refund-cancellation/
│   │   └── page.tsx
│   │
│   └── sitemap/
│       └── page.tsx
│
└── not-found.tsx
```

Same content component, two rendering contexts.

---

# 6. LEGAL DOCUMENTS SHOULD NOT LOOK LIKE THE MAIN WEBSITE

The HUD shell stays consistent.

The **content geometry changes**.

For legal material:

```text
┌──────────────┬─────────────────────────────────────┐
│ LEGAL        │                                     │
│              │ PRIVACY POLICY                      │
│ PRIVACY      │                                     │
│ TERMS        │ Effective: 01 NOV 2026              │
│ COOKIES      │                                     │
│ REFUNDS      │ ───────────────────────────────     │
│              │                                     │
│              │ 1. INTRODUCTION                     │
│              │                                     │
│              │ Text...                             │
│              │                                     │
│              │ 2. INFORMATION WE COLLECT           │
│              │                                     │
│              │ Text...                             │
└──────────────┴─────────────────────────────────────┘
```

Use:

```text
sidebar = navigation
content = reading surface
```

not:

```text
glass card
    ↓
legal document
    ↓
another glass card
```

---

# 7. LEGAL TYPOGRAPHY

Legal text needs readability, not cinematic typography.

Use two distinct typographic systems:

### Interface

```text
uppercase
tight
tracked
small
architectural
```

### Legal body

```text
16–18px
1.65–1.8 line-height
720px max-width
normal capitalization
```

The cinematic aesthetic should govern the **environment**, not make a 14-page privacy policy difficult to read.

---

# 8. LEGAL CONTENT SHOULD BE SERVER-RENDERED

These documents are ideal Server Components.

```tsx
export default async function PrivacyPage() {
  const document = await getLegalDocument("privacy");

  return (
    <LegalDocument
      title={document.title}
      effectiveDate={document.effectiveDate}
      sections={document.sections}
    />
  );
}
```

No need to turn a 10,000-word document into a giant client component.

The browser gets the content.

The WebGL system remains completely isolated.

---

# 9. SEO IS SEPARATE FROM PRESENTATION

This is important.

The legal pages should still be **real URLs**:

```text
/privacy
/terms
/cookies
/refund-cancellation
/sitemap
```

They should have proper metadata.

For example:

```tsx
export const metadata = {
  title: "Privacy Policy | The Monolith",
  robots: {
    index: true,
    follow: true,
  },
};
```

The cinematic overlay is presentation.

The URL remains a normal web document.

---

# 10. COOKIE CLEARANCE — DON'T CALL IT A POPUP

The visual language should be:

```text
SECURITY CLEARANCE
──────────────────

THIS ESTATE USES DIGITAL STORAGE
TO MAINTAIN ESSENTIAL OPERATIONS.

OPTIONAL ANALYTICS & PREFERENCE
SYSTEMS REQUIRE YOUR AUTHORIZATION.

[ AUTHORIZE OPTIONAL SYSTEMS ]

[ ESSENTIAL ONLY ]

[ REVIEW POLICY ]
```

That is much closer to the established visual vocabulary.

But there is an important compliance distinction:

**Do not use the aesthetic to obscure the actual choice.**

Users need clear information about what is being accepted/rejected, and consent must be handled according to the jurisdictions applicable to the site. Essential/strictly necessary technologies may be treated differently from optional analytics/advertising technologies. The exact legal implementation should be reviewed against the client's applicable requirements rather than assuming that a visually elegant consent screen is automatically compliant.

---

# 11. NO PRE-CHECKED CONSENT

The system should never behave like:

```text
[✓] ACCEPT EVERYTHING
```

with rejection hidden somewhere.

Instead:

```text
ESSENTIAL
─────────
Required for operation
LOCKED / ALWAYS ACTIVE

ANALYTICS
─────────
Optional
[ OFF ]

MARKETING
─────────
Optional
[ OFF ]
```

Then:

```text
[ SAVE SELECTION ]
```

The aesthetic can be severe.

The consent mechanism must remain honest.

---

# 12. COOKIE STATE MACHINE

Don't scatter cookie checks through the application.

Create one consent state:

```ts
type ConsentState = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  initialized: boolean;
};
```

Flow:

```text
FIRST VISIT
    │
    ▼
NO CONSENT RECORD
    │
    ▼
CLEARANCE PANEL
    │
 ┌──┼───────────────┐
 │  │               │
ALL ESSENTIAL    CUSTOM
 │                  │
 ▼                  ▼
save             preferences
 │                  │
 └────────┬─────────┘
          ▼
     CONSENT STATE
          │
          ▼
       persist
```

---

# 13. CRITICAL SECURITY RULE

Never load optional tracking systems **before** the appropriate consent decision.

Bad:

```text
page loads
 ↓
analytics initializes
 ↓
cookie panel appears
```

Correct:

```text
page loads
 ↓
essential systems only
 ↓
consent state evaluated
 ↓
optional systems initialize only if permitted
```

This should be enforced architecturally, not just through UI.

---

# 14. CONSENT UI ANIMATION

The clearance panel shouldn't bounce in.

Use a controlled terminal-like emergence:

```text
opacity: 0 → 1
y: 16px → 0
clip-path:
inset(0 0 100% 0)
→
inset(0)
```

Duration:

```text
~700–900ms
```

with:

```text
power3.out
```

The background remains frozen if the panel appears from the Command Overlay.

---

# 15. SHOULD COOKIE CONSENT FREEZE THE WORLD?

**Yes if it is presented as part of the Command layer.**

But there is a distinction:

### First visit

If consent is required before optional systems activate, the panel can appear as a restrained **system initialization layer**.

### User voluntarily opens Cookie Settings later

Use the Command Overlay and freeze the world.

Therefore:

```text
initial clearance
    ↓
system initialization

later cookie settings
    ↓
Command Overlay
    ↓
freeze
```

No duplicate UI paradigm.

---

# 16. THE 404 — BRUTALIST DOM, NOT A SECOND WEBGL EXPERIENCE

## Council ruling: DOM-only.

Do **not** create:

```text
404
 ↓
initialize WebGL
 ↓
load shaders
 ↓
load textures
 ↓
initialize R3F
```

A 404 is fundamentally a failure path.

It should have the **lowest possible initialization cost**.

The cinematic 3D experience has already earned its complexity.

The error state should communicate:

> Something is missing. The system remains in control.

---

# 17. `not-found.tsx`

At the application level:

```tsx
// app/not-found.tsx

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found__signal">
        SIGNAL LOST
      </div>

      <div className="not-found__code">
        404
      </div>

      <div className="not-found__instruction">
        RETURN TO APEX
      </div>

      <Link href="/">
        [ RETURN ]
      </Link>
    </main>
  );
}
```

---

# 18. THE VISUAL

Pitch black.

Nothing else.

Something like:

```text
────────────────────────────────────────────────────────

                     SIGNAL LOST

                         404

                    RETURN TO APEX

                       [ ENTER ]

────────────────────────────────────────────────────────
```

Typography does the work.

No particle field.

No spinning cube.

No glitch animation.

No stock error illustration.

No red neon hacker nonsense.

---

# 19. ONE MICRO-EASTER-EGG

You *can* add one cinematic element without creating WebGL.

Use a DOM radial gradient:

```css
.not-found::before {
  content: "";
  position: fixed;
  width: 240px;
  height: 240px;

  background:
    radial-gradient(
      circle,
      rgba(160, 30, 20, 0.18),
      transparent 65%
    );

  transform:
    translate(
      calc(100vw - 180px),
      100px
    );
}
```

This becomes a distant **single red practical**.

But it's CSS.

Therefore:

```text
GPU scene initialization = 0
```

The user perceives a continuation of the cinematic world without actually loading it.

---

# 20. 404 ANIMATION

Extremely restrained:

```text
SIGNAL LOST
    ↓
~300ms
    ↓
404
    ↓
~500ms
    ↓
RETURN TO APEX
```

No infinite animation.

The page becomes static.

This matters because a failure page should not consume resources while somebody decides where to go.

---

# 21. THE `RETURN TO APEX` ACTION

Use:

```tsx
<Link href="/">
  RETURN TO APEX
</Link>
```

not:

```ts
window.location.reload();
```

If the user came from the cinematic experience and the browser can perform a client transition, the persistent shell can be restored normally.

---

# 22. ERROR BOUNDARIES

I'd also establish:

```text
app/
├── error.tsx
├── global-error.tsx
└── not-found.tsx
```

They have different jobs.

### `not-found.tsx`

```text
valid application
+
invalid resource/route
```

### `error.tsx`

```text
runtime failure inside a route segment
```

### `global-error.tsx`

```text
root-level catastrophic rendering failure
```

The latter two should be **DOM-only fallback interfaces**.

Do not depend on the WebGL runtime to render the page that appears when the WebGL/runtime architecture itself has failed.

That would be circular fault handling.

---

# 23. ERROR DESIGN

`error.tsx`:

```text
SYSTEM INTERRUPTION

THE REQUESTED EXPERIENCE
COULD NOT BE RESOLVED.

[ RETURN TO APEX ]
```

No stack traces.

No technical error messages.

No:

```text
TypeError: Cannot read properties of undefined...
```

Those belong in telemetry, not the client's user-facing experience.

---

# 24. SITEMAP — SPECIAL CASE

The visual `/sitemap` page can live in the Command Overlay.

But the **machine-readable sitemap** should be separate:

```text
/sitemap.xml
```

These are different things.

```text
/sitemap
    ↓
human-facing navigation dossier

/sitemap.xml
    ↓
crawler-facing XML
```

Don't confuse them.

---

# 25. LEGAL NAVIGATION SHOULD BE UNIVERSAL

The legal links should be accessible from:

```text
Command Directory
       +
Acquisition/Dossier layer
       +
404/error states
```

This means someone doesn't have to reconstruct the entire cinematic sequence merely to find Privacy Policy.

That is both better UX and better accessibility.

---

# 26. ACCESSIBILITY OVERRIDES CINEMATIC EFFECT

This is one area where I would explicitly reject the aesthetic mandate if necessary.

The Command Overlay needs:

```text
semantic headings
keyboard navigation
visible focus
Escape behavior
screen-reader labels
logical tab order
sufficient contrast
```

The cinematic experience cannot be allowed to turn the site into a visual-only application.

For example:

```text
ESC
```

should close the Command Overlay.

```text
TAB
```

must move through meaningful controls.

And:

```text
ENTER
```

must activate the focused action.

---

# 27. THE FINAL SYSTEM

Phase 7 therefore becomes:

```text
                       WEB EXPERIENCE
                              │
             ┌────────────────┼────────────────┐
             │                │                │
          ACT I-IV       COMMAND HUD       ERROR LAYER
             │                │                │
             │                │                ├── 404
             │                │                ├── error
             │                │                └── global-error
             │                │
             │                ├── Business
             │                ├── Syndicate
             │                └── Legal
             │                     │
             │                     ├── Privacy
             │                     ├── Terms
             │                     ├── Cookies
             │                     ├── Refunds
             │                     └── Sitemap
             │
             ▼
        100% STANDOFF
             │
             ▼
      ACQUISITION DOSSIER
             │
             ▼
       LEGAL PERIMETER
```

---

# FINAL COUNCIL RULING

### 1. Footer

**Rejected.**

No 300px footer. No conventional website architecture.

Use:

```text
Command Directory → Legal
```

plus a microscopic legal rail only where contextually appropriate.

### 2. Legal routing

**Reuse Phase 6 completely.**

Same:

```text
Parallel Routes
+
Intercepting Routes
+
persistent layout
+
frozen WebGL
+
Z=999 Command HUD
```

Legal content simply gets a stricter reading geometry.

### 3. Cookie clearance

**Treat it as a security decision, not marketing UI.**

But don't let the aesthetic obscure consent. Essential and optional technologies must be clearly distinguished, choices must be meaningful, and optional systems should not initialize before the applicable consent decision.

### 4. 404

**DOM-only.**

```text
SIGNAL LOST.
404.
RETURN TO APEX.
```

A single CSS radial light can imply continuity with the cinematic world, but **zero R3F initialization**.

---

The final architectural principle is:

> **The cinematic world should never be forced to explain its own infrastructure.**

The estate remains monolithic.

The Command layer handles information.

The legal layer handles accountability.

The error layer handles failure.

And none of those systems should ever force the core cinematic runtime to become a conventional website.