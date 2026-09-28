// apps/public/src/components/experience/hallJoinery.ts
//
// The hall's turned joinery and its pair of urns, rebuilt as clean geometry.
//
// WHAT WAS WRONG, AND WHY IT IS NOT A MATERIAL PROBLEM. The client review said
// both vases "look broken" and the stairs "look broken at the top". Both were
// true and both were geometry:
//
//   dress_urn_*      a photogrammetry urn decimated 30k -> 7k triangles. Its
//                    colour atlas was cut for the full mesh, so after the
//                    collapse every island samples the wrong texels: close up
//                    it reads as a vase that has been dropped and glued.
//   newel_*          KIT_newel_hi_M, decimated 40k -> 6k. The carving shattered
//                    into slivers whose normals disagree, so under any light the
//                    posts render speckled black-and-white.
//   bal_*            KIT_baluster_hi_M, 4.5k -> 1.2k, the same failure at a
//                    smaller scale — a grey, noisy stick.
//   newel_top_*      a second post 0.8 m behind the head of each flight, standing
//                    2 cm INSIDE the back wall. With the post at the head of the
//                    rake that is two newels crammed onto a 0.6 m landing, which
//                    is the "broken" top of the stairs.
//
// Clearing their textures does not help — that was tried, and the speckle
// stayed, because it lives in the normals. So they are replaced: lathe-turned
// profiles, the way this joinery is actually made, placed exactly where the
// originals stand and carrying the originals' own materials, so the room's
// finishes (hallFinish.ts) reach them like everything else.
//
// The wall-embedded top newels are retired rather than replaced. The landing
// rail already dies into the wall behind them, which is how a rail meets a wall.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Lathe control points, bottom to top: [radius, height] in metres. */
export type Profile = ReadonlyArray<readonly [number, number]>;

/** Spline samples between two control points. Four keeps a bead round
 *  without spending triangles on a straight run. */
const PER_SPAN = 4;

/**
 * A covered urn, 1 m tall: foot, stem, an egg-shaped body, a shoulder, a neck,
 * a lipped mouth and a lid with a finial. Proportions follow the bronze urn in
 * the approved Cycles renders (FINAL/v8_2_leftwall).
 */
export const URN_PROFILE: Profile = [
  [0.0, 0.0], [0.16, 0.0], [0.16, 0.026], [0.14, 0.038], // 0-3   foot
  [0.095, 0.058], [0.068, 0.095], [0.072, 0.125], // 4-6   stem
  [0.105, 0.15], [0.115, 0.165], // 7-8   collar
  [0.18, 0.21], [0.235, 0.28], [0.262, 0.36], [0.268, 0.44], // 9-12  body
  [0.255, 0.53], [0.222, 0.61], [0.175, 0.67], [0.132, 0.705], // 13-16 shoulder
  [0.112, 0.735], [0.108, 0.77], // 17-18 neck
  [0.145, 0.79], [0.15, 0.815], [0.12, 0.828], // 19-21 lip
  [0.125, 0.855], [0.1, 0.885], [0.058, 0.905], // 22-24 lid
  [0.03, 0.922], [0.048, 0.948], [0.046, 0.972], [0.02, 0.994], [0.0, 1.0], // 25-29 finial
];

/** Control-index spans of the urn drawn in gilt; the rest is bronze. */
export const URN_GILT_SPANS: ReadonlyArray<readonly [number, number]> = [
  [0, 3], // the foot
  [6, 8], // the stem collar
  [18, 21], // the lip
  [24, 29], // the finial
];

/** A gilt ring on the shoulder, at control point 14. */
export const URN_SHOULDER_BAND = { at: 14, tube: 0.007 } as const;

/** How much of the original urn's height the replacement fills. The original
 *  bounding box included its lid knob; this one reads better a touch smaller on
 *  a 0.68 m plinth. */
export const URN_FILL = 0.95;

/**
 * A vase baluster, normalised to 1 m. Square blocks top and bottom (drawn as
 * boxes); the turned section between them.
 */
