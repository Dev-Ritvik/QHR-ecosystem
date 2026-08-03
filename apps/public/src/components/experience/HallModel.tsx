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
  const { scene } = useGLTF(HALL_MODEL_URL, undefined, undefined, (loader) => {
    attachLoaders(loader as unknown as GLTFLoader, gl);
  });

  // Clone so two mounts cannot fight over one object graph. `clone` shares
  // geometry and materials, which is what we want — the promotion guard makes
  // sharing safe and the GPU upload is not duplicated.
  const root = useMemo(() => scene.clone(true), [scene]);

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
    onReady?.({ promoted, meshes, tris: Math.round(tris) });
  }, [root, onReady]);

  return <primitive object={root} />;
}

useGLTF.preload(HALL_MODEL_URL);
