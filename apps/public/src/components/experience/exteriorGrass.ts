// apps/public/src/components/experience/exteriorGrass.ts
//
// BLADES OF GRASS, WHERE THE CAMERA COMES NEAR ENOUGH TO SEE THEM.
//
// The brief of 2026-11-01: "instanced 3D grass blades that react to cursor movement and
// wind". From the cover a blade is a tenth of a pixel, and the lawn's own shader is all
// a lawn is (exteriorLawn.ts). The film comes down to the ground once: over the forecourt
// to the door. So the blades are planted there, on the lawns either side of the apron and
// round the fountain, and nowhere else. Each stands up out of the sward as the camera
// comes within GRASS.far, from nothing, so there is no line where they begin; and the
// whole mesh is switched off (its material, so its program is built with the rest) while
// the camera is too far for any of it to show.
//
// One draw. THEY ARE THE LAWN, STANDING UP. Their own colour and their own lighting were
// stubble on it, dark hairs on a sunlit sward: a colour that had to be kept in step with
// everything the lawn's shader does, and a double-sided normal that three turns over for
// every blade seen from behind, so half of them were lit from under the ground. So each
// is the lawn's own material with the lawn's whole shader chain (its turf, bands, patches,
// bake, the rooms' pools, the air), reading its maps at the ground under that tuft's foot,
// with the ground's normal on both faces; a blade differs from the lawn under it only by
// being darker at its foot and paler at its tip. They take the sun's shadow and cast none.
// The same wind as the trees' (exteriorFoliage.ts). And they part round the pointer,
// wherever it falls on the ground.

import * as THREE from 'three';
import { foliageUniforms, WIND_DIR, WIND_GUST } from './exteriorFoliage';
import { LAWN_WORLD_LINE } from './exteriorLawn';
import { markFocusDepth } from './LensFocus';

/** The fountain's centre and the ring's kerbs, in three's axes (build_estate_v7.py). */
const FOUNTAIN_Z = 30;
const RING = { inner: 7.8, outer: 14.3, basin: 4.2 } as const;

export const GRASS = {
  /** Tufts a square metre. */
  perM2: 48,
  /** Half that on a mid-tier machine, none on a low one. */
  /** A tuft's height, metres: a kept lawn, a hand high at its longest. */
  height: [0.09, 0.17] as const,
  /** Where the blades are at their full height and where they have gone, metres from the eye. */
  near: 24,
  far: 38,
  /** The lawns they stand on: x0 x1 z0 z1, within which isLawn() says yes or no. */
  lawns: [
    [7.4, 18.6, 12.7, 42],
    [-18.6, -7.4, 12.7, 42],
    [-7.6, 7.6, 22.4, 37.6],
  ] as const,
  /** How far from the pointer they part, metres, and how far over. */
  part: { reach: 1.5, lean: 0.11 },
  /** The camera's distance from the door's forecourt past which none of it is drawn. */
  off: 62,
} as const;

/** Is this point the lawn the blades may stand on? Pure, for the test. */
export function isGrassLawn(x: number, z: number): boolean {
  const r = Math.hypot(x, z - FOUNTAIN_Z);
  if (r < RING.inner) return r > RING.basin;
  if (r < RING.outer) return false;
  // the apron and the avenue, with their kerbs; and the avenue's mouth on the ring
  if (Math.abs(x) < 7.25 && z < FOUNTAIN_Z) return false;
  if (Math.abs(x) < 4.7) return false;
  return true;
}

export const grassUniforms = {
  /** The pointer on the ground, world x, z, and how much it is there. */
  uGrassPointer: { value: new THREE.Vector3(0, 0, 0) },
};

const NAME = 'estate_grass';
const GROUND_MESH = 'ground_plane';

/** A tuft: three blades turned about its foot, each a tapering strip of three triangles.
 *  Its y is its height, 0 to 1, for the instance's scale. */
function tuftGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const blades: readonly [number, number, number][] = [
    [0.1, 0.0, 0.07],
    [2.2, 0.05, 0.1],
    [4.3, -0.04, 0.05],
  ];
  for (const [a, ox, lean] of blades) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const b = pos.length / 3;
    const w = 0.03;
    const at = (u: number, h: number) => {
      // across the blade, up it, and leaning over by its height squared
      const l = lean * h * h;
      pos.push(ox + c * u + -s * l, h, s * u + c * l);
    };
    at(-w, 0);
    at(w, 0);
    at(-w * 0.72, 0.55);
    at(w * 0.72, 0.55);
    at(0, 1);
    idx.push(b, b + 1, b + 3, b, b + 3, b + 2, b + 2, b + 3, b + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // up, all of them (see the head of this file)
  const nor = new Float32Array(pos.length);
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** Where each tuft stands: a seeded jitter on a grid, so the same lawn every visit. */
export function tuftPlaces(): { x: number; z: number; h: number; a: number; tone: number }[] {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const step = 1 / Math.sqrt(GRASS.perM2);
  const out: { x: number; z: number; h: number; a: number; tone: number }[] = [];
  for (const [x0, x1, z0, z1] of GRASS.lawns) {
    for (let z = z0; z < z1; z += step) {
      for (let x = x0; x < x1; x += step) {
        const px = x + (rnd() - 0.5) * step * 1.4;
        const pz = z + (rnd() - 0.5) * step * 1.4;
        const h = GRASS.height[0] + (GRASS.height[1] - GRASS.height[0]) * rnd();
        const a = rnd() * Math.PI * 2;
        const tone = rnd();
        if (isGrassLawn(px, pz)) out.push({ x: px, z: pz, h, a, tone });
      }
    }
  }
  // Shuffled, so that drawing the first half of them is half as many everywhere.
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const VERTEX = /* glsl */ `
#include <begin_vertex>
{
  vec3 gInst = instanceMatrix[3].xyz;
  vec2 gWorld = gInst.xz + modelMatrix[3].xz;
  float gDist = distance(cameraPosition, vec3(gWorld.x, modelMatrix[3].y, gWorld.y));
  float gShow = 1.0 - smoothstep(${GRASS.near.toFixed(1)}, ${GRASS.far.toFixed(1)}, gDist);
  float gUp = transformed.y;
  vGrassUp = gUp;
  // The wind, and the pointer, in the world: taken back through the tuft's own turn and scale.
  float gGust = 0.35 + 0.65 * windGust(gWorld, uFoliageTime);
  float gSway = sin(uFoliageTime * 1.7 + dot(gWorld, vec2(1.3, 0.9))) * 0.6 + sin(uFoliageTime * 3.3 + dot(gWorld, vec2(-2.1, 2.7))) * 0.3;
  vec2 gPush = vec2(${WIND_DIR[0].toFixed(3)}, ${WIND_DIR[1].toFixed(3)}) * (0.5 + gSway) * gGust * 0.05 * uFoliageWind;
  vec2 gTo = gWorld - uGrassPointer.xy;
  float gD = max(length(gTo), 1.0e-3);
  float gPart = uGrassPointer.z * (1.0 - smoothstep(0.15, ${GRASS.part.reach.toFixed(2)}, gD));
  gPush += gTo / gD * gPart * ${GRASS.part.lean.toFixed(3)};
  vec3 gBack = transpose(mat3(instanceMatrix)) * vec3(gPush.x, 0.0, gPush.y) / max(dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz), 1.0e-4);
  transformed += gBack * gUp * gUp;
  transformed.y *= gShow * (1.0 - 0.4 * gPart);
}
`;

const COLOUR = /* glsl */ `
#include <color_fragment>
// Darker at the foot, where it stands in its own shade, the tips catching what light there is.
diffuseColor.rgb *= mix(0.62, 1.2, vGrassUp);
`;

/** How the lawn's turf is read at a tuft: by its foot alone, so no derivative to choose a
 *  mip by, and the top mip of a photographed lawn is black gaps and bright blades. */
const TURF_LOD = '4.0';

/**
 * The ground's two maps, each a plane of the world (build_estate_v7.py box_uv; the bake's
 * "ground planar UV2"): the lines through the mesh's own extremes, so nothing here has to
 * know the numbers. Pure, for the test.
 */
export function groundPlane(
  x: ArrayLike<number>,
  z: ArrayLike<number>,
  u: ArrayLike<number>,
  v: ArrayLike<number>,
): { u: [number, number]; v: [number, number] } {
  let x0 = 0;
  let x1 = 0;
  let z0 = 0;
  let z1 = 0;
  for (let i = 1; i < x.length; i += 1) {
    if (x[i] < x[x0]) x0 = i;
    if (x[i] > x[x1]) x1 = i;
    if (z[i] < z[z0]) z0 = i;
    if (z[i] > z[z1]) z1 = i;
  }
  const uk = (u[x1] - u[x0]) / (x[x1] - x[x0]);
  const vk = (v[z1] - v[z0]) / (z[z1] - z[z0]);
  return { u: [uk, u[x0] - uk * x[x0]], v: [vk, v[z0] - vk * z[z0]] };
}

/** Plant the blades under `root`. Once. Before the passes that dress every material. */
export function plantGrass(root: THREE.Object3D): THREE.InstancedMesh | null {
  if (root.getObjectByName(NAME)) return null;
  const ground = root.getObjectByName(GROUND_MESH) as THREE.Mesh | undefined;
  if (!ground?.isMesh || Array.isArray(ground.material)) return null;
  const lawn = ground.material as THREE.MeshStandardMaterial;
  const places = tuftPlaces();
  const material = new THREE.MeshStandardMaterial({
    name: 'MAT_Grass',
    color: lawn.color,
    roughness: lawn.roughness,
    metalness: lawn.metalness,
    map: lawn.map,
    roughnessMap: lawn.roughnessMap,
    metalnessMap: lawn.metalnessMap,
    aoMap: lawn.aoMap,
    aoMapIntensity: lawn.aoMapIntensity,
    emissive: lawn.emissive,
    emissiveMap: lawn.emissiveMap,
    emissiveIntensity: lawn.emissiveIntensity,
    envMapIntensity: lawn.envMapIntensity,
    side: THREE.DoubleSide,
  });
  const chain = lawn.onBeforeCompile;
  const chainKey = lawn.customProgramCacheKey.bind(lawn);
  material.onBeforeCompile = (shader, renderer) => {
    chain.call(lawn, shader, renderer);
    shader.uniforms.uFoliageTime = foliageUniforms.uTime;
    shader.uniforms.uFoliageWind = foliageUniforms.uWind;
    shader.uniforms.uGrassPointer = grassUniforms.uGrassPointer;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `uniform float uFoliageTime;\nuniform float uFoliageWind;\nuniform vec3 uGrassPointer;\nvarying float vGrassUp;\n${WIND_GUST}\nvoid main() {`)
      .replace('#include <begin_vertex>', VERTEX)
      // the lawn's place, for all of the lawn's own fields: the ground under the tuft
      .replace(LAWN_WORLD_LINE, 'vLawnWorld = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying float vGrassUp;\nvoid main() {')
      .replace('texture2D( map, vMapUv )', `textureLod( map, vMapUv, ${TURF_LOD} )`)
      .replace('texture2D( map, turned )', `textureLod( map, turned, ${TURF_LOD} )`)
      .replace('#include <color_fragment>', COLOUR)
      // the ground's normal on both faces (three turns it over for a blade's back)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize( vNormal );');
  };
  material.customProgramCacheKey = () => `estate-grass|${chainKey()}`;
  material.visible = false;
  const tuft = tuftGeometry();
  // Each tuft's place on the ground's two maps.
  const g = ground.geometry;
  const pos = g.attributes.position;
  const xs = new Float32Array(pos.count);
  const zs = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i += 1) {
    xs[i] = pos.getX(i);
    zs[i] = pos.getZ(i);
  }
  for (const name of ['uv', 'uv1'] as const) {
    const a = g.attributes[name];
    if (!a) continue;
    const us = new Float32Array(a.count);
    const vs = new Float32Array(a.count);
    for (let i = 0; i < a.count; i += 1) {
      us[i] = a.getX(i);
      vs[i] = a.getY(i);
    }
    const plane = groundPlane(xs, zs, us, vs);
    const at = new Float32Array(places.length * 2);
    places.forEach((p, i) => {
      at[i * 2] = plane.u[0] * p.x + plane.u[1];
      at[i * 2 + 1] = plane.v[0] * p.z + plane.v[1];
    });
    tuft.setAttribute(name, new THREE.InstancedBufferAttribute(at, 2));
  }
  const mesh = new THREE.InstancedMesh(tuft, material, places.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const y = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  places.forEach((p, i) => {
    q.setFromAxisAngle(y, p.a);
    m.compose(new THREE.Vector3(p.x, -0.03, p.z), q, new THREE.Vector3(p.h, p.h, p.h));
    mesh.setMatrixAt(i, m);
    // the lawn's own, a little either way
    c.setRGB(0.88 + 0.26 * p.tone, 0.9 + 0.2 * p.tone, 0.86 + 0.24 * p.tone);
    mesh.setColorAt(i, c);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.name = NAME;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  root.add(mesh);
  markFocusDepth(mesh);
  return mesh;
}

const pointer = { x: 0, y: 0, here: false };
let listening = false;
function listen(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      pointer.x = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      pointer.y = 1 - (e.clientY / Math.max(1, window.innerHeight)) * 2;
      pointer.here = true;
    },
    { passive: true },
  );
}

const ray = new THREE.Vector3();
const eye = new THREE.Vector3();
const yard = new THREE.Vector3(0, 0, 26);

/**
 * Once a frame: whether any of it can show, how many (`share`, by the tier), and where the
 * pointer falls on the ground, eased so the lawn closes up behind it.
 */
export function followGrass(mesh: THREE.InstancedMesh | null, camera: THREE.Camera, dt: number, share: number): void {
  if (!mesh) return;
  listen();
  const material = mesh.material as THREE.MeshStandardMaterial;
  camera.getWorldPosition(eye);
  const on = share > 0 && eye.distanceTo(yard) < GRASS.off;
  if (material.visible !== on) material.visible = on;
  if (!on) return;
  const n = Math.floor(mesh.instanceMatrix.count * share);
  if (mesh.count !== n) mesh.count = n;
  const u = grassUniforms.uGrassPointer.value;
  let want = 0;
  if (pointer.here) {
    ray.set(pointer.x, pointer.y, 0.5).unproject(camera).sub(eye).normalize();
    if (ray.y < -0.01) {
      const t = -eye.y / ray.y;
      const k = 1 - Math.exp(-Math.max(0, dt) / 0.09);
      const x = eye.x + ray.x * t;
      const z = eye.z + ray.z * t;
      u.x = u.z > 0.02 ? u.x + (x - u.x) * k : x;
      u.y = u.z > 0.02 ? u.y + (z - u.y) * k : z;
      want = 1;
    }
  }
  u.z += (want - u.z) * (1 - Math.exp(-Math.max(0, dt) / 0.25));
}
