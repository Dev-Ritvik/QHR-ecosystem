// apps/public/src/components/experience/hallStair.ts
//
// THE STAIR'S STRINGS, CLOSED.
//
// The forensic audit of 2026-10-09 (#44): "A black wedge-shaped gap opens at
// every step between the stringer and the treads, and the baluster plinths
// stand on a soft, swollen cap ... Expected: a closed stringer with a crisp
// cap."
//
// The two flights are arcs about one centre: their steps end on a circle
// 4.6 m out from it, and begin on one 2.6 m out. Along each edge runs the cap
// that carries the balusters (bal_plinth_outL and _outR on the outer edges;
// bal_plinth_in on both inner edges and across the landing's front), half a
// metre deep and sloping with the flight. The model set each cap's open face
// a centimetre BEHIND the step ends, so the steps stood out of it as a
// saw-tooth, and the end of every riser showed between the two as a sliver
// that the bake, finding it buried in the cap, had left black. The film
// passes the outer edge close (74 to 77 per cent) and the inner edges from
// the front (73 to 80).
//
// Here each cap's open face is brought just proud of the step ends: one
// continuous face over the steps' outline, with a clean arris above it and a
// line of shadow under it, which is a closed string with its capping. The
// part of that face that lay behind the steps was baked inside them, black,
// so the whole face takes its light from a band just under its top edge,
// which was always open to the room. Where the inner cap runs level across
// the landing's front it is left as it is: there are no step ends there to
// hide, and brought forward it showed its own underside as a dashed line.
//
// Nothing is added and nothing is rebuilt: the caps keep their own faces,
// their trim and the light baked on them. The geometry is the parse's own,
// shared by every mount of the hall (drei keeps one), so each cap is closed
// once and the result kept for all of them.

import * as THREE from 'three';

/**
 * `centre`: the flights' common centre in the hall's own x and z. Per cap:
 * the radius its open face was modelled on, the radius of the step ends it
 * has to cover, and which way its open face looks (1 out of the stair, -1 in
 * toward the well). `proud`: how far the face then stands in front of the
 * step ends, metres. `band`: where its light is taken from, as a share of its
 * height down from its top edge. `tolerance`: how near its radius a vertex
 * must stand to be on the face.
 */
export const STAIR_STRINGS = {
  centre: { x: 0, z: -3.1 },
  caps: [
    { re: /^bal_plinth_out[LR]$/, face: 4.59, steps: 4.6, side: 1 },
    { re: /^bal_plinth_in$/, face: 2.61, steps: 2.6, side: -1 },
  ],
  proud: 0.012,
  band: 0.1,
  tolerance: 0.006,
} as const;

export type StairCap = (typeof STAIR_STRINGS.caps)[number];

/** A cap whose open face stands proud of the step ends and is lit by its own top band. */
export function closeString(source: THREE.BufferGeometry, cap: StairCap): THREE.BufferGeometry {
  const { centre, proud, band, tolerance } = STAIR_STRINGS;
  const g = source.clone();
  const p = g.attributes.position as THREE.BufferAttribute;
  const n = g.attributes.normal as THREE.BufferAttribute;
  const lit = g.attributes.uv1 as THREE.BufferAttribute | undefined;
  const radius = (i: number) => Math.hypot(p.getX(i) - centre.x, p.getZ(i) - centre.z);
  const place = (i: number) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;

  // The open face: upright, looking out of the stair on this cap's side, on
  // the cap's own circle.
  const onFace = new Uint8Array(p.count);
  for (let i = 0; i < p.count; i += 1) {
    const r = radius(i);
    if (r < 1e-6 || Math.abs(n.getY(i)) > 0.1 || Math.abs(r - cap.face) > tolerance) continue;
    const out = (n.getX(i) * (p.getX(i) - centre.x) + n.getZ(i) * (p.getZ(i) - centre.z)) / r;
    if (cap.side * out >= 0.8) onFace[i] = 1;
  }

  // Of its triangles, those that run with a flight: the edge along the cap
  // (the pair of corners nearest one height) climbs. Level ones are the
  // landing's front, which has no step ends to cover.
  const places = new Set<string>();
  const index = g.index;
  const tris = index ? index.count / 3 : p.count / 3;
  const corner = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  for (let t = 0; t < tris; t += 1) {
    const c = [corner(t, 0), corner(t, 1), corner(t, 2)];
    if (!c.every((i) => onFace[i])) continue;
    let along = Infinity;
    let climb = 0;
    for (const [a, b] of [[c[0], c[1]], [c[1], c[2]], [c[2], c[0]]]) {
      const run = Math.hypot(p.getX(a) - p.getX(b), p.getZ(a) - p.getZ(b));
      if (run < 1e-4) continue;
      const rise = Math.abs(p.getY(a) - p.getY(b));
      if (rise < along) { along = rise; climb = rise / run; }
    }
    if (climb > 0.1) for (const i of c) places.add(place(i));
  }

  // Its light: each upright edge of each facet, top to bottom, from the band
  // just under the top.
  if (lit) {
    const edges = new Map<string, number[]>();
    for (let i = 0; i < p.count; i += 1) {
      if (!onFace[i] || !places.has(place(i))) continue;
      const k = `${p.getX(i).toFixed(4)},${p.getZ(i).toFixed(4)}|${n.getX(i).toFixed(3)},${n.getZ(i).toFixed(3)}`;
      const edge = edges.get(k);
      if (edge) edge.push(i);
      else edges.set(k, [i]);
    }
    for (const edge of edges.values()) {
      let top = edge[0];
      let foot = edge[0];
      for (const i of edge) {
        if (p.getY(i) > p.getY(top)) top = i;
        if (p.getY(i) < p.getY(foot)) foot = i;
      }
      const u = lit.getX(top) + band * (lit.getX(foot) - lit.getX(top));
      const v = lit.getY(top) + band * (lit.getY(foot) - lit.getY(top));
      for (const i of edge) lit.setXY(i, u, v);
    }
    lit.needsUpdate = true;
  }

  // Its place: every vertex standing on it (the arris above and the underside
  // share its corners) brought round to stand proud of the step ends.
  const to = cap.steps + cap.side * proud;
  const moved: number[] = [];
  for (let i = 0; i < p.count; i += 1) if (places.has(place(i))) moved.push(i);
  for (const i of moved) {
    const k = to / radius(i);
    p.setX(i, centre.x + (p.getX(i) - centre.x) * k);
    p.setZ(i, centre.z + (p.getZ(i) - centre.z) * k);
  }
  p.needsUpdate = true;
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

const closed = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
const made = new WeakSet<THREE.BufferGeometry>();

/** Close the stair's strings under `root`. Returns how many caps. */
export function closeStrings(root: THREE.Object3D): number {
  let count = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const cap = STAIR_STRINGS.caps.find((c) => c.re.test(mesh.name));
    if (!cap) return;
    count += 1;
    if (made.has(mesh.geometry)) return;
    let g = closed.get(mesh.geometry);
    if (!g) {
      g = closeString(mesh.geometry, cap);
      closed.set(mesh.geometry, g);
      made.add(g);
    }
    mesh.geometry = g;
  });
  return count;
}
