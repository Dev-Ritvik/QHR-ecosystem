// apps/public/src/components/experience/poolProbe.ts
//
// THE POOL REFLECTS THE HOUSE.
//
// The second art-direction audit (2026-09-30): "the pool water is opaque".
// It was lit and rippled, but what it reflected was the sky and nothing else:
// the estate's environment is a sky panorama, so the one surface in the hero
// that should hold the house and the trees upside down in it held a sheet of
// pale blue instead — which is exactly what "opaque" looks like.
//
// So the pool gets its own light probe: the estate photographed once from just
// above the water, into a cube, and filtered the way the sky is. Water is a
// near-mirror at the angles the film sees it, so the facade, the palms and the
// clouds now ride on it, broken by its ripples. One capture, spread over six
// frames (a face a frame, as the hall's own probe is taken), on the first
// frames the finished estate is on screen with its sky; nothing afterwards.
// The pool is a flat sheet 20 m long, and a probe at its middle puts the
// house's reflection a little off where a mirror would (parallax) — which on
// rippled water no eye can see.

import * as THREE from 'three';
import { sharedPmrem } from './hallProbe';

/** The cube's face size: the pool's reflection is rippled, not a mirror. */
const POOL_PX = 256;

export interface PoolProbeCapture {
  /** Render the next face; the filtered target when all six are done. */
  step(): THREE.WebGLRenderTarget | null;
  cancel(): void;
}

export function beginPoolProbe(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  at: THREE.Vector3,
  hide: readonly THREE.Object3D[],
): PoolProbeCapture {
  const cube = new THREE.WebGLCubeRenderTarget(POOL_PX, { type: THREE.HalfFloatType, generateMipmaps: false });
  const camera = new THREE.CubeCamera(0.3, 450, cube);
  camera.position.copy(at);
  camera.updateMatrixWorld(true);
  if (camera.coordinateSystem !== gl.coordinateSystem) {
    camera.coordinateSystem = gl.coordinateSystem;
    camera.updateCoordinateSystem();
  }
  const faces = camera.children as THREE.Camera[];
  let face = 0;

  return {
    step() {
      // The water itself is not in its own reflection, and the sun's shadow
      // map is last frame's: six extra 4096 depth passes buy nothing here.
      const shown = hide.map((o) => o.visible);
      for (const o of hide) o.visible = false;
      const autoShadow = gl.shadowMap.autoUpdate;
      gl.shadowMap.autoUpdate = false;
      const prev = gl.getRenderTarget();
      const prevFace = gl.getActiveCubeFace();
      const prevMip = gl.getActiveMipmapLevel();
      try {
        gl.setRenderTarget(cube, face);
        gl.render(scene, faces[face]);
      } finally {
        gl.setRenderTarget(prev, prevFace, prevMip);
        gl.shadowMap.autoUpdate = autoShadow;
        hide.forEach((o, i) => {
          o.visible = shown[i];
        });
      }
      face += 1;
      if (face < 6) return null;
      const target = sharedPmrem(gl).fromCubemap(cube.texture);
      cube.dispose();
      return target;
    },
    cancel() {
      cube.dispose();
    },
  };
}
