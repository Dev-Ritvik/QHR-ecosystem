/**
 * PHASE 6 — mobile, reduced motion, and the low-tier path.
 *
 *   Playwright MCP:  browser_run_code_unsafe { filename: this file }
 *
 * §67 says not to polish while the foundation is broken, and names mobile as
 * one of the things that must work first. This checks the three viewports the
 * brief requires (390x844, 768x1024, 1440x900) plus reduced-motion, and asks of
 * each: does it boot, does it scroll, is the canvas there, does the copy read,
 * and does the console stay clean.
 *
 * Scroll is tested by MOVING the page, not by asserting a handler exists — a
 * trapped scroll is the named mobile failure (§85.7) and the only proof is that
 * the document actually travels.
 */
async (page) => {
  const BASE = 'http://localhost:3001';
  const out = [];

  const CASES = [
    { name: 'mobile-390',  w: 390,  h: 844,  reduced: false, touch: true },
    { name: 'tablet-768',  w: 768,  h: 1024, reduced: false, touch: true },
    { name: 'desktop-1440', w: 1440, h: 900, reduced: false, touch: false },
    { name: 'reduced-1440', w: 1440, h: 900, reduced: true,  touch: false },
  ];

  for (const c of CASES) {
    const errors = [];
    const onErr = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); };
    const onPageErr = (e) => errors.push('pageerror: ' + String(e.message).slice(0, 200));
    page.on('console', onErr);
    page.on('pageerror', onPageErr);

    await page.emulateMedia({ reducedMotion: c.reduced ? 'reduce' : 'no-preference' });
    await page.setViewportSize({ width: c.w, height: c.h });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    try {
      const b = page.getByRole('button', { name: /essential only/i });
      await b.waitFor({ state: 'visible', timeout: 5000 });
      await b.click();
    } catch (e) { /* already consented */ }
    await page.waitForTimeout(5000);

    const before = await page.evaluate(() => window.scrollY);
    // A real wheel gesture over the middle of the page, not a scrollTo — the
    // question is whether input reaches the document, which scrollTo bypasses.
    await page.mouse.move(c.w / 2, c.h / 2);
    for (let i = 0; i < 8; i += 1) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => window.scrollY);

    const state = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const h1 = document.querySelector('main h1');
      const overflowing = document.documentElement.scrollWidth > window.innerWidth + 1;
      return {
        canvas: c ? { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight } : null,
        h1: h1 ? (h1.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 42) : null,
        docHeight: document.documentElement.scrollHeight,
        horizontalOverflow: overflowing,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        // The preloader locks scroll; if it never lifted, that is the bug.
        htmlOverflow: document.documentElement.style.overflow || '(none)',
        links: [...document.querySelectorAll('main a[href^="/"]')].length,
      };
    });

    await page.screenshot({ path: 'C:/dev/estate/tools/capture/out6/mob-' + c.name + '.png' });

    out.push({
      case: c.name, viewport: [c.w, c.h], reducedMotion: c.reduced,
      scrolled: after - before, scrollWorks: after - before > 100,
      ...state, errorCount: errors.length, errors: errors.slice(0, 4),
    });

    page.off('console', onErr);
    page.off('pageerror', onPageErr);
  }

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  return JSON.stringify(out, null, 2);
}
