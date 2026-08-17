'use client';

// apps/public/src/components/experience/PublishSceneCards.tsx
//
// Renders nothing. Hands the page's server-fetched projects to the store the
// canvas reads, so the spatial cards show real published data rather than a
// second hardcoded copy that would drift from the database.

import { useEffect } from 'react';
import { useSceneCards } from './useSceneCards';
import type { SpatialCard } from './SpatialCards';

export function PublishSceneCards({ cards }: { cards: SpatialCard[] }) {
  const setCards = useSceneCards((s) => s.setCards);

  useEffect(() => {
    setCards(cards);
    // Cleared on unmount so navigating to a page with no projects does not
    // leave three plans hanging in the forecourt.
    return () => setCards([]);
  }, [cards, setCards]);

  return null;
}
