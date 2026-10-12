// apps/public/src/components/experience/exteriorWater.ts
//
// THE ESTATE'S WATER: ONE TREATMENT, for the pool, the canal and the fountain.
//
// The forensic audit of 2026-10-09, #17: "The pool is three different things
// in three chapters: a flat grey-blue sheet with no reflection, then a
// saturated turquoise rectangle in a muted dusk scene, then a low-resolution
// noise texture with visible blocks ... it never reflects the house beside it
// and changes character between chapters. Expected: one water treatment that
// reflects sky and house and holds its colour relationship to the scene
// through the evening." And #27: "The fountain's water is a flat cream ellipse
// and the parterre basins are flat grey mirrors ... Expected: dark water with
// a reflection and a rim shadow."
//
// WHAT WAS WRONG, measured on the running build before this file:
//
//   THE POOL HELD A PHOTOGRAPH OF ANOTHER HOUR. It reflected one of three
//   probes (day, evening, night), each taken once and shown at a gain of its
//   own: the evening's at 1.6, so that a pool looked down on "read as sky".
//   From the film's 40% the night comes on and the sky goes to a third; the
//   night's probe was not taken until the night was 0.8 on; and at the door
//   frame (48%, night 0.799) the water was still showing the sunset at 1.6:
//   a luma of 139 under a sky of 72. Water twice as bright as what it mirrors.
//
//   ITS COLOUR WAS PAINT. A turquoise albedo (0.05, 0.45, 0.52) lit by the sun
//   like a wall: the same blue at noon and at dusk, while everything round it
//   went to umber.
//
//   THE "NOISE TEXTURE WITH VISIBLE BLOCKS" was two things. The overflow
//   trough beside the pool is a slot a metre deep, and the lens's contact
//   occlusion (LensFocus.tsx) — six pairs of taps turned by a per-pixel noise
//   — printed that noise on its flat dark water as a stipple. And a 256-pixel
//   probe, magnified by a grazing view, showed its texels.
//
//   THE CANAL AND THE FOUNTAIN REFLECTED THE SKY AND NOTHING ELSE: the house
//   at the canal's head, the hedges along it, the fountain's own bowl over its
//   basin were not in them. Under a low sun that is a cream ellipse; under
//   cloud, a grey mirror.
//
// WHAT IT IS NOW. Still water is a dark mirror, and every sheet of it here is
// drawn as one:
//
//   A REFLECTION THAT IS OF THIS PLACE AND THIS HOUR. The pool and the canal
//   each have a probe: the estate photographed from just over the water into a
//   cube, read directly (no filtering to a roughness: it is a mirror), and
//   taken AGAIN whenever the film's hour has moved on by a step (HOUR_STEP), so
//   it is never more than a step behind; between takes its strength follows
//   the sky's own (the ratio of the sky now to the sky when it was taken).
//   No gain: water cannot be brighter than what it reflects.
//
//   WITH THE HOUSE WHERE A MIRROR WOULD PUT IT. A cube is right only at the
//   point it was taken from; over twenty metres of pool the house would slide.
//   So what stands near the water is given as upright planes (PROXIES: the
//   house's wall, the podium's balustrade, the hedges of the canal), the
//   reflected ray is met with them, and the cube is read toward the point it
//   meets. For anything ON such a plane that is exact. A ray that clears them
//   all reads the cube along itself (the sky, the far trees), unless the cube
//   would show it the house there, which this ray has cleared: then the sky.
//
//   WHAT STANDS IN THE WATER IS DRAWN IN IT. A round basin's own rim, the
//   pedestal and bowl of the fountain over it, the kerb of the canal and the
//   coping of the pool are met by the same ray as solids (a few cylinders and
//   a box) and shaded as the stone they are, by the sun and sky of the frame:
//   the dark band under a rim, the bowl's underside in the basin.
//
//   A REFLECTING POOL'S OWN FRESNEL. Water returns 2% of what is above it
//   looked straight down on, and that is a black pool from the film's high
//   frames. A dark-floored reflecting pool reads as a mirror from every angle
//   because nothing comes up through it; these are given that (WATER.f0), and
//   still go to a whole mirror at a glance, never past one.
//
//   NO CONTACT OCCLUSION. Occlusion is the sky hidden from a matte surface. A
//   mirror shows what it faces; the pass leaves water alone (ESTATE_EMITTER,
//   the mark the lit rooms already carry). The trough is dark because it is in
//   a slot (TROUGH_SHADE), by its height, with no noise in it.
//
// The numbers of the basins are the generator's (tools/blender/
// build_estate_v7.py: POOL, TERRACE, build_fountain, build_canal,
// build_gardens, podium_balustrade), restated in three's axes: x east, y up,
// z = -(the build's y).