export const BALUSTER = {
  half: 0.035,
  foot: 0.09,
  head: 0.9,
  turned: [
    [0.03, 0.09], [0.042, 0.1], [0.042, 0.115], [0.03, 0.13], [0.028, 0.16],
    [0.045, 0.25], [0.052, 0.34], [0.045, 0.44], [0.026, 0.55], [0.02, 0.62],
    [0.022, 0.7], [0.034, 0.74], [0.034, 0.76], [0.024, 0.79], [0.022, 0.84],
    [0.035, 0.87], [0.035, 0.89], [0.03, 0.9],
  ] as Profile,
} as const;

/**
 * A turned newel, 1.4 m — the height of the originals. Square plinth and base
 * block, a vase turning, a square head block where the rail lands, a cap and a
 * finial.
 */
export const NEWEL = {
  height: 1.4,
  blocks: [
    // [half-width, y0, y1]
    [0.11, 0.0, 0.06],
    [0.1, 0.06, 0.46],
    [0.1, 1.02, 1.26],
    [0.125, 1.26, 1.3],
  ] as ReadonlyArray<readonly [number, number, number]>,
  turned: [
    [0.075, 0.46], [0.092, 0.475], [0.092, 0.5], [0.07, 0.52], [0.068, 0.56],
    [0.09, 0.66], [0.098, 0.74], [0.088, 0.82], [0.062, 0.9], [0.058, 0.95],
    [0.08, 0.975], [0.08, 1.0], [0.07, 1.02],
  ] as Profile,
  finial: [
    [0.0, 1.3], [0.06, 1.3], [0.064, 1.315], [0.04, 1.33], [0.05, 1.355],
    [0.052, 1.37], [0.035, 1.39], [0.0, 1.4],
  ] as Profile,
} as const;

/**
 * A wall sconce's brass, in its own frame: the wall face at x = 0, the room
 * toward +x, the backplate's centre at y = 0. The candle cups and flames the
 * hall already has are kept where they are; this is everything between them and
 * the wall.
 *
 * The originals were a 0.30 m solid cube standing off the pilaster, with two
 * bars floating either side of it — at a distance, a black box on the wall.
 */
export const SCONCE = {
  /** Wall to the candle cups' centre line, as the hall places them. */
  reach: 0.46,
  /** The crossbar under the two cups. */
  bar: { half: 0.18, radius: 0.012, drop: 0.008 },
  plate: { radius: 0.075, tall: 2.0, thick: 0.025 },
  /** The turned stem from the backplate to the crossbar, [radius, distance]. */
  stem: [
    [0.036, 0.02], [0.042, 0.035], [0.026, 0.06], [0.018, 0.12], [0.026, 0.2],
    [0.031, 0.22], [0.02, 0.26], [0.014, 0.36], [0.02, 0.42], [0.03, 0.44],
    [0.028, 0.46], [0.0, 0.47],
  ] as Profile,
} as const;

/** Which originals are replaced, and which are retired outright. */
export const JOINERY_NAMES = {
  newel: /^newel_(bot|mid)_-?\d+$/,
  retiredNewel: /^newel_top_-?\d+$/,
  baluster: /^bal_-?\d+_[lr]\d+$/,
  urn: /^dress_urn_\d+$/,
  plinth: (urn: string) => urn.replace('dress_urn_', 'dress_urn_plinth_'),
  sconcePlate: /^sconce_plate_-?\d+_-?\d+$/,
  sconceArm: /^sconce_arm_-?\d+_-?\d+_\d+$/,
} as const;

/**
 * Catmull-Rom through the control points, sampled PER SPAN so every control
 * point is hit exactly — which is what lets a gilt band start and stop on a
 * moulding rather than somewhere near it.
 */
export function sampleProfile(
  points: Profile,
  from = 0,
  to = points.length - 1,
  perSpan = PER_SPAN,
): THREE.Vector2[] {
  const curve = new THREE.SplineCurve(points.map(([r, y]) => new THREE.Vector2(r, y)));
  const spans = points.length - 1;
  const out: THREE.Vector2[] = [];
  for (let i = from; i < to; i++) {
    for (let k = 0; k < perSpan; k++) {
      const p = curve.getPoint((i + k / perSpan) / spans);
      out.push(new THREE.Vector2(Math.max(0, p.x), p.y));
    }
  }
  const [r, y] = points[to];
  out.push(new THREE.Vector2(r, y));
  return out;
}

