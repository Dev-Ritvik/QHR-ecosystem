// apps/public/src/components/experience/sceneModels.ts
//
// WHICH MODEL A PAGE IS A PICTURE OF, as the page's own script can know it.
//
// poses.ts gives every place its set, but poses.ts stands on the camera's
// paths and so on three: a page's script that asked it would carry the scene's
// whole library to say one word (the page-bundle trap: filmShares.ts has the
// account). So the answer is restated here, without it, and a test holds this
// list to the poses and these addresses to the models' own
// (sceneModels.test.ts).
//
// What it is for: the server names the model in the page's markup as
// something to fetch (ExperienceCanvasHost), so its download begins with the
// page and not when the scene's script — which is what asks for it — has
// itself arrived. MEASURED through a public address on 2026-10-08: the
// estate's fetch began three to six seconds after the page did.

import { placeForRoute, type PlaceId } from '@estate/domain/experience/places';

/** The places that stand outside the house. Every other is in its hall. */
export const OUTSIDE_PLACES: readonly PlaceId[] = [
  'arrival',
  'estate',
  'door',
  'portico',
  'terrace',
  'gate',
  'canal',
  'above',
];

export const ESTATE_MODEL = '/models/exterior_estate_v7.glb';
export const HALL_MODEL = '/models/interior_hall.glb';

/**
 * The model the page at `pathname` opens on. (The film is served from
 * /site-home, which is not an address places.ts knows: the middleware
 * rewrites `/` to it, and that is the path the server renders with. Asked as
 * any other address it stood in the hall, and the film's markup asked for the
 * hall's 26 MB ahead of the estate it opens on — MEASURED on the first build
 * of this: the estate arrived 14 seconds later for it on an 8 Mbit line.)
 */
export function modelForRoute(pathname: string): string {
  if (pathname === '/' || pathname === '/site-home') return ESTATE_MODEL;
  return OUTSIDE_PLACES.includes(placeForRoute(pathname)) ? ESTATE_MODEL : HALL_MODEL;
}
