// apps/public/src/components/experience/nightPools.ts
//
// THE LIT ROOMS LIGHT THE GROUND.
//
// The fourth art-direction critique (2026-09-30), on the dusk and the night:
// "The interior lights in the house turn on, but they don't cast realistic
// pools of warm light onto the grass or pool ... Night scenes in premium web
// design rely on deep, rich blacks and very deliberate, volumetric pools of
// light." The rooms behind the glass (exteriorWindows.ts) came up with the
// evening and the terrace in front of them stayed as dark as the far lawn.
//
// So each lit window throws the shape of its opening onto the ground in front
// of it, as a lit window at night does: the room's lamp (exteriorWindows.ts
// hangs it three metres back, just under the window's head) shines through the
// glass, and a ground point is lit only if the line from it to the lamp
// passes through the opening — which makes each pool a trapezoid that starts
// at the wall and ends a couple of metres out, bright near the sill and
// falling off with distance from the lamp. A first-floor window throws a
// longer, fainter streak further out. (The first version made each window an
// area light shining everywhere in front of it; fifty-five of those summed
// into a floodlight over the whole lawn — measured, and seen.) Which windows
// are lit, and how warm, is each room's own (its seed, shared with the shader
// that draws the room), so no dark window casts a pool.
//
// BAKED, AGAIN. The house does not move and neither do its windows, so the
// pools are computed once at load into a small map over the estate's plan
// (POOL_MAP, 12 cm a texel) and every ground material — the lawn, the paving,
// the terrace, the steps, the beds — reads it by its world position and adds
// it as light, scaled by how far the evening has come (poolLight.gain, the
// same drive that brings the rooms up). One texture fetch a pixel; no light is
// added to the scene, and nothing recompiles when night falls.

import * as THREE from 'three';

export interface RoomLight {
  /** World-space centre of the window. */
  centre: THREE.Vector3;
  /** World-space outward normal (horizontal). */
  normal: THREE.Vector3;
  /** Half the window's width and height, metres. */
  halfW: number;
  halfH: number;
  /** Linear colour of the room's lamps times how much of it is on. */
  colour: THREE.Color;
}

/** The map's extent over the plan: x -32..32, z -28..36 (the house stands at
 *  x +/-15.5, z -10.3..13.25), 512 texels a side. */
export const POOL_MAP = { x0: -32, z0: -28, size: 64, px: 512 } as const;

/** The evening's drive, written each frame by ExteriorLighting. */
export const poolLight = { gain: 0 };

/** The gain uniform, shared by every ground material. */
const poolGainUniform = { value: 0 };

/** The lamp's strength, per unit of the drive: set so a pool on the terrace
 *  under a ground-floor window reads as warm stone, not as a floodlight. */
const POOL_POWER = 5;
/** Where each room's lamp hangs: this far back from the glass, and this far
 *  under the window's head (exteriorWindows.ts: ROOM_DEPTH * 0.55, and the
 *  lamp 0.9 m below a ceiling that stands 0.85 m over the head). */
const LAMP_BACK = 3.0;
const LAMP_UNDER_HEAD = 0.05;
/** The soft edge of a pool, metres of the opening. */
const PENUMBRA = 0.18;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Build the map. RGB is the pools' irradiance, stored as its square root
 * against the brightest texel (8 bits carry a smooth tail that way), and
 * `max` is that brightest value.
 */