/**
 * LatheGeometry, with its normals made unit length. three leaves the LAST
 * vertex of the path carrying the raw, unnormalised edge vector of the final
 * span, so a short span at a finial hands the shader a near-zero normal.
 */
function lathe(points: THREE.Vector2[], radial: number): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(points, radial);
  g.normalizeNormals();
  return g;
}

function box(half: number, y0: number, y1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(half * 2, y1 - y0, half * 2);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

function merge(parts: THREE.BufferGeometry[], groups = false): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, groups);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error('hallJoinery: geometry parts are not mergeable');
  return merged;
}

/** Urn with two groups: 0 bronze, 1 gilt. Height 1, standing on y = 0. */
export function urnGeometry(radial = 48): THREE.BufferGeometry {
  const bronze: THREE.BufferGeometry[] = [];
  const gilt: THREE.BufferGeometry[] = [];
  let cursor = 0;
  for (const [a, b] of URN_GILT_SPANS) {
    if (a > cursor) bronze.push(lathe(sampleProfile(URN_PROFILE, cursor, a), radial));
    gilt.push(lathe(sampleProfile(URN_PROFILE, a, b), radial));
    cursor = b;
  }
  if (cursor < URN_PROFILE.length - 1) {
    bronze.push(lathe(sampleProfile(URN_PROFILE, cursor), radial));
  }
  const [r, y] = URN_PROFILE[URN_SHOULDER_BAND.at];
  const band = new THREE.TorusGeometry(r, URN_SHOULDER_BAND.tube, 8, radial);
  band.rotateX(Math.PI / 2);
  band.translate(0, y, 0);
  gilt.push(band);
  return merge([merge(bronze), merge(gilt)], true);
}

/** Baluster, height 1 on y = 0; scaled to each placement's height. */
export function balusterGeometry(radial = 12): THREE.BufferGeometry {
  return merge([
    box(BALUSTER.half, 0, BALUSTER.foot),
    lathe(sampleProfile(BALUSTER.turned), radial),
    box(BALUSTER.half, BALUSTER.head, 1),
  ]);
}

/** Newel, NEWEL.height tall on y = 0. */
export function newelGeometry(radial = 24): THREE.BufferGeometry {
  return merge([
    ...NEWEL.blocks.map(([half, y0, y1]) => box(half, y0, y1)),
    lathe(sampleProfile(NEWEL.turned), radial),
    lathe(sampleProfile(NEWEL.finial), radial),
  ]);
}

/** Sconce brass in the SCONCE frame (wall at x = 0, room toward +x). */
export function sconceGeometry(): THREE.BufferGeometry {
  const { plate, bar, stem, reach } = SCONCE;
  const back = new THREE.CylinderGeometry(plate.radius, plate.radius, plate.thick, 32);
  back.rotateZ(Math.PI / 2);
  back.scale(1, plate.tall, 1);
  back.translate(plate.thick / 2, 0, 0);
  // Turned about y, then laid down so its axis runs out of the wall along +x.
  const arm = lathe(sampleProfile(stem), 16);
  arm.rotateZ(-Math.PI / 2);
  const cross = new THREE.CylinderGeometry(bar.radius, bar.radius, bar.half * 2, 12);
  cross.rotateX(Math.PI / 2);
  cross.translate(reach, bar.drop, 0);
  const knobs = [-1, 1].map((side) => {
    const k = new THREE.SphereGeometry(bar.radius * 1.5, 12, 8);
    k.translate(reach, bar.drop, side * bar.half);
    return k;
  });
  // Sphere and cylinder carry the same attributes as the lathe (position,
  // normal, uv), so all five merge into one draw.
  return merge([back, arm, cross, ...knobs]);
}

