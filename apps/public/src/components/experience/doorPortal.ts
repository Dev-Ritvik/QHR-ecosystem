// apps/public/src/components/experience/doorPortal.ts
//
// THE HALL, SEEN THROUGH THE FRONT DOOR.
//
// The continuous passage inward (doorway.ts, 'through') opens the exterior's
// door leaves onto the hall itself. The hall is a second model that React
// keeps hidden while the exterior is the set, and it is larger than the house
// it stands in (a dome to 19 m inside a 12 m house): drawn in the exterior's
// own pass it would stand through the roof. So while the door is open it is
// drawn FIRST, alone, from the camera's own eye into a buffer the size of the
// frame, and the doorway — a panel just inside the house, behind the leaves
// (DoorwayRig) — shows that buffer where it stands on screen. Through the
// opening the room is exactly where it would be; outside the opening it is
// not drawn at all. When the camera is through and the sets change, the panel
// already fills the frame with the same picture the hall then draws directly.
//
// This module is the state the pieces share; HallPortal.tsx does the drawing.

import * as THREE from 'three';
import { doorwayState } from './doorway';

/**
 * The uniforms of the doorway's panel, shared by reference: the buffer the hall
 * is drawn into, the size of the frame in buffer pixels, and a gain.
 */
export const portalUniforms = {
  tHall: { value: null as THREE.Texture | null },
  uResolution: { value: new THREE.Vector2(1, 1) },
  uGain: { value: 1 },
};