import * as THREE from 'three';
import { ld, lookdevOn } from './lookdev';

export const WATER_RE = /^MAT_Water/;
export const POOL_RE = /^MAT_Water_Pool/;
/** The canal's water is the fountain's material in the file; it is given its
 *  own here (splitCanal), because it has a probe and the fountain has not. */
export const CANAL_MATERIAL = 'MAT_Water_Canal';
export const CANAL_MESH = 'canal_water';

export type WaterKind = 'pool' | 'canal' | 'fountain';

export function waterKind(name: string): WaterKind {
  return POOL_RE.test(name) ? 'pool' : name.startsWith(CANAL_MATERIAL) ? 'canal' : 'fountain';
}

/** The pool's sheet, its coping and the overflow trough beside it. */
export const POOL = { x0: -32.8, x1: -21.4, z0: -6.6, z1: 6.6, level: 0.455, coping: 0.52, trough: -0.42 } as const;
/** The canal behind the house, and the roundel at its far end. */
export const CANAL = { x0: -2, x1: 2, z0: -60, z1: -18, level: 0.12, kerb: 0.26 } as const;
export const ROUNDEL = { x: 0, z: -63.6, r: 3.0, level: 0.3, rim: 0.4 } as const;
/** The fountain on the forecourt's axis: its lower basin. */
export const FOUNTAIN = { x: 0, z: 30, r: 3.46, level: 0.44, rim: 0.6 } as const;

/** A solid of revolution standing in a basin: radius, foot and top, metres. */
type Tier = readonly [radius: number, foot: number, top: number];
/** The fountain's pedestal, its bowl, the stem over it and the upper bowl. */
export const FOUNTAIN_TIERS: readonly Tier[] = [
  [0.34, 0.44, 1.6],
  [1.93, 1.7, 1.96],
  [0.24, 1.96, 2.66],
  [1.0, 2.7, 2.9],
];
/** The roundel's stem and the dish on it. */
export const ROUNDEL_TIERS: readonly Tier[] = [
  [0.26, 0.3, 1.45],
  [0.7, 1.45, 1.6],
];

/**
 * An upright plane the water reflects: `across` is the axis it faces along,
 * `at` where it stands on that axis, `from`..`to` its run along the other, and
 * `top` its height. (Its foot is the ground.)
 */
export type Proxy = { across: 'x' | 'z'; at: number; from: number; to: number; top: number };

/** The house's block (HW 13.1, HD 7.8) to the top of its parapet, the podium's
 *  balustrade (17.4 by 12.2, a metre over a podium of 0.45), the day bed. */
const HOUSE_TOP = 10.5;
const BALUSTRADE_TOP = 1.5;
export const PROXIES: Record<Exclude<WaterKind, 'fountain'>, readonly Proxy[]> = {
  pool: [
    { across: 'x', at: -17.4, from: -12.2, to: 12.2, top: BALUSTRADE_TOP },
    { across: 'x', at: -13.1, from: -7.8, to: 7.8, top: HOUSE_TOP },
    { across: 'z', at: -10.2, from: -29.8, to: -23.8, top: 1.52 },
  ],
  canal: [
    { across: 'x', at: 3.2, from: -62, to: -16, top: 0.9 },
    { across: 'x', at: -3.2, from: -62, to: -16, top: 0.9 },
    { across: 'z', at: -12.2, from: -17.4, to: 17.4, top: BALUSTRADE_TOP },
    { across: 'z', at: -7.8, from: -13.1, to: 13.1, top: HOUSE_TOP },
  ],
};
export const MAX_PROXIES = 4;

/** Where each probe stands: over the middle of its water, a hand above it. */
export const PROBE_AT: Record<Exclude<WaterKind, 'fountain'>, readonly [number, number, number]> = {
  pool: [(POOL.x0 + POOL.x1) / 2, POOL.level + 0.35, 0],
  canal: [0, CANAL.level + 0.4, (CANAL.z0 + CANAL.z1) / 2],
};

