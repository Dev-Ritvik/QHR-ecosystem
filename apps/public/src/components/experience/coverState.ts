// apps/public/src/components/experience/coverState.ts
//
// Whether this document has already drawn its curtain — read by the canvas
// host (ExperienceCanvasHost), which draws it into the server-rendered page. A
// module variable on purpose: a return within the document keeps it (no
// curtain twice), a reload starts a new module and clears it.
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
 * (The reading pages kept the navy then, because their ground was navy and a
 * curtain should be the colour of the room it opens on. Their ground is the
 * hall's dark too since 2026-10-06 — folio.css — so there is one curtain.)
 */
export const COVER_GROUND = { film: '#15110C', page: '#15110C' } as const;

export function coverGround(pathname: string | null | undefined): string {
  return pathname === '/' || pathname === '/site-home' ? COVER_GROUND.film : COVER_GROUND.page;
}
