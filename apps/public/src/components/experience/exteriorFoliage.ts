// apps/public/src/components/experience/exteriorFoliage.ts
//
// The estate's foliage, shaded as foliage (essence.md, §4, tell 1).
//
// The trees are cards rendered from modelled leaf clusters and grown into
// lobed crowns (tools/blender/render_foliage_v7.py, build_estate_v7.py). Three
// things a card cannot carry are added here, at runtime:
//
//   LIGHT THROUGH THE LEAVES. A leaf is thin: with the sun behind a crown, its
//   edges glow yellow-green. It is the single most "photographed" quality of
//   trees at the golden hour, and without it a backlit crown is a dark cut-out.
//   Added to the direct diffuse where the view looks toward the sun, scaled by
//   the key light's own colour and strength (so evening reddens it too).
//
//   NO TWO TREES THE SAME. A hash of each instance's position shifts its hue
//   and value a little: ~180 belt trees drawn from three meshes stop reading as
//   clones.
//
//   WIND. A slow sway, larger higher in the crown and at a frond's tip; phase
//   from the instance and the vertex, so neighbours do not move in lockstep.
//   Small on purpose — this is an estate on a still evening, not a storm.

import * as THREE from 'three';

/** Shared by every foliage material: one assignment a frame moves them all. */
export const foliageUniforms = {
  uTime: { value: 0 },
  /** World direction TO the key light (the sun). */
  uSunDir: { value: new THREE.Vector3(-0.8, 0.25, 0.5).normalize() },
  /** Key light colour times intensity. */
  uSunColor: { value: new THREE.Color(1, 0.85, 0.66) },
};

/** Strength of the light through the leaves, relative to the key. */
export const TRANSLUCENCY = 0.32;
/**
 * Lift on the leaf colour. The cards carry the occlusion between leaves in
 * their albedo AND the crowns carry it again per vertex (COLOR_0); measured on
 * the first build the two multiplied the crowns to near-black. This restores
 * the leaves' own value; the per-vertex term keeps the crown's shape.
 */
export const FOLIAGE_GAIN = 1.55;
/**
 * Alpha scale per mip level. Each smaller mip averages leaf with gap, the
 * averaged alpha falls under the 0.5 cutoff and the leaves vanish — crowns
 * thinned to bare twigs exactly where they should read as solid masses. Scaling
 * alpha up with the mip level holds the coverage at distance.
 */
export const ALPHA_PER_MIP = 0.3;
/** Sway, metres, at the top of a crown / the tip of a frond. */
export const SWAY_CROWN = 0.06;
export const SWAY_FROND = 0.16;

const FOLIAGE_RE = /^MAT_(Leaves_|Palm_Frond)/;
const FROND_RE = /^MAT_Palm_Frond/;

export const FOLIAGE_VERTEX = /* glsl */ `
#include <begin_vertex>
{
  #ifdef USE_INSTANCING
    vec3 fInst = instanceMatrix[3].xyz;
  #else
    vec3 fInst = vec3(modelMatrix[3].x, modelMatrix[3].y, modelMatrix[3].z);
  #endif
  float fSeed = fract(sin(dot(fInst.xz, vec2(12.9898, 78.233))) * 43758.5453);
  vFoliageSeed = fSeed;
  #ifdef FOLIAGE_FROND
    float amp = ${SWAY_FROND.toFixed(3)} * uv.x * uv.x;
  #else
    float amp = ${SWAY_CROWN.toFixed(3)} * clamp(transformed.y / 10.0, 0.0, 1.2);
  #endif
  float w = sin(uFoliageTime * 1.1 + fSeed * 6.2832 + transformed.x * 0.31 + transformed.z * 0.23) * 0.65
          + sin(uFoliageTime * 2.3 + fSeed * 11.0 + transformed.y * 0.8) * 0.35;
  transformed += vec3(w, 0.0, w * 0.55) * amp;
}
`;

export const FOLIAGE_TINT = /* glsl */ `
#include <color_fragment>
{
  // Hue from cool to warm and value from 0.9 to 1.1, per tree.
  vec3 hue = mix(vec3(0.92, 0.96, 1.04), vec3(1.08, 1.03, 0.86), vFoliageSeed);
  diffuseColor.rgb *= hue * (0.9 + 0.2 * fract(vFoliageSeed * 7.31)) * ${FOLIAGE_GAIN.toFixed(2)};
}
`;

