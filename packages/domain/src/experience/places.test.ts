import { describe, it, expect } from 'vitest';
import {
  placeForRoute,
  routeKind,
  normalisePath,
  allKnownRoutes,
  PLACE_ROUTES,
  SURFACE_ROUTES,
  PLACES,
} from './places';

describe('route to place mapping', () => {
  it('stands the hall at the stair and the layouts at a table', () => {
    // Both are the room. The hall's page is the room whole; the layouts' index
    // is a table in it with a layout raised on it.
    expect(placeForRoute('/hall')).toBe('hall');
    expect(placeForRoute('/projects')).toBe('tables');
  });

  it('opens the company under its portrait and the districts on their map', () => {
    expect(placeForRoute('/about')).toBe('portrait');
    expect(placeForRoute('/locations')).toBe('map');
    // (not the map table again, a little higher: the audit's "two share the
    // map table". Its pins are layouts, not offices.)
    expect(placeForRoute('/branches')).toBe('sconces');
  });

  it('stands a layout at its own table, and a plot under it', () => {
    expect(placeForRoute('/projects/kartikeya-water-front')).toBe('table');
    expect(placeForRoute('/projects/lucky-garden')).toBe('window');
    expect(placeForRoute('/projects/vsr-gayatri-township')).toBe('study');
    expect(placeForRoute('/projects/lucky-garden/42')).toBe('window');
    expect(placeForRoute('/projects/lucky-garden/?utm_source=meta')).toBe('window');
    // A layout the registry does not know stands where the index does: at a
    // table in the room.
    expect(placeForRoute('/projects/a-layout-added-tomorrow')).toBe('tables');
  });

  it('resolves dynamic children to their parent place', () => {
    expect(placeForRoute('/knowledge/why-poosapatirega')).toBe('attic');
    // an article that has a place of its own stands at it
    expect(placeForRoute('/knowledge/reading-a-layout-plan')).toBe('reading');
    expect(routeKind('/projects/lucky-garden')).toBe('place');
    expect(routeKind('/knowledge/some-post')).toBe('surface');
  });

  it('gives every page a picture of its own (the forensic audit of 2026-10-09, #66)', () => {
    // Four pages opened on the dome and seven on the founder's portrait over
    // the stair, the small print and the error page among them.
    const pages = [...Object.keys(PLACE_ROUTES), ...Object.keys(SURFACE_ROUTES)].filter((r) => r !== '/');
    const seen = new Map<string, string>();
    for (const r of pages) {
      const place = placeForRoute(r);
      // (the film's first frame is /start-here's, by day: the one shared place)
      if (place === 'arrival') continue;
      expect(seen.get(place), `${r} shares ${place} with ${seen.get(place)}`).toBeUndefined();
      seen.set(place, r);
    }
    // the three layouts' own, and the page that is not there
    for (const r of ['/projects/kartikeya-water-front', '/projects/lucky-garden', '/projects/vsr-gayatri-township', '/no-such-page']) {
      const place = placeForRoute(r);
      expect(seen.get(place), `${r} shares ${place}`).toBeUndefined();
      seen.set(place, r);
    }
    // and no portrait on the small print or on a page that is not there
    for (const r of ['/privacy', '/terms', '/cookie-policy', '/refund-policy', '/sitemap', '/no-such-page']) {
      expect(['portrait', 'hall']).not.toContain(placeForRoute(r));
      expect(routeKind(r) === 'surface' || r === '/no-such-page').toBe(true);
    }
    expect(placeForRoute('/investment-guide')).toBe('dome');
    expect(placeForRoute('/privacy')).toBe('shut');
    expect(placeForRoute('/sitemap')).toBe('above');
  });

  it('stands a conversation at the desk and a visit at the door', () => {
    expect(placeForRoute('/contact')).toBe('desk');
    expect(placeForRoute('/book-a-site-visit')).toBe('door');
    // the roles open now: the bench with nobody on it
    expect(placeForRoute('/careers')).toBe('bench');
  });

  it('never returns null for an unmapped route', () => {
    // An empty frame behind a panel is the white page this whole architecture
    // exists to avoid, so unknown routes still stand somewhere.
    // …at the table with nothing on it, not under the founder's portrait
    expect(placeForRoute('/nonsense')).toBe('empty');
    expect(placeForRoute('/')).toBe('arrival');
    expect(routeKind('/nonsense')).toBe('unknown');
  });

  it('strips query, hash and trailing slash', () => {
    expect(normalisePath('/faqs/')).toBe('/faqs');
    expect(normalisePath('/faqs?q=1')).toBe('/faqs');
    expect(normalisePath('/faqs#top')).toBe('/faqs');
    expect(normalisePath('')).toBe('/');
    expect(placeForRoute('/faqs/?utm_source=meta')).toBe('stair');
  });

  it('assigns every mapped route to a real place', () => {
    for (const [route, place] of Object.entries({ ...PLACE_ROUTES, ...SURFACE_ROUTES })) {
      expect(PLACES, `${route} -> ${place}`).toContain(place);
    }
  });

  it('never classes a route as both a place and a surface', () => {
    const overlap = Object.keys(PLACE_ROUTES).filter((r) => r in SURFACE_ROUTES);
    expect(overlap).toEqual([]);
  });

  it('keeps pages that are about their place fewer than pages read from one', () => {
    // The point of the model was ~7 places and everything else instant, so
    // that 26 routes did not cost 26 camera flights. A page costs no flight
    // now: it is cut to under the route veil and opens on a still frame. What
    // the split still guards is meaning — most pages are read FROM somewhere,
    // and only a few are ABOUT where they stand.
    expect(Object.keys(PLACE_ROUTES).length).toBeLessThan(
      Object.keys(SURFACE_ROUTES).length,
    );
  });

  it('uses every place it declares, so none is a pose nobody can reach', () => {
    const used = new Set<string>([
      ...Object.values(PLACE_ROUTES),
      ...Object.values(SURFACE_ROUTES),
      // the three layouts, each at its own table
      placeForRoute('/projects/kartikeya-water-front'),
      placeForRoute('/projects/lucky-garden'),
      placeForRoute('/projects/vsr-gayatri-township'),
      // and the address that is not a page
      placeForRoute('/no-such-page'),
    ]);
    for (const place of PLACES) expect(used, place).toContain(place);
  });

  it('covers enough of the brief to be worth shipping', () => {
    // 20 numbered routes + 6 footer = 26. Home, project detail, property detail
    // and 404 resolve through parents or the fallback rather than the map.
    expect(allKnownRoutes().length).toBeGreaterThanOrEqual(22);
  });
});
