// apps/public/src/components/experience/softSunShadows.ts
//
// Contact-hardening sun shadows (PCSS), installed into three's shadow chunk.
//
// THE REVIEW: "long, soft shadows". A uniform PCF kernel blurs every shadow by
// the same few centimetres, so the cornice line on the wall and the tip of a
// palm's shadow forty metres across the lawn have the same edge — which is the
// single most recognisable signature of a shadow map. The sun is not a point:
// it is half a degree wide, so a shadow's penumbra grows with the distance
// between the thing casting it and the thing it falls on. Sharp where a column
// meets the terrace, soft at the end of a long shadow. That is what this is.
//
// THE MODEL, for this light and no other. The only shadow-casting light in the
// app is the exterior key (the hall is lightmapped and casts nothing), an
// orthographic sun whose camera spans 156 m across and 340 m deep. In that
// camera depth is linear, so a blocker-to-receiver gap of dz (in [0,1] depth)
// is dz * 340 m along the ray, and the sun's 0.53 degree disc spreads it into a
// penumbra of dz * 340 * tan(0.53 deg) metres. Over 156 m of shadow map that is
//
//     radius (texels) = dz * 0.5 * 340 * 0.00925 / 156 * mapSize * SOFTEN
//
// with SOFTEN 1.5: a touch softer than the sun alone, the way a long lens and a
// little haze render it. At the hero's scale that puts a 40 cm penumbra at the
// end of a palm's shadow and a 1-texel edge under the portico's cornice. The
// map size comes in as getShadow's own `shadowMapSize`, so the mid tier's
// 2048 map gets the same penumbra in metres at half the texels.
//
// WHY A MODULE-LOAD PATCH AND NOT drei's <SoftShadows>. drei's component
// installs the same idea on mount and then, to force a recompile, disposes
// every material in the scene and truncates three's program cache — materials
// this app shares with drei's cached GLTF parse, and a cache three still holds
// references into. Installed here, before the first frame compiles anything,
// there is nothing to recompile and nothing to dispose. The PCSS search and
// filter are after drei's (N8Programs; Vogel disk, rotated per pixel).
//
// Low tier renders with shadows off, so it never compiles this code at all.

import * as THREE from 'three';

const MARK = '/* estate: pcss sun */';

/**
 * The exterior key's shadow camera — the single source for both the light's
 * props (WorldCanvas) and the penumbra model below, so the two cannot drift.
 * A tight ortho box round the estate: the default frustum spans the whole
 * scene including a 660 m ground plane and gives shadows thumbnail resolution.
 */
export const SUN_SHADOW_CAMERA = { left: -78, right: 78, top: 70, bottom: -70, near: 1, far: 340 } as const;

/**
 * The golden-hour sun, in world metres from the house: 14 degrees up on the
 * front-right bearing. (WorldCanvas re-exports it; the full account of why it
 * stands there is on its re-export.)
 */
export const DAY_SUN: readonly [number, number, number] = [86, 25, 50];

/**
 * WHEN THE SUN'S SHADOW MAP IS DRAWN. Not every frame: when what is in it can
 * have changed.
 *
 * The sun stands still, its shadow camera is a fixed box round the estate, and
 * of the 1.85 million triangles that cast into it (the tree belt alone is 1.1
 * million) the only ones that ever move are the two leaves of the front door.
 * The trees sway in the picture but not in their shadows: the depth pass does
 * not run the wind. Drawn sixty times a second regardless, the map was a
 * quarter of the frame on an integrated GPU — MEASURED 2026-10-04 on a Radeon
 * 780M at 1920x1080 with the frame-rate limit off: 59.0, 60.2 and 63.5 frames
 * a second at the cover, over the garden and at the door, and 77.7, 80.5 and
 * 74.8 with the map held. At 59 to 63 the film is at the edge of a 60 Hz
 * panel; the softened stone and the avenue's palms (about 0.4 ms) had taken
 * its last margin.
 *
 * So the map is drawn: for a second and a half after the light is mounted
 * (the estate may still be arriving, and its meshes are merged after they
 * load); on every frame of a passage through the door and for half a second
 * after it; whenever it has no map (a change of tier disposes it); and, as a
 * net under anything not foreseen here, twice a second.
 */
export const SUN_SHADOW_CADENCE = { onMount: 90, afterDoor: 30, every: 30 } as const;

/** The cadence's state: frames still owed a draw, and frames counted. */
export interface SunShadowState {
  owed: number;
  frame: number;
}

/**
 * Whether the sun's shadow map is drawn on this frame (and count the frame).
 * `moving`: something that casts into it is moving (the door's leaves);
 * `noMap`: the light has no shadow map yet.
 */
