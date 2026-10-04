// apps/public/src/components/experience/filmStage.test.ts
//
// The film's stage: on a wide frame the copy, its grid, the header and the
// lens's filters are all said in one unit — a pixel of the 1440x900 design —
// so the composition measured at that size is the composition on every wide
// frame. And the two grounds a reading page can stand its quietest text on.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHORT_QUERY, WIDE_QUERY, filmIsShort } from './copyZone';
import {
  HOLDINGS_ND,
  HOLDINGS_SHAPE,
  HOLDINGS_WIDE_OPEN,
  PHONE_HOLDINGS_BOOST,
  STAGE,
  STATION_ND,
  holdingsFilter,
  lensFilter,
  stationFilter,
} from './lensFilter';
import { READING_CEILING } from './readingLight';

const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');
const css = read('../../app/globals.css');
const config = read('../../../tailwind.config.ts');
const page = read('../../app/(site)/(experience)/site-home/page.tsx');
const header = read('../site/SiteHeader.tsx');

/** The stage's own block of the stylesheet. */
function stageBlock(): string {
  const open = `@media ${WIDE_QUERY} {\n  .film-stage {`;
  const at = css.indexOf(open);
  if (at < 0) throw new Error('no .film-stage block inside the wide query');
  return css.slice(at + open.length, css.indexOf('\n  }\n}', at));
}

/** `--name: value;` from a block of declarations. */
function decl(block: string, name: string): string {
  const m = new RegExp(`\\n\\s*${name.replace(/[-]/g, '\\-')}:\\s*([^;]+);`).exec(block);
  if (!m) throw new Error(`no ${name}`);
  return m[1].trim();
}

const STEPS = [-2, -1, 0, 1, 2, 3, 4, 5, 6];

