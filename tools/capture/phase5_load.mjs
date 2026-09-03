/**
 * Phase 5 forensic follow-up: what the visitor actually downloads and how long
 * the exterior takes to become visible.
 *
 *   Playwright MCP:  browser_run_code_unsafe { filename: this file }
 *
 * Measured on a COLD context (no HTTP cache) so the numbers are a first visit,
 * which is the only visit that matters for a landing page. The clock stops on
 * the app's own [exterior_ready] console line - the moment the GLB has been
 * parsed, transcoded, uploaded and added to the scene - rather than on `load`,
 * which fires long before there is a building on screen.
 */
async (page) => {
  const ctx = page.context();
  const rows = [];
  const t0 = Date.now();
  let readyAt = null, readyLine = null;

  page.on('console', (m) => {
    const t = m.text();
    if (readyAt === null && t.indexOf('[exterior_ready]') === 0) {
      readyAt = Date.now() - t0; readyLine = t.slice(0, 400);
    }
  });
  page.on('response', async (r) => {
    try {
      const h = r.headers();
      rows.push({ url: r.url().replace('http://localhost:3001', ''),
                  status: r.status(),
                  type: h['content-type'] || '',
                  bytes: +(h['content-length'] || 0) });
    } catch (e) { /* redirects have no body */ }
  });

  await ctx.clearCookies();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3001/?model=p4e', { waitUntil: 'load' });
  const loadAt = Date.now() - t0;
  await page.waitForTimeout(15000);

  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] || {};
    const res = performance.getEntriesByType('resource').map((r) => ({
      name: r.name.replace(location.origin, ''), size: r.transferSize || r.encodedBodySize || 0,
      dur: Math.round(r.duration), start: Math.round(r.startTime),
    })).sort((a, b) => b.size - a.size);
    return {
      domContentLoaded: Math.round(n.domContentLoadedEventEnd || 0),
      loadEvent: Math.round(n.loadEventEnd || 0),
      transferTotalKB: Math.round(res.reduce((a, r) => a + r.size, 0) / 1024),
      top: res.slice(0, 14),
      count: res.length,
    };
  });

  const byType = {};
  for (const r of rows) {
    const k = /\.glb/.test(r.url) ? 'glb'
            : /\.(ktx2|jpg|png|webp)/.test(r.url) ? 'image'
            : /\.(js|mjs)/.test(r.url) ? 'js'
            : /\.(wasm)/.test(r.url) ? 'wasm'
            : /\.(css)/.test(r.url) ? 'css' : 'other';
    byType[k] = byType[k] || { n: 0, kb: 0 };
    byType[k].n++; byType[k].kb += Math.round(r.bytes / 1024);
  }

  return { exteriorReadyMs: readyAt, loadEventMs: loadAt, readyLine, nav, byType,
           note: 'localhost, no throttling: transfer sizes are real, times are a floor' };
}
