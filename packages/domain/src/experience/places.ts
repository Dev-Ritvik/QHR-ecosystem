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
//
// EVERY PAGE IS A FOLIO NOW (2026-10-06; apps/public/src/app/folio.css): the
// "surface" that was a panel over the held frame is a page that opens on a
// full frame of its place and is then read on sheets. The distinction below is
// kept because it still says something true — a place's page is ABOUT where
// it stands, a surface's is only read from there — and because the sitemap
// and the tests are derived from these two lists.

import { projectBySlug, type StationId } from '../leads/branches';

// A PICTURE FOR EACH PAGE'S SUBJECT (the forensic audit of 2026-10-09, #66 and
// #67). Twenty-eight pages stood at about ten places: "seven pages open on the
// same view of the founder's portrait above the stair (the hall, privacy,
// terms, refunds, cookies, the sitemap and the 404 page) … four open on the
// same dome and chandelier … two share the map table, two the stair rail",
// and three opened on a picture with nothing in it ("a blank brown door … a
// wall, a rug and the slab wainscot … a corner of the roof"). "The founder's
// face over 'If a purchase does not go ahead.' and over 'That page isn't
// here.' is a mismatch of subject and picture."
//
// So a page has a place of its own, and a place is a SUBJECT: the thing in the
// house or its grounds that the page is about, or the nearest thing to it.
// What each is, and why it is that page's, is said where it is assigned
// below; where the camera stands for it is poses.ts.

export type PlaceId =
  // ── the film's, and the frames of it that pages hold ──────────────────────
  | 'arrival'
  | 'hall'
  | 'table'
  | 'window'
  | 'study'
  | 'portrait'
  | 'map'
  | 'tables'
  | 'dome'
  | 'desk'
  | 'estate'
  | 'door'
  // ── inside, one subject each ──────────────────────────────────────────────
  | 'plots'
  | 'plan'
  | 'plaque'
  | 'reading'
  | 'bench'
  | 'attic'
  | 'stair'
  | 'sconces'
  | 'urn'
  | 'shut'
  | 'empty'
  // ── outside ───────────────────────────────────────────────────────────────
  | 'portico'
  | 'terrace'
  | 'gate'
  | 'canal'
  | 'above';

export const PLACES: readonly PlaceId[] = [
  'arrival',
  'hall',
  'table',
  'window',
  'study',
  'portrait',
  'map',
  'tables',
  'dome',
  'desk',
  'estate',
  'door',
  'plots',
  'plan',
  'plaque',
  'reading',
  'bench',
  'attic',
  'stair',
  'sconces',
  'urn',
  'shut',
  'empty',
  'portico',
  'terrace',
  'gate',
  'canal',
  'above',
] as const;

/** Routes that ARE a place — arriving at them moves the camera. */
export const PLACE_ROUTES: Readonly<Record<string, PlaceId>> = {
  '/': 'arrival',
  '/start-here': 'arrival',
  // Under the founder's portrait, above the stair: the storyboard's own way
  // to this page is a click on it.
  '/about': 'portrait',
  // "Proof, not persuasion": the portico from under it — the columns and what
  // they carry. (It was the saloon car at the foot of the steps, close: a
  // model that holds at a distance and not at this one — the audit's #70.)
  '/why-us': 'portico',
  // The stair, the portrait over it and a table at its foot: the room whole.
  '/hall': 'hall',
  // The layouts: two of their tables in the room, each with its plan raised.
  '/projects': 'tables',
  // Plots and sizes: a layout's model close enough to read the sizes printed
  // on its plots.
  '/properties': 'plots',
  // The map of the two districts, on its table in the court. (Its pins are
  // the three layouts: where the ground is.)
  '/locations': 'map',
  // Three offices: the three lamps lit along the hall's wall. (It shared the
  // map table with /locations, a little higher: the audit's "two share the
  // map table". The map's pins are layouts, not offices.)
  '/branches': 'sconces',
};

/**
 * Surfaces, and the place each is READ FROM. The place is not where you travel
 * to — it is the frame held behind the panel, so the Investment Guide is read
 * over the study and the plot schedule over the table you were just looking at.
 * That costs nothing and is the whole difference between this and a white page.
 */