describe("the film's stage", () => {
  const block = stageBlock();

  it('is a wide frame only: everywhere else the unit is a pixel and the grid is 72rem', () => {
    const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}\n', css.indexOf(':root {')));
    expect(decl(root, '--u')).toBe('1px');
    expect(decl(root, '--bl')).toBe('0.25rem');
    expect(decl(root, '--grid-max')).toBe('72rem');
    expect(decl(root, '--bar')).toBe('62px');
    // and only one block sets the unit to anything else
    expect(css.match(/--u:/g)?.length).toBe(2);
    expect(read('../../app/(site)/layout.tsx')).toContain('className="flex-1 pt-[62px] outline-none"');
  });

  it("is one pixel of the 1440x900 design: the frame's height, or its width where it is squarer than 4:3", () => {
    expect(decl(block, '--u')).toBe('min(calc(100vh / 900), calc(100vw / 1200))');
    // the lens places its filters by the same two numbers
    expect(STAGE.aspect).toBeCloseTo(1440 / 900, 12);
    expect(STAGE.safe).toBeCloseTo(1200 / 900, 12);
  });

  it("sets every step at the design's size to the fluid scale's own 1440 end", () => {
    const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}\n', css.indexOf(':root {')));
    for (const n of STEPS) {
      const fluid = /clamp\(([\d.]+)rem, ([\d.]+)rem \+ (-?[\d.]+)vw, ([\d.]+)rem\)/.exec(decl(root, `--step-${n}`));
      const staged = /^max\(([\d.]+)rem, calc\(([\d.]+) \* var\(--u\)\)\)$/.exec(decl(block, `--step-${n}`));
      expect(fluid, `--step-${n} on :root`).not.toBeNull();
      expect(staged, `--step-${n} on the stage`).not.toBeNull();
      // the fluid step at a 1440px frame: its slope there, between its two ends
      const [lo, base, slope, hi] = fluid!.slice(1).map(Number);
      const at1440 = Math.min(hi, Math.max(lo, base + (slope * 14.4) / 16)) * 16;
      // the same size at 1440x900, to a hundredth of a pixel...
      expect(Number(staged![2])).toBeCloseTo(at1440, 1);
      // ...and the floor is under it, so the design is the design at its own size
      expect(Number(staged![1]) * 16).toBeLessThan(Number(staged![2]));
    }
  });

  it('never sets type smaller than can be read: a floor that is a scale of its own, in rems', () => {
    const floors = STEPS.map((n) => Number(/^max\(([\d.]+)rem/.exec(decl(block, `--step-${n}`))![1]) * 16);
    // 14px reading text, 10px capitals
    expect(floors[2]).toBeCloseTo(14, 2);
    expect(floors[0]).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < floors.length; i += 1) expect(floors[i] / floors[i - 1]).toBeCloseTo(1.18, 2);
  });

  it('carries the baseline, the grid and the header with it', () => {
    expect(decl(block, '--bl')).toMatch(/^max\([\d.]+rem, calc\(4 \* var\(--u\)\)\)$/);
    expect(decl(block, '--grid-max')).toBe('calc(1152 * var(--u))');
    expect(decl(block, '--bar')).toMatch(/^max\([\d.]+rem, calc\(62 \* var\(--u\)\)\)$/);
    // 1152 is 72rem, 62 the bar, at the design's size
    expect(1152 / 16).toBe(72);
    expect(css).toMatch(/\.site-grid \{[^}]*max-width: var\(--grid-max\);[^}]*padding-inline: calc\(var\(--bl\) \* 6\);/);
  });

  it('makes every space a count of baselines, so the gaps scale with the type', () => {
    expect(config).toContain('const baselines = (n: number) => `calc(var(--bl, 0.25rem) * ${n})`;');
    expect(config).toContain('spacing: Object.fromEntries(SPACING_STEPS.map((n) => [String(n), baselines(n)])),');
    expect(config).toContain('lineHeight: Object.fromEntries(LEADING_STEPS.map((n) => [String(n), baselines(n)])),');
    // every step Tailwind's own scale has, so no utility falls back to a rem
    const steps = /const SPACING_STEPS = \[([^\]]+)\]/.exec(config)![1].split(',').map((x) => Number(x.trim()));
    for (const n of [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96]) {
      expect(steps).toContain(n);
    }
  });

  it('has the film, its header and its menu on it — and nothing set in rems or vw beside the picture', () => {
    // (and <main> rests where the header ends: the layout pads 62px for a bar that is now --bar tall)
    expect(page).toContain('<main className={`film-stage mt-[calc(var(--bar)_-_62px)] pb-40 ${TRACK_ROOT_TRANSPARENT}`}>');
    expect(header).toContain("? 'film-stage bg-transparent'");
    expect(header).toContain("(overFilm ? ' film-stage md:px-0 md:pt-[calc(152*var(--u))]' : ' md:hidden')");
    expect(header).toContain('site-grid h-[var(--bar)]');
    // the chapters' grid and measures
    expect(page).not.toMatch(/className=[^\n]*max-w-6xl/);
    expect(page).not.toMatch(/wide:max-w-\[\d+vw\]/);
    expect(page.match(/max-w-\[var\(--grid-max\)\]/g)?.length).toBeGreaterThanOrEqual(8);
    // the cover is held under the header, whatever its height
    expect(page).toContain('sticky top-[var(--bar)] h-[calc(100vh_-_var(--bar))]');
  });
});

