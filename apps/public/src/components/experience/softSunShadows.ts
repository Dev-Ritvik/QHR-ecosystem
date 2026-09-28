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
