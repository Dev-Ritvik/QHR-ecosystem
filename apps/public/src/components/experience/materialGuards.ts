// apps/public/src/components/experience/materialGuards.ts
//
// Material states that are legal in glTF, silent in three.js, and fatal on
// screen. One so far, and it cost most of an afternoon.
//
// ─────────────────────────────────────────────────────────────────────────────
// ANISOTROPY WITHOUT TANGENTS
//
// KHR_materials_anisotropy stretches a specular highlight along a surface
// direction — brushed metal, spun brass, satin. The direction is defined in
// TANGENT space, so the extension is only meaningful on geometry that ships a
// TANGENT attribute. The spec says so; nothing enforces it.
//
// The final exterior delivery declares anisotropy on MAT_Gold — the finials,
// the spire tip and the door furniture — and none of its eight primitives ship
// TANGENT. three falls back to deriving a tangent frame from screen-space
// derivatives of the UVs, and on this geometry that produces NaN.
//
// WHAT THAT LOOKED LIKE, because the symptom points nowhere near the cause:
// the entire page rendered BLACK. Not the gold — everything. The DOM was fine,
// the scene graph was fine, 373 draw calls and 326,798 triangles were being
// submitted every frame, every texture had decoded, the camera was at the
// correct pose, the shadow map rendered, the bloom mip chain ran all the way
// down to 6x4 and back up, and the final pass blitted to the screen. Zero
// console errors. Rendering the same scene and camera straight to the canvas
// by hand produced a perfectly good image.
//
// The reason it took the whole frame down rather than eight small objects is
// BLOOM. A NaN written into the HDR buffer is averaged into the mip chain, and
// NaN propagates through every average it touches — so one bad fragment
// contaminates progressively larger regions until the top mip is entirely NaN,
// and NaN resolves to black on output. Without a bloom pass this would have
// been a few odd-looking finials.
//
// Bisected by swapping the previous exterior GLB back in (rendered fine, same
// code), then zeroing `anisotropy` on the live material and watching the sample
// pixel go from [0,0,0] to [113,107,83].
//
// THE FIX, and why it is a guard rather than a workaround: a material asking
// for a tangent-space effect on geometry with no tangent space is not a look we
// are declining to honour — it is undefined. Refusing to enable it is the
// correct reading. The alternative, generating tangents with
// BufferGeometryUtils.computeTangents, is the same derivative-from-UVs
// computation that produced the NaN, so it would be trading a reliable failure
// for an intermittent one.
//
// If the highlight is wanted, the export must carry TANGENT. That is one line
// in the glTF exporter and it is recorded in the Blender handoff.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';

interface Guarded {
  __anisoGuarded?: boolean;
}

/**
 * Disable anisotropy on any material whose geometry cannot support it.
 *
 * Walks meshes rather than materials because the decision depends on the
 * GEOMETRY: the same material may be shared by a mesh that has tangents and one
 * that does not, and in that case the safe answer is off.
 *
 * Idempotent — drei caches parsed GLTFs and hands back the same material
 * instances on a remount.
 *
 * Returns the names of the materials it disarmed, for the load log.
 */
export function guardAnisotropy(root: THREE.Object3D): string[] {
  // Collect first, decide second. A material is only safe if EVERY mesh using
  // it has a tangent attribute.
  const usage = new Map<THREE.Material, { hasTangent: boolean; any: boolean }>();

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geom = mesh.geometry as THREE.BufferGeometry | undefined;
    const hasTangent = Boolean(geom && geom.getAttribute('tangent'));
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) {
      if (!m) continue;
      const anisotropy = (m as THREE.MeshPhysicalMaterial).anisotropy;
      if (typeof anisotropy !== 'number' || anisotropy <= 0) continue;
      const prev = usage.get(m);
      if (prev) prev.hasTangent = prev.hasTangent && hasTangent;
      else usage.set(m, { hasTangent, any: true });
    }
  });

  const disarmed: string[] = [];
  for (const [m, info] of usage) {
    const mat = m as THREE.MeshPhysicalMaterial & Guarded;
    if (mat.__anisoGuarded || info.hasTangent) continue;
    mat.anisotropy = 0;
    mat.__anisoGuarded = true;
    mat.needsUpdate = true;
    disarmed.push(mat.name || '<unnamed>');
  }
  return disarmed;
}
