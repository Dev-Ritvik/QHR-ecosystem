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
  /** The valley's mist: (how much at the ground, the height it thins by, the
   *  run it gathers over), metres. WorldCanvas writes it a frame (VALLEY_MIST). */
  uMist: { value: new THREE.Vector3(0, 8, 400) },
  /** Toward the sun (DAY_SUN, normalised), and the air's lobe about it:
   *  (sharpness, gain away from the sun, gain toward it). WorldCanvas writes
   *  the lobe a frame (HAZE_PHASE). */
  uHazeSun: { value: new THREE.Vector3(86, 25, 50).normalize() },
  uHazePhase: { value: new THREE.Vector3(1, 1, 1) },
  /** How far out from the eye the air begins, metres: 0 but where the film
   *  stands far back from its subject (WorldCanvas, SUBJECT_AIR), where it is
   *  how much further back than the cover it stands. The fog's own distances
   *  are moved out by the same, there. */
  uHazeFrom: { value: 0 },
  /** How far from the eye the land is drawn at all, metres: past the far plane
   *  but over the layout (WorldCanvas, SUBJECT_AIR.end), where the country's far
   *  hills would stand over the horizon in facets. */
  uHazeEnd: { value: 1e6 },
  /** And how high, metres, past 210 m from the eye: the same hills, nearer, where
   *  they rise over the camera's own height. */
  uHazeTop: { value: 1e6 },
  /** How much of the ground's own run of air is up, 0..1, over the layout: the
   *  land goes into the air (HAZE_GROUND_RUN, metres from the eye) well before
   *  the trees on it, so what is left of the country under the horizon has no
   *  outline against the skirt behind it, and the far trees stand in mist. */
  uHazeGround: { value: 0 },
  /** How much of the far ground's air goes dark at the blue hour, 0..1. The mist stands
   *  behind the trees there, and under them the land is the reference's dark: all the
   *  air's colour on it was a bright strip ruled under the far crowns. */
  uHazeLow: { value: 0 },
  /** How far what stood back for the layout has come back for the blue hour, 0..1
   *  (the avenue's palms: the reference has them; exteriorLayout.ts, standBack). */
  uHazeBack: { value: 0 },
  /** Which frame the dissolves are on, 0..63: their pattern moves on each frame,
   *  and the eye takes the moving pattern for a fade. */
  uHazeFrame: { value: 0 },
};

/** How dark the far ground's air goes at the blue hour, and over what run from the eye
 *  it is whole again (uHazeLow), metres. */
export const HAZE_LOW = { dark: 0.5, from: 300, to: 540 } as const;

/** Where the ground's own air begins and is whole (uHazeGround). */
export const HAZE_GROUND_RUN = [170, 265] as const;

/** The air's lobe about the sun by day (the concept built 1:1, 2026-10-27). */
export const HAZE_PHASE = { sharp: 3, away: 0.6, toward: 1.35 } as const;

/** The valley's mist by day (the concept built 1:1, 2026-10-27). */
// (the user's reference of 2026-11-01: "crisp atmospheric depth", the foreground's
// contrast rich, rather than "the entire scene in muddy yellow-brown fog". k was 0.55.)
export const VALLEY_MIST = { k: 0.26, kDusk: 0.55, height: 11, run: 450 } as const;

/** The height the sky's foot is read at, for anything at or under the
 *  horizon: the middle of the band the frame's one colour is the mean of
 *  (skyHaze.ts, HAZE_BAND_DEG). */
export const HAZE_FOOT_DEG = -0.2;
/** How much of a far thing's coming or going is left to the dissolve, once it has
 *  gone to the air's colour (HAZE_FOG). */
export const HAZE_AIR = 0.45;
/** How far from the eye a tree begins to go by way of the air and goes wholly so,
 *  metres, and how far into it. */
export const HAZE_TREE = { from: 80, whole: 120, air: 0.55 } as const;

const HAZE_PARS = /* glsl */ `
uniform sampler2D uHazeRing;
uniform float uHazeGain;
uniform float uHazeOn;
uniform vec3 uMist;
uniform vec3 uHazeSun;
uniform vec3 uHazePhase;
uniform float uHazeFrom;
uniform float uHazeEnd;
uniform float uHazeTop;
uniform float uHazeGround;
uniform float uHazeFrame;
uniform float uHazeBack;
uniform float uHazeLow;
void main() {`;