/**
 * How far the film's hour (its evening or its night, each 0 to 1) may move
 * before a probe is taken again. At 0.15 a probe is at most one step of the
 * sun's colour behind, its strength corrected in between by the sky's own
 * (ExteriorModel, useWaterProbes): seven takes across the evening, seven
 * across the night, a face a frame.
 */
export const HOUR_STEP = 0.15;

/**
 * THE LOOK, in one place (and live under ?debug=1: lookdev.ts).
 *
 *   f0      what the water returns looked straight down on (a whole mirror at
 *           a glance, whatever this is). Real water is 0.02.
 *   rough   how far from a mirror: enough that a probe's texels and the sun's
 *           disc are both spread a little; "a mirror that breathes".
 *   sun     how much of the sun's own glint is kept. Whole, a low sun on
 *           ripples is a hot band that blooms.
 *   sat     how much of the reflection's colour is kept, by day and (`dusk`)
 *           once the evening is whole. The plate's zenith is bluer than
 *           anything the frame shows, and at dusk the print turns its darks
 *           warm (the client, 2026-10-01: "the blue shadows of this look
 *           cheap"): a mirror of that blue was a blue sheet in an umber
 *           picture. Half of it is given up by nightfall, so the water sits
 *           in the picture it is in. Measured at the film's 30%: the pool
 *           61, 80, 94 before this file, 59, 65, 71 with it, beside a terrace
 *           at 64, 59, 58.
 *   body    the pool's own colour under the reflection, against the file's.
 *   stone   the basins' stone as the water sees it (the trim's ivory), and how
 *           much brighter than a bare lambert the scene's sky makes it.
 */
export const WATER = {
  pool: { f0: 0.12, rough: 0.09, sun: 0.4, sat: 0.72, dusk: 0.5, body: 0.55 },
  canal: { f0: 0.16, rough: 0.08, sun: 0.4, sat: 0.8, dusk: 0.5, body: 1.0 },
  fountain: { f0: 0.14, rough: 0.08, sun: 0.4, sat: 0.85, dusk: 0.5, body: 1.0 },
  stone: [0.6, 0.55, 0.46] as readonly [number, number, number],
  stoneSky: 1.5,
  /** The trough's water against the pool's: it lies a metre down a slot. */
  troughShade: 0.34,
  /** The probe's own level of detail: a notch off its sharpest. */
  probeLod: 0.7,
} as const;

const far = () => new THREE.Vector4(1, 0, 1e9, -1e9);

function proxyUniforms(list: readonly Proxy[]): { a: THREE.Vector4[]; b: THREE.Vector4[] } {
  const a: THREE.Vector4[] = [];
  const b: THREE.Vector4[] = [];
  for (let i = 0; i < MAX_PROXIES; i += 1) {
    const p = list[i];
    // a: the plane as (nx, nz, d, top); b: its run along the other axis.
    a.push(p ? new THREE.Vector4(p.across === 'x' ? 1 : 0, p.across === 'z' ? 1 : 0, p.at, p.top) : far());
    b.push(p ? new THREE.Vector4(p.from, p.to, 0, 0) : new THREE.Vector4(0, 0, 0, 0));
  }
  return { a, b };
}

function tierUniforms(list: readonly Tier[]): THREE.Vector3[] {
  return Array.from({ length: 4 }, (_, i) => (list[i] ? new THREE.Vector3(...list[i]) : new THREE.Vector3(0, 0, 0)));
}

function uniformsFor(kind: WaterKind) {
  const look = WATER[kind];
  const proxies = proxyUniforms(kind === 'fountain' ? [] : PROXIES[kind]);
  const basin = kind === 'fountain' ? FOUNTAIN : kind === 'canal' ? ROUNDEL : null;
  const tiers = kind === 'fountain' ? FOUNTAIN_TIERS : kind === 'canal' ? ROUNDEL_TIERS : [];
  // A rectangular sheet and the top of what stands round it. The pool's west
  // side is its overflow: no coping there, so that side is nowhere.
  const box =
    kind === 'pool'
      ? new THREE.Vector4(-1e4, POOL.z0, POOL.x1, POOL.z1)
      : kind === 'canal'
        ? new THREE.Vector4(CANAL.x0, CANAL.z0, CANAL.x1, CANAL.z1)
        : new THREE.Vector4(0, 0, 0, 0);
  const boxTop = kind === 'pool' ? POOL.coping : kind === 'canal' ? CANAL.kerb : -1e4;
  const at = kind === 'fountain' ? [0, 0, 0] : PROBE_AT[kind];
  return {
    uWaterF0: { value: look.f0 as number },
    uWaterSun: { value: look.sun as number },
    uWaterSat: { value: look.sat as number },
    uWaterBody: { value: look.body as number },
    uProbe: { value: null as THREE.CubeTexture | null },
    uProbeOn: { value: 0 },
    uProbeAt: { value: new THREE.Vector3(at[0], at[1], at[2]) },
    uProbeGain: { value: 1 },
    uProbeLod: { value: WATER.probeLod as number },
    uProxyA: { value: proxies.a },
    uProxyB: { value: proxies.b },
    uBasin: { value: basin ? new THREE.Vector4(basin.x, basin.z, basin.r, basin.rim) : new THREE.Vector4(0, 0, 0, 0) },
    uTier: { value: tierUniforms(tiers) },
    uBoxRim: { value: box },
    uBoxRimTop: { value: boxTop },
  };
}

