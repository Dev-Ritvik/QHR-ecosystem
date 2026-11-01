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
//   WIND. A crown leaning with slow gusts that cross the estate, its limbs moving
//   within that, its leaves trembling; a frond's tip further than its root. See WIND
//   for what it was and why.

import * as THREE from 'three';
import { layoutAir } from './exteriorLayout';
import { journeyState } from './journey';
import { filmState } from './FilmGrade';
import { ld } from './lookdev';
import { sceneWarm } from './sceneWarm';

/** Shared by every foliage material: one assignment a frame moves them all. */
export const foliageUniforms = {
  uTime: { value: 0 },
  /** World direction TO the key light (the sun). */
  uSunDir: { value: new THREE.Vector3(-0.8, 0.25, 0.5).normalize() },
  /** Key light colour times intensity. */
  uSunColor: { value: new THREE.Color(1, 0.85, 0.66) },
  /** The wind's strength, 0..1: nothing while a still is over the picture. */
  uWind: { value: 0 },
  /** The light through the leaves, as a share of TRANSLUCENCY: eased down
   *  with the film's evening (followSun). */
  uGlow: { value: 1 },
  /** The sun on the crowns' tops, over the layout only (LAYOUT_TOP). */
  uTop: { value: 0 },
  /** The bougainvillea's light (BLOOM_LIGHT): of the sun, and of the shade. */
  uBloomSun: { value: 1 as number },
  uBloomShade: { value: 1 as number },
  /** The lift a petal takes in place of FOLIAGE_GAIN (PETAL_GAIN). */
  uPetal: { value: 0 as number },
  /** The generated palms (PALM_LIGHT; exteriorTrees dresses them): the light
   *  through a crown, and the lift on its leaf and on its trunk. */
  uPalmThrough: { value: 0 as number },
  uPalmLeaf: { value: 1 as number },
  uPalmTrunk: { value: 1 as number },
  /** How much of the model's own green a frond keeps (PALM_LIGHT.chroma). */
  uPalmChroma: { value: 1 as number },
};

/**
 * THE GENERATED PALMS ARE TREES IN THE SAME LIGHT.
 *
 * The forensic audit of 2026-10-09 (#12, HIGH): "The palms render as pure
 * black silhouettes with hard, stair-stepped fronds and black trunks,
 * standing on a sunlit lawn next to broadleaf trees that are fully lit ...
 * Expected: palms lit by the same sun and sky as everything else, with
 * translucent fronds against the light."
 *
 * The broadleaf crowns are cards, and everything above is theirs: the lift
 * that undoes their doubled occlusion, the light through a leaf. The palms
 * the film passes near are the client's generated models (exteriorTrees),
 * one solid mesh under one material with a name this file did not know, so
 * they had neither. Seen against the sun, on the revolve, a frond had only
 * its shaded side to show and the sky's fill on a leaf painted nearly black:
 * a cut-out, beside a mango in full glow.
 *
 * A palm's frond is a row of thin leaflets and passes light as a leaf does.
 * So the crown of a generated palm (from where its fronds leave the trunk:
 * exteriorTrees, PALM_CROWN), where it is green, takes the same light through
 * it as a broadleaf card and a lift of its own; and its trunk a smaller lift,
 * a trunk being grey bark in the open and not the near-black the model paints
 * it.
 *
 * AND THE LEAF'S OWN COLOUR. Lit, the model's frond is an emerald at full
 * saturation, which no palm is at any hour and which stood out of a hazed
 * golden evening like a sign: seen on the first build that lit them, beside
 * mango and rain-tree crowns in olive. `chroma` is how much of that green a
 * frond keeps, and it is warmed toward the olive of the crowns it stands
 * among (PALM_WARMTH).
 *
 * All of them can be moved on a running build (lookdev: palmThrough,
 * palmLeaf, palmTrunk, palmChroma).
 */
export const PALM_LIGHT = { through: 0.5, leaf: 1.15, trunk: 3.2, chroma: 0.62 } as const;
export const PALM_WARMTH = [1.1, 1.0, 0.74] as const;
/** The share of the light through a crown that reaches a frond turned from
 *  the sun (exteriorTrees, PALM_THROUGH): seen on the first lit build, the
 *  fronds hanging on the far side of a crown were still the black they had
 *  been, under a crown in full light. */
