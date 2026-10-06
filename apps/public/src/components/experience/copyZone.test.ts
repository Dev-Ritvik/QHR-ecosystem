// apps/public/src/components/experience/copyZone.test.ts
//
// The page and the lens ask one question — is the frame wide? — in the same
// words; and each chapter's copy develops in place and dissolves in place,
// over the stretch of the continuous camera's path it was set on.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COPY_ATTR, HOLD_ATTR, HOLD_FALL, copyOpacity, heldStrength, rise } from './ChapterFade';
import { copyPresence, filmIsWide, SHORT_QUERY, WIDE_QUERY } from './copyZone';
import { buildInteriorBeats } from './interiorPath';
import { chapters, DOOR_IN, DOOR_OUT, JOURNEY_END, TRACK_VH, establishCopyGone, tableCopyHold } from './journey';

describe('which way the copy is laid out', () => {
  it('is wide on a landscape frame from 768px up, and on a phone on its side', () => {
    expect(filmIsWide(1440, 900)).toBe(true);
    expect(filmIsWide(1024, 768)).toBe(true); // a tablet on its side
    // CSS calls a square `portrait` (landscape is strictly wider than tall):
    // the page lays it out as a phone, and the lens has to agree
    expect(filmIsWide(768, 768)).toBe(false);
    expect(filmIsWide(900, 900)).toBe(false);
    expect(filmIsWide(769, 768)).toBe(true);
    expect(filmIsWide(390, 844)).toBe(false); // a phone
    expect(filmIsWide(820, 1180)).toBe(false); // a tablet held upright
    expect(filmIsWide(1024, 1366)).toBe(false); // the largest one
    // a phone on its side, whatever its width: no top of the frame to stack copy in
    expect(filmIsWide(844, 390)).toBe(true);
    expect(filmIsWide(740, 360)).toBe(true);
    expect(filmIsWide(667, 375)).toBe(true);
    // a small window that is neither
    expect(filmIsWide(700, 600)).toBe(false);
    expect(filmIsWide(500, 521)).toBe(false);
  });

  it('is the same question the page asks: the `wide` screen is the same words', () => {
    const config = readFileSync(join(__dirname, '../../../tailwind.config.ts'), 'utf8').replace(/\r\n/g, '\n');
    const flat = config.replace(/\s+/g, ' ');
    expect(flat).toContain(`addVariant( 'wide', '@media ${WIDE_QUERY}', );`);
    expect(flat).toContain(`addVariant('short', '@media ${SHORT_QUERY}');`);
    // a variant, not a screen: a raw screen takes max-md: away from the header
    expect(config).not.toMatch(/screens:\s*\{/);
    // and the one class the stylesheet sets by hand on the same frames
    const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8').replace(/\r\n/g, '\n');
    expect(css).toContain(`@media ${WIDE_QUERY} {\n  .t-station {`);
    expect(WIDE_QUERY).toBe(`(min-width: 768px) and (orientation: landscape), ${SHORT_QUERY}`);
    expect(SHORT_QUERY).toBe('(max-height: 520px) and (orientation: landscape)');
    // the short frame's own floors, and the phone's own headline: a frame that is not wide
    expect(css).toContain(`@media ${SHORT_QUERY} {\n  .film-stage {`);
    expect(css).toContain(
      '@media (max-width: 767px) and (orientation: portrait), (max-width: 767px) and (min-height: 521px) {\n  .t-display {',
    );
  });

  it("lays the film's chapters out by it, and not by width alone", () => {
    const page = readFileSync(join(__dirname, '../../app/(site)/(experience)/site-home/page.tsx'), 'utf8').replace(/\r\n/g, '\n');
    // one pane and one block, shared by every chapter: the frame's own edge
    // on a wide frame, a column on a phone — and no width breakpoint in either
    const pane = /const PANE = '([^']+)';/.exec(page)?.[1] ?? '';
    const block = /const BLOCK = '([^']+)';/.exec(page)?.[1] ?? '';
    expect(pane).toContain('sticky top-0');
    expect(pane).toContain('wide:block');
    expect(block).toContain('wide:absolute');
    expect(block).toContain('wide:left-[var(--edge)]');
    for (const c of [pane, block]) expect(c).not.toMatch(/\bmd:|\blg:|\bsm:/);
    // every chapter's pane is that pane, and every placement in it is a wide: one
    const panes = page.match(/className=\{`\$\{PANE\}[^`]*`\}/g) ?? [];
    expect(panes.length).toBeGreaterThanOrEqual(8);
    const blocks = page.match(/className=\{`\$\{BLOCK\}[^`]*`\}/g) ?? [];
    expect(blocks.length).toBeGreaterThanOrEqual(9);
    for (const c of [...panes, ...blocks]) expect(c).not.toMatch(/\bmd:|\blg:/);
    for (const b of blocks) expect(b).toMatch(/wide:(top|bottom)-\[/);
  });
});

