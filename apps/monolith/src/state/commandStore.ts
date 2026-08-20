'use client';

// apps/monolith/src/state/commandStore.ts
//
// The Command Overlay's state — MASTER_SPEC §4.4, §4.5, §7.
//
// The HUD reads `frozenBackdrop` and `lastFov` FROM THE STORE ON MOUNT, never
// via prop-drilling from a component that may unmount on navigation. That is
// the whole reason this is a store and not local state.

import { create } from 'zustand';

export interface CommandState {
  overlayOpen: boolean;
  /** data: URL captured on the same onAfterRender tick as the freeze (L6). */
  frozenBackdrop: string | null;
  activeUtilityRoute: string | null;

  requestOpen: () => void;
  commitFreeze: (backdrop: string | null) => void;
  close: () => void;
  setRoute: (r: string | null) => void;
}

export const useCommandStore = create<CommandState>((set) => ({
  overlayOpen: false,
  frozenBackdrop: null,
  activeUtilityRoute: null,

  // Step 1 of the freeze sequence. Deliberately does NOT set frameloop —
  // the canvas must render one more frame before it can be captured, and
  // freezing here would capture a cleared buffer. See §4.5.
  requestOpen: () => set({ overlayOpen: true }),

  // Step 3. Called from inside onAfterRender, in the same tick as
  // setFrameloop('never'), so the canvas is frozen on exactly the frame that
  // was captured — which is what makes the crossfade seamless by construction
  // rather than by timing.
  commitFreeze: (frozenBackdrop) => set({ frozenBackdrop }),

  close: () => set({ overlayOpen: false, frozenBackdrop: null }),
  setRoute: (activeUtilityRoute) => set({ activeUtilityRoute }),
}));
