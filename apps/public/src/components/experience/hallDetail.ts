// apps/public/src/components/experience/hallDetail.ts
//
// The last metre of the hall's materials: the stair runner's pile, and the
// founder's portrait as an object behind glass.
//
// THE SECOND CLIENT REVIEW: "the red carpet on the stairs [uses] visibly
// low-resolution, repeating textures without any bump-mapping to simulate ...
// fabric fibers"; "the framed portrait ... lacks physical depth, glass
// reflections ... It appears as a flat 2D image pasted flush against the wall."
//
//   THE RUNNER keeps its woven map and gains what a map at stair-runner scale
//   cannot hold: tufts (4 cm, value and normal), pile (1 cm, normal only,
//   faded out before it can shimmer), and the one thing that makes wool read
//   as wool at any distance — a velvet sheen, brighter where the pile is seen
//   along its length, at a grazing angle. All in world space, so none of it
//   repeats with the texture.
//
//   THE PORTRAIT'S GLASS reflects the room: it takes the hall's reflection
//   probe (hallProbe.PROBE_GAIN) at a gain above a wall's, at glass roughness,
//   so the chandelier and the picture light ride on it and the painting sits
//   BEHIND something. It keeps the frame's depth-in-alpha intact (see
//   LensFocus.keepDepthAlpha) — a pane folding its opacity into the depth made
//   the lens and the occlusion read the painting as nearer than its frame.
//
//   THE PAINTING gets a varnish: a little sheen, so the picture light gleams
//   on it the way it does on oil under varnish, rather than on paper.

import * as THREE from 'three';
import { keepDepthAlpha } from './LensFocus';

const RUNNER_RE = /^MAT_Runner(_LM)?$/;
const GLASS = 'MAT_PortraitGlass';
const PAINTING = 'MAT_Portrait';

export const RUNNER_FRAGMENT_DECL = /* glsl */ `
varying vec3 vPileWorld;
float pileHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float pileNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(pileHash(i), pileHash(i + vec3(1, 0, 0)), f.x), mix(pileHash(i + vec3(0, 1, 0)), pileHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(pileHash(i + vec3(0, 0, 1)), pileHash(i + vec3(1, 0, 1)), f.x), mix(pileHash(i + vec3(0, 1, 1)), pileHash(i + vec3(1, 1, 1)), f.x), f.y), f.z) * 2.0 - 1.0;
}
`;

export const RUNNER_COLOUR = /* glsl */ `
#include <color_fragment>
{
  float tuft = pileNoise(vPileWorld / 0.04);
  float mottle = pileNoise(vPileWorld / 0.35 + 5.0);
  diffuseColor.rgb *= 0.9 + 0.1 * tuft + 0.06 * mottle;
}
`;

export const RUNNER_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
{
  vec3 w = vPileWorld;
  float fw = length(fwidth(w));
  vec3 g = vec3(0.0);
  float e = 0.004;
  // tufts, then pile; each dropped as it shrinks toward a pixel
  float kt = 1.0 - smoothstep(0.012, 0.04, fw);
  float kp = 1.0 - smoothstep(0.003, 0.012, fw);
  g += kt * 0.7 * vec3(pileNoise((w + vec3(e, 0, 0)) / 0.04) - pileNoise((w - vec3(e, 0, 0)) / 0.04),
                       pileNoise((w + vec3(0, e, 0)) / 0.04) - pileNoise((w - vec3(0, e, 0)) / 0.04),
                       pileNoise((w + vec3(0, 0, e)) / 0.04) - pileNoise((w - vec3(0, 0, e)) / 0.04));
  g += kp * 0.5 * vec3(pileNoise((w + vec3(e, 0, 0)) / 0.01) - pileNoise((w - vec3(e, 0, 0)) / 0.01),
                       pileNoise((w + vec3(0, e, 0)) / 0.01) - pileNoise((w - vec3(0, e, 0)) / 0.01),
                       pileNoise((w + vec3(0, 0, e)) / 0.01) - pileNoise((w - vec3(0, 0, e)) / 0.01));
  normal = normalize(normal + (viewMatrix * vec4(g, 0.0)).xyz);
}
`;

/** Velvet: pile seen along its length is lighter. Added to the outgoing light. */
export const RUNNER_SHEEN = /* glsl */ `
#include <lights_fragment_end>
{
  float grazing = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
  reflectedLight.indirectDiffuse += diffuseColor.rgb * grazing * 0.55;
}
`;

/** Dress the runner, the portrait glass and the painting. Returns what it touched. */
export function dressHallDetail(root: THREE.Object3D): string[] {
  const done = new Set<THREE.Material>();
  const names: string[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial & { __hallDetail?: boolean };
      if (!mat || mat.__hallDetail || done.has(mat) || !mat.isMeshStandardMaterial) continue;
      if (RUNNER_RE.test(mat.name)) {
        const prev = mat.onBeforeCompile;
        mat.onBeforeCompile = (shader, renderer) => {
          prev.call(mat, shader, renderer);
          shader.vertexShader = shader.vertexShader
            .replace('void main() {', 'varying vec3 vPileWorld;\nvoid main() {')
            .replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>
               vPileWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
            );
          shader.fragmentShader = shader.fragmentShader
            .replace('void main() {', `${RUNNER_FRAGMENT_DECL}\nvoid main() {`)
            .replace('#include <color_fragment>', RUNNER_COLOUR)
            .replace('#include <normal_fragment_maps>', RUNNER_NORMAL)
            .replace('#include <lights_fragment_end>', RUNNER_SHEEN);
        };
        mat.customProgramCacheKey = () => 'hall-runner-pile';
        mat.roughness = Math.max(mat.roughness, 0.92);
      } else if (mat.name === GLASS) {
        mat.roughness = 0.02;
        mat.metalness = 0;
        mat.opacity = Math.max(mat.opacity, 0.16);
        if (mat.transparent) keepDepthAlpha(mat);
      } else if (mat.name === PAINTING) {
        // Oil under varnish: a soft sheen, not gloss.
        mat.roughness = 0.34;
        mat.metalness = 0;
      } else {
        continue;
      }
      mat.__hallDetail = true;
      mat.needsUpdate = true;
      done.add(mat);
      names.push(mat.name);
    }
  });
  return names;
}
