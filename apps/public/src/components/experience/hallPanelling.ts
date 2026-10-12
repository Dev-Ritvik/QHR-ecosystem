// apps/public/src/components/experience/hallPanelling.ts
//
// THE HALL'S PANELLING, FRAMED.
//
// The forensic audit of 2026-10-09 (#36, HIGH): "The wainscot is a set of flat
// dark slabs fixed proud of the wall with no frame, rail or moulding, hanging
// above the skirting with a gap. Several are half washed pale grey and half
// black ... These panels are the background of all three layout tables, which
// is to say of the product. Expected: framed panelling with stiles, rails and
// a dado, lit evenly, in one timber."
//
// WHAT THE SLABS WERE. Eighteen copies of one rounded box (wallpanel_*, 2.11 m
// by 2.07 m and FIFTY-SIX centimetres thick), sunk into the wall so forty of
// those stood into the room, each wearing one sheet of veneer stretched to fit
// under a lacquer that mirrored the opposite wall. And the bake was made with
// them in place: behind each the wall is black, with a soft dark rim round it.
//
// So they are put away and the dado is BUILT, the way joinery is: a frame of
// stiles and rails standing seven centimetres off the wall, raised and fielded
// panels in two tiers let into it behind a moulding, a moulded base on the
// skirting and a dado rail over the top, one continuous run to a wall (behind
// the columns, corner to corner; either side of the doors), high enough to
// cover everything the slabs shaded. The doors, which were one flat board, get
// the same joinery as two leaves and a pair of brass knobs.
//
// Its timber is the hall's own (hallWalnut.ts): quarter-cut for the framing,
// with the grain along every member; crown-cut for the fields, a book-matched
// pair to a panel. Its light is the room's, in the key's colour
// (hallProbe.ts): no bake reaches it, so it is even from end to end, and what
// a bake would have given its mouldings — the shade inside each frame, under
// the rail — is drawn into the joinery's own vertex colours.

import * as THREE from 'three';
import { WALNUT_SHEET, type WalnutStock } from './hallWalnut';

/** A moulding's section: [off the frame's face, above its foot], metres. */
export type Section = ReadonlyArray<readonly [number, number]>;

export const WAINSCOT = {
  /** The framing's face, off the wall. */
  frame: 0.07,
  /** An opening, from the frame inward: the moulding round it (its width, and
   *  how far it drops behind the frame's face), the flat at its foot, then the
   *  field's bevel and how far the field stands back up. */
  sticking: 0.02,
  recess: 0.02,
  margin: 0.03,
  bevel: 0.045,
  raise: 0.012,
  /** The members. */
  stile: 0.1,
  muntin: 0.1,
  rails: { bottom: 0.13, middle: 0.11, top: 0.12 },
  /** The lower tier's openings stand this tall; the upper tier has the rest.
   *  An opening is about this wide. */
  lower: 0.5,
  panel: 0.51,
  /** The base on the skirting, and the dado rail. */
  base: [[0.03, 0], [0.03, 0.055], [0.022, 0.068], [0.008, 0.082], [0, 0.09]] as Section,
  cap: [
    [0, 0], [0.012, 0.014], [0.012, 0.024], [0.03, 0.034], [0.046, 0.05],
    [0.052, 0.064], [0.052, 0.09], [0.044, 0.1], [0.044, 0.11],
  ] as Section,
  /** The rail's top stands this far over the old slabs' top edge: the bake's
   *  dark rim round each slab ends 5 cm above it (measured on the bare wall). */
  over: 0.105,
  /** A column covers this share of its own half-width at the frame's face (it
   *  is round, and stands a quarter of a metre off the wall). */
  column: 0.8,
  /** No opening in a stretch shorter than this. */
  shortest: 0.62,
  /** The panelling stops this far from the doors' edge. */
  jamb: 0.22,
} as const;

export const DOOR = {
  /** The leaves' face, off the door as it was built; the joint between them. */
  frame: 0.04,
  joint: 0.008,
  stile: 0.15,
  /** [foot, head] of each rail above the sill, with the top rail's own depth
   *  taken from the leaf's head. */
  rails: [[0, 0.3], [0.95, 1.15], [3.25, 3.41]] as ReadonlyArray<readonly [number, number]>,
  top: 0.16,
  /** The knob: above the sill, in from the meeting edge; [radius, off the leaf]. */
  knob: { height: 1.05, inset: 0.075 },
  knobSection: [
    [0.0, 0.0], [0.036, 0.0], [0.036, 0.006], [0.03, 0.01], [0.013, 0.014], [0.011, 0.034],
    [0.016, 0.04], [0.028, 0.048], [0.033, 0.06], [0.03, 0.072], [0.018, 0.08], [0.0, 0.082],
  ] as ReadonlyArray<readonly [number, number]>,
} as const;

