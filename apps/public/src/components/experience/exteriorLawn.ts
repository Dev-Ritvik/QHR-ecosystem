// apps/public/src/components/experience/exteriorLawn.ts
//
// The estate's lawn, and the filtering every exterior texture is read with.
//
// THE LAWN WAS THE PLAINEST "GAME" TELL IN THE HERO (essence.md, §4): one
// flat green plane whose mowing stripes were baked into a 6 m tile. A tile
// cannot know how far away it is, so at the 40-120 m the film sees the lawn
// from, the bands aliased into a checkerboard of 12-18 m squares, and nothing
// else in the ground varied at all. The texture now carries turf only, and
// since 2026-10-27 a photographed one: a meadow's grass seen from above, cut
// from the HDRI the user supplied and quilted into a seamless tile at the
// approved turf's mean colour (tools/gltf/make_lawn_hdri_v7.py). This draws
// what a real estate lawn has over it:
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
import { GROUND_FOOT, GROUND_PARS, groundUniforms } from './exteriorGround';
import { ld } from './lookdev';

/** Mowing band width, metres (a ride-on mower's cut). */
export const BAND_M = 1.6;
/**
 * How far the bands move value either side of the turf, at most. (0.05 until
 * the forensic audit of 2026-10-09, #16: "At distance the lawn is a smooth,
 * untextured dark green with soft parallel shadow bands ... Expected: mown
 * stripes or fine grass detail that holds at both distances." At a twentieth
 * the cut was there to be measured and not to be seen: from the cover, across
 * the bands, it printed under two levels in 255.)
 */
export const BAND_AMP = 0.085;
/**
 * THE MOWING STOPS AT THE WALL (the creative director's audit, 2026-10-27:
 * outside the estate "a dead-flat green plane with a repetitive noise
 * texture"). The bands were drawn on every metre of the one ground mesh, the
 * country outside the compound with it, and nobody mows stripes into the
 * fields round an estate. The compound wall in world x and z (build_estate_v7
 * WALL_X, WALL_BACK, WALL_FRONT; world z is the build's -y), and how far past
 * it, metres, the bands are gone.
 */
export const COMPOUND = { x: 72, z0: -84, z1: 214, fade: 10 } as const;

/**
 * THE LAWN (the concept built 1:1, 2026-10-27, then the brief of 2026-11-01: "the
 * bare, uniform brown ground ... immediately breaks immersion"): how much of the
 * sward's colour is kept, and what it is printed through. It was { sat 0.62, tint
 * 0.46, 0.42, 0.3 }: under the film's warm low light that is a dead brown from the
 * terrace to the wall. A kept lawn is green at the end of a dry day, but only just:
 * the client asked for less saturated green (2026-10-04), so this is an olive that
 * has been watered, and not a golf course.
 */
export const LAWN_CONCEPT = { sat: 0.95, tint: [0.4, 0.55, 0.2] as const } as const;
/**
 * And the forest's floor past the wall, reached over `fade` metres: not one brown,
 * which from the air read as bare earth beyond a green lawn, but a shaded understorey
 * of moss and fern (`green`) with leaf litter through it (`litter`), the two laid out
 * by a slow noise.
 */
export const FOREST_FLOOR = {
  fade: 14,
  green: [0.42, 0.56, 0.26] as const,
  litter: [0.62, 0.52, 0.32] as const,
} as const;

/**
 * THE SWARD'S OWN GRAIN, at three sizes: [features a metre across the cut,
 * features a metre along it, how far it moves the turf's value, and the
 * metres-a-pixel at which it begins to go and is gone].
 *
 * The same audit, of the lawn by the forecourt at the film's 48%: "Close up
 * it is a blotchy low-resolution cloud pattern with no blades." The turf is
 * one six-metre tile under a field of patches metres across; between a patch
 * and a pixel there was nothing, so from ten metres the lawn was its patches
 * alone. Grass seen from standing height is tufts a hand across, then the
 * lie of the blades in them, then the blades: three fields of noise, each
 * drawn out along the cut (a mower lays the blades one way), and each put
 * down before it is finer than the pixels that would have to draw it: tufts
 * to some forty metres, the lie to fifteen, blades to six.
 */
export const SWARD = [
  [9, 5, 0.09, 0.02, 0.055],
  [22, 9, 0.1, 0.008, 0.0225],
  [55, 18, 0.12, 0.0035, 0.009],
] as const;
/** The lawn texture's tile, metres (tools/blender/build_estate_v7.py TILE). */
export const LAWN_TILE_M = 6.0;

/**
 * THE LOW SUN ON A LAWN (the user's reference of 2026-11-01: the sun's patches on the
 * grass bright against its shade). A sun fourteen degrees up gives a flat plane a quarter
 * of its light, and that is what the mesh is. But a lawn is not flat: it is blades standing
 * up, and a blade takes that sun nearly square on. So its direct light is more than the
 * plane's, by the hour; given back with the evening, when there is no sun to speak of.
 */
