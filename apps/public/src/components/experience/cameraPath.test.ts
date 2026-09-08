// apps/public/src/components/experience/cameraPath.test.ts
//
// The camera does not fly through the building.
//
// This project has shipped three cameras that reached a client aimed at a wall,
// aimed at nothing, and aimed at the outside of a building — every one of them
// a hand-converted coordinate nobody looked through. poses.ts documents all
// three. A curve is worse than a pose in that respect: Catmull-Rom through
// unevenly spaced control points OVERSHOOTS, so a path can pass through solid
// geometry between two keyframes that are each individually fine, and no amount
// of checking the keyframes will find it.
//
// tools/blender/audit_camera_path.py renders and scores the path, which is the
// right tool for "does this look good" and the wrong one for "does this clip":
// it needs Blender, a GPU and a human, so in practice it runs when someone
// remembers. This runs on every commit and answers only the question that can
// be answered arithmetically.
//
// THE BOUNDS BELOW ARE MEASURED, not estimated. They come from parsing the two
// GLBs' POSITION accessor min/max through each node's world matrix. If a model
// is re-exported these numbers must be re-derived, and this test is where that
// obligation is recorded.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  BEATS,
  POSITION_CURVE,
  TARGET_CURVE,
  curveT,
  lensAt,
  CONSTELLATION,
  CONSTELLATION_RADIUS,
} from './cameraPath';
import {
  buildInteriorBeats,
  interiorCurves,
  interiorCurveT,
  stationViewpoint,
  STATION_ANCHORS,
} from './interiorPath';

type Box = { name: string; min: [number, number, number]; max: [number, number, number] };

/**
 * Solid volumes in exterior_mansion.glb the camera must stay outside.
 *
 * Deliberately CONSERVATIVE — each is the axis-aligned hull of a family of
 * meshes, so a pass here is stronger than the geometry strictly requires. The
 * terrain is included as a half-space check rather than a box, below.
 */
const EXTERIOR_SOLIDS: Box[] = [
  // mansion_walls + rustic base course + terrace, hulled together.
  { name: 'mansion', min: [-9.64, 0, -6.54], max: [9.64, 6.95, 8.34] },
  // roof_peak, cupola, finials and the spire, as one stack over the centre.
  { name: 'roofstack', min: [-2.22, 6.83, -2.22], max: [2.22, 9.19, 2.22] },
  { name: 'spire', min: [-1.74, 7.6, -1.74], max: [1.74, 11.72, 1.74] },
  // fount_apron through fountain_jet.
  { name: 'fountain', min: [-4.2, 0, 9.0], max: [4.2, 2.67, 17.4] },
  { name: 'hedge_l', min: [-16.3, 0, -11.8], max: [-15.5, 0.95, 19.0] },
  { name: 'hedge_r', min: [15.5, 0, -11.8], max: [16.3, 0.95, 19.0] },
  { name: 'hedge_b', min: [-16.3, 0, -11.8], max: [16.3, 0.95, -11.0] },
  // The cypress rows, hulled per row rather than per tree.
  { name: 'cyp_left', min: [-27.52, 0, -12.49], max: [-26.48, 5.4, 20.49] },
  { name: 'cyp_right', min: [26.48, 0, -12.49], max: [27.52, 5.4, 20.49] },
  { name: 'cyp_back', min: [-18.52, 0, -16.49], max: [18.52, 5.4, -15.51] },
];

/**
 * Solid volumes in interior_hall.glb.
 *
 * The balustrade and the urns are the two that actually bite: the balustrade is
 * a wall from y 0.10 to 2.79 either side of the stairs, and the urns reach
 * y 1.56, which is 8cm under the camera's eye line.
 */