export const FOLIAGE_COVERAGE = /* glsl */ `
#ifdef USE_MAP
{
  vec2 texels = vMapUv * vec2(textureSize(map, 0));
  vec2 dx = dFdx(texels), dy = dFdy(texels);
  float lod = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
  diffuseColor.a *= 1.0 + lod * ${ALPHA_PER_MIP.toFixed(2)};
}
#endif
{
  // A card seen edge-on is a streak of stretched leaves, not foliage: fade it
  // out as it turns away. The FACE's normal, from the derivatives — the
  // shading normals are bent out of the crown on purpose and say nothing
  // about how the card itself is turned.
  vec3 cardN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
  float facing = abs(dot(cardN, normalize(vViewPosition)));
  diffuseColor.a *= smoothstep(0.08, 0.3, facing);
}
#include <alphatest_fragment>
`;

export const FOLIAGE_TRANSLUCENCY = /* glsl */ `
#include <lights_fragment_end>
{
  vec3 sunV = normalize((viewMatrix * vec4(uFoliageSunDir, 0.0)).xyz);
  // Looking toward the sun through the leaf: the fragment-to-eye direction
  // opposes the sun's.
  float back = pow(max(0.0, dot(geometryViewDir, -sunV)), 3.0);
  // And the side of a leaf turned away from the sun still passes some light.
  float wrap = 0.25 * max(0.0, -dot(normal, sunV));
  vec3 through = diffuseColor.rgb * vec3(1.0, 1.12, 0.55);
  reflectedLight.directDiffuse += through * uFoliageSunColor * ${TRANSLUCENCY.toFixed(3)} * (back + wrap);
}
`;

/** Dress every foliage material under `root`. Returns how many. */
export function dressFoliage(root: THREE.Object3D): number {
  const done = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial & { __foliage?: boolean };
      if (!mat || mat.__foliage || !FOLIAGE_RE.test(mat.name)) continue;
      mat.__foliage = true;
      done.add(mat);
      const frond = FROND_RE.test(mat.name);
      mat.defines = { ...(mat.defines ?? {}), ESTATE_FOLIAGE: '', ...(frond ? { FOLIAGE_FROND: '' } : {}) };
      const prev = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        shader.uniforms.uFoliageTime = foliageUniforms.uTime;
        shader.uniforms.uFoliageSunDir = foliageUniforms.uSunDir;
        shader.uniforms.uFoliageSunColor = foliageUniforms.uSunColor;
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', 'uniform float uFoliageTime;\nvarying float vFoliageSeed;\nvoid main() {')
          .replace('#include <begin_vertex>', FOLIAGE_VERTEX);
        shader.fragmentShader = shader.fragmentShader
          .replace(
            'void main() {',
            'uniform vec3 uFoliageSunDir;\nuniform vec3 uFoliageSunColor;\nvarying float vFoliageSeed;\nvoid main() {',
          )
          .replace('#include <color_fragment>', FOLIAGE_TINT)
          .replace('#include <alphatest_fragment>', FOLIAGE_COVERAGE)
          .replace('#include <lights_fragment_end>', FOLIAGE_TRANSLUCENCY);
      };
      mat.customProgramCacheKey = () => `estate-foliage${frond ? '-frond' : ''}`;
      mat.needsUpdate = true;
    }
  });
  return done.size;
}

const toSun = new THREE.Vector3();
const at = new THREE.Vector3();

/** Follow the key light: its direction and its colour times intensity. */
export function followSun(light: THREE.DirectionalLight | null, dt: number): void {
  foliageUniforms.uTime.value += dt;
  if (!light) return;
  light.updateMatrixWorld();
  light.target.updateMatrixWorld();
  toSun.setFromMatrixPosition(light.matrixWorld).sub(at.setFromMatrixPosition(light.target.matrixWorld));
  if (toSun.lengthSq() > 1e-6) foliageUniforms.uSunDir.value.copy(toSun.normalize());
  foliageUniforms.uSunColor.value.copy(light.color).multiplyScalar(light.intensity);
}
