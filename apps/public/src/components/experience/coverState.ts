// apps/public/src/components/experience/coverState.ts
//
// Whether the scene has been built in THIS document — shared by the canvas
// host, which draws the loading cover into the server-rendered page, and the
// Preloader, which takes it over once its chunk arrives. A module variable on
// purpose: a client-side return to the film keeps it (nothing to cover), a
// reload starts a new module and clears it (everything to cover). See the note
// at the top of Preloader.tsx.
export const coverState = { sceneInMemory: false };

/**
 * THE CURTAIN'S GROUND. The audit of 2026-10-05 (P3): "The loading screen is
 * cool navy while the world it opens into is warm. Bring it into the site's
 * palette; keep its restraint." The film opens on a morning's haze over ivory
 * stone and ends in a walnut hall, and its curtain was the reading pages'
 * midnight navy: a blue card before a gold picture. On the film it is the
 * hall's own dark now — the umber of its walnut in shade — and nothing else
 * about it has changed: the name, the hairline, the fade.
 *
 * The reading pages keep the navy: their ground IS navy, and a curtain should
 * be the colour of the room it opens on.
 */
export const COVER_GROUND = { film: '#15110C', page: '#0A1120' } as const;

export function coverGround(pathname: string | null | undefined): string {
  return pathname === '/' || pathname === '/site-home' ? COVER_GROUND.film : COVER_GROUND.page;
}