/** One clock and one stone for all of it; the rest is each water's own. */
export const waterShared = {
  uTime: { value: 0 },
  uPoolBox: { value: new THREE.Vector4(POOL.x0, POOL.z0, POOL.x1, POOL.z1) },
  uPoolLevel: { value: POOL.level },
  uTroughShade: { value: WATER.troughShade as number },
  uStone: { value: new THREE.Vector3(...WATER.stone) },
  uStoneSky: { value: WATER.stoneSky as number },
};

export const waterUniforms: Record<WaterKind, ReturnType<typeof uniformsFor>> = {
  pool: uniformsFor('pool'),
  canal: uniformsFor('canal'),
  fountain: uniformsFor('fountain'),
};

/**
 * The water's look at this hour (`evening`, 0 to 1: FilmGrade's filmState):
 * the reflection's colour, given up toward the dusk's. And, under ?debug=1,
 * the rest of it live (lookdev.ts). Call once a frame.
 */
export function followWaterHour(evening: number): void {
  const e = Math.min(1, Math.max(0, evening));
  const live = lookdevOn();
  for (const kind of ['pool', 'canal', 'fountain'] as const) {
    const u = waterUniforms[kind];
    const look = WATER[kind];
    const key = kind === 'pool' ? 'pool' : 'water';
    const day = live ? ld(`${key}Sat`, look.sat) : look.sat;
    const dusk = live ? ld(`${key}SatDusk`, look.dusk) : look.dusk;
    u.uWaterSat.value = day + (dusk - day) * e;
    if (!live) continue;
    u.uWaterF0.value = ld(`${key}F0`, look.f0);
    u.uWaterSun.value = ld(`${key}Sun`, look.sun);
    u.uWaterBody.value = ld(`${key}Body`, look.body);
    u.uProbeLod.value = ld('probeLod', WATER.probeLod);
  }
  if (!live) return;
  waterShared.uTroughShade.value = ld('troughShade', WATER.troughShade);
  waterShared.uStoneSky.value = ld('stoneSky', WATER.stoneSky);
}

