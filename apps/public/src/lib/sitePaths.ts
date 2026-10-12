// apps/public/src/lib/sitePaths.ts
//
// WHICH ADDRESSES ARE PAGES, as the middleware can know it: with no database
// and no filesystem, from the lists the site is already built on.
//
// What it is for (the forensic audit of 2026-10-09, #4): an address that is
// not a page was answered with an EMPTY document. Next renders a "not found"
// raised inside a nested layout in the browser, not on the server: the 404's
// markup held a title and ten script tags, the page was drawn when the bundle
// arrived, and the title went with the redraw. A visitor on a slow line
// waited for the site's whole script to be told the page was not there.
//
// So the middleware says "404" itself for an address this file does not know,
// and the catch-all route then draws the not-found folio as an ordinary,
// server-rendered page (app/(site)/(experience)/[...missing]). A test walks
// the app's folders and holds this list to them (sitePaths.test.ts): a page
// added without being added here would be served under a 404, and the test
// fails first.

import { PLACE_ROUTES, SURFACE_ROUTES } from '@estate/domain/experience/places';

/** Pages that are not in the experience's own route lists. */
const OTHER_PAGES = [
  // An article under /knowledge.
  '/knowledge/reading-a-layout-plan',
  // The kiosk's (the (present) group; its home is reached by host).
  '/enroll',
];

const PAGES: ReadonlySet<string> = new Set([
  ...Object.keys(PLACE_ROUTES),
  ...Object.keys(SURFACE_ROUTES),
  ...OTHER_PAGES,
]);

/** Sections whose pages are made from the register, and so are asked of it:
 *  a layout (/projects/<slug>), a plot under it, a kiosk's layout (/p/<slug>). */
const DYNAMIC = /^\/(projects|p)\/[^/]+(\/[^/]+)?$/;

/** A file by its name (`/favicon.ico`, `/models/x.glb`): never a page. */
const FILE = /\.[a-z0-9]{1,8}$/i;

export function normalisePagePath(pathname: string): string {
  const p = pathname.split('?')[0].split('#')[0];
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p || '/';
}

/** Whether the address could be a file's (those are the filesystem's to answer). */
export function looksLikeFile(pathname: string): boolean {
  return FILE.test(normalisePagePath(pathname));
}

/** Whether a page is served at this address — or might be (the register's). */
export function isPagePath(pathname: string): boolean {
  const p = normalisePagePath(pathname);
  return PAGES.has(p) || DYNAMIC.test(p);
}

/** The header the middleware marks a request with when it has answered 404
 *  for it: the catch-all route draws the folio only for a request so marked,
 *  and raises "not found" itself for any that reached it another way. */
export const MISSING_HEADER = 'x-qhr-missing';
