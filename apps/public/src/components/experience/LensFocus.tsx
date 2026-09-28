'use client';

// apps/public/src/components/experience/LensFocus.tsx
//
// Depth of field for the exterior, without a depth texture.
//
// THE REVIEW: "trees in the background have a slight depth-of-field blur".
// A long lens holds the house and lets the planted horizon behind it go soft;
// it is one of the few cues that separates a photograph from a render at a
// glance, because a renderer's pinhole keeps everything equally sharp.
//
// WHY NOT <DepthOfField>. PostFX.tsx records the bisect: any effect that asks
// the composer for a DepthTexture makes the resolve blit read and write the
// same depth image, every frame, and the depth it samples is garbage. That has
// not changed, so this does not ask for one.
//
// WHERE THE DISTANCE COMES FROM INSTEAD. The composer's colour buffer is
// half-float RGBA, and an opaque material's alpha is always 1.0 — a whole
// channel carrying nothing. installFocusDepth() appends one line to three's
// opaque_fragment chunk: materials marked ESTATE_FOCUS (the estate's, via
// markFocusDepth) write their view depth in metres into that alpha. This
// effect is a convolution, so postprocessing gives it its own pass, FIRST,
// reading the scene render directly; every EffectPass then clamps alpha to
// [0,1] on its way out (effect.frag), so the distances never reach the canvas
// as transparency, and nothing after this pass can see them.
//
// What is not marked writes alpha 1.0 — the painted sky, which is the one
// thing that is genuinely at infinity — and is read as far. Blended surfaces
// (glass, water) fold their own alpha into the distance and read as near,
// which keeps windows and the pool sharp: acceptable, since they are.
//
// THE LENS. Background only: nothing nearer than the house's far side ever
// blurs, so the building is always tack sharp and the foreground never turns
// into a miniature (the tilt-shift look is the failure mode here, not the
// goal). The focal plane is measured, not guessed: every frame it is set a
// few metres behind the FARTHEST corner of the house's own bounding box
// (estateBounds, the same boxes the collision tests use) along the camera's
// axis, so no angle the film takes can put a cornice in the blur — the unit
// test walks the whole exterior leg to hold that. Blur ramps to full over the
// next 108 m, which is where the tree belt and the berm stand. Full blur is a
// 4 CSS-pixel radius: slight, as asked.
//
// A tap only counts if ITS OWN blur reaches the pixel being filtered, so the
// sharp silhouette of the house never smears into the soft trees behind it.
//
// High tier only: 24 taps a pixel over the part of the frame that is behind
// the house.

import { forwardRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Effect, EffectAttribute } from 'postprocessing';
import * as THREE from 'three';
import { ESTATE_ARCHITECTURE } from './estateBounds';
import { journeyState } from './journey';

const MARK = '/* estate: focus depth */';

/** Install the depth-in-alpha write. Idempotent; call before anything compiles. */
export function installFocusDepth(): void {
  const chunk = THREE.ShaderChunk.opaque_fragment;
  if (chunk.includes(MARK)) return;
  // Never 1.0: that value is reserved for "not marked", which reads as far.
  // vViewPosition is three's NEGATED view-space position, so its z is the
  // distance in front of the eye, already positive.
  THREE.ShaderChunk.opaque_fragment = `${chunk}
${MARK}
#if defined( ESTATE_FOCUS ) && defined( OPAQUE )
	gl_FragColor.a = max( vViewPosition.z, 1.05 );
#endif
`;
}

/**
 * A blended surface must not write the frame's alpha. The exterior carries each
 * pixel's view depth in metres in the alpha channel (LensFocus.installFocusDepth)
 * for the lens and the contact occlusion, and three's default blend folds a
 * pane's own alpha into it — glass at 0.26 turned the room behind it from 14 m
 * into 10.6 m, and the occlusion read every pane as a field of false creases.
 * Colour blends as before; alpha keeps what is behind.
 */
export function keepDepthAlpha(mat: THREE.Material): void {
  mat.blending = THREE.CustomBlending;
  mat.blendEquation = THREE.AddEquation;
  mat.blendSrc = THREE.SrcAlphaFactor;
  mat.blendDst = THREE.OneMinusSrcAlphaFactor;
  mat.blendEquationAlpha = THREE.AddEquation;
  mat.blendSrcAlpha = THREE.ZeroFactor;
  mat.blendDstAlpha = THREE.OneFactor;
}

/** Mark every standard material under root as writing its depth. */
export function markFocusDepth(root: THREE.Object3D): number {
  const seen = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat || seen.has(mat) || !mat.isMeshStandardMaterial) continue;
      seen.add(mat);
      if (mat.defines?.ESTATE_FOCUS !== undefined) continue;
      mat.defines = { ...(mat.defines ?? {}), ESTATE_FOCUS: '' };
      mat.needsUpdate = true;
    }
  });
  return seen.size;
}