export const WATER_FUNCTIONS = /* glsl */ `
uniform float uTime;
uniform vec4 uPoolBox;
uniform float uPoolLevel;
uniform float uTroughShade;
uniform vec3 uStone;
uniform float uStoneSky;
uniform float uWaterF0;
uniform float uWaterSun;
uniform float uWaterSat;
uniform float uWaterBody;
uniform samplerCube uProbe;
uniform float uProbeOn;
uniform vec3 uProbeAt;
uniform float uProbeGain;
uniform float uProbeLod;
uniform vec4 uProxyA[${MAX_PROXIES}];
uniform vec4 uProxyB[${MAX_PROXIES}];
uniform vec4 uBasin;
uniform vec3 uTier[4];
uniform vec4 uBoxRim;
uniform float uBoxRimTop;
varying vec3 vRipplePos;
// The rippled surface's normal in the world, and how much of its light this
// water keeps (the trough: TROUGH_SHADE).
vec3 waterNw = vec3(0.0, 1.0, 0.0);
float waterShade = 1.0;
// A pixel's reach across the water, metres.
float waterFw = 0.0;
// One train's slope: amplitude x wavenumber x cos, along its direction, faded
// out before its wavelength shrinks to a couple of pixels.
vec2 waterTrain(vec2 p, float lambda, float angle, float slope, float speed, float fw) {
  float k = 6.2831853 / lambda;
  vec2 d = vec2(cos(angle), sin(angle));
  float keep = 1.0 - smoothstep(lambda * 0.18, lambda * 0.5, fw);
  return d * slope * keep * cos(dot(d, p) * k - uTime * speed);
}
float waterCaustic(vec2 p, float t) {
  float r1 = abs(sin(p.x * 3.1 + sin(p.y * 2.3 + t * 0.8) * 1.2 + t * 0.6));
  float r2 = abs(sin(p.y * 2.7 + sin(p.x * 1.9 - t * 0.7) * 1.3 - t * 0.5));
  return pow(1.0 - min(r1, r2), 6.0);
}
// The nearest upright plane a ray from P along r meets (PROXIES): the point,
// and whether there is one.
vec4 waterProxy(vec3 P, vec3 r) {
  float best = 1.0e6;
  vec3 Q = vec3(0.0);
  float found = 0.0;
  for (int i = 0; i < ${MAX_PROXIES}; i++) {
    vec4 a = uProxyA[i];
    float along = a.x * r.x + a.y * r.z;
    if (abs(along) < 1.0e-4) continue;
    float t = (a.z - (a.x * P.x + a.y * P.z)) / along;
    if (t <= 0.02 || t >= best) continue;
    vec3 q = P + r * t;
    float run = a.x > 0.5 ? q.z : q.x;
    if (run < uProxyB[i].x || run > uProxyB[i].y || q.y > a.w) continue;
    best = t;
    Q = q;
    found = 1.0;
  }
  return vec4(Q, found);
}
vec3 waterProbe(vec3 dir) {
  return textureLod(uProbe, dir, uProbeLod).rgb * uProbeGain;
}
// The basins' stone as the frame's own sun and sky light it, facing N.
vec3 waterStone(vec3 N) {
  vec3 irr = ambientLightColor;
#if NUM_HEMI_LIGHTS > 0
  vec3 up = inverseTransformDirection(hemisphereLights[0].direction, viewMatrix);
  irr += mix(hemisphereLights[0].groundColor, hemisphereLights[0].skyColor, 0.5 + 0.5 * dot(N, up)) * uStoneSky;
#endif
#if NUM_DIR_LIGHTS > 0
  vec3 L = inverseTransformDirection(directionalLights[0].direction, viewMatrix);
  irr += directionalLights[0].color * max(dot(N, L), 0.0);
#endif
  return uStone * irr * RECIPROCAL_PI;
}
// How much of a rim a ray along r that clears it by 'over' metres (negative:
// meets it) is given: all of it well under the rim's top, none well over,
// and across the pixel that holds the top a share. A rim seen from far off
// is a band under a pixel deep, and a ripple moves the ray across its top
// from one pixel to the next: met or missed whole, it printed as a row of
// dashes. (The pixel's reach is the water's own, waterFw, by the ray's climb:
// no derivative is taken in here, inside a branch.)
float waterRim(float over, vec3 r) {
  float w = max(r.y * waterFw * 1.5, 1.0e-4);
  return 1.0 - smoothstep(-w, w, over);
}
// What stands in the water, or round it, and is met by a ray from P along r:
// its colour, and how much of the pixel it has.
vec4 waterStanding(vec3 P, vec3 r) {
  float best = 1.0e6;
  float share = 1.0;
  vec3 N = vec3(0.0, 1.0, 0.0);
  vec2 d = r.xz;
  float a = max(dot(d, d), 1.0e-6);
  // A round basin: its rim from inside, and the tiers on its axis.
  vec2 o = P.xz - uBasin.xy;
  if (uBasin.z > 0.0 && dot(o, o) < uBasin.z * uBasin.z && P.y < uBasin.w) {
    float b = dot(o, d);
    float tr = (-b + sqrt(max(b * b - a * (dot(o, o) - uBasin.z * uBasin.z), 0.0))) / a;
    float rim = waterRim(P.y + r.y * tr - uBasin.w, r);
    if (rim > 0.0) {
      best = tr;
      share = rim;
      vec2 q = -(o + d * tr) / uBasin.z;
      N = vec3(q.x, 0.0, q.y);
    }
    for (int i = 0; i < 4; i++) {
      vec3 tier = uTier[i];
      if (tier.x <= 0.0) continue;
      float disc = b * b - a * (dot(o, o) - tier.x * tier.x);
      if (disc > 0.0) {
        float t = (-b - sqrt(disc)) / a;
        float y = P.y + r.y * t;
        if (t > 0.0 && t < best && y > tier.y && y < tier.z) {
          best = t;
          share = 1.0;
          vec2 q = (o + d * t) / tier.x;
          N = vec3(q.x, 0.0, q.y);
        }
      }
      float tu = (tier.y - P.y) / max(r.y, 1.0e-4);
      vec2 qu = o + d * tu;
      if (tu > 1.0e-3 && tu < best && dot(qu, qu) < tier.x * tier.x) {
        best = tu;
        share = 1.0;
        N = vec3(0.0, -1.0, 0.0);
      }
    }
  }
  // A rectangular sheet: the kerb or coping round it, from inside. (The
  // sheet itself, a hand under its kerb: not the trough a metre below it.)
  if (uBoxRimTop > P.y && uBoxRimTop - P.y < 0.3
      && P.x > uBoxRim.x && P.x < uBoxRim.z && P.z > uBoxRim.y && P.z < uBoxRim.w) {
    float tx = r.x > 0.0 ? (uBoxRim.z - P.x) / max(r.x, 1.0e-5) : (uBoxRim.x - P.x) / min(r.x, -1.0e-5);
    float tz = r.z > 0.0 ? (uBoxRim.w - P.z) / max(r.z, 1.0e-5) : (uBoxRim.y - P.z) / min(r.z, -1.0e-5);
    float t = min(tx, tz);
    float rim = waterRim(P.y + r.y * t - uBoxRimTop, r);
    if (t < best && rim > 0.0) {
      best = t;
      share = rim;
      N = tx < tz ? vec3(-sign(r.x), 0.0, 0.0) : vec3(0.0, 0.0, -sign(r.z));
    }
  }
  if (best > 9.0e5) return vec4(0.0);
  return vec4(waterStone(N), share);
}
`;

