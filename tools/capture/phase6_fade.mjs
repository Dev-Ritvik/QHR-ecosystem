/**
 * PHASE 6 — the departure fade.
 *
 *   Playwright MCP:  browser_run_code_unsafe { filename: this file }
 *
 * Two defects, one measurement:
 *
 *   1. Content of a departing chapter reaching the TRANSLUCENT header band, so
 *      a full-colour layout plan showed through the bar behind the logo.
 *      Reported as `bandBrightness` — pixels of that pane inside y 0..62,
 *      weighted by the opacity it is actually drawn at. Zero is the goal.
 *
 *   2. Two chapters legible at once, which site-home's pane design claims is
 *      impossible. Reported as `legible`: panes that are both substantially in
 *      view AND drawn above 0.35 opacity. One is the goal.
 *
 * And one regression guard, because the first implementation broke it: the
 * chapter being READ must be at full opacity. `heldOpacity` is the opacity of
 * the dominant pane at each chapter's own held midpoint, and every one of them
 * must be 1.
 */
async (page) => {
  const BASE = 'http://localhost:3001';
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

  // Wait for the preloader to APPLY its lock and then release it. The naive
  // `!== 'hidden'` check resolves instantly, because the Preloader is
  // dynamic(ssr:false) and the inline style is '' until it mounts — measured,
  // it returned at 359 ms with zero meshes in the scene while the cover did not
  // actually lift until 2870 ms.
  const ready = async () => {
    const locked = await page
      .waitForFunction(() => document.documentElement.style.overflow === 'hidden',
                       undefined, { timeout: 8000 })
      .then(() => true, () => false);
    if (locked) {
      await page.waitForFunction(() => document.documentElement.style.overflow !== 'hidden',
                                 undefined, { timeout: 45000 });
    }
    await page.waitForTimeout(600);
  };

  const SAMPLE = (frac) => {
    const HEADER = 62;
    const vh = window.innerHeight;
    const panes = [...document.querySelectorAll('[data-chapter-fade]')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const op = +getComputedStyle(el).opacity;
        const vis =
          Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) / Math.max(1, r.height);
        let band = 0;
        for (const b of el.querySelectorAll('img, h1, h2, h3, p, a')) {
          const br = b.getBoundingClientRect();
          if (br.height < 4) continue;
          band += Math.max(0, Math.min(br.bottom, HEADER) - Math.max(br.top, 0));
        }
        return {
          label: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 22),
          opacity: +op.toFixed(3),
          visFrac: +vis.toFixed(2),
          bandPx: Math.round(band),
          // The defect in one number: how much light a departing chapter is
          // still putting into the bar.
          bandBrightness: +(band > 0 ? op : 0).toFixed(3),
        };
      })
      .filter((p) => p.visFrac > 0.02);
    const dominant = panes.slice().sort((a, b) => b.visFrac - a.visFrac)[0] || null;
    return {
      frac: +(window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)).toFixed(3),
      legible: panes.filter((p) => p.visFrac > 0.25 && p.opacity > 0.35).length,
      worstBandBrightness: Math.max(0, ...panes.map((p) => p.bandBrightness)),
      dominant,
      panes,
    };
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  try {
    const b = page.getByRole('button', { name: /essential only/i });
    await b.waitFor({ state: 'visible', timeout: 5000 });
    await b.click();
  } catch (e) { /* consented */ }
  await ready();

  const at = async (frac) => {
    await page.evaluate((f) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.round(f * max));
    }, frac);
    await page.waitForTimeout(1400);
    return page.evaluate(SAMPLE, frac);
  };

  // Held midpoints of each chapter (the frame the visitor reads), then the
  // transitions between them (where the defect lived).
  const HELD = [0.00, 0.20, 0.32, 0.52, 0.62, 0.72, 0.84];
  const MOVING = [0.10, 0.60, 0.70, 0.78, 0.87, 0.95];

  const held = [];
  for (const f of HELD) held.push(await at(f));
  const moving = [];
  for (const f of MOVING) moving.push(await at(f));

  for (const [f, n] of [[0.78, '078'], [0.87, '087']]) {
    await page.evaluate((x) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.round(x * max));
    }, f);
    await page.waitForTimeout(1600);
    await page.screenshot({
      path: 'C:/dev/estate/tools/capture/out6/fade-' + n + '.png',
      clip: { x: 0, y: 0, width: 1440, height: 260 },
    });
  }

  return JSON.stringify({
    heldOpacity: held.map((h) => ({ frac: h.frac, label: h.dominant && h.dominant.label,
                                    opacity: h.dominant && h.dominant.opacity })),
    heldAllFull: held.every((h) => h.dominant && h.dominant.opacity === 1),
    moving: moving.map((m) => ({ frac: m.frac, legible: m.legible,
                                 worstBandBrightness: m.worstBandBrightness })),
    maxLegibleAnywhere: Math.max(...held.concat(moving).map((r) => r.legible)),
    maxBandBrightnessAnywhere: Math.max(...held.concat(moving).map((r) => r.worstBandBrightness)),
    detail: moving,
    errorCount: errors.length,
    errors: errors.slice(0, 4),
  }, null, 2);
}
