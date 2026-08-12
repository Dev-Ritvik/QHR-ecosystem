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

export function HallModel({
  onReady,
}: {
  onReady?: (info: { promoted: number; meshes: number; tris: number }) => void;
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
  const root = useMemo(() => {
    const g = scene.clone(true);

    // Drop the model so its lowest point sits on y=0.
    //
    // The export's own floor is at y=-3.20 (measured from the POSITION
    // accessors: y spans -3.20 to 6.42). Every pose in poses.ts was written as
    // an eye height above a floor at zero, so on device the camera stood 4.85m
    // up in a room 6.42m tall - level with the chandeliers, looking at the
    // underside of the stair. Nothing was wrong with the poses or the scale;
    // they simply disagreed with the model about where the ground was.
    //
    // Correcting it here rather than by editing eight poses keeps poses.ts
    // meaning what it says - 1.65 is eye height - and leaves one number to
    // change if the model is ever re-exported with its origin on the floor.
    const box = new THREE.Box3().setFromObject(g);
    g.position.y = -box.min.y;
    return g;
  }, [scene]);

  useEffect(() => {
    const promoted = promoteLightmaps(root);
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
    // A hall is roughly 12-16 units across if the export is in metres. Anything
    // near 1200 means the GLB came out in centimetres and every pose - plus the
    // 60-unit far plane - is wrong by two orders of magnitude.
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    // eslint-disable-next-line no-console
    console.info(
      '[hall_ready] meshes=%d tris=%d lightmaps=%d | size %sx%sx%s | centre %s,%s,%s | y %s..%s',
      meshes,
      Math.round(tris),
      promoted,
      size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2),
      centre.x.toFixed(2), centre.y.toFixed(2), centre.z.toFixed(2),
      box.min.y.toFixed(2), box.max.y.toFixed(2),
    );

    onReady?.({ promoted, meshes, tris: Math.round(tris) });
  }, [root, onReady]);

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
