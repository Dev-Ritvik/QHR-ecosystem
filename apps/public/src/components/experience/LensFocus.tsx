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

import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Effect, EffectAttribute } from 'postprocessing';
import * as THREE from 'three';
import { ESTATE_ARCHITECTURE } from './estateBounds';
import { journeyState } from './journey';
import { DOORWAY, doorwayState } from './doorway';
import { passageLight } from './passageLight';

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
	#ifdef ESTATE_EMITTER
	// A surface seen by its own light: the same depth, SIGNED (see EMITTERS).
	gl_FragColor.a = - gl_FragColor.a;
	#endif
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

/** Contact occlusion: pairs of taps through the pixel (twelve taps). */
export const AO_PAIRS = 6;
/** The sine of the elevation a lone tap must stand over the pixel's plane to
 *  count: thirty degrees, past what a normal rebuilt from half-float depth
 *  gets wrong. */
export const AO_STEEP = 0.5;

const FRAGMENT = /* glsl */ `
uniform float focusStart;
uniform float focusRamp;
uniform float focusNear;
uniform float nearRamp;
uniform float radiusPx;
uniform float strength;
uniform float lensK;
uniform float focusDist;
uniform float farSoft;
uniform vec2 aoTan;
uniform vec2 aoOff;
uniform float aoPxPerM;
uniform float aoRadius;
uniform float aoStrength;
uniform mat4 invView;
uniform mat4 prevViewProj;
uniform float shutter;
#define MB_MAX_PX 28.0
#define AO_PAIRS ${AO_PAIRS}
#define AO_STEEP ${AO_STEEP.toFixed(2)}

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
//
// THE TAPS ARE TAKEN IN PAIRS, through the pixel, and it is the PAIR that is
// judged. The depth is a half float: it moves in steps of z/1024 to z/2048,
// and three pixels at a retina density are a baseline no longer than one such
// step, so the rebuilt normal is wrong by anything up to forty degrees — flat
// across a step's plateau, tilted hard along its edge. Judged one tap at a
// time against that normal, a flat wall rose over its own tangent plane on
// one side of every pixel and occluded itself: a contour map of the depth's
// steps over every plain surface, hatched by the sampler's rotation, faint at
// the hero's distance and plain to see on the front in the approach (seen in
// the occlusion alone, ?aodebug=1, and in the print at leg 0.85). The two
// taps of a pair lie on one line through the pixel, so on a flat surface a
// tilted normal lifts one exactly as far as it sinks the other: the SUM of
// their two elevations is the crease along that line, whatever the normal
// says, and it is the sum that is counted. A pair one of whose taps has left
// the surface — the sky, a far lawn past an eave — cannot be summed, and its
// other tap counts alone only where it stands steeply over the pixel
// (AO_STEEP), past anything a wrong normal could lift.
// EMITTERS write their depth negative (installFocusDepth, ESTATE_EMITTER): a
// lit room behind its window, a lamp's glass. Occlusion is the sky hidden from
// a surface, and a surface seen by its own light has no sky to lose — but the
// pass darkened them like any other, and at six pairs of taps its sampling
// noise stood on every lit window as a stipple of dark dots (seen, magnified,
// with the refinement brief: with the occlusion off the rooms were clean). So
// an emitter's depth is read by its size everywhere, and the pixel itself is
// left unoccluded (mainImage).
float aoDepth(vec4 c) { float a = abs(c.a); return abs(a - 1.0) < 1.0e-3 ? 1.0e4 : a; }
// The frustum's own off-centre terms (aoOff: the projection's [8], [9]) keep
// this exact under a shifted front (phoneFraming.ts); a centred frustum's are
// zero. Without them a shifted frame rebuilt every point off its true place,
// and the motion blur read a camera at rest as moving: the phone's whole
// picture smeared (seen).
vec3 aoView(vec2 uv, float z) { return vec3((uv * 2.0 - 1.0 + aoOff) * aoTan * z, -z); }
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
  // Half a turn: a pair is its own opposite.
  float phi = fract(52.9829189 * fract(dot(gl_FragCoord.yx, vec2(0.06711056, 0.00583715)))) * 3.14159265;
  // Half-float depth steps ~z/2048 m: the bias sits above that, or a lawn at a
  // grazing angle occludes itself in bands. ONE dead zone to a pair, shared
  // between its taps: taken off each, a lounger's thirty centimetres seen from
  // the hero's seventy metres (a bias of fourteen) lost its contact to the
  // flat tap opposite, which had nothing to give (seen).
  float bias = 0.03 + 0.0016 * z;
  float r2 = aoRadius * aoRadius;
  // A tap this far off is no longer the surface the pixel stands on.
  float reach = 2.0 * aoRadius;
  float occ = 0.0;
  for (int i = 0; i < AO_PAIRS; i++) {
    float fi = float(i);
    // Thirty degrees apart, the rings dealt out of order so no two
    // neighbouring directions share one.
    float ring = mod(fi, 2.0) < 0.5 ? fi * 0.5 : 2.5 + fi * 0.5;
    float t = fi * (3.14159265 / float(AO_PAIRS)) + phi;
    vec2 o = vec2(cos(t), sin(t)) * sqrt((ring + 0.5) / float(AO_PAIRS)) * rpx * texelSize;
    vec3 va = aoView(uv + o, aoDepth(textureLod(inputBuffer, uv + o, 0.0))) - p;
    vec3 vb = aoView(uv - o, aoDepth(textureLod(inputBuffer, uv - o, 0.0))) - p;
    float da = length(va), db = length(vb);
    float ia = 1.0 / (da + 0.05), ib = 1.0 / (db + 0.05);
    // Each tap's elevation over the pixel's plane, as a sine, SIGNED.
    float sa = dot(va, n) * ia, sb = dot(vb, n) * ib;
    float fa = max(0.0, 1.0 - da * da / r2), fb = max(0.0, 1.0 - db * db / r2);
    if (da < reach && db < reach) {
      occ += (sa > sb ? fa : fb) * max(0.0, sa + sb - bias * 0.5 * (ia + ib));
    } else {
      occ += fa * max(0.0, sa - bias * ia - AO_STEEP) + fb * max(0.0, sb - bias * ib - AO_STEEP);
    }
  }
  return 1.0 - aoStrength * min(1.0, occ * (1.0 / float(AO_PAIRS)));
}

// ── CAMERA MOTION BLUR, from the same depth ──────────────────────────────
// The art-direction audit (2026-09-30) asked for "photographic logic ... motion
// blur during fast pans". A shutter is open for part of a frame, so what moves
// across the lens in that time smears along its path. Each pixel's view
// position is rebuilt from its depth, carried to world space with this frame's
// camera and back to the screen with the last frame's: the difference is how
// far that point moved on screen in one frame. Half of it (a 180-degree
// shutter) is gathered along. Nothing below a pixel and a half — a held frame
// is sharp — and never more than MB_MAX_PX, so a fast scroll smears rather
// than smudges. A camera CUT (a route change, a jump) sets the shutter to zero
// for its frame (LensFocusEffect.update).
vec2 cameraVelocity(vec2 uv, float z) {
  float zz = min(z, 5000.0);
  vec4 world = invView * vec4(aoView(uv, zz), 1.0);
  vec4 prev = prevViewProj * world;
  if (prev.w <= 1.0e-4) return vec2(0.0);
  vec2 puv = prev.xy / prev.w * 0.5 + 0.5;
  return (uv - puv) * shutter;
}

// OUTSIDE (lensK > 0) the blur is a thin lens's own circle of confusion round
// the distance it is focused at, and the air's softness over the far land.
// INSIDE and through the door it is the ramp it was: behind the subject from
// focusStart, and in front of it, where focusNear is set, nearer than that.
float lensBlur(float a) {
  a = abs(a);
  float d = abs(a - 1.0) < 1.0e-3 ? 1.0e4 : a;
  if (lensK > 0.0) {
    float coc = lensK * abs(d - focusDist) / max(d, 0.5);
    float air = farSoft * clamp((d - focusStart) / focusRamp, 0.0, 1.0);
    return min(max(coc, air), radiusPx) * strength;
  }
  float far = clamp((d - focusStart) / focusRamp, 0.0, 1.0);
  float near = focusNear > 0.0 ? clamp((focusNear - d) / nearRamp, 0.0, 1.0) : 0.0;
  return max(far, near) * strength * radiusPx;
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
  outputColor = abs(abs(inputColor.a) - 1.0) < 1.0e-3 ? vec4(1.0, 0.0, 0.0, 1.0)
    : vec4(vec3(clamp(abs(inputColor.a) / 200.0, 0.0, 1.0)), 1.0);
  return;
#endif
  if (!finite4(inputColor)) {
    outputColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  float ao = 1.0;
  float z0 = aoDepth(inputColor);
  if (aoStrength > 0.001 && z0 < 9.0e3 && inputColor.a > 0.0) ao = contactAO(uv, z0);
#ifdef AO_DEBUG
  // Scaled into the print's linear midtones, so the curve after this pass
  // shows the occlusion instead of clipping it to white.
  outputColor = vec4(vec3(0.22 * ao * ao), 1.0);
  return;
#endif
  // Motion first: a pixel moving fast enough to smear is smeared, and its
  // depth of field — which a smear hides — is not worth the second gather.
  if (shutter > 0.0) {
    vec2 vel = cameraVelocity(uv, z0);
    float vpx = length(vel / texelSize);
    if (vpx > 1.5) {
      vel *= min(1.0, MB_MAX_PX / vpx);
      vec3 msum = vec3(0.0);
      float mw = 0.0;
      float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      for (int i = 0; i < 10; i++) {
        float f = (float(i) + jit) / 10.0 - 0.5;
        vec4 s = textureLod(inputBuffer, uv + vel * f, 0.0);
        if (!finite4(s)) continue;
        msum += s.rgb;
        mw += 1.0;
      }
      outputColor = vec4(msum / max(mw, 1.0) * ao, 1.0);
      return;
    }
  }
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

/**
 * THE EXTERIOR'S LENS IS A LENS (the refinement brief, 2026-10-03: "make the
 * existing experience more believable, not more impressive").
 *
 * Until this pass the blur outside was drawn by hand: from six metres behind
 * the house the land went soft, fully by seventy, and the same in front of it
 * — the pool terrace under the hero's copy, the lawn at the camera's feet (the
 * Vertex3D review had asked for "heavy, deliberate depth of field"). No camera
 * can do that to a house. A 32 mm lens at f/2 focused at fifty metres is sharp
 * from twelve metres to the horizon; the only way to photograph a building
 * with a band of focus across it and blur on both sides is to photograph a
 * MODEL of one, at arm's length — and that is what the eye concluded. The
 * brief's two audits both read the estate as "a game/CG asset"; the look has a
 * name, the tilt-shift miniature.
 *
 * So the blur outside is the thin lens's own circle of confusion,
 *
 *     c(d) = f^2 / (N (s - f)) x |d - s| / d
 *
 * with f the focal length the frame's field of view implies on a 24 mm gate,
 * N the aperture and s the distance the lens is focused at: the face of the
 * house it is pointed at. On the wide shots that is deep focus — the house,
 * the garden and the tree belt all sharp, and only what stands within a few
 * metres of the lens (a palm's trunk at the frame's edge) soft. As the camera
 * comes in on the approach the same formula gives the garden behind the house
 * its pixel of softness, which is what a lens does at fifteen metres.
 *
 * AND THE AIR. What softens a tree belt two hundred metres off is not the lens
 * but the air between, and it takes fine detail, not focus: FAR_SOFT at the
 * far land, coming on from FAR_FROM behind the house over FAR_RAMP.
 */
export const EXTERIOR_APERTURE = 2;
/** The gate's height, mm: the frame's vertical field of view is read on it. */
export const GATE_MM = 24;
/** The lens is focused this far into the house from the face it looks at. */
export const FOCUS_INTO = 1.5;
/** The air: from this far behind the house's farthest corner, over this much
 *  further, to this radius (a fraction of the buffer's width: ~1.5 px at 1920). */
export const FAR_FROM = 40;
export const FAR_RAMP = 120;
export const FAR_SOFT = 0.0008;

/** The house as the lens must hold it: the mansion's box, to the urns on its
 *  parapet (the roof is flat; the cupola and its spire are gone), as eight
 *  corners. */
export const HOUSE_CORNERS: readonly THREE.Vector3[] = (() => {
  const box = new THREE.Box3();
  for (const b of ESTATE_ARCHITECTURE) {
    if (b.name !== 'mansion') continue;
    box.expandByPoint(new THREE.Vector3(...b.min)).expandByPoint(new THREE.Vector3(...b.max));
  }
  const out: THREE.Vector3[] = [];
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) out.push(new THREE.Vector3(x, y, z));
  return out;
})();

const HOUSE_BOX = new THREE.Box3().setFromPoints(HOUSE_CORNERS as THREE.Vector3[]);
const HOUSE_CENTRE = HOUSE_BOX.getCenter(new THREE.Vector3());

const toCorner = new THREE.Vector3();
const sight = new THREE.Ray();
const sighted = new THREE.Vector3();
/** Depth along `axis` (unit) from `eye` at which the air begins to soften the
 *  land: FAR_FROM behind the house's farthest corner. */
export function focusStartFor(eye: THREE.Vector3, axis: THREE.Vector3): number {
  let far = 0;
  for (const c of HOUSE_CORNERS) far = Math.max(far, toCorner.copy(c).sub(eye).dot(axis));
  return far + FAR_FROM;
}
/**
 * The distance the exterior lens is focused at: where its axis meets the
 * house, and FOCUS_INTO beyond — the face it is pointed at, as an operator
 * pulls focus. An axis that misses the house (none on the film's path does)
 * focuses at the house's middle.
 */
export function focusDistanceFor(eye: THREE.Vector3, axis: THREE.Vector3): number {
  sight.set(eye, axis);
  const at = sight.intersectBox(HOUSE_BOX, sighted);
  const d = at ? at.distanceTo(eye) + FOCUS_INTO : toCorner.copy(HOUSE_CENTRE).sub(eye).dot(axis);
  return Math.max(2, d);
}
/**
 * The lens's blur RADIUS in buffer pixels per unit of |d - s| / d: half the
 * circle of confusion at infinity, on a gate `bufferHeight` pixels tall.
 * `cotHalfFov` is the projection's own [5], 1 / tan(fov / 2).
 */
export function lensGain(
  cotHalfFov: number,
  focus: number,
  bufferHeight: number,
  aperture = EXTERIOR_APERTURE,
): number {
  const f = (GATE_MM / 2) * cotHalfFov;
  const atInfinity = (f * f) / (aperture * Math.max(1, focus * 1000 - f));
  return 0.5 * (atInfinity / GATE_MM) * bufferHeight;
}
/** The exterior's blur radius at depth `d`, buffer pixels, as the shader has it. */
export function exteriorBlur(
  d: number,
  focus: number,
  gain: number,
  airStart: number,
  bufferWidth: number,
): number {
  const coc = (gain * Math.abs(d - focus)) / Math.max(d, 0.5);
  const air = FAR_SOFT * bufferWidth * Math.min(1, Math.max(0, (d - airStart) / FAR_RAMP));
  return Math.min(Math.max(coc, air), FOCUS_RADIUS * bufferWidth);
}
/** The largest blur the lens gives, as a fraction of the buffer width: ~8 CSS
 *  px at 1440. Outside it is a ceiling the lens reaches only on what brushes
 *  past it. */
export const FOCUS_RADIUS = 0.0055;

/** Contact occlusion: the reach of the occlusion, metres, and its weight. */
// 2.0 / 0.9 -> 2.6 / 1.0 with the Vertex3D review: "deep ambient occlusion
// shadows ... so they don't look like they are floating". 1.0 -> 1.25 with the
// fourth art-direction critique: "There is no ambient occlusion (deep shadows
// where objects meet)" — the reach kept, the contact made deeper.
export const AO_RADIUS = 2.6;
export const AO_STRENGTH = 1.25;
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
        ['focusRamp', new THREE.Uniform(FAR_RAMP)],
        ['focusNear', new THREE.Uniform(0)],
        ['nearRamp', new THREE.Uniform(1)],
        ['radiusPx', new THREE.Uniform(4)],
        ['strength', new THREE.Uniform(0)],
        ['lensK', new THREE.Uniform(0)],
        ['focusDist', new THREE.Uniform(0)],
        ['farSoft', new THREE.Uniform(0)],
        ['aoTan', new THREE.Uniform(new THREE.Vector2(1, 1))],
        ['aoOff', new THREE.Uniform(new THREE.Vector2(0, 0))],
        ['aoPxPerM', new THREE.Uniform(1000)],
        ['aoRadius', new THREE.Uniform(AO_RADIUS)],
        ['aoStrength', new THREE.Uniform(0)],
        ['invView', new THREE.Uniform(new THREE.Matrix4())],
        ['prevViewProj', new THREE.Uniform(new THREE.Matrix4())],
        ['shutter', new THREE.Uniform(0)],
      ]),
    });
    this.reduced =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  }

  /** The camera the frame is rendered with; LensFocus sets it. */
  camera: THREE.Camera | null = null;
  /** The next frame is a new shot: no smear across it. */
  cut(): void {
    this.hasPrev = false;
  }
  private reduced = false;
  private hasPrev = false;
  private readonly prevVP = new THREE.Matrix4();
  private readonly vp = new THREE.Matrix4();
  private readonly prevPos = new THREE.Vector3();
  private readonly prevQuat = new THREE.Quaternion();
  /**
   * Once per frame, as the composer renders — after every useFrame has moved
   * the camera — so the two matrices are this frame's and the last one's.
   */
  update(): void {
    const cam = this.camera;
    const u = this.uniforms;
    if (!cam) return;
    cam.updateMatrixWorld();
    this.vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    (u.get('invView')!.value as THREE.Matrix4).copy(cam.matrixWorld);
    (u.get('prevViewProj')!.value as THREE.Matrix4).copy(this.hasPrev ? this.prevVP : this.vp);
    // A CUT is not a pan: more than MB_CUT_M of travel or MB_CUT_RAD of turn in
    // one frame is a new shot, and a new shot has no smear.
    const cut =
      !this.hasPrev ||
      cam.position.distanceTo(this.prevPos) > MB_CUT_M ||
      cam.quaternion.angleTo(this.prevQuat) > MB_CUT_RAD;
    u.get('shutter')!.value = this.reduced || cut ? 0 : MB_SHUTTER;
    this.prevVP.copy(this.vp);
    this.prevPos.copy(cam.position);
    this.prevQuat.copy(cam.quaternion);
    this.hasPrev = true;
  }
}

/** Half a frame: the 180-degree shutter of film. */
export const MB_SHUTTER = 0.5;
/** The longest smear, in buffer pixels. */
export const MB_MAX_PX = 28;
/** A frame's travel or turn beyond which the camera has cut, not moved. */
export const MB_CUT_M = 4;
export const MB_CUT_RAD = 0.35;

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
  const shown = useRef(doorwayState.sceneLeg);
  useFrame(({ camera, gl }) => {
    effect.camera = camera;
    const u = effect.uniforms;
    // THE SETS HAVE CHANGED BEHIND THE DOORWAY (the continuous passage): the
    // camera is the same eye in the other model's coordinates, half a metre
    // from where the last frame's matrices put it. That is not motion, and a
    // shutter must not smear it.
    if (doorwayState.sceneLeg !== shown.current) {
      shown.current = doorwayState.sceneLeg;
      effect.cut();
    }
    // Outside: on the exterior film under the daylight print. Inside: on the
    // subject InteriorStage names, weighted by how much the camera is on it.
    // Anywhere else the lens eases to zero and stays out of the way (a prop,
    // not a remount: the effect instance and its pass live for the life of the
    // tier).
    const inside = journeyState.leg === 'interior';
    // THE DOOR PASSAGE HAS THE LENS (doorway.ts): on the way in it holds the
    // door frame while the camera rushes it, so the dark beyond is soft; on
    // the far side it racks from the door at the camera's back out to the far
    // wall as the iris opens. Its own focus and strength, followed fast — the
    // passage is authored to the millisecond and the lens is part of it.
    const door = doorwayState.mode === 'running' ? doorwayState.channels : null;
    const on = door
      ? door.defocus
      : !active
        ? 0
        : inside
          ? lensSubject.weight
          : journeyState.leg === 'exterior'
            ? 1
            : 0;
    const s = u.get('strength')!;
    s.value += (on - s.value) * (door ? 0.5 : 0.08);
    camera.getWorldDirection(axis);
    gl.getDrawingBufferSize(buffer);
    // Occlusion outside, and inside at a shorter reach: the hall's bake holds
    // its walls and corners, but the tables, the urns, the balusters and the
    // stair nosings are not in it and floated on the marble (the second client
    // review: "the spaces under the tables lack ambient occlusion").
    // THROUGH THE OPEN DOOR the room fills the frame before the sets change
    // (doorway.ts, 'through'), and the estate's occlusion on it — two and a
    // half metres of reach at 1.25 — is not the room's. It stepped to the
    // room's on the frame the page landed, two frames before the sets changed:
    // MEASURED, every crease of the stair five to twenty per cent lighter from
    // one frame to the next. So it goes over with the print (passageLight.grade),
    // and is the room's by the time the camera is at the sill.
    const ao = u.get('aoStrength')!;
    const toHall = journeyState.leg === 'interior' ? 1 : passageLight.grade;
    const aoOn = !active ? 0 : aoLook.strength + (AO_HALL.strength - aoLook.strength) * toHall;
    u.get('aoRadius')!.value = aoLook.radius + (AO_HALL.radius - aoLook.radius) * toHall;
    // Followed, and through the door held to it: the passage is authored to
    // the frame, and a strength still easing after the sets change is a room
    // that lightens for half a second on arrival.
    ao.value += (aoOn - ao.value) * (door ? 0.5 : 0.08);
    if (ao.value < 1e-3) ao.value = aoOn === 0 ? 0 : ao.value;
    const pm = camera.projectionMatrix.elements;
    (u.get('aoTan')!.value as THREE.Vector2).set(1 / pm[0], 1 / pm[5]);
    (u.get('aoOff')!.value as THREE.Vector2).set(pm[8], pm[9]);
    u.get('aoPxPerM')!.value = 0.5 * buffer.y * pm[5];
    const lensK = u.get('lensK')!;
    if (door) {
      // Focus 0 is the door plane outside; anything else is metres. The dark
      // vestibule is 1.4 m behind the leaves, so a lens on the frame reads it
      // as the soft dark it would be.
      const dist =
        door.focus > 0 ? door.focus : Math.max(0.5, camera.position.z - DOORWAY.doorPlaneZ);
      u.get('focusStart')!.value = dist + 0.6;
      u.get('focusRamp')!.value = Math.max(1.5, dist * 0.6);
      u.get('focusNear')!.value = 0;
      u.get('radiusPx')!.value = HALL_RADIUS * buffer.x;
      lensK.value = 0;
    } else if (inside) {
      const depth = toSubject.copy(lensSubject.point).sub(camera.position).dot(axis);
      u.get('focusStart')!.value = Math.max(0.5, depth) + HALL_MARGIN;
      u.get('focusRamp')!.value = HALL_RAMP;
      u.get('focusNear')!.value = 0;
      u.get('radiusPx')!.value = HALL_RADIUS * buffer.x;
      lensK.value = 0;
    } else {
      // The thin lens, focused on the face of the house it is pointed at; the
      // focus is PULLED, not snapped, as the camera travels (and set outright
      // on the first frame out of the hall or the door).
      const focus = u.get('focusDist')!;
      const want = focusDistanceFor(camera.position, axis);
      focus.value = lensK.value > 0 ? focus.value + (want - focus.value) * 0.2 : want;
      lensK.value = lensGain(pm[5], focus.value, buffer.y);
      u.get('focusStart')!.value = focusStartFor(camera.position, axis);
      u.get('focusRamp')!.value = FAR_RAMP;
      u.get('farSoft')!.value = FAR_SOFT * buffer.x;
      u.get('focusNear')!.value = 0;
      u.get('radiusPx')!.value = FOCUS_RADIUS * buffer.x;
    }
  });
  return <primitive ref={ref} object={effect} />;
});