const INTERIOR_SOLIDS: Box[] = [
  { name: 'wall_left', min: [-7.8, 0, -5.6], max: [-7.5, 6.4, 5.6] },
  { name: 'wall_right', min: [7.5, 0, -5.6], max: [7.8, 6.4, 5.6] },
  { name: 'wall_back', min: [-7.8, 0, -5.6], max: [7.8, 6.4, -5.3] },
  { name: 'wall_front', min: [-7.8, 0, 5.3], max: [7.8, 6.4, 5.6] },
  { name: 'ceiling', min: [-7.5, 6.4, -5.3], max: [7.5, 6.5, 5.3] },
  // stair_step_0..11 plus the landing, as one wedge-free hull. Conservative:
  // the real stair is a ramp, so this box also covers the air above the lower
  // treads, and a camera is allowed there. Handled by the ramp test below.
  { name: 'stair_solid', min: [-2.6, 0, -5.98], max: [2.6, 2.76, -0.63] },
  { name: 'balustrade_r', min: [2.35, 0.1, -4.52], max: [2.55, 4.16, -0.3] },
  { name: 'balustrade_l', min: [-2.55, 0.1, -4.52], max: [-2.35, 4.16, -0.3] },
  { name: 'urn_l', min: [-3.83, 0, -0.9], max: [-3.01, 1.56, -0.07] },
  { name: 'urn_r', min: [3.01, 0, -0.9], max: [3.83, 1.56, -0.07] },
  { name: 'chandelier', min: [-0.77, 4.71, -0.17], max: [0.77, 6.25, 1.37] },
  { name: 'column_l', min: [-7.58, 0, -5.08], max: [-7.02, 5.96, 5.08] },
  { name: 'column_r', min: [7.02, 0, -5.08], max: [7.58, 5.96, 5.08] },
  { name: 'portrait', min: [-1.15, 2.75, -5.3], max: [1.15, 5.85, -5.1] },
  // TABLES, re-measured against the final delivery. The Ø0.58m pedestals
  // (half-extent 0.29, top 0.96) were replaced by Ø1.15m turned tables:
  // table_top_S1 spans x -6.52..-5.37 about a centre of -5.95, so a half-extent
  // of 0.575 with the top surface at 0.80. Boxed at 0.62 x 0.85 — conservative,
  // because each table carries an inward yaw and a square-footed veneer whose
  // axis-aligned hull is wider than the disc.
  //
  // This is the one obstacle in the room that changed. Every other bound below
  // was re-parsed from the new GLB and is identical.
  { name: 'table_S1', min: [-6.57, 0, 1.28], max: [-5.33, 0.85, 2.52] },
  { name: 'table_S2', min: [-5.22, 0, -4.42], max: [-3.98, 0.85, -3.18] },
  { name: 'table_S3', min: [5.33, 0, -1.52], max: [6.57, 0.85, -0.28] },
  { name: 'table_S4', min: [5.33, 0, 2.78], max: [6.57, 0.85, 4.02] },
];

/** Signed distance from a point to the outside of an axis-aligned box.
 *  Positive outside, negative inside. */
function distanceToBox(p: THREE.Vector3, b: Box): number {
  const dx = Math.max(b.min[0] - p.x, 0, p.x - b.max[0]);
  const dy = Math.max(b.min[1] - p.y, 0, p.y - b.max[1]);
  const dz = Math.max(b.min[2] - p.z, 0, p.z - b.max[2]);
  const outside = Math.hypot(dx, dy, dz);
  if (outside > 0) return outside;
  // Inside: report the negative of the shortest escape, so a violation reports
  // how deep it is rather than just "0".
  return -Math.min(
    p.x - b.min[0], b.max[0] - p.x,
    p.y - b.min[1], b.max[1] - p.y,
    p.z - b.min[2], b.max[2] - p.z,
  );
}

/** The stair is a ramp, not the box the hull above describes. A camera over the
 *  lower treads is fine; a camera inside the masonry is not. Tread surface
 *  height at a given z, from stair_step_0 (z -0.63, y 0.22) to stair_step_11
 *  (z -4.37, y 2.64), then the landing at 2.76. */
function stairSurfaceY(z: number): number {
  if (z > -0.63) return 0;
  if (z < -4.71) return 2.76;
  return 0.22 + ((-0.63 - z) / (4.71 - 0.63)) * (2.64 - 0.22);
}

function sampleCurve(curve: THREE.CatmullRomCurve3, n: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i += 1) out.push(curve.getPoint(i / n));
  return out;
}

// The camera's near plane, from CLIP in WorldCanvas. A point 0.5m outside a
// wall still renders the wall clipped in half, so clearance is measured against
// the near plane rather than against zero.
const NEAR_EXTERIOR = 0.5;
const NEAR_INTERIOR = 0.1;

// ── Composition ────────────────────────────────────────────────────────────
//
// A beat is a pose, and a pose says nothing about what is in shot. Phase 6B
// found that out expensively: the constellation beat aimed exactly where its
// test said it should and the frame it produced contained no building at all.
// So the last beat is also checked as a PICTURE, by projecting the measured
// bounds through it.
//
// This reproduces what WorldCanvas does to build the view matrix, including the
// frame offset — the aim is pushed `frameOffset` metres LEFT in CAMERA space,
// which is what holds a subject in the right of frame while the copy column
// occupies the left. A projection that ignores it puts every subject in the
// wrong half.

