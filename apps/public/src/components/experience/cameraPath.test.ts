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
// obligation is recorded. The exterior's are generated into estateBounds.ts by
// tools/gltf/estate_bounds_v7.py — every solid, and every palm and tree.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  BEATS,
  APPROACH_BEATS,
  FILM_BEATS,
  FILM_SHARE,
  FILM_POSITION_CURVE,
  FILM_TARGET_CURVE,
  APPROACH_POSITION_CURVE,
  APPROACH_TARGET_CURVE,
  exteriorPoseAtSwing,
  exteriorSwing,
  lensAt,
  CONSTELLATION,
  CONSTELLATION_RADIUS,
  ESTATE_SCALE,
} from './cameraPath';
import {
  ESTATE_ARCHITECTURE,
  ESTATE_DOOR,
  ESTATE_PLANTING,
  ESTATE_PORTICO,
  ESTATE_SPIRE_TIP,
} from './estateBounds';
import {
  buildInteriorBeats,
  interiorCurves,
  interiorCurveT,
  stationViewpoint,
  STATION_ANCHORS,
} from './interiorPath';

type Box = { name: string; min: [number, number, number]; max: [number, number, number] };

/**
 * Solid volumes in exterior_estate_v7.glb the camera must stay outside: the
 * house, its podium and portico, the cupola and spire, the fountain, the canal,
 * the compound wall and hedges cell by cell, and every palm and tree on its own.
 *
 * Deliberately CONSERVATIVE — each is an axis-aligned hull, so a pass here is
 * stronger than the geometry strictly requires. The terrain is included as a
 * height check rather than a box, below.
 */
const EXTERIOR_SOLIDS: Box[] = [...ESTATE_ARCHITECTURE, ...ESTATE_PLANTING];

/**
 * Solid volumes in interior_hall.glb.
 *
 * The balustrade and the urns are the two that actually bite: the balustrade is
 * a wall from y 0.10 to 2.79 either side of the stairs, and the urns reach
 * y 1.56, which is 8cm under the camera's eye line.
 */
