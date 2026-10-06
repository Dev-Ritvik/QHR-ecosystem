// apps/public/src/components/experience/exteriorTrees.ts
//
// NO TWO NEIGHBOURS THE SAME TREE.
//
// The audit of 2026-10-05 (P2): "Vary the trees. The palm avenue is rows of
// identical trees, and some distant trees read as flat cut-outs. Done when no
// two neighbouring trees look cloned."
//
// It was right about the avenue to the letter. The estate's trees are drawn
// from a handful of meshes (tools/blender/build_estate_v7.py, `scatter`): the
// shade trees from three, each turned, sized and — since the paid audit —
// re-proportioned a little; but the drive's thirty-six royal palms are ONE
// model, turned and scaled as a whole between 0.88 and 1.1. A palm is nearly a
// solid of revolution, so turning it changes nothing, and thirty-six of one
// height's worth of difference is a row of one tree. The foliage shader's hue
// per tree (exteriorFoliage.ts) never reached them either: the generated palms
// are one opaque material each, not leaf cards.
//
// Three things make a planted row a row of individuals, and they are done
// here, to the instances the model already carries — no second mesh, no
// rebuild:
//
//   ITS PROPORTIONS. Each tree's height and its spread move apart: a tall
//   narrow one stands beside a short full one.
//
//   ITS LEAN. No palm grows plumb; each leans its own way by a few degrees (a
//   coconut by more, as coconuts do). A SHEAR, not a rotation, so the foot
//   stays where it was planted and the trunk meets the ground upright.
//
//   ITS COLOUR, for the generated palms: older fronds, a paler trunk.
//
// All three go into the instance's own matrix and colour, so the shadow pass,
// the depth pass and the picture agree by construction. What a matrix cannot
// say — how one palm's crown hangs lower and fuller on one side than its
// neighbour's — is the crown's, in the vertex shader (PALM_CROWN).
//
// AND THE BELT'S PALMS ARE TREES, NOT FANS. The forty-eight beyond the wall
// were the scripted palm ("a white pole and a fan of cards", the build's own
// note), kept there because they were only ever seen from eighty metres. The
// film's high frames look down on them, where a fan of cards is a flat
// cut-out. They take the generated coconut's far copy, which the model
// already holds for the groves.

import * as THREE from 'three';

interface TreeKind {
  /** Matches the scatter's node name. */
  re: RegExp;
  /** Height and spread, each as +- a share of the mesh's own. */
  height: number;
  spread: number;
  /** The most a trunk leans, radians. */
  lean: number;
  /** Value and warmth, +- a share (generated palms only: the leaf cards have
   *  the foliage shader's own). */
  value: number;
  warmth: number;
}

/** First match wins. */
export const TREE_KINDS: readonly TreeKind[] = [
  // The avenue: an allee, so the variation of a row planted the same year.
  { re: /^veg_palm_(avenue|forecourt)/, height: 0.13, spread: 0.15, lean: 0.06, value: 0.13, warmth: 0.07 },
  // Coconuts, in groves and in the belt: they lean, and no two are of a height.
  { re: /^veg_palm_/, height: 0.2, spread: 0.16, lean: 0.14, value: 0.14, warmth: 0.07 },
  // The shade trees: re-proportioned by a tenth at the build already.
  { re: /^veg_tree_/, height: 0.1, spread: 0.1, lean: 0.035, value: 0, warmth: 0 },
];

/** A tree's own numbers, from where it stands: stable across loads. */
export function treeSeed(x: number, z: number, k: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

const m4 = new THREE.Matrix4();
const local = new THREE.Matrix4();
const tint = new THREE.Color();

/** The scatter a mesh belongs to: its own name, or the group's it was split
 *  from (a mesh of several materials loads as a group of instanced meshes). */
function scatterName(o: THREE.Object3D): string {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (/^veg_/.test(n.name)) return n.name;
  }
  return '';
}

/**
 * The local matrix that makes instance `i` its own tree: a scale, then a shear
 * of x and z by height. Exported for the test.
 */
export function treeVariation(kind: TreeKind, x: number, z: number, out: THREE.Matrix4): THREE.Matrix4 {
  const h = 1 + (treeSeed(x, z, 1) * 2 - 1) * kind.height;
  // A tall one is a little narrower and a short one fuller, as often as not.
  const s = 1 + (treeSeed(x, z, 2) * 2 - 1) * kind.spread - (h - 1) * 0.35;
  const s2 = s * (1 + (treeSeed(x, z, 3) * 2 - 1) * kind.spread * 0.4);
  const lean = Math.tan(kind.lean * Math.sqrt(treeSeed(x, z, 4)));
  const dir = treeSeed(x, z, 5) * Math.PI * 2;
  // prettier-ignore
  return out.set(
    s,  Math.cos(dir) * lean * h, 0,  0,
    0,  h,                        0,  0,
    0,  Math.sin(dir) * lean * h, s2, 0,
    0,  0,                        0,  1,
  );
}

/**
 * Give every scattered tree its own proportions, lean and (for the generated
 * palms) colour. Once per load: a mesh already varied is left alone. Returns
 * how many trees were varied.
 */
export function varyTrees(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.InstancedMesh & { userData: { treesVaried?: boolean } };
    if (!mesh.isInstancedMesh || mesh.userData.treesVaried) return;
    const name = scatterName(mesh);
    const kind = TREE_KINDS.find((k) => k.re.test(name));
    if (!kind) return;
    mesh.userData.treesVaried = true;
    for (let i = 0; i < mesh.count; i += 1) {
      mesh.getMatrixAt(i, m4);
      const x = m4.elements[12];
      const z = m4.elements[14];
      mesh.setMatrixAt(i, m4.multiply(treeVariation(kind, x, z, local)));
      if (kind.value || kind.warmth) {
        const v = 1 + (treeSeed(x, z, 6) * 2 - 1) * kind.value;
        const w = (treeSeed(x, z, 7) * 2 - 1) * kind.warmth;
        mesh.setColorAt(i, tint.setRGB(v * (1 + w), v, v * (1 - w * 1.6)));
      }
      n += 1;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  });
  return n;
}

