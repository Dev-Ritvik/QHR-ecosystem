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
  it('treats the hall and the projects listing as the same place', () => {
    // The three tables ARE the projects listing — a separate location would be
    // a flight to see what you were already looking at.
    expect(placeForRoute('/hall')).toBe('hall');
    expect(placeForRoute('/projects')).toBe('hall');
  });

  it('resolves dynamic children to their parent place', () => {
    expect(placeForRoute('/projects/kartikeya-water-front')).toBe('hall');
    expect(placeForRoute('/knowledge/why-poosapatirega')).toBe('study');
    expect(routeKind('/projects/lucky-garden')).toBe('place');
    expect(routeKind('/knowledge/some-post')).toBe('surface');
  });

  it('reads legal and guidance surfaces from the study', () => {
    for (const r of ['/faqs', '/privacy', '/terms', '/investment-guide']) {
      expect(placeForRoute(r)).toBe('study');
      expect(routeKind(r)).toBe('surface');
    }
  });

  it('holds the frame at the desk for anything that starts a conversation', () => {
    expect(placeForRoute('/contact')).toBe('desk');
    expect(placeForRoute('/book-a-site-visit')).toBe('desk');
    expect(placeForRoute('/careers')).toBe('desk');
  });

  it('never returns null for an unmapped route', () => {
    // An empty frame behind a panel is the white page this whole architecture
    // exists to avoid, so unknown routes still stand somewhere.
    expect(placeForRoute('/nonsense')).toBe('hall');
    expect(placeForRoute('/')).toBe('arrival');
    expect(routeKind('/nonsense')).toBe('unknown');
  });

  it('strips query, hash and trailing slash', () => {
    expect(normalisePath('/faqs/')).toBe('/faqs');
    expect(normalisePath('/faqs?q=1')).toBe('/faqs');
    expect(normalisePath('/faqs#top')).toBe('/faqs');
    expect(normalisePath('')).toBe('/');
    expect(placeForRoute('/faqs/?utm_source=meta')).toBe('study');
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

  it('keeps places scarce relative to surfaces', () => {
    // The point of the model: ~7 places, everything else instant. If this ever
    // inverts, the design has drifted back into a camera flight per page.
    expect(Object.keys(PLACE_ROUTES).length).toBeLessThan(
      Object.keys(SURFACE_ROUTES).length,
    );
    expect(new Set(Object.values(PLACE_ROUTES)).size).toBeLessThanOrEqual(7);
  });

  it('covers enough of the brief to be worth shipping', () => {
    // 20 numbered routes + 6 footer = 26. Home, project detail, property detail
    // and 404 resolve through parents or the fallback rather than the map.
    expect(allKnownRoutes().length).toBeGreaterThanOrEqual(22);
  });
});
