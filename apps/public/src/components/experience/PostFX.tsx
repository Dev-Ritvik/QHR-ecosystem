'use client';

// apps/public/src/components/experience/PostFX.tsx
//
// The cinematic lens: bloom, depth of field, vignette.
//
// ONE CRITICAL DECISION, STATED UP FRONT: there is NO ToneMapping effect in
// this chain, and that is deliberate.
//
// three applies tone mapping inside the material's fragment shader
// (tonemapping_fragment), not as a final blit — so the scene arriving in the
// composer's buffer has ALREADY been through ACESFilmic at exposure 0.6.
// Adding postprocessing's ToneMapping effect on top would map an already-mapped
// image a second time. That is precisely the arithmetic that produced the
// "radioactive yellow glare" rejection earlier in this build, and it is not
// worth repeating for a line of code that looks correct in a tutorial.
//
// Consequence: bloom operates on tone-mapped values, so its luminanceThreshold
// is in display space, not scene-linear. 0.85 is chosen against that.
//
// Gated by device tier. DOF is the expensive effect here — it needs the depth
// buffer and a bokeh pass — and the whole point of this build is that a phone
// gets the same experience, not the same shader budget. Low tier keeps vignette
// only, which costs almost nothing and still frames the composition.

import { EffectComposer, Bloom, Vignette, DepthOfField } from '@react-three/postprocessing';
import type { DeviceTier } from '@estate/domain/telemetry/device-tier';
import { SUBJECT } from './cameraPath';

export function PostFX({ tier }: { tier: DeviceTier }) {
  if (tier === 'low') {
    return (
      <EffectComposer>
        <Vignette offset={0.32} darkness={0.62} eskil={false} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer>
      {/* Selective: only the gold finials, the lit window reveals and the
          fountain highlight cross 0.85 after tone mapping. A lower threshold
          catches the cream stone and turns the whole facade into a lamp — which
          is the failure mode this build has already shipped once. */}
      <Bloom
        intensity={0.62}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.28}
        mipmapBlur
      />
      {/* Focused ON THE BUILDING, tracked every frame.

          This was `focusDistance={0.021}` — a hardcoded NORMALISED depth, not
          metres. focusDistance is 0..1 across the camera's near..far and the
          mapping is non-linear, so 0.021 put the focal plane a few metres in
          front of the lens and the mansion — the subject of the entire page —
          sat in bokeh. Passing `target` instead makes the effect compute the
          distance from the camera to that world point each frame, which is
          exactly right now the camera orbits: the radius changes from 30m to
          13m along the path, so any fixed focal distance would be wrong for
          most of the journey by construction.

          bokehScale dropped 2.4 -> 0.9. The client's reference is Nolan, who
          shoots large-format deep focus — wide lenses, everything sharp, and
          famously little bokeh. Heavy DOF is the opposite of that house style.
          What is left is just enough to soften the near motes and let the far
          karst fall away. */}
      {tier === 'high' ? (
        <DepthOfField
          target={SUBJECT}
          focalLength={0.028}
          bokehScale={0.9}
          height={480}
        />
      ) : (
        <></>
      )}
      <Vignette offset={0.3} darkness={0.66} eskil={false} />
    </EffectComposer>
  );
}
