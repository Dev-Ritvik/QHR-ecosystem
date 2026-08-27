'use client';

// apps/public/src/components/experience/HallModel.tsx
//
// Loads interior_hall.glb and honours the contract in
// apps/public/public/models/interior_hall.manifest.json.
//
// The part that is easy to get wrong: baked GI rides in the OCCLUSION slot,
// because glTF has no lightmap slot. GLTFLoader brings it in as material.aoMap
// on uv1, so it has to be promoted to lightMap on load — and the colour space
// declared explicitly, because GLTFLoader treats occlusion as linear data while
// this atlas is sRGB-encoded. Skip that and the room renders roughly twice as
// dark as it was baked.
//
// Both loaders are mandatory: KHR_texture_basisu and KHR_draco_mesh_compression
// are in extensionsRequired, so the file will not parse without them.

import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { guardAnisotropy } from './materialGuards';

export const HALL_MODEL_URL = '/models/interior_hall.glb';

/** From interior_hall.manifest.json — the bake's normalisation divisor. Changing
 *  the bake means changing this, so it is named rather than inlined. */
const LIGHTMAP_INTENSITY = 4.6597;

let ktx2Singleton: KTX2Loader | null = null;
let dracoSingleton: DRACOLoader | null = null;

/** Loaders are shared across every mount. Creating a KTX2Loader per mount spawns
 *  a fresh worker pool each time, which on mid-tier phones is a stall the user
 *  can feel. */
export function attachLoaders(loader: GLTFLoader, gl: THREE.WebGLRenderer) {
  if (!ktx2Singleton) {
    ktx2Singleton = new KTX2Loader()
      .setTranscoderPath('/basis/')
      .detectSupport(gl);
  }
  if (!dracoSingleton) {
    dracoSingleton = new DRACOLoader().setDecoderPath('/draco/');
  }
  loader.setKTX2Loader(ktx2Singleton);
  loader.setDRACOLoader(dracoSingleton);
}

/**
 * Promote the baked GI from the occlusion slot to lightMap.
 *
 * Idempotent: drei caches the parsed GLTF, so a remount hands back the same
 * material instances. Without the guard a second mount would find aoMap already
 * null and quietly strip the lighting.
 */
export function promoteLightmaps(root: THREE.Object3D): number {
  let promoted = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial & { __lightmapPromoted?: boolean };
      if (!mat || mat.__lightmapPromoted) continue;
      if (!mat.aoMap) continue;

      mat.lightMap = mat.aoMap;
      // Required. GLTFLoader marks occlusion as linear data; this atlas is
      // sRGB-encoded because linear 8-bit puts the room near value 13 and bands.
      mat.lightMap.colorSpace = THREE.SRGBColorSpace;
      mat.lightMapIntensity = LIGHTMAP_INTENSITY;
      mat.aoMap = null;
      mat.__lightmapPromoted = true;
      mat.needsUpdate = true;
      promoted += 1;
    }
  });
  return promoted;
}

/**
 * Remove the punctual lights the GLB carries, because the bake already contains
 * them.
 *
 * `KHR_lights_punctual` is in this file's extensionsRequired, so GLTFLoader
 * instantiates every lamp that was in the Blender scene — and the lightmap was
 * baked FROM those same lamps. Keeping both double-counts the lighting on the
 * 147 lightmapped meshes.
 *
 * This was not a subtle amount. MEASURED at the verified `hall` camera pose:
 *
 *   LGT_chandelier   PointLight  intensity 41307
 *   LGT_portrait     SpotLight   intensity 10327
 *   LGT_sconce_* x8  PointLight  intensity 869.6
 *
 * glTF stores punctual intensity in candela and Blender's exporter derives it
 * from watts, so these arrive as four- and five-figure numbers; with decay 2 and
 * distance 0 they are unbounded. The result was 89.5% of the frame at pure
 * white (mean luma 250.1/255) — a plain lightmapped wall 14m from the camera
 * read (255,255,255). Zeroing them alone took the same frame to 0% clipped,
 * mean 87.9, while zeroing the lightmap gain or the emissive strengths instead
 * changed nothing measurable. These lamps were the whole fault.
 *
 * WorldCanvas already states the contract this restores: inside, GI is baked, so
 * the only real-time light is a low ambient to lift the instanced ornament that
 * carries no lightmap.
 *
 * Removed from the CLONE, so drei's cached parse is untouched and turning this
 * off restores the lamps.
 */
export function stripBakedLights(root: THREE.Object3D): number {
  const lights: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as THREE.Light).isLight) lights.push(o);
  });
  for (const l of lights) l.removeFromParent();
  return lights.length;
}

