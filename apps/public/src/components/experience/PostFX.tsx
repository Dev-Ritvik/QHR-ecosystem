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

import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import type { DeviceTier } from '@estate/domain/telemetry/device-tier';

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
  if (tier === 'low') {
    return (
      <EffectComposer multisampling={MULTISAMPLING}>
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
        intensity={0.62}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.28}
        mipmapBlur
      />
      <Vignette offset={0.3} darkness={0.66} eskil={false} />
    </EffectComposer>
  );
}
