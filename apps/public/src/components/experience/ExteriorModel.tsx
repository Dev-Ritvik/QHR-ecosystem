'use client';

// apps/public/src/components/experience/ExteriorModel.tsx
//
// The mansion seen from outside: the frame the site opens on.
//
// This set has existed in COL_Exterior since the scene was built and was
// exported to exterior_mansion_web.glb on 31 July. Nothing ever pointed at it,
// so the home page opened INSIDE the hall for weeks while the brief asked for
// an approach — and poses.ts carried a comment claiming "the exterior is not
// modelled", which was simply untrue.
//
// Deliberately a separate component from HallModel rather than one parameterised
// loader, because the two sets have genuinely different contracts:
//
//   INTERIOR   baked GI in the occlusion slot at 4.66x, KTX2 textures, lit
//              almost entirely by that lightmap, so exposure is its reciprocal.
//   EXTERIOR   no lightmap at all. Plain PBR with JPEG maps, transmission on
//              the glass and the fountain water, an emissive factor on the
//              interior window panes. It needs a real key light and renders at
//              roughly unit exposure.
//
// Promoting a lightmap that does not exist, or applying the interior's exposure
// here, would be a silent mis-grade of the kind this project has already paid
// for twice. The shared part — Draco and KTX2 loader wiring — is imported.

import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { attachLoaders } from './HallModel';

export const EXTERIOR_MODEL_URL = '/models/exterior_mansion.glb';

/**
 * The ground plane is 450m square, which is far larger than the building and
 * exists to give the approach somewhere to stand. Its far edge has to be fogged
 * out or the scene reads as a diorama on a table.
 *
 * Measured from the GLB: mansion x -9.55..9.55, three z -5.55..6.10, roof 6.80,
 * spire tip 11.72. Fountain centre at three z 13.2, entry step at 6.15.
 */
export const EXTERIOR_BOUNDS = {
  spireTop: 11.72,
  groundHalfSpan: 225,
} as const;

export function ExteriorModel({
  onReady,
}: {
  onReady?: (info: { meshes: number; tris: number }) => void;
}) {
  const gl = useThree((s) => s.gl);

  // Same drei trap as the interior: the second argument is `useDraco` and
  // leaving it undefined makes drei attach its own decoder from gstatic AFTER
  // the extendLoader callback runs, which our CSP blocks. This GLB lists
  // KHR_draco_mesh_compression in extensionsRequired, so that silently prevents
  // it from parsing at all. The path must be passed explicitly.
  const { scene } = useGLTF(EXTERIOR_MODEL_URL, '/draco/', undefined, (loader) => {
    attachLoaders(loader as unknown as GLTFLoader, gl);
  });

  const root = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    let meshes = 0;
    let tris = 0;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes += 1;
      // The glass and the water are doubleSided with transmission. Left alone
      // deliberately — the fountain reads as a bowl of nothing without it.
      const g = m.geometry as THREE.BufferGeometry;
      tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    // eslint-disable-next-line no-console
    console.info(
      '[exterior_ready] meshes=%d tris=%d | size %sx%sx%s | y %s..%s',
      meshes,
      Math.round(tris),
      size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2),
      box.min.y.toFixed(2), box.max.y.toFixed(2),
    );

    onReady?.({ meshes, tris: Math.round(tris) });
  }, [root, onReady]);

  return <primitive object={root} />;
}
