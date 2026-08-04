// packages/domain/src/experience/places.ts
//
// The route-to-place map. See the surface architecture: a route is a PLACE only
// if being there changes what you understand. Standing at the Kartikeya table
// changes what you understand about a plot; standing somewhere to read a refund
// policy changes nothing.
//
// Everything that is not a place is a SURFACE: it opens over the held frame
// with no travel, from anywhere, instantly. That is what keeps 26 routes from
// costing 26 camera flights and losing the visitors who convert fastest.
//
// Pure and data-only so the map can be tested and reviewed without a browser.

export type PlaceId =
  | 'arrival'
  | 'approach'
  | 'hall'
  | 'table'
  | 'window'
  | 'study'
  | 'desk';

export const PLACES: readonly PlaceId[] = [
  'arrival',
  'approach',
  'hall',
  'table',
  'window',
  'study',
  'desk',
] as const;

/** Routes that ARE a place — arriving at them moves the camera. */
export const PLACE_ROUTES: Readonly<Record<string, PlaceId>> = {
  '/': 'arrival',
  '/start-here': 'arrival',
  '/about': 'approach',
  '/why-us': 'approach',
  '/hall': 'hall',
  '/projects': 'hall',
  '/properties': 'table',
  '/locations': 'window',
  '/branches': 'window',
};

/**
 * Surfaces, and the place each is READ FROM. The place is not where you travel
 * to — it is the frame held behind the panel, so the Investment Guide is read
 * over the study and the plot schedule over the table you were just looking at.
 * That costs nothing and is the whole difference between this and a white page.
 */
export const SURFACE_ROUTES: Readonly<Record<string, PlaceId>> = {
  '/investment-guide': 'study',
  '/knowledge': 'study',
  '/faqs': 'study',
  '/downloads': 'study',
  '/gallery': 'hall',
  '/testimonials': 'approach',
  '/contact': 'desk',
  '/book-a-site-visit': 'desk',
  '/careers': 'desk',
  // Legal has no spatial meaning. It is read from wherever you already are,
  // which is what `null` place inheritance means at the call site.
  '/privacy': 'study',
  '/terms': 'study',
  '/cookie-policy': 'study',
  '/refund-policy': 'study',
  '/sitemap': 'study',
};

export type RouteKind = 'place' | 'surface' | 'unknown';

/** Trailing slashes and query strings are stripped; dynamic segments resolve to
 *  their parent (e.g. /projects/lucky-garden is still the hall). */
export function normalisePath(pathname: string): string {
  const clean = pathname.split('?')[0].split('#')[0];
  if (clean.length > 1 && clean.endsWith('/')) return clean.slice(0, -1);
  return clean || '/';
}

export function routeKind(pathname: string): RouteKind {
  const p = normalisePath(pathname);
  if (p in PLACE_ROUTES) return 'place';
  if (p in SURFACE_ROUTES) return 'surface';
  // Dynamic children inherit their parent's kind: /projects/x is a place,
  // /knowledge/some-post is a surface.
  const parent = '/' + p.split('/').filter(Boolean)[0];
  if (parent in PLACE_ROUTES) return 'place';
  if (parent in SURFACE_ROUTES) return 'surface';
  return 'unknown';
}

/**
 * Which place the camera should hold for this route.
 *
 * Unknown routes (404, anything unmapped) return 'hall' rather than null: the
 * scene must always have somewhere to be, and an empty frame behind a panel is
 * the white page this architecture exists to avoid.
 */
export function placeForRoute(pathname: string): PlaceId {
  const p = normalisePath(pathname);
  if (p in PLACE_ROUTES) return PLACE_ROUTES[p];
  if (p in SURFACE_ROUTES) return SURFACE_ROUTES[p];

  const parent = '/' + p.split('/').filter(Boolean)[0];
  if (parent in PLACE_ROUTES) return PLACE_ROUTES[parent];
  if (parent in SURFACE_ROUTES) return SURFACE_ROUTES[parent];
  return 'hall';
}

/** Every route the surface system knows about — used to assert coverage against
 *  the 26 the brief calls for. */
export function allKnownRoutes(): string[] {
  return [...Object.keys(PLACE_ROUTES), ...Object.keys(SURFACE_ROUTES)].sort();
}
