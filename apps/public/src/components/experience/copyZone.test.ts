// apps/public/src/components/experience/copyZone.test.ts
//
// The page and the lens ask one question — is the frame wide? — in the same
// words, and a pane marked `held` does not move while it can be read.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AFTER_TRAVEL, heldOpacity, NARROW_TRAVEL } from './ChapterFade';
import { FILM_SHARE } from './cameraPath';
import { copyPresence, filmIsWide, SHORT_QUERY, WIDE_QUERY } from './copyZone';

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
    // every sticky pane's placement, and every chapter's column
    const panes = page.match(/className=\{`sticky [^`]*`\}/g) ?? [];
    expect(panes.length).toBeGreaterThanOrEqual(7);
    for (const p of panes) expect(p).not.toMatch(/\bmd:/);
    // (their measures are counts of the stage's unit: filmStage.test.ts)
    const columns = page.match(/className=(?:"|\{`)col-span-12 [^"`]*max-w-\[calc\([\d.]+\*var\(--u\)\)\]/g) ?? [];
    expect(columns.length).toBeGreaterThanOrEqual(6);
    for (const c of columns) expect(c).not.toMatch(/\bmd:/);
  });
});

describe('a pane held in place', () => {
  const travel = NARROW_TRAVEL * 844;

  it('is nothing until it is held, and develops over the first of its hold', () => {
    expect(heldOpacity(-200, travel)).toBe(0);
    expect(heldOpacity(0, travel)).toBe(0);
    expect(heldOpacity(travel / 2, travel)).toBeCloseTo(0.5, 6);
    expect(heldOpacity(travel, travel)).toBe(1);
    expect(heldOpacity(3000, travel)).toBe(1);
  });

  it('leaves by the rule every pane leaves by: it is not dissolved before it is let go', () => {
    // The map's pane is let go at the film's last frame, which is the frame
    // its list is for.
    const src = readFileSync(join(__dirname, 'ChapterFade.tsx'), 'utf8').replace(/\r\n/g, '\n');
    expect(src).toContain('o = Math.min(heldOpacity(since, NARROW_TRAVEL * vh), 1 - gone);');
    expect(src).toContain('const gone = clamp01((stuckTop - el.getBoundingClientRect().top) / (out * vh));');
    // ...and only the last table leaves any faster than it came (OUT_ATTR)
    expect(src).toContain('o = 1 - clamp01(past > 0 ? past / (out * vh) : -past / travel);');
    const page = readFileSync(join(__dirname, '../../app/(site)/(experience)/site-home/page.tsx'), 'utf8').replace(/\r\n/g, '\n');
    expect(page.match(/data-fade-out=/g)?.length).toBe(1);
    expect(page).toContain("data-fade-out={last ? '0.12' : undefined}");
  });

  it('is short: a twelfth of a viewport, so most of the hold is for reading', () => {
    expect(NARROW_TRAVEL).toBeLessThanOrEqual(0.1);
    expect(NARROW_TRAVEL).toBeGreaterThanOrEqual(0.05);
  });
});

describe('a pane that waits for its picture', () => {
  it("is the approach's alone, and waits until the camera has left the flank's lit windows", () => {
    const page = readFileSync(join(__dirname, '../../app/(site)/(experience)/site-home/page.tsx'), 'utf8').replace(/\r\n/g, '\n');
    expect(page.match(/data-fade-after=/g)?.length).toBe(1);
    const after = Number(/id="approach"[\s\S]*?data-fade-after="([\d.]+)"/.exec(page)?.[1]);
    // One viewport is 100 / EXTERIOR_VH of the exterior leg; the approach's
    // pane is held a viewport after its chapter opens (it starts a viewport
    // late: the holdings pane holds past its beat).
    const viewport = 100 / (782 / FILM_SHARE);
    const heldAt = FILM_SHARE + (1 - FILM_SHARE) * 0.15 + viewport;
    const from = heldAt + after * viewport;
    const up = from + AFTER_TRAVEL * viewport;
    // Measured at 1920x1080, every fiftieth of the leg: lit windows behind
    // the copy's place at 0.78 and 0.80, the swoop over the roof's corner to
    // 0.84, and the front of the house — door in frame, the copy on the
    // forecourt — from 0.86.
    expect(from).toBeGreaterThan(0.84);
    expect(up).toBeLessThan(0.865);
  });

  it('develops in place, on every shape of frame, and leaves as every pane does', () => {
    const src = readFileSync(join(__dirname, 'ChapterFade.tsx'), 'utf8').replace(/\r\n/g, '\n');
    expect(src).toContain('} else if (sticky && after > 0 && el.parentElement) {');
    expect(src).toContain('o = Math.min(heldOpacity(since, AFTER_TRAVEL * vh), 1 - gone);');
    // nothing while it waits, half-way through its development, whole after it
    const vh = 900;
    const after = 1.05 * vh;
    expect(heldOpacity(0 - after, AFTER_TRAVEL * vh)).toBe(0);
    expect(heldOpacity(after - after, AFTER_TRAVEL * vh)).toBe(0);
    expect(heldOpacity(after + (AFTER_TRAVEL * vh) / 2 - after, AFTER_TRAVEL * vh)).toBeCloseTo(0.5, 6);
    expect(heldOpacity(after + AFTER_TRAVEL * vh - after, AFTER_TRAVEL * vh)).toBe(1);
    // and a keyboard that reaches its link is taken past the wait
    expect(src).toContain('const develop = pane.after > 0 ? (pane.after + AFTER_TRAVEL) * vh : held ? NARROW_TRAVEL * vh : 0;');
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