const FRAGMENT = /* glsl */ `
uniform float focusStart;
uniform float focusRamp;
uniform float radiusPx;
uniform float strength;
uniform vec2 aoTan;
uniform float aoPxPerM;
uniform float aoRadius;
uniform float aoStrength;

// ── CONTACT OCCLUSION, from the same depth ───────────────────────────────
// Where two surfaces meet, each hides part of the sky from the other: the
// dark line under a car, round a lounger's feet, in a cornice's return. The
// art-direction review found it missing ("objects appear to float"), and the
// usual fix — an SSAO pass — asks the composer for a depth texture, which is
// the one thing this chain cannot have (PostFX.tsx). The depth is already
// here, in metres, in the alpha; so the occlusion is computed in this pass,
// before the lens gathers, from the view-space positions the depth rebuilds.
// A 12-tap disc of AO_RADIUS metres, projected to pixels at each depth, with
// the normal rebuilt from the least-different neighbours so a silhouette edge
// never tilts it. Only what falls inside the radius counts, so the house a
// hundred metres behind a lawn pixel never darkens it.
float aoDepth(vec4 c) { return abs(c.a - 1.0) < 1.0e-3 ? 1.0e4 : c.a; }
vec3 aoView(vec2 uv, float z) { return vec3((uv * 2.0 - 1.0) * aoTan * z, -z); }
float contactAO(vec2 uv, float z) {
  vec3 p = aoView(uv, z);
  // Neighbours three pixels out, not one: half-float depth moves in steps of
  // ~z/2048 m, and a one-pixel stencil turns each step on a grazing drive
  // into a tilted normal and a band of false occlusion.
  vec2 tx = vec2(3.0 * texelSize.x, 0.0), ty = vec2(0.0, 3.0 * texelSize.y);
  float zl = aoDepth(textureLod(inputBuffer, uv - tx, 0.0)), zr = aoDepth(textureLod(inputBuffer, uv + tx, 0.0));
  float zd = aoDepth(textureLod(inputBuffer, uv - ty, 0.0)), zu = aoDepth(textureLod(inputBuffer, uv + ty, 0.0));
  vec3 dx = abs(zr - z) < abs(z - zl) ? aoView(uv + tx, zr) - p : p - aoView(uv - tx, zl);
  vec3 dy = abs(zu - z) < abs(z - zd) ? aoView(uv + ty, zu) - p : p - aoView(uv - ty, zd);
  vec3 n = normalize(cross(dx, dy));
  if (dot(n, p) > 0.0) n = -n;
  float rpx = clamp(aoRadius * aoPxPerM / z, 1.5, 96.0);
  float phi = fract(52.9829189 * fract(dot(gl_FragCoord.yx, vec2(0.06711056, 0.00583715)))) * 6.2831853;
  // Half-float depth steps ~z/2048 m: the bias sits above that, or a lawn at a
  // grazing angle occludes itself in bands.
  float bias = 0.03 + 0.0016 * z;
  float r2 = aoRadius * aoRadius;
  float occ = 0.0;
  for (int i = 0; i < 12; i++) {
    float t = float(i) * 2.39996323 + phi;
    vec2 o = vec2(cos(t), sin(t)) * sqrt((float(i) + 0.5) / 12.0) * rpx * texelSize;
    float zs = aoDepth(textureLod(inputBuffer, uv + o, 0.0));
    if (zs > 9.0e3) continue;
    vec3 v = aoView(uv + o, zs) - p;
    float vv = dot(v, v);
    float fall = max(0.0, 1.0 - vv / r2);
    occ += fall * max(0.0, dot(v, n) - bias) / (sqrt(vv) + 0.05);
  }
  return 1.0 - aoStrength * min(1.0, occ * (2.0 / 12.0));
}

float lensBlur(float a) {
  float d = abs(a - 1.0) < 1.0e-3 ? 1.0e4 : a;
  return clamp((d - focusStart) / focusRamp, 0.0, 1.0) * strength * radiusPx;
}

// ONE BAD PIXEL STAYS ONE PIXEL. A NaN or an infinity from any material in the
// scene would be gathered by this pass into its neighbours and then spread by
// the bloom's mip chain over half the frame: MEASURED at the second station, a
// single NaN pixel from the projector beam became a flat white slab over 60% of
// the picture (the film curve's ceiling, 0.91), hologram and table gone. This
// is the first pass after the scene, so it is the one that stops it.
// By the bits, not isnan()/isinf(): ANGLE's D3D compiler assumes floats are
// never NaN and may fold those calls away (it warns X3577 on this very line),
// which would leave the guard below doing nothing. An all-ones exponent is
// NaN or infinity, and no compiler can assume a bit pattern away.
bool finite4(vec4 c) {
  uvec4 e = floatBitsToUint(c) & 0x7f800000u;
  return all(notEqual(e, uvec4(0x7f800000u)));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
#ifdef LENS_DEBUG
  // Look-dev (?lensdebug=1): the depth this pass receives, 0..200 m as black
  // to white, the far sentinel in red.
  outputColor = abs(inputColor.a - 1.0) < 1.0e-3 ? vec4(1.0, 0.0, 0.0, 1.0)
    : vec4(vec3(clamp(inputColor.a / 200.0, 0.0, 1.0)), 1.0);
  return;
#endif
  if (!finite4(inputColor)) {
    outputColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  float ao = 1.0;
  float z0 = aoDepth(inputColor);
  if (aoStrength > 0.001 && z0 < 9.0e3) ao = contactAO(uv, z0);
#ifdef AO_DEBUG
  // Scaled into the print's linear midtones, so the curve after this pass
  // shows the occlusion instead of clipping it to white.
  outputColor = vec4(vec3(0.22 * ao * ao), 1.0);
  return;
#endif
  float r0 = lensBlur(inputColor.a);
  if (r0 < 0.35) {
    outputColor = vec4(inputColor.rgb * ao, 1.0);
    return;
  }
  float phi = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2831853;
  vec3 sum = inputColor.rgb * ao;
  float wsum = 1.0;
  for (int i = 0; i < 24; i++) {
    float t = float(i) * 2.39996323 + phi;
    float rr = sqrt((float(i) + 0.5) / 24.0) * r0;
    vec2 o = vec2(cos(t), sin(t)) * rr;
    vec4 s = textureLod(inputBuffer, uv + o * texelSize, 0.0);
    if (!finite4(s)) continue;
    float w = clamp(lensBlur(s.a) - rr + 1.0, 0.0, 1.0);
    sum += s.rgb * w;
    wsum += w;
  }
  outputColor = vec4(sum / wsum, 1.0);
}
`;

