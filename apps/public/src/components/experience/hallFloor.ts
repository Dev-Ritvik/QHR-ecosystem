// apps/public/src/components/experience/hallFloor.ts
//
// THE FLOOR, LAID IN SLABS.
//
// int_floor is one 19.8 x 15.4 m quad carrying one marble texture that repeats
// every 2 m. A repeating texture on a single sheet is the cheapest-looking
// floor there is: the same vein comes round ninety times, and there is no
// joint anywhere to say what size the stone is.
//
// A hall like this is laid in large slabs, so the floor is re-cut in the shader:
//
//   * SLABS of 1.1 m. The room is exactly 18 x 14 of them (19.8 / 1.1 and
//     15.4 / 1.1), so every wall meets a whole slab and the long axis runs down
//     a joint line's centre, the way a setter would lay it.
//   * EACH SLAB IS ITS OWN PIECE OF STONE. Its texture coordinates are offset
//     and turned by a quarter-turn multiple from a hash of the slab's index, so
//     no two neighbours show the same veining and the repeat disappears. A
//     small per-slab tone shift says they came off different blocks.
//   * HAIRLINE JOINTS, 2.5 mm, antialiased by their own screen derivative:
//     darker, and rough — grout is not polished, so the reflections break at
//     every joint, which is what makes a polished floor read as tiles rather
//     than as a mirror.
//
// The marble is sampled with textureGrad against the ORIGINAL continuous UVs,
// so the per-slab jumps in the coordinates never pick a wrong mip at a joint.
//
// AND NO VEIN COMES ROUND TWICE (the audit of 2026-10-05, P0 and P2: "the
// marble floor visibly repeats ... done when it reads as continuous stone").
// A slab was one window onto a texture two metres square, turned and moved:
// 252 windows onto four square metres of stone, so the one strong vein in
// those four metres was in sight a dozen times in any wide frame, turned
// about — and the eye finds a shape it has seen however it is turned. And
// each slab took its own tone, nine per cent apart at the extremes: a
// chequerboard under the veining.
//
//   * TWO PIECES OF THE STONE IN EVERY SLAB, laid into each other along a
//     soft, wandering boundary that is the slab's own: no slab shows a whole
//     window any more, so no figure in the texture survives whole to be
//     recognised. (The boundary is a noise, sharpened to a seam a hand wide:
//     a blend any softer greys the veins out where the two overlap.)
//   * THE TONE DRIFTS ACROSS THE ROOM, a few metres to a swell, as one lot of
//     stone does, and a slab departs from it by a couple of per cent: enough
//     for the joints to say the floor is laid, not enough to chequer it.

import * as THREE from 'three';

const FLOOR_MATERIAL = 'MAT_MarbleFloor_LM';
export const SLAB = 1.1;
/** The second piece of stone in a slab is read this much larger than the
 *  first, so the two never show one figure at one size. */
const SECOND_SCALE = 1.31;
/** World metres per unit of the floor's own UVs (measured: 19.8 m spans 9.9). */
const UV_METRES = 2.0;

type Floored = THREE.MeshStandardMaterial & { __hallFloor?: boolean };

