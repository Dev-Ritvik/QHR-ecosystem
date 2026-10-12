// apps/public/src/components/experience/hallTables.ts
//
// THE TABLES' TURNED WORK, TURNED.
//
// The forensic audit of 2026-10-09 (#38): "The rim is visibly faceted and the
// turned pedestal has flat sides ... Expected: smooth rims and turnings."
//
// Both are in the model as it shipped, and both are small. The top's edge is
// a half-round whose rings were drawn in and out by a centimetre as they go
// round, for a gadrooned rim: at forty-odd lobes of two straight sides each
// it reads as a saw's edge, not as carving. And the pedestal is a clean
// 48-sided turning shaded as 48 flats, one normal a face, so every side of it
// catches the room separately. Nothing here is rebuilt: the tables keep their
// own meshes, their veneer and the light baked on them. Each ring that
// wanders is set to the middle of its wander, which makes the edge the plain
// half-round a turner leaves, and the faces are shaded across the edges a
// lathe does not leave (toCreasedNormals: smooth where two faces meet at less
// than `crease`, a crease where the profile turns harder than that).
//
// The geometry is the parse's own, shared by every mount of the hall (drei
// keeps one), so each is rounded once and the result kept for all of them.

import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** The tables' top and base, by the names the hall's model gives them. */
export const TABLE_TURNED_RE = /^table_(top|base)_S\d+$/;

/**
 * `lobe`: how far a ring may wander and still be one ring, metres (the
 * gadroons are 11 mm deep; two rings of one height are far further apart).
 * `axis`: nearer the axis than this is a face's middle, not a ring. `crease`:
 * the angle past which two faces meet in an edge that is meant, degrees: the
 * top's half-round is six flats 30 to 36 degrees apart and is one curve; the
 * pedestal's beads turn harder than 40 and stay crisp.
 */
export const TABLE_ROUND = { lobe: 0.015, axis: 0.05, crease: { top: 50, base: 40 } } as const;

/**
 * For the vertices of one height, by their distance from the axis: the
 * distance each is set to. Vertices that stand within `lobe` of their
 * neighbour in radius are one ring, and a ring that wanders is set to the
 * middle of its wander; a true ring, and anything by the axis, is left where
 * it is.
 */
export function ringTargets(radii: readonly number[]): number[] {
  const order = radii.map((r, i) => [r, i] as const).sort((a, b) => a[0] - b[0]);
  const out = radii.slice();
  let start = 0;
  for (let k = 1; k <= order.length; k += 1) {
    if (k < order.length && order[k][0] - order[k - 1][0] <= TABLE_ROUND.lobe) continue;
    const lo = order[start][0];
    const hi = order[k - 1][0];
    if (lo >= TABLE_ROUND.axis && hi - lo > 1e-4) {
      const mid = (lo + hi) / 2;
      for (let j = start; j < k; j += 1) out[order[j][1]] = mid;
    }
    start = k;
  }
  return out;
}

/** A turned piece with its rings true and its faces shaded as a turning's. */
export function roundGeometry(source: THREE.BufferGeometry, creaseDeg: number): THREE.BufferGeometry {
  const g = source.clone();
  const p = g.attributes.position as THREE.BufferAttribute;
  g.computeBoundingBox();
  const c = g.boundingBox!.getCenter(new THREE.Vector3());
  const rings = new Map<string, number[]>();
  for (let i = 0; i < p.count; i += 1) {
    const key = p.getY(i).toFixed(3);
    const ring = rings.get(key);
    if (ring) ring.push(i);
    else rings.set(key, [i]);
  }
  for (const ring of rings.values()) {
    const radii = ring.map((i) => Math.hypot(p.getX(i) - c.x, p.getZ(i) - c.z));
    const to = ringTargets(radii);
    ring.forEach((i, n) => {
      if (to[n] === radii[n] || radii[n] < 1e-6) return;
      const k = to[n] / radii[n];
      p.setX(i, c.x + (p.getX(i) - c.x) * k);
      p.setZ(i, c.z + (p.getZ(i) - c.z) * k);
    });
  }
  p.needsUpdate = true;
  const out = toCreasedNormals(g, THREE.MathUtils.degToRad(creaseDeg));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

const rounded = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/** Round every table's top and base under `root`. Returns how many meshes. */
export function roundTables(root: THREE.Object3D): number {
  let count = 0;
  const results = new Set<THREE.BufferGeometry>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !TABLE_TURNED_RE.test(mesh.name)) return;
    count += 1;
    if (results.has(mesh.geometry)) return;
    let g = rounded.get(mesh.geometry);
    if (!g) {
      g = roundGeometry(mesh.geometry, /_top_/.test(mesh.name) ? TABLE_ROUND.crease.top : TABLE_ROUND.crease.base);
      rounded.set(mesh.geometry, g);
    }
    results.add(g);
    mesh.geometry = g;
  });
  return count;
}
