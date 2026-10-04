// apps/public/src/components/experience/exteriorSurfaces.ts
//
// Age, on the surfaces that were new.
//
// THE REVIEW: "the stone facade uses a visibly repeating, tiled texture with
// zero weathering, dirt"; "the rigid geometric hedges lack individual leaf
// detail". Old money is not new: a real ashlar house is darker where the rain
// splashes back off the terrace, streaked under its sills, cleaner under the
// cornice, and no two stones of it are quite the same colour. All of it is
// drawn here in WORLD space, so none of it can repeat with the texture's tile:
//
//   STONE — rising damp and splash-back in the first metre and a half above
//   the ground, with a ragged upper edge; faint vertical rain streaking; two
//   octaves of broad variation (4 m, 13 m), warmer and cooler, that break the
//   tile's repeat at every distance the film holds.
//
//   ROOF SLATE — slate-to-slate value variation at a slate's size and broad
//   weathered patches, so the largest surface in the hero stops reading as one
//   grey sheet.
//
//   HEDGES — the box hedges were untextured boxes. Leaf-scale noise in colour
//   and in the normal (two octaves, 9 cm and 30 cm), darker and bluer at the
//   foot where the hedge shades itself, lighter at the clipped top. The box is
//   still a box — a clipped hedge is — but its surface now reads as leaves.

import * as THREE from 'three';

const NOISE = /* glsl */ `
float ageHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ageNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ageHash(i), ageHash(i + vec3(1, 0, 0)), f.x), mix(ageHash(i + vec3(0, 1, 0)), ageHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(ageHash(i + vec3(0, 0, 1)), ageHash(i + vec3(1, 0, 1)), f.x), mix(ageHash(i + vec3(0, 1, 1)), ageHash(i + vec3(1, 1, 1)), f.x), f.y), f.z) * 2.0 - 1.0;
}
varying vec3 vAgeWorld;
`;

/**
 * The ashlar of the upper wall: where its courses start (the top of the base
 * course, tools/blender/build_estate_v7.py BASE_TOP), a course's height and a
 * stone's length, the joint's width, all metres; how far a joint darkens and
 * how far one stone's tone stands from the next.
 */
export const ASHLAR = { from: 0.9, course: 0.38, stone: 0.92, joint: 0.008, depth: 0.2, tone: 0.022 } as const;

