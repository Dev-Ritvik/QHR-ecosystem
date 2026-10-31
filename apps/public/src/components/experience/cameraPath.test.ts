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
  SWEEP_POSITION_CURVE,
  SWEEP_TARGET_CURVE,
  SWEEP_WAYPOINTS,
  ROOFLINE_AIM,
  exteriorPoseAt,
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

function sampleCurve(curve: THREE.CatmullRomCurve3, n: number, from = 0, to = 1): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i += 1) out.push(curve.getPoint(from + ((to - from) * i) / n));
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
  // THREE CURVES since the founder's layout (2026-10-28): the approved film to
  // the three-quarter, the sweep from there to the layout, and the descent
  // from the layout to the door, each read over its own stretch (the film's
  // curve runs on to the crane it no longer reaches, the sweep's begins at the
  // quarter it does not fly). Every contract below is held by all three.
  const SWEEP_FROM = 1 / (SWEEP_WAYPOINTS.length + 2);
  const CURVES = [
    { name: 'film', position: FILM_POSITION_CURVE, target: FILM_TARGET_CURVE, from: 0, to: 2 / 3 },
    { name: 'sweep', position: SWEEP_POSITION_CURVE, target: SWEEP_TARGET_CURVE, from: SWEEP_FROM, to: 1 },
    { name: 'approach', position: APPROACH_POSITION_CURVE, target: APPROACH_TARGET_CURVE, from: 0, to: 1 },
  ];
  const samples = CURVES.flatMap((c) =>
    sampleCurve(c.position, 600, c.from, c.to).map((p, i) => ({ curve: c.name, t: i / 600, p })),
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
      const pts = sampleCurve(c.position, 600, c.from, c.to);
      let worst = 0;
      for (let i = 1; i < pts.length - 1; i += 1) {
        const d2 = pts[i + 1].y - 2 * pts[i].y + pts[i - 1].y;
        worst = Math.max(worst, Math.abs(d2));
      }
      // 600 samples over ~90m of arc: a smooth curve keeps this in the
      // thousandths. A visible kink is an order of magnitude above. The second
      // difference scales with the path, so the bound grows with the estate,
      // and with the square of a curve's own step (the sweep is four times the
      // film's length over the same 600 samples).
      let length = 0;
      for (let i = 1; i < pts.length; i += 1) length += pts[i].distanceTo(pts[i - 1]);
      const step = Math.max(1, length / (90 * ESTATE_SCALE));
      expect(worst, c.name).toBeLessThan(0.01 * ESTATE_SCALE * step * step);
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

  it('flies the approved revolution exactly as it was, to the three-quarter', () => {
    // The founder's layout (2026-10-28) changed the film from the three-quarter
    // on. Everything before it is the approved film: the curve through the
    // approved beats as they were, the crane and the holdings included, read
    // on the approved ease.
    const approved = [0, 0.3, 0.58];
    expect(FILM_BEATS.map((b) => b.id)).toEqual(['hero', 'quarter', 'three-quarter', 'layout']);
    FILM_BEATS.slice(0, 3).forEach((b, i) => expect(b.at).toBeCloseTo(approved[i] * FILM_SHARE, 9));
    const grow = (v: number[]) => new THREE.Vector3(...v.map((c) => c * ESTATE_SCALE));
    const old = new THREE.CatmullRomCurve3(
      [new THREE.Vector3(-46, 20, 66), grow([-26, 9, 2]), grow([-15, 8.4, -19]), grow([-21, 15, -32]), grow([-24, 18, -42])],
      false,
      'centripetal',
    );
    const oldAt = [0, 0.3, 0.58, 0.82, 1].map((a) => a * FILM_SHARE);
    const p = new THREE.Vector3();
    const a = new THREE.Vector3();
    for (let s = 0; s <= oldAt[2]; s += 0.0025) {
      exteriorPoseAtSwing(s, p, a);
      const i = s <= oldAt[1] ? 0 : 1;
      const u = (i + (s - oldAt[i]) / (oldAt[i + 1] - oldAt[i])) / 4;
      expect(p.distanceTo(old.getPoint(u))).toBeLessThan(1e-6);
    }
    // Leg progress through the film maps onto swing space exactly as the old
    // single leg did, scaled.
    for (const s of [0.1, 0.3, 0.5, 0.8, 1]) {
      const was = 0.2 * s + 0.8 * (s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) * (1 - s));
      expect(exteriorSwing(s * FILM_SHARE)).toBeCloseTo(was * FILM_SHARE, 9);
    }
    // The curves meet at the layout beat and nowhere else.
    expect(APPROACH_BEATS[0]).toBe(FILM_BEATS[FILM_BEATS.length - 1]);
  });

  it('sweeps out to the layout on the revolution’s own line and speed, and never whips round', () => {
    // Joined: no step in where the camera is, and none in how fast it goes,
    // where the revolution hands over to the sweep and the sweep to the layout.
    const p = new THREE.Vector3();
    const q = new THREE.Vector3();
    const a = new THREE.Vector3();
    const VIEWPORT = 100 / (782 / FILM_SHARE);
    const legOf = (beat: (typeof BEATS)[number]) => {
      let lo = 0;
      let hi = FILM_SHARE;
      for (let i = 0; i < 60; i += 1) {
        const m = (lo + hi) / 2;
        if (exteriorSwing(m) < beat.at) lo = m;
        else hi = m;
      }
      return (lo + hi) / 2;
    };
    const tq = legOf(FILM_BEATS[2]);
    const speed = (leg: number) => {
      exteriorPoseAt(leg - 1e-5, p, a);
      exteriorPoseAt(leg + 1e-5, q, a);
      return { v: q.distanceTo(p) / 2e-5, dir: q.clone().sub(p).normalize() };
    };
    const before = speed(tq - 2e-4);
    const after = speed(tq + 2e-4);
    expect(after.v / before.v).toBeGreaterThan(0.95);
    expect(after.v / before.v).toBeLessThan(1.05);
    expect(after.dir.dot(before.dir)).toBeGreaterThan(0.999);
    // The turn about the house, a quarter of a viewport at a time: the
    // approach's own fastest is 63 degrees a viewport; the sweep is held near it.
    const bearing = (v: THREE.Vector3) => Math.atan2(v.z, v.x);
    let worst = 0;
    for (let leg = tq; leg < FILM_SHARE; leg += VIEWPORT / 4) {
      exteriorPoseAt(leg, p, a);
      exteriorPoseAt(Math.min(FILM_SHARE, leg + VIEWPORT / 4), q, a);
      let d = bearing(q) - bearing(p);
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      worst = Math.max(worst, Math.abs(d) * 4 * (180 / Math.PI));
    }
    expect(worst).toBeLessThan(72);
    // And it settles: the last quarter viewport before the layout, where the
    // chapter's copy is up, draws the camera back a few metres, not tens.
    exteriorPoseAt(FILM_SHARE - VIEWPORT / 4, p, a);
    exteriorPoseAt(FILM_SHARE, q, a);
    expect(q.distanceTo(new THREE.Vector3(...FILM_BEATS[3].position))).toBeLessThan(1e-6);
    expect(p.distanceTo(q)).toBeLessThan(12);
  });

  it('holds the house left of the middle at the layout beat, a building and not a dot', () => {
    // The founder's frame: the villa and its pool in the mid-left, the plotted
    // land across the foot and the right of the frame.
    const shot = frameAt(FILM_BEATS[3]);
    expect(shot.mansion.inFrame).toBe(true);
    const [x0, y0, x1, y1] = shot.mansion.box;
    const cx = (x0 + x1) / 2 / FRAME[0];
    const cy = (y0 + y1) / 2 / FRAME[1];
    expect(cx).toBeGreaterThan(0.3);
    expect(cx).toBeLessThan(0.5);
    expect(cy).toBeGreaterThan(0.4);
    expect(cy).toBeLessThan(0.65);
    expect(shot.mansion.widthPct).toBeGreaterThan(12);
    expect(shot.mansion.widthPct).toBeLessThan(30);
    void ROOFLINE_AIM;
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
      // a wide lens and starts reading as a fisheye. Under 30 outdoors the
      // parallax that sells the orbit disappears — so only the cover is held
      // on less (26: a still, an architectural photograph's long lens), and
      // the lens has opened past 30 by the time the orbit is under way.
      // (And the layout, the founder's aerial frame, on 22: a survey's long
      // lens from 250 m, opening again as the descent comes in.)
      const t = i / 100;
      expect(l.fov).toBeGreaterThanOrEqual(t < 0.05 ? 26 : t > 0.45 && t < 0.75 ? 22 : 30);
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
      const aims = sampleCurve(c.target, 200, c.from, c.to);
      const eyes = sampleCurve(c.position, 200, c.from, c.to);
      for (let i = 0; i < aims.length; i += 1) {
        const a = aims[i];
        if (a.y < 1.0) bad.push(`${c.name}: aim below the estate at y=${a.y.toFixed(2)}`);
        const d = eyes[i].distanceTo(a);
        // Under 8m the 19m-wide facade cannot fit any lens in the sequence; past
        // 70m it is a dot on a 450m plane. Both grow with the estate: the house
        // is 31 m across now, and the approved frames were grown with it.
        // (The sweep goes out to the layout's 130 m: on its 48-degree lens the
        // house is a sixth of the frame, not a dot.)
        if (d < 8 || d > (c.name === 'approach' && i > 60 ? 70 * ESTATE_SCALE : c.name === 'film' ? 70 * ESTATE_SCALE : 300)) {
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