export const PALM_SCATTER = 0.14;
foliageUniforms.uPalmThrough.value = PALM_LIGHT.through;
foliageUniforms.uPalmLeaf.value = PALM_LIGHT.leaf;
foliageUniforms.uPalmTrunk.value = PALM_LIGHT.trunk;
foliageUniforms.uPalmChroma.value = PALM_LIGHT.chroma;

/**
 * HOW MUCH OF THE GLOW THE EVENING TAKES. The third art-direction critique
 * (2026-09-30) found the dusk frames glittery; measured on its holdings shot,
 * every leaf card of a backlit crown lit up whole against the low sun, and at
 * the frame's edge the lens split each one into red and cyan: a tree of
 * baubles. At dusk a crown against the last of the sun is a dark mass with a
 * rim, so the evening takes most of the through-light, and the crown reads as
 * one shape again.
 */
export const GLOW_EVENING_LOSS = 1;

/** Strength of the light through the leaves, relative to the key. */
export const TRANSLUCENCY = 0.32;
/**
 * AND SHOWN (the user's reference of 2026-11-01: "the golden-hour sunlight passes through
 * the palm fronds and broadleaf tree canopies"): a multiple of the above, given back with
 * the evening as it always was.
 */
export const LEAF_GLOW = 0.95;
/**
 * Lift on the leaf colour. The cards carry the occlusion between leaves in
 * their albedo AND the crowns carry it again per vertex (COLOR_0); measured on
 * the first build the two multiplied the crowns to near-black. This restores
 * the leaves' own value; the per-vertex term keeps the crown's shape.
 */
export const FOLIAGE_GAIN = 1.55;
/**
 * THE FLOWERS. The frangipani's are painted into its cards, a cream at a
 * linear value of ~0.6 against the leaves' ~0.02 (measured on v7_frangipani:
 * 8.6% of its texels). The lift above, meant for a leaf, carried a petal to
 * ~0.95 — past any white a petal has — and with the warm evening key on it
 * every flower read as a lamp: the fourth art-direction critique's dusk
 * "glitter", and small yellow lights behind the holdings' figures. So the
 * lift fades out as a texel brightens (PETAL_FROM..PETAL_TO, in linear
 * luminance after the crown's own occlusion), and a petal takes this instead:
 * a cream flower in its own crown's shade, an accent in the crown rather than
 * a light in it (0.75 and 0.5 compared on the holdings frames; at 0.75 the
 * crowns still read as polka dots).
 *
 * The frangipani's card only (PETAL_RE). The broadleaf cards are painted
 * brighter — mango, neem and rain-tree leaves reach 0.13 to 0.24, a third to
 * two-thirds of their texels above PETAL_FROM (measured on the cards) — so a
 * mask shared with them would take part of their leaves' lift too.
 */
export const PETAL_GAIN = 0.5;
export const PETAL_FROM = 0.08;
export const PETAL_TO = 0.3;
foliageUniforms.uPetal.value = PETAL_GAIN;
/**
 * Alpha scale per mip level. Each smaller mip averages leaf with gap, the
 * averaged alpha falls under the 0.5 cutoff and the leaves vanish — crowns
 * thinned to bare twigs exactly where they should read as solid masses. Scaling
 * alpha up with the mip level holds the coverage at distance.
 */
export const ALPHA_PER_MIP = 0.3;
/**
 * THE WIND (the brief of 2026-11-01: "a custom vertex wind shader so palm fronds and
 * tree canopies sway naturally"). There was one, at 6 cm at the top of a crown and
 * 16 cm at a frond's tip: from where the film stands a pixel is four centimetres
 * across, so a crown moved a pixel and a half. It was there to be measured and not to
 * be seen. Metres, now, at the top of a ten-metre crown and at a frond's tip five
 * metres out, at the height of a gust: an estate in a light evening air, not a storm.
 *
 *   GUSTS come over the land: two slow waves in the world, so that a tree and its
 *   neighbour lean together and the far side of the lawn a few seconds later.
 *   THE LEAN takes the whole crown the wind's way (WIND_DIR) and lets it back.
 *   THE LIMBS move within that, each at its own phase.
 *   THE LEAVES tremble, a few centimetres, and only as much as a gust has.
 *
 * Held at nothing while a still is over the picture or being shot (uWind, followSun),
 * so a still and the first live frame are the same trees.
 */
