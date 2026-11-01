// apps/public/src/components/experience/poolMirror.ts
//
// THE POOL, AS A MIRROR.
//
// The brief of 2026-11-01: "a custom planar reflection and normal-map ripple shader
// that distorts reflections of the sky and mansion". Until this the pool's reflection
// was a cube taken from one point over the water and read through a few upright planes
// (exteriorWater.ts, PROXIES): good enough for the sky, but a 512-pixel cube magnified
// across a twenty-metre sheet shows the house as a dark shape with stair-stepped edges,
// and nothing that stands on the terrace at all.
//
// So what stands in the water's view and is near enough to read is drawn again, from
// the mirror's side of the water, into a texture of its own that the water reads where
// that fragment's reflected ray lands. It is the textbook planar reflection and costs
// what that costs, so it is held to what it is worth:
//
//   ONLY THE ARCHITECTURE. A tree is two thirds of the triangles in any frame; the far
//   ones stay in the cube, which is all they ever were at that distance. What is drawn
//   is on one layer (MIRROR_LAYER). The sky is not drawn: where nothing landed, the
//   water reads the sky and the far trees exactly as it did.
//
//   ONLY WHEN THE POOL IS ENOUGH OF THE FRAME TO SHOW IT (MIRROR_SHARE: over the whole of
//   the layout it is a third of one percent of the picture, and a full pass of the house
//   was being paid for that), and only on the two tiers that can pay for it (the low tier
//   draws no shadows and keeps the cube).
//
//   AT A FRACTION OF THE FRAME. A ripple moves every pixel of a reflection by more than
//   the texel, so nothing is lost by it (MIRROR_SCALE).
//
// No new programs: every material is drawn with the program it has, into a target of
// the same kind the composer draws into.

import * as THREE from 'three';
import { POOL, mirrorUniforms } from './exteriorWater';
import { lookdevOn } from './lookdev';

/** The camera's layer for what the water shows. */
export const MIRROR_LAYER = 5;

/** What the pool shows of the estate, by mesh name: the house and what stands round
 *  the water. Not the sheet's own coping (exteriorWater.ts, waterStanding draws it). */
export const MIRROR_RE =
  /^(mansion_|portico_|door_|lion_frieze|wall_lantern|podium_walls|podium_balustrade|podium_urns|garden_planters|garden_hedges|pool_furniture|pool_rail|pergola_)/;

/** Of the frame: by tier. */
export const MIRROR_SCALE = { high: 0.5, mid: 0.33 } as const;
/** How wide it may get, pixels, whatever the frame: past this a ripple hides it. */
export const MIRROR_MAX_W = 1100;
/** Of the frame's area, the sheet: gone at the first, whole by the second, so it leaves by
 *  degrees as the camera climbs away from it (legs 0.47 to 0.51 and back at 0.81). */
export const MIRROR_SHARE: readonly [number, number] = [0.007, 0.013];

/** Put what the water shows on its layer. Returns how many meshes. */
export function markMirrored(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !MIRROR_RE.test(mesh.name)) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    // (a physical material with transmission would have three draw the whole scene
    // once more for it, inside this pass)
    if (mats.some((m) => (m as THREE.MeshPhysicalMaterial)?.transmission > 0)) return;
    mesh.layers.enable(MIRROR_LAYER);
    n += 1;
  });
  return n;
}

const biased = 0.0;

const normal = new THREE.Vector3(0, 1, 0);
const planePoint = new THREE.Vector3(0, POOL.level, 0);
const camPos = new THREE.Vector3();
const view = new THREE.Vector3();
const look = new THREE.Vector3();
const target = new THREE.Vector3();
const rotation = new THREE.Matrix4();
const plane = new THREE.Plane();
const clip = new THREE.Vector4();
const q = new THREE.Vector4();
const frustum = new THREE.Frustum();
const projView = new THREE.Matrix4();
const clearColour = new THREE.Color();
const poolBox = new THREE.Box3(
  new THREE.Vector3(POOL.x0, POOL.level - 0.1, POOL.z0),
  new THREE.Vector3(POOL.x1, POOL.level + 0.1, POOL.z1),
);
const uvFromClip = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

const corner = new THREE.Vector3();

/** How much of the frame the pool's sheet is (clipped by nothing: the frustum test says
 *  whether any of it is in). Pure of the renderer, for the test. */
export function poolShare(camera: THREE.Camera): number {
  let area = 0;
  let px = 0;
  let py = 0;
  let fx = 0;
  let fy = 0;
  const xs = [POOL.x0, POOL.x1, POOL.x1, POOL.x0];
  const zs = [POOL.z0, POOL.z0, POOL.z1, POOL.z1];
  for (let i = 0; i < 4; i += 1) {
    corner.set(xs[i], POOL.level, zs[i]).project(camera);
    if (i === 0) {
      fx = corner.x;
      fy = corner.y;
    } else {
      area += px * corner.y - corner.x * py;
    }
    px = corner.x;
    py = corner.y;
  }
  area += px * fy - fx * py;
  // (clip space's square is four across)
  return Math.abs(area) / 8;
}

/** The camera on the far side of the water: `mirror` is set from `camera`. Pure of
 *  the renderer, for the test. Returns false if the eye is under the water's level. */
