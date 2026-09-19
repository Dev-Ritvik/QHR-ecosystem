'use client';

// apps/public/src/components/experience/PostFX.tsx
//
// The cinematic lens: bloom and vignette.
//
// ONE CRITICAL DECISION, STATED UP FRONT: there is NO ToneMapping effect in
// this chain, and that is deliberate.
//
// three applies tone mapping inside the material's fragment shader
// (tonemapping_fragment), not as a final blit — so the scene arriving in the
// composer's buffer has ALREADY been through ACESFilmic at the exposure
// ColorPipeline set. Adding postprocessing's ToneMapping effect on top would map
// an already-mapped image a second time. That is precisely the arithmetic that
// produced the "radioactive yellow glare" rejection earlier in this build, and
// it is not worth repeating for a line of code that looks correct in a tutorial.
//
// Consequence: bloom operates on tone-mapped values, so its luminanceThreshold
// is in display space, not scene-linear. 0.85 is chosen against that.
//
// Gated by device tier. Low tier keeps vignette only, which costs almost
// nothing and still frames the composition.
//
// ─────────────────────────────────────────────────────────────────────────────
// DEPTH OF FIELD AND GOD RAYS ARE NOT IN THIS CHAIN, AND THAT IS A MEASUREMENT
// RATHER THAN A PREFERENCE.
//
// Both shipped here. Both were removed after a real browser showed what they
// were actually doing: with either one mounted, every frame logged
//
//   GL_INVALID_OPERATION: glBlitFramebuffer: Read and write depth stencil
//   attachments cannot be the same image
//
// until Chrome gave up ("too many errors, no more errors will be reported to
// the console for this context"). Bisected with the effect list as the only
// variable, ~10s of runtime each:
//
//   no composer at all (?free=1) ............. 0 GL warnings
//   composer + Bloom + Vignette .............. 0 GL warnings
//   composer + Bloom + Vignette + DOF ........ error every frame
//   composer + Bloom + Vignette + GodRays .... error every frame
//
// Ruled out along the way, each on its own run: the composer's multisampling
// (set to 0 — no change), DOF's downsampling path (`height` prop removed — no
// change), and three's transmission pass (every transmissive material zeroed at
// runtime through the live scene graph — no change, and its render target
// already sets resolveDepthBuffer: false).
//
// What the two removed effects have in common is the only thing left: they are
// the two that ask the composer for a DepthTexture. Attaching it makes the
// resolve blit read and write the same depth image, which is illegal — so the
// depth buffer these effects sample is undefined. The bokeh was not subtly
// wrong; it was computed from garbage, every frame, on every high-tier device,
// while filling the console.
//
// An effect that cannot read valid depth is not a cinematic lens, it is a cost.
// The focus language the brief asks for is carried instead by the parts of the
// system that do work and are already authored per beat: the FOV warp (44-56
// outside, 30 at the stations), the per-beat fog, and the vignette below.
// Atmospheric perspective is how architectural photography separates planes in
// any case.
//
// TO RESTORE: re-add <DepthOfField target={SUBJECT} focalLength={0.028}
// bokehScale={0.9} /> and re-run the bisect above. If the console stays clean on
// postprocessing > 6.39.3 or three > 0.173 the incompatibility is fixed and it
// should come back — cameraPath still exports SUBJECT for exactly that.
// ─────────────────────────────────────────────────────────────────────────────

import {
  EffectComposer,
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  HueSaturation,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import type { DeviceTier } from '@estate/domain/telemetry/device-tier';

/**
 * THE GRADE, AND WHY A RENDER NEEDS ONE.
 *
 * The client's verdict on the first estate was that it "looks like another 3D
 * build" — and the honest reading of that is not geometry, it is that nothing
 * had happened to the image after the renderer was finished with it. A
 * photograph of a house has been through a lens and a grade: it has grain, it
 * has a little more contrast than the scene did, its colour is pushed, and its
 * corners fall off. A raw framebuffer has none of that, and the eye reads the
 * absence instantly even when it cannot name it.
 *
 * Every effect below is SCREEN SPACE and depth-free, which is the constraint
 * the investigation at the top of this file established: anything that asks the
 * composer for a DepthTexture (depth of field, SSAO, god rays) makes the resolve
 * blit read and write the same image and produces garbage. Nothing here does.
 *
 *   contrast   +0.055   the shadow side of the stone gets its weight back
 *   saturation +0.09    warm light on limestone, not on beige
 *   grain      0.028    at 45% opacity in overlay: a film stock's noise floor,
 *                       which is what stops a flat sky reading as a gradient
 *   aberration 0.4 px   only at the corners, under the vignette, where a real
 *                       lens actually has it
 */
const GRADE = { contrast: 0.055, saturation: 0.09, grain: 0.028 } as const;
/** Sub-pixel, and deliberately: visible fringing is a filter, not a lens. */
const ABERRATION = new Vector2(0.00042, 0.00042);

/**
 * MULTISAMPLING OFF.
 *
 * Kept from the investigation above. It did not fix the depth blit on its own,
 * but with no depth-consuming effect left in the chain there is nothing for MSAA
 * to buy: the composer renders a full-screen quad chain, and geometric edges are
 * already resolved by the renderer's own dpr, which reaches 2 on high tier and
 * downsamples — supersampling by another name.
 *
 * `antialias` on the <Canvas> is unaffected and unrelated: it applies to the
 * default framebuffer, which the composer does not draw into.
 */
const MULTISAMPLING = 0;

export function PostFX({ tier }: { tier: DeviceTier }) {
  // Grain and aberration are the two passes that buy the least per millisecond,
  // so they are the two a mid-tier device does without: it keeps the bloom, the
  // grade and the vignette, which carry the look.
  const lens = tier === 'high';
  if (tier === 'low') {
    // A phone gets the grade but not the passes that cost a full-screen blur:
    // contrast, saturation and the vignette are one shader between them.
    return (
      <EffectComposer multisampling={MULTISAMPLING}>
        <BrightnessContrast brightness={0} contrast={GRADE.contrast} />
        <HueSaturation hue={0} saturation={GRADE.saturation} />
        <Vignette offset={0.32} darkness={0.62} eskil={false} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={MULTISAMPLING}>
      {/* Selective: only the gold finials, the lit window reveals, the
          constellation and the active hologram cross 0.85 after tone mapping. A
          lower threshold catches the cream stone and turns the whole facade into
          a lamp — which is the failure mode this build has already shipped
          once. */}
      <Bloom
        intensity={0.74}
        luminanceThreshold={0.82}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <BrightnessContrast brightness={0} contrast={GRADE.contrast} />
      <HueSaturation hue={0} saturation={GRADE.saturation} />
      {lens ? (
        <ChromaticAberration offset={ABERRATION} radialModulation modulationOffset={0.35} />
      ) : (
        <></>
      )}
      {/* OVERLAY, not screen: overlay leaves the midtones where they are and
          works into the shadows and highlights, which is how grain sits on an
          image instead of fogging it. */}
      {lens ? (
        <Noise premultiply={false} blendFunction={BlendFunction.OVERLAY} opacity={GRADE.grain} />
      ) : (
        <></>
      )}
      <Vignette offset={0.28} darkness={0.7} eskil={false} />
    </EffectComposer>
  );
}
