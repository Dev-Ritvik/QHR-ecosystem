// apps/public/src/components/experience/exteriorGround.ts
//
// THE GROUND KNOWS WHAT STANDS ON IT.
//
// The brief of 2026-11-01: "the coconut palms, broadleaf shade trees and rounded
// courtyard trees currently sit on the ground without contact shadows", and the
// ground "a multi-layered terrain ... manicured grass ... soil around tree roots".
// Measured on the running build: 400-odd trunks stand straight out of an unbroken
// sward, in full sun with nothing at their feet. The sky's occlusion is baked
// (bake_estate_ao_v7.py), but occlusion darkens only what the sky lit, and the
// jungle's trees are planted after that bake.
//
// A grown tree on a lawn has a bare foot: the mower stays off its roots, the grass
// thins in its shade, and there is soil and leaf litter for a metre or two. And
// where the trunk meets that soil the light goes.
//
// ONE FIELD, TWO CHANNELS, SAMPLED BY THE LAWN'S OWN SHADER: a texture over the
// estate on the plan, written once, here, from where the trees actually stand once
// everything has been planted. So it follows the lawn over the country's swell (a
// decal laid at a height would not), costs one fetch on the lawn's pixels and no
// draw, and a tree moved in the build is found by this without anything being
// measured again.
//
//   R  how much of this is bare ground, soft: the shader cuts it with noise, so
//      the edge is torn, as the edge of a worn patch is.
//   G  how much light its foot has lost.
//
// What arrives or leaves with the layout's chapter (exteriorLayout.ts) has no bare
// foot: its ground has to be a lawn or a plot in every other frame.

import * as THREE from 'three';

/** The field on the plan: centred on the house, far enough to take the near jungle. */
export const GROUND_FIELD = { span: 720, px: 2048 } as const;

/**
 * A tree's bare foot, in metres, by its height: the soil's reach and how much
 * further the contact shade runs. A palm's foot is smaller for its height than a
 * broadleaf's, and it has a smaller root plate.
 */
export const FOOT = {
  broadleaf: { soil: 0.11, shade: 0.21, min: 1.1, max: 4.2 },
  palm: { soil: 0.07, shade: 0.14, min: 0.8, max: 2.0 },
  /** How much of the light the foot loses, at the trunk (the shader takes it from
   *  this, GROUND_SHADE). */
  dark: 1,
} as const;

/** The trunks: bark, or a palm's one mesh. Not the leaves' meshes: each tree's
 *  leaves are the same instances again. */
const TRUNK_RE = /^MAT_(Bark|Palm_Royal)/;
const PALM_RE = /coconut|palm/i;
/** Those that come and go with the layout (exteriorLayout.ts, clearJunctions and
 *  exteriorJungle.ts, LAYOUT_TREES). */
const CHAPTER_RE = /_leaving$|^veg_tree_layout/;

export interface Trunk {
  x: number;
  z: number;
  /** The tree's height, metres. */
  h: number;
  palm: boolean;
}

const inst = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scale = new THREE.Vector3();

/** Every tree that stands for good, in `root`'s space. */
export function standingTrunks(root: THREE.Object3D): Trunk[] {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const found = new Map<string, Trunk>();
  const m = new THREE.Matrix4();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh | THREE.InstancedMesh;
    if (!mesh.isMesh || !mesh.geometry || CHAPTER_RE.test(mesh.name)) return;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!mat || !TRUNK_RE.test(mat.name)) return;
    for (let p: THREE.Object3D | null = mesh; p; p = p.parent) if (!p.visible) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    const palm = PALM_RE.test(mesh.name) || PALM_RE.test(mat.name);
    const add = () => {
      m.decompose(pos, quat, scale);
      const key = `${pos.x.toFixed(1)},${pos.z.toFixed(1)}`;
      if (found.has(key)) return;
      found.set(key, { x: pos.x, z: pos.z, h: (box.max.y - box.min.y) * Math.abs(scale.y), palm });
    };
    const im = mesh as THREE.InstancedMesh;
    if (im.isInstancedMesh) {
      for (let i = 0; i < im.count; i += 1) {
        im.getMatrixAt(i, inst);
        m.multiplyMatrices(toRoot, mesh.matrixWorld).multiply(inst);
        add();
      }
    } else {
      m.multiplyMatrices(toRoot, mesh.matrixWorld);
      add();
    }
  });
  return [...found.values()];
}

/**
 * The field's texels for these trunks. Pure, for the test: RG, row by row, world z
 * growing with the row and world x with the column.
 */
