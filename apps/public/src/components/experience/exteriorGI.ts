// apps/public/src/components/experience/exteriorGI.ts
//
// THE LIGHT THE SUN DOES NOT BRING DIRECTLY, BAKED.
//
// The brief of 2026-11-01: "switch from real-time lighting to baked global illumination
// ... so every balustrade, window arch, cornice and tree base has soft, photorealistic
// shadow depth", and hours "using blended lightmaps". The frames it was written from
// are true: on the house's shaded flank at the revolution the stone was one flat brown,
// because all that lit it was a hemisphere and an environment that know nothing of what
// stands round them.
//
// tools/blender/bake_estate_gi_v7.py bakes three quantities, once, and they are mixed
// here by the hour, so one map serves every frame of the film:
//
//   R  the sun's light after its first hit, on stone and lawn: multiplied by the key
//      light as it is now, it goes down with the sun, and a lit lawn throws its warmth
//      up a shaded wall until there is no sun to do it.
//   G  the lamps' and the lit rooms' light: multiplied by lampsOn().
//   B  (the atlas only) what the occlusion map does not know: the sky lost to anything
//      more than six metres off, and what comes back round a corner from lit stone.
//
// The real-time sun stays: its shadow is sharp, it follows the hour, and it is what the
// approved frames are lit by. All this reads is what is left.
//
// ON THE ATLASES it rides in the emissive slot, whose factor is black (nothing else in
// the file has a second light map's slot: tools/gltf/attach_gi_maps.py), so it is read
// here and the emissive chunk is dropped: its one fetch is the only cost.
//
// ON THE ORNAMENT (balusters, window trim, dentils: too many tiny faces for an atlas) it
// is per corner, in the colour attribute: (1 - occlusion, sqrt(bounce), sqrt(lamps)). A
// mesh under the same material with no such attribute reads zero: open, and unlit by
// anything but the real-time lights, as it always was.

import * as THREE from 'three';
import { ld } from './lookdev';

/**
 * The look. `range` is the bake's GI_BOUNCE_RANGE and `rest` its 1.25: these two are the
 * file's. `bounce` is how much of the sun's bounce is taken against the bake's own
 * (a little over the truth: the lawn in the bake is the file's, paler than the site's
 * print, and the fill is doing part of this job already), and its `tint` the lit lawn's
 * and the stone's warmth, the bake keeping one channel for it. `lamps` is the lit lamps'
 * strength at full on, and their colour the lamps' 2700 K.
 */
export const GI = {
  range: 0.25,
  rest: 1.25,
  bounce: 1.2,
  tint: [1.0, 0.9, 0.72] as const,
  lamps: 2.2,
  lampTint: [1.0, 0.62, 0.32] as const,
  /**
   * "Deep contact shadows tucked beneath the rooftop balustrade, inside the recessed
   * window arches, and along the stone cornices" (the user's reference): the occlusion
   * taken a little past the truth, as an exponent on what is left. A print's darks are
   * deeper than a lambert's.
   */
  deep: 0.9,
} as const;

export const giUniforms = {
  /** The sun's irradiance, as its bounce takes it. */
  uGiBounce: { value: new THREE.Color(0, 0, 0) },
  uGiLamps: { value: new THREE.Color(0, 0, 0) },
  /** How much of channel B is taken (a look-dev switch: 1 in the film). */
  uGiRest: { value: 1 },
  /** How much harder the shelter of a cornice, a reveal, a baluster bites. */
  uGiDeep: { value: GI.deep as number },
};

