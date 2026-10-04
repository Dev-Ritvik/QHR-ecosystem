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
  APPROACH_AIM_FROM,
  ROOFLINE_AIM,
  curveTOver,
  exteriorPoseAtSwing,
  exteriorSwing,
  lensAt,
  ESTATE_SCALE,
} from './cameraPath';
import {
  ESTATE_ARCHITECTURE,
  ESTATE_DOOR,
  ESTATE_PLANTING,
  ESTATE_PORTICO,
  ESTATE_ROOF_TOP,
} from './estateBounds';
import {
  buildInteriorBeats,
  IMPERIAL_STAIR,
  interiorCurves,
  interiorCurveT,
  stairNosingY,
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
 * The imperial stair's flights as solids: each flight cut into narrow wedges
 * of plan angle, each wedge boxed from the floor to the top of its balustrade
 * rail at the wedge's upper end. The boxes of a curved wedge overlap the air
 * round it a little, which makes this conservative - a pass here is stronger
 * than the stone requires. Built from IMPERIAL_STAIR, the numbers the Blender
 * script used, so the model cannot drift from the stair it describes.
 */
function imperialFlights(): Box[] {
  const s = IMPERIAL_STAIR;
  const [cx, cz] = s.centre;
  const out: Box[] = [];
  const WEDGES = 30;
  for (const side of [1, -1]) {
    for (let k = 0; k < WEDGES; k += 1) {
      const a0 = s.thetaBottom + ((s.thetaTop - s.thetaBottom) * k) / WEDGES;
      const a1 = s.thetaBottom + ((s.thetaTop - s.thetaBottom) * (k + 1)) / WEDGES;
      const xs: number[] = [];
      const zs: number[] = [];
      for (const a of [a0, (a0 + a1) / 2, a1]) {
        for (const r of [s.rInner, s.rOuter]) {
          xs.push(cx + side * r * Math.cos(a));
          // plan angle runs toward the back wall, which is -z in three space
          zs.push(cz - r * Math.sin(a));
        }
      }
      out.push({
        name: `flight_${side > 0 ? 'r' : 'l'}${k}`,
        min: [Math.min(...xs), 0, Math.min(...zs)],
        max: [Math.max(...xs), stairNosingY(a1) + s.rail, Math.max(...zs)],
      });
    }
  }
  return out;
}

/**
 * Solid volumes in interior_hall.glb.
 *
 * The stair is the one that bites: two flights sweeping out to x +/-4.6 with a
 * rail 1.22 m over their treads, and a landing 4.2 m up across the back.
 */
const INTERIOR_SOLIDS: Box[] = [
  // THE IMPERIAL HALL (tools/blender/imperial_hall_v7.py): 19.8 x 15.4 m on
  // plan, walls to 13 m, coffered ceiling beams from 12.58, and a dome over the
  // centre to 19.2. The ceiling box stands for the beams; the dome is above it.
  { name: 'wall_left', min: [-10.2, 0, -8.0], max: [-9.9, 13.0, 8.0] },
  { name: 'wall_right', min: [9.9, 0, -8.0], max: [10.2, 13.0, 8.0] },
  { name: 'wall_back', min: [-10.2, 0, -8.0], max: [10.2, 13.0, -7.7] },
  { name: 'wall_front', min: [-10.2, 0, 7.7], max: [10.2, 13.0, 8.0] },
  { name: 'ceiling', min: [-9.9, 12.58, -7.7], max: [9.9, 13.1, 7.7] },
  ...imperialFlights(),
  // The landing, solid to the floor, with its balustrade along the curved front.
  {
    name: 'landing',
    min: [-IMPERIAL_STAIR.landingHalfWidth, 0, -7.7],
    max: [IMPERIAL_STAIR.landingHalfWidth, IMPERIAL_STAIR.landing + IMPERIAL_STAIR.rail, -5.39],
  },
  { name: 'newels_foot', min: [-2.81, 0, -1.04], max: [2.81, 1.76, 0.59] },
  { name: 'urn_l', min: [-3.8, 0, 5.9], max: [-2.8, 1.87, 6.9] },
  { name: 'urn_r', min: [2.8, 0, 5.9], max: [3.8, 1.87, 6.9] },
  { name: 'chandelier', min: [-1.46, 9.8, -1.46], max: [1.46, 12.7, 1.46] },
  { name: 'column_l', min: [-10.1, 0, -7.55], max: [-9.2, 12.45, 7.55] },
  { name: 'column_r', min: [9.2, 0, -7.55], max: [10.1, 12.45, 7.55] },
  { name: 'portrait', min: [-1.51, 5.0, -7.7], max: [1.51, 9.07, -7.46] },
  // TABLES, re-measured against the final delivery. The Ø0.58m pedestals
  // (half-extent 0.29, top 0.96) were replaced by Ø1.15m turned tables:
  // table_top_S1 spans x -6.52..-5.37 about a centre of -5.95, so a half-extent
  // of 0.575 with the top surface at 0.80. Boxed at 0.62 x 0.85 — conservative,
  // because each table carries an inward yaw and a square-footed veneer whose
  // axis-aligned hull is wider than the disc.
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
  // The house on its podium, and its roofline: the roof is flat since the
  // client had the spire, the cupola and the hip taken off (2026-10-01), so
  // the balustraded parapet and its urns are the top of the house.
  mansion: { min: HOUSE.min, max: [HOUSE.max[0], ESTATE_ROOF_TOP, HOUSE.max[2]] },
  roofline: { min: [-13.3, ESTATE_ROOF_TOP - 2.2, -8.6], max: [13.3, ESTATE_ROOF_TOP, 8.6] },
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

  return {
    boxOf,
    mansion: boxOf(SUBJECT_BOUNDS.mansion),
    roofline: boxOf(SUBJECT_BOUNDS.roofline),
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

  it("leaves the holdings beat on the flat roof's aim, and is on the approach's own curve by the flank", () => {
    // The aim came down 4 m at the holdings beat with the roof (ROOFLINE_AIM).
    // The approach's curve is still drawn from the old 16 m, so its frames from
    // the flank beat on are the frames they were; the difference is blended
    // out across the first segment.
    const p = new THREE.Vector3();
    const a = new THREE.Vector3();
    const held = BEATS.find((b) => b.id === 'holdings')!;
    const flank = BEATS.find((b) => b.id === 'dusk-flank')!;
    exteriorPoseAtSwing(held.at + 1e-6, p, a);
    expect(a.y).toBeCloseTo(ROOFLINE_AIM, 3);
    // No step at the join, and never back up above where it left from.
    let last = a.y;
    for (let s = held.at + 0.002; s <= flank.at; s += 0.002) {
      exteriorPoseAtSwing(s, p, a);
      expect(Math.abs(a.y - last)).toBeLessThan(0.12);
      expect(a.y).toBeLessThan(ROOFLINE_AIM + 0.05);
      last = a.y;
    }
    // From the flank on, the raw curve: untouched.
    for (const s of [flank.at, 0.8, 0.86, 0.95, 1]) {
      exteriorPoseAtSwing(s, p, a);
      const raw = APPROACH_TARGET_CURVE.getPoint(curveTOver(APPROACH_BEATS, s));
      expect(a.distanceTo(raw)).toBeLessThan(1e-9);
    }
    expect(APPROACH_AIM_FROM).toBe(16);
  });

  it('keeps the old aim on an upright screen: its copy stands above the house, not beside it', () => {
    const p = new THREE.Vector3();
    const wide = new THREE.Vector3();
    const tall = new THREE.Vector3();
    for (const id of ['crane', 'holdings']) {
      const beat = BEATS.find((b) => b.id === id)!;
      exteriorPoseAtSwing(beat.at, p, wide);
      exteriorPoseAtSwing(beat.at, p, tall, 1);
      expect(wide.y).toBeCloseTo(ROOFLINE_AIM, 3);
      expect(tall.y).toBeCloseTo(APPROACH_AIM_FROM, 3);
    }
    // The same camera, the same frames outside those two beats' reach (a
    // segment is shaped by the point after it, so the stretch before the
    // crane differs by a fraction of a millimetre), and no step where the two
    // curves meet.
    for (const s of [0, 0.1, 0.2, 0.86, 0.95, 1]) {
      exteriorPoseAtSwing(s, p, wide);
      const at = p.clone();
      exteriorPoseAtSwing(s, p, tall, 1);
      expect(p.distanceTo(at)).toBe(0);
      expect(tall.distanceTo(wide)).toBeLessThan(s === 0.2 ? 1e-3 : 1e-6);
    }
    exteriorPoseAtSwing(FILM_SHARE, p, wide, 1);
    exteriorPoseAtSwing(FILM_SHARE + 1e-6, p, tall, 1);
    expect(tall.distanceTo(wide)).toBeLessThan(0.01);
  });

  it('keeps the approved film exactly where it was, inside the first FILM_SHARE', () => {
    // The approach was ADDED, not blended in. The approved beats keep their
    // positions and their spacing, rescaled into the film's share of the leg, so
    // every frame of the hero, the revolution and the constellation is the frame
    // that was signed off — at the same number of viewports of scroll.
    const approved = [0, 0.3, 0.58, 0.82, 1.0];
    expect(FILM_BEATS.map((b) => b.id)).toEqual([
      'hero', 'quarter', 'three-quarter', 'crane', 'holdings',
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

  it('holds the residence at the holdings beat, with the left of frame clear', () => {
    // The composition contract of the chapter that held the constellation until
    // the second art-direction audit removed it: the house in frame as the
    // anchor, its roofline in shot, and the left of frame left to the copy column.
    const held = BEATS.find((b) => b.id === 'holdings')!;
    const shot = frameAt(held);

    expect(shot.mansion.inFrame, 'the residence is in the held frame').toBe(true);
    expect(shot.roofline.inFrame, 'and so is its roofline').toBe(true);

    // Present, and present as the anchor rather than as a detail or as the
    // whole shot. Under a fifth of frame width it stops being readable as a
    // building; past two thirds it is a second hero and the chapter has not
    // moved.
    expect(shot.mansion.widthPct).toBeGreaterThan(20);
    expect(shot.mansion.widthPct).toBeLessThan(66);

    // The roofline stands about the middle of the frame, against the evening
    // land, not at its foot: the aim came down with the roof (ROOFLINE_AIM).
    expect(shot.roofline.box[1]).toBeLessThan(FRAME[1] * 0.5);
    expect(shot.roofline.box[3]).toBeGreaterThan(FRAME[1] * 0.42);

    // The copy column runs down the left. Nothing may intrude on the first
    // quarter of the frame.
    expect(shot.mansion.box[0]).toBeGreaterThan(FRAME[0] * 0.25);
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

      it('stays above the floor and below the coffered ceiling', () => {
        const bad: string[] = [];
        for (let i = 0; i < samples.length; i += 1) {
          const p = samples[i];
          if (p.y < 0.5) bad.push(`below floor at ${p.y.toFixed(2)}`);
          if (p.y > 12.3) bad.push(`through ceiling at ${p.y.toFixed(2)}`);
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
      // Far enough back, FOR ITS LENS, that the frame holds the table top, the
      // plan and its title (about 1.45 m at the subject); close enough that the
      // plan reads. The title carries the name now, so the plan no longer has
      // to fill the frame to be legible. Judged as frame height rather than
      // distance, because one station (S2) stands nearer on a wider lens.
      const d = eye.distanceTo(aim);
      const fov = ((a.fov ?? 27) * Math.PI) / 180;
      expect(2 * d * Math.tan(fov / 2)).toBeGreaterThan(1.45);
      expect(d).toBeLessThan(4.4);
      // And inside the extended room, clear of its walls.
      expect(Math.abs(eye.x)).toBeLessThan(9.4);
      expect(Math.abs(eye.z)).toBeLessThan(7.2);
      for (const solid of INTERIOR_SOLIDS) {
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
