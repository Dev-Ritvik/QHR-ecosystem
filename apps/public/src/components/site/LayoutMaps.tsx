'use client';

// apps/public/src/components/site/LayoutMaps.tsx
//
// The two map components of a layout's page, fetched only when they are shown.
//
// Both draw with MapLibre, which is the heaviest thing the site ships after
// the film itself, and both need data the register does not hold yet: plot
// geometry for the plan map, surveyed places for the map of what is nearby.
// The page imported them outright and so every visitor to a layout downloaded
// a map engine to be shown a panel saying no map was available. They are
// loaded on demand now, and the page asks for them only when their data
// exists — the day geometry is published, the map is on the page with no
// other change.

import dynamic from 'next/dynamic';

export const PlanMap = dynamic(() => import('@/components/map/ProjectMap').then((m) => m.ProjectMap), {
  ssr: false,
  loading: () => null,
});

export const NearbyMap = dynamic(() => import('./LocationSection').then((m) => m.LocationSection), {
  ssr: false,
  loading: () => null,
});
