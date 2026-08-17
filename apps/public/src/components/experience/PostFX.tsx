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

import { useState } from 'react';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette, DepthOfField, GodRays } from '@react-three/postprocessing';
import type { DeviceTier } from '@estate/domain/telemetry/device-tier';
import { SUBJECT } from './cameraPath';

/**
 * The visible sun disc that GodRays samples.
 *
 * The pass needs a real mesh to occlude: it renders that mesh, blurs radially
 * from its screen position, and lets scene depth mask the rays. So the disc has
 * to sit where the key light is and be genuinely in frame, which is why the key
 * was moved behind the architecture first — rays from a source behind the lens
 * are not dim, they are undefined.
 *
 * Matched to the directional light at (30, 15, -80) — deep behind the RIGHT of
 * the mansion, so the shell occludes it and the left of frame, where the hero
 * column sits, stays in shadow. MeshBasicMaterial because
 * the sun must not itself be lit; it IS the light.
 */
function SunDisc({ onReady }: { onReady: (m: THREE.Mesh | null) => void }) {
  return (
    <mesh ref={onReady} position={[30, 15, -80]} frustumCulled={false}>
      {/* Smaller AND further away: 4.2m at an 85m throw subtends roughly a
          third of the angle the old 7.5m disc did at 74m. The pass only needs
          a source to blur outward from — it does not need a visible ball, and
          a large bright sphere on screen is a light leak rather than a sun. */}
      <sphereGeometry args={[4.2, 20, 20]} />
      {/* toneMapped={false} so ACES does not crush it before the pass reads it;
          the colour is already close to the tone-mapped target rather than the
          blown white it used to be. */}
      <meshBasicMaterial color="#E39A52" toneMapped={false} />
    </mesh>
  );
}

export function PostFX({ tier }: { tier: DeviceTier }) {
  // STATE, not a ref. GodRays needs the actual mesh instance as a prop, and a
  // ref is populated AFTER render without scheduling another one — so the pass
  // would read null on the first pass and never mount, silently. The callback
  // ref sets state once, which re-renders and hands the effect a real mesh.
  const [sun, setSun] = useState<THREE.Mesh | null>(null);
  if (tier === 'low') {
    return (
      <EffectComposer>
        <Vignette offset={0.32} darkness={0.62} eskil={false} />
      </EffectComposer>
    );
  }

  return (
    <>
      {/* Mounted OUTSIDE the composer: it is scene geometry the pass samples,
          not an effect. */}
      <SunDisc onReady={setSun} />
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
      {/* VOLUMETRIC SCATTERING. The sun sits behind the building, so the
          architecture occludes the disc and the rays break around the roofline
          and through the colonnade — light with physical presence in the air
          rather than a lens flare stuck on top.

          High tier only: this is a second render of the occlusion scene plus a
          multi-sample radial blur, which is the most expensive thing in the
          pipeline and the first thing a phone should not pay for.

          CLAMPED HARD. The first pass ran exposure 0.34 / weight 0.38 /
          clampMax 0.92, which is a supernova, not atmosphere: the rays summed
          into the HDR buffer well above what the already-applied ACES curve had
          headroom for, so the whole frame lifted and the tone mapping
          established earlier in this build was undone. exposure 0.12, weight
          0.16 and clampMax 0.55 keep the contribution inside that headroom —
          the effect should register as density in the air, not as a light
          source pointed at the lens. samples 60 -> 44 for the same reason it is
          high tier only. */}
      {tier === 'high' && sun ? (
        <GodRays
          sun={sun}
          density={0.62}
          decay={0.88}
          weight={0.16}
          exposure={0.12}
          samples={44}
          clampMax={0.55}
          blur
        />
      ) : (
        <></>
      )}
      <Vignette offset={0.3} darkness={0.66} eskil={false} />
    </EffectComposer>
    </>
  );
}