/**
 * THE FRIEZE HAS NEVER BEEN SEEN. Every anthemion on the hall's frieze (208
 * nodes, one shared KIT_anth_M mesh) was modelled with its carving facing local
 * -Z, and every node is placed so local -Z points INTO the wall. So from the
 * room only their back faces were visible, and three culls back faces: the
 * frieze rendered as bare plaster, and what read as ornament was the bake's
 * dark star-shaped occlusion where each hidden plaque meets the wall. Under the
 * old flat ambient those stars were a faint grey; with the bake left to light
 * its own surfaces they went black. VERIFIED by painting the anthemions magenta:
 * single-sided they did not appear at all; double-sided they sat exactly on the
 * black stars.
 *
 * The fix is to the geometry, once: mirror the shared mesh through its own
 * mid-plane (z -> -z, winding reversed, normals mirrored), so the carving faces
 * the room from the same 2.3 cm slab and covers the occlusion it casts.
 */
export function faceTheFrieze(root: THREE.Object3D): number {
  const done = new Set<THREE.BufferGeometry>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !/^anth_/.test(mesh.name)) return;
    const g = mesh.geometry as THREE.BufferGeometry & { userData: { facesRoom?: boolean } };
    if (done.has(g) || g.userData.facesRoom) return;
    done.add(g);
    g.userData.facesRoom = true;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 1) pos.setZ(i, -pos.getZ(i));
    pos.needsUpdate = true;
    const nrm = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
    if (nrm) {
      for (let i = 0; i < nrm.count; i += 1) nrm.setZ(i, -nrm.getZ(i));
      nrm.needsUpdate = true;
    }
    // A mirror turns every triangle inside out; reverse the winding.
    const index = g.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const b = index.getX(i + 1);
        index.setX(i + 1, index.getX(i + 2));
        index.setX(i + 2, b);
      }
      index.needsUpdate = true;
    }
    g.computeBoundingBox();
    g.computeBoundingSphere();
  });
  return done.size;
}

export interface Refurnished {
  counts: { newels: number; retired: number; balusters: number; urns: number; sconces: number };
  /** Remove what was added, release what was created, show the originals again. */
  dispose(): void;
}

/**
 * Swap the broken joinery in a loaded hall for the turned replacements.
 *
 * Placement is read from each original's bounding box in the root's space:
 * centred on it in plan, standing on its lowest point, as tall as it is. So a
 * re-export that moves a newel moves its replacement with it, and nothing here
 * carries a coordinate of its own.
 *
 * The 54 balusters become ONE InstancedMesh: 54 draw calls in, one out.
 */
