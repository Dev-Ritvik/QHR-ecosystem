/**
 * PHASE 6 — DOM/camera synchronisation measurement.
 *
 *   Playwright MCP:  browser_run_code_unsafe { filename: this file }
 *
 * The captures showed two chapter panes on screen at once at scroll 0.78, with
 * a plan image running under the fixed 62px header. site-home's own comment
 * says a full-viewport sticky pane "cannot do that", so either the comment is
 * wrong or something else is on screen. This measures it rather than arguing.
 *
 * A CORRECTION THIS FILE CARRIES, BECAUSE THE FIRST VERSION WAS WRONG.
 * The first attempt measured `pane.firstElementChild`, which resolved to the
 * `sticky top-0 h-screen` pane ITSELF — a box that is exactly one viewport
 * tall and pinned at y 0. So it reported "62px behind the header" for every
 * chapter at every scroll position, which is trivially true of any full-height
 * pane and says nothing about whether a reader can see the words. Those
 * numbers were discarded.
 *
 * What is measured now is the CONTENT: every heading, paragraph, figure and
 * image inside each pane. A chapter is clipped only if something a visitor is
 * meant to read or look at actually intersects the header band.
 */
async (page) => {
  const BASE = 'http://localhost:3001';

  const MEASURE = async (frac) => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.round(frac * max));
    // Two rAFs: one for Lenis to resync to the jump, one for sticky to resolve.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 500));

    const HEADER = 62;
    const vh = window.innerHeight;
    const secs = [...document.querySelectorAll('main > section, main > header')];

    const panes = secs.map((sec) => {
      // Content, not the pane box. These are the elements a visitor reads.
      const bits = [...sec.querySelectorAll('h1, h2, h3, p, img, dl, figure')];
      let top = Infinity, bottom = -Infinity, clipped = [];
      for (const el of bits) {
        const r = el.getBoundingClientRect();
        if (r.height < 4 || r.width < 4) continue;
        // Only count things actually inside the viewport band.
        if (r.bottom < -50 || r.top > vh + 50) continue;
        top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom);
        const overlap = Math.min(r.bottom, HEADER) - Math.max(r.top, 0);
        if (overlap > 4) {
          clipped.push({
            tag: el.tagName.toLowerCase(),
            px: Math.round(overlap),
            what: el.tagName === 'IMG'
              ? (el.getAttribute('alt') || 'image').slice(0, 30)
              : (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30),
          });
        }
      }
      if (top === Infinity) return null;
      const visible = Math.max(0, Math.min(bottom, vh) - Math.max(top, 0));
      const h = bottom - top;
      const label = (sec.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24);
      return {
        label,
        contentTop: Math.round(top), contentBottom: Math.round(bottom),
        visibleFrac: +(visible / Math.max(1, h)).toFixed(3),
        clipped,
      };
    }).filter(Boolean).filter((p) => p.visibleFrac > 0.02);

    return { frac: +(window.scrollY / max).toFixed(4), panes };
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  try {
    const b = page.getByRole('button', { name: /essential only/i });
    await b.waitFor({ state: 'visible', timeout: 6000 });
    await b.click();
  } catch (e) { /* already consented */ }
  await page.waitForTimeout(3000);

  const out = [];
  for (const f of [0.00, 0.10, 0.20, 0.32, 0.40, 0.46, 0.52, 0.60, 0.62, 0.70, 0.72, 0.78, 0.84, 0.87, 0.95]) {
    out.push(await page.evaluate(MEASURE, f));
  }

  const summary = out.map((s) => ({
    frac: s.frac,
    // Two chapters legible at once is the failure the pane design exists to
    // prevent; 0.25 is the threshold below which a pane is leaving rather than
    // being read.
    coVisible: s.panes.filter((p) => p.visibleFrac > 0.25).length,
    clipped: s.panes.flatMap((p) => p.clipped.map((c) => `${c.px}px ${c.tag} "${c.what}"`)),
    panes: s.panes.map((p) => `"${p.label}" vis=${p.visibleFrac} top=${p.contentTop}`),
  }));

  return JSON.stringify({ summary }, null, 2);
}
