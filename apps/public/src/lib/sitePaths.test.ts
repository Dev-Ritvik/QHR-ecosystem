import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MISSING_HEADER, isPagePath, looksLikeFile, normalisePagePath } from './sitePaths';

const APP = join(__dirname, '../app');
const src = (rel: string) => readFileSync(join(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');

/** Every page the app has, as the address it is served at. */
function pages(dir = APP, at: string[] = []): { path: string; dynamic: boolean; catchAll: boolean }[] {
  const out: { path: string; dynamic: boolean; catchAll: boolean }[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      // (group) folders are not part of an address; api routes are not pages
      if (name === 'api') continue;
      out.push(...pages(full, /^\(.*\)$/.test(name) ? at : [...at, name]));
    } else if (name === 'page.tsx') {
      out.push({
        path: '/' + at.join('/'),
        dynamic: at.some((s) => s.startsWith('[')),
        catchAll: at.some((s) => s.startsWith('[...')),
      });
    }
  }
  return out;
}

describe('which addresses are pages', () => {
  const all = pages();

  it('knows every page the app has', () => {
    expect(all.length).toBeGreaterThan(25);
    for (const p of all) {
      if (p.catchAll) continue;
      // the middleware's own rewrite targets: its matcher never sees them
      if (p.path === '/site-home' || p.path === '/present-home') continue;
      const address = p.dynamic ? p.path.replace(/\[[^\]]+\]/g, 'some-slug') : p.path;
      expect(isPagePath(address), address).toBe(true);
    }
  });

  it('does not take an address that is no page for one', () => {
    for (const p of ['/no-such-page', '/abuot', '/about/us', '/projects', '/knowledge/no-such-article', '/p', '/projects/a/b/c']) {
      if (p === '/projects') continue;
      expect(isPagePath(p), p).toBe(false);
    }
    expect(isPagePath('/projects')).toBe(true);
    expect(isPagePath('/about/')).toBe(true);
    expect(isPagePath('/about?x=1')).toBe(true);
    expect(normalisePagePath('/about/')).toBe('/about');
    expect(normalisePagePath('/')).toBe('/');
  });

  it('leaves a file to the filesystem', () => {
    for (const f of ['/favicon.ico', '/models/interior_hall.glb', '/stills/abc/film-hero.w22.webp', '/sitemap.xml', '/robots.txt', '/icon.svg', '/sw.js']) {
      expect(looksLikeFile(f), f).toBe(true);
    }
    for (const p of ['/about', '/projects/lucky-garden', '/no-such-page', '/a.b/c']) {
      expect(looksLikeFile(p), p).toBe(false);
    }
  });

  it('is what the middleware answers 404 by, and what the catch-all draws the folio for', () => {
    const mw = src('../middleware.ts');
    expect(mw).toContain("if (url.pathname !== '/' && !isPagePath(url.pathname) && !looksLikeFile(url.pathname)) {");
    expect(mw).toContain('NextResponse.rewrite(new URL(url.pathname, request.url), { status: 404, request: { headers } }),');
    expect(mw).toContain("headers.set(MISSING_HEADER, '1');");
    const page = src('../app/(site)/(experience)/[...missing]/page.tsx');
    expect(page).toContain("if (headers().get(MISSING_HEADER) !== '1') notFound();");
    expect(page).toContain('return <NotFoundFolio />;');
    expect(page).toContain("title: 'Page not found — Quality Homes Reality',");
    expect(MISSING_HEADER).toBe('x-qhr-missing');
    // and a folio drawn by the browser for a boundary says its title again
    expect(src('../components/folio/NotFoundFolio.tsx')).toContain('<TabTitle title={NOT_FOUND_TITLE} />');
  });
});