export function sunShadowDue(st: SunShadowState, moving: boolean, noMap: boolean): boolean {
  st.frame += 1;
  if (moving) st.owed = Math.max(st.owed, SUN_SHADOW_CADENCE.afterDoor);
  if (noMap) st.owed = Math.max(st.owed, 2);
  if (st.owed > 0) {
    st.owed -= 1;
    return true;
  }
  return st.frame % SUN_SHADOW_CADENCE.every === 0;
}

/** The sun's angular diameter, and how much softer than it the lens renders. */
const SUN_DIAMETER_RAD = (0.53 * Math.PI) / 180;
const SOFTEN = 1.5;

/** Penumbra radius per unit of shadow depth, per texel of map width:
 *  0.5 * (far - near) * tan(sun) / (right - left) * SOFTEN. ~0.0151. */
export const PCSS_SPREAD =
  (0.5 * (SUN_SHADOW_CAMERA.far - SUN_SHADOW_CAMERA.near) * Math.tan(SUN_DIAMETER_RAD) * SOFTEN) /
  (SUN_SHADOW_CAMERA.right - SUN_SHADOW_CAMERA.left);
/** Blocker search radius in texels; also the cap on the filter radius. */
export const PCSS_SEARCH = 12;
export const PCSS_SAMPLES = 12;

const PCSS = /* glsl */ `${MARK}
#define PCSS_SAMPLES ${PCSS_SAMPLES}
#define PCSS_SPREAD ${PCSS_SPREAD.toFixed(6)}
#define PCSS_SEARCH ${PCSS_SEARCH.toFixed(1)}
float pcssNoise( vec2 p ) {
  // Interleaved gradient noise: decorrelated per pixel, and far less clumpy
  // than a sin-hash at the same cost.
  return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) );
}
vec2 pcssVogel( int i, float phi ) {
  float r = sqrt( ( float( i ) + 0.5 ) / float( PCSS_SAMPLES ) );
  float t = float( i ) * 2.39996323 + phi;
  return r * vec2( cos( t ), sin( t ) );
}
// textureLod, not texture2D: an implicit-gradient read inside a loop is what
// ANGLE's D3D backend warns about (X3595), and the shadow map has no mips.
float pcssSun( sampler2D map, vec2 mapSize, vec4 coord, float intensity ) {
  vec2 texel = 1.0 / mapSize;
  float phi = pcssNoise( gl_FragCoord.xy ) * 6.28318530718;
  float zR = coord.z;
  float blockers = 0.0;
  float depthSum = 0.0;
  for ( int i = 0; i < PCSS_SAMPLES; i ++ ) {
    vec2 o = pcssVogel( i, phi ) * texel * PCSS_SEARCH;
    float d = unpackRGBAToDepth( textureLod( map, coord.xy + o, 0.0 ) );
    if ( d < zR ) { depthSum += d; blockers += 1.0; }
  }
  if ( blockers < 0.5 ) return 1.0;
  float zB = depthSum / blockers;
  float radius = clamp( ( zR - zB ) * PCSS_SPREAD * mapSize.x, 1.0, PCSS_SEARCH );
  float lit = 0.0;
  for ( int i = 0; i < PCSS_SAMPLES; i ++ ) {
    vec2 o = pcssVogel( i, phi + 1.7 ) * texel * radius;
    lit += step( zR, unpackRGBAToDepth( textureLod( map, coord.xy + o, 0.0 ) ) );
  }
  return mix( 1.0, lit / float( PCSS_SAMPLES ), intensity );
}
`;

const HEAD = '#ifdef USE_SHADOWMAP';
/** getShadow()'s last line. getPointShadow() ends the same way, later in the
 *  chunk, and String.replace with a string pattern takes the first only. */
const TAIL = 'return mix( 1.0, shadow, shadowIntensity );';

/**
 * Patch three's directional/spot shadow lookup to PCSS. Idempotent (HMR, a
 * second import), and a no-op with a console warning if three's chunk ever
 * stops containing the two anchors, so an upgrade degrades to plain PCF rather
 * than to a shader that does not compile.
 */
export function installSoftSunShadows(): boolean {
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  if (chunk.includes(MARK)) return true;
  // Look-dev A/B: ?pcss=0 keeps three's own PCF, read once at module load.
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pcss') === '0') {
    return false;
  }
  const getShadowAt = chunk.indexOf('float getShadow(');
  if (!chunk.includes(HEAD) || getShadowAt < 0 || chunk.indexOf(TAIL) < getShadowAt) {
    // eslint-disable-next-line no-console
    console.warn('[pcss] three shadow chunk changed shape; keeping PCF');
    return false;
  }
  THREE.ShaderChunk.shadowmap_pars_fragment = chunk
    .replace(HEAD, `${HEAD}\n${PCSS}`)
    // getShadow's own return, re-pointed at PCSS. Not an early return inside
    // the frustum test: that leaves a path ANGLE's D3D compiler reports as a
    // potentially uninitialised return (X4000), once per shadow-receiving
    // program on every load. three's PCF result is now unused and compiled
    // out. getPointShadow() keeps its own filter.
    .replace(
      TAIL,
      'return mix( 1.0, frustumTest ? pcssSun( shadowMap, shadowMapSize, shadowCoord, 1.0 ) : 1.0, shadowIntensity );',
    );
  return true;
}

