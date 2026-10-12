// apps/public/src/lib/layouts.test.ts
//
// What the three layouts ARE, kept once — held to the other places the same
// facts live (the lead router's own record of them, the files a page offers)
// and to the rules the pages are written under: nothing invented, no compass
// point a sheet does not give, no key a sheet does not print.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRANCHES, PROJECTS } from '@estate/domain/leads/branches';
import { COMPANY } from './company';
import { LAYOUTS, layoutBySlug, plotArea, plotAreaLabel } from './layouts';
import { countLine, num, totals } from './published';

const PUBLIC = join(__dirname, '../../public');
const read = (p: string) => readFileSync(join(__dirname, p), 'utf8').replace(/\r\n/g, '\n');

describe('the three layouts', () => {
  it("are the lead router's three, by slug, name, place and the office that holds each", () => {
    expect(LAYOUTS.map((l) => l.slug)).toEqual(PROJECTS.map((p) => p.slug));
    for (const p of PROJECTS) {
      const l = layoutBySlug(p.slug)!;
      expect(l.name).toBe(p.name);
      expect(l.district).toBe(p.district);
      expect(l.where).toBe(p.locality);
      expect(l.branch).toBe(p.branch);
      expect(BRANCHES[l.branch]).toBeDefined();
    }
    expect(layoutBySlug('not-a-layout')).toBeUndefined();
  });

  it('offer files that exist, at the sizes the pages state', () => {
    for (const l of LAYOUTS) {
      const jpg = join(PUBLIC, l.plan.src);
      const pdf = join(PUBLIC, l.plan.pdf);
      expect(existsSync(jpg), l.plan.src).toBe(true);
      expect(existsSync(pdf), l.plan.pdf).toBe(true);
      // "118 KB" is the file's size to the nearest kilobyte
      const kb = Number(/^(\d+) KB$/.exec(l.plan.pdfSize)![1]);
      expect(Math.abs(statSync(pdf).size / 1024 - kb), l.plan.pdf).toBeLessThanOrEqual(1);
    }
  });

  it('state each plan image at its own proportions', () => {
    // read off the JPEG's own header: a wrong ratio is a plan that jumps as it loads
    for (const l of LAYOUTS) {
      const b = readFileSync(join(PUBLIC, l.plan.src));
      let i = 2;
      let size: [number, number] | null = null;
      while (i < b.length && !size) {
        if (b[i] !== 0xff) break;
        const marker = b[i + 1];
        const len = b.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          size = [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
        }
        i += 2 + len;
      }
      expect(size, l.plan.src).toEqual([l.plan.w, l.plan.h]);
    }
  });
});

describe('sizes and areas', () => {
  it('works an area from the printed dimensions, nine square feet to the square yard', () => {
    expect(plotArea({ label: '', feet: [30, 60] })).toEqual({ sqFt: 1800, sqYd: 200 });
    expect(plotArea({ label: '', feet: [15, 60] })).toEqual({ sqFt: 900, sqYd: 100 });
    expect(plotArea({ label: '', feet: [30, 50] })).toEqual({ sqFt: 1500, sqYd: 166.67 });
    expect(plotAreaLabel({ label: '', feet: [30, 56] })).toBe('1,680 sq ft · 186.67 sq yd');
    expect(plotAreaLabel({ label: '', feet: [18, 60] })).toBe('1,080 sq ft · 120 sq yd');
  });

  it('labels every size as its own figures, in feet', () => {
    for (const l of LAYOUTS) {
      expect(l.sizes.length).toBeGreaterThan(0);
      for (const s of l.sizes) expect(s.label).toBe(`${s.feet[0]}′ × ${s.feet[1]}′`);
      expect(l.roadWidths.length).toBeGreaterThan(0);
      // the widths a page prints as figures are in the sentence a page prints as words
      for (const w of l.roadWidths) expect(l.roads, l.slug).toContain(`${w} ft`);
      expect([...l.roadWidths].sort((a, b) => b - a)).toEqual(l.roadWidths);
    }
  });

  it('offers six sizes between the three, from a hundred square yards to two hundred', () => {
    const areas = LAYOUTS.flatMap((l) => l.sizes.map((s) => plotArea(s).sqYd));
    expect(areas.length).toBe(6);
    expect(Math.min(...areas)).toBe(100);
    expect(Math.max(...areas)).toBe(200);
  });
});