const HAZE_FOG = /* glsl */ `
#ifdef USE_FOG
	{
		#ifdef HAZE_CUT
			if ( dot( vViewPosition, vViewPosition ) > uHazeEnd * uHazeEnd ) discard;
		#endif
		// The fragment's bearing from the eye, in the world's axes; the plate is
		// read at u = atan2( z, x ) / 2pi + 0.5 (three's equirectangular lookup).
		vec3 hazeDir = normalize( ( vec4( -vViewPosition, 0.0 ) * viewMatrix ).xyz );
		#ifdef HAZE_CUT
			if ( dot( vViewPosition, vViewPosition ) > 44100.0 && cameraPosition.y + hazeDir.y * length( vViewPosition ) > uHazeTop ) discard;
		#endif
		// at or under the horizon: the sky's foot (${HAZE_FOOT_DEG} degrees up)
		float hazeUp = max( hazeDir.y, ${Math.sin((HAZE_FOOT_DEG * Math.PI) / 180).toFixed(5)} );
		#ifdef HAZE_GROUND
			hazeUp = mix( hazeUp, ${Math.sin((HAZE_FOOT_DEG * Math.PI) / 180).toFixed(5)}, uHazeGround );
		#endif
		vec2 hazeUv = vec2( atan( hazeDir.z, hazeDir.x ) * 0.15915494 + 0.5, asin( hazeUp ) * 0.31830989 + 0.5 );
		vec3 hazeColour = mix( fogColor, texture2D( uHazeRing, hazeUv ).rgb * uHazeGain, uHazeOn );
		#ifdef FOG_EXP2
			float hazeFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
		#else
			float hazeFactor = smoothstep( fogNear, fogFar, vFogDepth );
		#endif
		// AND THE VALLEY'S MIST (the concept built 1:1, 2026-10-27): denser
		// near the ground and thinning with height (uMist.y metres), gathered
		// over the run of the line of sight (uMist.z), so the forest's trunks
		// stand in it and its crowns stand clear.
		// (Gathered from where the air begins: uHazeFrom.)
		if ( uMist.x > 0.0 ) {
			float hazeLen = length( vViewPosition );
			float hazeRun = max( hazeLen - uHazeFrom, 0.0 );
			float hazeY = cameraPosition.y + hazeDir.y * hazeLen;
			float hazeMist = uMist.x * ( 1.0 - exp( - hazeRun / uMist.z ) ) * exp( - max( hazeY, 0.0 ) / uMist.y );
			hazeFactor = 1.0 - ( 1.0 - hazeFactor ) * ( 1.0 - hazeMist );
		}
		// WHAT STANDS FAR OFF COMES AND GOES BY WAY OF THE AIR. A dark crown going by the
		// dissolve alone stands against the lit mist as a pattern of dots for as
		// long as it takes (seen over the blue hour's mist, 2026-11-01). So first it
		// goes to the colour of the sky behind it, with no dissolve, and only then,
		// when there is nothing left to see, it is taken away.
		#ifdef HAZE_DISSOLVE
			float hazeWhole = 1.0 - uHazeGround;
			if ( fract( 52.9829189 * fract( dot( floor( gl_FragCoord.xy ) + 5.588238 * uHazeFrame, vec2( 0.06711056, 0.00583715 ) ) ) ) >= hazeWhole / ${HAZE_AIR.toFixed(2)} ) discard;
			hazeFactor = 1.0 - ( 1.0 - hazeFactor ) * smoothstep( ${HAZE_AIR.toFixed(2)}, 1.0, hazeWhole );
		#endif
		#ifdef HAZE_ARRIVE
			#ifdef HAZE_FAR
				// (a tree, part of the way and only far off: it may have another
				// tree behind it, and near the camera the dark land, and a crown in
				// the air's colour stood on them as a pale ghost)
				float hazeOff = smoothstep( ${HAZE_TREE.from.toFixed(1)}, ${HAZE_TREE.whole.toFixed(1)}, length( vViewPosition ) );
				if ( fract( 52.9829189 * fract( dot( floor( gl_FragCoord.xy ) + 5.588238 * uHazeFrame, vec2( 0.06711056, 0.00583715 ) ) ) ) >= mix( uHazeGround, uHazeGround / ${HAZE_AIR.toFixed(2)}, hazeOff ) ) discard;
				hazeFactor = 1.0 - ( 1.0 - hazeFactor ) * ( 1.0 - ${HAZE_TREE.air.toFixed(2)} * hazeOff * ( 1.0 - smoothstep( ${HAZE_AIR.toFixed(2)}, 1.0, uHazeGround ) ) );
			#else
				if ( fract( 52.9829189 * fract( dot( floor( gl_FragCoord.xy ) + 5.588238 * uHazeFrame, vec2( 0.06711056, 0.00583715 ) ) ) ) >= uHazeGround ) discard;
			#endif
		#endif
		#ifdef HAZE_LEAVE
			if ( fract( 52.9829189 * fract( dot( floor( gl_FragCoord.xy ) + 5.588238 * uHazeFrame, vec2( 0.06711056, 0.00583715 ) ) ) ) < uHazeGround * ( 1.0 - uHazeBack ) ) discard;
		#endif
		#ifdef HAZE_GROUND
			hazeFactor = 1.0 - ( 1.0 - hazeFactor ) * ( 1.0 - uHazeGround * smoothstep( ${HAZE_GROUND_RUN[0].toFixed(1)}, ${HAZE_GROUND_RUN[1].toFixed(1)}, length( vViewPosition ) ) );
			// (and whole again by the time it meets the skirt, so no line is drawn there)
			hazeColour *= mix( 1.0, ${HAZE_LOW.dark.toFixed(2)}, uHazeLow * ( 1.0 - smoothstep( ${HAZE_LOW.from.toFixed(1)}, ${HAZE_LOW.to.toFixed(1)}, length( vViewPosition ) ) ) );
		#endif
		// THE AIR IS LIT FROM ONE SIDE: air scatters the sun's light forward,
		// so the haze toward the sun glows and the haze away from it is dim,
		// and the forest on the frame's far side from the sun stays dark
		// through it (uHazePhase: the lobe's sharpness, the gain away, the gain
		// toward). Whole air (a far thing gone into it) is the plate's own
		// colour again, so the land still meets the sky behind it seamlessly.
		if ( uHazePhase.y != uHazePhase.z ) {
			float hazePhase = pow( clamp( dot( hazeDir, uHazeSun ) * 0.5 + 0.5, 0.0, 1.0 ), uHazePhase.x );
			vec3 hazeLit = hazeColour * mix( uHazePhase.y, uHazePhase.z, hazePhase );
			hazeColour = mix( hazeLit, hazeColour, hazeFactor * hazeFactor );
		}
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
      const ground = mesh.name === 'ground_plane';
      // (the forest's roof beyond is not drawn at all over the layout: from this
      // height it is shards, cut by uHazeEnd and uHazeTop. It goes by a dissolve,
      // far off and in the air as it is.)
      const roof = mat.name === 'MAT_Jungle_Canopy';
      // (Only what can stand out there is cut, and what already discards: a discard
      // costs the whole of a material its early depth, and the house has no need.)
      const cut = ground || roof || ((mat as Hazed & { alphaTest?: number }).alphaTest ?? 0) > 0;
      // (and what is the layout's comes and goes with its air: exteriorLayout.ts)
      const arrive = !!mat.userData?.arrive;
      const far = !!mat.userData?.far;
      const leave = !!mat.userData?.leave;
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
        shader.uniforms.uMist = hazeUniforms.uMist;
        shader.uniforms.uHazeSun = hazeUniforms.uHazeSun;
        shader.uniforms.uHazePhase = hazeUniforms.uHazePhase;
        shader.uniforms.uHazeFrom = hazeUniforms.uHazeFrom;
        shader.uniforms.uHazeEnd = hazeUniforms.uHazeEnd;
        shader.uniforms.uHazeTop = hazeUniforms.uHazeTop;
        shader.uniforms.uHazeGround = hazeUniforms.uHazeGround;
        shader.uniforms.uHazeFrame = hazeUniforms.uHazeFrame;
        shader.uniforms.uHazeLow = hazeUniforms.uHazeLow;
        shader.uniforms.uHazeBack = mat.userData?.back ? hazeUniforms.uHazeBack : { value: 0 };
        shader.fragmentShader = shader.fragmentShader
          .replace(
            'void main() {',
            `${cut ? '#define HAZE_CUT\n' : ''}${ground ? '#define HAZE_GROUND\n' : ''}${roof ? '#define HAZE_DISSOLVE\n' : ''}${arrive ? '#define HAZE_ARRIVE\n' : ''}${far ? '#define HAZE_FAR\n' : ''}${leave ? '#define HAZE_LEAVE\n' : ''}${HAZE_PARS}`,
          )
          .replace('#include <fog_fragment>', HAZE_FOG);
      };
      mat.customProgramCacheKey = () => `${key}|sky-haze${cut ? '-cut' : ''}${ground ? '-ground' : ''}${roof ? '-roof' : ''}${arrive ? '-arrive' : ''}${far ? '-far' : ''}${leave ? '-leave' : ''}`;
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
 * WHERE THE LAND ENDS, AIR. The ground stops (the far plane takes it) and what
 * stands behind its end is the sky plate — whose lower half is not sky. From
 * the film's high frames the eye is thirty metres up and the land's
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
 *
 * ONLY IF THE LAND HAS GONE TO THAT AIR BEFORE IT GETS THERE (the creative
 * director's audit, 2026-10-27: "a dead-flat green plane ... meeting a sharp,
 * artificial horizon line"). The skirt stood at 360 m, the land at +/-330 m
 * and the far plane at 400; once the day's fog was opened to 500 m (the
 * Feature 1 brief) the land reached the skirt three-quarters hazed, and the
 * skirt drew a line under it. So now: the country runs to +/-900 m
 * (build_estate_v7.py, COUNTRY_REACH), the skirt stands past the day fog's
 * far, and the far plane past the skirt — the land is whole haze where it
 * meets the skirt, from every camera in the film. (A ridge of far hills was
 * tried on the skirt, over the horizon, the same day: drawn in the air's
 * colour it came out a flat band ruled across the sky, lighter than the sky
 * above it, which was the line this was meant to take away. It is not here.)
 */
export const HORIZON_SKIRT = { radius: 560, over: 2.0, whole: -0.4, under: -32, segments: 96 } as const;
/** The camera's far plane outside (WorldCanvas CLIP): just behind the skirt. */
export const EXTERIOR_FAR = 620;

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
