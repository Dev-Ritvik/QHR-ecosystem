// apps/public/e2e-experience/experience.spec.ts
//
// The cinematic experience, proved rather than described.
//
// ---------------------------------------------------------------------------
// WHAT THIS REPLACES, AND WHY IT HAD TO GO
// ---------------------------------------------------------------------------
//
// e2e-slice0/persistence.spec.ts was the only test the experience ever had, and
// by the time Phase 6 opened it was asserting a world that no longer existed:
//
//   * it read `persistence-probe`, `probe-ctx` and `probe-gen` testids that
//     live only in ExperienceCanvas.tsx — a Slice-0 skeleton the app stopped
//     importing when WorldCanvas replaced it;
//   * it asserted headings ("Built for the long horizon", "proof, not
//     persuasion") that /about and /why-us no longer carry;
//   * and it counted requestAnimationFrame callbacks in a headless browser and
//     called the result "60fps on the reference machine", which is a vsync-off
//     number and not a frame rate any visitor would see.
//
// A test that cannot fail for the right reason is worse than no test. All three
// are deleted rather than patched.
//
// ---------------------------------------------------------------------------
// WHY THIS RUNS UNDER ITS OWN CONFIG
// ---------------------------------------------------------------------------
//
// The default playwright.config.ts installs a globalSetup that seeds fixture
// data by running packages/db/src/seed/seed.ts against whatever DATABASE_URL
// points at — which locally is the live projection. Nothing in this file writes
// data or needs a fixture, so it runs under playwright.experience.config.ts,
// which has no globalSetup at all.
//
// ---------------------------------------------------------------------------
// WHY IT REACHES INTO THE SCENE
// ---------------------------------------------------------------------------
//
// Two of the required proofs — that dragging a table turns the table and NOT
// the camera, and that it does not scroll the page — cannot be made from the
// DOM: the canvas is one opaque element and everything interesting is inside
// it. So the same door the capture probes use is opened here: three's
// WebGLRenderer and Scene dispatch an `observe` event at
// window.__THREE_DEVTOOLS__ when that global exists, so a listener installed
// before the bundle runs hands the harness the live scene with no source
// change and no debug path that could ship by accident.

import { test, expect, type Page } from '@playwright/test';

const VIEWPORT = { width: 1440, height: 900 };

/** Installed before the bundle runs, so three announces itself to us. */
const DEVTOOLS_HOOK = () => {
  const hits: { scenes: unknown[]; renderers: unknown[] } = { scenes: [], renderers: [] };
  const tgt = new EventTarget();
  tgt.addEventListener('observe', (e) => {
    const o = (e as CustomEvent).detail as { isScene?: boolean; isWebGLRenderer?: boolean };
    if (!o) return;
    if (o.isScene) hits.scenes.push(o);
    else if (o.isWebGLRenderer) hits.renderers.push(o);
  });
  (window as unknown as Record<string, unknown>).__THREE_DEVTOOLS__ = tgt;
  (window as unknown as Record<string, unknown>).__PROBE__ = hits;
};

/**
 * Wait for the preloader to release the document.
 *
 * It holds `overflow: hidden` until the scene is ready, and every gesture
 * issued under that lock is silently dropped — a flat timeout here produced two
 * false failures during Phase 6 before this replaced it.
 */
async function ready(page: Page) {
  await page.waitForFunction(
    () => document.documentElement.style.overflow !== 'hidden',
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(500);
}

/** Consent is a full-frame overlay; "Essential only" is the privacy-preserving
 *  choice and analytics have no business in a test run. */
async function consent(page: Page) {
  try {
    const b = page.getByRole('button', { name: /essential only/i });
    await b.waitFor({ state: 'visible', timeout: 5000 });
    await b.click();
    await page.waitForTimeout(300);
  } catch {
    /* cookie already present */
  }
}

async function scrollToFraction(page: Page, frac: number) {
  await page.evaluate((f) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.round(f * max));
  }, frac);
  await page.waitForTimeout(1200);
}