export function dressFloor(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as Floored;
    if (Array.isArray(mat) || !mat || mat.name !== FLOOR_MATERIAL || mat.__hallFloor) return;
    mat.__hallFloor = true;
    n += 1;
    const prior = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, renderer) => {
      prior?.call(mat, shader, renderer);
      // Includes are still unexpanded at this point, so the map chunk is
      // substituted whole, with its one sampling line re-cut.
      const SAMPLE = 'vec4 sampledDiffuseColor = texture2D( map, vMapUv );';
      const mapChunk = THREE.ShaderChunk.map_fragment.replace(
        SAMPLE,
        /* glsl */ `#ifdef HALL_PROBE
		vec4 sampledDiffuseColor = mix(
			textureGrad( map, slabUv, dFdx( vMapUv ), dFdy( vMapUv ) ),
			textureGrad( map, slabUvB, dFdx( vMapUv ) * ${SECOND_SCALE.toFixed(2)}, dFdy( vMapUv ) * ${SECOND_SCALE.toFixed(2)} ),
			slabMix
		);
		sampledDiffuseColor.rgb *= slabTone * mix( 1.0, 0.55, joint );
	#else
		${SAMPLE}
	#endif`,
      );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_fragment>', mapChunk)
        .replace(
          'void main() {',
          /* glsl */ `
float hallHash( vec2 p ) {
	p = fract( p * vec2( 123.34, 456.21 ) );
	p += dot( p, p + 45.32 );
	return fract( p.x * p.y );
}
float hallNoise( vec2 p ) {
	vec2 i = floor( p );
	vec2 f = fract( p );
	f = f * f * ( 3.0 - 2.0 * f );
	return mix(
		mix( hallHash( i ), hallHash( i + vec2( 1.0, 0.0 ) ), f.x ),
		mix( hallHash( i + vec2( 0.0, 1.0 ) ), hallHash( i + vec2( 1.0, 1.0 ) ), f.x ),
		f.y
	);
}
void main() {
#ifdef HALL_PROBE
	// Which slab, and where in it. vHallWorld comes with the probe (hallProbe.ts).
	vec2 slabCoord = ( vHallWorld.xz - HALL_BOX_MIN.xz ) / ${SLAB.toFixed(4)};
	vec2 slabId = floor( slabCoord );
	vec2 inSlab = fract( slabCoord );
	float hA = hallHash( slabId );
	float hB = hallHash( slabId + 17.13 );
	float hC = hallHash( slabId + 41.7 );
	// A quarter-turn multiple, then an offset anywhere in the 2 m repeat.
	vec2 q = inSlab - 0.5;
	float turn = floor( hA * 4.0 );
	q = turn < 1.0 ? q : turn < 2.0 ? vec2( -q.y, q.x ) : turn < 3.0 ? -q : vec2( q.y, -q.x );
	vec2 slabUv = ( q + 0.5 ) * ${(SLAB / UV_METRES).toFixed(4)} + vec2( hB, hC );
	// The second piece: mirrored, turned by its own quarter, a little larger.
	vec2 q2 = vec2( -( inSlab.x - 0.5 ), inSlab.y - 0.5 );
	float turn2 = floor( hallHash( slabId + 63.9 ) * 4.0 );
	q2 = turn2 < 1.0 ? q2 : turn2 < 2.0 ? vec2( -q2.y, q2.x ) : turn2 < 3.0 ? -q2 : vec2( q2.y, -q2.x );
	vec2 slabUvB = ( q2 + 0.5 ) * ${((SLAB / UV_METRES) * SECOND_SCALE).toFixed(4)} + vec2( hallHash( slabId + 91.3 ), hallHash( slabId + 29.6 ) );
	// Where one gives way to the other: the slab's own wandering line.
	float slabMix = smoothstep( 0.44, 0.56,
		0.65 * hallNoise( inSlab * 1.9 + slabId * 5.37 ) + 0.35 * hallNoise( inSlab * 4.3 + slabId * 2.11 + 9.0 ) );
	// Distance to the nearest joint, in metres, antialiased by its footprint.
	vec2 edge = min( inSlab, 1.0 - inSlab ) * ${SLAB.toFixed(4)};
	float jointDist = min( edge.x, edge.y );
	float jw = fwidth( jointDist ) + 1e-5;
	float joint = 1.0 - smoothstep( 0.00125 - jw, 0.00125 + jw, jointDist );
	float slabTone = ( 0.985 + 0.03 * hallHash( slabId + 7.7 ) )
		* ( 0.955 + 0.09 * hallNoise( vHallWorld.xz * 0.21 + 3.7 ) );
#endif
`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          /* glsl */ `#include <roughnessmap_fragment>
	#ifdef HALL_PROBE
		roughnessFactor = mix( roughnessFactor, 0.55, joint );
	#endif`,
        );
    };
    mat.customProgramCacheKey = () => 'hall-floor-slabs';
    mat.needsUpdate = true;
  });
  return n;
}
