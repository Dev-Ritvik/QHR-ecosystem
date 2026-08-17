'use client';

// apps/public/src/components/experience/useSceneCards.ts
//
// Carries the server-fetched projects into the WebGL tree.
//
// The canvas is mounted by the (experience) LAYOUT and the projects are fetched
// by the site-home PAGE, so there is no prop path between them — the layout
// renders above the page and cannot see its data. A store is the connection.
//
// Deliberately zustand rather than context: a context provider would have to
// wrap the layout, which would put a client boundary above every page in the
// segment and cost the server rendering that the whole route group exists for.

import { create } from 'zustand';
import type { SpatialCard } from './SpatialCards';

interface SceneCardsState {
  cards: SpatialCard[];
  setCards: (cards: SpatialCard[]) => void;
}

export const useSceneCards = create<SceneCardsState>((set) => ({
  cards: [],
  setCards: (cards) => set({ cards }),
}));
