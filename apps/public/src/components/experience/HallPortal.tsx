'use client';

// apps/public/src/components/experience/HallPortal.tsx
//
// Draws the hall through the front door (doorPortal.ts has the account).
//
// WHAT HAS TO BE TRUE OF THE PASS, and why each line below is there. The hall's
// ~70 programs are compiled once, while it is hidden, for the state it is drawn
// in as a set (hallProbe.ts, warmHallPrograms): one ambient light and one spot,
// no fog, the room's own environment, a linear buffer. A pass that draws it
// under any other state compiles every one of them again on the spot — the
// multi-second stall the dark threshold was built to hide. So for the pass:
//
//   layers       the hall's objects are taken off the default layer for as
//                long as the door is open (the exterior's pass must not draw
//                them) and the pass's camera sees only theirs;
//   lights       the exterior's lights are on the default layer and so are not
//                in the pass; the room's ambient is, and the portrait's spot —
//                which React mounts only with the interior set — is stood in
//                for by one of the same making;
//   fog, sky     taken off the scene for the pass, and put back;
//   environment  the room's cube, at the room's strength.
//
// AND OF THE FRAME ROUND IT. The pass is drawn from INSIDE the frame's render,
// when that reaches the doorway's panel (doorPortal.ts, `draw`), so the frame's
// own light state — which its shadow maps are keyed on — is never the room's.
// What is done here each frame, before the frame is drawn, is only what the
// frame itself must see: the hall off its layer, the buffer in place.
//
// The hall's own front wall and door leaves are hidden while the door is open:
// the exterior's stand in the same place, and the room is seen from outside
// them.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DeviceTier } from '@estate/domain/telemetry/device-tier';
import { HALL_IN_EXTERIOR, doorwayState } from './doorway';
import { hallLight } from './hallLight';
import { HALL_FRONT, doorwayRect, hallPortal, portalScale, portalUniforms, portalWanted } from './doorPortal';
import { ESTATE_DOOR } from './estateBounds';
import { hallEnv } from './HallModel';
import { HALL_LAYER } from './hallProbe';

/** The front door's opening, in the estate's world: its reveal from the outer
 *  face of the wall to the inner (estateBounds, measured from the model). */
const OPENING = [
  ESTATE_DOOR.min[0], ESTATE_DOOR.min[1], ESTATE_DOOR.min[2],
  ESTATE_DOOR.max[0], ESTATE_DOOR.max[1], ESTATE_DOOR.max[2],
] as const;

export interface PortalLight {
  position: readonly [number, number, number];
  aim: readonly [number, number, number];
  angle: number;
  colour: string;
  intensity: number;
}