describe('only what the sheets print', () => {
  const all = (l: (typeof LAYOUTS)[number]) =>
    [l.summary, l.roads, l.approach ?? '', l.approval.line, ...l.onTheSheet, ...l.access, ...l.features].join(' | ');

  it('names a side of the compass only for the sheet that carries a north point', () => {
    const compass = /\b(north|south|east|west)(ern|-east|-west)?\b/i;
    expect(compass.test(all(layoutBySlug('kartikeya-water-front')!))).toBe(true);
    expect(compass.test(all(layoutBySlug('lucky-garden')!))).toBe(false);
    expect(compass.test(all(layoutBySlug('vsr-gayatri-township')!))).toBe(false);
  });

  it('claims no key for the marks on the two sheets that print none', () => {
    for (const slug of ['lucky-garden', 'vsr-gayatri-township']) {
      const text = all(layoutBySlug(slug)!);
      expect(text, slug).not.toMatch(/status is marked|marked as sold|shows which plots/i);
      expect(text, slug).toMatch(/prints no key/);
    }
  });

  it('gives a reference only where the paper in hand prints one', () => {
    expect(layoutBySlug('vsr-gayatri-township')!.approval.reference).toBe('F.L.P. No. 10/2025/1178/DTCP/DPMS');
    expect(layoutBySlug('kartikeya-water-front')!.approval.reference).toBeNull();
    const lucky = layoutBySlug('lucky-garden')!.approval;
    expect(lucky.reference).toBeNull();
    expect(lucky.line).toMatch(/Ask the branch/);
  });

  it('lists features only for the layout whose brochure lists them', () => {
    expect(layoutBySlug('kartikeya-water-front')!.features.length).toBeGreaterThan(5);
    expect(layoutBySlug('lucky-garden')!.features).toEqual([]);
    expect(layoutBySlug('vsr-gayatri-township')!.features).toEqual([]);
  });

  it('prints no price, yield, date or distance it was not given', () => {
    for (const l of LAYOUTS) {
      const text = all(l);
      expect(text, l.slug).not.toMatch(/₹|\brs\.?\b|lakh|crore|per sq|%|appreciat|return on/i);
      // (an approval's own reference carries its year: that is the authority's, and quoted)
      const undated = l.approval.reference ? text.split(l.approval.reference).join('') : text;
      expect(undated, l.slug).not.toMatch(/\b(20\d\d|by (march|june|december))\b/i);
      // one distance is printed on a brochure, and quoted: Gayatri's to the highway
      const km = text.match(/kilometre/gi) ?? [];
      expect(km.length, l.slug).toBe(l.slug === 'vsr-gayatri-township' ? 1 : 0);
    }
  });
});

describe('what the register says, as a page prints it', () => {
  it('says how many plots, and how many are open', () => {
    expect(countLine({ total: 113, available: 113, soldOut: false })).toBe('113 plots, all open');
    expect(countLine({ total: 181, available: 118, soldOut: false })).toBe('181 plots, 118 open');
    expect(countLine({ total: 40, available: 0, soldOut: true })).toBe('40 plots, none open');
    expect(countLine({ total: 1250, available: null, soldOut: false })).toBe('1,250 plots');
  });

  it('says nothing where the register gives no figure', () => {
    expect(countLine(undefined)).toBeNull();
    expect(countLine({ total: null, available: null, soldOut: false })).toBeNull();
  });

  it('adds the layouts up only when every one of them has both figures', () => {
    const p = (total: number | null, available: number | null) => ({
      projectId: 'x',
      slug: 'x',
      name: 'x',
      total,
      available,
      soldOut: false,
    });
    expect(totals([p(113, 113), p(181, 118), p(113, 113)])).toEqual({ total: 407, available: 344, layouts: 3 });
    expect(totals([p(113, 113), p(null, null)])).toBeNull();
    expect(totals([])).toBeNull();
    expect(num(123456)).toBe('1,23,456');
  });
});

describe('the company, kept once', () => {
  it("is the name on the plate under the portrait in the hall", () => {
    const plate = read('../components/experience/PortraitNameplate.tsx');
    expect(plate).toContain(`name: '${COMPANY.founder.name}'`);
    expect(plate).toContain(`title: '${COMPANY.founder.title}'`);
  });

  it('prints one telephone number, the one the film and the footer print', () => {
    expect(COMPANY.phone.href).toBe(`tel:${COMPANY.phone.display.replace(/\s/g, '')}`);
    const footer = read('../components/site/SiteFooter.tsx');
    expect(footer).toContain(COMPANY.phone.href);
    expect(footer).toContain(COMPANY.phone.display);
  });

  it('carries the four figures, and no credential it cannot show the paper for', () => {
    expect(COMPANY.figures.map((f) => f.value)).toEqual(['20', '5,000', '12', '8']);
    const said = JSON.stringify(COMPANY);
    expect(said).not.toMatch(/ISO|CREDAI|award|Economic Times/i);
  });
});
