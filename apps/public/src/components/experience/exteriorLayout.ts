// apps/public/src/components/experience/exteriorLayout.ts
//
// THE LAYOUT (the founder's frame, 2026-10-28: "Elevated Drone-Sweep View ...
// Immersive 'Master Plan' Details ... golden/bronze CAD/GIS overlays ...
// topographic contour lines ... a subtle telemetry grid that hints at the
// underground utility network").
//
// Chapter three stands the camera high over the south-west corner of the
// walls (cameraPath.ts, the layout beat) and shows the land the house stands
// in laid out in plots: the south lawns either side of the avenue, from the
// forecourt's garden to the gate, as a plotted layout is laid out.
//
//   THE ROADS are built: four cross roads off the avenue and one side road off
//   the first, thirty feet wide, laid in the drive's own dark stone (named
//   `drive_` so every pass dresses them as it dresses the drive: the grade, the
//   polish and its glints, the ground's shadow), with a kerb along each side.
//   Where they meet the avenue its kerb is left undrawn (clearJunctions), as a
//   junction's is.
//   THE PLOTS are the lawn. Between the roads stand blocks of plots back to
//   back, each plot 30 ft by 60 ft (1,800 sq ft: the size Kartikeya Water
//   Front's sheet prints, and VSR Gayatri Township's every plot, layouts.ts).
//   THE SURVEY is drawn over them (layoutSheet): each block ruled twice round
//   as a surveyor's sheet rules a plot's line, its plots' lines inside, the
//   ground's contours within it, the roads' edges, a broken line inside each
//   for what runs under it, and a tick at each plot's corner. Ivory, a pixel
//   wide wherever it is, under the trees and the palms as ink on the ground
//   would be, and only while the chapter is on the screen (layoutOn).
//   ITS WORDS are type, stood over the ground along the line of what they name
//   (LayoutMarks: each `[data-layout-label]` of site-home's chapter).
//
// ALL OF IT IS THIS CHAPTER'S. The roads, their kerbs, the trees planted for the
// frame arrive with its air (layoutAir), by a dissolve, and the palms, the
// planting and the lamps that stand where a plot or a road is laid go by the same
// dissolve (clearJunctions); it all comes back as the camera comes down. So the
// approved cover, the orbit, the approach and every page's plate stand as they
// were approved, and nothing of the plan is on the estate but while it is shown.
//
// WHAT THE WORDS SAY is what the layouts' own paper says (layouts.ts) and
// nothing it does not: the plots' size, the roads' width, what is laid under
// them. The founder's frame printed a plot of "12,500 SQ. FT." marked
// "AVAILABLE" and an approval "LP NO. 32/2026 // AP APPROVED": no layout's
// sheet has either (the register says which plots are open, layout by
// layout, and published.ts prints only its totals; Gayatri's approval is
// F.L.P. No. 10/2025, Kartikeya's carries no number). So the drawing is
// labelled as a drawing: the plots it draws, at the size the sheets print.

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { hazeUniforms } from './exteriorHaze';
import { journeyState } from './journey';
import { filmState } from './FilmGrade';
import { keepDepthAlpha } from './LensFocus';

const FT = 0.3048;

export const LAYOUT = {
  /** A plot, as the sheets print it: 30 ft frontage by 60 ft deep. */
  plot: { frontage: 30 * FT, depth: 60 * FT },
  /** The cross roads: 30 ft (Kartikeya's internal roads are 40 and 30 ft). */
  road: 30 * FT,
  /** Their centre lines (three's z), a block apart: two plots deep and a
   *  road. The first runs along the foot of the forecourt's ring, where the
   *  founder's frame has its junction and its "BOUND" and "LP" roads (found by
   *  projecting his marks onto the ground through the layout's camera: his road
   *  between z 41 and 50, his plots' line at 50); the last leaves a strip along
   *  the south wall (z 214). */
  roads: [45.5, 91.22, 136.94, 182.66] as const,
  /** Where the blocks begin either side of the avenue (clear of its palms'
   *  trunks), and how many plots across each runs. */
  x0: 12,
  across: 4,
  /** The first row, between the first two roads, where the avenue's palms have
   *  stood back (openAvenue): on the verge, as the founder's two plots are. */
  firstX0: 4.9,
  /** How far the roads run from the axis: west, past the blocks to the planting
   *  along the wall; east, to the wall, for the side block's plots. */
  reach: { west: 52, east: 70 },
  /** The avenue's kerbs (build_estate_v7.py, build_hardscape: x = +/-4.4). */
  avenue: 4.4,
  /** The forecourt's carriage ring, which the first road runs along the foot
   *  of (build_estate_v7.py, RING_R): its middle's z, and its outer radius. */
  ring: { z: 30, r: 14 },
  /**
   * The avenue's palms that stand back from the land, between these z: the
   * founder's frame has the road open beside its plots, and from the layout
   * these stood across the forecourt, the plots and the words on them. The
   * avenue from the second road to the gate keeps its palms (its plate,
   * /terms, is of them).
   */
  openAvenue: [41, 96.3] as const,
  /** The roads' surface, just under the avenue's paving (0.013) and the ring's
   *  (0.012), and their kerbs: laid low, for the drawing's line to be the line
   *  that is read from this height. */
  y: 0.01,
  kerb: { width: 0.1, height: 0.06 },
  /** The sheet's height over the lawn, and how far round it is drawn. */
  sheet: { y: 0.07, area: [-72, 72, -40, 211] as const },
  /** When it is on, as leg progress: up from, whole by, whole until, gone by.
   *  Up as the sweep settles over the land, before the chapter's words; gone
   *  as the descent gathers way (journey.ts, COPY_SPAN: the words are whole
   *  from 0.598 to 0.659). */
  shown: [0.54, 0.585, 0.672, 0.71] as const,
  /** How much of a line is drawn: the blocks' double line, the plots', the
   *  contours, the roads' edges, the broken service line, the ticks. */
  ink: { block: 0.62, plot: 0.13, contour: 0.2, edge: 0.38, service: 0.16, tick: 0.28 },
  /** Metres of rise between the contours drawn inside the blocks: a dozen
   *  or so across a block, as the founder's plots have them. */
  interval: 0.42,
  /** Where the contours break for a plot's title, as a map's do round a name:
   *  [x, z, half a clearing along x, along z]. */
  clear: [
    [-16, 57.7, 15, 3.6],
    [30, 57.3, 13, 3.4],
  ] as const,
  /** The broken line down the roads: metres to a dash and its gap. */
  dash: 5,
  /** The long shade across the land: how long and how wide its bars are, where
   *  in their field they begin and are whole, and how dark; and what is taken
   *  from the whole land under them (the founder's land lies low in the light,
   *  nearly black under its lines). */
  shade: { long: 46, wide: 13, at: [0.36, 0.7] as const, most: 0.55, base: 0.25 },
  /** When the land lies under that, as leg progress: longer than the drawing,
   *  from where the sweep rises off the revolution, for looking down the sun's
   *  way from up here the lawn and the drive take the low sun whole. And how much
   *  of the sun's own glint on the stone is left while it does. */
  low: { over: [0.4, 0.46, 0.7, 0.76] as const, glint: 0.15 },
  /** The lawn round the house under the same air, north of the first road: a
   *  veil of the misty light over its shade (his lawn beside the forecourt is
   *  lit olive, where the east planting's long shadows lay ours black): how much
   *  east of the house, how much west, and its colour. */
  veil: { east: 0.5, west: 0.16, colour: [0.12, 0.105, 0.05] as const },
  /** How far up the hills the mist stands over this chapter, as a multiple of
   *  the horizon skirt's own height (2 degrees), and over what leg progress:
   *  up from, whole by, whole until, gone by. */
  mist: { lift: 3, over: [0.46, 0.56, 0.66, 0.74] as const },
  /** The roads' wet (wetTheRoads): the two sizes of its field, metres; where
   *  in the field it begins and is whole; from what z on the avenue; how
   *  smooth the stone goes, how much darker, and how much of the pale sky it
   *  takes at the layout's low angle. */
  wet: { size: [5.5, 1.8, 0.6] as const, at: [0.45, 0.72] as const, from: 47, rough: 0.09, dark: 0.7, sheen: 0.36 },
  /** Gone with distance from the eye, metres. */
  far: [240, 340] as const,
} as const;