export const LAWN_SUN = 1.9;
/** On a tier that draws no shadows the whole lawn has the sun, and at LAWN_SUN it is a pale
 *  wash from the terrace to the wall. */
export const LAWN_SUN_UNSHADOWED = 1.2;
export const lawnUniforms = { uLawnSun: { value: LAWN_SUN as number } };
/** Once a frame. */
export function followLawn(evening: number, noon = 0, shadows = true): void {
  const sun = shadows ? ld('lawnSun', LAWN_SUN) : LAWN_SUN_UNSHADOWED;
  // (and the visitor's noon, whose high sun lights a plane and a blade alike)
  lawnUniforms.uLawnSun.value = 1 + (sun - 1) * (1 - Math.min(1, evening)) * (1 - noon);
}

const LAWN_RE = /^MAT_Lawn/;
/** Where the lawn's fields read the world (exteriorGrass.ts stands a blade's on its foot). */
export const LAWN_WORLD_LINE = 'vLawnWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;';
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
const SWARD_GLSL = SWARD.map(
  ([across, along, amp, from, gone], i) =>
    `      grain += ${amp.toFixed(3)} * lawnNoise(g * vec2(${across.toFixed(1)}, ${along.toFixed(1)}) + ${(i * 17.3).toFixed(1)})` +
    ` * (1.0 - smoothstep(${from.toFixed(4)}, ${gone.toFixed(4)}, px));`,
).join('\n');

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
    // And stop at the wall: outside it is the country (COMPOUND).
    float fine = fwidth(t);
    float outside = max(max(abs(vLawnWorld.x) - ${COMPOUND.x.toFixed(1)}, ${COMPOUND.z0.toFixed(1)} - vLawnWorld.z),
                        vLawnWorld.z - ${COMPOUND.z1.toFixed(1)});
    float amp = ${BAND_AMP.toFixed(3)} * (1.0 - smoothstep(0.0, ${COMPOUND.fade.toFixed(1)}, outside))
              * (1.0 - smoothstep(0.25, 0.6, fine));
    sampledDiffuseColor.rgb *= 1.0 + amp * lean;
    // THE CONCEPT'S GROUND (built 1:1, 2026-10-27): a lawn at golden hour in a
    // forest valley is a deep olive, not a park's green; and past the wall the
    // ground is the forest's floor, leaf litter in the trees' shade.
    sampledDiffuseColor.rgb = mix(vec3(dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), sampledDiffuseColor.rgb, ${LAWN_CONCEPT.sat.toFixed(2)})
                            * vec3(${LAWN_CONCEPT.tint.map((v) => v.toFixed(2)).join(', ')});
    float forestFloor = smoothstep(0.0, ${FOREST_FLOOR.fade.toFixed(1)}, outside);
    if (forestFloor > 0.0) {
      float litter = smoothstep(-0.2, 0.5, 0.65 * lawnNoise(vLawnWorld.xz / 13.0 + vec2(5.3, 2.1)) + 0.45 * lawnNoise(vLawnWorld.xz / 41.0 + vec2(1.7, 8.8)));
      vec3 understorey = mix(vec3(${FOREST_FLOOR.green.map((v) => v.toFixed(2)).join(', ')}), vec3(${FOREST_FLOOR.litter.map((v) => v.toFixed(2)).join(', ')}), litter);
      sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb,
        vec3(dot(sampledDiffuseColor.rgb, vec3(0.3, 0.5, 0.2))) * understorey,
        forestFloor);
    }
    // The sward's grain (SWARD): tufts, the lie of the blades, the blades.
    {
      vec2 g = vLawnWorld.xz;
      float px = length(fwidth(g));
      float grain = 0.0;
${SWARD_GLSL}
      sampledDiffuseColor.rgb *= 1.0 + grain;
    }
    // AT A GLANCING ANGLE grass is its blades' tips, which catch the sky: a
    // lawn seen along its length is paler and greyer than one looked down
    // on, and that fall-off with distance is most of what stops it reading
    // as a painted plane.
    float graze = pow(1.0 - clamp(normalize(toEye).y, 0.0, 1.0), 3.0);
    sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb,
      vec3(dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))) * vec3(1.04, 1.02, 0.9), 0.3 * graze);
    sampledDiffuseColor.rgb *= 1.0 + 0.22 * graze;
${GROUND_FOOT}
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
        if (!gravel) Object.assign(shader.uniforms, groundUniforms, lawnUniforms);
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', 'varying vec3 vLawnWorld;\nvoid main() {')
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             ${LAWN_WORLD_LINE}`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', `varying vec3 vLawnWorld;\n${gravel ? '' : `${GROUND_PARS}uniform float uLawnSun;\n`}${NOISE}\nvoid main() {`)
          .replace('#include <map_fragment>', gravel ? GRAVEL_MAP_FRAGMENT : LAWN_MAP_FRAGMENT);
        if (!gravel) {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <lights_fragment_end>',
            '#include <lights_fragment_end>\n  reflectedLight.directDiffuse *= uLawnSun;',
          );
        }
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