/**
 * THE CROWN, PER PALM. The generated palms' fronds are part of one solid
 * mesh, the same on every instance. In the tree's own space, above the height
 * its fronds leave the trunk: the crown hangs by its own amount (a young
 * crown stands up, an old one falls), and is fuller to one side — its own
 * side — than the other. The trunk is not touched, and the tree's lean and
 * proportions are the instance matrix's (above).
 *
 * `from`/`to`: the share of the mesh's height over which the crown begins
 * (measured on the models: the royal's fronds leave its crownshaft at 0.74 of
 * its height, the coconut's their trunk at 0.7).
 */
export const PALM_CROWN = {
  MAT_Palm_Royal: { height: 13.8, from: 0.7, to: 0.8 },
  MAT_Palm_Coconut: { height: 10.5, from: 0.66, to: 0.78 },
} as const;

/** Droop, metres of fall per metre-squared from the trunk: from a crown that
 *  stands up a little to one that hangs. */
export const CROWN_DROOP = { min: -0.012, max: 0.05 } as const;
/** How much fuller the crown is on its own side than the other. */
export const CROWN_SIDE = 0.22;

function crownVertex(c: { height: number; from: number; to: number }): string {
  return /* glsl */ `
#include <begin_vertex>
#ifdef USE_INSTANCING
{
  vec3 cInst = instanceMatrix[3].xyz;
  float cA = fract(sin(dot(cInst.xz, vec2(12.9898, 78.233)) + 301.752) * 43758.5453);
  float cB = fract(sin(dot(cInst.xz, vec2(12.9898, 78.233)) + 339.471) * 43758.5453);
  float crown = smoothstep(${(c.from * c.height).toFixed(3)}, ${(c.to * c.height).toFixed(3)}, transformed.y);
  float r2 = dot(transformed.xz, transformed.xz);
  vec2 own = vec2(cos(cA * 6.2832), sin(cA * 6.2832));
  float side = dot(transformed.xz, own) / max(sqrt(r2), 1e-3);
  transformed.xz *= 1.0 + crown * ${CROWN_SIDE.toFixed(3)} * side;
  transformed.y -= crown * mix(${CROWN_DROOP.min.toFixed(4)}, ${CROWN_DROOP.max.toFixed(4)}, cB) * r2;
}
#endif
`;
}

/** Dress the generated palms' materials with their crowns. Returns how many. */
export function dressPalmCrowns(root: THREE.Object3D): number {
  const done = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial & { __crown?: boolean };
      const crown = mat && (PALM_CROWN as Record<string, { height: number; from: number; to: number }>)[mat.name.replace(/_AOG?$/, '')];
      if (!crown || mat.__crown) continue;
      mat.__crown = true;
      done.add(mat);
      const prev = mat.onBeforeCompile;
      // (read now: three's default key is the current onBeforeCompile's source)
      const key = mat.customProgramCacheKey();
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', crownVertex(crown));
      };
      mat.customProgramCacheKey = () => `${key}|palm-crown-${mat.name}`;
      mat.needsUpdate = true;
    }
  });
  return done.size;
}

/**
 * The belt's scripted palms take the generated coconut's far copy (see the
 * note at the top). `from` is the scatter that holds the model wanted and `to`
 * the one to redraw with it; the instances of `to` keep where they stand and
 * how they are turned, and are sized so the new tree is as tall as the old.
 * Returns how many trees changed, 0 when either scatter is not in the model.
 */
export function replantBelt(root: THREE.Object3D, from = 'veg_palm_coconut_b', to = 'veg_palm_belt'): number {
  const source = root.getObjectByName(from) as THREE.InstancedMesh | undefined;
  const belt = root.getObjectByName(to);
  if (!source?.isInstancedMesh || !belt || belt.userData.replanted) return 0;
  belt.userData.replanted = true;
  // The scripted palm is a group of three instanced meshes (trunk, crownshaft,
  // fronds) sharing one set of instances: keep the first, hide the rest.
  const parts: THREE.InstancedMesh[] = [];
  belt.traverse((o) => {
    if ((o as THREE.InstancedMesh).isInstancedMesh) parts.push(o as THREE.InstancedMesh);
  });
  if (!parts.length) return 0;
  const box = new THREE.Box3();
  for (const p of parts) {
    if (!p.geometry.boundingBox) p.geometry.computeBoundingBox();
    box.union(p.geometry.boundingBox!);
  }
  if (!source.geometry.boundingBox) source.geometry.computeBoundingBox();
  const k = (box.max.y - box.min.y) / (source.geometry.boundingBox!.max.y - source.geometry.boundingBox!.min.y);
  const [keep, ...rest] = parts;
  for (const r of rest) r.visible = false;
  keep.geometry = source.geometry;
  keep.material = source.material;
  const sized = new THREE.Matrix4().makeScale(k, k, k);
  for (let i = 0; i < keep.count; i += 1) {
    keep.getMatrixAt(i, m4);
    keep.setMatrixAt(i, m4.multiply(sized));
  }
  keep.instanceMatrix.needsUpdate = true;
  keep.castShadow = source.castShadow;
  keep.receiveShadow = source.receiveShadow;
  keep.computeBoundingBox();
  keep.computeBoundingSphere();
  return keep.count;
}