/** The side road off the first, between the east block of the first row and
 *  the block beyond it: [x from, x to, z from, z to]. Pure, for the test. */
export function layoutSideRoad(): [number, number, number, number] {
  const x0 = LAYOUT.firstX0 + LAYOUT.across * LAYOUT.plot.frontage;
  return [x0, x0 + LAYOUT.road, LAYOUT.roads[0] + LAYOUT.road / 2, LAYOUT.roads[1] - LAYOUT.road / 2];
}

/** The blocks: [x from, x to, z from, z to] for each, west and east of the
 *  avenue between each pair of roads, and last the block beyond the side road
 *  (the founder's upper plot), one row deep to the wall. Pure, for the test. */
export function layoutBlocks(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const width = LAYOUT.across * LAYOUT.plot.frontage;
  for (let k = 0; k + 1 < LAYOUT.roads.length; k += 1) {
    const x0 = k === 0 ? LAYOUT.firstX0 : LAYOUT.x0;
    const z0 = LAYOUT.roads[k] + LAYOUT.road / 2;
    const z1 = LAYOUT.roads[k + 1] - LAYOUT.road / 2;
    out.push([-(x0 + width), -x0, z0, z1]);
    out.push([x0, x0 + width, z0, z1]);
  }
  const [, sx1, z0, z1] = layoutSideRoad();
  out.push([sx1, sx1 + LAYOUT.plot.depth, z0, z1]);
  return out;
}

/** Whether a point is on the layout: its blocks and its roads, with a margin.
 *  (A jungle tree sown there is taken out: exteriorJungle.ts.) */
export function onTheLayout(x: number, z: number, margin = 4): boolean {
  return (
    x >= -LAYOUT.reach.west - margin &&
    x <= LAYOUT.reach.east + margin &&
    z >= LAYOUT.roads[0] - LAYOUT.road / 2 - margin &&
    z <= LAYOUT.sheet.area[3] + margin
  );
}

/**
 * How much of the layout's air is up at this point of the exterior leg, 0..1:
 * the mist that stands higher up the hills over this chapter (the founder's
 * frame: "layered, misty mountain ridges"), risen over the sweep and let down
 * as the descent gathers way. ExteriorModel lifts the horizon's skirt by it
 * (LAYOUT.mist).
 */
export function layoutAir(leg: 'exterior' | 'interior', legProgress: number, film = true): number {
  if (leg !== 'exterior' || !film) return 0;
  const [a, b, c, d] = LAYOUT.mist.over;
  const s = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  return s(a, b, legProgress) * (1 - s(c, d, legProgress));
}

/** How much of the layout's drawing is on at this point of the exterior leg. */
export function layoutOn(leg: 'exterior' | 'interior', legProgress: number, film = true): number {
  if (leg !== 'exterior' || !film) return 0;
  const [a, b, c, d] = LAYOUT.shown;
  const s = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  return s(a, b, legProgress) * (1 - s(c, d, legProgress));
}

/** How much of the land's low light is on at this point of the exterior leg. */
export function layoutLow(leg: 'exterior' | 'interior', legProgress: number, film = true): number {
  if (leg !== 'exterior' || !film) return 0;
  const [a, b, c, d] = LAYOUT.low.over;
  const s = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  return s(a, b, legProgress) * (1 - s(c, d, legProgress));
}

// ── The ground ─────────────────────────────────────────────────────────────

function box(
  pos: number[],
  nor: number[],
  uv: number[],
  idx: number[],
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y0: number,
  y1: number,
  uvScale: number,
  top = true,
): void {
  // the top, and (for a kerb) its four sides; uv by world metres
  const quad = (p: number[][], n: number[]) => {
    const base = pos.length / 3;
    for (const v of p) {
      pos.push(v[0], v[1], v[2]);
      nor.push(n[0], n[1], n[2]);
      // a side's uv runs along it
      const u = Math.abs(n[0]) > 0.5 ? v[2] : v[0];
      const w = Math.abs(n[1]) > 0.5 ? v[2] : v[1];
      uv.push(u / uvScale, w / uvScale);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0]);
  if (top) return;
  quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
  quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]);
  quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0]);
  quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]);
}

