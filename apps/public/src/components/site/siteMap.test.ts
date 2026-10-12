// apps/public/src/components/site/siteMap.test.ts
//
// The site, set out once — and the three ways a page used to get lost, held
// shut: named and not built, built and not listed, listed twice.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLACE_ROUTES, SURFACE_ROUTES, placeForRoute, routeKind } from '@estate/domain/experience/places';
import { SITE_PARTS, SITE_SMALL_PRINT, pageAfter, partOf, sitePagesInOrder } from './siteMap';

const APP = join(__dirname, '../../app/(site)/(experience)');
const read = (p: string) => readFileSync(join(__dirname, p), 'utf8').replace(/\r\n/g, '\n');
const pageFile = (route: string) => join(APP, route.replace(/^\//, ''), 'page.tsx');

/** Every static route the experience group serves, read off the file system. */
function builtRoutes(dir = APP, base = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name.startsWith('[')) continue; // a layout's own page, the catch-all
    const route = `${base}/${name}`;
    if (existsSync(join(full, 'page.tsx'))) out.push(route);
    out.push(...builtRoutes(full, route));
  }
  return out;
}

const all = [...sitePagesInOrder(), ...SITE_SMALL_PRINT];

describe('the site map', () => {
  it('names twenty-three pages: eighteen in four parts and five of small print', () => {
    expect(SITE_PARTS.map((p) => p.title)).toEqual(['The land', 'The company', 'Before you buy', 'Come and see']);
    expect(sitePagesInOrder().length).toBe(18);
    expect(SITE_SMALL_PRINT.length).toBe(5);
  });

  it('has a page behind every address it names', () => {
    for (const p of all) expect(existsSync(pageFile(p.href)), p.href).toBe(true);
  });

  it('names every page that is built, so none can be reached only by typing its address', () => {
    const named = new Set(all.map((p) => p.href));
    const orphans = builtRoutes().filter(
      (r) =>
        !named.has(r) &&
        // the film is the home page; an article is reached from its index
        r !== '/site-home' &&
        !r.startsWith('/knowledge/'),
    );
    expect(orphans).toEqual([]);
  });

  it('names no page twice, and gives each a name and a line about it', () => {
    const hrefs = all.map((p) => p.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const p of all) {
      expect(p.href.startsWith('/'), p.href).toBe(true);
      expect(p.name.length, p.href).toBeGreaterThan(2);
      expect(p.line.length, p.href).toBeGreaterThan(20);
      expect(p.line.endsWith('.'), p.href).toBe(true);
    }
  });

  it('stands every page somewhere in the house', () => {
    const registered = new Set([...Object.keys(PLACE_ROUTES), ...Object.keys(SURFACE_ROUTES)]);
    for (const p of all) {
      expect(registered.has(p.href), `${p.href} is not in places.ts`).toBe(true);
      expect(routeKind(p.href), p.href).not.toBe('unknown');
      expect(placeForRoute(p.href)).toBeTruthy();
    }
    // and the registry names nothing that is not a page (but the film itself)
    for (const r of registered) {
      if (r === '/') continue;
      expect(existsSync(pageFile(r)), `${r} is registered and has no page`).toBe(true);
    }
  });
});

describe('the order the site is read in', () => {
  it('gives every page a page after it, and comes back round to the land', () => {
    const order = sitePagesInOrder();
    order.forEach((p, i) => {
      const next = pageAfter(p.href);
      expect(next.href).toBe(order[(i + 1) % order.length].href);
      expect(next.href).not.toBe(p.href);
    });
    expect(pageAfter(order[order.length - 1].href).href).toBe('/projects');
  });

  it('tells the land first, then who sells it, then what to check, then how to see it', () => {
    const order = sitePagesInOrder().map((p) => p.href);
    const at = (h: string) => order.indexOf(h);
    expect(at('/projects')).toBe(0);
    expect(at('/projects')).toBeLessThan(at('/about'));
    expect(at('/about')).toBeLessThan(at('/investment-guide'));
    expect(at('/investment-guide')).toBeLessThan(at('/book-a-site-visit'));
  });

  it('knows the part a page belongs to', () => {
    expect(partOf('/gallery')?.title).toBe('The land');
    expect(partOf('/careers')?.title).toBe('The company');
    expect(partOf('/faqs')?.title).toBe('Before you buy');
    expect(partOf('/contact')?.title).toBe('Come and see');
    expect(partOf('/privacy')).toBeUndefined();
  });

  it('ends every page of the four parts on the page after it', () => {
    for (const p of sitePagesInOrder()) {
      const src = readFileSync(pageFile(p.href), 'utf8');
      expect(src, p.href).toContain(`pageAfter('${p.href}')`);
      expect(src, p.href).toContain('<NextPage href={next.href}');
    }
  });
});

describe('the one list, read by everything that lists pages', () => {
  it('is what the menu, the footer and the sitemap page are made from', () => {
    for (const file of ['./SiteHeader.tsx', './SiteFooter.tsx', '../../app/(site)/(experience)/sitemap/page.tsx']) {
      let src = read(file);
      expect(src, file).toContain('SITE_PARTS');
      // (The film's own colophon keeps the twelve links its last frame was
      // composed for, two rows of six: what is held here is a PAGE's.)
      if (file === './SiteFooter.tsx') src = src.slice(src.indexOf('function PageColophon'));
      // and not from a list of its own
      for (const p of sitePagesInOrder()) {
        if (p.href === '/contact' || p.href === '/hall' || p.href === '/book-a-site-visit') continue; // each has an action of its own there
        expect(src.includes(`href="${p.href}"`) || src.includes(`href: '${p.href}'`), `${file} lists ${p.href} by hand`).toBe(false);
      }
    }
  });

  it('opens every page as a folio: a plate, sheets, and the film in its header and under it', () => {
    for (const p of all) {
      const src = readFileSync(pageFile(p.href), 'utf8');
      expect(src, p.href).toContain("from '@/components/folio/Folio'");
      expect(src, p.href).toContain('<Folio>');
      expect(src, p.href).toMatch(/<Plate\b/);
      expect(src, p.href).toMatch(/<Sheet\b/);
      // none of the old page: no navy, no column, no panel
      expect(src, p.href).not.toMatch(/0A1120|max-w-3xl|max-w-4xl|<Surface\b/);
    }
  });
});
