// apps/monolith/src/lib/cameraPath.ts
//
// The camera's journey — MASTER_SPEC §5, L7.
//
// Beats are the ACT structure from §1, grounded in the real inventory:
//
//   I   THE CORRIDOR   coast → NH-16 → airport → the parcel
//   II  THE LAND       orbit the parcel: plotting grid, the lake, plantation
//   III THE THRESHOLD  approach and breach the model duplex villa
//   IV  THE STANDOFF   hold, then push to the aperture
//
// L7 — THE RATIO THAT MATTERS:
//
//     camera arc length / scroll viewports  ≥  12 metres per viewport
//
// This is asserted by scripts/path-check.mjs, not left to judgement, because
// the failure it prevents already shipped once: on apps/public a scroll track
// was lengthened 6x to fix pacing while the camera path stayed the same length.
// Travel per screen dropped to a sixth and the camera was reported as
// completely dead — while moving correctly. Percentages alone do not protect
// against it.
//
// Scale note: this is a landscape at district scale, so the numbers are large.
// One unit = one metre. The corridor descent covers ~1.4km of altitude change.

import * as THREE from 'three';

export interface Beat {
  /** Scroll progress where this vantage lands. Mirrors continuity.ts beats. */
  at: number;
  position: [number, number, number];
  target: [number, number, number];
  label: string;
}

/**
 * ACT I — THE CORRIDOR.
 *
 * Opens close and abstract per §5: a single detail, illegible, at 28° FOV. The
 * "detail" here is ground — a survey stone, a field edge — so the first frame
 * cannot be read as landscape until the punch at q 0.10 pulls back and reveals
 * that it was a district all along.
 *
 * Y and Z run on separate curves by construction: the beats bias the Y-rise to
 * LAG the Z-pullback, which is the asymmetry that reads as mass rather than as
 * a drone shot.
 */
export const BEATS: readonly Beat[] = [
  {
    at: 0.0,
    position: [2.0, 1.6, 6.0],
    target: [0.0, 0.9, 0.0],
    label: 'I · Void — a survey stone, unreadable',
  },
  {
    at: 0.04,
    position: [8.0, 4.2, 18.0],
    target: [0.0, 1.2, 0.0],
    label: 'I · Drop begins — lateral drift, no scale yet',
  },
  {
    at: 0.10,
    position: [40.0, 120.0, 210.0],
    target: [0.0, 6.0, 0.0],
    label: 'I · The punch — scale arrives',
  },
  {
    at: 0.18,
    position: [90.0, 340.0, 560.0],
    target: [0.0, 10.0, -40.0],
    label: 'I · Scale reveal — the corridor, NH-16, the coast',
  },
  {
    at: 0.25,
    position: [120.0, 210.0, 380.0],
    target: [0.0, 8.0, 0.0],
    label: 'I · Settle — one parcel selected',
  },

  // ACT II — THE LAND. A 62° sweep around the visual centre of gravity of the
  // water, not the geometric centre of the parcel. Radius closes 400 → 150.
  {
    at: 0.32,
    position: [210.0, 150.0, 330.0],
    target: [10.0, 4.0, 20.0],
    label: 'II · Orbit entry — plotting grid rises',
  },
  {
    at: 0.38,
    position: [310.0, 128.0, 210.0],
    target: [12.0, 4.0, 24.0],
    label: 'II · Bank peak — plantation rows',
  },
  {
    at: 0.44,
    position: [330.0, 96.0, 60.0],
    target: [8.0, 3.0, 28.0],
    label: 'II · Water reveal — the lake',
  },
  {
    at: 0.50,
    position: [268.0, 62.0, -70.0],
    target: [0.0, 3.0, 20.0],
    label: 'II · Terminus — at the water, facing the villa',
  },

  // ACT III — THE THRESHOLD. Descend to human height and drive at the glass.
  // The signed distance to the glass plane, not q, drives the act's internals;
  // these beats put the camera where that distance is meaningful.
  {
    at: 0.58,
    position: [96.0, 14.0, -30.0],
    target: [0.0, 4.0, -6.0],
    label: 'III · Approach — the model duplex villa',
  },
  {
    at: 0.64,
    position: [26.0, 3.4, -12.0],
    target: [0.0, 3.0, -6.0],
    label: 'III · Threshold — roll dies to zero',
  },
  {
    at: 0.66,
    position: [12.0, 2.4, -8.4],
    target: [0.0, 2.4, -6.0],
    label: 'III · Breach — the glass dissolves',
  },
  {
    at: 0.70,
    position: [2.0, 2.0, -10.5],
    target: [-4.0, 2.0, -14.0],
    label: 'III · Interior — lateral drift for parallax',
  },
  {
    at: 0.75,
    position: [-2.0, 1.85, -13.0],
    target: [-7.0, 1.9, -17.5],
    label: 'III · Settle — the room holds',
  },

  // ACT IV — THE STANDOFF. Static until 0.82, then a cubic push at an aperture.
  {
    at: 0.82,
    position: [-2.0, 1.85, -13.0],
    target: [-7.0, 1.9, -17.5],
    label: 'IV · Pause ends — camera has not moved',
  },
  {
    at: 0.90,
    position: [-4.2, 1.85, -15.4],
    target: [-8.4, 1.9, -19.2],
    label: 'IV · Dolly push',
  },
  {
    at: 0.96,
    position: [-6.1, 1.85, -17.2],
    target: [-9.0, 1.9, -19.8],
    label: 'IV · Collapse begins',
  },
  {
    at: 1.0,
    position: [-7.4, 1.85, -18.4],
    target: [-9.3, 1.9, -20.1],
    label: 'IV · Silence — 5% of the aperture remains',
  },
];

/**
 * Centripetal Catmull-Rom through the beats.
 *
 * Centripetal specifically, not uniform: the legs are wildly uneven — the
 * corridor descent covers hundreds of metres while the Act IV push covers six.
 * Uniform Catmull-Rom on unevenly spaced control points overshoots on the long
 * legs, which here means the camera bulging through terrain between two
 * perfectly good keyframes.
 */
function curveThrough(pts: readonly [number, number, number][]) {
  return new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(...p)),
    false,
    'centripetal',
  );
}

export const POSITION_CURVE = curveThrough(BEATS.map((b) => b.position));
export const TARGET_CURVE = curveThrough(BEATS.map((b) => b.target));

/**
 * Remap scroll onto the curve parameter.
 *
 * NOT the identity. Beats sit at uneven `at` values so each lands under its
 * section, but the curve is parameterised evenly across its control points.
 * Without this remap, scrolling to a beat's `at` puts the camera NEAR that
 * vantage rather than ON it — so the frame that was rendered and approved is
 * never the frame that ships.
 */
export function curveT(q: number): number {
  const s = Math.min(1, Math.max(0, q));
  const n = BEATS.length - 1;
  for (let i = 0; i < n; i += 1) {
    const a = BEATS[i].at;
    const b = BEATS[i + 1].at;
    if (s <= b) {
      const local = b === a ? 0 : (s - a) / (b - a);
      return (i + local) / n;
    }
  }
  return 1;
}

/** Arc length in metres, for the L7 assertion. */
export function arcLength(samples = 2000): number {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  let total = 0;
  POSITION_CURVE.getPoint(0, a);
  for (let i = 1; i <= samples; i += 1) {
    POSITION_CURVE.getPoint(i / samples, b);
    total += a.distanceTo(b);
    a.copy(b);
  }
  return total;
}
