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
//   THE PORTRAIT'S GLASS took the hall's reflection probe at a gain above a
//   wall's, at glass roughness, so the chandelier and the picture light rode on
//   it and the painting sat BEHIND something (it no longer does: see THE GLASS,
//   below). It keeps the frame's depth-in-alpha intact (see
//   LensFocus.keepDepthAlpha) — a pane folding its opacity into the depth made
//   the lens and the occlusion read the painting as nearer than its frame.
//
//   THE PAINTING gets a varnish: a little sheen, so the picture light gleams
//   on it the way it does on oil under varnish, rather than on paper.
//
// THE FOURTH ART-DIRECTION CRITIQUE (2026-09-30): "The photo is clearly a flat
// 2D studio shot. The lighting on the man's face completely ignores the
// dramatic, hazy 3D lighting of the room ... It looks literally cut-and-pasted."
// Its brief: "color-graded to match the exact color temperature, shadows, and
// haziness of the interior 3D room", and "a real physical photograph behind
// glass, catching a reflection from the window". So:
//
//   THE PRINT (PORTRAIT_GRADE) is graded as a photographic print hung in this
//   room is: its dyes a little quieter than a screen's, warmed toward the
//   room's lamps; its whites held below its paper, the way a print's are, so
//   the studio's even light stops glaring; falling off toward its edges as
//   a print under a picture light does; a shade brighter on the side the
//   clerestory lights. And the room's air in front of it (PORTRAIT_HAZE): the
//   same warm veil the far walls stand behind, so the canvas sits IN the room
//   rather than on the screen.
//
//   THE GLASS reflected what is in front of it: the great arched window over
//   the entry and the two beside it, glazing bars and all, and the picture
//   lamp's bar, each by a reflected ray so the window slid across the pane as
//   the camera climbed. THE CLIENT HAD IT TAKEN OFF (2026-10-01: "remove this
//   reflection on founder's image"): on the climb the window lay across the
//   sitter's face. The pane is museum glass now — a breath of the room's sheen
//   at a low gain (hallProbe.PROBE_GAIN), rough enough to carry no picture of
//   anything — and the print behind it is clear from edge to edge.

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

/**
 * THE RUNNER IS NAVY. The second art-direction audit (2026-09-30): "the red
 * carpet on the stairs feels generic". Red carpet up a white stair is the hotel
 * lobby's idiom. The woven map is kept — its weave, its border, every value in
 * it — and only its hue is changed, to the house's own ink navy (the film's
 * #0A1120 family): each texel keeps its luminance and takes the navy's
 * chromaticity, so the pattern is exactly as it was, dyed.
 */
export const RUNNER_COLOUR = /* glsl */ `
#include <color_fragment>
{
  float tuft = pileNoise(vPileWorld / 0.04);
  float mottle = pileNoise(vPileWorld / 0.35 + 5.0);
  diffuseColor.rgb *= 0.9 + 0.1 * tuft + 0.06 * mottle;
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 ink = vec3(0.16, 0.22, 0.42);
  ink /= dot(ink, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = ink * lum * 1.15;
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

/** The print: dyes, warmth, highlights held under the paper, falloff, side. */
export const PORTRAIT_GRADE = /* glsl */ `
#include <map_fragment>
{
  vec3 c = diffuseColor.rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(lum), c, 0.84);
  c *= vec3(1.04, 0.985, 0.9);
  c = c * 1.32 / (1.0 + 0.62 * c);
  vec2 q = (vMapUv - vec2(0.5, 0.48)) * vec2(1.0, 0.82);
  c *= 1.0 - 0.36 * smoothstep(0.2, 0.64, length(q));
  c *= 0.87 + 0.13 * smoothstep(0.1, 0.9, vMapUv.x);
  diffuseColor.rgb = c;
}
`;

/** The room's air in front of the canvas, after the light. */
export const PORTRAIT_HAZE = /* glsl */ `
#include <opaque_fragment>
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.055, 0.047, 0.038), 0.11);
`;

/** The pane over the print: museum glass, which shows a sheen and no image. */
export const PORTRAIT_GLASS = { roughness: 0.45, opacity: 0.06 } as const;

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
        // No reflected windows, no lamp bar (see THE GLASS, above): a pane that
        // is there, over a print that is not veiled by it.
        mat.roughness = PORTRAIT_GLASS.roughness;
        mat.metalness = 0;
        mat.opacity = Math.min(mat.opacity, PORTRAIT_GLASS.opacity);
        if (mat.transparent) keepDepthAlpha(mat);
      } else if (mat.name === PAINTING) {
        // Oil under varnish: a soft sheen, not gloss.
        mat.roughness = 0.34;
        mat.metalness = 0;
        const prev = mat.onBeforeCompile;
        mat.onBeforeCompile = (shader, renderer) => {
          prev.call(mat, shader, renderer);
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <map_fragment>', PORTRAIT_GRADE)
            .replace('#include <opaque_fragment>', PORTRAIT_HAZE);
        };
        mat.customProgramCacheKey = () => 'portrait-print';
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
