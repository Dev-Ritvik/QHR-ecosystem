'use client';

// apps/monolith/src/components/experience/PostFX.tsx
//
// The lens — MASTER_SPEC §5 Act I, §9.3.
//
// ONE DECISION STATED UP FRONT: there is NO ToneMapping pass in this chain, and
// there never will be.
//
// three applies ACES Filmic inside the material's fragment shader
// (tonemapping_fragment), not as a final blit — so the image arriving in the
// composer's buffer has ALREADY been tone-mapped. Adding postprocessing's
// ToneMapping effect on top maps an already-mapped image a second time. That is
// precisely the arithmetic that produced the "radioactive yellow glare"
// rejection on apps/public, and it is not worth repeating for a line that looks
// correct in a tutorial.
//
// Consequence: Bloom operates on tone-mapped values, so luminanceThreshold is
// in DISPLAY space, not scene-linear. 0.92 is chosen against that.
//
// ORDER MATTERS and this is the order: Bloom → ChromaticAberration → Vignette →
// Noise. Grain must be last so it dithers the final image — put it before the
// vignette and the vignette smooths the dither back out, which defeats the
// entire reason it is there.
//
// Gated by tier (§9.3). Tier C keeps vignette and grain only: both are
// single-pass, cost almost nothing, and still frame the composition. The
// expensive passes are the ones a phone should not pay for.

import { useMemo } from 'react';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { useSceneStore } from '@/state/sceneStore';
import { TIER_BUDGET } from '@/lib/tier';

export function PostFX() {
  const tier = useSceneStore((s) => s.tier);
  const budget = TIER_BUDGET[tier];

  // Chromatic aberration offset must be a Vector2 and must be stable across
  // renders — a fresh object each frame makes the effect rebuild its uniform.
  const caOffset = useMemo(() => new THREE.Vector2(0.0006, 0.0006), []);

  if (tier === 'D') return null;

  return (
    <EffectComposer
      // The composer allocates its own render targets. At tier B/C those are
      // downscaled, which is most of the fill-rate saving on a phone — the
      // passes themselves are cheap, the resolution they run at is not.
      resolutionScale={budget.composerScale}
      multisampling={tier === 'A' ? 4 : 0}
    >
      {budget.bloom ? (
        <Bloom
          // 0.92 in display space. A lower threshold catches the dusk sky and
          // turns the whole horizon into a lamp, which is the failure mode this
          // build has already paid for once.
          luminanceThreshold={0.92}
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

      <Vignette
        offset={0.30}
        darkness={0.62}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />

      {/* Monochromatic grain, LAST. Its real job is not texture — it is
          dithering the dark vertical gradients so they do not band on 8-bit
          displays. #050505 with grain reads as depth; #050505 without it reads
          as stepped grey rings, which is the most common tell of an amateur
          WebGL scene. */}
      <Noise
        premultiply
        opacity={tier === 'A' ? 0.035 : 0.028}
        blendFunction={BlendFunction.OVERLAY}
      />
    </EffectComposer>
  );
}
