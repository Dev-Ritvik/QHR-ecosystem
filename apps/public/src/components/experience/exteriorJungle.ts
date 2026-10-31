// apps/public/src/components/experience/exteriorJungle.ts
//
// THE JUNGLE ROUND THE ESTATE (the concept the user asked to be built 1:1,
// 2026-10-27: "a lush misty tropical jungle valley").
//
// What the concept shows past the walls is not a belt of trees on open
// country: it is forest, all the way to the hills, and forest TALLER THAN THE
// CAMERA - from the cover's twenty metres the eye looks into it, between
// trunks and hanging roots and palm stems, with the valley's mist standing
// between the layers. Two great banyans frame the frame, their crowns over
// its top corners and their aerial roots hanging into it. What the estate had
// was 270 trees of ten to fifteen metres at twenty-five metres apart, and the
// fields behind them.
//
// So, at load, on the estate's own trees (no new model, no new program the
// warm-up does not already build):
//
//   THE BELT GROWS with distance from the house (GROW): as it was within a
//   hundred metres, nearly twice its height by a hundred and sixty. The garden,
//   the canal's row, the avenue and the groves inside the walls are not
//   touched.
//   THE GREAT TREES (GIANTS): three banyans, the two that frame the cover and
//   one behind the house, and the palms that stand up out of the forest
//   behind it (EMERGENT), placed by the cover's own projection.
//   THE GAPS FILLED (FILL): more of the belt's own species where the cover and
//   the orbit looked through it to the fields, never nearer a tree than its
//   crown.
//   THE FOREST BEYOND (canopy): one lumpy roof of leaves from where the belt
//   ends to past the fog's far edge, at the grown forest's height, dressed in
//   the mango's photographed leaves; the mist takes it within a few hundred
//   metres, so it is the forest's mass, not its detail.
//
// Run before the trees are varied (exteriorTrees.ts): the new scatters are
// named as the belt's are, so each tree in them is given its own proportions
// too.

import * as THREE from 'three';
import { onTheLayout } from './exteriorLayout';

type Xz = readonly [number, number];
export type JungleSpecies = 'banyan' | 'mango' | 'tamarind' | 'palm';

/** The scatters the estate's model carries, by species. */
export const JUNGLE_SOURCE: Readonly<Record<JungleSpecies, string>> = {
  banyan: 'veg_tree_banyan',
  mango: 'veg_tree_mango',
  tamarind: 'veg_tree_tamarind',
  palm: 'veg_palm_belt',
};

/** The walls (estateBounds), and how far out from them nothing is planted. */
export const WALLS = { x: 72, z0: -84, z1: 93, clear: 6 } as const;
/** The drive's corridor south of the gate (the avenue's palms stand in it). */
export const AVENUE = { x: 22, z0: 93 } as const;

/**
 * How much the belt grows at a distance from the house: as it was within
 * `from` metres, `max` times by `to`. Palms grow less (a coconut is a stem).
 */
// (1.85 and 1.45 at first: measured on an integrated card at 2880x1620 the
// grown belt alone cost 3.5 ms a frame, its cards' overdraw growing with the
// square of their size)
export const GROW = { from: 95, to: 165, max: 1.55, palm: 1.3 } as const;

/** The three great banyans: where, how large against the estate's own, and
 *  turned. The first two frame the cover (its left and right crowns); found
 *  by projecting the grown banyan's crown into the cover's frame. */
export const GIANTS: readonly { at: Xz; scale: number; turn: number }[] = [
  { at: [-12, -90], scale: 3.0, turn: 0.6 },
  { at: [102, -68], scale: 3.0, turn: 2.2 },
  { at: [34, -158], scale: 1.8, turn: 4.1 },
];

