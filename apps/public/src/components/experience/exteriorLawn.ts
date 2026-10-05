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
//   NO TILE (the fourth art-direction critique, 2026-09-30: "The grass texture
//   is repetitive"). The turf is still one 6 m tile, and at 40 m its clumps
//   recur in a lattice the eye finds at once. So it is read twice — once as
//   laid, once at 0.61 of the scale turned 37 degrees — and the two are mixed
//   by a slow 9 m noise, with a 4 m clump field over both: no feature of the
//   tile falls on the same lattice twice, and the lawn reads as grown.
//
// And every exterior texture is filtered anisotropically: a lawn, a drive and
// a terrace seen at a grazing angle through plain trilinear filtering smear to
// mush, which reads as low resolution even when the texture is not.

import * as THREE from 'three';

/** Mowing band width, metres (a ride-on mower's cut). */
export const BAND_M = 1.6;
/** How far the bands move value either side of the turf, at most. */
export const BAND_AMP = 0.05;
/** The lawn texture's tile, metres (tools/blender/build_estate_v7.py TILE). */
export const LAWN_TILE_M = 6.0;

const LAWN_RE = /^MAT_Lawn/;
/** The gravel scan's tile, metres (build_estate_v7.py TILE, MAT_Gravel). */
export const GRAVEL_TILE_M = 3.0;
const GRAVEL_RE = /^MAT_Gravel/;

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
    // The tile read a second time, turned and rescaled, mixed in by a slow
    // noise; then a 4 m clump field over both.
    vec2 turned = mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.61 + vec2(0.37, 0.71);
    vec4 second = texture2D( map, turned );
    float mixw = smoothstep(0.3, 0.7, lawnNoise(m / 9.0 + vec2(4.1, 1.3)) * 0.5 + 0.5);
    sampledDiffuseColor = mix(sampledDiffuseColor, second, mixw);
    sampledDiffuseColor.rgb *= 1.0 + 0.05 * lawnNoise(m / 4.0 + vec2(8.7, 2.2));
    // Macro: richer and drier patches, 25 m and 90 m across, and a 9 m field
    // between them. STRONGER, AND LESS GREEN (the paid audit of 2026-10-04,
    // pass 3: "stop allowing the grass to become a large uninterrupted CG
    // surface ... tonal variation, subtle scale variation, believable
    // relationship with sunlight, less obvious repetition"). At 11% and 7%
    // the lawn was one green from the terrace to the wall, and the most
    // saturated thing in the cover. A lawn at the end of a dry day is olive
    // where it is thick and straw where it is thin, and no two beds of it are
    // the same value.
    float p1 = lawnNoise(m / 25.0 + vec2(3.1, 7.7));
    float p2 = lawnNoise(m / 90.0 + vec2(11.3, 2.9));
    float p3 = lawnNoise(m / 9.0 + vec2(5.9, 14.2));
    float dry = smoothstep(0.1, 0.8, p2 * 0.6 + p1 * 0.3 + p3 * 0.1);
    sampledDiffuseColor.rgb *= 1.0 + 0.2 * p1 + 0.13 * p2 + 0.07 * p3;
    sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, sampledDiffuseColor.rgb * vec3(1.3, 1.1, 0.62), 0.5 * dry);
    // The whole sward a step toward olive: less of the texture's emerald.
    sampledDiffuseColor.rgb = mix(vec3(dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), sampledDiffuseColor.rgb, 0.8)
                            * vec3(1.06, 1.0, 0.86);
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
    // AT A GLANCING ANGLE grass is its blades' tips, which catch the sky: a
    // lawn seen along its length is paler and greyer than one looked down
    // on, and that fall-off with distance is most of what stops it reading
    // as a painted plane.
    float graze = pow(1.0 - clamp(normalize(toEye).y, 0.0, 1.0), 3.0);
    sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb,
      vec3(dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))) * vec3(1.04, 1.02, 0.9), 0.3 * graze);
    sampledDiffuseColor.rgb *= 1.0 + 0.22 * graze;
  }
  diffuseColor *= sampledDiffuseColor;
#endif
`;

/**
 * The gravel's map_fragment (the refinement brief, 2026-10-03). The carriage
 * ring and the avenue are a photographed gravel now (tools/gltf/
 * ph_surfaces_v7.py), three metres to the tile, and from the hero's height a
 * three-metre tile is a lattice like any other. So, as on the lawn: the scan is
 * read twice, the second time turned and rescaled, the two mixed by a slow
 * noise; and the drive is lighter where it is worn and darker where it holds
 * the damp, over seven metres and thirty.
 */
export const GRAVEL_MAP_FRAGMENT = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  {
    vec2 m = vMapUv * ${GRAVEL_TILE_M.toFixed(1)};
    vec2 turned = mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.73 + vec2(0.37, 0.71);
    vec4 second = texture2D( map, turned );
    float mixw = smoothstep(0.3, 0.7, lawnNoise(m / 5.0 + vec2(4.1, 1.3)) * 0.5 + 0.5);
    sampledDiffuseColor = mix(sampledDiffuseColor, second, mixw);
    float p1 = lawnNoise(m / 7.0 + vec2(3.1, 7.7));
    float p2 = lawnNoise(m / 30.0 + vec2(11.3, 2.9));
    sampledDiffuseColor.rgb *= 1.0 + 0.06 * p1 + 0.05 * p2;
  }
  diffuseColor *= sampledDiffuseColor;
#endif
`;

/** Dress the estate's lawn and gravel material(s). Returns how many were dressed. */
export function dressLawn(root: THREE.Object3D): number {
  const done = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial & { __lawn?: boolean };
      if (!mat || mat.__lawn || !mat.map) continue;
      const gravel = GRAVEL_RE.test(mat.name);
      if (!gravel && !LAWN_RE.test(mat.name)) continue;
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
          .replace('#include <map_fragment>', gravel ? GRAVEL_MAP_FRAGMENT : LAWN_MAP_FRAGMENT);
      };
      mat.customProgramCacheKey = () => (gravel ? 'estate-gravel' : 'estate-lawn');
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