// THE SECOND PASS OF AGE (the third art-direction critique, 2026-09-30: "The
// materials need to look tactile ... realistic roughness and subtle
// imperfections"; in its frames the facade still read as one flat beige). The
// first pass was measured too faint to survive the print at the hero's
// distance. Now, besides a stronger broad patina:
//
//   GRIME IN THE SHELTER. Where the rain does not wash — under the cornice's
//   projection, in every reveal, sill and return — stone darkens. The bake
//   already knows exactly where that is (bake_estate_ao_v7.py): its occlusion
//   is sampled here into the COLOUR, not only the sky light, so the shelter of
//   each moulding reads in sun as well as in shade.
//
//   STREAKS UNDER THE LEDGES. The house's two continuous ledges — the string
//   course (underside 4.80 m) and the entablature (8.50 m), build_estate_v7.py —
//   shed their dirt down the WALL below them in uneven dribbles, longest where
//   the ledge drips most. Not down the trim: measured on the hero, the
//   portico's beam sits in the band under the string course and took the
//   dribbles as a row of dashes along its face.
//
//   A RAGGED, GREENER DAMP LINE at the foot, where splash-back and lichen
//   live, and rougher stone wherever it is dirty.
//
//   THE ASHLAR'S JOINTS (the refinement brief, 2026-10-03: at the approach's
//   distance "the mansion reads as ... a game/CG asset"; its audits: stone
//   with "no surface"). The upper wall is dressed ashlar, and it was drawn as
//   one unbroken skin, which is render plaster. Dressed stone is laid: courses
//   ASHLAR.course high, stones ASHLAR.stone long, breaking joint from one
//   course to the next, with a joint a few millimetres wide between them and
//   no two stones cut from quite the same bed. So the joints are drawn in
//   WORLD space, as wide as they are and no wider (a joint narrower than a
//   pixel is drawn at its share of the pixel, so the courses fade with
//   distance instead of aliasing), and each stone takes its own tone, a
//   couple of per cent either way. The client once called a facade of
//   patchwork stones "a skin disease": that was nine per cent a stone under a
//   pebbled normal. This is the quiet version of the same true thing.
const STONE = /* glsl */ `
#include <color_fragment>
float estateGrime = 0.0;
{
  vec3 w = vAgeWorld;
  #ifdef ESTATE_ASHLAR
  {
    // Which way the wall runs: along x on the fronts, along z on the flanks
    // (the face's own normal, from the world position's derivatives).
    vec3 fn = abs(cross(dFdx(w), dFdy(w)));
    float along = fn.z > fn.x ? w.x : w.z;
    float cy = (w.y - ${ASHLAR.from.toFixed(2)}) / ${ASHLAR.course.toFixed(4)};
    float course = floor(cy);
    float tt = along / ${ASHLAR.stone.toFixed(2)} + 0.5 * mod(course, 2.0);
    float fy = fract(cy), fx = fract(tt);
    float dh = min(fy, 1.0 - fy) * ${ASHLAR.course.toFixed(4)};
    float dv = min(fx, 1.0 - fx) * ${ASHLAR.stone.toFixed(2)};
    float px = max(length(fwidth(w)), 1.0e-4);
    float half_ = ${(ASHLAR.joint / 2).toFixed(4)};
    float joint = clamp((half_ + 0.5 * px - min(dh, dv)) / px, 0.0, 1.0);
    // A level wall only: no courses on a sill's top or a soffit.
    float upright = 1.0 - smoothstep(0.2, 0.5, fn.y / max(fn.x + fn.y + fn.z, 1.0e-6));
    float stone = ageHash(vec3(course, floor(tt), fn.z > fn.x ? 1.0 : 2.0));
    float seen = 1.0 - smoothstep(0.25, 0.6, px / ${ASHLAR.course.toFixed(4)});
    diffuseColor.rgb *= 1.0 + ${ASHLAR.tone.toFixed(3)} * (stone * 2.0 - 1.0) * seen * upright;
    diffuseColor.rgb *= 1.0 - ${ASHLAR.depth.toFixed(2)} * joint * upright;
  }
  #endif
  // Broad patina, warmer and cooler, stone to stone.
  float m1 = ageNoise(w / 4.0), m2 = ageNoise(w / 13.0 + 7.1);
  diffuseColor.rgb *= 1.0 + 0.1 * m1 + 0.07 * m2;
  diffuseColor.rgb *= mix(vec3(0.95, 0.985, 1.04), vec3(1.05, 1.0, 0.92), 0.5 + 0.5 * m2);
  // Grime in the shelter, from the baked occlusion.
  #ifdef USE_AOMAP
    float shelter = 1.0 - texture2D(aoMap, vAoMapUv).r;
    estateGrime = max(estateGrime, smoothstep(0.06, 0.5, shelter) * (0.8 + 0.2 * m1));
  #endif
  // Streaks under the string course and the entablature: a dribble per few
  // centimetres of ledge, each its own length.
  #ifndef ESTATE_TRIM
  {
    float lane = ageNoise(vec3((w.x + w.z) * 3.4, 0.0, (w.x - w.z) * 3.4));
    float fall = 0.9 + 1.1 * (0.5 + 0.5 * lane);
    float below = 0.0;
    float d1 = 4.8 - w.y;
    float d2 = 8.5 - w.y;
    if (d1 > 0.0 && d1 < 2.6) below = max(below, 1.0 - smoothstep(0.05, fall, d1));
    if (d2 > 0.0 && d2 < 2.6) below = max(below, 1.0 - smoothstep(0.05, fall * 1.15, d2));
    float dribble = smoothstep(-0.25, 0.55, ageNoise(vec3((w.x + w.z) * 6.5, w.y * 0.6, (w.x - w.z) * 6.5)));
    estateGrime = max(estateGrime, below * dribble * 0.6);
  }
  #endif
  // Faint rain streaking over the whole face.
  float streak = ageNoise(vec3((w.x + w.z) * 2.2, w.y * 0.12, (w.x - w.z) * 2.2));
  diffuseColor.rgb *= 1.0 - 0.07 * smoothstep(0.2, 0.9, streak);
  // Grime is darker and a little cooler, never black.
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.7, 0.69, 0.67), estateGrime);
  // Rising damp and splash-back, with a ragged top, greener at the foot.
  float edge = 1.25 + 0.45 * ageNoise(vec3(w.x + w.z, 0.0, w.z - w.x) * 0.9);
  float damp = 1.0 - smoothstep(0.1, edge, w.y);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.74, 0.75, 0.69), damp);
  estateGrime = max(estateGrime, damp * 0.7);
}
`;

/**
 * WHAT FACES THE SKY IS WEATHERED. The trim is honed (ExteriorModel, POLISH:
 * a soft sheen of the sky down every shaft and moulding), and a honed face
 * that lies level under a low sun, seen from the far side of it, is a mirror
 * at a grazing angle: on the revolve (leg 0.26 to 0.34, the sun 14 degrees up
 * behind the house) the top of every roof balustrade rail and pedestal cap
 * printed as a white strip, 2,458 pixels of the 1920 frame above a luma of
 * 225 — strip lighting along a parapet. MEASURED on the running build: with
 * the trim's roughness at full they are gone (289 pixels, the stone sunlit
 * and warm), and with the sun off there are none, so it is the sun's glint
 * and nothing in the stone's own light.
 *
 * A coping, a rail's top and a sill take the rain, the frost and the lichen
 * first; no mason's finish survives a season on them. So a face that looks at
 * the sky is as rough as weathered stone, by its own slope (`from`..`to` of
 * the face's upward share), and every upright face keeps its hone.
 */
export const SKY_FACE = { from: 0.5, to: 0.85, rough: 0.94 } as const;

