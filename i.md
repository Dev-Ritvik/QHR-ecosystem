Reading the existing capability probe so I wire the real API rather than inventing one:

Now the heartbeat material — the shader that makes the glow *rise* rather than flash:

Now wiring the villa, tier-aware bloom, and cinematic lighting into the canvas — keeping the probe and persistence untouched:

Now the imports, the tier resolution, and passing quality through:

API changed in postprocessing 2.19 (`disableNormalPass` → `enableNormalPass`):

Now a capture spec that photographs the heartbeat at its peak and measures the bloom cost:

All three passed — 165fps with villa + heartbeat + bloom, and the low tier doesn't crash. Looking at the money shot:

**Honest assessment: the metrics pass but the image does not.** 165fps, GEN 1, no crash — but that render is not at the bar. It reads muddy and flat, the villa is half-occluded by the panel, and there's a stray glowing blob. Let me diagnose properly rather than ship it.

Four concrete faults, one of which is a real bug:

1. **The fog is hazing the villa.** `fog near=6` with the camera at z≈6.2 means fog starts biting at the villa's front face — that's the exact "foggy glow" failure mode the brief warns about, and it's washing everything.
2. **No environment map.** `MeshPhysicalMaterial` clearcoat/metalness need something to *reflect*; with none, glass reads as dull plastic and copper as brown paint.
3. **Composition** — the villa sits behind the DOM panel.
4. The copper point light reads as a **stray UFO flare** on the floor.

Fixing all four:

Now composition and material tier — moving the villa out from behind the panel, and enabling transmission on medium given the 165fps headroom:

Worse, and I can see why: the environment is flooding the scene (the metallic floor is now mirroring a bright sky), and the emissive core reads as a muddy rectangle through the glass rather than light. The "core inside glass" approach is fighting me. Switching to the architecture's actual prescription — patching emissive into the glass material itself via `onBeforeCompile`, so the glass *is* what glows:

Now toning the environment down — it's a dark, low-key scene, and the metallic floor was mirroring a bright sky:

The heartbeat is completely absent — and I know why. Verifying rather than assuming:

Confirmed — three 0.173 uses `opaque_fragment`; my `output_fragment` anchor was renamed in r152, so `.replace()` silently no-oped and injected nothing. That's the entire missing heartbeat. Fixing it **and** adding an assertion so a silent shader-patch failure can never recur:

Progress — the injection works now, but the wave isn't *rising*: it's washing the whole mass uniformly. The cause is that `position` is **per-mesh local space**, so each box measures the wave against its own centre rather than the villa's full height. Switching to world-space Y:

The wave now genuinely rises — it's caught at the roofline, blooming copper against a void that stays properly dark. Two final refinements: the peak is blowing to white rather than staying copper, and the money shot wants mid-rise:

All the reported checks passed but the run exited 255 — one test failed without printing. Getting the detail:

All 6 pass (the 255 was a transient flake — FPS dipped during parallel runs). Final money shot:

**Step 3 mechanics are done and verified — 6/6 green. The artistry is a credible foundation, not yet the vertex3d bar.** I'd rather say that plainly than declare victory on a screenshot you'd have to squint at.

**Verified headed:** `PERSISTENCE: ctx MLYSMZ → MLYSMZ → MLYSMZ | gen 1` (Step 2 intact, no regression) · `FPS 162–165` with villa + heartbeat + bloom, rAF and the in-scene probe agreeing · `LOW TIER: no crash` · NO-JS HTML still 23,193 bytes. Money shot captured mid-ascent, plus a rest frame for comparison.

**Three real bugs, all of which failed silently:**

1. **`#include <output_fragment>` was renamed `opaque_fragment` in three r152.** My `.replace()` matched nothing, so the heartbeat never rendered — no error, no warning, just a dark villa. This is the single reason the first two captures had no pulse. Fixed, and the patch now **asserts loudly** if the anchor ever disappears again.
2. **The wave was keyed to object space.** `position` is measured from each box's own centre, so every volume lit *simultaneously* instead of the wave travelling. Switching to `modelMatrix` world-space Y is what makes the glow actually rise through the massing.
3. **Fog was hazing the subject.** `near=6` with the camera at z≈6.4 started fog at the villa's front face — precisely the "foggy bloom" failure mode you warned about. Now 16→44.

**Choices, stated as asked:** frosted glass is real `transmission` on high **and** medium (three renders one extra reduced-res pass for *all* transmissive materials, and 165fps left ample headroom), with a cheap rough-translucent fallback on low. Bloom is **threshold-selective**, not `SelectiveBloom` — one pass, no second render, `luminanceThreshold 1.0`, with the Canvas `flat` and ToneMapping as the final effect so HDR emissive blooms *before* compression. The void stays black and the panel stays crisp, which was the point.

Also corrected mid-flight: the environment was flooding the frame (the metallic floor mirrored a bright sky and read as a blue lake), a copper pointLight bloomed into a stray UFO flare, and intensity 3.0 clipped past ACES's shoulder to white. The environment is built from drei `<Lightformer>` children rather than an HDRI preset — **presets fetch from a CDN your CSP blocks**.

**What's honestly still missing before this is demo-grade:** the glass reads as a lightbox rather than having real depth and edge fresnel; the massing is still primitive boxes without the proportional refinement that sells "architecture"; and the floor needs the actual planar reflection (§5.4's high-tier upgrade) to read as black glass rather than dark plane. Those are three focused iterations, not a rebuild — the hard parts (persistent canvas, HDR-selective bloom, a rising wave that doesn't allocate) are working.

One thing I should flag: I spent a lot of this turn iterating visually and converged slower than I'd like. If you want the next pass to land faster, the highest-leverage single change is the floor reflection — it does more for perceived quality than anything else on that list.