describe('a phone on its side', () => {
  const open = `@media ${SHORT_QUERY} {\n  .film-stage {`;
  const at = css.indexOf(open);
  const short = css.slice(at + open.length, css.indexOf('\n  }\n}', at));

  it("lets the large steps follow the frame further down: a headline no larger against the picture than it was drawn", () => {
    expect(at).toBeGreaterThan(0);
    // 844x390: the unit is 390 / 900
    const u = 390 / 900;
    const size = (n: number) => {
      const m = /^max\(([\d.]+)rem, calc\(([\d.]+) \* var\(--u\)\)\)$/.exec(decl(short, `--step-${n}`))!;
      return { px: Math.max(Number(m[1]) * 16, Number(m[2]) * u), design: Number(m[2]) };
    };
    // the cover's headline within a tenth of its drawn proportion (it was 1.5 times it at the stage's floor)
    expect(size(5).px / (size(5).design * u)).toBeLessThan(1.1);
    // and nothing in the frame under 14px but the capitals
    for (const n of [1, 2, 3, 4, 5, 6]) expect(size(n).px).toBeGreaterThanOrEqual(14);
    for (const n of [2, 3, 4, 5, 6]) expect(size(n).px).toBeGreaterThan(size(n - 1).px);
  });

  it("takes each chapter's gloss off the picture but not out of the page, and keeps every heading and link", () => {
    // off the frame, still read by a screen reader: never display:none on copy.
    // Three glosses and the establishing copy's second sentence.
    expect(page.match(/short:sr-only/g)?.length).toBe(4);
    expect(read('../site/CityLink.tsx')).toContain('short:sr-only');
    // nothing is hidden outright any more (the one thing that was, was a rule)
    expect(page.split('\n').filter((l) => l.includes('short:hidden')).length).toBe(0);
    for (const kept of ['<h1 className="t-display', 'className="cta-primary"', '<StationText', '<CityLink']) {
      const line = page.split('\n').find((l) => l.includes(kept))!;
      expect(line).not.toMatch(/short:(hidden|sr-only)/);
    }
  });
});