function geometry(pos: number[], nor: number[], uv: number[], idx: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** The roads' surfaces and their kerbs, as two geometries. Pure, for the test. */
export function layoutGroundGeometry(): { roads: THREE.BufferGeometry; kerbs: THREE.BufferGeometry } {
  const r = { pos: [] as number[], nor: [] as number[], uv: [] as number[], idx: [] as number[] };
  const k = { pos: [] as number[], nor: [] as number[], uv: [] as number[], idx: [] as number[] };
  const half = LAYOUT.road / 2;
  const kw = LAYOUT.kerb.width;
  const [sx0, sx1, sz0, sz1] = layoutSideRoad();
  const kerb = (x0: number, x1: number, z0: number, z1: number) => {
    if (x1 > x0 && z1 > z0) box(k.pos, k.nor, k.uv, k.idx, x0, x1, z0, z1, 0, LAYOUT.kerb.height, 1, false);
  };
  for (const zc of LAYOUT.roads) {
    for (const s of [-1, 1]) {
      const a = s * LAYOUT.avenue;
      const b = s < 0 ? -LAYOUT.reach.west : LAYOUT.reach.east;
      const [x0, x1] = a < b ? [a, b] : [b, a];
      // (4 m a repeat, as the drive's stone is laid: build_estate_v7.py)
      box(r.pos, r.nor, r.uv, r.idx, x0, x1, zc - half, zc + half, 0, LAYOUT.y, 4);
      // a kerb down each side, from the avenue's kerb to the road's end, and one
      // across its end
      for (const edge of [zc - half, zc + half]) {
        // (where the forecourt's ring stands over the road's line, from the ring)
        const over = LAYOUT.ring.r ** 2 - (edge - LAYOUT.ring.z) ** 2;
        const from = over > 0 ? Math.max(LAYOUT.avenue, Math.sqrt(over)) : LAYOUT.avenue;
        const near = s < 0 ? x1 - (from - LAYOUT.avenue) - kw / 2 : x0 + (from - LAYOUT.avenue) + kw / 2;
        const [kx0, kx1] = s < 0 ? [x0, near] : [near, x1];
        // (and left open across the side road's mouth)
        if (s > 0 && (edge === sz0 || edge === sz1)) {
          kerb(kx0, sx0 - kw / 2, edge - kw / 2, edge + kw / 2);
          kerb(sx1 + kw / 2, kx1, edge - kw / 2, edge + kw / 2);
        } else {
          kerb(kx0, kx1, edge - kw / 2, edge + kw / 2);
        }
      }
      kerb(b - kw / 2, b + kw / 2, zc - half - kw / 2, zc + half + kw / 2);
    }
  }
  box(r.pos, r.nor, r.uv, r.idx, sx0, sx1, sz0, sz1, 0, LAYOUT.y, 4);
  kerb(sx0 - kw / 2, sx0 + kw / 2, sz0 - kw / 2, sz1 + kw / 2);
  kerb(sx1 - kw / 2, sx1 + kw / 2, sz0 - kw / 2, sz1 + kw / 2);
  return { roads: geometry(r.pos, r.nor, r.uv, r.idx), kerbs: geometry(k.pos, k.nor, k.uv, k.idx) };
}

/** A material of its own, for what arrives with the layout's air (HAZE_ARRIVE in
 *  exteriorHaze.ts). Before the passes: each dresses it as it dresses its source. */
function arriving(from: THREE.Material): THREE.Material {
  const own = from.clone();
  own.userData.arrive = true;
  return own;
}

/**
 * Every material that comes or goes with the layout's air, for ExteriorModel to
 * leave undrawn while it is not wanted (a material left unseen is still built
 * by the warm-up, so nothing is compiled as the camera rises).
 */
export function layoutFades(root: THREE.Object3D): { arriving: THREE.Material[]; leaving: THREE.Material[] } {
  const arrive = new Set<THREE.Material>();
  const leave = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (m?.userData.arrive) arrive.add(m);
      if (m?.userData.leave) leave.add(m);
    }
  });
  return { arriving: [...arrive], leaving: [...leave] };
}

/**
 * Lay the roads under the estate's root, in the drive's stone and the
 * kerbs' trim. Idempotent. Before the grade (ExteriorModel), so every pass
 * after it finds them as it finds the drive. Returns whether they were laid.
 */
export function layLayout(root: THREE.Object3D): boolean {
  if (root.getObjectByName('drive_layout')) return false;
  let drive: THREE.Material | null = null;
  let trim: THREE.Material | null = null;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!drive && mesh.name.startsWith('drive_forecourt')) drive = m;
    if (!trim && mesh.name.startsWith('hardscape_kerbs')) trim = m;
  });
  if (!drive || !trim) return false;
  const { roads, kerbs } = layoutGroundGeometry();
  const road = new THREE.Mesh(roads, arriving(drive as THREE.Material));
  road.name = 'drive_layout';
  road.receiveShadow = true;
  road.castShadow = false;
  const kerb = new THREE.Mesh(kerbs, arriving(trim as THREE.Material));
  kerb.name = 'hardscape_kerbs_layout';
  kerb.receiveShadow = true;
  kerb.castShadow = false;
  root.add(road, kerb);
  return true;
}

/** Whether a point is in a road off the avenue: a cross road's mouth and its
 *  length, or the side road, `margin` metres round it. */
export function inJunction(x: number, z: number, margin = 0): boolean {
  if (Math.abs(x) < LAYOUT.avenue - 0.5 || x < -LAYOUT.reach.west - margin || x > LAYOUT.reach.east + margin) return false;
  if (LAYOUT.roads.some((zc) => Math.abs(z - zc) < LAYOUT.road / 2 + margin)) return true;
  const [sx0, sx1, sz0, sz1] = layoutSideRoad();
  return x > sx0 - margin && x < sx1 + margin && z > sz0 - margin && z < sz1 + margin;
}

/** The dissolve's threshold at this pixel: interleaved gradient noise, whose even
 *  spread reads as a veil where white noise reads as a speckle, moved on each frame
 *  (uHazeFrame in exteriorHaze.ts). */
