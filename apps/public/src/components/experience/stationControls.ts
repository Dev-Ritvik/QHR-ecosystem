// apps/public/src/components/experience/stationControls.ts
//
// What a turntable exposes to input that does not start on the table itself.
//
// A table used to turn only when the drag began ON its proxy cylinder, and only
// once the camera had given that station enough emphasis. From across the hall a
// 1.15 m table is a few dozen pixels, and the client review found it would not
// move until the camera was nearly on top of it. Every station now registers its
// turntable here, and a canvas-level drag (see useDragAnywhere in
// InteriorStage.tsx) can pick one up from anywhere in the room.
//
// Module-level for the same reason journeyState is: the registry is read inside
// pointer handlers at event frequency, and a context value would re-render the
// canvas tree on every registration.

import type * as THREE from 'three';

export interface StationControl {
  id: string;
  /** World-space centre of the table top, for picking the nearest table. */
  centre: THREE.Vector3;
  turntable: { current: THREE.Object3D | null };
  /** Angular velocity carried after release; the station's tick coasts it. */
  spin: { current: number };
  emphasis: { current: number };
  /** Non-null while a drag that began on the table's own proxy is live. */
  proxyDrag: { current: unknown };
  /** True while ANY drag holds this table, so the idle tick keeps its hands off. */
  held: { current: boolean };
}

export const stationControls = new Map<string, StationControl>();

// ── CLICK SUPPRESSION ────────────────────────────────────────────────────────
//
// A drag that ends over a hologram, a beacon or the portrait must not also be
// read as a click on it. r3f decides clicks on its own, so the drag records when
// it ended and every click handler in the room checks.
let suppressedUntil = 0;

export function suppressClicks(ms = 350) {
  suppressedUntil = performance.now() + ms;
}

export function clicksSuppressed(): boolean {
  return performance.now() < suppressedUntil;
}

// ── SCROLL LOCK DURING A DRAG ────────────────────────────────────────────────
//
// Scroll drives the camera, so a swipe during a drag would carry the visitor away
// from the table they are holding. While inside, the canvas sits at
// `touch-action: pan-y` so vertical swipes still scroll and horizontal ones reach
// the drag; during a drag it goes to `none`. The baseline is kept on the element
// so whoever unlocks restores it rather than guessing.

export function setCanvasTouchBase(el: HTMLElement, base: string) {
  el.dataset.touchBase = base;
  el.style.touchAction = base;
}

export function lockCanvasScroll(el: HTMLElement, locked: boolean) {
  el.style.touchAction = locked ? 'none' : (el.dataset.touchBase ?? '');
  document.documentElement.style.overscrollBehavior = locked ? 'contain' : '';
}
