// apps/public/src/components/folio/planView.test.ts
//
// Looking at a sheet closely (the forensic audit of 2026-10-09, #64: "a viewer
// inside the page with zoom and pan"): the arithmetic the viewer stands on.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WHOLE, clampView, fitSize, maxScale, panBy, zoomAt } from './planView';

const read = (p: string) => readFileSync(join(__dirname, p), 'utf8').replace(/\r\n/g, '\n');

const DESK = { w: 1920, h: 870 };
const PHONE = { w: 390, h: 760 };
const UPRIGHT = { w: 1600, h: 1557 };
const WIDE = { w: 1600, h: 948 };

describe('a sheet in the viewer', () => {
  it('lies whole in the frame, as large as the frame allows', () => {
    const a = fitSize(DESK, UPRIGHT, 24);
    expect(a.h).toBeCloseTo(870 - 48, 6);
    expect(a.w / a.h).toBeCloseTo(1600 / 1557, 6);
    const b = fitSize(PHONE, WIDE, 24);
    expect(b.w).toBeCloseTo(390 - 48, 6);
    expect(b.h).toBeLessThan(760);
  });

  it('comes as close as twice its own pixels, and never less than twice the whole', () => {
    // on a phone the whole sheet is 342 px wide: its own pixels are 4.7 times that
    expect(maxScale(PHONE, WIDE, 24)).toBeCloseTo((2 * 1600) / 342, 6);
    // on a desk it is shown near its own size already, and can still be leaned into
    expect(maxScale(DESK, UPRIGHT, 24)).toBeGreaterThanOrEqual(2);
    expect(maxScale({ w: 4000, h: 4000 }, WIDE, 0)).toBe(2);
  });

  it('holds still the point under the hand as it comes closer', () => {
    // (a frame the sheet outgrows both ways at three times: it is free to
    // move, so nothing but the hand decides where it stands)
    const frame = { w: 600, h: 300 };
    const at = { x: 30, y: -40 };
    const v = zoomAt(WHOLE, 3, at, frame, UPRIGHT, 24);
    expect(v.scale).toBe(3);
    // the sheet's point that was under `at` at scale 1 is under it at scale 3
    const before = { x: (at.x - WHOLE.x) / WHOLE.scale, y: (at.y - WHOLE.y) / WHOLE.scale };
    expect(v.x + before.x * v.scale).toBeCloseTo(at.x, 6);
    expect(v.y + before.y * v.scale).toBeCloseTo(at.y, 6);
    // and back again is the whole sheet, centred
    const back = zoomAt(v, 0.1, at, frame, UPRIGHT, 24);
    expect(back).toEqual(WHOLE);
    // where the sheet does not fill the frame it stays in the middle of it
    expect(zoomAt(WHOLE, 2, { x: 200, y: -120 }, DESK, UPRIGHT, 24).x).toBe(0);
  });

  it('cannot be dragged out of the frame, nor moved at all while it is whole', () => {
    expect(panBy(WHOLE, 500, -300, DESK, UPRIGHT, 24)).toEqual(WHOLE);
    const close = zoomAt(WHOLE, 3, { x: 0, y: 0 }, PHONE, WIDE, 24);
    const far = panBy(close, 99999, 99999, PHONE, WIDE, 24);
    const fit = fitSize(PHONE, WIDE, 24);
    // its left edge has come to the frame's left edge and stops there
    expect(far.x).toBeCloseTo((fit.w * close.scale - PHONE.w) / 2, 6);
    expect(far.y).toBeCloseTo(Math.max(0, (fit.h * close.scale - PHONE.h) / 2), 6);
    // and a scale out of range is brought into it
    expect(clampView({ scale: 0.2, x: 0, y: 0 }, DESK, UPRIGHT, 24).scale).toBe(1);
    expect(clampView({ scale: 99, x: 0, y: 0 }, DESK, UPRIGHT, 24).scale).toBe(maxScale(DESK, UPRIGHT, 24));
  });
});

describe('the way into it', () => {
  const viewer = read('PlanViewer.tsx');
  const folio = read('Folio.tsx');
  const css = readFileSync(join(__dirname, '../../app/folio.css'), 'utf8').replace(/\r\n/g, '\n');

  it('opens on the page, as the browser’s own modal, and is still a link without script', () => {
    expect(folio).toContain('<PaperLink src={src} w={w} h={h} alt={alt}>');
    expect(folio).not.toContain('target="_blank"');
    expect(viewer).toContain('d.showModal();');
    expect(viewer).toContain('href={src}');
    // a press with a modifier is left to the browser
    expect(viewer).toContain('if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;');
    // the page behind does not take the wheel
    expect(viewer).toContain("el.addEventListener('wheel', onWheel, { passive: false });");
    expect(viewer).toContain('data-lenis-prevent');
  });

  it('says what it does in the page’s own quiet action, not on a chip over the sheet', () => {
    expect(viewer).toContain('<span className="cta-quiet-label">Look closer</span>');
    expect(css).not.toContain('.folio-paper-open');
    for (const word of ['Close', 'Further', 'Closer', 'Whole sheet']) {
      expect(viewer).toContain(`<span className="cta-quiet-label">${word}</span>`);
    }
  });
});