export function buildPoolMap(lights: readonly RoomLight[]): { texture: THREE.DataTexture; max: number } {
  const { x0, z0, size, px } = POOL_MAP;
  const cell = size / px;
  const acc = new Float32Array(px * px * 3);
  const reach = 12;
  for (const l of lights) {
    const r = l.colour.r;
    const g = l.colour.g;
    const b = l.colour.b;
    if (r + g + b <= 0) continue;
    const n = l.normal;
    // Along the wall, horizontal.
    const ax = -n.z;
    const az = n.x;
    const sill = l.centre.y - l.halfH;
    // The ground in front: the terrace at the room's floor for the ground
    // floor, the lawn for the floors above — whose light, through a drawn
    // curtain and out over a balustrade, reaches the lawn as a faint streak.
    const upper = sill >= 2.5;
    const ground = upper ? 0 : Math.max(0, sill - 0.95);
    const floorGain = upper ? 0.35 : 1;
    const lx = l.centre.x - n.x * LAMP_BACK;
    const lz = l.centre.z - n.z * LAMP_BACK;
    const ly = l.centre.y + l.halfH - LAMP_UNDER_HEAD;
    const i0 = Math.max(0, Math.floor((l.centre.x - reach - x0) / cell));
    const i1 = Math.min(px - 1, Math.ceil((l.centre.x + reach - x0) / cell));
    const j0 = Math.max(0, Math.floor((l.centre.z - reach - z0) / cell));
    const j1 = Math.min(px - 1, Math.ceil((l.centre.z + reach - z0) / cell));
    for (let j = j0; j <= j1; j += 1) {
      const z = z0 + (j + 0.5) * cell;
      for (let i = i0; i <= i1; i += 1) {
        const x = x0 + (i + 0.5) * cell;
        // In front of the wall only.
        const out = (x - l.centre.x) * n.x + (z - l.centre.z) * n.z;
        if (out <= 0.05) continue;
        // Where the line from the ground point to the lamp crosses the glass.
        const px_ = x - lx;
        const py_ = ground - ly;
        const pz_ = z - lz;
        const along = px_ * n.x + pz_ * n.z;
        if (along <= 0) continue;
        const t = LAMP_BACK / along;
        const qx = lx + px_ * t - l.centre.x;
        const qy = ly + py_ * t - l.centre.y;
        const qz = lz + pz_ * t - l.centre.z;
        const across = Math.abs(qx * ax + qz * az);
        const up = Math.abs(qy);
        const open =
          (1 - smooth(l.halfW - PENUMBRA, l.halfW + PENUMBRA, across)) *
          (1 - smooth(l.halfH - PENUMBRA, l.halfH + PENUMBRA, up));
        if (open <= 0) continue;
        const d2 = px_ * px_ + py_ * py_ + pz_ * pz_;
        const cos = -py_ / Math.sqrt(d2);
        const e = (floorGain * open * cos) / d2;
        const k = (j * px + i) * 3;
        acc[k] += r * e;
        acc[k + 1] += g * e;
        acc[k + 2] += b * e;
      }
    }
  }
  let max = 1e-6;
  for (let k = 0; k < acc.length; k += 1) if (acc[k] > max) max = acc[k];
  const data = new Uint8Array(px * px * 4);
  for (let k = 0, q = 0; k < acc.length; k += 3, q += 4) {
    data[q] = Math.round(255 * Math.sqrt(acc[k] / max));
    data[q + 1] = Math.round(255 * Math.sqrt(acc[k + 1] / max));
    data[q + 2] = Math.round(255 * Math.sqrt(acc[k + 2] / max));
    data[q + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, px, px, THREE.RGBAFormat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return { texture, max };
}

/** Ground materials: the lawn, the paving, the terrace, the steps, the beds,
 *  the kerbs. */
const GROUND_RE = /^MAT_(Lawn|Stone_Paving|Stone_Flags|Gravel|Stone_Terrace|Stone_Steps|Soil|Stone_Trim_AOG)/;

const POOL_VERTEX = /* glsl */ `
#include <project_vertex>
{
  vec4 poolW = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
  poolW = batchingMatrix * poolW;
  #endif
  #ifdef USE_INSTANCING
  poolW = instanceMatrix * poolW;
  #endif
  vPoolWorld = (modelMatrix * poolW).xyz;
}
`;

const POOL_FRAGMENT = /* glsl */ `
#include <lights_fragment_end>
{
  vec2 puv = (vPoolWorld.xz - uPoolOrigin) / uPoolSize;
  if (all(greaterThan(puv, vec2(0.0))) && all(lessThan(puv, vec2(1.0))) && uPoolGain > 0.0) {
    vec3 s = texture2D(uPoolMap, puv).rgb;
    // Only faces that look up take the pools: a wall or a riser in front of a
    // window is lit by the window, not by the ground's map.
    float up = smoothstep(0.55, 0.9, (inverseTransformDirection(normal, viewMatrix)).y);
    reflectedLight.indirectDiffuse += diffuseColor.rgb * (s * s) * uPoolMax * uPoolGain * up;
  }
}
`;

/**
 * Put the pools on the ground materials under `root`. Idempotent; returns how
 * many materials took them. The uniforms are shared, so one write a frame
 * (poolLight.gain) reaches every one.
 */
export function dressPools(root: THREE.Object3D, map: { texture: THREE.Texture; max: number }): number {
  const uniforms = {
    uPoolMap: { value: map.texture },
    uPoolOrigin: { value: new THREE.Vector2(POOL_MAP.x0, POOL_MAP.z0) },
    uPoolSize: { value: POOL_MAP.size },
    uPoolMax: { value: map.max * POOL_POWER },
    uPoolGain: poolGainUniform,
  };
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial & { __pools?: boolean };
      if (!mat || !mat.isMeshStandardMaterial || !GROUND_RE.test(mat.name)) continue;
      if (mat.__pools) {
        // A remount: point the shared uniforms at this mount's map.
        const u = (mat.userData.poolUniforms ?? null) as typeof uniforms | null;
        if (u) {
          u.uPoolMap.value = map.texture;
          u.uPoolMax.value = map.max * POOL_POWER;
        }
        continue;
      }
      mat.__pools = true;
      mat.userData.poolUniforms = uniforms;
      const prev = mat.onBeforeCompile;
      const prevKey = mat.customProgramCacheKey.bind(mat);
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        Object.assign(shader.uniforms, mat.userData.poolUniforms);
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', 'varying vec3 vPoolWorld;\nvoid main() {')
          .replace('#include <project_vertex>', POOL_VERTEX);
        shader.fragmentShader = shader.fragmentShader
          .replace(
            'void main() {',
            'uniform sampler2D uPoolMap;\nuniform vec2 uPoolOrigin;\nuniform float uPoolSize;\nuniform float uPoolMax;\nuniform float uPoolGain;\nvarying vec3 vPoolWorld;\nvoid main() {',
          )
          .replace('#include <lights_fragment_end>', POOL_FRAGMENT);
      };
      mat.customProgramCacheKey = () => `${prevKey()}|night-pools`;
      mat.needsUpdate = true;
      n += 1;
    }
  });
  return n;
}

/** Push the evening's drive to the shaders. Call once a frame. */
export function applyPoolGain(): void {
  poolGainUniform.value = poolLight.gain;
}