export function refurnishHall(root: THREE.Object3D): Refurnished {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const boxOf = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).applyMatrix4(toRoot);

  const newels: THREE.Mesh[] = [];
  const retired: THREE.Mesh[] = [];
  const balusters: THREE.Mesh[] = [];
  const urns: THREE.Mesh[] = [];
  const plates: THREE.Mesh[] = [];
  const arms: THREE.Mesh[] = [];
  // Typed through `as`: a plain `= null` initialiser would narrow this to null
  // for the rest of the function, since TS cannot see the assignment inside
  // the traverse callback.
  let gold = null as THREE.Material | null;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (JOINERY_NAMES.newel.test(m.name)) newels.push(m);
    else if (JOINERY_NAMES.retiredNewel.test(m.name)) retired.push(m);
    else if (JOINERY_NAMES.baluster.test(m.name)) balusters.push(m);
    else if (JOINERY_NAMES.urn.test(m.name)) urns.push(m);
    else if (JOINERY_NAMES.sconcePlate.test(m.name)) plates.push(m);
    else if (JOINERY_NAMES.sconceArm.test(m.name)) arms.push(m);
    const mat = m.material as THREE.Material;
    if (!gold && !Array.isArray(m.material) && mat?.name === 'MAT_Gold') gold = mat;
  });

  const added: THREE.Object3D[] = [];
  const created: { dispose(): void }[] = [];
  // The arms go only if there are plates to replace them from; a hall with arms
  // and no plates keeps what it has.
  const retiredArms = plates.length ? arms : [];
  const hidden = [...newels, ...retired, ...balusters, ...urns, ...plates, ...retiredArms].filter((m) => m.visible);
  const single = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material[0] : m.material);

  if (newels.length) {
    const geometry = newelGeometry();
    created.push(geometry);
    for (const original of newels) {
      const b = boxOf(original);
      const post = new THREE.Mesh(geometry, single(original));
      post.name = `${original.name}_turned`;
      post.position.set((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2);
      post.scale.set(1, (b.max.y - b.min.y) / NEWEL.height, 1);
      root.add(post);
      added.push(post);
    }
  }

  if (balusters.length) {
    const geometry = balusterGeometry();
    created.push(geometry);
    const byMaterial = new Map<THREE.Material, THREE.Mesh[]>();
    for (const b of balusters) {
      const mat = single(b);
      byMaterial.set(mat, [...(byMaterial.get(mat) ?? []), b]);
    }
    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (const [material, list] of byMaterial) {
      const run = new THREE.InstancedMesh(geometry, material, list.length);
      run.name = 'balusters_turned';
      list.forEach((original, i) => {
        const b = boxOf(original);
        p.set((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2);
        s.set(1, b.max.y - b.min.y, 1);
        run.setMatrixAt(i, matrix.compose(p, q, s));
      });
      run.instanceMatrix.needsUpdate = true;
      run.computeBoundingSphere();
      root.add(run);
      added.push(run);
      created.push({ dispose: () => run.dispose() });
    }
  }

  if (urns.length) {
    const geometry = urnGeometry();
    const bronze = new THREE.MeshStandardMaterial({
      name: 'MAT_Urn_Bronze',
      color: '#3a2819',
      metalness: 0.5,
      roughness: 0.34,
      envMapIntensity: 6,
    });
    const gilt =
      gold ??
      new THREE.MeshStandardMaterial({ name: 'MAT_Urn_Gilt', color: '#e2bd72', metalness: 0.6, roughness: 0.4 });
    created.push(geometry, bronze);
    if (!gold) created.push(gilt);
    for (const original of urns) {
      const b = boxOf(original);
      const plinth = root.getObjectByName(JOINERY_NAMES.plinth(original.name));
      const floor = plinth ? Math.max(b.min.y, boxOf(plinth).max.y) : b.min.y;
      const urn = new THREE.Mesh(geometry, [bronze, gilt]);
      urn.name = `${original.name}_turned`;
      urn.position.set((b.min.x + b.max.x) / 2, floor, (b.min.z + b.max.z) / 2);
      urn.scale.setScalar((b.max.y - b.min.y) * URN_FILL);
      root.add(urn);
      added.push(urn);
    }
  }

  if (plates.length) {
    // One InstancedMesh for every sconce, in the plates' own material.
    //
    // Each placement is read off its plate: the plate is deepest along the wall
    // normal, its far end from the room's centre is the wall face, and its
    // vertical centre is the sconce's. The frame is turned so SCONCE's +x points
    // into the room from that face.
    const geometry = sconceGeometry();
    created.push(geometry);
    const room = boxOf(root).getCenter(new THREE.Vector3());
    const run = new THREE.InstancedMesh(geometry, single(plates[0]), plates.length);
    run.name = 'sconces_turned';
    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    plates.forEach((plate, i) => {
      const b = boxOf(plate);
      const alongX = b.max.x - b.min.x >= b.max.z - b.min.z;
      const c = b.getCenter(new THREE.Vector3());
      const wall = alongX
        ? new THREE.Vector3(c.x > room.x ? b.max.x : b.min.x, c.y, c.z)
        : new THREE.Vector3(c.x, c.y, c.z > room.z ? b.max.z : b.min.z);
      const inward = alongX
        ? new THREE.Vector3(c.x > room.x ? -1 : 1, 0, 0)
        : new THREE.Vector3(0, 0, c.z > room.z ? -1 : 1);
      // Rotating +x by theta about y gives (cos theta, 0, -sin theta).
      q.setFromAxisAngle(up, Math.atan2(-inward.z, inward.x));
      run.setMatrixAt(i, matrix.compose(wall, q, one));
    });
    run.instanceMatrix.needsUpdate = true;
    run.computeBoundingSphere();
    root.add(run);
    added.push(run);
    created.push({ dispose: () => run.dispose() });
  }

  for (const m of hidden) m.visible = false;

  return {
    counts: {
      newels: newels.length,
      retired: retired.length,
      balusters: balusters.length,
      urns: urns.length,
      sconces: plates.length,
    },
    dispose() {
      for (const o of added) o.removeFromParent();
      for (const c of created) c.dispose();
      for (const m of hidden) m.visible = true;
    },
  };
}