/**
 * The handful of interior materials the final Blender delivery does NOT fix,
 * and the presentation change the holograms need.
 *
 * THIS FUNCTION USED TO DO FAR MORE. It rebuilt the stair runner (generating a
 * planar UV1 and borrowing the floor rug's carpet maps, dyed oxblood) and lit
 * the founder's portrait with an emissive copy of its own albedo. Both were
 * workarounds for defects in the previous export, and both are now DELETED
 * rather than left in place, because the delivered asset fixes them at source
 * and a workaround that fights a correct asset is worse than no workaround:
 *
 *   MAT_Runner_LM   now ships `carpet_runner_oxblood` on UV0 with roughness,
 *                   normal and the lightmap on UV1 — a real wool runner
 *                   unwrapped along 8.078m of stair arc. The old code would
 *                   have cloned it, overwritten the map with the RUG texture
 *                   and written a competing UV1 over the artist's.
 *   MAT_Portrait    now carries `founder_portrait_graded`, and the glass in
 *                   front of it went from transmission 1.0 (which rendered the
 *                   sky HDRI over the founder's face) to a BLEND pane at 0.1.
 *                   The emissive lift would now double-light a correct
 *                   painting.
 *
 * What is left is only what the delivery genuinely does not address.
 */
function dressInterior(root: THREE.Object3D): string[] {
  const touched: string[] = [];

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;

    // Draw order for the additively-blended plans. Set on the MESH because
    // renderOrder is a node property, not a material one.
    if (mesh.name.startsWith('holo3d_') || mesh.name.startsWith('projlens_')) {
      mesh.renderOrder = 3;
    }

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial & { __dressed?: boolean };
      if (!mat || mat.__dressed) continue;

      // THE BENCH. Material 'model' arrives metalness 0.8, roughness 0.5, base
      // 0.5 grey, with no maps — and the interior's environment intensity is
      // 0.1, so it renders as a dark grey slab. A metal reflects; with nothing
      // to reflect it is simply black. It is a hall bench: dielectric walnut.
      //
      // Still required against the final delivery — re-checked by parsing it.
      if (mat.name === 'model') {
        mat.metalness = 0.0;
        mat.roughness = 0.58;
        mat.color.setHex(0x3b2a1e);
        mat.needsUpdate = true;
        mat.__dressed = true;
        touched.push('bench');
      }

      // THE URNS. material_0.001 arrives metalness 1, roughness 1 — the one
      // combination that reflects almost nothing in any direction. They stand
      // at eye height either side of the hall, exactly where the camera passes
      // them, and render as black blobs. Their base colour map is real and
      // stays; only the response is corrected to the glazed ceramic the
      // silhouette obviously is.
      //
      // Still required against the final delivery — re-checked by parsing it.
      if (mat.name === 'material_0.001') {
        mat.metalness = 0.12;
        mat.roughness = 0.42;
        mat.needsUpdate = true;
        mat.__dressed = true;
        touched.push('urns');
      }

      // THE HOLOGRAMS. Every MAT_Holo* material is emissive-only: a black base
      // colour, a white emissive factor, an emissive strength of 2.6 to 9, and
      // for the plan plates an emissive texture of the layout itself. That is
      // correct authoring — and rendered OPAQUE it produces a solid black
      // rectangle with a few bright lines on it, because the dark texels of the
      // plan are exactly as opaque as the bright ones. Verified in frame
      // against the previous delivery: the Kartikeya plate read as a black slab
      // hanging over the table.
      //
      // A projection is ADDITIVE. Light is added to whatever is behind it and
      // nothing is subtracted, so the dark parts of the plan contribute zero
      // and simply are not there. The plot outlines, the leader lines and the
      // extruded blocks float; the black ground disappears; the room shows
      // through. That is what makes it read as light in the air rather than as
      // a screen.
      //
      // S4 IS EXCLUDED, DELIBERATELY. The delivery disables it at source —
      // MAT_Holo3D_Top_S4 carries no emissive at all, and MAT_Holo3D_Plate_S4
      // is alphaMode MASK with a base alpha of 0 — so that the fourth station
      // cannot leak a project it does not have. Additive blending on those
      // would also render nothing, so this guard changes no pixels; it exists
      // so that a future edit to this block cannot accidentally switch a
      // deliberately dark station back on.
      if (/^MAT_Holo/.test(mat.name) && !/_S4$/.test(mat.name)) {
        mat.transparent = true;
        mat.blending = THREE.AdditiveBlending;
        mat.depthWrite = false;
        // Tone mapping stays ON. These sit inside a room graded by ACES, and an
        // untone-mapped emissive in a tone-mapped frame is the one thing
        // guaranteed to look pasted on.
        mat.needsUpdate = true;
        mat.__dressed = true;
        if (!touched.includes('holograms')) touched.push('holograms');
      }
    }
  });

  return touched;
}
export function HallModel({
  onReady,
  onRoot,
}: {
  onReady?: (info: { promoted: number; meshes: number; tris: number }) => void;
  /**
   * Hands the loaded scene graph to the caller.
   *
   * <InteriorStage> needs it because the interaction layer works by ADOPTING
   * geometry that is already in this file — the four pedestals, the projectors,
   * the hologram volumes — rather than by building a second set beside them.
   * There is no other way to reach those nodes: they arrive from a Draco/KTX2
   * parse inside drei's cache, not from JSX.
   *
   * Called with null on unmount so a consumer holding the previous root cannot
   * keep re-parenting meshes inside a scene that is no longer rendered.
   */
  onRoot?: (root: THREE.Object3D | null) => void;
}) {
  const gl = useThree((s) => s.gl);
  // The second argument is `useDraco`, and it must be the local decoder path.
  //
  // Leaving it undefined does NOT mean "leave Draco alone" — drei defaults it
  // to true and then attaches its own DRACOLoader pointed at
  // https://www.gstatic.com/draco/..., applied AFTER the extendLoader callback
  // below. So attachLoaders' setDecoderPath('/draco/') was being silently
  // overwritten on every mount, the decoder fetch was blocked by our own CSP
  // (connect-src does not allow gstatic, and should not), and the model never
  // decoded. The hall rendered nothing on every device, not just mobile.
  //
  // Passing the path explicitly makes drei configure its loader against the
  // copy we already ship in public/draco/.
  const { scene } = useGLTF(HALL_MODEL_URL, '/draco/', undefined, (loader) => {
    attachLoaders(loader as unknown as GLTFLoader, gl);
  });

  // Clone so two mounts cannot fight over one object graph. `clone` shares
  // geometry and materials, which is what we want — the promotion guard makes
  // sharing safe and the GPU upload is not duplicated.
  const root = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const disarmed = guardAnisotropy(root);
    const promoted = promoteLightmaps(root);
    const strippedLights = stripBakedLights(root);
    // AFTER the promotion, not before: dressInterior clones the runner's
    // material, and cloning it while its lightmap was still sitting in the
    // occlusion slot would hand the clone an aoMap nothing ever promotes.
    const dressed = dressInterior(root);
    let meshes = 0;
    let tris = 0;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes += 1;
      const g = m.geometry as THREE.BufferGeometry;
      tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    });

    // The scene's real extents, logged once.
    //
    // Every camera pose in poses.ts is a Blender coordinate converted by hand,
    // and there is no way to tell a correct pose from one standing inside a
    // wall except by knowing how big the room actually is. The first render on
    // a device came back looking up at the ceiling from under the staircase,
    // and there was no number anywhere in the app to say whether the camera was
    // misplaced or the model was a hundred times too large.
    //
    // Measured in Blender against this exact GLB: x -7.80..7.80, y -0.10..6.50,
    // z -5.98..5.60. Metres, floor at zero. If these numbers ever drift, the
    // model changed and every pose in poses.ts needs re-checking.
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    // eslint-disable-next-line no-console
    console.info(
      '[hall_ready] meshes=%d tris=%d lightmaps=%d bakedLightsRemoved=%d dressed=[%s] anisotropyDisarmed=[%s] | size %sx%sx%s | centre %s,%s,%s | y %s..%s',
      meshes,
      Math.round(tris),
      promoted,
      strippedLights,
      dressed.join(','),
      disarmed.join(','),
      size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2),
      centre.x.toFixed(2), centre.y.toFixed(2), centre.z.toFixed(2),
      box.min.y.toFixed(2), box.max.y.toFixed(2),
    );

    onReady?.({ promoted, meshes, tris: Math.round(tris) });
  }, [root, onReady]);

  // Separate effect from the one above, and deliberately so: the consumer
  // re-parents nodes inside `root`, and running that in the same effect as the
  // traversal that counts them would have the count depend on whether the
  // surgery had happened yet.
  useEffect(() => {
    onRoot?.(root);
    return () => onRoot?.(null);
  }, [root, onRoot]);

  return <primitive object={root} />;
}

// No module-scope preload.
//
// useGLTF.preload() takes no loader configuration, so it ran with drei's
// defaults: the gstatic Draco decoder (CSP-blocked) and no KTX2 loader at all.
// It could never have succeeded — every texture in this GLB is KTX2, and
// KTX2Loader needs detectSupport(renderer) to pick a transcode target, so it
// cannot be built before a WebGL context exists.
//
// It fired on every page that imports this module, so a route with no 3D on it
// still paid for a doomed cross-origin request. The component's own useGLTF
// above is correctly configured and is the only place the model is fetched.