/** The reference frame these compositions were authored against. */
const FRAME: readonly [number, number] = [1440, 900];

const SUBJECT_BOUNDS = {
  // The mansion shell with its rustic base and the spire that tops it.
  mansion: { min: [-9.64, 0, -6.54], max: [9.64, 11.72, 8.34] },
  spire: { min: [-0.18, 9.19, -0.18], max: [0.18, 11.72, 0.18] },
} as const;

function frameAt(beat: (typeof BEATS)[number]) {
  const eye = new THREE.Vector3(...beat.position);
  const fwd0 = new THREE.Vector3(...beat.target).sub(eye).normalize();
  const right0 = new THREE.Vector3().crossVectors(fwd0, new THREE.Vector3(0, 1, 0)).normalize();
  // Shift the AIM, not the eye — the vantage is unchanged and only the
  // subject's place in the frame moves.
  const aim = new THREE.Vector3(...beat.target).addScaledVector(right0, -beat.frameOffset);
  const fwd = aim.clone().sub(eye).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd);
  const halfH = Math.tan((beat.fov * Math.PI) / 360);
  const halfW = halfH * (FRAME[0] / FRAME[1]);

  const project = (p: THREE.Vector3) => {
    const d = p.clone().sub(eye);
    const z = d.dot(fwd);
    return {
      z,
      sx: (d.dot(right) / (z * halfW)) * 0.5 * FRAME[0] + FRAME[0] / 2,
      sy: -(d.dot(up) / (z * halfH)) * 0.5 * FRAME[1] + FRAME[1] / 2,
    };
  };

  const boxOf = (b: { min: readonly number[]; max: readonly number[] }) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let anyFront = false;
    for (let i = 0; i < 8; i += 1) {
      const q = project(
        new THREE.Vector3(
          i & 1 ? b.max[0] : b.min[0],
          i & 2 ? b.max[1] : b.min[1],
          i & 4 ? b.max[2] : b.min[2],
        ),
      );
      if (q.z <= 0) continue;
      anyFront = true;
      minX = Math.min(minX, q.sx);
      maxX = Math.max(maxX, q.sx);
      minY = Math.min(minY, q.sy);
      maxY = Math.max(maxY, q.sy);
    }
    const onX = Math.min(maxX, FRAME[0]) - Math.max(minX, 0);
    const onY = Math.min(maxY, FRAME[1]) - Math.max(minY, 0);
    return {
      inFrame: anyFront && onX > 0 && onY > 0,
      box: [minX, minY, maxX, maxY],
      widthPct: ((maxX - minX) / FRAME[0]) * 100,
    };
  };

  const c = project(new THREE.Vector3(...CONSTELLATION));
  const rPx = (CONSTELLATION_RADIUS / (c.z * halfH)) * 0.5 * FRAME[1];
  const conBox = [c.sx - rPx, c.sy - rPx, c.sx + rPx, c.sy + rPx];

  return {
    mansion: boxOf(SUBJECT_BOUNDS.mansion),
    spire: boxOf(SUBJECT_BOUNDS.spire),
    constellation: {
      inFrame:
        c.z > 0 &&
        Math.min(conBox[2], FRAME[0]) - Math.max(conBox[0], 0) > 0 &&
        Math.min(conBox[3], FRAME[1]) - Math.max(conBox[1], 0) > 0,
      box: conBox,
      diameterPctH: ((rPx * 2) / FRAME[1]) * 100,
    },
  };
}

