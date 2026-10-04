// apps/public/src/components/experience/stationStyle.ts
//
// HOW A STATION SHOWS ITS LAYOUT.
//
// 'model'     a physical site model: the layout's plots in ivory plaster on a
//             lacquered board, in a walnut tray with a brass bezel, carried on
//             a brass stand over the table (StationModel.tsx). The refinement
//             brief, section E (ordered 2026-10-04): "Replace the
//             glowing/translucent sci-fi presentation with a tactile,
//             architectural-model treatment".
// 'hologram'  the plan projected in light from a brass instrument on the table
//             (StationDressing.tsx, HallModel's holographic()), as the film
//             had it until then. Kept whole and switchable, because the last
//             physical model put on these tables (frosted acrylic, 2026-09-30)
//             was sent straight back: `?stations=hologram` shows it on any
//             build, and DEFAULT_STATION_STYLE is the one word to change.

export type StationStyle = 'model' | 'hologram';

export const DEFAULT_STATION_STYLE: StationStyle = 'model';

let resolved: StationStyle | null = null;

/** The style for this page load (the query is read once: a station is built
 *  for one style and the hall's materials are dressed for it). */
export function stationStyle(): StationStyle {
  if (resolved) return resolved;
  if (typeof window === 'undefined') return DEFAULT_STATION_STYLE;
  resolved = styleFromSearch(window.location.search);
  return resolved;
}

export function styleFromSearch(search: string): StationStyle {
  const q = new URLSearchParams(search).get('stations');
  return q === 'hologram' || q === 'model' ? q : DEFAULT_STATION_STYLE;
}