export const hallPortal = {
  /** True while the hall is being drawn through the doorway. */
  open: false,
  /** Everything that is the hall, by root: the model, the map table, the
   *  stage's own group. Registered by whoever builds them. */
  roots: new Set<THREE.Object3D>(),
  /** The group React hides while the exterior is the set. */
  wrapper: null as THREE.Object3D | null,
  /** One step of the hall's reflection probe, if it is still owed (HallModel).
   *  Called inside the portal's pass, under the hall's own light state. */
  pumpProbe: null as (() => void) | null,
  /**
   * The pass itself (HallPortal), called by the doorway's panel as the frame's
   * own render reaches it (DoorwayRig, onBeforeRender) — a render INSIDE a
   * render, as a mirror's is, and for one reason. three keeps a scene's light
   * state per depth of nesting, and the frame's shadow maps are drawn with
   * whatever that state last held. Drawn before the frame instead, the pass
   * left the room's two lights in it, and the estate's shadow casters were
   * rebuilt for a light count they had never been drawn under — MEASURED four
   * depth programs compiled on the first frame the door opened. Nested, the
   * pass has a state of its own and the frame's is never touched.
   */
  draw: null as ((gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void) | null,
};

/**
 * Is the hall to be drawn through the doorway on this frame? One answer for
 * the two that ask: HallPortal, which draws it, and the doorway's panel, which
 * shows it (DoorwayRig).
 *
 * The panel used to ask whether the buffer existed yet, which is HallPortal's
 * answer a frame late whenever the panel's own frame callback runs first. On
 * the way in that frame is one with the leaves still shut. On the way OUT it
 * is the frame the sets change, with the opening filling the picture: the
 * dark vestibule for one frame, in the middle of a continuous move.
 */
export function portalWanted(): boolean {
  const st = doorwayState;
  // Through the continuous passage; and before it, for as long as the leaves
  // stand open at the door's rest (doorway.ts, DOOR_AJAR) — the room is what
  // an open door shows. (The passage's first frame counts by the door being
  // open already: its own channel is still at nothing on that one.)
  const passage = st.mode === 'running' && st.style === 'through' && (st.channels.portal > 0.5 || st.ajar > 0.001);
  const ajar = st.mode === 'idle' && st.ajar > 0.001 && st.throughOk;
  return (
    (passage || ajar) &&
    st.sceneLeg === 'exterior' &&
    hallPortal.draw !== null &&
    hallPortal.wrapper !== null &&
    hallPortal.roots.size > 0
  );
}

/** The hall's own front wall and door leaves: the exterior's stand in the
 *  same place, and through the doorway the room is seen from outside them. */
export const HALL_FRONT = ['int_doors', 'int_door_arch', 'int_wall_front'] as const;

/** Register a root of the hall for the life of a component. */
export function registerHallRoot(root: THREE.Object3D): () => void {
  hallPortal.roots.add(root);
  return () => {
    hallPortal.roots.delete(root);
  };
}

/**
 * The share of the buffer the portal is drawn at, by tier. The room is seen
 * through an opening that is a few per cent of the frame until the last
 * second, and then at full frame for a handful of frames in motion.
 */
export function portalScale(tier: 'low' | 'mid' | 'high'): number {
  return tier === 'high' ? 1 : 0.75;
}

/**
 * ONLY WHAT THE DOORWAY SHOWS. From the forecourt the opening is a few per cent
 * of the frame, and the room behind it is nine hundred thousand triangles: the
 * pass is drawn through a frustum cropped to the opening's place on the screen,
 * so what the doorway cannot show is neither shaded nor (being outside the
 * frustum) drawn at all. The whole room is paid for only in the last second,
 * when the opening is the frame.
 *
 * Returns the rectangle of the buffer the opening can cover, in pixels from the
 * bottom-left, or null for the whole buffer: the eight corners of the opening's
 * reveal (`box`: x0, y0, z0, x1, y1, z1 in the camera's world) through
 * `viewProjection`, bounded, with a margin. Null as soon as a corner is at or
 * behind the eye — the camera is in the doorway, and the opening is the frame —
 * or when the rectangle is most of the frame anyway.
 */
export function doorwayRect(
  viewProjection: THREE.Matrix4,
  width: number,
  height: number,
  box: readonly [number, number, number, number, number, number],
  margin = 8,
): { x: number; y: number; w: number; h: number } | null {
  const e = viewProjection.elements;
  let l = Infinity;
  let b = Infinity;
  let r = -Infinity;
  let t = -Infinity;
  for (const x of [box[0], box[3]]) {
    for (const y of [box[1], box[4]]) {
      for (const z of [box[2], box[5]]) {
        const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
        if (cw < 0.25) return null;
        const px = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / cw) * 0.5 + 0.5;
        const py = ((e[1] * x + e[5] * y + e[9] * z + e[13]) / cw) * 0.5 + 0.5;
        l = Math.min(l, px * width);
        r = Math.max(r, px * width);
        b = Math.min(b, py * height);
        t = Math.max(t, py * height);
      }
    }
  }
  const x0 = Math.max(0, Math.floor(l - margin));
  const y0 = Math.max(0, Math.floor(b - margin));
  const x1 = Math.min(width, Math.ceil(r + margin));
  const y1 = Math.min(height, Math.ceil(t + margin));
  if (x1 - x0 < 2 || y1 - y0 < 2) return { x: 0, y: 0, w: 2, h: 2 };
  if ((x1 - x0) * (y1 - y0) > 0.6 * width * height) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Whether a rectangle seen from `eye` covers the whole frame: the four corner
 * rays of a frustum (tangents `tx`, `ty` of its half-angles, looking down -z in
 * the camera's own space, turned by `quaternion`) all land inside the
 * rectangle `box` (x0, y0, x1, y1) on the plane z = `planeZ`. The plane faces
 * +z; an eye behind it sees nothing of it.
 */
export function panelFillsFrame(
  eye: THREE.Vector3,
  quaternion: THREE.Quaternion,
  tx: number,
  ty: number,
  planeZ: number,
  box: readonly [number, number, number, number],
): boolean {
  if (eye.z <= planeZ) return false;
  const ray = new THREE.Vector3();
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ray.set(sx * tx, sy * ty, -1).applyQuaternion(quaternion);
      if (ray.z >= -1e-6) return false;
      const t = (planeZ - eye.z) / ray.z;
      const x = eye.x + ray.x * t;
      const y = eye.y + ray.y * t;
      if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) return false;
    }
  }
  return true;
}