export const SWAY_CROWN = 0.26;
export const SWAY_FROND = 0.42;
export const TREMBLE = 0.025;
/** Which way it blows: world x, z. */
export const WIND_DIR = [0.78, 0.62] as const;
/** How long the wind takes to come up once nothing is held over the picture, seconds. */
export const WIND_IN_S = 3;

/**
 * THE GUST AT A PLACE, 0..1, for any vertex shader with uFoliageTime in it. `p` is the
 * tree's own place in the world, xz.
 */
export const WIND_GUST = /* glsl */ `
float windGust(vec2 p, float t) {
  float a = sin(t * 0.19 + dot(p, vec2(0.021, 0.013)));
  float b = sin(t * 0.073 + dot(p, vec2(-0.009, 0.017)) + 1.7);
  return 0.5 + 0.5 * clamp(a * 0.7 + b * 0.5, -1.0, 1.0);
}
`;

const FOLIAGE_RE = /^MAT_(Leaves_|Palm_Frond)/;
const FROND_RE = /^MAT_Palm_Frond/;
const PETAL_RE = /^MAT_Leaves_Frangipani/;
/** The bougainvillea's cards: a bract's magenta, taken down (FOLIAGE_TINT). */
const BLOOM_RE = /^MAT_Leaves_Bougainvillea/;

/**
 * ONE PLANTING COLOUR THROUGH THE LIGHT. The forensic audit of 2026-10-09
 * (#22): "The shrubs are near-black noisy blobs at the cover and saturated
 * red at the revolve ... Planting that changes from black to red between
 * chapters looks unconsidered. Expected: one planting colour that holds
 * through the light."
 *
 * A crimson has almost no luminance of its own: in the house's shade, by the
 * sky alone, the beds along the terrace printed at 45, 12, 18, and with the
 * low sun on them at 130, 20, 30. A bush of bracts is thin and many-layered:
 * the sun goes through it more than it lands on it, and its shaded side is
 * lit by the bracts beside it. So its two lights are drawn toward each other
 * (`sun`: how much of the sun's own it takes; `shade`: how much more of the
 * sky's than a leaf), and a little more of its colour is given up (`sat`,
 * against the 0.62 it kept since the paid audit of 2026-10-04): a deep rose
 * in the shade and a deep rose in the sun. Measured over the beds' own red,
 * the shade's against the sun's: 0.38 before, 0.57 at the first setting
 * (0.8 and 2.0), 0.68 at this one: half a stop apart instead of a stop and
 * a half.
 */