/** The shade drawn into the joinery (a multiplier on the timber's colour). */
const SHADE = { deep: 0.66, foot: 0.84, under: 0.78 } as const;

type P = readonly [number, number, number]; // along the run, up, off the wall
export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: P, b: P): P => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: P, b: P) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Quads into flat arrays, in a run's own frame (u along the wall, v up, w off
 *  it: right-handed, so a face toward the room winds counter-clockwise). */
export class Mesher {
  position: number[] = [];
  normal: number[] = [];
  uv: number[] = [];
  color: number[] = [];
  index: number[] = [];

  /** A quad. Its corners run round it either way: it is wound to face `toward`
   *  (the room, unless told). `shade` is a multiplier a corner. */
  quad(
    corners: readonly [P, P, P, P],
    uv: (p: P) => readonly [number, number],
    shade: readonly [number, number, number, number] = [1, 1, 1, 1],
    toward: P = [0, 0, 1],
  ): void {
    let c = corners;
    let s = shade;
    let n = cross(sub(c[1], c[0]), sub(c[3], c[0]));
    if (dot(n, toward) < 0) {
      c = [c[0], c[3], c[2], c[1]];
      s = [s[0], s[3], s[2], s[1]];
      n = [-n[0], -n[1], -n[2]];
    }
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    const base = this.position.length / 3;
    for (let i = 0; i < 4; i += 1) {
      this.position.push(c[i][0], c[i][1], c[i][2]);
      this.normal.push(n[0] / len, n[1] / len, n[2] / len);
      const t = uv(c[i]);
      this.uv.push(t[0], t[1]);
      this.color.push(s[i], s[i], s[i]);
    }
    this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  get quads(): number {
    return this.index.length / 6;
  }

  /** The geometry, set down in the room: `origin` on the wall, `along`, up and
   *  `inward` its axes (along = up x inward, so nothing is turned inside out). */
  into(target: Mesher, origin: THREE.Vector3, along: THREE.Vector3, inward: THREE.Vector3): void {
    const base = target.position.length / 3;
    for (let i = 0; i < this.position.length; i += 3) {
      const [u, v, w] = [this.position[i], this.position[i + 1], this.position[i + 2]];
      target.position.push(
        origin.x + along.x * u + inward.x * w,
        origin.y + v,
        origin.z + along.z * u + inward.z * w,
      );
      const [nu, nv, nw] = [this.normal[i], this.normal[i + 1], this.normal[i + 2]];
      target.normal.push(along.x * nu + inward.x * nw, nv, along.z * nu + inward.z * nw);
    }
    target.uv.push(...this.uv);
    target.color.push(...this.color);
    for (const i of this.index) target.index.push(base + i);
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    g.setIndex(this.index);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

const STRAIGHT = WALNUT_SHEET.straight;
const CROWN = WALNUT_SHEET.crown;
/** A share of the sheet's width for the `k`th member, so no two neighbours
 *  wear the same stripe. */
const stripe = (k: number) => (k * 0.381966) % 1;

/** The grain up a member (a stile, a muntin): metres across it from `x0`. */
const upright = (x0: number, top: number, k: number) => (p: P) =>
  [(p[0] - x0) / STRAIGHT.across + stripe(k), (top - p[1]) / STRAIGHT.along] as const;
/** The grain along a member (a rail, a moulding): metres across it from `y0`. */
const level = (y0: number, k: number) => (p: P) =>
  [(p[1] - y0) / STRAIGHT.across + stripe(k), p[0] / STRAIGHT.along + stripe(k + 3)] as const;

/**
 * A frame's face: the rectangle x 0..length, y y0..y1 at `face` off the wall,
 * less its openings. Cut into bands at every opening's edge: a band no opening
 * stands in is a rail, and wears the grain along it; the pieces between the
 * openings of a band are stiles and muntins, and wear it upright.
 */
export function frameFace(m: Mesher, length: number, y0: number, y1: number, face: number, openings: readonly Rect[], seed = 0): void {
  const ys = [...new Set([y0, y1, ...openings.flatMap((o) => [o.y0, o.y1])])].filter((y) => y >= y0 && y <= y1).sort((a, b) => a - b);
  let member = seed;
  for (let i = 0; i < ys.length - 1; i += 1) {
    const [a, b] = [ys[i], ys[i + 1]];
    if (b - a < 1e-6) continue;
    const here = openings.filter((o) => o.y0 <= a + 1e-6 && o.y1 >= b - 1e-6).sort((p, q) => p.x0 - q.x0);
    const piece = (x0: number, x1: number, uv: (p: P) => readonly [number, number]) => {
      if (x1 - x0 < 1e-6) return;
      m.quad([[x0, a, face], [x1, a, face], [x1, b, face], [x0, b, face]], uv);
    };
    member += 1;
    if (!here.length) {
      piece(0, length, level(a, member));
      continue;
    }
    let from = 0;
    for (const o of here) {
      member += 1;
      piece(from, o.x0, upright(from, y1, member));
      from = o.x1;
    }
    member += 1;
    piece(from, length, upright(from, y1, member));
  }
}

/**
 * One opening, filled: the moulding round it, down from the frame's face; the
 * flat at its foot; the field's bevel; the field. The moulding is the frame's
 * timber (into `frame`), the rest the panel's (into `fields`): a book-matched
 * pair of crown-cut leaves, their joint on the opening's centre line.
 */
export function fieldedPanel(frame: Mesher, fields: Mesher, o: Rect, face: number, k: number): void {
  const W = WAINSCOT;
  const levels = [
    { inset: 0, w: face, shade: 1 },
    { inset: W.sticking, w: face - W.recess, shade: SHADE.deep },
    { inset: W.sticking + W.margin, w: face - W.recess, shade: SHADE.foot },
    { inset: W.sticking + W.margin + W.bevel, w: face - W.recess + W.raise, shade: 1 },
  ];
  const ring = (i: number) => {
    const l = levels[i];
    return { x0: o.x0 + l.inset, x1: o.x1 - l.inset, y0: o.y0 + l.inset, y1: o.y1 - l.inset, w: l.w, shade: l.shade };
  };
  // The pair's joint is at a quarter or three-quarters of the sheet's width
  // (make_walnut_veneer.py): alternate panels take the other pair, and each
  // its own stretch of the leaf.
  const centre = (o.x0 + o.x1) / 2;
  const joint = k % 2 === 0 ? 0.25 : 0.75;
  const crown = (p: P) =>
    [(p[0] - centre) / CROWN.across + joint, (o.y1 - p[1]) / CROWN.along + stripe(k)] as const;
  const sides = (a: ReturnType<typeof ring>, b: ReturnType<typeof ring>, into: Mesher, uvs: [(p: P) => readonly [number, number], (p: P) => readonly [number, number]]) => {
    const s: [number, number, number, number] = [a.shade, a.shade, b.shade, b.shade];
    const [upr, lvl] = uvs;
    into.quad([[a.x0, a.y0, a.w], [a.x1, a.y0, a.w], [b.x1, b.y0, b.w], [b.x0, b.y0, b.w]], lvl, s, [0, 1, 1]); // foot
    into.quad([[a.x1, a.y0, a.w], [a.x1, a.y1, a.w], [b.x1, b.y1, b.w], [b.x1, b.y0, b.w]], upr, s, [-1, 0, 1]); // right
    into.quad([[a.x1, a.y1, a.w], [a.x0, a.y1, a.w], [b.x0, b.y1, b.w], [b.x1, b.y1, b.w]], lvl, s, [0, -1, 1]); // head
    into.quad([[a.x0, a.y1, a.w], [a.x0, a.y0, a.w], [b.x0, b.y0, b.w], [b.x0, b.y1, b.w]], upr, s, [1, 0, 1]); // left
  };
  const [r0, r1, r2, r3] = [ring(0), ring(1), ring(2), ring(3)];
  sides(r0, r1, frame, [upright(o.x0, o.y1, k + 11), level(o.y0, k + 17)]);
  sides(r1, r2, fields, [crown, crown]);
  // (the bevel faces the frame it rises away from)
  const bevel: [number, number, number, number] = [r2.shade, r2.shade, r3.shade, r3.shade];
  fields.quad([[r2.x0, r2.y0, r2.w], [r2.x1, r2.y0, r2.w], [r3.x1, r3.y0, r3.w], [r3.x0, r3.y0, r3.w]], crown, bevel, [0, -1, 1]);
  fields.quad([[r2.x1, r2.y0, r2.w], [r2.x1, r2.y1, r2.w], [r3.x1, r3.y1, r3.w], [r3.x1, r3.y0, r3.w]], crown, bevel, [1, 0, 1]);
  fields.quad([[r2.x1, r2.y1, r2.w], [r2.x0, r2.y1, r2.w], [r3.x0, r3.y1, r3.w], [r3.x1, r3.y1, r3.w]], crown, bevel, [0, 1, 1]);
  fields.quad([[r2.x0, r2.y1, r2.w], [r2.x0, r2.y0, r2.w], [r3.x0, r3.y0, r3.w], [r3.x0, r3.y1, r3.w]], crown, bevel, [-1, 0, 1]);
  fields.quad([[r3.x0, r3.y0, r3.w], [r3.x1, r3.y0, r3.w], [r3.x1, r3.y1, r3.w], [r3.x0, r3.y1, r3.w]], crown);
}

/** A moulding run along the wall: its section's points are [off the wall, up]. */
export function moulding(m: Mesher, section: ReadonlyArray<readonly [number, number]>, x0: number, x1: number, k: number): void {
  let run = 0;
  for (let i = 0; i < section.length - 1; i += 1) {
    const [w0, v0] = section[i];
    const [w1, v1] = section[i + 1];
    const step = Math.hypot(w1 - w0, v1 - v0);
    if (step < 1e-6) continue;
    const [a, b] = [run, run + step];
    run = b;
    // Its face looks down by as much as the section leans out as it rises:
    // what looks down is in the moulding's own shade.
    const down = Math.max(0, (w1 - w0) / step);
    const under = 1 - (1 - SHADE.under) * down;
    // (the grain runs along it; across it, the section's own length)
    const uv = (p: P) => {
      const across = Math.abs(p[1] - v0) + Math.abs(p[2] - w0) < 1e-9 ? a : b;
      return [across / STRAIGHT.across + stripe(k), p[0] / STRAIGHT.along + stripe(k + 5)] as const;
    };
    m.quad([[x0, v0, w0], [x1, v0, w0], [x1, v1, w1], [x0, v1, w1]], uv, [under, under, under, under], [0, w0 - w1, v1 - v0]);
  }
}

/** The end of a run that shows: the joinery's own section, closed. */
function endFace(m: Mesher, outline: ReadonlyArray<readonly [number, number]>, x: number, facing: 1 | -1): void {
  const uv = (p: P) => [p[2] / STRAIGHT.across, -p[1] / STRAIGHT.along] as const;
  for (let i = 0; i < outline.length - 1; i += 1) {
    const [w0, v0] = outline[i];
    const [w1, v1] = outline[i + 1];
    if (Math.abs(v1 - v0) < 1e-6) continue;
    m.quad([[x, v0, 0], [x, v0, w0], [x, v1, w1], [x, v1, 0]], uv, [1, 1, 1, 1], [facing, 0, 0]);
  }
}

/** A stretch of wall to be panelled, in the room's own space. */
export interface Run {
  /** On the wall's face, at the run's start and at the skirting's top. */
  origin: THREE.Vector3;
  /** Unit vectors: along the wall (up x inward) and off it into the room. */
  along: THREE.Vector3;
  inward: THREE.Vector3;
  length: number;
  height: number;
  /** The clear stretches between whatever stands in front of the run (the
   *  columns), [from, to] along it: each is divided into openings. */
  spans: [number, number][];
  /** Whether each end shows (it does not where it dies into a wall). */
  ends: [boolean, boolean];
}

/** The openings of a clear stretch: as many as come nearest the house width. */
export function openingsAcross(from: number, to: number): [number, number][] {
  const W = WAINSCOT;
  const len = to - from;
  if (len < W.shortest) return [];
  const n = Math.max(1, Math.round((len - 2 * W.stile + W.muntin) / (W.panel + W.muntin)));
  const w = (len - 2 * W.stile - (n - 1) * W.muntin) / n;
  return Array.from({ length: n }, (_, i) => {
    const x0 = from + W.stile + i * (w + W.muntin);
    return [x0, x0 + w] as [number, number];
  });
}

/** The two tiers of a run `height` tall: [foot, head] of each tier's openings. */
export function tiers(height: number): [[number, number], [number, number]] {
  const W = WAINSCOT;
  const foot = W.base[W.base.length - 1][1] + W.rails.bottom;
  const head = height - W.cap[W.cap.length - 1][1] - W.rails.top;
  return [
    [foot, foot + W.lower],
    [foot + W.lower + W.rails.middle, head],
  ];
}

/** A run of panelling, in its own frame, into the two timbers' meshers. */
export function wainscot(frame: Mesher, fields: Mesher, run: Pick<Run, 'length' | 'height' | 'spans' | 'ends'>, seed = 0): number {
  const W = WAINSCOT;
  const F = W.frame;
  const baseTop = W.base[W.base.length - 1][1];
  const capFoot = run.height - W.cap[W.cap.length - 1][1];
  const openings: Rect[] = [];
  for (const [a, b] of run.spans) {
    for (const [x0, x1] of openingsAcross(a, b)) {
      for (const [y0, y1] of tiers(run.height)) openings.push({ x0, x1, y0, y1 });
    }
  }
  frameFace(frame, run.length, baseTop, capFoot, F, openings, seed * 31);
  openings.forEach((o, i) => fieldedPanel(frame, fields, o, F, seed * 7 + i));
  const base = W.base.map(([w, v]) => [F + w, v] as const);
  const cap = [...W.cap.map(([w, v]) => [F + w, capFoot + v] as const), [0, run.height] as const];
  moulding(frame, base, 0, run.length, seed + 1);
  moulding(frame, cap, 0, run.length, seed + 2);
  const outline = [[0, 0] as const, ...base, ...cap];
  if (run.ends[0]) endFace(frame, outline, 0, -1);
  if (run.ends[1]) endFace(frame, outline, run.length, 1);
  return openings.length;
}

/** A door leaf `width` by `height`, in its own frame (its foot at the sill). */
export function doorLeaf(frame: Mesher, fields: Mesher, width: number, height: number, seed = 0): number {
  const D = DOOR;
  const rails = [...D.rails, [height - D.top, height] as const];
  const openings: Rect[] = [];
  for (let i = 0; i < rails.length - 1; i += 1) {
    openings.push({ x0: D.stile, x1: width - D.stile, y0: rails[i][1], y1: rails[i + 1][0] });
  }
  frameFace(frame, width, 0, height, D.frame, openings, seed * 31 + 5);
  openings.forEach((o, i) => fieldedPanel(frame, fields, o, D.frame, seed * 7 + i + 3));
  // The leaf's own edges: both sides and its head.
  const edge = [[D.frame, 0] as const, [D.frame, height] as const];
  endFace(frame, edge, 0, -1);
  endFace(frame, edge, width, 1);
  frame.quad([[0, height, 0], [width, height, 0], [width, height, D.frame], [0, height, D.frame]], level(0, seed + 9), [1, 1, 1, 1], [0, 1, 0]);
  return openings.length;
}

interface Doors {
  origin: THREE.Vector3;
  along: THREE.Vector3;
  inward: THREE.Vector3;
  width: number;
  height: number;
}

const NAMES = {
  slab: /^wallpanel_/,
  wall: /^int_wall_/,
  column: /^pilaster_-?\d+_-?[\d.]+$/,
  skirting: /^int_skirt_/,
  doors: /^int_doors$/,
} as const;

type Axis = 'x' | 'z';
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Where the panelling goes, read off the hall as it was delivered: on every
 * wall that carried slabs, from one end of the room to the other (less the
 * doors' opening), from the skirting's top to a little over the slabs' own.
 * Nothing here carries a coordinate of its own, so a re-export that moves a
 * wall moves its panelling with it.
 */
export function surveyPanelling(root: THREE.Object3D): {
  runs: Run[];
  doors: Doors | null;
  slabs: THREE.Mesh[];
  /** The columns that stand on a panelled wall, and the slabs' top edge. */
  shafts: Shaft[];
  slabTop: number;
} {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const boxOf = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).applyMatrix4(toRoot);
  const slabs: THREE.Mesh[] = [];
  const walls: THREE.Box3[] = [];
  const columns: THREE.Box3[] = [];
  const columnMeshes: THREE.Mesh[] = [];
  const skirts: THREE.Box3[] = [];
  let doorBox = null as THREE.Box3 | null;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (NAMES.slab.test(m.name)) slabs.push(m);
    else if (NAMES.wall.test(m.name)) walls.push(boxOf(m));
    else if (NAMES.column.test(m.name)) {
      columns.push(boxOf(m));
      columnMeshes.push(m);
    }
    else if (NAMES.skirting.test(m.name)) skirts.push(boxOf(m));
    else if (NAMES.doors.test(m.name)) doorBox = boxOf(m);
  });
  if (!walls.length) return { runs: [], doors: null, slabs: [], shafts: [], slabTop: 0 };

  const room = walls.reduce((b, w) => b.union(w), new THREE.Box3()).getCenter(new THREE.Vector3());
  const thin = (b: THREE.Box3): Axis => (b.max.x - b.min.x < b.max.z - b.min.z ? 'x' : 'z');
  // Each wall: the axis it is thin on, which way the room lies, its inner face.
  const faces = walls.map((b) => {
    const axis = thin(b);
    const s = room[axis] >= (b.min[axis] + b.max[axis]) / 2 ? 1 : -1;
    return { axis, s, face: s > 0 ? b.max[axis] : b.min[axis] };
  });
  // The room's inner extent along each axis: where a run dies into a wall.
  const inner = (axis: Axis, s: 1 | -1) => {
    const f = faces.filter((w) => w.axis === axis && w.s === s);
    return f.length ? f[0].face : s > 0 ? -Infinity : Infinity;
  };
  const wallOf = (b: THREE.Box3) => {
    const axis = thin(b);
    const c = (b.min[axis] + b.max[axis]) / 2;
    let best = -1;
    faces.forEach((f, i) => {
      if (f.axis !== axis) return;
      if (best < 0 || Math.abs(f.face - c) < Math.abs(faces[best].face - c)) best = i;
    });
    return best;
  };

  const W = WAINSCOT;
  const byWall = new Map<number, THREE.Box3[]>();
  for (const slab of slabs) {
    const b = boxOf(slab);
    const i = wallOf(b);
    if (i >= 0) byWall.set(i, [...(byWall.get(i) ?? []), b]);
  }
  const frame = (axis: Axis, s: number) => {
    const inward = new THREE.Vector3(axis === 'x' ? s : 0, 0, axis === 'z' ? s : 0);
    const along = new THREE.Vector3().crossVectors(UP, inward);
    const across: Axis = axis === 'x' ? 'z' : 'x';
    return { inward, along, across, dir: along[across] };
  };
  const doorWall = doorBox ? wallOf(doorBox) : -1;

  const runs: Run[] = [];
  const shafts: Shaft[] = [];
  let slabTop = 0;
  for (const [i, boxes] of byWall) {
    const { axis, s, face } = faces[i];
    const { inward, along, across, dir } = frame(axis, s);
    const y0 = skirts.length ? Math.max(...skirts.map((k) => k.max.y)) : Math.min(...boxes.map((b) => b.min.y));
    slabTop = Math.max(slabTop, ...boxes.map((b) => b.max.y));
    const height = Math.max(...boxes.map((b) => b.max.y)) + W.over - y0;
    // The columns that stand on this wall (a corner's column is nearer its
    // own wall than the one it stands beside).
    columns.forEach((c, k) => {
      const here = Math.abs((c.min[axis] + c.max[axis]) / 2 - face);
      const other: Axis = axis === 'x' ? 'z' : 'x';
      const beside = Math.min(...faces.filter((f) => f.axis === other).map((f) => Math.abs((c.min[other] + c.max[other]) / 2 - f.face)));
      if (here < 0.7 && here <= beside) shafts.push({ mesh: columnMeshes[k], box: c, inward, along });
    });
    const lo = inner(across, 1);
    const hi = inner(across, -1);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
    // The wall, less the doors' opening; a stretch that never carried a slab
    // is left as it is.
    let stretches: { a: number; b: number; open: [boolean, boolean] }[] = [{ a: lo, b: hi, open: [false, false] }];
    if (doorBox && doorWall === i) {
      const [d0, d1] = [doorBox.min[across] - W.jamb, doorBox.max[across] + W.jamb];
      stretches = [
        { a: lo, b: d0, open: [false, true] as [boolean, boolean] },
        { a: d1, b: hi, open: [true, false] as [boolean, boolean] },
      ];
    }
    for (const st of stretches) {
      if (st.b - st.a < W.shortest) continue;
      if (!boxes.some((b) => (b.min[across] + b.max[across]) / 2 > st.a && (b.min[across] + b.max[across]) / 2 < st.b)) continue;
      const length = st.b - st.a;
      const start = dir > 0 ? st.a : st.b;
      const u = (coord: number) => (coord - start) * dir;
      const ends: [boolean, boolean] = dir > 0 ? st.open : [st.open[1], st.open[0]];
      // What stands in front of it: the columns on this wall.
      const covered = columns
        .filter((c) => Math.abs((c.min[axis] + c.max[axis]) / 2 - face) < 0.7)
        .map((c) => {
          const centre = u((c.min[across] + c.max[across]) / 2);
          const half = ((c.max[across] - c.min[across]) / 2) * W.column;
          return [centre - half, centre + half] as [number, number];
        })
        .filter(([a, b]) => b > 0 && a < length)
        .sort((p, q) => p[0] - q[0]);
      // An end that dies into a wall is behind that wall's own panelling.
      const spans: [number, number][] = [];
      let from = ends[0] ? 0 : W.frame;
      const last = ends[1] ? length : length - W.frame;
      for (const [a, b] of covered) {
        if (a - from >= W.shortest) spans.push([from, a]);
        from = Math.max(from, b);
      }
      if (last - from >= W.shortest) spans.push([from, last]);
      const origin = new THREE.Vector3();
      origin[axis] = face;
      origin[across] = start;
      origin.y = y0;
      runs.push({ origin, along, inward, length, height, spans, ends });
    }
  }

  let doors: Doors | null = null;
  if (doorBox && doorWall >= 0) {
    const { axis, s } = faces[doorWall];
    const { inward, along, across, dir } = frame(axis, s);
    const origin = new THREE.Vector3();
    origin[axis] = s > 0 ? doorBox.max[axis] : doorBox.min[axis];
    origin[across] = dir > 0 ? doorBox.min[across] : doorBox.max[across];
    origin.y = doorBox.min.y;
    doors = { origin, along, inward, width: doorBox.max[across] - doorBox.min[across], height: doorBox.max.y - doorBox.min.y };
  }
  return { runs, doors, slabs, shafts, slabTop };
}

/** A column standing on a panelled wall: its own space's box, and the wall's
 *  axes (off the wall into the room, and along it). */
export interface Shaft {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  inward: THREE.Vector3;
  along: THREE.Vector3;
}

/**
 * THE COLUMNS, WHERE THE SLABS STOOD INTO THEM.
 *
 * Each slab ran forty centimetres off the wall and INTO the columns either
 * side of it, and the bake was made that way: round each shaft, from the
 * skirting to the slab's top edge, the stone that was inside the slab is
 * black. The slabs hid it. Panelling that stands seven centimetres off the
 * wall does not: the first frames of it had a black bar a third of a metre
 * wide down both flanks of every column.
 *
 * So each shaft wears a sleeve over that height, a hair off its own surface
 * (found by rays, flute for flute), lit by THE SHAFT'S OWN BAKED LIGHT read
 * from just above where the slab reached: the same way the frieze is made
 * plain (hallJoinery.ts, plainFrieze). The sleeve goes all the way round the
 * shaft's room side, so there is no seam down it; its one edge is its top,
 * where the light it wears is thirty centimetres from the light beside it.
 */
export const SLEEVE = {
  /** Round the shaft, either side of its face to the room, in degrees; and a
   *  vertex every so many (the shafts are 48 flats round). */
  reach: 127.5,
  step: 3.75,
  /** A ring of vertices this often up the shaft. */
  rise: 0.4,
  /** The sleeve's head over the slabs' top edge (the bake's dark rim ends well
   *  under it), and how far over the head the shaft's light is read. */
  over: 0.2,
  above: 0.3,
  /** Off the shaft's surface. */
  proud: 0.003,
} as const;

export function sleeveColumns(root: THREE.Object3D, shafts: readonly Shaft[], slabTop: number): THREE.Mesh | null {
  if (!shafts.length) return null;
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const ray = new THREE.Raycaster();
  const from = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const position: number[] = [];
  const normal: number[] = [];
  const uv1: number[] = [];
  const index: number[] = [];
  const S = SLEEVE;
  const angles = Math.round((2 * S.reach) / S.step);
  for (const shaft of shafts) {
    if (Array.isArray(shaft.mesh.material)) continue;
    const b = shaft.box;
    const centre = b.getCenter(new THREE.Vector3());
    const radius = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2;
    const foot = b.min.y + 0.004;
    const head = Math.min(slabTop + S.over, b.max.y - S.above - 0.05);
    if (head - foot < 0.2) continue;
    const rows = Math.max(1, Math.ceil((head - foot) / S.rise));
    // One ray toward the shaft's axis: where it meets the stone, and the
    // stone's lightmap coordinate there. (A ray that runs exactly down the
    // edge between two of the shaft's flats can miss both, and the shafts
    // are 48 flats round: a miss looks a hair to either side.)
    const aim = new THREE.Vector3();
    const meet = (out: THREE.Vector3, y: number) => {
      for (const nudge of [0, 0.004, -0.004]) {
        aim.copy(out).addScaledVector(shaft.along, nudge).addScaledVector(shaft.inward, nudge * 0.618).setY(0).normalize();
        from.copy(centre).setY(y).addScaledVector(aim, radius + 0.5).applyMatrix4(root.matrixWorld);
        dir.copy(aim).negate().transformDirection(root.matrixWorld);
        ray.set(from, dir);
        ray.far = radius + 0.6;
        const hit = ray.intersectObject(shaft.mesh, false)[0];
        if (hit) return { point: hit.point.applyMatrix4(toRoot), uv1: hit.uv1 ?? null };
      }
      return null;
    };
    const base = position.length / 3;
    let ok = true;
    const out = new THREE.Vector3();
    for (let i = 0; i <= angles && ok; i += 1) {
      const a = THREE.MathUtils.degToRad(-S.reach + i * S.step);
      out.copy(shaft.inward).multiplyScalar(Math.cos(a)).addScaledVector(shaft.along, Math.sin(a));
      const lit = meet(out, head + S.above);
      if (!lit?.uv1) {
        ok = false;
        break;
      }
      for (let j = 0; j <= rows; j += 1) {
        const at = meet(out, foot + ((head - foot) * j) / rows);
        if (!at) {
          ok = false;
          break;
        }
        position.push(at.point.x + out.x * S.proud, at.point.y, at.point.z + out.z * S.proud);
        normal.push(out.x, 0, out.z);
        uv1.push(lit.uv1.x, lit.uv1.y);
      }
    }
    if (!ok) {
      // A shaft a ray missed is left as it is, whole.
      position.length = base * 3;
      normal.length = base * 3;
      uv1.length = base * 2;
      continue;
    }
    // (along = up x inward, so rings that run toward `along` and rise wind
    // counter-clockwise as seen from outside the shaft)
    const R = rows + 1;
    for (let i = 0; i < angles; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const [p, q, r, t] = [base + i * R + j, base + (i + 1) * R + j, base + (i + 1) * R + j + 1, base + i * R + j + 1];
        index.push(p, q, r, p, r, t);
      }
    }
  }
  if (!index.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((position.length / 3) * 2), 2));
  g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
  g.setIndex(index);
  const stone = (shafts.find((sh) => !Array.isArray(sh.mesh.material))!.mesh.material as THREE.MeshStandardMaterial).clone();
  stone.name = 'MAT_Column_Sleeve';
  stone.polygonOffset = true;
  stone.polygonOffsetFactor = -1;
  stone.polygonOffsetUnits = -2;
  const sleeves = new THREE.Mesh(g, stone);
  sleeves.name = 'column_sleeves';
  return sleeves;
}

