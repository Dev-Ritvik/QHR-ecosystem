// apps/public/src/components/experience/poolProbe.ts
//
// THE WATER REFLECTS THE HOUSE.
//
// The second art-direction audit (2026-09-30): "the pool water is opaque".
// It was lit and rippled, but what it reflected was the sky and nothing else:
// the estate's environment is a sky panorama, so the one surface in the hero
// that should hold the house and the trees upside down in it held a sheet of
// pale blue instead — which is exactly what "opaque" looks like.
//
// So a sheet of water gets its own probe: the estate photographed from just
// above it into a cube, a face a frame (as the hall's own probe is taken).
//
// READ AS A MIRROR READS, since the forensic audit of 2026-10-09 (#17:
// "a low-resolution noise texture with visible blocks"). The cube used to be
// filtered the way the sky is, for a roughness, at 256 pixels a face: from the
// forecourt, where the pool is seen at a glance, one of its texels was
// seventeen pixels of the frame. It is read directly now (exteriorWater.ts),
// with its own mipmaps and at twice the size where the device has the memory;
// and it is taken again as the film's hour moves (ExteriorModel,
// useWaterProbes), which the filtering pass would have made expensive.

import * as THREE from 'three';

export interface WaterProbeCapture {
  /** Render the next face; the cube when all six are done. */
  step(): THREE.WebGLCubeRenderTarget | null;
  cancel(): void;
}

export function beginWaterProbe(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  at: THREE.Vector3,
  hide: readonly THREE.Object3D[],
  px: number,
): WaterProbeCapture {
  const cube = new THREE.WebGLCubeRenderTarget(px, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  });
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
      // The mipmaps are made once, by the last face's draw: until then the
      // cube is not whole (three's own CubeCamera does the same).
      cube.texture.generateMipmaps = face === 5;
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
      cube.texture.generateMipmaps = true;
      return cube;
    },
    cancel() {
      cube.dispose();
    },
  };
}