export const BLOOM_LIGHT = { sun: 0.72, shade: 2.7, sat: 0.5 } as const;
foliageUniforms.uBloomSun.value = BLOOM_LIGHT.sun;
foliageUniforms.uBloomShade.value = BLOOM_LIGHT.shade;

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
  float fGust = 0.35 + 0.65 * windGust(fInst.xz + modelMatrix[3].xz, uFoliageTime);
  #ifdef FOLIAGE_FROND
    // a frond hangs from the crown: the further out along it, the further it goes
    // (by where it is, not its map: the atlases are not all laid out one way)
    float fOut = length(transformed.xz) / 5.0;
    float amp = ${SWAY_FROND.toFixed(3)} * fOut * fOut;
  #else
    float fUp = clamp(transformed.y / 10.0, 0.0, 1.4);
    float amp = ${SWAY_CROWN.toFixed(3)} * fUp * fUp;
  #endif
  // the lean, the limbs, the leaves
  float fLean = 0.55 + 0.45 * sin(uFoliageTime * 0.62 + fSeed * 6.2832);
  float fLimb = sin(uFoliageTime * 1.43 + fSeed * 11.0 + transformed.x * 0.41 + transformed.z * 0.33 + transformed.y * 0.27);
  float fLeaf = sin(uFoliageTime * 5.3 + fSeed * 17.0 + dot(transformed, vec3(2.3, 1.7, 2.9)));
  vec2 fDir = vec2(${WIND_DIR[0].toFixed(3)}, ${WIND_DIR[1].toFixed(3)});
  vec2 fPush = fDir * fLean * fGust + vec2(-fDir.y, fDir.x) * 0.35 * fLimb * fGust + fDir * 0.3 * fLimb;
  transformed.xz += fPush * amp * uFoliageWind;
  #ifdef FOLIAGE_FROND
    transformed.y += (0.6 * fLimb - 0.25 * fLean) * fGust * amp * uFoliageWind;
  #endif
  transformed += vec3(fLeaf, fLeaf * 0.6, -fLeaf * 0.8) * ${TREMBLE.toFixed(3)} * fGust * uFoliageWind;
}
`;

export const FOLIAGE_TINT = /* glsl */ `
#include <color_fragment>
{
  // Hue from cool to warm and value from 0.9 to 1.1, per tree.
  vec3 hue = mix(vec3(0.92, 0.96, 1.04), vec3(1.08, 1.03, 0.86), vFoliageSeed);
  // A leaf takes the lift; a petal keeps its cream (PETAL_GAIN).
  #ifdef FOLIAGE_PETALS
    float petal = smoothstep(${PETAL_FROM.toFixed(3)}, ${PETAL_TO.toFixed(3)}, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));
    float lift = mix(${FOLIAGE_GAIN.toFixed(2)}, uFoliagePetal, petal);
  #else
    float lift = ${FOLIAGE_GAIN.toFixed(2)};
  #endif
  diffuseColor.rgb *= hue * (0.9 + 0.2 * fract(vFoliageSeed * 7.31)) * lift;
  // THE BOUGAINVILLEA, AS A PLANT (the paid audit of 2026-10-04, passes 3 and
  // 11: "uncontrolled local color ... collectively they can become visually
  // loud"). Lifted like a leaf, its bracts printed as pure signal red: the
  // loudest colour in every frame of the garden. A bract in the shade of its
  // own bush is a deep crimson, and most of the bush is leaf.
  #ifdef FOLIAGE_BLOOM
    float bl = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    diffuseColor.rgb = mix(vec3(bl), diffuseColor.rgb, ${BLOOM_LIGHT.sat.toFixed(2)}) * vec3(0.62, 0.6, 0.66);
  #endif
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
  reflectedLight.directDiffuse += through * uFoliageSunColor * ${TRANSLUCENCY.toFixed(3)} * uFoliageGlow * (back + wrap);
  // Over the layout, the middle distance's crowns in the sun on their tops as well
  // (their shading normals are bent out of the crown: up, at its top). Not the
  // near ones: the frame's foot and left stay dark, and the words stand there.
  float crownTop = max(0.0, dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)));
  reflectedLight.directDiffuse += through * uFoliageSunColor * uFoliageTop * crownTop * crownTop * smoothstep(105.0, 170.0, length(vViewPosition));
  // The bougainvillea's two lights, drawn toward each other (BLOOM_LIGHT).
  #ifdef FOLIAGE_BLOOM
    reflectedLight.directDiffuse *= uBloomSun;
    reflectedLight.indirectDiffuse *= uBloomShade;
  #endif
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
      const petals = PETAL_RE.test(mat.name);
      const bloom = BLOOM_RE.test(mat.name);
      mat.defines = {
        ...(mat.defines ?? {}),
        ESTATE_FOLIAGE: '',
        ...(frond ? { FOLIAGE_FROND: '' } : {}),
        ...(petals ? { FOLIAGE_PETALS: '' } : {}),
        ...(bloom ? { FOLIAGE_BLOOM: '' } : {}),
      };
      const prev = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        shader.uniforms.uFoliageTime = foliageUniforms.uTime;
        shader.uniforms.uFoliageWind = foliageUniforms.uWind;
        shader.uniforms.uFoliageSunDir = foliageUniforms.uSunDir;
        shader.uniforms.uFoliageSunColor = foliageUniforms.uSunColor;
        shader.uniforms.uFoliageGlow = foliageUniforms.uGlow;
        shader.uniforms.uFoliageTop = foliageUniforms.uTop;
        shader.uniforms.uFoliagePetal = foliageUniforms.uPetal;
        shader.uniforms.uBloomSun = foliageUniforms.uBloomSun;
        shader.uniforms.uBloomShade = foliageUniforms.uBloomShade;
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', `uniform float uFoliageTime;\nuniform float uFoliageWind;\nvarying float vFoliageSeed;\n${WIND_GUST}\nvoid main() {`)
          .replace('#include <begin_vertex>', FOLIAGE_VERTEX);
        shader.fragmentShader = shader.fragmentShader
          .replace(
            'void main() {',
            'uniform vec3 uFoliageSunDir;\nuniform vec3 uFoliageSunColor;\nuniform float uFoliageGlow;\nuniform float uFoliageTop;\nuniform float uFoliagePetal;\nuniform float uBloomSun;\nuniform float uBloomShade;\nvarying float vFoliageSeed;\nvoid main() {',
          )
          .replace('#include <color_fragment>', FOLIAGE_TINT)
          .replace('#include <alphatest_fragment>', FOLIAGE_COVERAGE)
          .replace('#include <lights_fragment_end>', FOLIAGE_TRANSLUCENCY);
      };
      mat.customProgramCacheKey = () => `estate-foliage${frond ? '-frond' : ''}${petals ? '-petals' : ''}${bloom ? '-bloom' : ''}`;
      mat.needsUpdate = true;
    }
  });
  return done.size;
}

