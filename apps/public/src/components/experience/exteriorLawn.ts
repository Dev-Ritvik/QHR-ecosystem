// apps/public/src/components/experience/exteriorLawn.ts
//
// The estate's lawn, and the filtering every exterior texture is read with.
//
// THE LAWN WAS THE PLAINEST "GAME" TELL IN THE HERO (essence.md, §4): one
// flat green plane whose mowing stripes were baked into a 6 m tile. A tile
// cannot know how far away it is, so at the 40-120 m the film sees the lawn
// from, the bands aliased into a checkerboard of 12-18 m squares, and nothing
// else in the ground varied at all. The texture now carries turf only
// (make_estate_textures_v7.py); this draws what a real estate lawn has:
//
//   MOWING BANDS in world space, 1.6 m wide, parallel to the entrance axis.
//   View-dependent, as they are on a real lawn: blades in alternate bands lean
//   opposite ways, and a band leaning away from you shows the lit tops of its
//   blades and reads lighter — so the bands trade places as the camera orbits.
//   They fade out as they shrink toward a pixel, instead of aliasing.
//
//   MACRO VARIATION: two octaves of value noise at 25 m and 90 m — richer
//   patches and drier ones, the thing that makes ground read as ground at a
//   distance and a tiled texture never does.
//
// And every exterior texture is filtered anisotropically: a lawn, a drive and
// a terrace seen at a grazing angle through plain trilinear filtering smear to
// mush, which reads as low resolution even when the texture is not.

import * as THREE from 'three';

/** Mowing band width, metres (a ride-on mower's cut). */
export const BAND_M = 1.6;
/** How far the bands move value either side of the turf, at most. */
export const BAND_AMP = 0.085;
/** The lawn texture's tile, metres (tools/blender/build_estate_v7.py TILE). */
export const LAWN_TILE_M = 6.0;

const LAWN_RE = /^MAT_Lawn/;

const NOISE = /* glsl */ `
  float lawnHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lawnNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(lawnHash(i), lawnHash(i + vec2(1.0, 0.0)), u.x),
               mix(lawnHash(i + vec2(0.0, 1.0)), lawnHash(i + vec2(1.0, 1.0)), u.x), u.y) * 2.0 - 1.0;
  }
`;

/**
 * The lawn's map_fragment: the turf, times the macro field, times the bands.
 * World metres come from the map's own UVs (the build maps the ground at one
 * tile per LAWN_TILE_M metres), so the bands need nothing but the UV.
 */
export const LAWN_MAP_FRAGMENT = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  {
    vec2 m = vMapUv * ${LAWN_TILE_M.toFixed(1)};
    // Macro: richer and drier patches, 25 m and 90 m across.
    float p1 = lawnNoise(m / 25.0 + vec2(3.1, 7.7));
    float p2 = lawnNoise(m / 90.0 + vec2(11.3, 2.9));
    float dry = smoothstep(0.25, 0.85, p2 * 0.7 + p1 * 0.3);
    sampledDiffuseColor.rgb *= 1.0 + 0.09 * p1 + 0.06 * p2;
    sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, sampledDiffuseColor.rgb * vec3(1.22, 1.08, 0.7), 0.35 * dry);
    // Bands along the entrance axis: which way this band's blades lean
    // (world -z is the build's +y), and how much of that the camera sees.
    float t = m.x / ${BAND_M.toFixed(2)};
    float side = smoothstep(0.42, 0.58, abs(fract(t) - 0.5) * 2.0) * 2.0 - 1.0;
    vec3 toEye = cameraPosition - vLawnWorld;
    vec2 flatEye = toEye.xz / max(1e-3, length(toEye.xz));
    float lean = side * -flatEye.y;
    // Fade as a band narrows toward a pixel: past that it can only alias.
    float fine = fwidth(t);
    float amp = ${BAND_AMP.toFixed(3)} * (1.0 - smoothstep(0.25, 0.6, fine));
    sampledDiffuseColor.rgb *= 1.0 + amp * lean;
  }
  diffuseColor *= sampledDiffuseColor;
#endif
`;

/** Dress the estate's lawn material(s). Returns how many were dressed. */
export function dressLawn(root: THREE.Object3D): number {
  const done = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial & { __lawn?: boolean };
      if (!mat || mat.__lawn || !LAWN_RE.test(mat.name) || !mat.map) continue;
      mat.__lawn = true;
      done.add(mat);
      const prev = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', 'varying vec3 vLawnWorld;\nvoid main() {')
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vLawnWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', `varying vec3 vLawnWorld;\n${NOISE}\nvoid main() {`)
          .replace('#include <map_fragment>', LAWN_MAP_FRAGMENT);
      };
      mat.customProgramCacheKey = () => 'estate-lawn';
      mat.needsUpdate = true;
    }
  });
  return done.size;
}

const TEXTURE_SLOTS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'lightMap', 'bumpMap',
] as const;

/**
 * Anisotropic filtering at `level` on every texture the estate's materials
 * read. Returns how many textures changed. A texture already at `level` is
 * left alone, so this costs nothing on a second mount.
 */
export function sharpenTextures(root: THREE.Object3D, level: number): number {
  const seen = new Set<THREE.Texture>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!m) continue;
      for (const slot of TEXTURE_SLOTS) {
        const t = (m as unknown as Record<string, THREE.Texture | null>)[slot];
        if (!t || seen.has(t)) continue;
        seen.add(t);
      }
    }
  });
  let changed = 0;
  for (const t of seen) {
    if (t.anisotropy === level) continue;
    t.anisotropy = level;
    t.needsUpdate = true;
    changed += 1;
  }
  return changed;
}