export function HallPortal({
  tier,
  spot,
  ambient,
  env,
}: {
  tier: DeviceTier;
  /** The portrait's spot, as the interior set mounts it. */
  spot: PortalLight;
  /** The interior's ambient and environment strengths (LOOK.interior). */
  ambient: number;
  env: number;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const eye = useMemo(() => {
    const c = new THREE.PerspectiveCamera();
    c.layers.set(HALL_LAYER);
    c.matrixAutoUpdate = false;
    c.matrixWorldAutoUpdate = false;
    return c;
  }, []);

  // The stand-in for the portrait's spot: on the hall's layer only, and lit
  // only while the door is open, so no other pass ever counts it.
  const lamp = useMemo(() => {
    const l = new THREE.SpotLight(spot.colour, spot.intensity, 16, spot.angle, 0.45, 2);
    l.name = 'portal_spot';
    l.position.set(...spot.position);
    l.target.position.set(...spot.aim);
    l.layers.set(HALL_LAYER);
    l.target.layers.set(HALL_LAYER);
    l.visible = false;
    return l;
  }, [spot]);

  const target = useRef<THREE.WebGLRenderTarget | null>(null);
  const masks = useRef(new Map<THREE.Object3D, number>());
  const hidden = useRef<THREE.Object3D[]>([]);
  const size = useMemo(() => new THREE.Vector2(), []);
  const clear = useMemo(() => new THREE.Color(), []);
  /** Inside the pass: the room's own draws must not start another. */
  const drawing = useRef(false);
  const viewProjection = useMemo(() => new THREE.Matrix4(), []);
  const crop = useMemo(() => new THREE.Matrix4(), []);

  const close = () => {
    for (const [o, mask] of masks.current) o.layers.mask = mask;
    masks.current.clear();
    for (const o of hidden.current) o.visible = true;
    hidden.current = [];
    lamp.visible = false;
    // The wrapper is React's: it shows the hall when the hall is the set.
    if (hallPortal.wrapper && doorwayState.sceneLeg === 'exterior') {
      hallPortal.wrapper.visible = false;
      // And whatever else is the hall but hangs outside the wrapper (the
      // stage's own group: the nameplate, the tables' hit boxes). Each shows
      // itself by the hall's own visibility, in its own frame callback — which
      // on this frame has already run, with the hall still showing through the
      // doorway. Left to it, the stage was drawn once in the estate's pass,
      // under the estate's lights: three programs built on the frame the way
      // out ends (measured: a frame of 0.6 s as the page is let go).
      for (const root of hallPortal.roots) if (root !== hallPortal.wrapper) root.visible = false;
    }
    hallPortal.open = false;
    // The buffer is a frame's worth of half floats; it is wanted again only if
    // the visitor goes out and comes back in.
    portalUniforms.tHall.value = null;
    target.current?.dispose();
    target.current = null;
  };

  // THE PASS, called by the doorway's panel from inside the frame's render.
  const draw = (renderer: THREE.WebGLRenderer, of: THREE.Scene, by: THREE.Camera) => {
    // Only for the film's own camera: a probe that happens to see the panel
    // (the pool's) is not a visitor at the door.
    const rt = target.current;
    if (drawing.current || !hallPortal.open || !rt || by !== camera || of !== scene) return;
    drawing.current = true;

    // The camera's own eye, in the hall's coordinates — through a frustum
    // cropped to the doorway's place on the screen (doorPortal.doorwayRect).
    const cam = camera as THREE.PerspectiveCamera;
    viewProjection.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const rect = doorwayRect(viewProjection, rt.width, rt.height, OPENING);
    if (rect) {
      // The crop, in clip space: the rectangle becomes the whole of it.
      const sx = rt.width / rect.w;
      const sy = rt.height / rect.h;
      crop.set(
        sx, 0, 0, sx - 1 - (2 * rect.x) / rect.w,
        0, sy, 0, sy - 1 - (2 * rect.y) / rect.h,
        0, 0, 1, 0,
        0, 0, 0, 1,
      );
      eye.projectionMatrix.multiplyMatrices(crop, cam.projectionMatrix);
      eye.projectionMatrixInverse.copy(eye.projectionMatrix).invert();
      rt.viewport.set(rect.x, rect.y, rect.w, rect.h);
      rt.scissor.set(rect.x, rect.y, rect.w, rect.h);
      rt.scissorTest = true;
    } else {
      eye.projectionMatrix.copy(cam.projectionMatrix);
      eye.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
      rt.viewport.set(0, 0, rt.width, rt.height);
      rt.scissor.set(0, 0, rt.width, rt.height);
      rt.scissorTest = false;
    }
    eye.matrixWorld.copy(cam.matrixWorld);
    eye.matrixWorld.elements[12] -= HALL_IN_EXTERIOR[0];
    eye.matrixWorld.elements[13] -= HALL_IN_EXTERIOR[1];
    eye.matrixWorld.elements[14] -= HALL_IN_EXTERIOR[2];
    eye.matrixWorldInverse.copy(eye.matrixWorld).invert();

    // The room's own light state, for the pass; then the scene as it was.
    const fog = scene.fog;
    const background = scene.background;
    const environment = scene.environment;
    const strength = scene.environmentIntensity;
    const ambients: [THREE.AmbientLight, number, number][] = [];
    scene.traverse((o) => {
      const a = o as THREE.AmbientLight;
      if (a.isAmbientLight) {
        ambients.push([a, a.intensity, a.layers.mask]);
        a.intensity = ambient * hallLight.level;
        a.layers.enable(HALL_LAYER);
      }
    });
    const prev = renderer.getRenderTarget();
    const prevFace = renderer.getActiveCubeFace();
    const prevMip = renderer.getActiveMipmapLevel();
    renderer.getClearColor(clear);
    const clearAlpha = renderer.getClearAlpha();
    try {
      scene.fog = null;
      scene.background = null;
      if (hallEnv.stand) scene.environment = hallEnv.stand;
      scene.environmentIntensity = env;
      // The reflection probe, if the room has not been photographed yet: under
      // this same state, a face a frame.
      hallPortal.pumpProbe?.();
      renderer.setRenderTarget(rt);
      // Alpha 1 is the lens's "nothing here" (LensFocus): what the room does
      // not cover is far, and black.
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      renderer.render(scene, eye);
    } finally {
      renderer.setRenderTarget(prev, prevFace, prevMip);
      renderer.setClearColor(clear, clearAlpha);
      scene.fog = fog;
      scene.background = background;
      scene.environment = environment;
      scene.environmentIntensity = strength;
      for (const [a, intensity, mask] of ambients) {
        a.intensity = intensity;
        a.layers.mask = mask;
      }
      drawing.current = false;
    }
  };
  const drawNow = useRef(draw);
  drawNow.current = draw;

  useEffect(() => {
    scene.add(lamp, lamp.target);
    const call: NonNullable<typeof hallPortal.draw> = (r, s, c) => drawNow.current(r, s, c);
    hallPortal.draw = call;
    return () => {
      if (hallPortal.draw === call) hallPortal.draw = null;
      if (hallPortal.open) close();
      scene.remove(lamp, lamp.target);
      lamp.dispose();
      target.current?.dispose();
      target.current = null;
      portalUniforms.tHall.value = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, lamp]);

  useFrame(() => {
    const want = portalWanted();

    if (!want) {
      if (hallPortal.open) close();
      return;
    }

    if (!hallPortal.open) {
      hallPortal.open = true;
      for (const name of HALL_FRONT) {
        const o = scene.getObjectByName(name);
        if (o && o.visible) {
          o.visible = false;
          hidden.current.push(o);
        }
      }
      lamp.visible = true;
    }
    // Every frame, both: a React commit in the meantime may have hidden the
    // wrapper again, or put something new under one of the roots — and a thing
    // of the hall's left on the default layer is drawn in the estate's pass,
    // inside the house, under the estate's lights.
    for (const root of hallPortal.roots) {
      root.traverse((o) => {
        if (masks.current.has(o)) return;
        masks.current.set(o, o.layers.mask);
        // Lights of the hall's own keep the layers they have.
        if (!(o as THREE.Light).isLight) o.layers.set(HALL_LAYER);
      });
      // EVERY root, not the wrapper alone. The stage (InteriorStage) shows
      // itself by the hall's own visibility, in a frame callback that runs
      // before this one — and on the frame the sets change on the way OUT,
      // React has just hidden the wrapper. MEASURED (2026-10-04): for that one
      // frame the room filled the picture without the clerestory's shafts, the
      // picture light's beam and the nameplate; the door under the stair fell
      // from 26.5 to 9.6 and came back, a blink in a continuous move.
      root.visible = true;
    }

    gl.getDrawingBufferSize(size);
    const k = portalScale(tier);
    const w = Math.max(4, Math.round(size.x * k));
    const h = Math.max(4, Math.round(size.y * k));
    let rt = target.current;
    if (!rt || rt.width !== w || rt.height !== h) {
      rt?.dispose();
      rt = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        depthBuffer: true,
        generateMipmaps: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
      target.current = rt;
    }
    portalUniforms.tHall.value = rt.texture;
    portalUniforms.uResolution.value.copy(size);
  });

  return null;
}