/**
 * THE TREES THE FOUNDER'S LAYOUT FRAME HAS AND THE ESTATE DID NOT (2026-10-28;
 * exteriorLayout.ts), each found by casting his crown's top through the
 * layout's camera to the height of the tree it is: the dark crowns at the
 * frame's foot, left of the first block and at its right-hand corner (only their
 * tops are in any frame), the great banyan's crowns over the east wall (three
 * trees, for one tree this size has leaves the size of a door), and the two west
 * of the pool, as his dark crowns stand there, which take the helipad and its
 * windsock out of the frame.
 *
 * THEY ARE THIS CHAPTER'S AND NO OTHER'S. Standing all the time they came into
 * the approved cover's left edge and across the orbit's sky behind the house. So
 * each has its own material (HAZE_ARRIVE in exteriorHaze.ts: a dissolve on the
 * layout's own air), not drawn at all until that air is up (exteriorLayout.ts,
 * layoutFades); they cast nothing, or the low sun lays them across the house and
 * they arrive as a shadow.
 */
export const LAYOUT_TREES: readonly { species: JungleSpecies; at: Xz; scale: number; turn: number }[] = [
  { species: 'mango', at: [-43.5, 54], scale: 0.58, turn: 0.9 },
  { species: 'mango', at: [-22.2, 81], scale: 0.8, turn: 2.6 },
  { species: 'banyan', at: [84, 42], scale: 1.75, turn: 1.4 },
  { species: 'banyan', at: [98, 20], scale: 1.9, turn: 3.3 },
  { species: 'banyan', at: [76, 8], scale: 1.6, turn: 5.2 },
  { species: 'tamarind', at: [-56, 8], scale: 1.0, turn: 3.7 },
  { species: 'tamarind', at: [-47, -2], scale: 0.9, turn: 5.1 },
];

/** Palms standing up out of the forest behind the house, as the cover sees
 *  it (their crowns between the house's roof and the hills). */
export const EMERGENT: readonly { at: Xz; scale: number }[] = [
  { at: [18, -118], scale: 1.75 },
  { at: [46, -104], scale: 1.6 },
  { at: [63, -142], scale: 1.85 },
  { at: [86, -97], scale: 1.5 },
  { at: [-4, -146], scale: 1.7 },
  { at: [112, -128], scale: 1.8 },
];

/** The gaps: how many trees at most, how far apart (metres between stems),
 *  and the region they are sown in (between the walls and the canopy). */
export const FILL = { count: 56, spacing: 14, seed: 2610 } as const;

/** The forest beyond: where it begins (an ellipse round the estate, centre
 *  `cz`), where it ends, how tall, and how its crowns are laid. */
export const CANOPY = {
  cz: 40,
  a: 205,
  b: 285,
  edge: 14,
  outer: 640,
  height: [24, 36] as const,
  crown: [5, 10] as const,
  rings: 64,
  segments: 384,
  tile: 2.6,
} as const;

/** A deterministic stream of numbers in [0, 1) (mulberry32). */
export function jungleRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inside the walls, with their margin, or on the drive's corridor. */
export function onTheEstate(x: number, z: number): boolean {
  const c = WALLS.clear;
  if (Math.abs(x) < WALLS.x + c && z > WALLS.z0 - c && z < WALLS.z1 + c) return true;
  return Math.abs(x) < AVENUE.x && z > AVENUE.z0 - c;
}

/** How far outside the canopy's inner ellipse a point is, in that ellipse's
 *  own radii (0 on it, < 0 inside). */
export function canopyReach(x: number, z: number): number {
  return Math.hypot(x / CANOPY.a, (z - CANOPY.cz) / CANOPY.b) - 1;
}

/** The belt's growth at a point (GROW). */
export function beltGrowth(x: number, z: number, palm: boolean): number {
  const d = Math.hypot(x, z * 0.85);
  const t = Math.min(1, Math.max(0, (d - GROW.from) / (GROW.to - GROW.from)));
  const k = t * t * (3 - 2 * t);
  return 1 + ((palm ? GROW.palm : GROW.max) - 1) * k;
}