export const WATER_NORMAL = /* glsl */ `
{
  vec2 p = vRipplePos.xz;
  float fw = length(fwidth(p));
  waterFw = fw;
  // A STILL EVENING (the paid audit of 2026-10-04, pass 4: "Water: does it
  // reflect the environment rather than simply being blue?"). Four trains of
  // near-equal slope crossed into a lattice of diamonds that the cover showed
  // as a printed pattern on the pool. Water in a walled garden at dusk is a
  // mirror that breathes: one long swell, a shorter one across it at a third
  // of its slope, and a trace of ripple. The sky and the house hold together
  // in the reflection, and only their edges move.
  vec2 g = waterTrain(p, 3.1, 0.3, 0.018, 0.9, fw)
         + waterTrain(p, 1.3, 2.1, 0.008, 1.4, fw)
         + waterTrain(p, 0.55, 4.0, 0.004, 2.2, fw)
         + waterTrain(p, 0.27, 5.3, 0.002, 3.1, fw);
  waterNw = normalize(vec3(-g.x, 1.0, -g.y));
  normal = normalize((viewMatrix * vec4(waterNw, 0.0)).xyz);
}
`;

export const WATER_COLOUR = /* glsl */ `
#ifdef WATER_POOL
{
  vec2 size = max(uPoolBox.zw - uPoolBox.xy, vec2(0.01));
  vec2 q = clamp(vRipplePos.xz - uPoolBox.xy, vec2(0.0), size);
  float edge = min(min(q.x, size.x - q.x), min(q.y, size.y - q.y));
  float deep = smoothstep(0.25, 2.2, edge);
  // A SLATE, WITH A LITTLE OF THE FILE'S TEAL LEFT IN IT. The file's water is
  // a resort's turquoise, and lit as paint it was the one saturated thing in
  // the dusk (the forensic audit, #17). What is under a reflecting pool's
  // surface is its dark floor seen through two metres of water.
  vec3 body = mix(vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), diffuseColor.rgb, 0.3) * uWaterBody;
  vec3 shallow = body * vec3(1.55, 1.55, 1.5);
  diffuseColor.rgb = mix(shallow, body * 0.5, deep);
  float fw = length(fwidth(vRipplePos.xz));
  float c = waterCaustic(vRipplePos.xz, uTime) * (1.0 - smoothstep(0.08, 0.25, fw));
  diffuseColor.rgb += c * (1.0 - 0.75 * deep) * vec3(0.02, 0.026, 0.026);
  // THE OVERFLOW AND ITS TROUGH lie below the sheet, in the slot's own shade.
  waterShade = mix(uTroughShade, 1.0, smoothstep(uPoolLevel - 0.35, uPoolLevel - 0.05, vRipplePos.y));
  diffuseColor.rgb *= waterShade;
}
#endif
`;