/** The low sun through the crowns over the layout, as a multiple: the founder's
 *  frame lights its middle distance from behind, yellow-green on dark. */
const LAYOUT_GLOW = 1.6;
/** And on the crowns' tops: his middle distance is lit from above as well, where
 *  a sun this low lights a crown only on its far side. */
const LAYOUT_TOP = 0.28;

const toSun = new THREE.Vector3();
const at = new THREE.Vector3();

/** Follow the key light: its direction and its colour times intensity. */
export function followSun(light: THREE.DirectionalLight | null, dt: number): void {
  foliageUniforms.uTime.value += dt;
  const stillShoot = typeof window !== 'undefined' && (window as unknown as { __estateStillShoot?: boolean }).__estateStillShoot === true;
  foliageUniforms.uWind.value =
    sceneWarm.hold > 0 || stillShoot ? 0 : Math.min(1, foliageUniforms.uWind.value + Math.max(0, dt) / WIND_IN_S);
  const layout = layoutAir(journeyState.leg, journeyState.legProgress, !!journeyState.film);
  foliageUniforms.uGlow.value = (1 - GLOW_EVENING_LOSS * filmState.evening) * (1 + (ld('layoutGlow', LAYOUT_GLOW) - 1) * layout) * (1 - 0.55 * filmState.noon) * ld('leafGlow', LEAF_GLOW);
  foliageUniforms.uTop.value = ld('layoutTop', LAYOUT_TOP) * layout * (1 - filmState.evening);
  foliageUniforms.uBloomSun.value = ld('bloomSun', BLOOM_LIGHT.sun);
  foliageUniforms.uBloomShade.value = ld('bloomShade', BLOOM_LIGHT.shade);
  foliageUniforms.uPalmThrough.value = ld('palmThrough', PALM_LIGHT.through);
  foliageUniforms.uPalmLeaf.value = ld('palmLeaf', PALM_LIGHT.leaf);
  foliageUniforms.uPalmTrunk.value = ld('palmTrunk', PALM_LIGHT.trunk);
  foliageUniforms.uPalmChroma.value = ld('palmChroma', PALM_LIGHT.chroma);
  if (!light) return;
  light.updateMatrixWorld();
  light.target.updateMatrixWorld();
  toSun.setFromMatrixPosition(light.matrixWorld).sub(at.setFromMatrixPosition(light.target.matrixWorld));
  if (toSun.lengthSq() > 1e-6) foliageUniforms.uSunDir.value.copy(toSun.normalize());
  foliageUniforms.uSunColor.value.copy(light.color).multiplyScalar(light.intensity);
}
