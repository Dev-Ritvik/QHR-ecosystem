'use client';

// apps/monolith/src/components/experience/SplitTone.tsx
//
// THE CAMERA MODEL — MASTER_SPEC §5 Act I (post-processing order), §3.3
// (exposure lag).
//
// Two effects, exported separately, because BLOOM HAS TO SIT BETWEEN THEM:
//
//   <Exposure/>    scene-linear x toneMappingExposure   — before bloom
//   <SplitTone/>   ACES filmic, then the grade          — after bloom
//
// They are one camera and should be read as one. The split is forced by the
// pipeline, not chosen.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY TONE MAPPING LIVES HERE, WHEN THE SPEC SAYS IT MUST NOT
//
// MASTER_SPEC §5 rules: "Tone mapping is ACES Filmic in the material shader, not
// as a composer pass." PostFX.tsx repeated it. Both were written against a
// pipeline that does not exist.
//
// @react-three/postprocessing's EffectComposer runs this on mount, and exposes
// no prop to prevent it:
//
//     useEffect(() => {
//       const currentTonemapping = gl.toneMapping;
//       gl.toneMapping = NoToneMapping;          // <- unconditional
//       return () => { gl.toneMapping = currentTonemapping; };
//     }, [gl]);
//
// three compiles <tonemapping_fragment> out entirely when toneMapping is
// NoToneMapping. So WorldCanvas setting ACESFilmicToneMapping in onCreated has
// had no effect on any frame at tier A, B or C since the composer was added.
// Consequences, in order of severity:
//
//   1. `toneMappingExposure` is only ever read INSIDE a tone mapping function.
//      With none compiled, the entire EV column of the continuity table is
//      inert — chaseExposure, EXPOSURE_TAU, the Act III exposure lag the breach
//      is built around. Computed every frame, discarded every frame.
//
//   2. Nothing rolls off. Values above 1.0 hard-clip per channel, which is what
//      turns a warm practical into a flat white blob with a coloured fringe.
//
// The spec's ruling exists to prevent mapping an already-mapped image TWICE —
// the documented "radioactive glare" failure. Doing it once, here, honours that
// intent exactly. The status quo honoured neither the letter nor the intent,
// because it mapped zero times. Recorded in Appendix A.
//
// The library's behaviour is also correct, and worth stating so nobody "fixes"
// it back: bloom must see HDR. Bloom applied to already-clamped values cannot
// tell a 1.0 sky from a 40.0 filament and blooms both identically.
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY EXPOSURE IS A SEPARATE PASS AHEAD OF BLOOM
//
// Bloom's luminanceThreshold is a number compared against whatever reaches it.
// If exposure is applied after bloom, that comparison happens against RAW
// radiance — and the scene is authored to land in range only after being
// multiplied by ~0.19. Raw values are therefore ~5x higher than the threshold
// assumes, so a threshold of 1.0 blooms almost the whole frame.
//
// Worse, exposure MOVES: the continuity table swings EV from -2.4 to -0.70. A
// fixed raw-radiance threshold cannot serve both ends — correct at the bright
// end, blooming everything at the dark end.
//
// Exposing first fixes both, and buys something the spec actually wants for
// free: bloom now tracks the EV chase. As the eye adapts across the Act III
// breach the highlights stop blooming, because they stopped being over-white.
// That is the exposure lag in §3.3 expressed optically instead of numerically.
//
// Cost: one extra fullscreen multiply, and one extra pass at tiers A and B
// (bloom carries EffectAttribute.CONVOLUTION, so it splits the chain wherever
// it sits). At tier C, where bloom is off, every effect here merges into a
// single pass.
//
// WHY THE GRADE MUST COME AFTER THE TONE MAP
//
// Split-toning needs bands, and bands need a bounded domain. Scene-linear
// radiance is unbounded: "highlight" would mean everything above 1.0, which in
// a specular can be 40.0, and the midtone band would hold almost nothing. Only
// after ACES is luminance a defined position between black and white. So the
// tone map and the grade are one shader and cannot be reordered.

import { useMemo } from 'react';
import * as THREE from 'three';
import { BlendFunction, Effect } from 'postprocessing';
import { EV_AT_ZERO } from '@/lib/continuity';
import {
  HIGH_PIVOT,
  HIGH_STRENGTH,
  MID_STRENGTH,
  SHADOW_PIVOT,
  UNIFORMS,
  WARMTH_HI,
  WARMTH_LO,
} from '@/lib/grade';

// Helpers are prefixed `st_`. postprocessing merges every non-convolution
// Effect in the chain into ONE fragment shader, so an unprefixed `lum()` here
// would collide with an unprefixed `lum()` in any effect added later — and the
// failure is a shader compile error at runtime, on someone else's machine.

const exposureShader = /* glsl */ `
uniform float uExposure;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb * uExposure, inputColor.a);
}
`;