// ── CLOUD SHADOWS ──────────────────────────────────────────────────────────
//
// THE SECOND ART-DIRECTION AUDIT (2026-09-30) asked for the scrims behind the
// copy to go — "the 3D scene is art-directed to have natural 'quiet zones'
// (shadows, sky, negative space) where typography can sit" — and for "dramatic
// shadows". The hero's copy stands over the pool terrace and the lawn west of
// the house, which a sun low on the front-right lights squarely: no position of
// the sun both lights the front of the house and shades the ground in front of
// it to the left. A cloud does. So the sun's light passes through a field of
// broken cloud on its way to the estate: soft-edged patches of shade across the
// land, one of them lying over the pool terrace, and none on the house, which
// holds the light — the photograph an architectural photographer waits an
// afternoon for.
//
// A cloud's shadow is a projection along the sun's rays, and so is the sun's
// shadow map: its coordinate IS the place a ray crosses the cloud layer. The
// field is drawn in that coordinate (in metres across the shadow camera), so
// every surface — ground, trees, water, stone — takes the same shade along the
// same ray, with no extra varying and no extra pass. It is static: a scroll
// film has no clock a cloud could keep.

/** The sun camera's axes (a directional light's shadow camera looks from its
 *  position at the origin, up +y), and a world point's place across it. */
function sunSpace(p: readonly [number, number, number]): [number, number] {
  const z = new THREE.Vector3(...DAY_SUN).normalize();
  const x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const v = new THREE.Vector3(...p);
  return [v.dot(x), v.dot(y)];
}

/**
 * Where the house holds the light: everything east of this line in sun space,
 * which is the house's centre block, its east wing and its spire. The pool
 * terrace lies along the same sun rays as the house's WEST end (measured: the
 * pool at sun-space x -16, the west front corner at -19), so a cloud that
 * shades the terrace must also take the west wing — as a real one would — and
 * its soft edge crosses the house there, sun on the portico, shade on the wing.
 */
const HOUSE_SUN_X = sunSpace([-7.5, 0, 13.25])[0];

/** The cloud over the hero's copy: the pool terrace, west of the house. */
const TERRACE_CLOUD = sunSpace([-27, 0.4, 3]);

/**
 * AND ONE OVER THE EVENING'S COPY. The holdings chapter looks from behind the
 * house toward the low sun, down onto the lawn north-east of it, which the sun
 * lights head-on — the third art-direction critique's frame had the figures and
 * the gloss over a lit field (clean plate: p90 luma 186 under the gloss). Raycast
 * through the chapter's copy block (its left column, y 0.56..0.90) at every beat
 * from 0.40 to 0.625, the ground under the words stays inside sun-space x 12..48,
 * y -20..7: one cloud covers the chapter. The field above stays west of the
 * house; this one is placed east of it, clear of every ray that reaches the
 * house (HOUSE_RAYS), so the house keeps its evening light and the lawn under
 * the words falls into shade.
 */
const LAWN_CLOUD = sunSpace([38, 0, -12.5]);
/** The rays that reach the house, as a box in sun space: its corners' span,
 *  from HOUSE_SUN_X (the west wing's end is the terrace cloud's to shade). */
const HOUSE_RAYS = (() => {
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const X of [-15.5, 15.5])
    for (const Y of [0, 20.4])
      for (const Z of [-10.3, 13.25]) {
        const [sx, sy] = sunSpace([X, Y, Z]);
        x1 = Math.max(x1, sx);
        y0 = Math.min(y0, sy);
        y1 = Math.max(y1, sy);
      }
  return { x0: HOUSE_SUN_X, x1, y0, y1 };
})();