export const SURFACE_ROUTES: Readonly<Record<string, PlaceId>> = {
  // What to know before buying, read under the dome: the one frame in the
  // house with nothing in it to sell.
  '/investment-guide': 'dome',
  // Worth knowing: the chandelier against the attic's arched windows, where
  // the room's light comes in.
  '/knowledge': 'attic',
  // How to read a layout plan: a plan, read — a model close and from the
  // side, down its roads.
  '/knowledge/reading-a-layout-plan': 'reading',
  // "The things people ask first": the stair from its foot, the first step.
  '/faqs': 'stair',
  // "One sheet a layout": a layout's own name, on the plate of its board.
  '/downloads': 'plaque',
  // "The plans at full size": a model from over it, where it is a plan.
  '/gallery': 'plan',
  // What buyers say: the terrace by the pool, its chairs and its shade — the
  // one place in the grounds that is somebody's.
  '/testimonials': 'terrace',
  // "On the ground": the estate from above, where the ground is.
  '/construction-updates': 'estate',
  // Turned toward the room rather than a table: where you speak to someone.
  '/contact': 'desk',
  // "Come and see": the front door, from the drive.
  '/book-a-site-visit': 'door',
  // The roles open now: the bench in the hall, with nobody on it yet.
  '/careers': 'bench',
  // THE SMALL PRINT, each page its own and none of them the founder's face.
  // Privacy: the door of the house, from inside, shut.
  '/privacy': 'shut',
  // The terms on which you come in: the gate, and the drive beyond it.
  '/terms': 'gate',
  // "If a purchase does not go ahead": the house from behind, down its canal —
  // the way you would look back at it.
  '/refund-policy': 'canal',
  // "What this site stores": the urn by the door, which is for keeping things.
  '/cookie-policy': 'urn',
  // "Every page of the site": the whole estate from over it, as a plan of
  // the site.
  '/sitemap': 'above',
};

/**
 * A LAYOUT'S OWN PAGE STANDS AT ITS OWN TABLE. The three tables in the hall
 * are the three layouts (leads/branches.ts gives each its station), and each
 * already has a pose looking at it: the page of the layout on the first table
 * opens on the first table. They all resolved to the wide hall through their
 * parent, so "opening" a model in the film put the visitor on a page with the
 * whole room behind it and the model they had opened a small thing in the
 * distance.
 */
const STATION_PLACE: Readonly<Record<StationId, PlaceId>> = {
  S1: 'table',
  S2: 'window',
  S3: 'study',
};

function layoutPlace(path: string): PlaceId | null {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'projects' || !parts[1]) return null;
  const project = projectBySlug(parts[1]);
  return project ? STATION_PLACE[project.station] : null;
}

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
 * Unknown routes (404, anything unmapped) never return null: the scene must
 * always have somewhere to be, and an empty frame behind a panel is the white
 * page this architecture exists to avoid. They stand at the hall's FOURTH
 * TABLE, the one with nothing on it: "that page isn't here", over a table
 * where a layout is not. (It was the room whole, with the founder's portrait
 * over the stair — his face over an error message: the audit's #66.)
 */
export function placeForRoute(pathname: string): PlaceId {
  const p = normalisePath(pathname);
  if (p in PLACE_ROUTES) return PLACE_ROUTES[p];
  if (p in SURFACE_ROUTES) return SURFACE_ROUTES[p];

  // A layout's page, and a plot's under it: that layout's table.
  const table = layoutPlace(p);
  if (table) return table;

  const parent = '/' + p.split('/').filter(Boolean)[0];
  if (parent in PLACE_ROUTES) return PLACE_ROUTES[parent];
  if (parent in SURFACE_ROUTES) return SURFACE_ROUTES[parent];
  return 'empty';
}

/** Every route the surface system knows about — used to assert coverage against
 *  the 26 the brief calls for. */
export function allKnownRoutes(): string[] {
  return [...Object.keys(PLACE_ROUTES), ...Object.keys(SURFACE_ROUTES)].sort();
}
