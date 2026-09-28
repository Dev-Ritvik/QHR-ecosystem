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

import * as THREE from 'three';

const FLOOR_MATERIAL = 'MAT_MarbleFloor_LM';
export const SLAB = 1.1;
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
		vec4 sampledDiffuseColor = textureGrad( map, slabUv, dFdx( vMapUv ), dFdy( vMapUv ) );
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
	// Distance to the nearest joint, in metres, antialiased by its footprint.
	vec2 edge = min( inSlab, 1.0 - inSlab ) * ${SLAB.toFixed(4)};
	float jointDist = min( edge.x, edge.y );
	float jw = fwidth( jointDist ) + 1e-5;
	float joint = 1.0 - smoothstep( 0.00125 - jw, 0.00125 + jw, jointDist );
	float slabTone = 0.95 + 0.09 * hallHash( slabId + 7.7 );
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
