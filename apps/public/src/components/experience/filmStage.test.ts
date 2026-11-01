// apps/public/src/components/experience/filmStage.test.ts
//
// The film's stage: on a wide frame the copy, its grid, the header and the
// lens's filters are all said in one unit — a pixel of the 1440x900 design —
// so the composition measured at that size is the composition on every wide
// frame. And the ground every other page is read on: since the folios, an
// opaque sheet (app/folio.css), where it was a panel over the picture.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHORT_QUERY, WIDE_QUERY, filmIsShort, filmIsWide } from './copyZone';
import { COVER_SKY, COVER_SKY_SHORT, EDGE, LAND_BOX, LAND_ND, LAYOUT_SKY, STAGE, holdingsFilter, lensFilter } from './lensFilter';
import { READING_STOPS, READING_TIME } from './readingLight';
import { twilightAt } from './filmHours';

const read = (p: string) => readFileSync(join(__dirname, p), 'utf8').replace(/\r\n/g, '\n');
const css = read('../../app/globals.css');
const folio = read('../../app/folio.css');
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

  it('has the film, its header and its menu on it — and its copy at the frame\'s own edge, not in a column', () => {
    expect(page).toContain('<main className={`film-stage pb-40 ${TRACK_ROOT_TRANSPARENT}`}>');
    // ONE HEADER, ON THE STAGE, FOR EVERY PAGE (2026-10-06): the film's header
    // is the site's. It was two — the film's, and a navy bar with a row of
    // links on a different grid for every other page.
    expect(header).toContain(
      "<header className={'site-header film-stage fixed inset-x-0 top-0 z-40' + (overFilm ? ' is-film' : '')}>",
    );
    expect(header).toContain('className="menu-panel film-stage fixed inset-0 z-30');
    expect(header).not.toContain('backdrop-blur');
    expect(header).toContain('site-grid h-[var(--bar)]');
    // "All text and nav sit inside a narrow centered column (about 1,080 px
    // wide on a ~1,900 px screen), always at the same left position regardless
    // of what the camera shows" (the audit of 2026-10-05, P1). On the stage
    // the grid has no maximum: the header and every block of copy stand a
    // frame-edge margin in from the picture's edge.
    const stage = css.slice(css.indexOf(`@media ${WIDE_QUERY} {\n  .film-stage {`));
    expect(stage).toContain('.film-stage .site-grid {\n    max-width: none;\n    padding-inline: var(--edge);\n  }');
    expect(decl(block, '--edge')).toBe('max(calc(var(--bl) * 9), 5.2vw)');
    expect(page).toContain("const BLOCK = 'pointer-events-auto wide:absolute wide:left-[var(--edge)]';");
    // no page-grid column left in a chapter of the film, and no measure in vw
    const film = page.slice(0, page.indexOf('<div aria-hidden className="min-h-['));
    expect(film).not.toMatch(/className=[^\n]*max-w-6xl/);
    expect(film).not.toMatch(/wide:max-w-\[\d+vw\]/);
    expect(film).not.toMatch(/col-span-12/);
    // every measure a count of the stage's unit (the cover's line with a floor
    // of its own size under it: max(...), the unit's count first)
    const measures = film.match(/wide:max-w-\[(?:max\()?calc\(\d+\*var\(--u\)\)/g) ?? [];
    expect(measures.length).toBeGreaterThanOrEqual(6);
  });

  it('sets a display line for every chapter, the figures above them, and the sign-off above everything', () => {
    // "Headlines are about 44 px on a ~1,900 px screen in a serif built for
    // body text ... the stats numbers are barely larger than their labels.
    // Done when each chapter has one clearly dominant line, set in a serif
    // with display-quality refinement at large sizes" — and "'The land is best
    // seen from the land.' is the largest type on the site" (P1).
    const u = (name: string) => {
      const m = /^max\(([\d.]+)rem, calc\(([\d.]+) \* var\(--u\)\)\)$/.exec(decl(block, name));
      if (!m) throw new Error(`${name} is not a stage size`);
      return { floor: Number(m[1]) * 16, design: Number(m[2]) };
    };
    const d1 = u('--d1');
    const d2 = u('--d2');
    const d3 = u('--d3');
    const fig = u('--fig');
    const end = u('--end');
    // on the design's 1440x900 a unit is a pixel; on 1920 wide, a third more
    expect(d1.design).toBeGreaterThanOrEqual(80);
    expect(d2.design).toBeGreaterThanOrEqual(56);
    expect(d3.design).toBeGreaterThanOrEqual(40);
    expect(fig.design).toBeGreaterThan(d1.design);
    expect(end.design).toBeGreaterThan(fig.design);
    // and in the same order at their floors, where a short frame holds them
    expect(end.floor).toBeGreaterThan(fig.floor);
    expect(fig.floor).toBeGreaterThan(d1.floor);
    // the same order on a phone, where they are clamps of the width
    const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}\n', css.indexOf(':root {')));
    const clamp = (name: string) => {
      const m = /^clamp\(([\d.]+)rem, ([\d.]+)vw, ([\d.]+)rem\)$/.exec(decl(root, name));
      if (!m) throw new Error(`${name} is not a clamp`);
      return m.slice(1).map(Number);
    };
    const [pd1, pfig, pend] = [clamp('--d1'), clamp('--fig'), clamp('--end')];
    for (let i = 0; i < 3; i += 1) {
      expect(pend[i]).toBeGreaterThan(pfig[i]);
      expect(pfig[i]).toBeGreaterThan(pd1[i]);
    }
    // the face is asked for at a display optical size, not left to guess one
    const display = css.slice(css.indexOf('\n.t-d1,\n.t-d2,\n.t-d3,\n.t-end {'));
    expect(display.slice(0, display.indexOf('}'))).toContain("font-variation-settings: 'opsz'");
    // each chapter's dominant line, and the two the audit named
    expect(page).toContain('<h1 className="t-d1 ');
    expect(page).toMatch(/<p className="t-d1 [^"]*">\s*We do not\s*<br \/>\s*broker <span className="t-gilt">land\.<\/span>/);
    // (and the layout's title, the founder's frame of 2026-10-28, at the
    // cover's size: the holdings' three figures went with their chapter)
    expect(page).toMatch(/<h2 className="t-d1 [^"]*">\s*Each plot,/);
    expect(page).not.toContain('<dd className="t-fig ');
    expect(read('../site/SiteFooter.tsx')).toContain('<p data-line data-hold data-reveal className="t-end text-[#F2EDE4] held:sticky held:top-[60vh]">');
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
    // the cover's headline within a seventh of its drawn proportion (it was 1.5
    // times it at the stage's floor) — and never under 24px: it stands in the
    // sky since the paid audit of 2026-10-04, where only large text can
    expect(size(5).px / (size(5).design * u)).toBeLessThan(1.15);
    expect(size(5).px).toBeGreaterThanOrEqual(24);
    // and nothing in the frame under 14px but the capitals
    for (const n of [1, 2, 3, 4, 5, 6]) expect(size(n).px).toBeGreaterThanOrEqual(14);
    for (const n of [2, 3, 4, 5, 6]) expect(size(n).px).toBeGreaterThan(size(n - 1).px);
  });

  it("takes each chapter's gloss off the picture but not out of the page, and keeps every heading and link", () => {
    // off the frame, still read by a screen reader: never display:none on copy.
    // Three glosses (the cover's, the layout's and the city's) and the
    // establishing copy's second sentence.
    expect(page.match(/short:sr-only/g)?.length).toBe(4);
    expect(read('../site/CityLink.tsx')).toContain('short:sr-only');
    // nothing is hidden outright any more (the one thing that was, was a rule)
    expect(page.split('\n').filter((l) => l.includes('short:hidden')).length).toBe(0);
    for (const kept of ['<h1 className="t-d1', '<StartCue', '<StationText', '<CityLink']) {
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

  it("wears the lens of every wide frame, with the sky's grad carried down to its title's foot", () => {
    expect(filmIsWide(844, 390)).toBe(true);
    holdingsFilter(0, 844 / 390, 1, 0, true);
    expect(lensFilter.stops).toBe(COVER_SKY.stops);
    const short = lensFilter.inner;
    holdingsFilter(0, 844 / 390, 1, 0, false);
    // its title ends lower in the frame's own terms: the grad is whole further down
    expect(COVER_SKY_SHORT.full).toBeGreaterThan(COVER_SKY.full);
    expect(short).toBeGreaterThan(lensFilter.inner);
    // and the orbit's small line, which runs wider there, has a wider ground
    expect(LAND_BOX.revolutionShort.right).toBeGreaterThan(LAND_BOX.revolution.right);
  });

  it('keeps a title set in the sky clear of the header, whose bar has a floor', () => {
    // 8.8vh of a frame 390px tall is 34px and the bar there is 44: the
    // cover's title and the orbit's line stood at nothing, dissolved by the
    // rule that keeps a line out of the header (ChapterFade: across 14/62 of
    // the bar beneath it). Measured on the build of 2026-10-05, 844x390.
    expect(page.match(/wide:top-\[max\(10\.5vh,var\(--clear\)\)\]/g)?.length).toBe(3);
    // (the cover's title, the orbit's line and the layout's title stand in
    // the same place)
    const clear = /--clear: calc\(var\(--bar\) \* ([\d.]+)\);/.exec(css)!;
    expect(Number(clear[1])).toBeGreaterThan(1 + 14 / 62);
    // The bar's floor is 44px, so on that frame the line is 14.2vh down: no
    // block of a chapter is placed above it by the frame's height alone.
    const bare = [...page.matchAll(/wide:top-\[([\d.]+)vh\]/g)].map((m) => Number(m[1]));
    expect(bare.length).toBeGreaterThanOrEqual(4);
    for (const vh of bare) expect(vh).toBeGreaterThanOrEqual(15);
  });

  it('is a panoramic frame too, and keeps the variant for it', () => {
    // Twice as wide as tall, the frame sees further to either side. The
    // holdings' figures stood in from its edge there; they went with their
    // chapter (the founder's layout, 2026-10-28), whose words stand as the
    // cover's do, and the variant stays declared for the next block that
    // needs it.
    const tw = read('../../../tailwind.config.ts');
    expect(tw).toContain("addVariant('panoramic', '@media (min-aspect-ratio: 2/1)');");
    // declared after `wide` and `short`, so it overrides them where it speaks
    expect(tw.indexOf("addVariant('panoramic'")).toBeGreaterThan(tw.indexOf("addVariant('short'"));
    expect(844 / 390).toBeGreaterThan(2);
    expect(1280 / 593).toBeGreaterThan(2);
    expect(page).not.toContain('wide:top-[58.5vh]');
  });

  it("sets the film's quiet link in the text's own ivory: over a picture a tint is the picture", () => {
    expect(css).toMatch(/\.film-stage \.cta-quiet \{\s*color: #f2ede4;/);
    // and the hover's gilt still comes after it
    expect(css.indexOf('.cta-quiet:hover,')).toBeGreaterThan(css.indexOf('.film-stage .cta-quiet {'));
  });

  it('asks the layout where the header ends: a custom property is tokens, not a length', () => {
    // `--bar` on the stage is max(2.75rem, calc(62 * var(--u))); parseFloat
    // of its computed value was NaN, and the 62px fallback stood in for a
    // 44px bar on this frame and a 50px one at 1536x730.
    const fade = read('./ChapterFade.tsx');
    expect(fade).not.toMatch(/parseFloat\(\s*getComputedStyle\([^)]*\)\.getPropertyValue\('--bar'\)/);
    expect(fade).toContain('height:var(--bar)');
    expect(fade).toContain('ruler.getBoundingClientRect().height');
  });

  it('carries no gilt in its smallest display line: at 20px it is small text', () => {
    const open = `@media ${SHORT_QUERY} {`;
    const block = css.slice(css.indexOf(open), css.indexOf('\n}\n', css.indexOf(open)));
    expect(block).toMatch(/\.film-stage \.t-d3 \.t-gilt \{\s*color: inherit;/);
    // the two larger steps are large text there too: 24px and over
    const floor = (name: string) => Number(/max\(([\d.]+)rem/.exec(decl(block, name))![1]) * 16;
    expect(floor('--d1')).toBeGreaterThanOrEqual(24);
    expect(floor('--d2')).toBeGreaterThanOrEqual(24);
    expect(floor('--d3')).toBeLessThan(24);
    // and the gilt of a display line is a class, never a colour in the markup
    expect(page).not.toMatch(/<h[12] [^>]*>[^<]*<span className="text-\[#E8B98A\]/);
  });
});

describe('the lens on the stage', () => {
  it("stands its densities where the copy stands: off the frame's own edge, in the frame's unit", () => {
    // The audit of 2026-10-05 took every density from behind a wide frame's
    // copy, for a camera that stood still while the copy was read. The camera
    // does not stand still (the client, 2026-10-06), so the lens carries them
    // again — placed for the copy where it stands now: off the frame's left
    // edge, in blocks measured in the frame's unit.
    const src = read('./lensFilter.ts');
    for (const fn of ['stationFilter', 'holdingsFilter', 'approachFilter']) expect(src).toContain(`export function ${fn}(`);
    // the cover: a grad from the top edge for its title, leaning to the title's
    // side since the concept built 1:1 (2026-10-27): its sky over the house and
    // toward the sun is left bright (COVER_SKY.lean)
    holdingsFilter(0, 1920 / 945, 1, 0);
    expect(lensFilter.shape.x).toBe(COVER_SKY.lean.cx);
    expect(lensFilter.shape.x).toBeLessThan(0.5);
    expect(lensFilter.shape.z).toBe(COVER_SKY.lean.rx);
    expect(lensFilter.stops).toBe(COVER_SKY.stops);
    // and the second ellipse under its small type on the land, for as long as that is up
    expect(lensFilter.second.stops).toBeCloseTo(LAND_ND.stops, 9);
    const wide = lensFilter.second.shape.clone();
    holdingsFilter(0, 1440 / 900, 1, 0);
    const design = lensFilter.second.shape.clone();
    // the same picture's width under it on every shape of frame: its radius is
    // the block's, which is given in the frame's HEIGHT
    expect(wide.z * (1920 / 945)).toBeCloseTo(design.z * (1440 / 900), 9);
    // and the same distance from the frame's edge
    const left = (shape: { x: number; z: number }, aspect: number) => (shape.x - EDGE) * aspect * 900;
    expect(left(wide, 1920 / 945)).toBeCloseTo(left(design, 1440 / 900), 6);
    expect(left(wide, 1920 / 945)).toBeCloseTo((LAND_BOX.cover.left + LAND_BOX.cover.right) / 2, 6);
    holdingsFilter(0, 1920 / 945, 0, 0);
    expect(lensFilter.second.stops).toBe(0);
    // the layout's title (the founder's frame, 2026-10-28): the cover's kind
    // of grad from the top edge, leaning to the left where the title stands
    holdingsFilter(0.62, 1920 / 945, 0, 0);
    expect(lensFilter.stops).toBeCloseTo(LAYOUT_SKY.stops * (1 - LAYOUT_SKY.duskOff * twilightAt(0.62)), 9);
    expect(lensFilter.shape.y).toBeGreaterThan(1);
    expect(lensFilter.shape.x).toBeLessThan(0.3);
    // the design's frame is still the stage's measure (the tables' burnt edge)
    expect(STAGE.aspect).toBeCloseTo(1.6, 9);
    const canvas = read('./WorldCanvas.tsx');
    expect(canvas).toContain('filmIsShort(window.innerWidth, window.innerHeight),');
    expect(canvas).toContain('if (out && film) approachFilter(legS, filmIsShort(window.innerWidth, window.innerHeight));');
    const stage = read('./InteriorStage.tsx');
    // (and a phone on its side has its own densities: lensFilter, STATION_ND_SHORT)
    expect(stage).toMatch(
      /stationFilter\(\s*stationWeights,\s*wide,\s*window\.innerWidth \/ Math\.max\(1, window\.innerHeight\),\s*stationStyle\(\) === 'model',\s*filmIsShort\(window\.innerWidth, window\.innerHeight\),\s*\);/,
    );
  });
});

describe("the cover's line and its cue", () => {
  it('stand on the lawn together, above the terrace, and the lens’s density stands under the line', () => {
    // The forensic audit of 2026-10-09 (#31): "The paragraph's last line sits
    // exactly on the pool terrace's rail, and 'Start here' stands on the
    // terrace paving ... Expected: the paragraph a line higher, clear of the
    // rail; the cue on plain ground." Measured at 1920x945: the rail runs
    // from 79.3% of the way down the frame at its west corner to 84.6% under
    // the line's last word.
    // (the line is set from the cue's foot now: 17 baselines over it, which at
    // 1920x945, a baseline 4.2 px, puts its top where 63.8vh did)
    const lineOver = /wide:bottom-\[calc\(18vh_\+_var\(--bl\)\*([\d.]+)\)\] wide:max-w-\[max\(calc\(430\*var\(--u\)\),calc\(var\(--support\)\*19\.5\)\)\]/.exec(page);
    expect(lineOver).not.toBeNull();
    const bl = 4.2 / 945;
    const top = 1 - (0.18 + Number(lineOver![1]) * bl) - 3 * 0.0355;
    expect(top).toBeCloseTo(0.638, 2);
    const cueFoot = 1 - Number(/mt-7 wide:bottom-\[([\d.]+)vh\] wide:mt-0/.exec(page)![1]) / 100;
    // three lines at a pitch of 3.55% of the frame: its last ends well over the rail
    expect(top + 3 * 0.0355).toBeLessThan(0.793 - 0.03);
    // the cue comes up under it, and ends over the rail's west corner
    expect(cueFoot).toBeGreaterThan(top + 3 * 0.0355);
    expect(cueFoot).toBeLessThan(0.846 - 0.015);
    // and the half stop under the small type is under the line where it stands now
    expect(LAND_BOX.cover.top).toBeLessThan(top);
    expect(LAND_BOX.cover.top).toBeGreaterThan(top - 0.03);
    expect(LAND_BOX.cover.foot).toBeGreaterThan(top + 3 * 0.0355);
    expect(LAND_BOX.cover.foot).toBeLessThan(cueFoot);
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

  // SINCE THE FOLIOS (2026-10-06) NO PAGE STANDS READING TEXT ON THE PICTURE.
  // These three tests held the three grounds a column of copy used to stand
  // on: Start here's night under a ceiling, a surface's navy scrim, the
  // header's translucent bar. Each is an opaque ground of the hall's own dark
  // now, and what is held is that it IS opaque, and how quiet its quietest
  // text may be on it.
  const GROUND = 0.2126 * 0x15 + 0.7152 * 0x11 + 0.0722 * 0x0c;

  it('opens Start here on the cover by day, and reads it on a sheet', () => {
    // No stop of print and no night: its copy is not on the house any more.
    expect(READING_STOPS).toBe(0);
    expect(READING_TIME).toBe(0);
    const startHere = read('../../app/(site)/(experience)/start-here/page.tsx');
    expect(startHere).toContain('<Folio>');
    expect(startHere).toMatch(/<Plate\b/);
    // nothing of the old page: no column of ivory at part strength on the picture
    expect(startHere).not.toMatch(/text-\[#F2EDE4\]\//);
  });

  it('reads every page on an opaque sheet of the hall\u2019s own dark, with its quietest text at AA', () => {
    // the panel over the picture is gone, and its file with it
    expect(existsSync(join(__dirname, './Surface.tsx'))).toBe(false);
    expect(folio).toMatch(/\.folio,\n\.folio-stage \{\n  --ground: #15110c;/);
    const sheet = folio.slice(folio.indexOf('\n.folio-sheet {'), folio.indexOf('}', folio.indexOf('\n.folio-sheet {')));
    expect(sheet).toContain('background: var(--ground);');
    // every strength of ivory the sheets set, against that ground: the four
    // of the system (globals.css, THE SYSTEM; the forensic audit of
    // 2026-10-09, #98, counted twelve), and whatever is still written out
    const inks = [...css.matchAll(/--ink-(\d): rgba\(242, 237, 228, (0\.\d+)\);/g)].map((m) => Number(m[2]));
    expect(inks).toEqual([0.9, 0.8, 0.72]);
    expect([...folio.matchAll(/color: var\(--ink-[234]\);/g)].length).toBeGreaterThan(12);
    const written = [...folio.matchAll(/^ *color: rgba\(242, 237, 228, (0\.\d+)\);/gm)].map((m) => Number(m[1]));
    // (only what is not text to be read is still a number of its own)
    for (const a of written) expect(a, 'a strength outside the four').toBeLessThan(0.6);
    for (const a of [...inks, ...written]) {
      // (the fields' placeholders are not text to be read: WCAG exempts them
      // from nothing, so they are held too, at the 3:1 of an inactive hint)
      expect(ivoryOn(a, GROUND), `ivory at ${a}`).toBeGreaterThanOrEqual(a < 0.5 ? 3 : 4.5);
    }
    // and the house's gilt, whole
    const GILT = 0.2126 * 232 + 0.7152 * 185 + 0.0722 * 138;
    expect((rel(GILT) + 0.05) / (rel(GROUND) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it('gives the header a bar of that same dark over a sheet, opaque, and air over a plate', () => {
    const bar = folio.slice(folio.indexOf('\n.site-header:not(.is-film) {'));
    expect(bar.slice(0, bar.indexOf('}'))).toContain('background: #15110c;');
    // air only where the page says it is over its plate
    expect(folio).toContain(
      'html:has([data-folio-plate]):not([data-folio="sheet"]) .site-header:not(.is-film) {\n  border-bottom-color: transparent;\n  background: transparent;\n}',
    );
    // and nothing frosted, anywhere on a page
    expect(folio).not.toMatch(/backdrop-filter|blur\(/);
  });

  it('carries a plate\u2019s title on a density of its own, sized by the words, and darkens nothing else', () => {
    // the frame keeps a foot the first sheet rises out of, a quarter of it at most, and the header's band
    const plate = folio.slice(folio.indexOf('\n.folio-plate::before {'));
    const frame = plate.slice(0, plate.indexOf('\n}'));
    expect(frame).toMatch(/linear-gradient\(to top, #15110c 0%,[^;]*rgba\(21, 17, 12, 0\) 26%\)/);
    expect(frame).not.toContain('radial-gradient');
    // the density is the copy block's: from the frame's edge and foot, out past the block and above it
    const copy = folio.slice(folio.indexOf('\n.folio-plate-copy::before {'));
    const flag = copy.slice(0, copy.indexOf('\n}'));
    expect(flag).toContain('left: calc(-1 * var(--edge));');
    expect(flag).toContain('bottom: calc(-1 * var(--plate-foot));');
    // gone to nothing at its right edge and above it: the rest of the frame is the picture
    expect(flag).toMatch(/linear-gradient\(\s*to right,[^;]*rgba\(14, 11, 8, 0\) 100%\s*\)/);
    expect(flag).toMatch(/mask-image: linear-gradient\(\s*to bottom,\s*transparent 0,/);
    // and strong enough for the quietest line on the brightest wall: small
    // gilt at 4.5:1 needs its ground under a luma of 80; ivory at half lights is 215
    const strength = Number(/rgba\(14, 11, 8, (0\.\d+)\) 0%/.exec(flag)![1]);
    const under = 215 * (1 - strength) + 11 * strength;
    const GILT = 0.2126 * 232 + 0.7152 * 185 + 0.0722 * 138;
    expect((rel(GILT) + 0.05) / (rel(under) + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect(ivoryOn(1, under)).toBeGreaterThanOrEqual(7);
    // the page's script and its markup agree on what the block is
    expect(read('../folio/Folio.tsx')).toContain('<div className="folio-plate-copy">');
  });
});

describe('every line of the film at a strength its ground allows', () => {
  // film_strict measures each text node at its own colour and opacity against
  // the clean plate under it. At 55 to 75% the small lines stood under AA on
  // ground that was only quiet enough for ivory at full strength.
  const footer = read('../site/SiteFooter.tsx');
  const colophon = footer.slice(footer.indexOf('function FilmColophon'), footer.indexOf('export function SiteFooter'));
  const sources: Record<string, string> = {
    'site-home': page,
    StationText: read('../site/StationText.tsx'),
    CityLink: read('../site/CityLink.tsx'),
    StartCue: read('./StartCue.tsx'),
    FilmColophon: colophon,
  };

  it('sets no ivory under 85% in a chapter of the film, and gilt only whole', () => {
    for (const [name, src] of Object.entries(sources)) {
      if (name === 'FilmColophon') continue;
      const ivory = [...src.matchAll(/(?<![:\w-])text-\[#F2EDE4\]\/(\[0\.\d+\]|\d+)/g)];
      for (const m of ivory) {
        const a = m[1].startsWith('[') ? Number(m[1].slice(1, -1)) : Number(m[1]) / 100;
        expect(a, `${name}: ${m[0]}`).toBeGreaterThanOrEqual(0.85);
      }
      expect(src, `${name}: gilt at part strength`).not.toMatch(/text-\[#E8B98A\]\/(\[0\.\d+\]|\d+)/);
    }
    // The colophon's small matter has levels now (below): its offices at 85%
    // and over, and its links and legal line a step under them, never less
    // than 70% — which the court's darkened stone carries at AA (measured).
    const strengths = [...colophon.matchAll(/(?<![:\w-])text-\[#F2EDE4\]\/(\[0\.\d+\]|\d+)/g)].map((m) =>
      m[1].startsWith('[') ? Number(m[1].slice(1, -1)) : Number(m[1]) / 100,
    );
    expect(Math.min(...strengths)).toBeGreaterThanOrEqual(0.7);
    expect(colophon).not.toMatch(/text-\[#E8B98A\]\/(\[0\.\d+\]|\d+)/);
  });

  it("sets the layout's words as the cover's: a title in the sky, its line on the land, and its cue", () => {
    // The founder's frame (2026-10-28): "Each plot, meticulously platted." in
    // the top left, its line at the frame's foot, and "Start here" under it.
    // Where the holdings' figures stood.
    const layout = page.slice(page.indexOf('<section id="holdings"'), page.indexOf('<section id="approach"'));
    expect(layout).toMatch(/<h2 className="t-d1 text-\[#F2EDE4\]">\s*Each plot,\s*<br \/>\s*meticulously\s*<br \/>\s*platted\.\s*<\/h2>/);
    expect(layout).toContain('From 40 ft blacktop roads to underground utilities');
    expect(layout).toContain('<StartCue href="#approach" mark="survey" />');
    // set where the cover's are, on the same three lines of the frame
    expect(layout).toContain('wide:top-[max(10.5vh,var(--clear))]');
    expect(layout).toContain('wide:bottom-[calc(18vh_+_var(--bl)*17)]');
    expect(layout).toContain('wide:bottom-[18vh]');
    // no figures, and nothing composed: the drawing's plot is the sheets'
    expect(layout).not.toContain('t-fig');
    expect(page).toContain('LAYOUTS.flatMap((l) => l.sizes).find((z) => z.feet[0] === 30 && z.feet[1] === 60)');
    // the display figures' token is still the one a statistic is set by
    const fig = css.slice(css.indexOf('\n.t-fig {'));
    expect(fig.slice(0, fig.indexOf('}'))).toMatch(/font-variant-numeric: var\(--figure-nums\) proportional-nums/);
    expect(css).toContain('  --figure-nums: oldstyle-nums;');
    // and every figure that is not one is a lining figure: a field's, a column's
    expect(css).toMatch(/input,\nselect,\ntextarea,\nbutton,\noptgroup \{\n  font-variant-numeric: inherit;/);
    expect(css).not.toMatch(/font-variant-numeric: tabular-nums;/);
    // a table's count is a sentence in the text's own voice, in ivory
    expect(sources.StationText).toContain('<p className="t-body mt-1 flex items-baseline gap-8 text-[#F2EDE4] ');
  });

  it('draws one statement, one supporting line and one action to a frame: no chapter labels, no hairlines, no numerals', () => {
    // The refinement brief (2026-10-03): "reduce the number of simultaneous
    // luxury signals: tiny uppercase labels, excessive tracking, repeated
    // rules, micro-metadata". The film's seven chapter labels are read, not
    // drawn; the only letterspaced capitals in a frame are the three figures'
    // labels, which the audit of 2026-10-05 kept ("the letterspaced capital
    // labels" are on its list of what must survive), and an action's.
    // (the layout's drawing has its own words on the ground, the founder's
    // frame of 2026-10-28: they are the drawing's, aria-hidden, and told to
    // a screen reader in a sentence of the chapter's own)
    expect(page.match(/<p className="sr-only">/g)?.length).toBe(8);
    const film = page.slice(0, page.indexOf('Sold-out layouts sit AFTER the journey'));
    expect(film.match(/className="t-eyebrow/g)).toBeNull();
    expect(film).toContain('<div aria-hidden className="layout-sheet">');
    expect(film.match(/className="t-micro /g)).toBeNull();
    // no hairline but the ones an action leads with (in CSS), and no numerals
    expect(film).not.toMatch(/<span aria-hidden className="[^"]*\bh-px\b/);
    expect(film).not.toContain('roman(');
    // ONE CUE on the cover ("the hero shows both 'START HERE' and 'SCROLL'
    // plus a stray vertical tick. Done when there is one designed cue")
    // (and the layout's, the founder's frame: one a frame, the cover's and
    // the layout's)
    expect(film.match(/<StartCue /g)?.length).toBe(2);
    expect(film).not.toContain('ScrollCue');
    expect(film).not.toMatch(/>\s*Scroll\s*</);
    // a table's count and the list's are sentences in the small text, not capitals
    expect(sources.StationText).not.toMatch(/className="t-eyebrow/);
    expect(read('../site/CityLink.tsx')).not.toMatch(/className="t-eyebrow/);
  });

  it('ends every statement of the film the same way: with a full stop', () => {
    // "'Land, in the districts we come from' and 'Every plot we hold, counted
    // in full' have no full stop; 'The door is open.' and 'The land is best
    // seen from the land.' do. Pick one rule and apply it to all" (P3).
    const flat = (page + colophon).replace(/&nbsp;/g, ' ').replace(/<br \/>/g, ' ').replace(/<\/?span[^>]*>/g, '').replace(/\s+/g, ' ');
    for (const line of [
      'Land, in the districts we come from.',
      'We do not broker land.',
      'Each plot, meticulously platted.',
      'The door is open.',
      'The land is best seen from the land.',
    ]) {
      expect(flat, line).toContain(line);
    }
  });

  it("takes the colophon's lines out at the header's edge: over the film there is no bar to pass behind", () => {
    // On a frame shorter than the colophon its lines rode up through the mark
    // and the controls. Each marked line dissolves at the header's edge; the
    // block itself is never dissolved and is no chapter to the lens.
    expect(colophon).toContain('<div data-chapter-fade="lines" className="px-[var(--edge)] pb-14 pt-[26vh] low:pb-6">');
    // the headline, the gloss, the action, each office, each link, the legal line
    expect(colophon.match(/data-line/g)?.length).toBeGreaterThanOrEqual(6);
    const fade = read('./ChapterFade.tsx');
    expect(fade).toContain("export const LINES_MODE = 'lines';");
    expect(fade).toContain('content: Array.from(el.querySelectorAll<HTMLElement>(lines ? `[${LINE_ATTR}]` : CONTENT)),');
    // ...and says where the words of each visible one stand, for the lens
    // (the film's last light: lensFilter.codaFilter).
    expect(fade).toContain('copyZone.lines = colophon ?? [];');
    const stage = readFileSync(join(__dirname, 'InteriorStage.tsx'), 'utf8').replace(/\r\n/g, '\n');
    // (with what the page has left to scroll: a line that stops short of the
    // table is not coming to it)
    expect(stage).toContain('codaFilter(copyZone.lines, mapStage.screen, delta, copyZone.remaining);');
    const table = readFileSync(join(__dirname, 'MapTable.tsx'), 'utf8').replace(/\r\n/g, '\n');
    expect(table).toContain('mapStage.screen = onScreen;');
  });

  it('gives the colophon the hierarchy of the film: an office its name over its address, the links a step under', () => {
    // "The footer is one size and weight throughout. Done when ... the footer
    // uses the same hierarchy, gold accent and spacing as the rest (office
    // names clearly above addresses; links clearly secondary)" (P1).
    expect(colophon).toContain(`<p className="t-eyebrow t-gilt">{b.role === 'head_office' ? 'Head office' : 'Branch'}</p>`);
    expect(colophon).toContain('<p className="t-support mt-2 text-[#F2EDE4]">{b.name}</p>');
    expect(colophon).toMatch(/<address className="t-small mt-2 [^"]*not-italic text-\[#F2EDE4\]\/90">/);
    // the links: the small size at a lower strength than the offices — every
    // page of the site by its part, from the one list (the forensic audit of
    // 2026-10-09, #58: the film's footer had a list of its own, six pages short)
    expect(colophon).toContain('{SITE_PARTS.map((part) => (');
    expect(colophon).toContain('<Link href={l.href} className="colophon-link">');
    expect(colophon).toContain('{SITE_SMALL_PRINT.map((l) => (');
    const link = /\.colophon-link \{[^}]*color: rgba\(242, 237, 228, (0\.\d+)\);/.exec(css);
    expect(Number(link![1])).toBeLessThan(0.85);
    // the address the offices read (the client, 2026-10-06), from one place
    expect(colophon).toContain('href={CONTACT_MAILTO}');
    expect(footer).not.toContain('gmail.com');
    expect(read('../../lib/contact.ts')).toContain("process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'qualityhomesreality@gmail.com'");
    // and the client's own mark, cobalt and orange, untouched: never redrawn
    const logo = read('../site/Logo.tsx');
    expect(logo).toContain("src={size < 32 ? '/brand/qhr-mark-flat.svg' : '/brand/qhr-mark.svg'}");
    expect(logo).not.toMatch(/qhr-mark-(reversed|estate)/);
  });

  it("stands the colophon on the film's stage, and the sound control on the header's ground", () => {
    expect(footer).toContain('<footer id="visit" className="film-stage relative z-10">');
    // the control is drawn in the header's slot (under its controls, beside
    // the co-ordinates, since the concept built 1:1), not fixed in a corner of
    // the picture
    expect(header).toContain('<span id="film-sound" className="film-sound-slot" />');
    expect(header).toContain('<div className="film-locator">');
    const sound = read('./AmbientSound.tsx');
    expect(sound).toContain("export const SOUND_SLOT_ID = 'film-sound';");
    expect(sound).toContain('return createPortal(');
    // and it says what it is: a waveform with a SWITCH beside it, on or off as
    // a switch is (the four bars alone "read as a glitch": P1, 2026-10-05)
    expect(sound).toContain('role="switch"');
    expect(sound).toContain('aria-checked={on}');
    expect(sound).toContain('className="sound-switch"');
    expect(sound).not.toContain('sound-bars');
    expect(css).not.toContain('.sound-bars');
    const rule = css.slice(css.indexOf('\n.sound-toggle {\n  position: relative;'));
    expect(rule.slice(0, rule.indexOf('}'))).not.toMatch(/position: fixed|bottom:|right:/);
  });

  it('takes the default chrome off the picture', () => {
    // "The grey Windows scrollbar with arrow buttons is visible over the scene
    // at all times. Hide it or style it as part of the brand" (P1).
    expect(css).toContain('html:has(main.film-stage) {\n  scrollbar-width: none;\n}');
    expect(css).toContain('html:has(main.film-stage)::-webkit-scrollbar {\n  display: none;');
    expect(css).toMatch(/::-webkit-scrollbar-button \{\s*display: none;/);
    // the two lines of the menu's mark are the same length (P3)
    const lines = css.slice(css.indexOf('.menu-toggle-lines i:first-child {'), css.indexOf('.menu-toggle-lines.is-open i {'));
    expect(lines.match(/width: 100%;/g)?.length).toBe(2);
    expect(lines).not.toContain('62%');
    // no decorative ampersand (P3) — and none borrowed from another face
    // either (the forensic audit of 2026-10-09, #60): the site writes "and"
    // (lib/units.test.ts), and the stack is the one face
    expect(css).not.toContain('Estate Ampersand');
    expect(css).toContain("--font-text: var(--font-serif), 'Playfair Display', Georgia, serif;");
    // and the curtain in the film's own dark, not the reading pages' navy (P3)
    // — on every page since the folios: the navy went with the panels.
    const cover = read('./coverState.ts');
    expect(cover).toMatch(/COVER_GROUND = \{ film: '#[0-9A-Fa-f]{6}', page: '#[0-9A-Fa-f]{6}' \}/);
    expect(cover).not.toContain('#0A1120');
    const film = /film: '#([0-9A-Fa-f]{6})'/.exec(cover)![1];
    const [r, , b] = [0, 2, 4].map((i) => parseInt(film.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(b); // warm
  });
});