/** Once a frame: the light as it stands now. */
export function followGI(sun: THREE.DirectionalLight | null, lamps: number): void {
  const b = ld('giBounce', GI.bounce) * GI.range;
  if (sun) {
    const k = sun.intensity * b;
    giUniforms.uGiBounce.value.setRGB(sun.color.r * k * GI.tint[0], sun.color.g * k * GI.tint[1], sun.color.b * k * GI.tint[2]);
  } else {
    giUniforms.uGiBounce.value.setRGB(0, 0, 0);
  }
  const l = ld('giLamps', GI.lamps) * lamps;
  giUniforms.uGiLamps.value.setRGB(l * GI.lampTint[0], l * GI.lampTint[1], l * GI.lampTint[2]);
  giUniforms.uGiRest.value = ld('giRest', 1);
  giUniforms.uGiDeep.value = ld('giDeep', GI.deep);
}

const PARS = /* glsl */ `
uniform vec3 uGiBounce;
uniform vec3 uGiLamps;
uniform float uGiRest;
uniform float uGiDeep;
`;

/** After three has taken the occlusion off what the sky lit. */
const FROM_ATLAS = /* glsl */ `
#include <aomap_fragment>
{
  vec3 gi = texture2D( emissiveMap, vEmissiveMapUv ).rgb;
  reflectedLight.indirectDiffuse *= mix( 1.0, gi.b * ${GI.rest.toFixed(2)}, uGiRest );
  #ifdef USE_AOMAP
    reflectedLight.indirectDiffuse *= pow( max( ambientOcclusion, 0.02 ), uGiDeep );
  #endif
  reflectedLight.indirectDiffuse += ( uGiBounce * gi.r + uGiLamps * gi.g ) * BRDF_Lambert( material.diffuseColor );
}
`;

const FROM_CORNERS = /* glsl */ `
#include <aomap_fragment>
{
  float giOpen = 1.0 - vGiCorner.r;
  reflectedLight.indirectDiffuse *= pow( max( giOpen, 0.02 ), 1.0 + uGiDeep );
  reflectedLight.indirectSpecular *= mix( 1.0, giOpen, 0.7 );
  reflectedLight.indirectDiffuse += ( uGiBounce * vGiCorner.g * vGiCorner.g + uGiLamps * vGiCorner.b * vGiCorner.b ) * BRDF_Lambert( material.diffuseColor );
}
`;

const ATLAS_RE = /_AOG?$/;
const CORNERS_RE = /^MAT_Stone_(Trim|Boundary)/;

/**
 * Dress every material that carries the bake. After the surfaces (it chains onto the
 * stone's own occlusion chunk) and before the air. Returns how many of each.
 */
export function dressEstateGI(root: THREE.Object3D): { atlas: number; corners: number } {
  const count = { atlas: 0, corners: 0 };
  const done = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial & { __gi?: boolean };
      if (!mat || done.has(mat)) continue;
      done.add(mat);
      if (mat.__gi) continue;
      const atlas = !!mat.emissiveMap && ATLAS_RE.test(mat.name);
      const corners = !atlas && mat.vertexColors && CORNERS_RE.test(mat.name);
      if (!atlas && !corners) continue;
      mat.__gi = true;
      count[atlas ? 'atlas' : 'corners'] += 1;
      // The attribute is read here, as light: three would have multiplied the stone's
      // colour by it.
      if (corners) mat.vertexColors = false;
      const prev = mat.onBeforeCompile;
      const key = mat.customProgramCacheKey();
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        Object.assign(shader.uniforms, giUniforms);
        if (corners) {
          shader.vertexShader = shader.vertexShader
            .replace('void main() {', 'attribute vec4 color;\nvarying vec3 vGiCorner;\nvoid main() {')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGiCorner = color.rgb;');
        }
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', `${PARS}${corners ? 'varying vec3 vGiCorner;\n' : ''}void main() {`)
          .replace('#include <aomap_fragment>', atlas ? FROM_ATLAS : FROM_CORNERS);
        // (black by its factor, and read above)
        if (atlas) shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '');
      };
      mat.customProgramCacheKey = () => `${key}|gi-${atlas ? 'atlas' : 'corners'}`;
      mat.needsUpdate = true;
    }
  });
  return count;
}
