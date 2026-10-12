// apps/public/src/components/experience/exteriorArris.ts
//
// AN EASED ARRIS, SEEN FROM WHERE THE CAMERA STANDS.
//
// The estate's dressed stone has its knife edges taken off: a flat chamfer a
// centimetre wide along the arrises of the portico, the steps, the terraces
// and the dressings round the door (tools/blender/build_estate_v7.py,
// ease_arrises; the refinement brief of 2026-10-03, "close camera positions do
// not expose ... overly clean edges"). The pages that open on the portico and
// the pool stand three to five metres from that stone, where a centimetre is
// three pixels, and there the chamfer is what the brief asked for: the narrow
// face that catches the light along a plinth.
//
// The film never stands that close. A pixel is 1.5 cm of the house from the
// door and 4 cm from the cover, and this frame cannot be multisampled
// (PostFX.tsx: its alpha is the scene's depth), so a face under a pixel wide
// is drawn where a pixel's centre falls on it and nowhere else. A chamfer that
// looks up and toward the sun is brighter than both the faces it joins: from
// the cover it was a dotted pale line along every plinth under the columns,
// the platform's edge and the cheek walls' caps (found by a ray through the
// dashes, 2026-10-12; the forensic audit of 2026-10-09, #5, has the family:
// "thin features break into stair-steps and dotted lines").
//
// So the model ships each chamfer wearing the normal of the face it was cut
// from (wear_neighbour_normals), and its occlusion is that face's already
// (bake_estate_ao_v7.py): from any distance it is the same stone as the face
// beside it, to the last pixel, and cannot dash. Here the stone's material
// gives it back its own facet when a pixel is finer than the chamfer: the
// facet's normal is the surface's own, from the view position's derivatives,
// which three uses for flat shading and which is exact to the triangle's edge.
// Nothing is flagged in the mesh. A chamfer is known by the normal it wears
// standing well apart from its facet's (45 degrees; turned work, a baluster
// or an urn, is within a few degrees of its facets and is left alone).

import * as THREE from 'three';

/**
 * `near`/`far`: the size of a pixel on the surface, metres, under which a
 * chamfer is its own facet and over which it is its neighbour (the chamfers
 * are 8 to 16 mm wide: build_estate_v7.py, ARRISES). `apart`: the cosine
 * between a corner's normal and its facet's under which the face is a chamfer.
 */
export const ARRIS = { near: 0.004, far: 0.009, apart: 0.9 } as const;

/** Every dressed-stone material: the eased objects wear several of them. */
export const ARRIS_RE = /^MAT_Stone_/;

/** The line of three's normal_fragment_begin that reads the corner's normal. */
export const ARRIS_ANCHOR = 'vec3 normal = normalize( vNormal );';

export const ARRIS_NORMAL = /* glsl */ `vec3 normal = normalize( vNormal );
	{
		// (as three's own flat shading takes it: the view position is negated)
		vec3 arrisFacet = normalize( cross( dFdx( vViewPosition ), dFdy( vViewPosition ) ) );
		if ( dot( normal, arrisFacet ) < ${ARRIS.apart.toFixed(2)} ) {
			float arrisPx = length( fwidth( vViewPosition ) );
			normal = normalize( mix( arrisFacet, normal, smoothstep( ${ARRIS.near.toFixed(4)}, ${ARRIS.far.toFixed(4)}, arrisPx ) ) );
		}
	}`;

/** three's chunk with the corner's normal read through ARRIS_NORMAL. */
export function arrisChunk(chunk: string = THREE.ShaderChunk.normal_fragment_begin): string {
  if (!chunk.includes(ARRIS_ANCHOR)) {
    throw new Error("exteriorArris: three's normal_fragment_begin no longer reads the normal as expected");
  }
  return chunk.replace(ARRIS_ANCHOR, ARRIS_NORMAL);
}

/** Give the estate's stone its eased arrises back at close range. Returns how
 *  many materials were dressed. */
export function dressArrises(root: THREE.Object3D): number {
  const done = new Set<THREE.Material>();
  const chunk = arrisChunk();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial & { __arris?: boolean };
      if (!mat || done.has(mat) || !mat.isMeshStandardMaterial || !ARRIS_RE.test(mat.name)) continue;
      done.add(mat);
      // Once for each material: drei shares the parse between mounts.
      if (mat.__arris) continue;
      mat.__arris = true;
      const prev = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', chunk);
      };
      const key = mat.customProgramCacheKey.bind(mat);
      mat.customProgramCacheKey = () => `${key()}|estate-arris`;
      mat.needsUpdate = true;
    }
  });
  return done.size;
}