/** Blur begins this far behind the house's farthest corner... */
export const FOCUS_MARGIN = 6;
/** ...and is full this much further on. */
export const FOCUS_RAMP = 108;

/** The house as the lens must hold it: the union of the mansion, cupola and
 *  spire boxes, as eight corners. */
export const HOUSE_CORNERS: readonly THREE.Vector3[] = (() => {
  const box = new THREE.Box3();
  for (const b of ESTATE_ARCHITECTURE) {
    if (b.name !== 'mansion' && b.name !== 'cupola' && b.name !== 'spire') continue;
    box.expandByPoint(new THREE.Vector3(...b.min)).expandByPoint(new THREE.Vector3(...b.max));
  }
  const out: THREE.Vector3[] = [];
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) out.push(new THREE.Vector3(x, y, z));
  return out;
})();

const toCorner = new THREE.Vector3();
/** Depth along `axis` (unit) from `eye` at which the blur begins. */
export function focusStartFor(eye: THREE.Vector3, axis: THREE.Vector3): number {
  let far = 0;
  for (const c of HOUSE_CORNERS) far = Math.max(far, toCorner.copy(c).sub(eye).dot(axis));
  return far + FOCUS_MARGIN;
}
/** Full-blur radius as a fraction of the buffer width: 4 CSS px at 1440. */
export const FOCUS_RADIUS = 0.0028;

/** Contact occlusion: the reach of the occlusion, metres, and its weight. */
export const AO_RADIUS = 2.0;
export const AO_STRENGTH = 0.9;
/** Inside: a room's contacts are centimetres, not metres. */
export const AO_HALL = { radius: 0.7, strength: 0.6 } as const;

export class LensFocusEffect extends Effect {
  constructor() {
    const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const defines = new Map<string, string>();
    // Look-dev: ?lensdebug=1 shows the depth, ?aodebug=1 the occlusion.
    if (q?.get('lensdebug') === '1') defines.set('LENS_DEBUG', '1');
    if (q?.get('aodebug') === '1') defines.set('AO_DEBUG', '1');
    super('LensFocusEffect', FRAGMENT, {
      attributes: EffectAttribute.CONVOLUTION,
      defines,
      uniforms: new Map<string, THREE.Uniform>([
        ['focusStart', new THREE.Uniform(80)],
        ['focusRamp', new THREE.Uniform(FOCUS_RAMP)],
        ['radiusPx', new THREE.Uniform(4)],
        ['strength', new THREE.Uniform(0)],
        ['aoTan', new THREE.Uniform(new THREE.Vector2(1, 1))],
        ['aoPxPerM', new THREE.Uniform(1000)],
        ['aoRadius', new THREE.Uniform(AO_RADIUS)],
        ['aoStrength', new THREE.Uniform(0)],
      ]),
    });
  }
}

