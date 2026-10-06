// apps/public/src/components/experience/exteriorHaze.ts
//
// THE LAND DISSOLVES INTO THE SKY IT IS SEEN AGAINST, PIXEL BY PIXEL.
//
// The audit of 2026-10-05 (P2): "Soften the aerial's model look. The estate
// reads as sitting on an endless flat plane, with a hard fog band and a
// visible end to the boundary wall. Done when the horizon dissolves into air
// rather than stopping."
//
// The air already took the sky's colour (skyHaze.ts): the foot of the plate,
// by bearing. But three's fog is ONE colour a frame, so it was that band's
// mean across the camera's view — and from the height of the holdings frame
// the view takes in sixty degrees of horizon, with the sunset at one end of
// it. The far belt of trees, the end of the lawn and the top of the far wall
// all went to the mean: a grey-cream band, lighter than the sky on the side
// away from the sun and darker than it on the sun's side, with the tree
// line's outline cut along its top. That is the "hard fog band", and the
// plane "stopping" is its lower edge.
//
// Here every fragment is fogged toward THE SKY DIRECTLY BEHIND IT: the plate
// itself, read along the fragment's own line of sight — its bearing, and its
// height above the horizon, for the top of a far tree stands against sky five
// degrees up, which at sunset is not the colour of the sky's foot (tried with
// the foot alone first: the band's two ends matched the sky and its top edge
// still drew the tree line, lighter than the pink above it). Anything at or
// under the horizon takes the foot. The plate is read small (skyHaze.ts,
// skyHazeDome: two and a half degrees a texel): the air has no detail, and a
// far crown takes the sky's colour there, not its clouds. At the sky's
// strength for the hour, a tree at the edge of the world is then the sky
// behind it, and there is nothing left for an outline to be drawn in. The
// fog's distances are three's own, untouched.
//
// Until the plate has been read, the foot by bearing (skyHaze.ts,
// skyHazeRing) stands in for it: the same lookup, of a texture one texel tall.
//
// One pass over the estate's materials, after every other (it wraps whatever
// they compile to). A material that cannot say where its fragment is (no view
// position: a basic material, a sprite) keeps the frame's one colour.

import * as THREE from 'three';
import { skyHazeDome, skyHazeRing } from './skyHaze';

/** Shared by every hazed material: WorldCanvas writes the strength a frame. */
export const hazeUniforms = {
  /** The sky: the small copy of the plate (an equirectangular panorama) once
   *  it has been read, the foot's ring before. */
  uHazeRing: { value: null as THREE.Texture | null },
  /** The sky's strength for the hour times the haze's own gain. */
  uHazeGain: { value: 1 },
  /** 1 once the plate has been read; 0 keeps three's own fog colour. */
  uHazeOn: { value: 0 },
};

/** The height the sky's foot is read at, for anything at or under the
 *  horizon: the middle of the band the frame's one colour is the mean of
 *  (skyHaze.ts, HAZE_BAND_DEG). */
export const HAZE_FOOT_DEG = 2.2;
const HAZE_PARS = /* glsl */ `
uniform sampler2D uHazeRing;
uniform float uHazeGain;
uniform float uHazeOn;
void main() {`;

const HAZE_FOG = /* glsl */ `
#ifdef USE_FOG
	{
		// The fragment's bearing from the eye, in the world's axes; the plate is
		// read at u = atan2( z, x ) / 2pi + 0.5 (three's equirectangular lookup).
		vec3 hazeDir = normalize( ( vec4( -vViewPosition, 0.0 ) * viewMatrix ).xyz );
		// at or under the horizon: the sky's foot (${HAZE_FOOT_DEG} degrees up)
		float hazeUp = max( hazeDir.y, ${Math.sin((HAZE_FOOT_DEG * Math.PI) / 180).toFixed(5)} );
		vec2 hazeUv = vec2( atan( hazeDir.z, hazeDir.x ) * 0.15915494 + 0.5, asin( hazeUp ) * 0.31830989 + 0.5 );
		vec3 hazeColour = mix( fogColor, texture2D( uHazeRing, hazeUv ).rgb * uHazeGain, uHazeOn );
		#ifdef FOG_EXP2
			float hazeFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
		#else
			float hazeFactor = smoothstep( fogNear, fogFar, vFogDepth );
		#endif
		gl_FragColor.rgb = mix( gl_FragColor.rgb, hazeColour, hazeFactor );
	}
#endif`;

type Hazed = THREE.Material & { __haze?: boolean; isMeshStandardMaterial?: boolean; isMeshPhongMaterial?: boolean; isMeshLambertMaterial?: boolean; fog?: boolean };

/** Whether three gives this material's fragment shader its view position. */
function hasViewPosition(m: Hazed): boolean {
  return !!(m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial);
}

/**
 * Haze every fogged material under `root` toward the sky on its own bearing.
 * Idempotent (a material already hazed is left alone). Returns how many.
 */
