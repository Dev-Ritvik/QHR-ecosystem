import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECTS } from '@estate/domain/leads/branches';
import { placeForRoute } from '@estate/domain/experience/places';
import { inHallOrder } from './hallOrder';
import { LAYOUTS } from './layouts';

const src = (rel: string) => readFileSync(join(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');
const row = (slug: string) => ({ slug });

describe('which layout is on which table', () => {
  it('is the stations own order, whatever order the register returns its rows in', () => {
    const want = ['kartikeya-water-front', 'lucky-garden', 'vsr-gayatri-township'];
    // every order three rows can lie in on disk
    const orders = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];
    for (const o of orders) {
      expect(inHallOrder(o.map((i) => row(want[i]))).map((r) => r.slug)).toEqual(want);
    }
  });

  it('puts a layout the domain does not know yet after the ones it does, in the order it came', () => {
    const got = inHallOrder([row('new-b'), row('lucky-garden'), row('new-a'), row('kartikeya-water-front')]);
    expect(got.map((r) => r.slug)).toEqual(['kartikeya-water-front', 'lucky-garden', 'new-b', 'new-a']);
    expect(inHallOrder([])).toEqual([]);
  });

  it('keeps the rows themselves, and does not reorder the list it was given', () => {
    const a = { slug: 'vsr-gayatri-township', n: 1 };
    const b = { slug: 'kartikeya-water-front', n: 2 };
    const given = [a, b];
    const got = inHallOrder(given);
    expect(got[0]).toBe(b);
    expect(got[1]).toBe(a);
    expect(given).toEqual([a, b]);
  });

  it('agrees with where each layouts own page stands: the nth published layout is on the nth table', () => {
    // places.ts stands /projects/<slug> at the station the domain gives the
    // slug; the hall puts the nth published layout on the nth table. In the
    // hall's order the two are one account.
    const STATION_PLACE = { S1: 'table', S2: 'window', S3: 'study' } as const;
    const ordered = inHallOrder(PROJECTS.map((p) => row(p.slug)).reverse());
    ordered.forEach((r, i) => {
      const station = (['S1', 'S2', 'S3'] as const)[i];
      expect(PROJECTS.find((p) => p.slug === r.slug)!.station, r.slug).toBe(station);
      expect(placeForRoute(`/projects/${r.slug}`), r.slug).toBe(STATION_PLACE[station]);
    });
  });

  it('is the order the sheets are kept in too', () => {
    expect(inHallOrder(LAYOUTS).map((l) => l.slug)).toEqual(LAYOUTS.map((l) => l.slug));
  });

  it('is applied where the register is read, once a render, and a dropped line is asked again', () => {
    const projection = src('./projection.ts');
    expect(projection).toContain('export const getPublishedProjects = cache(async () =>');
    expect(projection).toContain('inHallOrder(await ask(() => db.select().from(projectsPub)))');
    expect(projection).toContain('export const getProjectBySlug = cache(async (slug: string) => {');
    // no list of layouts leaves this module in the order the rows lie on disk
    expect(projection).not.toMatch(/return db\.select\(\)\.from\(projectsPub\);/);
    // …and a layout's page stands without the register (its sheet), where it was a server error
    const page = src('../app/(site)/(experience)/projects/[projectSlug]/page.tsx');
    expect(page).toContain('const project: PageProject = real ?? fromSheet(onSheet!);');
    expect(page).toContain("throw new Error('The register did not answer, for a layout the sheets do not hold.');");
    expect(page).not.toMatch(/const project = await getProjectBySlug\(projectSlug\);/);
  });

  it('gives the page that did not load a plate of its own: its words were ivory on a lit ivory wall', () => {
    const error = src('../app/(site)/(experience)/error.tsx');
    expect(error).toContain('<header className="folio-plate" data-folio-plate>');
    expect(error).toContain('<div className="folio-plate-copy">');
    expect(error).toContain('onClick={reset}');
    expect(error).not.toContain('text-[#F2EDE4]/65');
  });
});
