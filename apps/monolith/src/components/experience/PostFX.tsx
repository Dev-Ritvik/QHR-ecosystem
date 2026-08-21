'use client';

// apps/monolith/src/components/experience/PostFX.tsx
//
// The lens — MASTER_SPEC §5 Act I, §9.3.
//
// THE CHAIN IS A CAMERA, AND IT IS ORDERED LIKE ONE:
//
//   <Exposure/>              sensor gain            HDR
//   <Bloom/>                 lens veiling glare     HDR
//   <ChromaticAberration/>   lens dispersion        HDR
//   <Vignette/>              lens falloff           HDR
//   <SplitTone/>             ACES + film stock      HDR -> display
//   <Noise/>                 grain                  display
//
// Everything optical happens in scene-linear HDR. The transform to display
// happens exactly once, in <SplitTone/>. Grain is last so it dithers the final
// image — put it before the vignette and the vignette smooths the dither back
// out, which defeats the entire reason it is there.
//
// ─────────────────────────────────────────────────────────────────────────────
// CORRECTION TO THE PREVIOUS VERSION OF THIS FILE
//
// This header used to state that three applies ACES in the material shader, so
// there must be no tone mapping pass here. That was wrong in this pipeline, and
// wrong in a way that hid two real defects.
//
// @react-three/postprocessing's EffectComposer sets `gl.toneMapping =
// NoToneMapping` on mount, unconditionally, with no prop to opt out. three then
// compiles <tonemapping_fragment> out of every material. So:
//
//   - No tone mapping was happening at tier A, B or C. Not double-mapped:
//     UN-mapped. Highlights hard-clipped per channel.
//   - `toneMappingExposure` is only read inside a tone mapping function, so the
//     entire EV column of the continuity table — every value CameraRig chases
//     through chaseExposure, the Act III exposure lag — was computed each frame
//     and thrown away.
//
// The spec's ruling exists to stop the image being mapped TWICE (the documented
// "radioactive glare" failure). Mapping it once, in <SplitTone/>, honours that
// intent precisely. Full reasoning in SplitTone.tsx; recorded in Appendix A.
// ─────────────────────────────────────────────────────────────────────────────
//
// Gated by tier (§9.3) — but the grade is NOT gated, and that is deliberate.
// Bloom, CA and multisampling are embellishments a phone can go without. The
// tone map and the film stock are not embellishments; they are what the image
// IS. Dropping them on mobile would not be a cheaper version of this site, it
// would be a different one — un-tone-mapped and ungraded. They also cost
// almost nothing to keep: postprocessing merges every non-convolution effect
// into one fullscreen pass, so at tier C the whole chain below is a single
// shader.

import { useCallback, useEffect, useMemo } from 'react';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import type { EffectComposer as EffectComposerImpl } from 'postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { useSceneStore } from '@/state/sceneStore';
import { TIER_BUDGET } from '@/lib/tier';
import { Exposure, SplitTone } from './SplitTone';
import { subscribe } from '@/lib/ticker';
import { caOffsetFor, getCameraSpeed } from '@/lib/motion';