export interface Panelled {
  counts: { runs: number; openings: number; doors: number; slabs: number; sleeves: number };
  /** Remove what was added, release what was made, show the slabs again. */
  dispose(): void;
}

/**
 * Put the slabs away and build the hall's panelling and its doors in their
 * place: two meshes for all of it (the framing, the fields), and the knobs.
 */
export function panelHall(root: THREE.Object3D, stock: WalnutStock): Panelled {
  const { runs, doors, slabs, shafts, slabTop } = surveyPanelling(root);
  const frame = new Mesher();
  const fields = new Mesher();
  let openings = 0;
  runs.forEach((run, i) => {
    const f = new Mesher();
    const p = new Mesher();
    openings += wainscot(f, p, run, i + 1);
    f.into(frame, run.origin, run.along, run.inward);
    p.into(fields, run.origin, run.along, run.inward);
  });
  const knobs: THREE.Vector3[] = [];
  if (doors) {
    const D = DOOR;
    const leaf = (doors.width - D.joint) / 2;
    [0, 1].forEach((k) => {
      const f = new Mesher();
      const p = new Mesher();
      openings += doorLeaf(f, p, leaf, doors.height, 40 + k);
      const origin = doors.origin.clone().addScaledVector(doors.along, k * (leaf + D.joint));
      f.into(frame, origin, doors.along, doors.inward);
      p.into(fields, origin, doors.along, doors.inward);
      // a knob on each leaf, beside the joint
      knobs.push(
        origin
          .clone()
          .addScaledVector(doors.along, k === 0 ? leaf - D.knob.inset : D.knob.inset)
          .addScaledVector(doors.inward, D.frame)
          .setY(origin.y + D.knob.height),
      );
    });
  }

  const added: THREE.Object3D[] = [];
  const made: { dispose(): void }[] = [];
  if (frame.quads) {
    const framing = new THREE.Mesh(frame.geometry(), stock.material('straight', 'MAT_Walnut_Straight', { vertexColors: true }));
    framing.name = 'panelling_frame';
    const panels = new THREE.Mesh(fields.geometry(), stock.material('crown', 'MAT_Walnut_Crown', { vertexColors: true }));
    panels.name = 'panelling_fields';
    root.add(framing, panels);
    added.push(framing, panels);
    made.push(framing.geometry, panels.geometry);
  }
  if (doors && knobs.length) {
    // The room's own gilt, where it has it: the sconces' and the frames'.
    let gold = null as THREE.Material | null;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!gold && m.isMesh && !Array.isArray(m.material) && m.material?.name === 'MAT_Gold') gold = m.material;
    });
    const brass = gold ?? new THREE.MeshStandardMaterial({ name: 'MAT_Door_Brass', color: '#c2a066', metalness: 0.72, roughness: 0.44 });
    if (!gold) made.push(brass);
    const turned = new THREE.LatheGeometry(DOOR.knobSection.map(([r, y]) => new THREE.Vector2(r, y)), 32);
    turned.normalizeNormals();
    made.push(turned);
    // Turned about y, then laid so its axis runs off the leaf into the room.
    const lay = new THREE.Quaternion().setFromUnitVectors(UP, doors.inward);
    for (const [k, at] of knobs.entries()) {
      const knob = new THREE.Mesh(turned, brass);
      knob.name = `door_knob_${k}`;
      knob.position.copy(at);
      knob.quaternion.copy(lay);
      root.add(knob);
      added.push(knob);
    }
  }
  // The columns' shafts, clean where the slabs stood into them.
  const sleeves = slabs.length ? sleeveColumns(root, shafts, slabTop) : null;
  if (sleeves) {
    root.add(sleeves);
    added.push(sleeves);
    made.push(sleeves.geometry, sleeves.material as THREE.Material);
  }
  const hidden = slabs.filter((m) => m.visible);
  for (const m of hidden) m.visible = false;

  return {
    counts: { runs: runs.length, openings, doors: doors ? 2 : 0, slabs: slabs.length, sleeves: sleeves ? shafts.length : 0 },
    dispose() {
      for (const o of added) o.removeFromParent();
      for (const d of made) d.dispose();
      for (const m of hidden) m.visible = true;
    },
  };
}