/**
 * THE HALL'S LENS: the storyboard's "135mm f/2.8" at each table.
 *
 * Outside, the lens holds the whole house sharp and softens the planting behind
 * it. Inside it isolates ONE subject — the station the camera is on, or the
 * portrait — and lets the room behind it fall away, which is what a long lens
 * at f/2.8 does at three metres and what makes a table read as the subject of a
 * photograph rather than furniture in a render.
 *
 * InteriorStage writes the subject every frame: the hologram's centre (or the
 * portrait's) and how much the camera is on it. Blur starts HALL_MARGIN behind
 * the subject, is full HALL_RAMP further on, and scales with the weight, so
 * the traverses between stations stay sharp.
 *
 * Every additive layer in the hall (the plan, its titles, the beam) writes its
 * alpha with a MIN blend — its own depth where it glows, nothing elsewhere —
 * so a glowing subject stamps its depth over the wall behind it instead of
 * inheriting the wall's, and stays in focus (HallModel.holographic,
 * StationDressing).
 */
export const lensSubject = { point: new THREE.Vector3(), weight: 0 };
export const HALL_MARGIN = 0.8;
export const HALL_RAMP = 3.2;
/** Full-blur radius inside, as a fraction of the buffer width: ~9 CSS px at 1440. */
export const HALL_RADIUS = 0.0062;

/** Alpha a MIN-blended additive layer writes where it should not count. */
export const NO_DEPTH = 1.0e4;

const axis = new THREE.Vector3();
const buffer = new THREE.Vector2();
const toSubject = new THREE.Vector3();

/** Look-dev: ?aor=<metres>&aos=<weight> override the occlusion, read once. */
const aoLook = (() => {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const r = Number(q?.get('aor'));
  const w = Number(q?.get('aos'));
  return { radius: r > 0 ? r : AO_RADIUS, strength: w >= 0 && q?.has('aos') ? w : AO_STRENGTH };
})();

export const LensFocus = forwardRef<LensFocusEffect, { active?: boolean }>(function LensFocus(
  { active = true },
  ref,
) {
  const effect = useMemo(() => new LensFocusEffect(), []);
  // No dispose={null} on the primitive: r3f applies that as a PROPERTY and
  // nulls the method, which then threw here the first time the composer
  // remounted. r3f never disposes a primitive itself; the composer disposes
  // its effects on unmount, and this is the belt to that brace.
  useEffect(() => () => effect.dispose?.(), [effect]);
  useFrame(({ camera, gl }) => {
    const u = effect.uniforms;
    // Outside: on the exterior film under the daylight print. Inside: on the
    // subject InteriorStage names, weighted by how much the camera is on it.
    // Anywhere else the lens eases to zero and stays out of the way (a prop,
    // not a remount: the effect instance and its pass live for the life of the
    // tier).
    const inside = journeyState.leg === 'interior';
    const on = !active ? 0 : inside ? lensSubject.weight : journeyState.leg === 'exterior' ? 1 : 0;
    const s = u.get('strength')!;
    s.value += (on - s.value) * 0.08;
    camera.getWorldDirection(axis);
    gl.getDrawingBufferSize(buffer);
    // Occlusion outside, and inside at a shorter reach: the hall's bake holds
    // its walls and corners, but the tables, the urns, the balusters and the
    // stair nosings are not in it and floated on the marble (the second client
    // review: "the spaces under the tables lack ambient occlusion").
    const ao = u.get('aoStrength')!;
    const hallAo = journeyState.leg === 'interior';
    const aoOn = !active ? 0 : hallAo ? AO_HALL.strength : aoLook.strength;
    u.get('aoRadius')!.value = hallAo ? AO_HALL.radius : aoLook.radius;
    ao.value += (aoOn - ao.value) * 0.08;
    if (ao.value < 1e-3) ao.value = aoOn === 0 ? 0 : ao.value;
    const pm = camera.projectionMatrix.elements;
    (u.get('aoTan')!.value as THREE.Vector2).set(1 / pm[0], 1 / pm[5]);
    u.get('aoPxPerM')!.value = 0.5 * buffer.y * pm[5];
    if (inside) {
      const depth = toSubject.copy(lensSubject.point).sub(camera.position).dot(axis);
      u.get('focusStart')!.value = Math.max(0.5, depth) + HALL_MARGIN;
      u.get('focusRamp')!.value = HALL_RAMP;
      u.get('radiusPx')!.value = HALL_RADIUS * buffer.x;
    } else {
      u.get('focusStart')!.value = focusStartFor(camera.position, axis);
      u.get('focusRamp')!.value = FOCUS_RAMP;
      u.get('radiusPx')!.value = FOCUS_RADIUS * buffer.x;
    }
  });
  return <primitive ref={ref} object={effect} />;
});