/** The scatters a node holds: itself if it is one, else its instanced meshes. */
function partsOf(node: THREE.Object3D | undefined): THREE.InstancedMesh[] {
  if (!node) return [];
  if ((node as THREE.InstancedMesh).isInstancedMesh) return [node as THREE.InstancedMesh];
  const out: THREE.InstancedMesh[] = [];
  node.traverse((o) => {
    if ((o as THREE.InstancedMesh).isInstancedMesh) out.push(o as THREE.InstancedMesh);
  });
  return out;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const s3 = new THREE.Vector3();
const p3 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Grow the belt in place (GROW). Returns how many trees grew. */
function growBelt(root: THREE.Object3D): number {
  let n = 0;
  for (const species of Object.keys(JUNGLE_SOURCE) as JungleSpecies[]) {
    for (const mesh of partsOf(root.getObjectByName(JUNGLE_SOURCE[species]))) {
      if (mesh.userData.jungleGrown) continue;
      mesh.userData.jungleGrown = true;
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, m4);
        const k = beltGrowth(m4.elements[12], m4.elements[14], species === 'palm');
        if (k === 1) continue;
        m4.decompose(p3, q, s3);
        mesh.setMatrixAt(i, m4.compose(p3, q, s3.multiplyScalar(k)));
        n += 1;
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  return n;
}

/** Where the belt's trees stand now (to sow the gaps round them). */
function beltStems(root: THREE.Object3D): Xz[] {
  const out: Xz[] = [];
  for (const species of Object.keys(JUNGLE_SOURCE) as JungleSpecies[]) {
    const parts = partsOf(root.getObjectByName(JUNGLE_SOURCE[species]));
    const mesh = parts[0];
    if (!mesh) continue;
    for (let i = 0; i < mesh.count; i += 1) {
      mesh.getMatrixAt(i, m4);
      out.push([m4.elements[12], m4.elements[14]]);
    }
  }
  return out;
}

/** A material of its own for a tree that arrives with the layout. */
function arriving(from: THREE.Material): THREE.Material {
  const own = from.clone();
  own.userData.arrive = true;
  return own;
}

/** One new scatter of a species, at these places, named as the belt's are. */
function sow(
  root: THREE.Object3D,
  species: JungleSpecies,
  name: string,
  trees: readonly { at: Xz; scale: number; turn: number }[],
  arrive = false,
): number {
  const parts = partsOf(root.getObjectByName(JUNGLE_SOURCE[species]));
  if (!parts.length || !trees.length || root.getObjectByName(name)) return 0;
  const group = new THREE.Group();
  group.name = name;
  for (const src of parts) {
    const material = arrive ? arriving(src.material as THREE.Material) : src.material;
    const mesh = new THREE.InstancedMesh(src.geometry, material, trees.length);
    mesh.name = `${name}_${src.name}`;
    mesh.castShadow = src.castShadow && !arrive;
    mesh.receiveShadow = src.receiveShadow;
    trees.forEach((t, i) => {
      q.setFromAxisAngle(UP, t.turn);
      s3.setScalar(t.scale);
      mesh.setMatrixAt(i, m4.compose(p3.set(t.at[0], 0, t.at[1]), q, s3));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  root.add(group);
  return trees.length;
}

/** The gaps' trees: a dart-throwing sample between the walls and the canopy,
 *  clear of every stem by FILL.spacing. Pure, for the test. */
export function fillTrees(stems: readonly Xz[]): { species: JungleSpecies; at: Xz; scale: number; turn: number }[] {
  const rnd = jungleRandom(FILL.seed);
  const taken: Xz[] = [...stems, ...GIANTS.map((g) => g.at), ...EMERGENT.map((e) => e.at)];
  const out: { species: JungleSpecies; at: Xz; scale: number; turn: number }[] = [];
  const near = (x: number, z: number, d: number) => taken.some(([a, b]) => (a - x) ** 2 + (b - z) ** 2 < d * d);
  for (let tries = 0; tries < 6000 && out.length < FILL.count; tries += 1) {
    const x = (rnd() * 2 - 1) * CANOPY.a * 1.05;
    const z = CANOPY.cz + (rnd() * 2 - 1) * CANOPY.b * 1.05;
    if (onTheEstate(x, z) || canopyReach(x, z) > 0.02 || near(x, z, FILL.spacing)) continue;
    const r = rnd();
    const species: JungleSpecies = r < 0.34 ? 'mango' : r < 0.68 ? 'tamarind' : r < 0.84 ? 'banyan' : 'palm';
    const k = beltGrowth(x, z, species === 'palm');
    out.push({ species, at: [x, z], scale: k * (0.85 + rnd() * 0.45), turn: rnd() * Math.PI * 2 });
    taken.push([x, z]);
  }
  // NOT ON THE LAYOUT'S LAND (exteriorLayout.ts; the founder's frame,
  // 2026-10-28): the south lawns are inside the walls, which the sowing above
  // takes to end at the gate's old line. A tree sown there is taken out after
  // the sowing, so that every other stays where the cover was framed with it.
  return out.filter((t) => !onTheLayout(t.at[0], t.at[1]));
}

/** The forest's roof beyond the belt (CANOPY): a mesh of crowns. */
export function canopyGeometry(): THREE.BufferGeometry {
  const { rings, segments, outer, edge, cz } = CANOPY;
  // the crowns, on a grid of cells, one each, jittered
  const CELL = 9;
  const crowns = new Map<string, [number, number, number, number, number]>();
  const crownAt = (cx: number, cz2: number) => {
    const key = `${cx},${cz2}`;
    let c = crowns.get(key);
    if (!c) {
      const h = jungleRandom((cx * 73856093) ^ (cz2 * 19349663) ^ 0x5bd1e995);
      const r = CANOPY.crown[0] + h() * (CANOPY.crown[1] - CANOPY.crown[0]);
      const top = CANOPY.height[0] + h() * (CANOPY.height[1] - CANOPY.height[0]);
      c = [(cx + h()) * CELL, (cz2 + h()) * CELL, r, top, h()];
      crowns.set(key, c);
    }
    return c;
  };
  const heightAt = (x: number, z: number): [number, number] => {
    const ix = Math.floor(x / CELL);
    const iz = Math.floor(z / CELL);
    let best = 0;
    let tone = 0.5;
    for (let a = -1; a <= 1; a += 1) {
      for (let b = -1; b <= 1; b += 1) {
        const [x0, z0, r, top, t] = crownAt(ix + a, iz + b);
        const d2 = ((x - x0) ** 2 + (z - z0) ** 2) / (r * r);
        if (d2 >= 1) continue;
        const h = top - (top * 0.42) * d2 * d2 * 0.9 - 2.4 * d2;
        if (h > best) {
          best = h;
          tone = t;
        }
      }
    }
    // the floor under the crowns, where none reaches
    return [Math.max(best, CANOPY.height[0] * 0.55), tone];
  };
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rings; i += 1) {
    // from the inner ellipse (s = 0) to the outer circle (s = 1), closer at first
    const s = Math.pow(i / rings, 1.7);
    for (let j = 0; j < segments; j += 1) {
      const th = (j / segments) * Math.PI * 2;
      const ix = CANOPY.a * Math.cos(th);
      const iz = cz + CANOPY.b * Math.sin(th);
      const ox = outer * Math.cos(th);
      const oz = outer * Math.sin(th);
      const x = ix + (ox - ix) * s;
      const z = iz + (oz - iz) * s;
      const [h, tone] = heightAt(x, z);
      // the forest's edge comes up out of the ground over `edge` metres
      const along = Math.hypot(x - ix, z - iz);
      const rise = Math.min(1, along / edge);
      const y = h * (rise * rise * (3 - 2 * rise));
      pos.push(x, y, z);
      // a crown's own green, darker in the hollows between crowns
      const hollow = Math.min(1, Math.max(0, (y - CANOPY.height[0] * 0.55) / (CANOPY.height[1] * 0.5)));
      const v = (0.5 + 0.5 * hollow) * (0.82 + 0.36 * tone);
      col.push(v * (0.95 + 0.12 * tone), v, v * (0.82 - 0.1 * tone));
      uv.push(x / CANOPY.tile, z / CANOPY.tile);
    }
  }
  for (let i = 0; i < rings; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const a = i * segments + j;
      const b = i * segments + ((j + 1) % segments);
      const c = (i + 1) * segments + ((j + 1) % segments);
      const d = (i + 1) * segments + j;
      idx.push(a, d, b, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** The canopy's material: the mango's leaves, tiled flat across the roof,
 *  with the gaps between its leaves a shadowed green. */
function canopyMaterial(leaves: THREE.MeshStandardMaterial | null): THREE.MeshStandardMaterial {
  const map = leaves?.map ?? null;
  if (map) {
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.needsUpdate = true;
  }
  const mat = new THREE.MeshStandardMaterial({
    name: 'MAT_Jungle_Canopy',
    color: new THREE.Color(0.62, 0.66, 0.5),
    map,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
  });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `
#ifdef USE_MAP
  vec4 leafTexel = texture2D( map, vMapUv );
  // where the atlas holds no leaf, the shade between leaves
  diffuseColor.rgb *= mix( vec3( 0.16, 0.2, 0.1 ), leafTexel.rgb, smoothstep( 0.2, 0.7, leafTexel.a ) );
#endif`,
    );
  };
  mat.customProgramCacheKey = () => 'estate-jungle-canopy';
  return mat;
}

/**
 * Plant the jungle under the estate's root. Idempotent. Returns how many
 * trees were grown, added and sown, and whether the canopy stands.
 */
export function plantJungle(root: THREE.Object3D): { grown: number; added: number; canopy: boolean } {
  if (root.userData.jungle) return { grown: 0, added: 0, canopy: false };
  // (look-dev, to measure it: `?debug=1&jungle=0` leaves the estate as it
  // was; `&jungle=-grow,-giants,-palms,-fill,-canopy` leaves out those parts)
  const q =
    typeof window !== 'undefined' && /[?&]debug=1/.test(window.location.search)
      ? new URLSearchParams(window.location.search).get('jungle')
      : null;
  if (q === '0') return { grown: 0, added: 0, canopy: false };
  const skip = (part: string) => !!q && q.split(',').includes(`-${part}`);
  root.userData.jungle = true;
  const grown = skip('grow') ? 0 : growBelt(root);
  let added = 0;
  if (!skip('giants'))
    added += sow(
      root,
      'banyan',
      'veg_tree_jungle_giants',
      GIANTS.map((g) => ({ at: g.at, scale: g.scale, turn: g.turn })),
    );
  if (!skip('palms'))
    added += sow(
      root,
      'palm',
      'veg_palm_jungle_emergent',
      EMERGENT.map((e, i) => ({ at: e.at, scale: e.scale, turn: i * 2.39996 })),
    );
  if (!skip('layout'))
    for (const species of Object.keys(JUNGLE_SOURCE) as JungleSpecies[]) {
      added += sow(root, species, `veg_tree_layout_${species}`, LAYOUT_TREES.filter((t) => t.species === species), true);
    }
  const gaps = skip('fill') ? [] : fillTrees(beltStems(root));
  for (const species of Object.keys(JUNGLE_SOURCE) as JungleSpecies[]) {
    const mine = gaps.filter((t) => t.species === species);
    added += sow(root, species, species === 'palm' ? 'veg_palm_jungle_fill' : `veg_tree_jungle_fill_${species}`, mine);
  }
  if (skip('canopy')) return { grown, added, canopy: false };
  // the roof beyond: the mango's leaves on it
  let leaves: THREE.MeshStandardMaterial | null = null;
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!leaves && m && !Array.isArray(m) && /^MAT_Leaves_Mango/.test(m.name) && m.map) leaves = m;
  });
  const canopy = new THREE.Mesh(canopyGeometry(), canopyMaterial(leaves));
  canopy.name = 'jungle_canopy';
  canopy.castShadow = false;
  canopy.receiveShadow = false;
  root.add(canopy);
  return { grown, added, canopy: true };
}