export function placeMirror(mirror: THREE.PerspectiveCamera, camera: THREE.PerspectiveCamera, level: number = POOL.level): boolean {
  planePoint.y = level;
  camPos.setFromMatrixPosition(camera.matrixWorld);
  view.subVectors(planePoint.setX(camPos.x).setZ(camPos.z), camPos);
  if (view.dot(normal) > 0) return false;
  view.reflect(normal).negate().add(planePoint);
  rotation.extractRotation(camera.matrixWorld);
  look.set(0, 0, -1).applyMatrix4(rotation).add(camPos);
  target.subVectors(planePoint, look).reflect(normal).negate().add(planePoint);
  mirror.position.copy(view);
  mirror.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal);
  mirror.lookAt(target);
  mirror.near = camera.near;
  mirror.far = camera.far;
  mirror.updateMatrixWorld();
  mirror.projectionMatrix.copy(camera.projectionMatrix);

  // The near plane laid along the water, so nothing under it is drawn
  // (Lengyel's oblique near plane: what the camera sees of what is under the water's
  // level is not in the water's reflection).
  plane.setFromNormalAndCoplanarPoint(normal, planePoint);
  plane.applyMatrix4(mirror.matrixWorldInverse);
  clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
  const e = mirror.projectionMatrix.elements;
  q.x = (Math.sign(clip.x) + e[8]) / e[0];
  q.y = (Math.sign(clip.y) + e[9]) / e[5];
  q.z = -1;
  q.w = (1 + e[10]) / e[14];
  clip.multiplyScalar(2 / clip.dot(q));
  e[2] = clip.x;
  e[6] = clip.y;
  e[10] = clip.z + 1 - biased;
  e[14] = clip.w;
  mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
  return true;
}

export interface PoolMirror {
  /** Draw it for this frame, if it is wanted. */
  step(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, scale: number): void;
  off(): void;
  dispose(): void;
}

export function makePoolMirror(): PoolMirror {
  const mirror = new THREE.PerspectiveCamera();
  mirror.layers.set(MIRROR_LAYER);
  let rt: THREE.WebGLRenderTarget | null = null;

  function sized(w: number, h: number): THREE.WebGLRenderTarget {
    if (rt && rt.width === w && rt.height === h) return rt;
    rt?.depthTexture?.dispose();
    rt?.dispose();
    const depth = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    depth.minFilter = depth.magFilter = THREE.NearestFilter;
    rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: true,
      depthTexture: depth,
      samples: 0,
    });
    rt.texture.name = 'pool_mirror';
    if (lookdevOn()) (window as unknown as { __estatePoolMirrorRT?: unknown }).__estatePoolMirrorRT = rt;
    mirrorUniforms.uMirror.value = rt.texture;
    mirrorUniforms.uMirrorDepth.value = depth;
    return rt;
  }

  return {
    step(gl, scene, camera, scale) {
      frustum.setFromProjectionMatrix(projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const on = THREE.MathUtils.smoothstep(poolShare(camera), MIRROR_SHARE[0], MIRROR_SHARE[1]);
      if (scale <= 0 || on <= 0 || !frustum.intersectsBox(poolBox) || !placeMirror(mirror, camera)) {
        mirrorUniforms.uMirrorOn.value = 0;
        return;
      }
      // The lights are on the layer too: EXACTLY THE ONES THE FILM'S CAMERA SEES. Three keys
      // a program on the lights it is drawn under, so any difference from the frame's own
      // pass is another program for every material here. Counting every light that was lit
      // was a 4.4 s stop at the door on the integrated card: the hall's stand-in for the
      // portrait's spot (HallPortal.tsx, on the hall's layer alone so that no other pass
      // would count it) came on and made eighteen new programs. (Over what is visible only:
      // a few hundred nodes, and only while the pool is in the frame.)
      scene.traverseVisible((o) => {
        if ((o as THREE.Light).isLight && o.layers.test(camera.layers)) o.layers.enable(MIRROR_LAYER);
      });
      const size = gl.getDrawingBufferSize(new THREE.Vector2());
      const w = Math.max(2, Math.round(Math.min(MIRROR_MAX_W, size.x * scale)));
      const h = Math.max(2, Math.round((w * size.y) / size.x));
      const target_ = sized(w, h);

      const prev = gl.getRenderTarget();
      const autoShadow = gl.shadowMap.autoUpdate;
      const owed = gl.shadowMap.needsUpdate;
      const autoClear = gl.autoClear;
      const background = scene.background;
      gl.getClearColor(clearColour);
      const clearAlpha = gl.getClearAlpha();
      gl.shadowMap.autoUpdate = false;
      gl.shadowMap.needsUpdate = false;
      scene.background = null;
      try {
        gl.setRenderTarget(target_);
        gl.setClearColor(0x000000, 0);
        gl.clear(true, true, false);
        gl.autoClear = false;
        gl.render(scene, mirror);
      } finally {
        gl.autoClear = autoClear;
        gl.setClearColor(clearColour, clearAlpha);
        scene.background = background;
        gl.shadowMap.autoUpdate = autoShadow;
        gl.shadowMap.needsUpdate = owed;
        gl.setRenderTarget(prev);
      }
      mirrorUniforms.uMirrorMatrix.value
        .copy(uvFromClip)
        .multiply(mirror.projectionMatrix)
        .multiply(mirror.matrixWorldInverse);
      mirrorUniforms.uMirrorOn.value = on;
    },
    off() {
      mirrorUniforms.uMirrorOn.value = 0;
    },
    dispose() {
      mirrorUniforms.uMirrorOn.value = 0;
      mirrorUniforms.uMirror.value = null;
      mirrorUniforms.uMirrorDepth.value = null;
      rt?.depthTexture?.dispose();
      rt?.dispose();
      rt = null;
    },
  };
}