/** Collects console errors and page errors for the duration of a test. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test.describe('the film', () => {
  test('home loads, server-renders its content, and boots WebGL', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);

    // The words exist before any of the 3D does.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await ready(page);
    const canvas = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c ? { w: c.width, h: c.height } : null;
    });
    expect(canvas, 'a WebGL canvas is present on a capable browser').not.toBeNull();
    expect(canvas!.w).toBeGreaterThan(100);

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('the page works with JavaScript disabled', async ({ browser }) => {
    // The canvas is aria-hidden and client-only, so this is the experience for
    // a crawler, a screen reader and anyone whose WebGL fails. Every
    // destination the 3D can reach has to be a real link here.
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const projectLinks = await page.locator('main a[href^="/projects/"]').count();
    expect(projectLinks, 'each station is a real link without JS').toBeGreaterThan(0);
    await expect(page.locator('main a[href="/about"]').first()).toHaveCount(1);

    await ctx.close();
  });

  test('every chapter section is a real anchor', async ({ page }) => {
    // This is what makes the fragment URLs degrade: with no JavaScript the same
    // address still lands on the same chapter, because the id is in the markup.
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);

    const ids = await page.evaluate(() =>
      [...document.querySelectorAll('main > section[id], main > header[id]')].map((s) => s.id),
    );
    expect(ids).toContain('hero');
    expect(ids).toContain('constellation');
    expect(ids).toContain('portrait');
    expect(ids.filter((i) => i.startsWith('station-')).length).toBeGreaterThan(0);
  });
});

test.describe('the address bar', () => {
  test('follows the film without a request or a history entry', async ({ page }) => {
    const errors = watchErrors(page);
    const documents: string[] = [];
    page.on('request', (r) => {
      if (r.resourceType() === 'document') documents.push(r.url());
    });

    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);

    const before = documents.length;
    const historyBefore = await page.evaluate(() => window.history.length);

    // The first chapter is the bare path on purpose.
    expect(new URL(page.url()).hash).toBe('');

    await scrollToFraction(page, 0.32);
    expect(new URL(page.url()).hash).toBe('#constellation');

    await scrollToFraction(page, 0.7);
    expect(new URL(page.url()).hash).toMatch(/^#station-/);

    await scrollToFraction(page, 0.87);
    expect(new URL(page.url()).hash).toBe('#portrait');

    // Back to the top sheds the fragment rather than keeping the last chapter.
    await scrollToFraction(page, 0);
    expect(new URL(page.url()).hash).toBe('');

    expect(documents.length - before, 'no server request while scrolling').toBe(0);
    expect(
      (await page.evaluate(() => window.history.length)) - historyBefore,
      'replaceState, so no history entries are added',
    ).toBe(0);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('a deep link opens on its chapter', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/#station-1');
    await consent(page);
    await ready(page);
    await page.waitForTimeout(1500);

    const landed = await page.evaluate(() => {
      const sec = document.getElementById('station-1');
      if (!sec) return null;
      return {
        y: window.scrollY,
        top: sec.offsetTop,
        bottom: sec.offsetTop + sec.offsetHeight,
      };
    });
    expect(landed).not.toBeNull();
    // Asserted against the SECTION's own geometry, so retuning the track cannot
    // silently invalidate this.
    expect(landed!.y).toBeGreaterThanOrEqual(landed!.top - 16);
    expect(landed!.y).toBeLessThanOrEqual(landed!.bottom);
  });

  test('an unknown fragment is inert', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/#not-a-chapter');
    await consent(page);
    await ready(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});

test.describe('navigation', () => {
  test('the canvas survives navigation inside the experience segment', async ({ page }) => {
    // THE LOAD-BEARING CLAIM of the persistent-flight architecture. Proved by
    // TAGGING the live element and checking the tag survives, which is stronger
    // than "a canvas is present" — a remount would produce a different element
    // with no tag.
    const errors = watchErrors(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/about');
    await consent(page);
    await ready(page);

    await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (c) (c as HTMLCanvasElement).dataset.e2eTag = 'kept';
    });

    await page.getByRole('link', { name: /how we work/i }).first().click();
    await expect(page).toHaveURL(/\/why-us$/);
    await page.waitForTimeout(1500);

    const survived = await page.evaluate(
      () => document.querySelector('canvas')?.getAttribute('data-e2e-tag') === 'kept',
    );
    expect(survived, 'the same canvas element is still mounted').toBe(true);

    // And back through history.
    await page.goBack();
    await expect(page).toHaveURL(/\/about$/);
    await page.waitForTimeout(1200);
    expect(
      await page.evaluate(
        () => document.querySelector('canvas')?.getAttribute('data-e2e-tag') === 'kept',
      ),
      'history navigation does not remount it either',
    ).toBe(true);

    // Forward, too.
    await page.goForward();
    await expect(page).toHaveURL(/\/why-us$/);

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('the veil closes and reopens across a route change', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/about');
    await consent(page);
    await ready(page);

    const veilOpacity = () =>
      page.evaluate(() => {
        const el = document.querySelector('div.fixed.inset-0.z-\\[80\\]');
        return el ? +getComputedStyle(el).opacity : -1;
      });

    expect(await veilOpacity(), 'idle and invisible before anything happens').toBe(0);

    await page.getByRole('link', { name: /how we work/i }).first().click();

    // PEAK across the transition, not one sample: a fixed offset is a race
    // against the compositor and returned both 0.98 and 0.00 on the same code.
    let peak = 0;
    for (let i = 0; i < 14; i += 1) {
      peak = Math.max(peak, await veilOpacity());
      await page.waitForTimeout(60);
    }
    expect(peak, 'the veil actually closes').toBeGreaterThan(0.9);

    await page.waitForTimeout(1600);
    expect(await veilOpacity(), 'and reopens — never leave a visitor behind it').toBe(0);
  });

  test('an in-page fragment link does not veil', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);

    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = '#constellation';
      a.id = 'e2e-anchor';
      a.textContent = 'probe';
      document.querySelector('main')?.appendChild(a);
    });
    await page.click('#e2e-anchor');
    await page.waitForTimeout(150);

    const op = await page.evaluate(() => {
      const el = document.querySelector('div.fixed.inset-0.z-\\[80\\]');
      return el ? +getComputedStyle(el).opacity : -1;
    });
    expect(op, 'blacking out the screen to scroll a few hundred pixels is wrong').toBe(0);
  });

  test('a project link reaches a real HTML project page', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);

    const link = page.locator('main a[href^="/projects/"]').first();
    const href = await link.getAttribute('href');
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('the residence link resumes the chapter that was left', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);
    await scrollToFraction(page, 0.7);
    const leftAt = new URL(page.url()).hash;
    expect(leftAt).toMatch(/^#station-/);

    await page.goto('/downloads');
    await page.waitForTimeout(1000);

    const resume = page.getByRole('link', { name: /the residence/i }).first();
    await expect(resume, 'the affordance appears once there is something to resume').toBeVisible();
    await expect(resume).toHaveAttribute('href', `/${leftAt}`);

    await resume.click();
    await ready(page);
    await page.waitForTimeout(1500);
    const id = leftAt.slice(1);
    const landed = await page.evaluate((chapter) => {
      const sec = document.getElementById(chapter);
      return sec
        ? { y: window.scrollY, top: sec.offsetTop, bottom: sec.offsetTop + sec.offsetHeight }
        : null;
    }, id);
    expect(landed).not.toBeNull();
    expect(landed!.y).toBeGreaterThanOrEqual(landed!.top - 16);
    expect(landed!.y).toBeLessThanOrEqual(landed!.bottom);
  });

  test('the residence link is absent with nothing to resume', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/downloads');
    await consent(page);
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await page.waitForTimeout(1200);
    await expect(page.getByRole('link', { name: /the residence/i })).toHaveCount(0);
  });
});

test.describe('the interior', () => {
  test('scrolling crosses from the exterior into the hall', async ({ page }) => {
    // Both models are requested, and the interior is armed BEFORE the
    // crossover — the whole point of the pre-load, and the difference between a
    // dissolve and a stall.
    const errors = watchErrors(page);
    const glbs: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('.glb')) glbs.push(new URL(r.url()).pathname);
    });

    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);

    expect(glbs.some((u) => /exterior_mansion/.test(u)), 'the exterior loads first').toBe(true);

    await scrollToFraction(page, 0.35);
    await page.waitForTimeout(2500);
    expect(
      glbs.some((u) => /interior_hall/.test(u)),
      'the interior is armed before the crossover at 0.46',
    ).toBe(true);

    await scrollToFraction(page, 0.62);
    await page.waitForTimeout(1500);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('dragging a table turns the table, not the camera or the page', async ({ page }) => {
    // The interaction the brief is most specific about: ONLY the table base
    // rotates. Nothing here can be checked from the DOM, so the scene is read
    // through three's own devtools event.
    await page.addInitScript(DEVTOOLS_HOOK);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);
    await scrollToFraction(page, 0.62);
    await page.waitForTimeout(2500);

    // Attach to the renderer and learn which camera draws the world.
    await page.evaluate(() => {
      const w = window as unknown as Record<string, any>;
      const gl = w.__PROBE__?.renderers?.[w.__PROBE__.renderers.length - 1];
      if (!gl || gl.__e2ePatched) return;
      const orig = gl.render.bind(gl);
      gl.render = function (scene: any, camera: any) {
        if (scene?.isScene && scene.children?.length > 2) w.__PAIR__ = { scene, camera };
        return orig(scene, camera);
      };
      gl.__e2ePatched = true;
    });
    await page.waitForTimeout(600);

    const before = await page.evaluate(() => {
      const w = window as unknown as Record<string, any>;
      const pair = w.__PAIR__;
      if (!pair) return null;
      let turntable: any = null;
      pair.scene.traverse((o: any) => {
        if (!turntable && /^TURNTABLE_/.test(o.name || '')) turntable = o;
      });
      if (!turntable) return null;
      // Where the table is on screen, so the drag lands on it rather than on
      // empty floor.
      const v = turntable.getWorldPosition(new turntable.position.constructor());
      v.project(pair.camera);
      return {
        rotation: turntable.rotation.y,
        name: turntable.name,
        screen: [
          Math.round(((v.x + 1) / 2) * window.innerWidth),
          Math.round(((-v.y + 1) / 2) * window.innerHeight),
        ],
        camera: [pair.camera.position.x, pair.camera.position.y, pair.camera.position.z],
        scrollY: window.scrollY,
      };
    });

    expect(before, 'a turntable is present in the hall').not.toBeNull();
    const [sx, sy] = before!.screen;
    // Only meaningful if the table is actually on screen at this beat.
    expect(sx).toBeGreaterThan(0);
    expect(sx).toBeLessThan(VIEWPORT.width);

    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (let i = 1; i <= 12; i += 1) await page.mouse.move(sx + i * 14, sy);
    await page.mouse.up();
    await page.waitForTimeout(900);

    const after = await page.evaluate((name: string) => {
      const w = window as unknown as Record<string, any>;
      const pair = w.__PAIR__;
      let turntable: any = null;
      pair.scene.traverse((o: any) => {
        if (!turntable && o.name === name) turntable = o;
      });
      return {
        rotation: turntable ? turntable.rotation.y : null,
        camera: [pair.camera.position.x, pair.camera.position.y, pair.camera.position.z],
        scrollY: window.scrollY,
      };
    }, before!.name);

    expect(
      Math.abs(after.rotation! - before!.rotation),
      'the table turned',
    ).toBeGreaterThan(0.02);

    const camMoved = Math.hypot(
      after.camera[0] - before!.camera[0],
      after.camera[1] - before!.camera[1],
      after.camera[2] - before!.camera[2],
    );
    expect(camMoved, 'the camera did not orbit').toBeLessThan(0.01);
    expect(after.scrollY, 'the page did not scroll under the drag').toBe(before!.scrollY);
  });
});

test.describe('degraded paths', () => {
  test('reduced motion still navigates and still reads', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: VIEWPORT });
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    const documents: string[] = [];
    page.on('request', (r) => {
      if (r.resourceType() === 'document') documents.push(r.url());
    });

    await page.goto('/about');
    await consent(page);
    await ready(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const before = documents.length;
    await page.getByRole('link', { name: /how we work/i }).first().click();
    await expect(page).toHaveURL(/\/why-us$/);
    await page.waitForTimeout(800);

    expect(
      documents.length - before,
      'still a client navigation — a full load would tear down the context and re-parse both models',
    ).toBe(0);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
    await ctx.close();
  });

  test('without WebGL the page still carries everything', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();
    // Deny the context before any script runs, which is what a machine with no
    // usable GPU actually does.
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (/webgl/i.test(type)) return null;
        return orig.apply(this, [type, ...rest] as never);
      } as typeof orig;
    });

    await page.goto('/');
    await consent(page);
    await page.waitForTimeout(4000);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.locator('main a[href^="/projects/"]').count(),
      'the projects are still reachable',
    ).toBeGreaterThan(0);
    // And the loader must not have locked the page shut waiting for a scene
    // that will never arrive.
    expect(
      await page.evaluate(() => document.documentElement.style.overflow),
      'the scroll lock lifts even with no scene to wait for',
    ).not.toBe('hidden');
    await ctx.close();
  });

  test('mobile boots, scrolls, and does not overflow sideways', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    const errors = watchErrors(page);

    await page.goto('/');
    await consent(page);
    await ready(page);

    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.move(195, 400);
    for (let i = 0; i < 8; i += 1) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(1000);
    const after = await page.evaluate(() => window.scrollY);
    expect(after - before, 'the gesture is not trapped').toBeGreaterThan(100);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      'no horizontal overflow',
    ).toBe(true);

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
    await ctx.close();
  });
});

test.describe('the rest of the site', () => {
  test('Tier-2 pages are ordinary documents with working chrome', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize(VIEWPORT);
    for (const route of ['/downloads', '/properties', '/faqs', '/terms']) {
      await page.goto(route);
      await consent(page);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByRole('contentinfo')).toBeVisible();
    }
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('the contact form is still a form', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/contact');
    await consent(page);
    // Typing must work — a global gesture hijack would break exactly this.
    const name = page.locator('form input').first();
    await name.fill('E2E check');
    await expect(name).toHaveValue('E2E check');
  });

  test('keyboard navigation reaches the content', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);

    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? { tag: el.tagName, text: (el.textContent || '').trim().slice(0, 24) } : null;
    });
    // The skip link is deliberately the first stop, so a keyboard user does not
    // tab the whole chrome on every navigation.
    expect(first?.text.toLowerCase()).toContain('skip to content');

    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    expect(
      await page.evaluate(() => document.activeElement?.id),
      'and it moves focus rather than only scrolling',
    ).toBe('site-content');
  });

  test('/hall still stands', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/hall');
    await consent(page);
    await ready(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