describe('exterior camera path', () => {
  const samples = sampleCurve(POSITION_CURVE, 600);

  it('never enters the estate geometry', () => {
    const hits: string[] = [];
    for (let i = 0; i < samples.length; i += 1) {
      for (const solid of EXTERIOR_SOLIDS) {
        const d = distanceToBox(samples[i], solid);
        if (d < NEAR_EXTERIOR) {
          hits.push(
            `t=${(i / (samples.length - 1)).toFixed(3)} ${solid.name} d=${d.toFixed(2)}`,
          );
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('stays above the terrain by a usable margin', () => {
    // The delivered ground is authored terrain, not a plane: it undulates from
    // y -2.97 to +0.97 across +/-120m. So the floor this path has to clear is
    // 0.97, not 0, and "a usable margin" above the highest ground is 2.0.
    //
    // The old assertion used 1.0 against a flat plane at y 0. Carrying it
    // forward unchanged would have passed a camera flying a few centimetres
    // over a rise.
    const low = samples
      .map((p, i) => ({ t: i / (samples.length - 1), y: p.y }))
      .filter((s) => s.y < 2.0);
    expect(low).toEqual([]);
  });

  it('holds a monotonic descent then climb, with no vertical kink', () => {
    // Catmull-Rom overshoot shows up first as a local extremum that is not a
    // beat. Sampling the second difference catches a bulge the box tests miss
    // because it happens in open air but still reads as a lurch.
    let worst = 0;
    for (let i = 1; i < samples.length - 1; i += 1) {
      const d2 =
        samples[i + 1].y - 2 * samples[i].y + samples[i - 1].y;
      worst = Math.max(worst, Math.abs(d2));
    }
    // 600 samples over ~90m of arc: a smooth curve keeps this in the
    // thousandths. A visible kink is an order of magnitude above.
    expect(worst).toBeLessThan(0.01);
  });

  it('lands each beat exactly where it was authored', () => {
    // curveT is the whole reason the approved vantage is the one on screen. If
    // the remap and the curve ever disagree, every beat is "near" its pose and
    // none of them is it.
    for (const beat of BEATS) {
      const p = POSITION_CURVE.getPoint(curveT(beat.at));
      expect(p.distanceTo(new THREE.Vector3(...beat.position))).toBeLessThan(0.02);
    }
  });

  it('finishes with the residence AND the network in one frame', () => {
    // THIS REPLACES "finishes aimed at the constellation, not past it", which
    // asserted that the final target IS the sphere centre.
    //
    // That assertion was satisfied by the shipped path and the shipped path was
    // the defect. With the sphere 46m out in open field behind the estate, the
    // only way to put it at frame centre was to turn the camera off the
    // building — and the frame that produced was photographed and counted:
    // mansion coverage 0.000 and FOUR draw calls, a terrain plane and a stock
    // sky. The old test passed on every one of those frames, because "aimed at
    // the sphere" says nothing about what else is in shot.
    //
    // The contract this chapter actually has is compositional, so the test is:
    // both subjects in frame, the sphere above the roof, and the left of frame
    // left clear for the copy column that sits beside them.
    const last = BEATS[BEATS.length - 1];
    const shot = frameAt(last);

    expect(shot.mansion.inFrame, 'the residence is in the final frame').toBe(true);
    expect(shot.constellation.inFrame, 'so is the network above it').toBe(true);

    // Present, and present as the anchor rather than as a detail or as the
    // whole shot. Under a fifth of frame width it stops being readable as a
    // building; past two thirds it is a second hero and the chapter has not
    // moved.
    expect(shot.mansion.widthPct).toBeGreaterThan(20);
    expect(shot.mansion.widthPct).toBeLessThan(66);

    // The sphere crowns the roof: its lowest point is above the spire's
    // highest, in SCREEN space, so nothing about the pose can bury one in the
    // other.
    expect(shot.constellation.box[3]).toBeLessThan(shot.spire.box[1]);

    // The copy column runs down the left. Nothing may intrude on the first
    // quarter of the frame.
    expect(Math.min(shot.mansion.box[0], shot.constellation.box[0])).toBeGreaterThan(
      FRAME[0] * 0.25,
    );
  });

  it('keeps the lens inside a believable range across the whole track', () => {
    for (let i = 0; i <= 100; i += 1) {
      const l = lensAt(i / 100);
      // Past ~70 the perspective distortion at the frame edge stops reading as
      // a wide lens and starts reading as a fisheye; under 30 outdoors the
      // parallax that sells the orbit disappears.
      expect(l.fov).toBeGreaterThanOrEqual(30);
      expect(l.fov).toBeLessThanOrEqual(70);
      // Past ~0.09 rad the horizon tilt reads as a broken camera.
      expect(Math.abs(l.roll)).toBeLessThan(0.09);
      expect(l.frameOffset).toBeGreaterThanOrEqual(0);
    }
  });

  it('aims somewhere that produces a filmable shot', () => {
    // NOT "the aim is outside solid geometry". The aim is the mansion's
    // centroid for three of the five beats, and a centroid is by definition
    // deep inside the thing it belongs to — framing a building means aiming at
    // the middle of it. An earlier version of this test asserted the opposite
    // and failed the correct path, which is worth recording: the useful
    // invariant is about the SHOT, not about the point.
    //
    // What actually goes wrong, and what poses.ts records going wrong twice, is
    // an aim below the ground (the camera pitches into the lawn) or a subject
    // distance outside the range a lens can hold.
    const aims = sampleCurve(TARGET_CURVE, 200);
    const eyes = sampleCurve(POSITION_CURVE, 200);
    const bad: string[] = [];
    for (let i = 0; i < aims.length; i += 1) {
      const a = aims[i];
      if (a.y < 1.0) bad.push(`aim below the estate at y=${a.y.toFixed(2)}`);
      const d = eyes[i].distanceTo(a);
      // Under 8m the 19m-wide facade cannot fit any lens in the sequence; past
      // 70m it is a dot on a 450m plane.
      if (d < 8 || d > 70) bad.push(`subject distance ${d.toFixed(1)}m at t=${(i / 200).toFixed(2)}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('interior camera path', () => {
  // Three published projects today. Tested at every count the model supports,
  // because the beat list is built from data and a path that is safe for three
  // stations is not automatically safe for four.
  for (const count of [0, 1, 2, 3, 4]) {
    describe(`with ${count} station(s)`, () => {
      const beats = buildInteriorBeats(count);
      const curves = interiorCurves(beats);
      const samples = sampleCurve(curves.position, 500);

      it('never enters the hall geometry', () => {
        const hits: string[] = [];
        for (let i = 0; i < samples.length; i += 1) {
          const p = samples[i];
          for (const solid of INTERIOR_SOLIDS) {
            if (solid.name === 'stair_solid') continue; // handled by the ramp test
            const d = distanceToBox(p, solid);
            if (d < NEAR_INTERIOR) {
              hits.push(
                `t=${(i / (samples.length - 1)).toFixed(3)} ${solid.name} d=${d.toFixed(2)}`,
              );
            }
          }
        }
        expect(hits).toEqual([]);
      });

      it('stays above the stair surface and below the ceiling', () => {
        const bad: string[] = [];
        for (let i = 0; i < samples.length; i += 1) {
          const p = samples[i];
          if (Math.abs(p.x) <= 2.6 && p.z <= -0.63) {
            const floor = stairSurfaceY(p.z);
            if (p.y < floor + 0.6) {
              bad.push(`t=${(i / (samples.length - 1)).toFixed(3)} y=${p.y.toFixed(2)} tread=${floor.toFixed(2)}`);
            }
          }
          if (p.y < 0.5) bad.push(`below floor at ${p.y.toFixed(2)}`);
          if (p.y > 6.2) bad.push(`through ceiling at ${p.y.toFixed(2)}`);
        }
        expect(bad).toEqual([]);
      });

      it('lands each beat exactly where it was authored', () => {
        for (const beat of beats) {
          const p = curves.position.getPoint(interiorCurveT(beats, beat.at));
          expect(p.distanceTo(new THREE.Vector3(...beat.position))).toBeLessThan(0.02);
        }
      });

      it('spans the full leg', () => {
        expect(beats[0].at).toBe(0);
        expect(beats[beats.length - 1].at).toBeCloseTo(1, 6);
      });
    });
  }

  it('stands the camera off every station without clipping its pedestal', () => {
    for (const a of STATION_ANCHORS) {
      const vp = stationViewpoint(a);
      const eye = new THREE.Vector3(...vp.position);
      const aim = new THREE.Vector3(...vp.target);
      // Far enough back that a 30-degree lens frames the table and the plan
      // above it, close enough that the plan is legible.
      const d = eye.distanceTo(aim);
      expect(d).toBeGreaterThan(1.8);
      expect(d).toBeLessThan(3.2);
      // And inside the room.
      expect(Math.abs(eye.x)).toBeLessThan(7.4);
      expect(Math.abs(eye.z)).toBeLessThan(5.2);
      for (const solid of INTERIOR_SOLIDS) {
        if (solid.name === 'stair_solid') continue;
        expect(distanceToBox(eye, solid)).toBeGreaterThan(NEAR_INTERIOR);
      }
    }
  });

  it('orders the stations left-front, left-back, right-back, right-front', () => {
    // The brief's floor plan is A1 -> A2 -> A3 -> A4 and the camera visits them
    // in array order, so the array order IS the choreography. A re-sort here
    // would silently send the camera across the hall twice.
    const [s1, s2, s3, s4] = STATION_ANCHORS;
    expect(s1.position[0]).toBeLessThan(0);
    expect(s2.position[0]).toBeLessThan(0);
    expect(s3.position[0]).toBeGreaterThan(0);
    expect(s4.position[0]).toBeGreaterThan(0);
    expect(s1.position[2]).toBeGreaterThan(s2.position[2]);
    expect(s4.position[2]).toBeGreaterThan(s3.position[2]);
  });
});