describe("a chapter's words, on the camera that never stops", () => {
  // The client, 2026-10-06, of the cut that made the camera wait for the copy:
  // "this one is slow and laggy also why this cam stop for a brief moment? the
  // client didn't like it". The camera is the continuous one again; what is
  // kept of that cut is that the words develop in place and go in place.
  const list = chapters(3);
  const byId = (id: string) => list.find((c) => c.id === id)!;
  /** One notch of the wheel, in document scroll: a third of a viewport. */
  const notch = 100 / 3 / TRACK_VH;
  const int = JOURNEY_END - DOOR_IN;
  const beats = buildInteriorBeats(3);
  const beatAt = (id: string) => beats.find((b) => b.id === id)!.at;
  /** A place on the interior leg, for a place in the document. */
  const leg = (doc: number) => (doc - DOOR_IN) / int;

  it('has a chapter for every stretch of the film that says something, in the order the camera reaches them', () => {
    expect(list.map((c) => c.id)).toEqual([
      'hero', 'revolution', 'holdings', 'approach', 'establish', 'station-1', 'station-2', 'station-3', 'portrait', 'city',
    ]);
    // the track closes on the film's end, each chapter beginning where the last ended
    expect(list[0].from).toBe(0);
    expect(list[list.length - 1].to).toBe(JOURNEY_END);
    for (let i = 1; i < list.length; i += 1) expect(list[i].from).toBeCloseTo(list[i - 1].to, 9);
    // on the track the client approved: the leg outside is longer than the leg inside
    expect(TRACK_VH).toBe(2332);
    expect(DOOR_OUT).toBeGreaterThan(JOURNEY_END - DOOR_IN);
  });

  it('brings each chapter\'s words up inside its chapter, one chapter at a time', () => {
    for (const c of list) {
      if (c.id !== 'hero') expect(c.copy.in[0], c.id).toBeGreaterThanOrEqual(c.from);
      expect(c.copy.in[1], c.id).toBeGreaterThan(c.copy.in[0]);
      expect(c.copy.out[0], c.id).toBeGreaterThanOrEqual(c.copy.in[1]);
      expect(c.copy.out[1], c.id).toBeGreaterThan(c.copy.out[0]);
      // half a notch to come and half a notch to go
      expect((c.copy.out[1] - c.copy.out[0]) / notch, c.id).toBeGreaterThanOrEqual(0.5 - 1e-9);
    }
    // no two chapters' words are on the picture at once
    for (let i = 1; i < list.length; i += 1) {
      expect(list[i].copy.in[0], list[i].id).toBeGreaterThanOrEqual(list[i - 1].copy.out[1] - 1e-9);
    }
  });

  it('has the cover up when the page opens, and gone as the camera gathers way', () => {
    const hero = byId('hero');
    expect(copyOpacity([...hero.copy.in, ...hero.copy.out], 0)).toBe(1);
    expect(hero.copy.out[0]).toBeGreaterThan(1.5 * notch);
    expect(hero.copy.out[1]).toBeLessThanOrEqual(hero.to);
  });

  it('says the door is open as the camera turns onto its axis, and leaves that line to the passage', () => {
    const door = byId('approach');
    // not while the camera is still coming down the west side
    expect(door.copy.in[0] / DOOR_OUT).toBeGreaterThan(0.84);
    expect(door.copy.in[1] / DOOR_OUT).toBeLessThan(0.9);
    // the scroll does not take it: its window closes inside the doorway's own viewport
    expect(door.copy.out[0]).toBeGreaterThan(DOOR_OUT);
    expect(door.copy.out[1]).toBeLessThan(DOOR_IN);
  });

  it("keeps a table's name for as long as the camera dwells on the table, and no longer", () => {
    // the first two tables have a dwell after their beat; the name is gone as the camera leaves it
    for (const [id, dwell] of [['station-1', 'dwell-S1'], ['station-2', 'dwell-S2']] as const) {
      const c = byId(id);
      expect(leg(c.copy.in[0]), id).toBeGreaterThanOrEqual(beatAt(`station-S${id.slice(-1)}`) - 1e-9);
      expect(leg(c.copy.out[1]), id).toBeLessThanOrEqual(beatAt(dwell) + 0.012);
      expect((c.copy.out[0] - c.copy.in[1]) / notch, id).toBeGreaterThanOrEqual(0.9);
    }
    // the last table has none: its name leaves with the camera
    const last = byId('station-3');
    expect((last.copy.out[1] - last.from) / notch).toBeLessThanOrEqual(1.2);
    // and the house lights and the lens's edge hold for exactly as long (hallLight.ts)
    expect(tableCopyHold(3)).toBeCloseTo((byId('station-1').copy.out[1] - byId('station-1').from) / int, 9);
    expect(establishCopyGone(3)).toBeCloseTo(leg(byId('establish').copy.out[1]), 9);
    // the hall's line has gone before the camera turns to the first table
    expect(establishCopyGone(3)).toBeLessThan(beatAt('turn-left') - 0.03);
  });

  it("holds the portrait's line while the camera is on the picture, and the index after the film's last frame", () => {
    const portrait = byId('portrait');
    // up through the climb, and still whole when the camera arrives at the portrait
    expect(leg(portrait.copy.in[1])).toBeLessThan(beatAt('stair-rise'));
    expect(leg(portrait.copy.out[0])).toBeGreaterThanOrEqual(beatAt('portrait') - 1e-9);
    const city = byId('city');
    // not while the camera is still coming down off the portrait
    expect(leg(city.copy.in[0])).toBeGreaterThan(beatAt('court') - 0.02);
    // and for a notch after the film has ended, before the lights go down
    expect((city.copy.out[1] - JOURNEY_END) / notch).toBeGreaterThanOrEqual(1);
    expect((city.copy.out[1] - JOURNEY_END) / notch).toBeLessThanOrEqual(1.5);
  });

  it('develops in place and leaves in place, by one curve', () => {
    const w = [0.2, 0.3, 0.6, 0.7];
    expect(copyOpacity(w, 0.1)).toBe(0);
    expect(copyOpacity(w, 0.2)).toBe(0);
    expect(copyOpacity(w, 0.25)).toBeCloseTo(0.5, 6);
    expect(copyOpacity(w, 0.3)).toBe(1);
    expect(copyOpacity(w, 0.45)).toBe(1);
    expect(copyOpacity(w, 0.65)).toBeCloseTo(0.5, 6);
    expect(copyOpacity(w, 0.7)).toBe(0);
    expect(copyOpacity(w, 0.9)).toBe(0);
    // an eased rise: no speed at either end
    expect(rise(0.21, 0.2, 0.3)).toBeLessThan(0.05);
    expect(rise(0.29, 0.2, 0.3)).toBeGreaterThan(0.95);
  });

  it('is told to the page by the journey, and by nothing else', () => {
    const page = readFileSync(join(__dirname, '../../app/(site)/(experience)/site-home/page.tsx'), 'utf8').replace(/\r\n/g, '\n');
    expect(COPY_ATTR).toBe('data-copy');
    // every pane carries its window, from the chapter the journey laid
    const panes = page.match(/data-chapter-fade data-copy=\{copyOf\(\w+\)\}/g) ?? [];
    expect(panes.length).toBeGreaterThanOrEqual(8);
    expect(page).toContain('function copyOf(c: Chapter): string {');
    // the old ways of saying when a pane is up are gone from the page and the fader
    expect(page).not.toMatch(/data-fade-(after|out|held|in)=/);
    const src = readFileSync(join(__dirname, 'ChapterFade.tsx'), 'utf8').replace(/\r\n/g, '\n');
    expect(src).not.toMatch(/heldOpacity|NARROW_TRAVEL|AFTER_TRAVEL/);
    expect(src).toContain('export function copyOpacity(window: readonly number[], at: number): number {');
    // a section is a viewport taller than its chapter, given back: its pane is
    // pinned from the chapter's first pixel to its last — and for as long
    // after it as its words are still up — so the words never ride in or out
    expect(page).toContain('const linger = Math.max(0, c.copy.out[1] - c.to) * TRACK_VH;');
    expect(page).toContain('minHeight: `calc(${((c.to - c.from) * TRACK_VH + linger).toFixed(2)}vh + 100vh)`,');
    expect(page).toContain('marginBottom: `calc(-100vh - ${linger.toFixed(2)}vh)`,');
    // and the score that made the camera wait is gone
    expect(page).not.toMatch(/filmScore/);
  });
});