export function dressHaze(root: THREE.Object3D): number {
  hazeUniforms.uHazeRing.value ??= skyHazeRing();
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as Hazed;
      if (!mat || mat.__haze || mat.fog === false || !hasViewPosition(mat)) continue;
      mat.__haze = true;
      n += 1;
      const prev = mat.onBeforeCompile;
      // What it compiled to before this pass, read NOW: three's default key is
      // the source of whatever onBeforeCompile is current, which after this
      // line is the same wrapper on every material.
      const key = mat.customProgramCacheKey();
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        if (!shader.fragmentShader.includes('#include <fog_fragment>')) return;
        shader.uniforms.uHazeRing = hazeUniforms.uHazeRing;
        shader.uniforms.uHazeGain = hazeUniforms.uHazeGain;
        shader.uniforms.uHazeOn = hazeUniforms.uHazeOn;
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', HAZE_PARS)
          .replace('#include <fog_fragment>', HAZE_FOG);
      };
      mat.customProgramCacheKey = () => `${key}|sky-haze`;
      mat.needsUpdate = true;
    }
  });
  return n;
}

/** The plate has been read (skyHaze.ts, readSkyHaze): the air is read from
 *  its small copy from now on. */
export function hazeFromPlate(): void {
  const dome = skyHazeDome();
  if (dome) hazeUniforms.uHazeRing.value = dome;
}

/**
 * WHERE THE LAND ENDS, AIR. The ground stops (the far plane takes it at 400 m)
 * and what stands behind its end is the sky plate — whose lower half is not
 * sky. From the film's high frames the eye is thirty metres up and the land's
 * end is four degrees UNDER the horizon: between the two the plate's underside
 * showed, a band darker than the haze the far trees had gone to, and the trees
 * stood against it in outline. That band is the "hard fog band" as much as the
 * fog's colour was.
 *
 * So the horizon wears a skirt: a ring round the camera, just inside the far
 * plane, from two degrees over the horizon down under the land's end, in the
 * colour the air is given at the sky's foot on each bearing — the colour every
 * far thing has already gone to. It is opaque under the horizon and thins to
 * nothing over the two degrees above it, where the plate's own foot takes
 * over. The land then ends in the same air the sky begins in.
 */
export const HORIZON_SKIRT = { radius: 360, over: 2.0, whole: -0.4, under: -32, segments: 96 } as const;

const SKIRT_NAME = 'estate_horizon';

export function horizonSkirt(root: THREE.Object3D): THREE.Mesh {
  const had = root.getObjectByName(SKIRT_NAME) as THREE.Mesh | undefined;
  if (had) return had;
  hazeUniforms.uHazeRing.value ??= skyHazeRing();
  const S = HORIZON_SKIRT;
  const rings = [
    { el: S.over, a: 0 },
    { el: S.whole, a: 1 },
    { el: S.under, a: 1 },
  ];
  const position: number[] = [];
  const alpha: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= S.segments; i += 1) {
    const t = (i / S.segments) * Math.PI * 2;
    for (const r of rings) {
      position.push(Math.cos(t) * S.radius, Math.tan((r.el * Math.PI) / 180) * S.radius, Math.sin(t) * S.radius);
      alpha.push(r.a);
    }
  }
  for (let i = 0; i < S.segments; i += 1) {
    for (let k = 0; k < rings.length - 1; k += 1) {
      const a = i * rings.length + k;
      const b = a + rings.length;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('skirtAlpha', new THREE.Float32BufferAttribute(alpha, 1));
  g.setIndex(index);
  const material = new THREE.ShaderMaterial({
    name: 'MAT_Horizon_Skirt',
    uniforms: {
      uHazeRing: hazeUniforms.uHazeRing,
      uHazeGain: hazeUniforms.uHazeGain,
      uHazeOn: hazeUniforms.uHazeOn,
    },
    vertexShader: /* glsl */ `
      attribute float skirtAlpha;
      varying float vAlpha;
      varying vec3 vDir;
      void main() {
        vAlpha = skirtAlpha;
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uHazeRing;
      uniform float uHazeGain;
      uniform float uHazeOn;
      varying float vAlpha;
      varying vec3 vDir;
      void main() {
        float u = atan( vDir.z, vDir.x ) * 0.15915494 + 0.5;
        float v = ${(HAZE_FOOT_DEG / 180 + 0.5).toFixed(5)};
        vec3 sky = texture2D( uHazeRing, vec2( u, v ) ).rgb * uHazeGain;
        gl_FragColor = vec4( sky, vAlpha * vAlpha * ( 3.0 - 2.0 * vAlpha ) * uHazeOn );
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(g, material);
  mesh.name = SKIRT_NAME;
  // First of the transparent things: everything else is in front of it.
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  root.add(mesh);
  return mesh;
}