const f3 = (v: number) => v.toFixed(3);
const CLOUD = /* glsl */ `
float estateCloudHash( vec2 p ) {
  vec3 q = fract( vec3( p.xyx ) * vec3( 0.1031, 0.1030, 0.0973 ) );
  q += dot( q, q.yzx + 33.33 );
  return fract( ( q.x + q.y ) * q.z );
}
float estateCloudNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( estateCloudHash( i ), estateCloudHash( i + vec2( 1.0, 0.0 ) ), f.x ),
              mix( estateCloudHash( i + vec2( 0.0, 1.0 ) ), estateCloudHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
// The light that gets through: 1 in the open, CLOUD_SHADE under a cloud.
float estateCloud( vec2 uv ) {
  // metres across the sun camera
  vec2 m = ( uv - 0.5 ) * vec2( ${f3(SUN_SHADOW_CAMERA.right - SUN_SHADOW_CAMERA.left)}, ${f3(SUN_SHADOW_CAMERA.top - SUN_SHADOW_CAMERA.bottom)} );
  vec2 q = m * 0.022;
  float n = 0.55 * estateCloudNoise( q ) + 0.3 * estateCloudNoise( q * 2.13 + 7.1 ) + 0.15 * estateCloudNoise( q * 4.7 + 3.3 );
  // broken cloud, about a third of the sky
  float cover = smoothstep( 0.5, 0.64, n );
  // the terrace's own cloud, its edge the field's
  vec2 t = ( m - vec2( ${f3(TERRACE_CLOUD[0] - 6)}, ${f3(TERRACE_CLOUD[1])} ) ) / vec2( 12.0, 16.0 );
  cover = max( cover, smoothstep( 1.0, 0.45, length( t ) + ( n - 0.5 ) * 0.7 ) );
  // and none on the house's centre and east
  cover *= smoothstep( 0.0, 3.0, ${f3(HOUSE_SUN_X)} - m.x );
  // the evening lawn's cloud, east of the house and off every ray to it
  vec2 l = ( m - vec2( ${f3(LAWN_CLOUD[0])}, ${f3(LAWN_CLOUD[1])} ) ) / vec2( 21.0, 15.0 );
  float lawn = smoothstep( 1.0, 0.45, length( l ) + ( n - 0.5 ) * 0.7 );
  float onHouse = smoothstep( ${f3(HOUSE_RAYS.x0 - 3)}, ${f3(HOUSE_RAYS.x0)}, m.x )
                * ( 1.0 - smoothstep( ${f3(HOUSE_RAYS.x1)}, ${f3(HOUSE_RAYS.x1 + 3)}, m.x ) )
                * smoothstep( ${f3(HOUSE_RAYS.y0 - 3)}, ${f3(HOUSE_RAYS.y0)}, m.y )
                * ( 1.0 - smoothstep( ${f3(HOUSE_RAYS.y1)}, ${f3(HOUSE_RAYS.y1 + 3)}, m.y ) );
  cover = max( cover, lawn * ( 1.0 - onHouse ) );
  return 1.0 - 0.8 * cover;
}
`;

const CLOUD_MARK = '/* estate: cloud shadows */';
const DIR_SHADOW_LINE =
  'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';

/**
 * Install the cloud field: its functions beside the shadow lookup, and its
 * shade on the SUN only — the directional loop, after the sun's own shadow.
 * Every directional light in this app is the sun; the hall has none. Only
 * where shadows are on (the low tier renders without them, and without these).
 * Idempotent, and a warned no-op if three's chunks change shape.
 */
export function installCloudShadows(): boolean {
  const pars = THREE.ShaderChunk.shadowmap_pars_fragment;
  const begin = THREE.ShaderChunk.lights_fragment_begin;
  if (begin.includes(CLOUD_MARK)) return true;
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('clouds') === '0') {
    return false;
  }
  if (!pars.includes(HEAD) || !begin.includes(DIR_SHADOW_LINE)) {
    // eslint-disable-next-line no-console
    console.warn('[clouds] three light chunks changed shape; no cloud shadows');
    return false;
  }
  THREE.ShaderChunk.shadowmap_pars_fragment = pars.replace(HEAD, `${HEAD}\n${CLOUD}`);
  THREE.ShaderChunk.lights_fragment_begin = begin.replace(
    DIR_SHADOW_LINE,
    `${DIR_SHADOW_LINE}\n\t\t${CLOUD_MARK}\n\t\tdirectLight.color *= estateCloud( vDirectionalShadowCoord[ i ].xy );`,
  );
  // AND SOME OF THE SKY. At a 14-degree sun a pale horizontal surface is lit
  // mostly by the sky, not the sun (the sun reaches it at cos 76 degrees), so a
  // cloud taking the sun alone darkened the pool terrace by 13 levels in 255:
  // nothing. Under a real cloud the sky is dimmer too. After the sky's light is
  // gathered and before the occlusion, the shade takes 55% of the diffuse
  // skylight and 40% of its reflection where the cloud is full.
  THREE.ShaderChunk.lights_fragment_end =
    THREE.ShaderChunk.lights_fragment_end +
    `
#if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 )
\t{
\t\tfloat estateShade = 1.0 - estateCloud( vDirectionalShadowCoord[ 0 ].xy );
\t\treflectedLight.indirectDiffuse *= 1.0 - 0.69 * estateShade;
\t\treflectedLight.indirectSpecular *= 1.0 - 0.5 * estateShade;
\t}
#endif
`;
  return true;
}
