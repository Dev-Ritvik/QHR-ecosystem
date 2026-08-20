'use client';

// apps/monolith/src/state/sceneStore.ts
//
// The DOM↔WebGL contract — MASTER_SPEC §4.4.
//
// This store is defined BEFORE either side is written, deliberately. It is the
// only channel between the React tree and the Three scene, and if it is written
// after both exist the two grow incompatible assumptions that are expensive to
// reconcile later.
//
// L5: the store holds camera INTENT, never the Three.js camera object. Putting
// a live Three object in a React store makes the store non-serialisable and
// puts React and the render loop in a fight over one mutable value.
//
// `q` is NOT stored here. It lives in the ticker and is read via getQ(), because
// writing it to a store at scroll frequency would re-render the tree sixty times
// a second. Anything that needs q subscribes to the ticker.

import { create } from 'zustand';

export type Vec3 = [number, number, number];
export type Tier = 'A' | 'B' | 'C' | 'D';
export type FrameloopMode = 'demand' | 'never';

/** Where in the ignition sequence the visitor is. Ordered — §8.2. */
export type GatePhase = 'consent' | 'ignition' | 'live';

export interface SceneState {
  // ── Gate ────────────────────────────────────────────────────────────────
  gate: GatePhase;
  setGate: (g: GatePhase) => void;

  // ── Render control ──────────────────────────────────────────────────────
  frameloop: FrameloopMode;
  setFrameloop: (f: FrameloopMode) => void;

  /** Set by not-found.tsx and error boundaries. When true the Canvas does not
   *  mount at all — no context creation, no shader compile. §8.3. */
  errorState: boolean;
  setErrorState: (v: boolean) => void;

  // ── Device ──────────────────────────────────────────────────────────────
  tier: Tier;
  reducedMotion: boolean;
  setDevice: (tier: Tier, reducedMotion: boolean) => void;

  // ── Camera intent (L5) ──────────────────────────────────────────────────
  /** A socket key from the socket registry, or null when scroll has authority.
   *  §6.1a — sockets are geometry, partners are data. */
  activeSocket: string | null;
  /** True until the visitor's first scroll input after a deep link, during
   *  which the URL anchor outranks q. §6.1 [RESOLVED §9]. */
  anchorHolds: boolean;
  setActiveSocket: (key: string | null) => void;
  releaseAnchor: () => void;

  // ── Optics, written by the camera rig for the HUD to read on mount ──────
  exposure: number;
  lastFov: number;
  audioCut: boolean;
  reportOptics: (exposure: number, fov: number) => void;
  setAudioCut: (v: boolean) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  gate: 'consent',
  setGate: (gate) => set({ gate }),

  frameloop: 'demand',
  setFrameloop: (frameloop) => set({ frameloop }),

  errorState: false,
  setErrorState: (errorState) => set({ errorState }),

  // Pessimistic default: assume the weakest tier until detection says
  // otherwise, so a slow device never renders one expensive frame before
  // being downgraded.
  tier: 'C',
  reducedMotion: false,
  setDevice: (tier, reducedMotion) => set({ tier, reducedMotion }),

  activeSocket: null,
  anchorHolds: false,
  setActiveSocket: (activeSocket) =>
    set({ activeSocket, anchorHolds: activeSocket !== null }),
  releaseAnchor: () => set({ anchorHolds: false }),

  exposure: -2.4,
  lastFov: 28,
  audioCut: false,
  reportOptics: (exposure, lastFov) => set({ exposure, lastFov }),
  setAudioCut: (audioCut) => set({ audioCut }),
}));