const DITHER = 'fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy) + 5.588238 * uRoadsFrame, vec2(0.06711056, 0.00583715))))';

/**
 * Stand these instances of a scatter back into a mesh of their own, on a material
 * of their own that goes with the layout's air (HAZE_LEAVE in exteriorHaze.ts). The
 * passes have been: its copy takes what they compiled in (three's clone leaves
 * onBeforeCompile behind). It casts nothing: a shadow cannot go by a dissolve, and
 * one of these lifting from the lawn all at once is the thing the eye would catch.
 */
function standBack(im: THREE.InstancedMesh, gone: readonly number[], back = false): void {
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const none = new THREE.Matrix4().makeScale(0, 0, 0);
  const src = (Array.isArray(im.material) ? im.material[0] : im.material) as THREE.Material;
  const own = src.clone();
  own.onBeforeCompile = src.onBeforeCompile;
  own.customProgramCacheKey = src.customProgramCacheKey;
  own.userData.leave = true;
  if (back) own.userData.back = true;
  const mesh = new THREE.InstancedMesh(im.geometry, own, gone.length);
  mesh.name = `${im.name}_leaving`;
  mesh.castShadow = false;
  mesh.receiveShadow = im.receiveShadow;
  mesh.position.copy(im.position);
  mesh.quaternion.copy(im.quaternion);
  mesh.scale.copy(im.scale);
  gone.forEach((i, k) => {
    im.getMatrixAt(i, m);
    mesh.setMatrixAt(k, m);
    if (im.instanceColor) {
      im.getColorAt(i, c);
      mesh.setColorAt(k, c);
    }
    im.setMatrixAt(i, none);
  });
  mesh.instanceMatrix.needsUpdate = true;
  im.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  im.computeBoundingSphere();
  im.parent?.add(mesh);
}

/**
 * WHERE A CROSS ROAD MEETS THE AVENUE, NOTHING OF THE AVENUE'S STANDS IN IT.
 * The avenue's palms stand thirty feet apart, as a plot is wide, so a road
 * thirty feet wide cannot pass between two of them: three of the four came
 * through a pair. As a junction is made, the palms that stood in the road's
 * line stand back from it (LAYOUT.openAvenue has the others that go), and so do
 * the lamps and their posts along the verge, and the trees on the plots and in
 * the roads off it; the avenue's kerb, one run from the forecourt's ring to the
 * gate, is left undrawn across each mouth. All of it only while the layout is up:
 * each goes by a dissolve on its air and comes back after it.
 */
export function clearJunctions(root: THREE.Object3D): { palms: number; garden: number; lamps: number; kerbs: number; walls: number } {
  root.updateMatrixWorld(true);
  const out = { palms: 0, garden: 0, lamps: 0, kerbs: 0, walls: 0 };
  // (AND THE ESTATE'S WALL. From up here it is a long pale line ruled along the far
  // edge of the plots, which the founder's frame does not have: under the blue
  // hour's fill the palest thing on the land. And the helipad, whose white ring stood
  // through the trees as a stray arc beside the pool. On materials of their own: they
  // go by the same dissolve, far off, and are back as the camera comes down.)
  const wallOwn = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !/^(estate_wall|helipad_)/.test(mesh.name) || Array.isArray(mesh.material)) return;
    const from = mesh.material;
    let own = wallOwn.get(from);
    if (!own) {
      own = from.clone();
      own.onBeforeCompile = from.onBeforeCompile;
      own.customProgramCacheKey = from.customProgramCacheKey;
      own.userData.leave = true;
      wallOwn.set(from, own);
    }
    mesh.material = own;
    out.walls += 1;
  });
  // (with their margin: two stood on the first block's west line, across it)
  const blocks = layoutBlocks();
  const onABlock = (x: number, z: number) =>
    blocks.some((b) => x >= b[0] - 1.5 && x <= b[1] + 1.5 && z >= b[2] - 1.5 && z <= b[3] + 1.5);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const scatters: THREE.InstancedMesh[] = [];
  root.traverse((o) => {
    const im = o as THREE.InstancedMesh;
    if (im.isInstancedMesh) scatters.push(im);
  });
  for (const im of scatters) {
    const palm = im.name.startsWith('veg_palm_avenue');
    // (and the garden's young trees in the first road's line, and the palms and
    // the planting along the wall that stood where a block's plots now are; not
    // the trees planted for this frame: exteriorJungle.ts, LAYOUT_TREES)
    const tree =
      !im.name.startsWith('veg_tree_layout') &&
      /^(veg_tree_|grown_tree_|veg_palm_coconut|veg_palm_forecourt)/.test(im.name);
    if (!palm && !tree) continue;
    const gone: number[] = [];
    for (let i = 0; i < im.count; i += 1) {
      im.getMatrixAt(i, m);
      if (m.elements[0] === 0) continue;
      p.setFromMatrixPosition(m).applyMatrix4(im.matrixWorld);
      const open = p.z > LAYOUT.openAvenue[0] && p.z < LAYOUT.openAvenue[1];
      if (palm ? open || inJunction(p.x, p.z, 0.6) : inJunction(p.x, p.z, 2) || onABlock(p.x, p.z)) gone.push(i);
    }
    if (!gone.length) continue;
    standBack(im, gone, palm);
    if (palm) out.palms += gone.length;
    else out.garden += gone.length;
  }
  const roadList = LAYOUT.roads.map((z) => z.toFixed(2)).join(', ');
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.name === 'estate_lamps' || mesh.name === 'estate_light_posts') {
      const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial & {
        __lampCut?: boolean;
      };
      if (!mat || mat.__lampCut) return;
      // On its own material, as the kerb's cut is on the trim's below.
      mat.__lampCut = true;
      const prev = mat.onBeforeCompile;
      const prevKey = mat.customProgramCacheKey.bind(mat);
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        shader.uniforms.uRoadsIn = hazeUniforms.uHazeGround;
        shader.uniforms.uRoadsFrame = hazeUniforms.uHazeFrame;
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', 'varying vec3 vLampCut;\nvoid main() {')
          .replace('#include <project_vertex>', '#include <project_vertex>\n  vLampCut = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', 'varying vec3 vLampCut;\nuniform float uRoadsIn;\nuniform float uRoadsFrame;\nvoid main() {')
          .replace(
            '#include <clipping_planes_fragment>',
            /* glsl */ `#include <clipping_planes_fragment>
  {
    float lampAx = abs(vLampCut.x);
    bool lampGone = lampAx < ${LAYOUT.x0.toFixed(2)} && vLampCut.z > ${LAYOUT.openAvenue[0].toFixed(2)} && vLampCut.z < ${LAYOUT.openAvenue[1].toFixed(2)};
    float lampRoads[${LAYOUT.roads.length}] = float[](${roadList});
    for (int i = 0; i < ${LAYOUT.roads.length}; i++) {
      if (lampAx > ${(LAYOUT.avenue - 0.5).toFixed(2)} && abs(vLampCut.z - lampRoads[i]) < ${(LAYOUT.road / 2 + 0.4).toFixed(3)}) lampGone = true;
    }
    if (lampGone && ${DITHER} < uRoadsIn) discard;
  }`,
          );
      };
      mat.customProgramCacheKey = () => `${prevKey()}|lamp-cut`;
      mat.needsUpdate = true;
      out.lamps += 1;
      return;
    }
    if (mesh.name !== 'hardscape_kerbs') return;
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial & {
      __kerbCut?: boolean;
    };
    if (!mat || mat.__kerbCut) return;
    // ON THE TRIM'S OWN MATERIAL, not a copy of it: it is the house's trim too,
    // and the test below is true nowhere on the house.
    mat.__kerbCut = true;
    const prev = mat.onBeforeCompile;
    const prevKey = mat.customProgramCacheKey.bind(mat);
    mat.onBeforeCompile = (shader, renderer) => {
      prev.call(mat, shader, renderer);
      shader.uniforms.uRoadsIn = hazeUniforms.uHazeGround;
        shader.uniforms.uRoadsFrame = hazeUniforms.uHazeFrame;
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying vec3 vKerbCut;\nvoid main() {')
        .replace('#include <project_vertex>', '#include <project_vertex>\n  vKerbCut = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'varying vec3 vKerbCut;\nuniform float uRoadsIn;\nuniform float uRoadsFrame;\nvoid main() {')
        .replace(
          '#include <clipping_planes_fragment>',
          /* glsl */ `#include <clipping_planes_fragment>
  {
    float mouths[${LAYOUT.roads.length}] = float[](${roadList});
    if (abs(abs(vKerbCut.x) - ${LAYOUT.avenue.toFixed(2)}) < 0.1 && vKerbCut.y < 0.3) {
      for (int i = 0; i < ${LAYOUT.roads.length}; i++) {
        if (abs(vKerbCut.z - mouths[i]) < ${(LAYOUT.road / 2).toFixed(3)} && ${DITHER} < uRoadsIn) discard;
      }
    }
  }`,
        );
    };
    mat.customProgramCacheKey = () => `${prevKey()}|kerb-cut`;
    mat.needsUpdate = true;
    out.kerbs += 1;
  });
  return out;
}

