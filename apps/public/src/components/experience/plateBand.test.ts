import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_RISE, NOMINAL_BAND, riseInBand, stillProgress } from './plateBand';
import { POSES, STILL_PHONE } from './poses';

const src = (rel: string) => readFileSync(join(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');

// Where the axis lands, in CSS px from the top of a frame `height` high.
const axisAt = (rise: number, height: number) => (0.5 - rise) * height;

describe('the picture has its own band on an upright screen', () => {
  it('stands the axis where the pose says, between the header and the first line of the words', () => {
    const band = { top: 56, bottom: 456 };
    expect(axisAt(riseInBand(0.25, band, 844), 844)).toBeCloseTo(156, 6);
    expect(axisAt(riseInBand(1, band, 844), 844)).toBeCloseTo(456, 6);
    expect(axisAt(riseInBand(0.5, band, 844), 844)).toBeCloseTo(256, 6);
  });

  it('follows the words: a longer title leaves a shorter band, and the subject goes up with it', () => {
    // The same phone, a layout's page (its words start at 433) and the privacy
    // page (a three-line title over a four-line lede: 389).
    const layout = axisAt(riseInBand(0.5, { top: 56, bottom: 433 }, 844), 844);
    const privacy = axisAt(riseInBand(0.5, { top: 56, bottom: 389 }, 844), 844);
    expect(privacy).toBeLessThan(layout);
    expect(privacy).toBeLessThan(389);
    expect(privacy).toBeGreaterThan(56);
  });

  it('follows the screen: the same page with the browser bars showing keeps its subject over its title', () => {
    // The words are as tall as they were; the frame is 180 px shorter, so
    // they start 180 px higher. A fixed share of the frame put the subject at
    // 0.28 x 664 = 186 — forty pixels off the title, inside its density.
    const tall = { top: 56, bottom: 433 };
    const short = { top: 56, bottom: 433 - 180 };
    const a = axisAt(riseInBand(0.45, short, 664), 664);
    expect(a).toBeGreaterThan(short.top);
    expect(a).toBeLessThan(short.bottom);
    // the same place IN the band on both
    const share = (y: number, b: { top: number; bottom: number }) => (y - b.top) / (b.bottom - b.top);
    expect(share(a, short)).toBeCloseTo(share(axisAt(riseInBand(0.45, tall, 844), 844), tall), 6);
  });

  it('is the frame the poses were judged in until a page has measured its own', () => {
    // 390x844, a 56 px header, words from 456: the nominal band's own shares.
    expect(NOMINAL_BAND.top * 844).toBeCloseTo(56, 0);
    expect(NOMINAL_BAND.bottom * 844).toBeCloseTo(456, 0);
    const measured = riseInBand(0.45, { top: NOMINAL_BAND.top * 844, bottom: NOMINAL_BAND.bottom * 844 }, 844);
    expect(riseInBand(0.45, null, 844)).toBeCloseTo(measured, 6);
    // and with no frame to speak of, the same
    expect(riseInBand(0.45, { top: 56, bottom: 456 }, 0)).toBeCloseTo(measured, 6);
    // a band that is not one (the words above the header's foot) is no band
    expect(riseInBand(0.45, { top: 56, bottom: 40 }, 844)).toBeCloseTo(measured, 6);
  });

  it('keeps the tables where they were set: 0.22 of a 390x844 frame, within a pixel or two', () => {
    // The layouts' tables were set at a rise of 0.22 on that frame; as a place
    // in the nominal band that is 0.45.
    expect(riseInBand(POSES.table.phone!.at, null, 844)).toBeCloseTo(0.22, 2);
    expect(riseInBand(POSES.portrait.phone!.at, null, 844)).toBeCloseTo(0.2, 2);
    expect(riseInBand(STILL_PHONE.interior.at, null, 844)).toBeCloseTo(0.14, 2);
    expect(riseInBand(STILL_PHONE.exterior.at, null, 844)).toBeCloseTo(0.16, 2);
  });

  it('never shifts the front past a third of the frame', () => {
    expect(riseInBand(0, { top: 0, bottom: 10 }, 844)).toBeLessThanOrEqual(MAX_RISE);
    expect(riseInBand(1, { top: 800, bottom: 3000 }, 844)).toBeGreaterThanOrEqual(-MAX_RISE);
    expect(riseInBand(-4, { top: 56, bottom: 456 }, 844)).toBeCloseTo(riseInBand(0, { top: 56, bottom: 456 }, 844), 6);
    expect(riseInBand(9, { top: 56, bottom: 456 }, 844)).toBeCloseTo(riseInBand(1, { top: 56, bottom: 456 }, 844), 6);
  });

  it('every still names a place inside its band', () => {
    for (const [id, pose] of Object.entries(POSES)) {
      const ph = pose.phone ?? STILL_PHONE[pose.set];
      // (The film's first frame has its house below its axis: its place is
      // high in the band so the house is in the middle of it.)
      expect(ph.at, id).toBeGreaterThan(pose.path ? 0.05 : 0.2);
      expect(ph.at, id).toBeLessThan(0.8);
      expect(ph.widen, id).toBeGreaterThanOrEqual(1);
    }
    // (The small print and the sitemap stood on the hall's axis, the portrait
    // at the end of it, and had a place in the band of their own so that their
    // titles were not printed across his face. Each has its own picture now,
    // and none of them is his: places.ts.)
  });

  it('is measured by the page and read by the rig, and a short plate is short on a phone too', () => {
    const chrome = src('../folio/FolioClient.tsx');
    expect(chrome).toContain("from '@/components/experience/plateBand'");
    expect(chrome).toContain('plateBand.current = {');
    expect(chrome).toContain('plateBand.current = null;');
    const rig = src('WorldCanvas.tsx');
    expect(rig).toContain("riseInBand(typeof dial === 'number' ? dial : ph.at, plateBand.current, size.height)");
    // …and a page on the film's first frame is banded too, the film never
    expect(rig).toContain("(!lens || (held && journeyState.leg === 'exterior' && doorFov === null))");
    expect(rig).toContain('held={pathStill}');
    // A short plate on a phone: three-quarters of 664 px was the words and
    // nothing else, so it was made a whole frame — and then eleven pages were
    // short on a desk and none on a phone (the forensic audit of 2026-10-09,
    // #68: "two opening proportions with no visible rule"). It is its words
    // under a MEASURED band of picture there: short on every screen.
    const css = src('../../app/folio.css');
    const upright = css.slice(css.indexOf('/* AN UPRIGHT FRAME'));
    expect(upright).toMatch(/\.folio-plate\.is-short \{\s*min-height: 0;\s*padding-top: calc\(var\(--fbar\) \+ 30vh\);\s*padding-top: calc\(var\(--fbar\) \+ 30svh\);/);
    expect(upright).not.toMatch(/\.folio-plate\.is-short \{\s*min-height: 100vh;/);
  });

  it('ends a page\u2019s move at its window, on the frame composed for it', () => {
    // with no window the move runs the page's length, eased at both ends
    expect(stillProgress(0, 4000, null)).toBe(0);
    expect(stillProgress(4000, 4000, null)).toBe(1);
    expect(stillProgress(2000, 4000, null)).toBeCloseTo(0.5, 6);
    expect(stillProgress(1000, 4000, null)).toBeLessThan(0.25);
    // with one, it is over when the window stands in the middle of the frame…
    expect(stillProgress(1500, 9000, 3000)).toBeCloseTo(0.5, 6);
    expect(stillProgress(3000, 9000, 3000)).toBe(1);
    // …and held from there to the foot of the page
    expect(stillProgress(8000, 9000, 3000)).toBe(1);
    const chrome = src('../folio/FolioClient.tsx');
    expect(chrome).toContain("document.querySelector<HTMLElement>('.folio .folio-window')");
    expect(chrome).toContain('pageMove.end = Math.max(1, r.top + window.scrollY + r.height / 2 - window.innerHeight / 2);');
    const rig = src('WorldCanvas.tsx');
    expect(rig).toContain('still = stillProgress(t * scrollExtent(), scrollExtent(), pageMove.end);');
    // and on an upright screen the frame is not slid up at the window for a
    // band of words that is no longer there (#67: a screen of empty floor)
    expect(rig).toContain('const let_go = pageMove.end !== null ? 1 - still : 1;');
  });

  it('gives the frame-wide density to a phone alone: on a tablet held upright it was a panel with an edge', () => {
    // A tablet's block is two-thirds of its frame. A flat density as wide as
    // the block ended in a hard vertical line across the picture (seen at
    // 820x1180, on every plate and every window): there the flag runs out to
    // nothing past the words, as it does on a wide frame.
    const css = src('../../app/folio.css');
    expect(css).not.toMatch(/@media \(max-width: 767px\), \(orientation: portrait\) \{\s*\.folio-(plate|window)-copy::before/);
    expect(css).toMatch(/@media \(max-width: 767px\) \{\s*\.folio-plate-copy::before \{\s*right: calc\(-1 \* var\(--edge\)\);\s*top: -5rem;/);
    expect(css).toMatch(
      /@media \(max-width: 767px\) \{\s*\.folio-window \{[^}]*\}\s*\.folio-window-copy \{[^}]*\}\s*\.folio-window-copy::before \{\s*right: calc\(-1 \* var\(--edge\)\);/,
    );
  });

  it('sets a phone\u2019s window as its plate is set: the picture, and the words under it', () => {
    // The forensic audit of 2026-10-09: the line stood in the middle of the
    // opening on a density most of the opening deep — over the subject (#71:
    // the founder's motto on a portrait "cropped at the neck"; #67: "a full
    // screen of empty marble floor") — and the density stopped nine pixels
    // short of the screen's right edge (#72), because the block was only as
    // wide as its words.
    const css = src('../../app/folio.css');
    const phone = css.slice(css.indexOf('/* ON A PHONE A WINDOW IS SET AS A PLATE IS'));
    const block = phone.slice(phone.indexOf('@media (max-width: 767px) {'));
    expect(block).toMatch(/\.folio-window \{\s*align-items: flex-end;/);
    // the frame's width, so the density reaches both of its edges
    expect(block).toMatch(/\.folio-window-copy \{\s*width: 100%;\s*\}/);
    expect(block).toMatch(/\.folio-window-copy::before \{\s*right: calc\(-1 \* var\(--edge\)\);\s*top: -5rem;/);
    // and the subject stands over the words: the rig slides the frame up at
    // the window, a little, where it used to let it go altogether
    const rig = src('WorldCanvas.tsx');
    expect(rig).toContain('WINDOW_RISE * (1 - let_go)) *');
    expect(rig).toMatch(/const WINDOW_RISE = 0\.1\d;/);
    // an upright screen's own subject, where a wide frame's aim is between two
    expect(rig).toContain('look.current.lerp(TMP.set(...p.phone.target), upright * (1 - still));');
  });
});