describe('a phone on its side, to the lens', () => {
  it('is a landscape frame no taller than 520px, whatever its width', () => {
    expect(filmIsShort(844, 390)).toBe(true);
    expect(filmIsShort(667, 375)).toBe(true);
    expect(filmIsShort(1280, 593)).toBe(false);
    expect(filmIsShort(390, 844)).toBe(false);
  });

  it("opens the holdings' grad at least as dense as the upright phone's, and gives it back", () => {
    holdingsFilter(0.44, 844 / 390);
    expect(lensFilter.stops).toBeCloseTo(HOLDINGS_ND.open + HOLDINGS_WIDE_OPEN, 5);
    expect(HOLDINGS_WIDE_OPEN).toBeGreaterThanOrEqual(PHONE_HOLDINGS_BOOST);
    // settled, it is the chapter's own density on every frame
    holdingsFilter(0.6, 844 / 390);
    expect(lensFilter.stops).toBeCloseTo(HOLDINGS_ND.stops, 5);
  });

  it('carries no gilt in a headline: at 18 to 21px it is small text', () => {
    const open = `@media ${SHORT_QUERY} {`;
    const block = css.slice(css.indexOf(open), css.indexOf('\n}\n', css.indexOf(open)));
    expect(block).toMatch(/\.film-stage \.t-display-em \{\s*color: inherit;/);
    expect(page).toContain('<span className="text-[#E8B98A] short:text-[#F2EDE4]">counted in full</span>');
  });
});

describe('the lens on the stage: a filter is made for the picture, not the screen', () => {
  /** The burnt edge at the tables, in the picture: frame heights from the
   *  middle of the frame to where the density starts to fall and where it is
   *  gone, along the frame's own middle line. */
  const edge = (aspect: number) => {
    stationFilter({ S1: 1 }, true, aspect);
    const [cx, , rx] = lensFilter.shape.toArray();
    return { full: (cx + rx * lensFilter.inner - 0.5) * aspect, gone: (cx + rx - 0.5) * aspect, uvGone: cx + rx };
  };

  it("is the measured shape at the design's own frame", () => {
    stationFilter({ S1: 1 }, true);
    expect(lensFilter.shape.toArray()).toEqual([-0.55, 0.5, 1.02, 2.4]);
    stationFilter({ S1: 1 }, true, 1440 / 900);
    expect(lensFilter.shape.toArray()).toEqual([-0.55, 0.5, 1.02, 2.4]);
    expect(lensFilter.stops).toBe(STATION_ND.S1);
    holdingsFilter(0.6, 1440 / 900);
    expect(lensFilter.shape.toArray()).toEqual([...HOLDINGS_SHAPE]);
  });

  it('burns in the same part of the picture on every frame from 4:3 out', () => {
    const design = edge(1440 / 900);
    for (const a of [4 / 3, 1.5, 16 / 9, 1920 / 945, 1536 / 730, 1366 / 657, 2.4, 3440 / 1300]) {
      const e = edge(a);
      expect(e.full).toBeCloseTo(design.full, 9);
      expect(e.gone).toBeCloseTo(design.gone, 9);
    }
  });

  it('is gone before the plan begins — the middle of the frame — on all of them', () => {
    for (const a of [4 / 3, 1.5, 1.6, 16 / 9, 2.1, 2.65]) expect(edge(a).uvGone).toBeLessThan(0.5);
  });

  it('stays where it is at 4:3 on a squarer frame: there the grid is fitted to the width', () => {
    const at43 = (stationFilter({ S1: 1 }, true, 4 / 3), lensFilter.shape.toArray());
    for (const a of [1.25, 1.1, 1]) {
      stationFilter({ S1: 1 }, true, a);
      expect(lensFilter.shape.toArray()).toEqual(at43);
    }
  });

  it("moves the holdings' grad with the copy it was made for", () => {
    // 1920x1080: the copy's column begins 15.5% in, not 11.7%
    holdingsFilter(0.6, 1920 / 1080);
    const [cx, cy, rx, ry] = lensFilter.shape.toArray();
    expect(cx).toBeCloseTo(0.5 + (HOLDINGS_SHAPE[0] - 0.5) * (1.6 / (1920 / 1080)), 9);
    expect(rx).toBeCloseTo(HOLDINGS_SHAPE[2] * (1.6 / (1920 / 1080)), 9);
    expect([cy, ry]).toEqual([HOLDINGS_SHAPE[1], HOLDINGS_SHAPE[3]]);
    expect(lensFilter.stops).toBeCloseTo(HOLDINGS_ND.stops, 5);
  });
});

describe("a reading page's ground", () => {
  const rel = (l: number) => {
    const c = l / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const IVORY = 0.2126 * 242 + 0.7152 * 237 + 0.0722 * 228;
  /** Ivory at this strength over a ground of this luma (WCAG contrast). */
  const ivoryOn = (alpha: number, ground: number) => {
    const text = IVORY * alpha + ground * (1 - alpha);
    return (rel(text) + 0.05) / (rel(ground) + 0.05);
  };

  it("holds Start here's lit house under a ceiling its quietest line can stand on", () => {
    const ground = 255 * READING_CEILING;
    const startHere = read('../../app/(site)/(experience)/start-here/page.tsx');
    const strengths = [...startHere.matchAll(/text-\[#F2EDE4\]\/(\[0\.\d+\]|\d+)/g)].map((m) =>
      m[1].startsWith('[') ? Number(m[1].slice(1, -1)) : Number(m[1]) / 100,
    );
    expect(strengths.length).toBeGreaterThanOrEqual(5);
    for (const a of strengths) expect(ivoryOn(a, ground)).toBeGreaterThanOrEqual(4.5);
  });

  it("puts a surface's quietest small text at AA over anything the world can show behind it", () => {
    const surface = read('./Surface.tsx');
    const m = /from-\[#0A1120\]\/\[(0\.\d+)\] via-\[#0A1120\]\/(\d+) to-\[#0A1120\]\/(\d+)/.exec(surface);
    expect(m).not.toBeNull();
    const lightest = Math.min(Number(m![1]), Number(m![2]) / 100, Number(m![3]) / 100);
    const NAVY = 0.2126 * 10 + 0.7152 * 17 + 0.0722 * 32;
    // a white wall under the lightest of the ground
    const ground = 255 * (1 - lightest) + NAVY * lightest;
    expect(ivoryOn(0.55, ground)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the header's links at AA over a white page passing under its bar", () => {
    const m = /bg-\[#0A1120\]\/(\d+) backdrop-blur-md/.exec(header);
    expect(m).not.toBeNull();
    const bar = Number(m![1]) / 100;
    const NAVY = 0.2126 * 10 + 0.7152 * 17 + 0.0722 * 32;
    const ground = 255 * (1 - bar) + NAVY * bar;
    expect(ivoryOn(0.72, ground)).toBeGreaterThanOrEqual(4.5);
    // and Enquire's gilt
    const GILT = 0.2126 * 232 + 0.7152 * 185 + 0.0722 * 138;
    expect((rel(GILT) + 0.05) / (rel(ground) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('every line of the film at a strength its ground allows', () => {
  // film_strict measures each text node at its own colour and opacity against
  // the clean plate under it. At 55 to 75% the small lines stood under AA on
  // ground that was only quiet enough for ivory at full strength.
  const footer = read('../site/SiteFooter.tsx');
  const sources: Record<string, string> = {
    'site-home': page,
    StationText: read('../site/StationText.tsx'),
    CityLink: read('../site/CityLink.tsx'),
    ScrollCue: read('./ScrollCue.tsx'),
    FilmColophon: footer.slice(footer.indexOf('function FilmColophon'), footer.indexOf('export function SiteFooter')),
  };

  it('sets no ivory under 85%, and gilt only whole', () => {
    for (const [name, src] of Object.entries(sources)) {
      const ivory = [...src.matchAll(/(?<![:\w-])text-\[#F2EDE4\]\/(\[0\.\d+\]|\d+)/g)];
      for (const m of ivory) {
        const a = m[1].startsWith('[') ? Number(m[1].slice(1, -1)) : Number(m[1]) / 100;
        expect(a, `${name}: ${m[0]}`).toBeGreaterThanOrEqual(0.85);
      }
      expect(src, `${name}: gilt at part strength`).not.toMatch(/text-\[#E8B98A\]\/(\[0\.\d+\]|\d+)/);
    }
  });

  it("puts the gilt figure where the land stays dark, and a table's count in ivory", () => {
    // Open, Plots, Layouts: the gilt one first, at the row's left end
    const row = page.slice(page.indexOf('<dl className="mt-10 flex items-end'), page.indexOf('</dl>'));
    const order = [...row.matchAll(/<dt className="t-micro mt-3 text-\[#F2EDE4\]">(\w+)<\/dt>/g)].map((m) => m[1]);
    expect(order).toEqual(['Open', 'Plots', 'Layouts']);
    const figures = [...row.matchAll(/<dd className="t-figure (text-\[#[0-9A-F]{6}\])">/g)].map((m) => m[1]);
    expect(figures).toEqual(['text-[#E8B98A]', 'text-[#F2EDE4]', 'text-[#F2EDE4]']);
    expect(sources.StationText).toContain('t-small mt-2 flex items-baseline gap-8 text-[#F2EDE4] ');
  });

  it('draws one statement, one supporting line and one action to a frame: no chapter labels, no hairlines, no numerals', () => {
    // The refinement brief (2026-10-03): "reduce the number of simultaneous
    // luxury signals: tiny uppercase labels, excessive tracking, repeated
    // rules, micro-metadata". The film's seven chapter labels are read, not
    // drawn; nothing in its page is set in the label's tracked capitals but
    // the sold-out list's heading, which stands after the film.
    expect(page.match(/<p className="sr-only">/g)?.length).toBe(7);
    const film = page.slice(0, page.indexOf('Sold-out layouts sit AFTER the journey'));
    expect(film).not.toMatch(/className="t-eyebrow/);
    // the only small capitals left in a frame are a figure's label and an action
    expect(film.match(/className="t-micro /g)?.length).toBe(3);
    // no hairline but the one an action leads with (the .cta-primary rule, in CSS)
    expect(film).not.toMatch(/<span aria-hidden className="[^"]*\bh-px\b/);
    expect(film).not.toContain('roman(');
    // a table's count and the list's are sentences in the small text, not capitals
    expect(sources.StationText).not.toMatch(/className="t-eyebrow/);
    expect(read('../site/CityLink.tsx')).not.toMatch(/className="t-eyebrow/);
    // and each top-held block keeps its first drawn line where it stood: its
    // top is lower by the label's own line, sixteen units
    for (const top of ['50.11vh_-_var(--bar)_+_16_*_var(--u)', '60.44vh_+_16_*_var(--u)', '47.89vh_+_16_*_var(--u)']) {
      expect(page).toContain(top);
    }
  });

  it("takes the colophon's lines out at the header's edge: over the film there is no bar to pass behind", () => {
    // On a frame shorter than the colophon its lines rode up through the mark
    // and the controls (twelve of them under the header at the end of the
    // page at 390x844). Each marked line dissolves at the header's edge; the
    // block itself is never dissolved and is no chapter to the lens.
    const colophon = footer.slice(footer.indexOf('function FilmColophon'), footer.indexOf('export function SiteFooter'));
    expect(colophon).toContain('<div data-chapter-fade="lines" className="mx-auto max-w-[var(--grid-max)]');
    // the eyebrow, the headline, the gloss, the actions, each link, each office, the legal line
    expect(colophon.match(/data-line/g)?.length).toBeGreaterThanOrEqual(7);
    const fade = read('./ChapterFade.tsx');
    expect(fade).toContain("export const LINES_MODE = 'lines';");
    expect(fade).toContain('content: Array.from(el.querySelectorAll<HTMLElement>(lines ? `[${LINE_ATTR}]` : CONTENT)),');
    expect(fade).toMatch(/if \(lines\) \{\s*o = 1;/);
    expect(fade).toContain('if (!lines && o > 0 && bottom > 0 && top < vh) {');
    // ...and says where the words of each visible one stand, for the lens
    // (the film's last light: lensFilter.codaFilter).
    expect(fade).toContain('copyZone.lines = colophon ?? [];');
    expect(fade).toContain('colophon.push({ l: b.left / vw, t: b.top / vh, r: b.right / vw, b: b.bottom / vh });');
    expect(fade).toContain('if (clamp01((t - headerLine) / (HEADER_BAND * headerLine)) < 0.05) continue;');
    const stage = readFileSync(join(__dirname, 'InteriorStage.tsx'), 'utf8');
    expect(stage).toContain('codaFilter(copyZone.lines, mapStage.screen, delta);');
    const table = readFileSync(join(__dirname, 'MapTable.tsx'), 'utf8');
    expect(table).toContain('mapStage.screen = onScreen;');
  });

  it("stands the colophon on the film's stage, and the sound control on the header's ground", () => {
    expect(footer).toContain('<footer className="film-stage relative z-10">');
    expect(footer).toContain('mx-auto max-w-[var(--grid-max)] px-6 pb-16 pt-[22vh]');
    // the control is drawn in the header's slot, not fixed in a corner of the picture
    expect(header).toContain('{overFilm ? <span id="film-sound" className="flex items-center" /> : null}');
    const sound = read('./AmbientSound.tsx');
    expect(sound).toContain("export const SOUND_SLOT_ID = 'film-sound';");
    expect(sound).toContain('return createPortal(');
    const rule = css.slice(css.indexOf('\n.sound-toggle {\n  position: relative;'));
    expect(rule.slice(0, rule.indexOf('}'))).not.toMatch(/position: fixed|bottom:|right:/);
  });
});