describe('a held line goes as a chapter does: in place, before the page lets go of it', () => {
  // The colophon's sign-off on a wide frame (SiteFooter): pinned under the
  // map table for a stretch of scroll. It used to ride up through the table
  // with the lens closed over the whole picture.
  const footer = readFileSync(join(__dirname, '../site/SiteFooter.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const fade = readFileSync(join(__dirname, 'ChapterFade.tsx'), 'utf8').replace(/\r\n/g, '\n');

  it('is whole until half a notch of its hold is left, and gone when none is', () => {
    const frame = 945;
    const notch = frame / 3;
    expect(HOLD_FALL).toBe(0.5);
    expect(heldStrength(0.7 * frame, frame)).toBe(1);
    expect(heldStrength(notch * HOLD_FALL, frame)).toBe(1);
    expect(heldStrength(notch * HOLD_FALL * 0.5, frame)).toBeCloseTo(0.5, 9);
    expect(heldStrength(0, frame)).toBe(0);
    // let go of, it is still gone (the wrapper's foot above its own)
    expect(heldStrength(-40, frame)).toBe(0);
    // the same share of a notch on any frame
    expect(heldStrength(390 / 3 / 4, 390)).toBeCloseTo(heldStrength(945 / 3 / 4, 945), 9);
  });

  it('is the sign-off, pinned on a wide frame with a spacer to be pinned across', () => {
    expect(HOLD_ATTR).toBe('data-hold');
    expect(footer).toMatch(/<p data-line data-hold data-reveal className="t-end text-\[#F2EDE4\] held:sticky held:top-\[60vh\]">/);
    expect(footer).toContain('<div aria-hidden className="hidden held:block held:h-[70vh]" />');
    // held on every wide frame and on a tablet held upright; never on a phone
    const tw = readFileSync(join(__dirname, '../../../tailwind.config.ts'), 'utf8');
    expect(tw).toContain("addVariant('held', '@media (min-width: 768px), (max-height: 520px) and (orientation: landscape)');");
    // one held line, and it keeps its words and their break
    expect(footer.match(/data-hold/g)?.length).toBe(1);
    expect(footer).toMatch(/The land is best seen\s*<br \/>\s*<span className="t-gilt">from the land\.<\/span>/);
  });

  it('is measured off the layout, only where there is room to be held, and leaves the lens when it has gone', () => {
    // no room under it in its wrapper (a frame that is not wide): the header's rule alone
    expect(fade).toContain('if (wrap.height - r.height > 8) held = heldStrength(wrap.bottom - r.bottom, vh);');
    // the weaker of the two rules is the line's strength...
    expect(fade).toContain('const oc = Math.min(strengths[i], clamp01((t - headerLine) / (HEADER_BAND * headerLine)));');
    // ...and a line at nothing is not among the colophon's lines (copyZone.lines)
    expect(fade).toContain('if (strengths[i] < 0.05) continue;');
  });
});

describe("how much of a filter the copy's presence asks for", () => {
  it('is all of it while a quarter of the copy is there', () => {
    expect(copyPresence(0)).toBe(0);
    expect(copyPresence(0.125)).toBeCloseTo(0.5, 6);
    expect(copyPresence(0.25)).toBe(1);
    expect(copyPresence(1)).toBe(1);
  });
});