/** After three has set the surface up: a reflecting pool's own Fresnel. */
export const WATER_FRESNEL = /* glsl */ `
#include <lights_physical_fragment>
material.specularColor = vec3( uWaterF0 );
material.specularF90 = 1.0;
`;

/** After three has read the sky for it: what this water really faces. */
export const WATER_REFLECTION = /* glsl */ `
#include <lights_fragment_maps>
{
  vec3 wR = reflect(normalize(vRipplePos - cameraPosition), waterNw);
  wR.y = max(wR.y, 0.02);
  wR = normalize(wR);
  // the sky, as three read it at the water's own roughness
  vec3 seen = radiance;
#ifdef WATER_PROBE
  if (uProbeOn > 0.5) {
    vec4 hit = waterProxy(vRipplePos, wR);
    if (hit.w > 0.5) {
      seen = waterProbe(hit.xyz - uProbeAt);
    } else if (waterProxy(uProbeAt, wR).w < 0.5) {
      seen = waterProbe(wR);
    }
    // (else the probe, from where it stands, would show a wall along this ray
    // that the ray itself has cleared: the sky stands.)
  }
#endif
  seen = mix(vec3(dot(seen, vec3(0.2126, 0.7152, 0.0722))), seen, uWaterSat);
  vec4 stood = waterStanding(vRipplePos, wR);
  seen = mix(seen, stood.rgb, stood.a);
  radiance = seen * waterShade;
}
`;

/** After the lights are summed: the sun's own glint, held. */
export const WATER_SUN = /* glsl */ `
#include <lights_fragment_end>
reflectedLight.directSpecular *= uWaterSun * waterShade;
`;

const canals = new WeakMap<THREE.Material, THREE.Material>();

/**
 * Give the canal's mesh a material of its own (a copy of the fountain's, made
 * once for each source: drei shares the parse between mounts). Before the
 * polish, which finds its materials by name.
 */
export function splitCanal(root: THREE.Object3D): boolean {
  const mesh = root.getObjectByName(CANAL_MESH) as THREE.Mesh | undefined;
  if (!mesh?.isMesh || Array.isArray(mesh.material)) return false;
  const src = mesh.material as THREE.Material;
  if (src.name.startsWith(CANAL_MATERIAL)) return true;
  if (!WATER_RE.test(src.name) || POOL_RE.test(src.name)) return false;
  let own = canals.get(src);
  if (!own) {
    own = src.clone();
    own.name = CANAL_MATERIAL;
    canals.set(src, own);
  }
  mesh.material = own;
  return true;
}

/** Dress every water material under `root`. Returns how many there are. */
export function dressWater(root: THREE.Object3D): number {
  const seen = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial & { __water?: boolean };
      if (!mat || seen.has(mat) || !WATER_RE.test(mat.name)) continue;
      seen.add(mat);
      if (mat.__water) continue;
      mat.__water = true;
      const kind = waterKind(mat.name);
      const own = waterUniforms[kind];
      mat.roughness = WATER[kind].rough;
      mat.defines = {
        ...(mat.defines ?? {}),
        ESTATE_WATER: '',
        // seen by what it reflects: the contact occlusion leaves it alone
        ESTATE_EMITTER: '',
        ...(kind === 'pool' ? { WATER_POOL: '' } : {}),
        ...(kind === 'fountain' ? {} : { WATER_PROBE: '' }),
      };
      const prev = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        Object.assign(shader.uniforms, waterShared, own);
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', 'varying vec3 vRipplePos;\nvoid main() {')
          .replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvRipplePos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', `${WATER_FUNCTIONS}\nvoid main() {`)
          .replace('#include <color_fragment>', `#include <color_fragment>\n${WATER_COLOUR}`)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${WATER_NORMAL}`)
          .replace('#include <lights_physical_fragment>', WATER_FRESNEL)
          .replace('#include <lights_fragment_maps>', WATER_REFLECTION)
          .replace('#include <lights_fragment_end>', WATER_SUN);
      };
      mat.customProgramCacheKey = () => `estate-water-v4-${kind}`;
      mat.needsUpdate = true;
    }
  });
  return seen.size;
}
