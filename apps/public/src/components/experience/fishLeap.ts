// apps/public/src/components/experience/fishLeap.ts
//
// THE FOUNTAIN'S FISH, AND THE ARC IT LEAPS (the user, 2026-10-26: "Add a
// animation where the goldfish in the fountain outside the mansion must
// dolphin leap every time the user scrolls", and then a blue halfmoon betta
// as the fish).
//
// The fish is the client's generated model, in the estate's file as
// `fountain_fish` (tools/blender/build_estate_v7.py, fountain_fish): sixty
// centimetres, turned so its nose is +x in its own mesh, its middle at the
// origin. Between leaps it lies under the lower basin's water, which is drawn
// opaque. A scroll sends it up: out of the water, over in an arc, nose along
// its path, and back in, with a ring spreading on the water where it broke
// the surface and where it went back in.
//
// WHEN (asked of the user, 2026-10-26). The brief timed the leap from the
// wheel's eighth notch to its fourteenth; there the camera is round the side
// of the house and behind it, and the fountain is out of the frame and then
// behind the building. The user chose a leap on every scroll, while the
// fountain is in view: the cover and the first few notches.
//
// No DOM, no React: the arc, as numbers, for FountainFish.tsx to set.

import { FOUNTAIN } from './exteriorWater';

export const FISH_NAME = 'fountain_fish';

export const FISH = {
  /** Seconds a leap takes, from under the water to under it again. */
  duration: 1.4,
  /** Seconds it lies under before a scroll can send it up again. */
  rest: 0.35,
  /** How high its middle rises over the water, metres. */
  peak: 1.1,
  /** How deep its middle is at either end of the arc, under the surface. */
  under: 0.3,
  /** Its middle at rest, under the surface (its fins stand 0.175 over it). */
  restDepth: 0.2,
  /** The generated betta holds its head up in its own mesh by about this
   *  much (radians): taken off, so its body lies along its path. */
  tilt: 0.28,
  /** A ring on the water where it breaks the surface: its radius grows to
   *  this, metres, over `ringLife` seconds, and fades. */
  ring: 0.9,
  ringLife: 0.8,
} as const;

/** Where on the basin the arcs are: their middles this far from the
 *  fountain's centre, each arc this long. Out from the upper bowl's rim
 *  (radius 1.95 at 1.73 m) and inside the basin's (3.46) with the fish's half
 *  length to spare. */
const ARC_FROM_CENTRE = 2.45;
const ARC_HALF = 1.1;
/** The bearings (degrees, from three's +x toward +z) of the arcs' middles:
 *  the side of the basin that faces the film's first frames, whose camera
 *  comes from the south-west, so neither the stem nor the bowls stand between
 *  it and the leap. */
const BEARINGS = [160, 138, 182] as const;

export type Chord = readonly [readonly [number, number], readonly [number, number]];

/** The k-th arc, [from, to] on the water in the estate's own [x, z]. Each
 *  runs along the basin's curve, and they go round it one way and back. */
export function chord(k: number): Chord {
  const i = ((k % BEARINGS.length) + BEARINGS.length) % BEARINGS.length;
  const a = (BEARINGS[i] * Math.PI) / 180;
  const cx = FOUNTAIN.x + ARC_FROM_CENTRE * Math.cos(a);
  const cz = FOUNTAIN.z + ARC_FROM_CENTRE * Math.sin(a);
  // along the tangent; every other leap the other way round
  const s = Math.floor(k / BEARINGS.length) % 2 === 0 ? 1 : -1;
  const tx = -Math.sin(a) * s;
  const tz = Math.cos(a) * s;
  return [
    [cx - tx * ARC_HALF, cz - tz * ARC_HALF],
    [cx + tx * ARC_HALF, cz + tz * ARC_HALF],
  ];
}

export interface FishPose {
  x: number;
  y: number;
  z: number;
  /** Turn about +y, radians: the nose (+x) along the arc. */
  yaw: number;
  /** Nose up, radians, about the fish's own side. */
  pitch: number;
}

/** The fish at `t` (0..1) of a leap along `c`: a parabola from `under` below
 *  the water to `peak` over it and back, the body along its path. */
export function leapPose(t: number, c: Chord, level: number = FOUNTAIN.level): FishPose {
  const [a, b] = c;
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const rise = FISH.under + FISH.peak;
  const dy = rise * 4 * (1 - 2 * t);
  return {
    x: a[0] + dx * t,
    y: level - FISH.under + rise * 4 * t * (1 - t),
    z: a[1] + dz * t,
    yaw: Math.atan2(-dz, dx),
    pitch: Math.atan2(dy, Math.hypot(dx, dz)) - FISH.tilt,
  };
}

/** When in a leap it breaks the surface going up, and goes back in. */
export function surfaceTimes(): readonly [number, number] {
  const r = Math.sqrt(1 - FISH.under / (FISH.under + FISH.peak));
  return [(1 - r) / 2, (1 + r) / 2];
}
