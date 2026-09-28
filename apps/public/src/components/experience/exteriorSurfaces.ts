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

const STONE = /* glsl */ `
#include <color_fragment>
{
  vec3 w = vAgeWorld;
  // Broad variation, warmer and cooler.
  float m1 = ageNoise(w / 4.0), m2 = ageNoise(w / 13.0 + 7.1);
  diffuseColor.rgb *= 1.0 + 0.07 * m1 + 0.05 * m2;
  diffuseColor.rgb *= mix(vec3(0.97, 0.99, 1.03), vec3(1.03, 1.0, 0.95), 0.5 + 0.5 * m2);
  // Rising damp and splash-back, with a ragged top.
  float edge = 1.3 + 0.35 * ageNoise(vec3(w.x + w.z, 0.0, w.z - w.x) * 0.9);
  float damp = 1.0 - smoothstep(0.1, edge, w.y);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.8, 0.79, 0.77), damp);
  // Rain streaking: noise stretched down the wall, faint.
  float streak = ageNoise(vec3((w.x + w.z) * 2.2, w.y * 0.12, (w.x - w.z) * 2.2));
  diffuseColor.rgb *= 1.0 - 0.06 * smoothstep(0.2, 0.9, streak);
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
        if (kind === 'stone') frag = frag.replace('#include <color_fragment>', STONE);
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