export function stampFootprints(trunks: readonly Trunk[], px: number = GROUND_FIELD.px, span: number = GROUND_FIELD.span): Uint8Array {
  const data = new Uint8Array(px * px * 2);
  const perM = px / span;
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (const t of trunks) {
    const k = t.palm ? FOOT.palm : FOOT.broadleaf;
    const soil = Math.min(k.max, Math.max(k.min, t.h * k.soil));
    const shade = Math.min(k.max * 1.8, Math.max(k.min * 1.5, t.h * k.shade));
    const cx = (t.x + span / 2) * perM;
    const cy = (t.z + span / 2) * perM;
    const reach = Math.ceil(Math.max(soil * 1.35, shade) * perM) + 1;
    const x0 = Math.max(0, Math.floor(cx - reach));
    const x1 = Math.min(px - 1, Math.ceil(cx + reach));
    const y0 = Math.max(0, Math.floor(cy - reach));
    const y1 = Math.min(px - 1, Math.ceil(cy + reach));
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / perM;
        const i = (y * px + x) * 2;
        const s = 1 - smooth(soil * 0.45, soil * 1.35, d);
        const c = 1 - smooth(0, shade, d);
        data[i] = Math.max(data[i], Math.round(255 * s));
        data[i + 1] = Math.max(data[i + 1], Math.round(255 * c * c));
      }
    }
  }
  return data;
}

/** Handed to the lawn's shader: one texture, shared by every mount. */
export const groundUniforms = {
  uGroundField: { value: null as THREE.DataTexture | null },
  /** x0, z0 of the field, and its reciprocal span. */
  uGroundMap: { value: new THREE.Vector3(-GROUND_FIELD.span / 2, -GROUND_FIELD.span / 2, 1 / GROUND_FIELD.span) },
};

/**
 * Read the trees and write the field. AFTER everything has been planted and the
 * layout's junctions cleared. Once: a second mount has the same trees. Returns how
 * many trunks it found.
 */
export function layGroundField(root: THREE.Object3D): number {
  if (groundUniforms.uGroundField.value) return 0;
  const trunks = standingTrunks(root);
  if (!trunks.length) return 0;
  const { px } = GROUND_FIELD;
  const tex = new THREE.DataTexture(stampFootprints(trunks), px, px, THREE.RGFormat, THREE.UnsignedByteType);
  tex.name = 'estate_ground_field';
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  groundUniforms.uGroundField.value = tex;
  return trunks.length;
}

/** Soil, as it is painted at a tree's foot (linear). Dry and pale at its worn edge,
 *  dark in the shade and the leaf litter at the trunk. */
export const GROUND_SOIL = { dry: [0.2, 0.15, 0.1] as const, damp: [0.075, 0.055, 0.04] as const };
/** How much of the light a foot loses at the trunk, all lights: the sun's shadow
 *  falls to one side, and this is what stops the tree standing on the lawn like a
 *  post in a photograph of a post. */
export const GROUND_SHADE = 0.62;

/** Declarations for the lawn's fragment shader. */
export const GROUND_PARS = /* glsl */ `
uniform sampler2D uGroundField;
uniform vec3 uGroundMap;
`;

/**
 * In the lawn's map_fragment, after everything else has been done to the turf
 * (`sampledDiffuseColor`, with lawnNoise and vLawnWorld in scope).
 */
export const GROUND_FOOT = /* glsl */ `
{
  vec2 foot = texture2D(uGroundField, (vLawnWorld.xz - uGroundMap.xy) * uGroundMap.z).rg;
  if (foot.r + foot.g > 0.002) {
    // the worn patch: the field's soft ramp torn by noise at two sizes
    float tear = 0.3 * lawnNoise(vLawnWorld.xz * 1.3 + vec2(2.7, 9.1)) + 0.2 * lawnNoise(vLawnWorld.xz * 4.1 + vec2(7.3, 1.9));
    float bare = smoothstep(0.42, 0.62, foot.r + tear * foot.r);
    float litter = 0.5 + 0.5 * lawnNoise(vLawnWorld.xz * 7.0 + vec2(11.0, 4.0));
    vec3 soil = mix(vec3(${GROUND_SOIL.dry.map((v) => v.toFixed(3)).join(', ')}), vec3(${GROUND_SOIL.damp.map((v) => v.toFixed(3)).join(', ')}), clamp(foot.g * 1.3 + 0.25 * litter, 0.0, 1.0));
    sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, soil, bare);
    sampledDiffuseColor.rgb *= 1.0 - ${GROUND_SHADE.toFixed(2)} * foot.g;
  }
}
`;