// Dirty stone is matte: roughness follows the grime and the patina. The face's
// own normal is taken from the world position's derivatives, which point at
// the eye: a soffit seen from below looks down, and is left alone.
const STONE_ROUGH = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + 0.16 * estateGrime + 0.05 * ageNoise(vAgeWorld / 4.0), 0.04, 1.0);
{
  vec3 faceUp = normalize(cross(dFdx(vAgeWorld), dFdy(vAgeWorld)));
  float toSky = smoothstep(${SKY_FACE.from.toFixed(2)}, ${SKY_FACE.to.toFixed(2)}, faceUp.y);
  roughnessFactor = mix(roughnessFactor, max(roughnessFactor, ${SKY_FACE.rough.toFixed(2)}), toSky);
}
`;

const SLATE = /* glsl */ `
#include <color_fragment>
{
  vec3 w = vAgeWorld;
  float slate = ageHash(floor(vec3(w.x * 2.6, w.y * 3.6, w.z * 2.6)));
  float weather = ageNoise(w / 6.0);
  diffuseColor.rgb *= (0.88 + 0.24 * slate) * (1.0 + 0.1 * weather);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 1.04, 0.92), 0.4 * smoothstep(0.3, 0.9, weather));
}
`;

const HEDGE_COLOUR = /* glsl */ `
#include <color_fragment>
{
  vec3 w = vAgeWorld;
  float leaf = ageNoise(w / 0.09), clump = ageNoise(w / 0.3 + 3.3), broad = ageNoise(w / 3.0);
  diffuseColor.rgb *= 0.78 + 0.22 * leaf + 0.18 * clump + 0.08 * broad;
  // Holes between leaves read as darker, bluer shade.
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.62, 0.7), smoothstep(0.35, 0.8, -leaf) * 0.8);
  // Shaded at the foot, lit at the clipped top.
  diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.0, 0.45, w.y)) * (1.0 + 0.12 * smoothstep(0.35, 0.9, w.y));
}
`;

const HEDGE_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
{
  vec3 w = vAgeWorld;
  float e = 0.03;
  vec3 g = vec3(ageNoise((w + vec3(e, 0, 0)) / 0.09) - ageNoise((w - vec3(e, 0, 0)) / 0.09),
                ageNoise((w + vec3(0, e, 0)) / 0.09) - ageNoise((w - vec3(0, e, 0)) / 0.09),
                ageNoise((w + vec3(0, 0, e)) / 0.09) - ageNoise((w - vec3(0, 0, e)) / 0.09));
  float fw = length(fwidth(w));
  float keep = 1.0 - smoothstep(0.03, 0.12, fw);
  normal = normalize(normal + (viewMatrix * vec4(g * 0.9 * keep, 0.0)).xyz);
}
`;

type Kind = 'stone' | 'slate' | 'hedge';
const RULES: { re: RegExp; kind: Kind }[] = [
  { re: /^MAT_Stone_(Wall|Trim|Rustic)(_AOG?)?$/, kind: 'stone' },
  { re: /^MAT_Roof(_Slate)?(_AO)?$/, kind: 'slate' },
  { re: /^MAT_Hedge$/, kind: 'hedge' },
];

/** Dress the estate's stone, roof and hedges. Returns how many per kind. */
export function dressSurfaces(root: THREE.Object3D): Record<Kind, number> {
  const count: Record<Kind, number> = { stone: 0, slate: 0, hedge: 0 };
  const done = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial & { __aged?: boolean };
      if (!mat || mat.__aged || done.has(mat)) continue;
      const rule = RULES.find((r) => r.re.test(mat.name));
      if (!rule) continue;
      mat.__aged = true;
      done.add(mat);
      count[rule.kind] += 1;
      const kind = rule.kind;
      // The trim takes the stone's age but not the wall's ledge streaks.
      if (kind === 'stone' && /Trim/.test(mat.name)) mat.defines = { ...(mat.defines ?? {}), ESTATE_TRIM: '' };
      // And the wall alone is laid in courses: the trim is carved, the base is
      // rusticated in its own geometry.
      if (kind === 'stone' && /Wall/.test(mat.name)) mat.defines = { ...(mat.defines ?? {}), ESTATE_ASHLAR: '' };
      const prev = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', 'varying vec3 vAgeWorld;\nvoid main() {')
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vAgeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
          );
        let frag = shader.fragmentShader.replace('void main() {', `${NOISE}\nvoid main() {`);
        if (kind === 'stone') {
          frag = frag
            .replace('#include <color_fragment>', STONE)
            .replace('#include <roughnessmap_fragment>', STONE_ROUGH);
        }
        if (kind === 'slate') frag = frag.replace('#include <color_fragment>', SLATE);
        if (kind === 'hedge') {
          frag = frag
            .replace('#include <color_fragment>', HEDGE_COLOUR)
            .replace('#include <normal_fragment_maps>', HEDGE_NORMAL);
        }
        shader.fragmentShader = frag;
      };
      // Per kind; three still keys the aoMap/normalMap variants apart by
      // their own parameters.
      mat.customProgramCacheKey = () => `estate-aged-${kind}`;
      mat.needsUpdate = true;
    }
  });
  return count;
}