const WET_NOISE_GLSL = /* glsl */ `
float roadHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float roadNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(roadHash(i), roadHash(i + vec2(1.0, 0.0)), f.x),
             mix(roadHash(i + vec2(0.0, 1.0)), roadHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

const WET_GLSL = /* glsl */ `
uniform float uRoadSheen;
uniform float uRoadGlint;
float roadWet;
${WET_NOISE_GLSL}`;

const WET_FRAGMENT = /* glsl */ `
#include <roughnessmap_fragment>
{
  float wetField = roadNoise(vRoadWorld.xz / ${LAYOUT.wet.size[0].toFixed(1)}) * 0.58
                 + roadNoise(vRoadWorld.xz / ${LAYOUT.wet.size[1].toFixed(1)} + 7.3) * 0.28
                 + roadNoise(vRoadWorld.xz / ${LAYOUT.wet.size[2].toFixed(1)} + 3.1) * 0.14;
  roadWet = smoothstep(${LAYOUT.wet.at[0].toFixed(2)}, ${LAYOUT.wet.at[1].toFixed(2)}, wetField)
          * smoothstep(${LAYOUT.wet.from.toFixed(1)}, ${(LAYOUT.wet.from + 3).toFixed(1)}, vRoadWorld.z);
  roughnessFactor = mix(roughnessFactor, ${LAYOUT.wet.rough.toFixed(2)}, roadWet);
  diffuseColor.rgb *= mix(1.0, ${LAYOUT.wet.dark.toFixed(2)}, roadWet);
}`;

/** What the wet takes of the pale sky at a low angle, only by the layout's
 *  daylight (a sky lit at dusk would stand on the avenue as a glare). */
const WET_SHEEN = /* glsl */ `
#include <emissivemap_fragment>
{
  float roadFresnel = pow(clamp(1.0 - dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
  totalEmissiveRadiance += roadWet * roadFresnel * uRoadSheen * vec3(0.8, 0.74, 0.6) * ${LAYOUT.wet.sheen.toFixed(2)};
}`;

export const roadSheen = { value: 0 };
export const roadGlint = { value: 1 };

/**
 * THE ROADS AFTER RAIN (the founder's frame: "wet specular asphalt glints").
 * The cross roads and the avenue south of the forecourt lie in patches of wet:
 * where the field above says so the stone goes smooth and a little darker, so
 * it takes the sky at the low angle the layout sees it from, pale on the dark
 * road. The forecourt is left as it was approved (its satin was set against
 * the lantern and the door's words: POLISH, MAT_Drive_Polished): the test is
 * on the world's z, from where the avenue leaves its ring. On the drive's own
 * material, as the kerb's cut is on the trim's, and it needs no clock: wet
 * stone takes whatever sky there is, and goes down with it at dusk.
 */
export function wetTheRoads(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.name.startsWith('drive_')) return;
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial & {
      __roadsWet?: boolean;
    };
    if (!mat || mat.__roadsWet) return;
    mat.__roadsWet = true;
    const prev = mat.onBeforeCompile;
    const prevKey = mat.customProgramCacheKey.bind(mat);
    mat.onBeforeCompile = (shader, renderer) => {
      prev.call(mat, shader, renderer);
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying vec3 vRoadWorld;\nvoid main() {')
        .replace('#include <project_vertex>', '#include <project_vertex>\n  vRoadWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.uniforms.uRoadSheen = roadSheen;
      shader.uniforms.uRoadGlint = roadGlint;
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', `varying vec3 vRoadWorld;\n${WET_GLSL}\nvoid main() {`)
        .replace('#include <roughnessmap_fragment>', WET_FRAGMENT)
        .replace('#include <emissivemap_fragment>', WET_SHEEN)
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n  reflectedLight.directSpecular *= uRoadGlint;');
    };
    mat.customProgramCacheKey = () => `${prevKey()}|roads-wet`;
    mat.needsUpdate = true;
    n += 1;
  });
  return n;
}

// ── The survey's drawing ───────────────────────────────────────────────────

export const layoutUniforms = { uLayout: { value: 0 }, uLow: { value: 0 }, uLayoutDusk: { value: 0 } };
let sheetMesh: THREE.Mesh | null = null;

/** The ground's lie as the drawing gives it (the cover's survey's own:
 *  exteriorSurvey.ts, surveyHeight), metres. */
const LIE_GLSL = /* glsl */ `
float layoutLie(vec2 p) {
  // a long fall across the land, so the lines run on across a block as the
  // founder's do, and the swell and the small lie of real ground on it (without
  // the fall they close into rings, without the small lie they are arcs of
  // circles, a drawing of a formula)
  return 0.2 * (p.x * 0.55 - p.y * 0.83)
       + 1.5 * sin(p.x * 0.045 + 1.3 * sin(p.y * 0.031))
       + 1.2 * sin(p.y * 0.052 + 0.9)
       + 0.7 * sin((p.x + p.y) * 0.07 + 2.1)
       + 0.4 * sin(p.x * 0.21 + 1.6 * sin(p.y * 0.13) + 0.7)
       + 0.3 * sin(p.y * 0.27 + 1.4 * sin(p.x * 0.17) + 2.4)
       + 0.16 * sin((p.x - p.y) * 0.43 + 1.1);
}
// a line a pixel or so wide at distance d (w: a pixel's reach in d's units)
float layoutLine(float d, float w, float px) {
  return 1.0 - smoothstep(0.35 * px * w, 1.15 * px * w, d);
}
`;

export function layoutSheet(): THREE.Mesh {
  const [x0, x1, z0, z1] = LAYOUT.sheet.area;
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, LAYOUT.sheet.y, (z0 + z1) / 2);
  const blocks = layoutBlocks();
  const I = LAYOUT.ink;
  const f = (v: number) => v.toFixed(3);
  // the blocks, as GLSL: their edges
  const blockList = blocks.map((b) => `vec4(${b.map(f).join(', ')})`).join(',\n      ');
  const roadList = LAYOUT.roads.map(f).join(', ');
  const [sx0, sx1, sz0, sz1] = layoutSideRoad();
  const clearings = LAYOUT.clear.map((c) => `vec4(${c.map(f).join(', ')})`).join(', ');
  const material = new THREE.ShaderMaterial({
    name: 'MAT_Layout_Sheet',
    uniforms: layoutUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLayout;
      uniform float uLow;
      uniform float uLayoutDusk;
      varying vec3 vWorld;
      ${LIE_GLSL}
      ${WET_NOISE_GLSL}
      const int BLOCKS = ${blocks.length};
      const int ROADS = ${LAYOUT.roads.length};
      void main() {
        if (uLow <= 0.0) discard;
        vec2 p = vWorld.xz;
        // a pixel's reach along each axis: a line is measured by the axis it
        // is measured along, or one that runs away from the eye (a pixel is a
        // few centimetres across it and half a metre along) comes out ten
        // pixels wide
        vec2 pw = fwidth(p);
        vec4 blocks[BLOCKS] = vec4[](
      ${blockList}
        );
        float roads[ROADS] = float[](${roadList});
        // the ground's contours, once for all the blocks
        float fl = layoutLie(p) / ${f(LAYOUT.interval)};
        float wl = fwidth(fl);
        float contour = layoutLine(abs(fract(fl + 0.5) - 0.5), wl, 0.62) * (1.0 - smoothstep(0.15, 0.35, wl));
        float index = layoutLine(abs(fract(fl / 5.0 + 0.5) - 0.5), wl / 5.0, 0.85) * (1.0 - smoothstep(0.15, 0.35, wl / 5.0));
        // (broken round a plot's title, as a map's are round a name)
        vec4 clearings[${LAYOUT.clear.length}] = vec4[](${clearings});
        for (int i = 0; i < ${LAYOUT.clear.length}; i++) {
          float open = smoothstep(0.75, 1.15, length((p - clearings[i].xy) / clearings[i].zw));
          contour *= open;
          index *= open;
        }
        float ink = 0.0;
        for (int i = 0; i < BLOCKS; i++) {
          vec4 b = blocks[i];
          // distance to the block's line, outside and in
          vec2 c = vec2(b.x + b.y, b.z + b.w) * 0.5;
          vec2 h = vec2(b.y - b.x, b.w - b.z) * 0.5;
          vec2 q = abs(p - c) - h;
          float outer = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
          // (whichever axis the nearer edge is measured along)
          float wo = q.x > q.y ? pw.x : pw.y;
          // twice round: on the line, and a step inside it
          ink = max(ink, layoutLine(abs(outer), wo, 1.1) * ${f(I.block)});
          ink = max(ink, layoutLine(abs(outer + 0.75), wo, 0.75) * ${f(I.block * 0.6)});
          if (outer < 0.0) {
            // the plots' lines: across at each frontage, and the back line
            // down the middle where the two rows meet. (A block one row deep,
            // beyond the side road, fronts that road: its plots run along z.)
            bool side = h.x < ${f(LAYOUT.plot.depth * 0.75)};
            float along = side ? p.y - b.z : p.x - b.x;
            float pa = side ? pw.y : pw.x;
            float pb = side ? pw.x : pw.y;
            float fx = along / ${f(LAYOUT.plot.frontage)};
            float lx = abs(fract(fx + 0.5) - 0.5) * ${f(LAYOUT.plot.frontage)};
            float lz = side ? 1.0e4 : abs(p.y - c.y);
            float plots = max(layoutLine(lx, pa, 0.7), layoutLine(lz, pb, 0.7));
            ink = max(ink, plots * ${f(I.plot)} * step(0.75, -outer));
            // a tick at each plot's corner on the road
            float tz = side ? min(abs(p.x - b.x), abs(p.x - b.y)) : min(abs(p.y - b.z), abs(p.y - b.w));
            float tick = layoutLine(lx, pa, 0.9) * (1.0 - smoothstep(1.4, 1.8, tz));
            ink = max(ink, tick * ${f(I.tick)});
            // the contours, inside the inner line
            ink = max(ink, max(contour * ${f(I.contour)}, index * ${f(I.contour * 1.35)}) * step(1.2, -outer));
          }
        }
        // the roads' edges, the avenue's, and a broken line down the middle of
        // each for what is laid under it
        float ax = abs(p.x);
        float onRoads = step(${f(-LAYOUT.reach.west)}, p.x) * step(p.x, ${f(LAYOUT.reach.east)});
        for (int i = 0; i < ROADS; i++) {
          float dz = abs(p.y - roads[i]);
          float edge = layoutLine(abs(dz - ${f(LAYOUT.road / 2)}), pw.y, 0.8) * step(${f(LAYOUT.avenue)}, ax);
          ink = max(ink, edge * onRoads * ${f(I.edge)});
          float dash = step(0.5, fract(p.x / ${f(LAYOUT.dash)}));
          float service = layoutLine(dz, pw.y, 0.8) * dash * step(${f(LAYOUT.avenue + 1.0)}, ax);
          ink = max(ink, service * onRoads * ${f(I.service)});
        }
        float alongAvenue = step(${f(LAYOUT.roads[0] - LAYOUT.road / 2)}, p.y) * step(p.y, ${f(LAYOUT.sheet.area[3])});
        float aEdge = layoutLine(abs(ax - ${f(LAYOUT.avenue)}), pw.x, 0.8);
        float aService = layoutLine(ax, pw.x, 0.8) * step(0.5, fract(p.y / ${f(LAYOUT.dash)}));
        ink = max(ink, max(aEdge * ${f(I.edge)}, aService * ${f(I.service)}) * alongAvenue);
        // and the side road's
        float sd = abs(p.x - ${f((sx0 + sx1) / 2)});
        float onSide = step(${f(sz0)}, p.y) * step(p.y, ${f(sz1)});
        float sEdge = layoutLine(abs(sd - ${f(LAYOUT.road / 2)}), pw.x, 0.8);
        float sService = layoutLine(sd, pw.x, 0.8) * step(0.5, fract(p.y / ${f(LAYOUT.dash)}));
        ink = max(ink, max(sEdge * ${f(I.edge)}, sService * ${f(I.service)}) * onSide);
        // with distance from the eye
        float dist = distance(cameraPosition, vWorld);
        ink *= 1.0 - smoothstep(${f(LAYOUT.far[0])}, ${f(LAYOUT.far[1])}, dist);
        // THE TREES' LONG SHADE ACROSS THE LAND (the founder's frame: "rich
        // shadows"): the plots lie in soft bars of the low sun's shade, long
        // along the way it falls (the sun is at x 86, z 50) and gone before
        // the sheet's edge.
        vec2 sun = vec2(0.864, 0.502);
        vec2 bar = vec2(dot(p, sun) / ${f(LAYOUT.shade.long)}, dot(p, vec2(-sun.y, sun.x)) / ${f(LAYOUT.shade.wide)});
        float dapple = roadNoise(bar + 3.1) * 0.7 + roadNoise(bar * 2.3 + 9.2) * 0.3;
        float shade = 1.0 - (1.0 - ${f(LAYOUT.shade.base)}) * (1.0 - smoothstep(${f(LAYOUT.shade.at[0])}, ${f(LAYOUT.shade.at[1])}, dapple) * ${f(LAYOUT.shade.most)});
        shade *= smoothstep(${f(x0)}, ${f(x0 + 8)}, p.x) * (1.0 - smoothstep(${f(x1 - 8)}, ${f(x1)}, p.x))
               * smoothstep(${f(z0)}, ${f(z0 + 8)}, p.y) * (1.0 - smoothstep(${f(z1 - 8)}, ${f(z1)}, p.y));
        ink *= uLayout;
        shade *= uLow;
        // (the dapple is the low sun's, and it goes with it)
        shade *= 1.0 - 0.75 * uLayoutDusk;
        // the veil over the lawn round the house
        float northOf = 1.0 - smoothstep(${f(LAYOUT.roads[0] - LAYOUT.road / 2 - 3)}, ${f(LAYOUT.roads[0] - LAYOUT.road / 2)}, p.y);
        float veil = uLow * northOf * mix(${f(LAYOUT.veil.west)}, ${f(LAYOUT.veil.east)}, smoothstep(6.0, 30.0, p.x))
                   * smoothstep(${f(z0)}, ${f(z0 + 8)}, p.y) * smoothstep(${f(x0)}, ${f(x0 + 8)}, p.x) * (1.0 - smoothstep(${f(x1 - 8)}, ${f(x1)}, p.x));
        shade *= 1.0 - northOf;
        // (The misty light is gone with the sun: the land under the blue hour is
        // its own dark, and the drawing a white line on it. filmHours.ts.)
        veil *= 1.0 - uLayoutDusk;
        float a = 1.0 - (1.0 - ink) * (1.0 - shade) * (1.0 - veil);
        if (a < 0.003) discard;
        // a warm ivory, toward the founder's bronze, over the shade's dark
        vec3 veilColour = vec3(${LAYOUT.veil.colour.map(f).join(', ')});
        vec3 inkColour = mix(vec3(0.88, 0.78, 0.58), vec3(0.84, 0.84, 0.82), uLayoutDusk);
        gl_FragColor = vec4((inkColour * ink + veilColour * veil * (1.0 - ink)) / a, a);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    fog: false,
    toneMapped: false,
  });
  keepDepthAlpha(material);
  const mesh = new THREE.Mesh(g, material);
  mesh.name = 'layout_sheet';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 2;
  mesh.visible = false;
  sheetMesh = mesh;
  return mesh;
}

// ── Its words, on the ground ────────────────────────────────────────────────

/**
 * Where each of site-home's `[data-layout-label="i"]` lies: its middle on the
 * ground, the way its line of type runs there (x, z), and how far from the eye
 * it is drawn at its own size (nearer, larger; further, smaller). As the
 * founder's frame sets its words: along the line of the road or the plot they
 * name, upright and whole, not laid flat (laid flat at this height a line of
 * type is two-fifths of its height), a little pressed toward the ground.
 */
export const LAYOUT_LABELS: readonly {
  at: readonly [number, number];
  along: readonly [number, number];
  near: number;
  /** Set level across the frame, not along a line: a plot's title, as his are. */
  level?: boolean;
}[] = [
  // the first block's title (the founder's lower plot)
  { at: [-16, 57.7], along: [1, 0], near: 78, level: true },
  // north of the first road, on the lawn beside it: what the drawing is (his
  // "LP" line, on the ground at x -25, z 38)
  { at: [-25, 38.2], along: [1, 0], near: 78 },
  // the bounds, on the first road and on the first block's line
  { at: [-22, 43.4], along: [1, 0], near: 72 },
  { at: [-23, 48.7], along: [1, 0], near: 70 },
  // down the avenue, on its open stretch: what is laid under the roads (his
  // line, on the ground at x -2.5, z 74.5)
  { at: [-2.5, 74.5], along: [0, 1], near: 80 },
  // the east block's title (his right-hand plot's)
  { at: [30, 57.3], along: [1, 0], near: 110, level: true },
  // a plot's two dimensions, on the east block's lines
  { at: [14, 51.6], along: [1, 0], near: 90 },
  { at: [6.8, 62], along: [0, 1], near: 85 },
  // the side road's bound (his, between his two right-hand plots)
  { at: [46, 66], along: [0, 1], near: 118 },
  // and what the drawing is again, east of the avenue (his second "LP" line)
  { at: [54, 38.6], along: [1, 0], near: 130 },
];

const A = new THREE.Vector3();
const B = new THREE.Vector3();

/**
 * The drawing's fade, and its words set over the ground: each frame the
 * sheet's uniform, every `[data-layout-label]` stood over its place along its
 * line, and the chapter's status (`[data-layout-hud]`), all faded with the
 * drawing. Renders nothing.
 */
export function LayoutMarks() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const labels = useRef<HTMLElement[]>([]);
  const widths = useRef(new Map<HTMLElement, number>());
  const huds = useRef<HTMLElement[]>([]);
  const next = useRef(0);
  const shown = useRef(-1);
  useEffect(
    () => () => {
      for (const el of [...labels.current, ...huds.current]) el.style.opacity = '0';
    },
    [],
  );
  useFrame(() => {
    const on = layoutOn(journeyState.leg, journeyState.legProgress, !!journeyState.film);
    const low = layoutLow(journeyState.leg, journeyState.legProgress, !!journeyState.film);
    layoutUniforms.uLayout.value = on;
    layoutUniforms.uLow.value = low;
    layoutUniforms.uLayoutDusk.value = filmState.evening;
    if (sheetMesh) sheetMesh.visible = low > 0;
    // (the sheen is the golden hour's: at the blue hour, grey clouds on the road)
    roadSheen.value = layoutAir(journeyState.leg, journeyState.legProgress, !!journeyState.film) * (1 - 0.85 * filmState.evening);
    roadGlint.value = 1 - (1 - LAYOUT.low.glint) * low;
    const now = performance.now();
    if (now > next.current) {
      next.current = now + 1000;
      labels.current = Array.from(document.querySelectorAll<HTMLElement>('[data-layout-label]'));
      for (const el of labels.current) widths.current.set(el, el.offsetWidth);
      huds.current = Array.from(document.querySelectorAll<HTMLElement>('[data-layout-hud]'));
    }
    if (on <= 0.001) {
      if (shown.current !== 0) for (const el of [...labels.current, ...huds.current]) el.style.opacity = '0';
      shown.current = 0;
      return;
    }
    shown.current = on;
    const W = size.width;
    const H = size.height;
    const px = (v: THREE.Vector3) => [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H] as const;
    for (const el of labels.current) {
      const l = LAYOUT_LABELS[Number(el.dataset.layoutLabel)];
      if (!l) continue;
      A.set(l.at[0], LAYOUT.sheet.y, l.at[1]);
      const d = A.distanceTo(camera.position);
      const lift = (camera.position.y - A.y) / Math.max(1, d);
      A.project(camera);
      B.set(l.at[0] + l.along[0], LAYOUT.sheet.y, l.at[1] + l.along[1]).project(camera);
      const seen = A.z < 1 && B.z < 1 && Math.abs(A.x) < 1.3 && Math.abs(A.y) < 1.3;
      const [ax, ay] = px(A);
      const [bx, by] = px(B);
      let turn = Math.atan2(by - ay, bx - ax);
      // never upside down
      if (turn > Math.PI / 2) turn -= Math.PI;
      if (turn < -Math.PI / 2) turn += Math.PI;
      if (l.level) turn = 0;
      const k = Math.min(1.3, Math.max(0.7, l.near / d));
      // pressed toward the ground as much as it is seen from above
      const press = 0.72 + 0.28 * Math.min(1, lift * 1.6);
      // (a line the frame's edge would cut is not set at all: a tablet's frame
      // is the middle of the wide one)
      const half = (widths.current.get(el) ?? 0) * k * 0.5 * Math.abs(Math.cos(turn));
      const whole = ax - half > 8 && ax + half < W - 8;
      el.style.transform = `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0) rotate(${turn.toFixed(4)}rad) scale(${k.toFixed(3)}, ${(k * press).toFixed(3)}) translate(-50%, -50%)`;
      el.style.opacity = seen && whole ? on.toFixed(3) : '0';
    }
    for (const el of huds.current) el.style.opacity = on.toFixed(3);
  });
  return null;
}