const INTERIOR_SOLIDS: Box[] = [
  // V7: the hall extended by bays (tools/blender/extend_hall_v7.py) — the room
  // is 19.8 x 15.4 x 8.0m, and every solid in it moved with the walls.
  { name: 'wall_left', min: [-10.2, 0, -8.0], max: [-9.9, 8.0, 8.0] },
  { name: 'wall_right', min: [9.9, 0, -8.0], max: [10.2, 8.0, 8.0] },
  { name: 'wall_back', min: [-10.2, 0, -8.0], max: [10.2, 8.0, -7.7] },
  { name: 'wall_front', min: [-10.2, 0, 7.7], max: [10.2, 8.0, 8.0] },
  { name: 'ceiling', min: [-9.9, 8.0, -7.7], max: [9.9, 8.1, 7.7] },
  // stair_step_0..11 plus the landing, as one wedge-free hull. Conservative:
  // the real stair is a ramp, so this box also covers the air above the lower
  // treads, and a camera is allowed there. Handled by the ramp test below.
  { name: 'stair_solid', min: [-3.25, 0, -8.55], max: [3.25, 3.47, -1.86] },
  { name: 'balustrade_r', min: [2.94, 0.13, -7.7], max: [3.19, 4.72, -1.64] },
  { name: 'balustrade_l', min: [-3.19, 0.13, -7.7], max: [-2.94, 4.72, -1.64] },
  { name: 'urn_l', min: [-5.19, 0, -2.05], max: [-4.21, 1.87, -1.05] },
  { name: 'urn_r', min: [4.21, 0, -2.05], max: [5.19, 1.87, -1.05] },
  { name: 'chandelier', min: [-1.01, 5.85, -0.14], max: [1.01, 7.85, 1.88] },
  { name: 'column_l', min: [-10.1, 0, -7.55], max: [-9.2, 7.46, 7.55] },
  { name: 'column_r', min: [9.2, 0, -7.55], max: [10.1, 7.46, 7.55] },
  { name: 'portrait', min: [-1.21, 3.95, -7.7], max: [1.21, 7.21, -7.5] },
  // TABLES, re-measured against the final delivery. The Ø0.58m pedestals
  // (half-extent 0.29, top 0.96) were replaced by Ø1.15m turned tables:
  // table_top_S1 spans x -6.52..-5.37 about a centre of -5.95, so a half-extent
  // of 0.575 with the top surface at 0.80. Boxed at 0.62 x 0.85 — conservative,
  // because each table carries an inward yaw and a square-footed veneer whose
  // axis-aligned hull is wider than the disc.
  //
  // This is the one obstacle in the room that changed. Every other bound below
  // was re-parsed from the new GLB and is identical.
  { name: 'table_S1', min: [-8.47, 0, 2.14], max: [-7.23, 0.85, 3.38] },
  { name: 'table_S2', min: [-6.69, 0, -6.14], max: [-5.45, 0.85, -4.9] },
  { name: 'table_S3', min: [7.23, 0, -1.93], max: [8.47, 0.85, -0.69] },
  { name: 'table_S4', min: [7.23, 0, 4.32], max: [8.47, 0.85, 5.56] },
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
  if (z > -1.86) return 0;
  if (z < -6.96) return 3.47;
  return 0.275 + ((-1.86 - z) / (6.96 - 1.86)) * (3.3 - 0.275);
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

const HOUSE = ESTATE_ARCHITECTURE.find((b) => b.name === 'mansion')!;
const SUBJECT_BOUNDS = {
  // The house on its podium, and the spire that tops it.
  mansion: { min: HOUSE.min, max: [HOUSE.max[0], ESTATE_SPIRE_TIP, HOUSE.max[2]] },
  spire: { min: [-0.3, ESTATE_SPIRE_TIP - 1.2, -0.3], max: [0.3, ESTATE_SPIRE_TIP, 0.3] },
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
    boxOf,
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
  // TWO CURVES since the approach to the front door was added — the approved
  // film, and the descent from the constellation to the door — meeting at the
  // constellation beat. Every contract below is held by both.
  const CURVES = [
    { name: 'film', position: FILM_POSITION_CURVE, target: FILM_TARGET_CURVE },
    { name: 'approach', position: APPROACH_POSITION_CURVE, target: APPROACH_TARGET_CURVE },
  ];
  const samples = CURVES.flatMap((c) =>
    sampleCurve(c.position, 600).map((p, i) => ({ curve: c.name, t: i / 600, p })),
  );

  it('never enters the estate geometry', () => {
    const hits: string[] = [];
    for (const { curve, t, p } of samples) {
      for (const solid of EXTERIOR_SOLIDS) {
        const d = distanceToBox(p, solid);
        if (d < NEAR_EXTERIOR) {
          hits.push(`${curve} t=${t.toFixed(3)} ${solid.name} d=${d.toFixed(2)}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('stays above the terrain by a usable margin', () => {
    // The v7 ground is flat inside the compound wall and rises to a 2.6 m
    // planted berm outside it. Every beat is inside the wall, where the floor
    // is 0, and "a usable margin" above the ground and the hedges is 2.0.
    //
    // The old assertion used 1.0 against a flat plane at y 0. Carrying it
    // forward unchanged would have passed a camera flying a few centimetres
    // over a rise.
    const low = samples
      .filter((s) => s.p.y < 2.0)
      .map((s) => `${s.curve} t=${s.t.toFixed(3)} y=${s.p.y.toFixed(2)}`);
    expect(low).toEqual([]);
  });

  it('holds a monotonic descent then climb, with no vertical kink', () => {
    // Catmull-Rom overshoot shows up first as a local extremum that is not a
    // beat. Sampling the second difference catches a bulge the box tests miss
    // because it happens in open air but still reads as a lurch.
    // Per curve: the join between them is a near-stop at the constellation,
    // not a point either curve has to be smooth across.
    for (const c of CURVES) {
      const pts = sampleCurve(c.position, 600);
      let worst = 0;
      for (let i = 1; i < pts.length - 1; i += 1) {
        const d2 = pts[i + 1].y - 2 * pts[i].y + pts[i - 1].y;
        worst = Math.max(worst, Math.abs(d2));
      }
      // 600 samples over ~90m of arc: a smooth curve keeps this in the
      // thousandths. A visible kink is an order of magnitude above. The second
      // difference scales with the path, so the bound grows with the estate.
      expect(worst, c.name).toBeLessThan(0.01 * ESTATE_SCALE);
    }
  });

  it('lands each beat exactly where it was authored', () => {
    // curveT is the whole reason the approved vantage is the one on screen. If
    // the remap and the curve ever disagree, every beat is "near" its pose and
    // none of them is it.
    const p = new THREE.Vector3();
    const a = new THREE.Vector3();
    for (const beat of BEATS) {
      exteriorPoseAtSwing(beat.at, p, a);
      expect(p.distanceTo(new THREE.Vector3(...beat.position)), beat.id).toBeLessThan(0.02);
      expect(a.distanceTo(new THREE.Vector3(...beat.target)), beat.id).toBeLessThan(0.02);
    }
  });

  it('keeps the approved film exactly where it was, inside the first FILM_SHARE', () => {
    // The approach was ADDED, not blended in. The approved beats keep their
    // positions and their spacing, rescaled into the film's share of the leg, so
    // every frame of the hero, the revolution and the constellation is the frame
    // that was signed off — at the same number of viewports of scroll.
    const approved = [0, 0.3, 0.58, 0.82, 1.0];
    expect(FILM_BEATS.map((b) => b.id)).toEqual([
      'hero', 'quarter', 'three-quarter', 'crane', 'constellation',
    ]);
    FILM_BEATS.forEach((b, i) => expect(b.at).toBeCloseTo(approved[i] * FILM_SHARE, 9));
    // Leg progress through the film maps onto swing space exactly as the old
    // single leg did, scaled.
    for (const s of [0.1, 0.3, 0.5, 0.8, 1]) {
      const old = 0.2 * s + 0.8 * (s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) * (1 - s));
      expect(exteriorSwing(s * FILM_SHARE)).toBeCloseTo(old * FILM_SHARE, 9);
    }
    // The two curves share the constellation beat and nothing else.
    expect(APPROACH_BEATS[0]).toBe(FILM_BEATS[FILM_BEATS.length - 1]);
  });

  it('holds the residence AND the network in one frame at the constellation', () => {
    // WAS "finishes with ...", when the constellation was the last beat. It is
    // now the held frame of its own chapter, with the approach to the door after
    // it (the client review required the film to reach the actual door), and
    // the composition contract below is unchanged — only which beat carries it.
    //
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
    const held = BEATS.find((b) => b.id === 'constellation')!;
    const shot = frameAt(held);

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

  it('ends square on the front door, on the entry axis', () => {
    // BY CLIENT REVIEW: the passage inside "must open from the actual door".
    // The doorway (doorway.ts) flies straight down the camera's view axis, so
    // the last frame of the exterior has to have the door ON that axis — not
    // near it, not framed right of a copy column.
    const last = BEATS[BEATS.length - 1];
    expect(last.id).toBe('door');
    expect(last.position[0]).toBe(0);
    expect(last.target[0]).toBe(0);
    expect(last.frameOffset).toBe(0);
    expect(last.roll).toBe(0);

    const shot = frameAt(last);
    // mansion_doors + door_relief, and the whole portico with its balcony.
    const door = shot.boxOf(ESTATE_DOOR);
    const portico = shot.boxOf(ESTATE_PORTICO);

    expect(door.inFrame).toBe(true);
    const [dx0, dy0, dx1, dy1] = door.box;
    // Centred left to right within 2% of the frame.
    expect(Math.abs((dx0 + dx1) / 2 - FRAME[0] / 2)).toBeLessThan(FRAME[0] * 0.02);
    // The unmistakable subject, not a detail and not a wall of wood.
    const doorHeightPct = ((dy1 - dy0) / FRAME[1]) * 100;
    expect(doorHeightPct).toBeGreaterThan(18);
    expect(doorHeightPct).toBeLessThan(40);
    // And the whole portico holds in frame around it.
    const [px0, py0, px1, py1] = portico.box;
    expect(px0).toBeGreaterThan(0);
    expect(px1).toBeLessThan(FRAME[0]);
    expect(py0).toBeGreaterThan(0);
    expect(py1).toBeLessThan(FRAME[1]);
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
    const bad: string[] = [];
    for (const c of CURVES) {
      const aims = sampleCurve(c.target, 200);
      const eyes = sampleCurve(c.position, 200);
      for (let i = 0; i < aims.length; i += 1) {
        const a = aims[i];
        if (a.y < 1.0) bad.push(`${c.name}: aim below the estate at y=${a.y.toFixed(2)}`);
        const d = eyes[i].distanceTo(a);
        // Under 8m the 19m-wide facade cannot fit any lens in the sequence; past
        // 70m it is a dot on a 450m plane. Both grow with the estate: the house
        // is 31 m across now, and the approved frames were grown with it.
        if (d < 8 || d > 70 * ESTATE_SCALE) {
          bad.push(`${c.name}: subject distance ${d.toFixed(1)}m at t=${(i / 200).toFixed(2)}`);
        }
      }
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
          if (Math.abs(p.x) <= 3.25 && p.z <= -1.86) {
            const floor = stairSurfaceY(p.z);
            if (p.y < floor + 0.6) {
              bad.push(`t=${(i / (samples.length - 1)).toFixed(3)} y=${p.y.toFixed(2)} tread=${floor.toFixed(2)}`);
            }
          }
          if (p.y < 0.5) bad.push(`below floor at ${p.y.toFixed(2)}`);
          if (p.y > 7.8) bad.push(`through ceiling at ${p.y.toFixed(2)}`);
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
