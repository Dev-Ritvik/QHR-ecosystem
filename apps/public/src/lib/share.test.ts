import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_PARTS, SITE_SMALL_PRINT } from '@/components/site/siteMap';
import { SHARE_SIZE, shareImage, withShare } from './share';

// What a link to the site looks like where it is pasted, and what a browser is
// told about the site (the forensic audit of 2026-10-09, #95).

const APP = join(__dirname, '../app');
const PUBLIC = join(__dirname, '../../public');
const read = (p: string) => readFileSync(join(APP, p), 'utf8').replace(/\r\n/g, '\n');

function pages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) pages(full, out);
    else if (name === 'page.tsx') out.push(full);
  }
  return out;
}

describe('a page’s card', () => {
  it('is the page’s own title, description, picture and address', () => {
    const m = withShare('/about', { title: 'About — Quality Homes Reality', description: 'Twenty years.' });
    expect(m.title).toBe('About — Quality Homes Reality');
    expect(m.alternates).toEqual({ canonical: '/about' });
    expect(m.openGraph).toMatchObject({
      type: 'website',
      siteName: 'Quality Homes Reality',
      url: '/about',
      title: 'About — Quality Homes Reality',
      description: 'Twenty years.',
    });
    const og = m.openGraph as { images: { url: string; width: number; height: number }[] };
    expect(og.images[0]).toMatchObject({ url: shareImage('/about'), ...SHARE_SIZE });
    expect(m.twitter).toMatchObject({ card: 'summary_large_image', title: 'About — Quality Homes Reality' });
    // what a page said beyond these is kept
    expect(withShare('/privacy', { title: 't', robots: { index: false } }).robots).toEqual({ index: false });
  });

  it('is on every page that has a title of its own', () => {
    const without: string[] = [];
    for (const f of pages(join(APP, '(site)/(experience)'))) {
      const src = readFileSync(f, 'utf8');
      if (!/export const metadata\b/.test(src)) continue; // a layout's own page writes its card itself
      if (/\[\.\.\.missing\]/.test(f)) continue; // a page that is not there has no card
      if (!/export const metadata: Metadata = withShare\('\/[^']*', \{/.test(src)) without.push(f.slice(APP.length + 1));
    }
    expect(without).toEqual([]);
    // the film's, at the site's own address
    expect(read('(site)/(experience)/site-home/page.tsx')).toContain("export const metadata: Metadata = withShare('/', {");
  });

  it('is the layouts’ too: each its model on its table, and no card drawn by a route of its own', () => {
    // (Their card was a starter kit's: a grey sheet in a sans-serif that said
    // ESTATE where the company's name belongs, and could not load its font on
    // Windows. The forensic re-audit, 17 October 2026.)
    const layout = read('(site)/(experience)/projects/[projectSlug]/page.tsx');
    expect(layout).toContain('return withShare(`/projects/${projectSlug}`, { title, description });');
    // and described as the page opens: by its sheet's summary, the page's own lede
    expect(layout).toMatch(/const description =\n {4}sheet\?\.summary \|\|/);
    expect(layout).toContain('lede={layout?.summary ??');
    const drawn: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/^(opengraph|twitter)-image\.(tsx?|jsx?)$/.test(name)) drawn.push(full.slice(APP.length + 1));
      }
    };
    walk(APP);
    expect(drawn).toEqual([]);
    for (const slug of ['kartikeya-water-front', 'lucky-garden', 'vsr-gayatri-township']) {
      const href = `/projects/${slug}`;
      expect(shareImage(href)).toMatch(/^\/share\/place-(table|window|study)\.jpg$/);
      expect(existsSync(join(PUBLIC, shareImage(href))), href).toBe(true);
    }
  });

  it('says something of its own: no two pages share a description', () => {
    // (/gallery and /downloads said the same sentence: the forensic re-audit, 17 October 2026.)
    const seen = new Map<string, string>();
    const twice: string[] = [];
    for (const f of pages(join(APP, '(site)/(experience)'))) {
      const src = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
      const m = /withShare\('[^']*', \{[\s\S]*?description:\s*'((?:[^'\\]|\\.)*)'/.exec(src);
      if (!m) continue;
      const page = f.slice(APP.length + 1);
      if (seen.has(m[1])) twice.push(`${seen.get(m[1])} and ${page}`);
      else seen.set(m[1], page);
    }
    expect(seen.size).toBeGreaterThan(20);
    expect(twice).toEqual([]);
  });

  it('has a picture published for every page of the site, and for the film', () => {
    const hrefs = ['/', ...SITE_PARTS.flatMap((p) => p.pages.map((l) => l.href)), ...SITE_SMALL_PRINT.map((l) => l.href)];
    expect(hrefs.length).toBeGreaterThan(20);
    for (const href of hrefs) {
      expect(shareImage(href)).toMatch(/^\/share\/(film-hero|place-[a-z]+)\.jpg$/);
      expect(existsSync(join(PUBLIC, shareImage(href))), `${href}: ${shareImage(href)}`).toBe(true);
    }
  });
});

describe('what a browser is told about the site', () => {
  it('says the domain once, and the bar’s colour', () => {
    const root = read('layout.tsx');
    expect(root).toContain("metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'),");
    expect(root).toContain("themeColor: '#15110C',");
    // no page writes an address with a domain in it
    for (const f of pages(join(APP, '(site)'))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/https?:\/\/(www\.)?qualityhomesreality\./);
    }
  });

  it('has the icons a browser and a phone ask for, drawn from the client’s own mark', () => {
    for (const f of ['favicon.ico', 'apple-icon.png', 'icon.svg', 'manifest.ts']) expect(existsSync(join(APP, f)), f).toBe(true);
    for (const f of ['icons/icon-192.png', 'icons/icon-512.png']) expect(existsSync(join(PUBLIC, f)), f).toBe(true);
    const draw = readFileSync(join(__dirname, '../../scripts/brand/icons.mjs'), 'utf8');
    expect(draw).toContain("fs.readFileSync('public/brand/qhr-mark.svg', 'utf8')");
    // the mark's own files are as the client supplied them: nothing here writes to them
    expect(draw).not.toMatch(/writeFileSync\('public\/brand/);
  });

  it('writes a tab’s title one way: a name, a dash, the house', () => {
    for (const f of pages(join(APP, '(site)/(experience)'))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/\| Quality Homes Reality/);
    }
  });
});