const splitToneShader = /* glsl */ `
uniform vec3 uShadowLift;
uniform vec3 uMidBalance;
uniform vec3 uWarmBalance;
uniform vec3 uCoolBalance;

const mat3 ST_ACES_IN = mat3(
  vec3(0.59719, 0.07600, 0.02840),
  vec3(0.35458, 0.90834, 0.13383),
  vec3(0.04823, 0.01566, 0.83777)
);
const mat3 ST_ACES_OUT = mat3(
  vec3( 1.60475, -0.10208, -0.00327),
  vec3(-0.53108,  1.10813, -0.07276),
  vec3(-0.07367, -0.00605,  1.07602)
);

float st_lum(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {

  // 1. ACES FILMIC ──────────────────────────────────────────────────────────
  // Reproduced from three's ACESFilmicToneMapping verbatim, including the /0.6
  // normalisation. Every EV value in the continuity table was authored against
  // three's curve; a different fit would make those numbers mean something
  // else, and the table is the one artefact that must not drift. Exposure has
  // already been applied by <Exposure/> ahead of bloom.
  vec3 c = inputColor.rgb / 0.6;
  c = ST_ACES_IN * c;
  vec3 a = c * (c + 0.0245786) - 0.000090537;
  vec3 b = c * (0.983729 * c + 0.4329510) + 0.238081;
  c = ST_ACES_OUT * (a / b);
  c = clamp(c, 0.0, 1.0);

  // 2. PERCEPTUAL LUMINANCE POSITION ────────────────────────────────────────
  // Gamma-encoded before banding. Linear 0.5 is sRGB 0.735 — a bright value —
  // so bands cut against linear luminance put roughly three quarters of a
  // normal image into "shadow". This one pow() is the difference between bands
  // that mean what their names say and bands that do not.
  float lp = pow(max(st_lum(c), 0.0), 1.0 / 2.2);

  // 3. PARTITION OF UNITY ───────────────────────────────────────────────────
  // wS + wM + wH == 1 at every luminance, by construction. This is what lets
  // the grade sit underneath the EV column without lying about it: the three
  // weights can only redistribute tint, never add or remove level.
  float wS = 1.0 - smoothstep(0.0, ${SHADOW_PIVOT.toFixed(4)}, lp);
  float wH = smoothstep(${HIGH_PIVOT.toFixed(4)}, 1.0, lp);
  float wM = 1.0 - wS - wH;

  // 4. WHICH HIGHLIGHT TINT ─────────────────────────────────────────────────
  // Chosen by the pixel's own warm/cool bias, not imposed. Sodium lamps and
  // 2700 K practicals go warmer; sky, fog crest and the Act II plotting grid
  // go cooler. This is why no setting of these uniforms can produce a global
  // orange filter (§5 Act III): warmth is conditional on already being warm.
  float warmth = smoothstep(${WARMTH_LO.toFixed(4)}, ${WARMTH_HI.toFixed(4)}, c.r - c.b);
  vec3 hiBal = mix(uCoolBalance, uWarmBalance, warmth);

  // 5. APPLY ────────────────────────────────────────────────────────────────
  // Highlights and midtones take a MULTIPLICATIVE balance: that is what a light
  // source's colour physically does. Shadows take an ADDITIVE lift, because
  // multiplying near-black by anything is still near-black — the blue in a dusk
  // shadow is bounced skylight arriving, not the shadow tinting itself.
  c *= mix(vec3(1.0), hiBal,       ${HIGH_STRENGTH.toFixed(4)} * wH);
  c *= mix(vec3(1.0), uMidBalance, ${MID_STRENGTH.toFixed(4)} * wM);
  c += uShadowLift * wS;

  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}
`;

/** Scene-linear radiance x the exposure the ticker wrote this frame. */
export class ExposureEffect extends Effect {
  constructor() {
    super('Exposure', exposureShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uExposure', new THREE.Uniform(Math.pow(2, EV_AT_ZERO))],
      ]),
    });
  }

  /**
   * Pull the exposure CameraRig wrote this frame.
   *
   * CameraRig keeps writing `gl.toneMappingExposure` and rig-check.mjs keeps
   * asserting against it — nothing upstream changes. The value simply stops
   * being discarded. Reading it here rather than re-plumbing CameraRig keeps
   * ONE authority for exposure, which is the entire point of §3.
   */
  update(renderer: THREE.WebGLRenderer): void {
    const u = this.uniforms.get('uExposure');
    if (u) u.value = renderer.toneMappingExposure;
  }
}

export class SplitToneEffect extends Effect {
  constructor() {
    super('SplitTone', splitToneShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uShadowLift', new THREE.Uniform(new THREE.Vector3(...UNIFORMS.shadowLift))],
        ['uMidBalance', new THREE.Uniform(new THREE.Vector3(...UNIFORMS.midBalance))],
        ['uWarmBalance', new THREE.Uniform(new THREE.Vector3(...UNIFORMS.warmBalance))],
        ['uCoolBalance', new THREE.Uniform(new THREE.Vector3(...UNIFORMS.coolBalance))],
      ]),
    });
  }
}

export function Exposure() {
  const effect = useMemo(() => new ExposureEffect(), []);

  // Dev handle. The preview pane throttles requestAnimationFrame to zero, so
  // nothing here can be judged by looking at it — the numbers have to be
  // readable instead. See scripts/grade-check.mjs for the numeric gate.
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    (window as unknown as { __grade?: unknown }).__grade = {
      uniforms: UNIFORMS,
      pivots: { SHADOW_PIVOT, HIGH_PIVOT },
      strengths: { MID_STRENGTH, HIGH_STRENGTH },
      exposure: () => effect.uniforms.get('uExposure')?.value,
    };
  }

  return <primitive object={effect} dispose={null} />;
}

export function SplitTone() {
  const effect = useMemo(() => new SplitToneEffect(), []);
  return <primitive object={effect} dispose={null} />;
}