export function PostFX() {
  const tier = useSceneStore((s) => s.tier);
  const budget = TIER_BUDGET[tier];

  // CHROMATIC ABERRATION IS A MOTION ARTEFACT, NOT A PROPERTY OF THE IMAGE.
  //
  // This was a constant 0.0006 across the entire timeline, and at rest that is
  // not "a subtle lens" — it splits every 1-pixel emissive survey line in the
  // Act II plotting grid into a red ghost and a blue one. Those lines are the
  // plan being sold; crispness there is the product, not a preference. It also
  // accounted for 100% of the residual warm pixels measured in Act I: fringing
  // on high-contrast edges, which disappeared entirely with the pass disabled.
  //
  // Now driven by the camera's instantaneous speed along the path, and clamped
  // to EXACTLY zero below a deadband — so the Act IV pause, and every moment a
  // reader stops to look at something, are perfectly sharp. Full strength only
  // through the Act I punch, where the frame is moving too fast to read
  // anything anyway and dispersion registers as speed rather than as a defect.
  //
  // The Vector2 identity is stable and mutated in place: a fresh object each
  // frame makes the effect rebuild its uniform.
  const caOffset = useMemo(() => new THREE.Vector2(0, 0), []);

  useEffect(
    () =>
      subscribe(() => {
        const amt = caOffsetFor(getCameraSpeed());
        caOffset.set(amt, amt);
      }),
    [caOffset],
  );

  // DEV HANDLE — the composer, not the renderer.
  //
  // WorldCanvas already exposes window.__three, whose render() calls
  // gl.render(scene, camera) directly. That bypasses the composer completely:
  // none of the passes below compile, and no Effect.update() ever runs. Trying
  // to verify this chain through __three reports an empty shader list and a
  // frozen exposure uniform, and both readings are artefacts of the handle
  // rather than facts about the code.
  //
  // This environment throttles requestAnimationFrame to zero, so R3F's own loop
  // never drives the composer either. Without a handle on the composer itself,
  // a GLSL error anywhere in this chain is unobservable until it reaches a real
  // browser. Hence window.__composer.
  const attach = useCallback((c: EffectComposerImpl | null) => {
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      (window as unknown as { __composer?: unknown }).__composer = c;
    }
  }, []);

  if (tier === 'D') return null;

  return (
    <EffectComposer
      ref={attach}
      // The composer allocates its own render targets. At tier B/C those are
      // downscaled, which is most of the fill-rate saving on a phone — the
      // passes themselves are cheap, the resolution they run at is not.
      resolutionScale={budget.composerScale}
      multisampling={tier === 'A' ? 4 : 0}
    >
      {/* Sensor gain, ahead of everything. Bloom's threshold is only meaningful
          against an exposed image, and exposure moves with the narrative — so
          this cannot be folded into the tone map at the end of the chain. */}
      <Exposure />

      {budget.bloom ? (
        <Bloom
          // 1.0 in EXPOSED scene-linear: bloom only what is brighter than
          // white. The old 0.92 was documented as display-space and was not —
          // nothing had converted to display space at this point in the chain.
          // Because exposure is now applied upstream, this threshold tracks the
          // EV chase for free: as the eye adapts across the Act III breach, the
          // highlights stop blooming because they stop being over-white.
          luminanceThreshold={1.0}
          luminanceSmoothing={0.24}
          intensity={0.55}
          mipmapBlur
        />
      ) : (
        <></>
      )}

      {tier === 'A' ? (
        <ChromaticAberration
          // Under 0.001, per the spec. Above that it stops reading as a lens
          // and starts reading as a broken display.
          offset={caOffset}
          radialModulation={false}
          modulationOffset={0}
        />
      ) : (
        <></>
      )}

      {/* Optical falloff, still in HDR — so ACES rolls the darkened corners off
          smoothly instead of crushing them, and the grade's shadow band then
          lifts them blue. That cool corner falloff is visible in two of the
          four reference frames. */}
      <Vignette
        offset={0.30}
        darkness={0.62}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />

      {/* ACES, then the split-tone derived from the reference frames. The one
          and only transform from scene-linear to display in this application.
          See src/lib/grade.ts for where every hex came from. */}
      <SplitTone />

      {/* Monochromatic grain, LAST. Its real job is not texture — it is
          dithering the dark vertical gradients so they do not band on 8-bit
          displays. A near-black with grain reads as depth; without it, as
          stepped grey rings, which is the most common tell of an amateur WebGL
          scene. */}
      <Noise
        premultiply
        opacity={tier === 'A' ? 0.035 : 0.028}
        blendFunction={BlendFunction.OVERLAY}
      />
    </EffectComposer>
  );
}
