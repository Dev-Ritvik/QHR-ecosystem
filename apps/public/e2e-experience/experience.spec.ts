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
// The app's own chapter table. Imported rather than restated so the address-bar
// walk below and the film cannot drift apart.
import {
  chapters,
  CROSSOVER,
  DOOR_IN,
  DOOR_OUT,
  JOURNEY_END,
} from '../src/components/experience/journey';

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
 * IT HOLDS `overflow: hidden` UNTIL THE SCENE IS READY — BUT IT IS
 * `dynamic(ssr: false)`, SO IT IS NOT THERE YET WHEN THE PAGE FIRST PAINTS.
 *
 * The obvious helper — wait for `overflow !== 'hidden'` — is therefore a
 * no-op: for the first several hundred milliseconds the inline style is `''`
 * because the cover has not mounted, so it resolves immediately having waited
 * for nothing at all. Measured: the lock is applied at 675 ms and released at
 * 2870 ms, and the naive check returned at 359 ms with ZERO meshes in the
 * scene. Every test using it was racing the load.
 *
 * So: wait for the lock to be APPLIED first, then for it to be released. The
 * apply-wait is bounded and failure-tolerant, because a page that never boots a
 * canvas — no WebGL, or a route with nothing 3D on it — never locks at all, and
 * that is not an error.
 */
async function ready(page: Page) {
  const locked = await page
    .waitForFunction(
      () => document.documentElement.style.overflow === 'hidden',
      undefined,
      { timeout: 8_000 },
    )
    .then(
      () => true,
      () => false,
    );
  if (locked) {
    await page.waitForFunction(
      () => document.documentElement.style.overflow !== 'hidden',
      undefined,
      { timeout: 45_000 },
    );
  }
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

/**
 * Scroll to a fraction and wait for the page to actually GET there.
 *
 * A fixed wait is not enough. Lenis interpolates the scroll position at
 * lerp 0.1, so a jump across the full 14,000px track needs ~90 frames to
 * converge — well past the 1200 ms this used to wait. Two assertions failed on
 * that alone: the address bar still read `#portrait` after a scroll to the top,
 * and a scroll to 0.7 had not yet reached a station chapter. Neither was a
 * defect in the application; both were the test reading a page still in
 * motion.
 *
 * So it polls the real scroll position until it stops changing, then allows
 * ChapterUrl's own 180 ms settle on top.
 */
async function scrollToFraction(page: Page, frac: number) {
  await page.evaluate((f) => {
    // THE SAME MEASURE THE APP USES (src/components/experience/filmTrack.ts):
    // on the film, a fraction is a fraction of the TRACK, whose end the page
    // marks with data-film-end; elsewhere it is a fraction of the document. The
    // document measure put every chapter's copy up to a viewport away from its
    // shot, and a test reading it would have been measuring that desync.
    let best = 0;
    let span = 0;
    document.querySelectorAll<HTMLElement>('[data-film-end]').forEach((m) => {
      const fraction = Number(m.dataset.filmEnd);
      const y = m.getBoundingClientRect().top + window.scrollY;
      if (fraction > 0 && fraction >= best && y > 0) {
        best = fraction;
        span = y / fraction;
      }
    });
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.round(f * (span > 1 ? span : max)));
  }, frac);
  // BEST EFFORT, DELIBERATELY. This is a wait, not an assertion: if the page
  // never stops moving, the test that follows should fail on what it actually
  // checks — the address bar, the composition — and not on the helper that was
  // only supposed to give it a stable moment. An earlier version threw here and
  // reported a settle timeout in place of the real result, which told nobody
  // anything about the application.
  await page
    .waitForFunction(
      () => {
        const w = window as unknown as { __lastY?: number; __stillFor?: number };
        const y = window.scrollY;
        if (w.__lastY !== undefined && Math.abs(y - w.__lastY) < 1) {
          w.__stillFor = (w.__stillFor ?? 0) + 1;
        } else {
          w.__stillFor = 0;
        }
        w.__lastY = y;
        return (w.__stillFor ?? 0) >= 5;
      },
      undefined,
      { timeout: 8_000, polling: 100 },
    )
    .catch(() => undefined);
  await page.evaluate(() => {
    const w = window as unknown as { __lastY?: number; __stillFor?: number };
    w.__lastY = undefined;
    w.__stillFor = 0;
  });
  // Longer than ChapterUrl's 180 ms settle, so its write has landed.
  await page.waitForTimeout(700);
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

    // WALKED FROM THE APP'S OWN CHAPTER TABLE, not from hardcoded fractions.
    //
    // The first version named the chapter it expected at 0.32 / 0.70 / 0.87 —
    // the same numbers written in two places — so adding the city chapter
    // renormalised the interior leg and 0.87 stopped being the portrait. The
    // test then failed for a reason that had nothing to do with the address
    // bar, which is the failure mode a duplicated constant always has.
    //
    // Deriving it from the SECTIONS' offsets was tried next and is a different
    // quantity again: the page carries a held frame, a sold-out block and a
    // footer after the film, so a section's midpoint in document coordinates
    // lands past its chapter's scroll range. ChapterUrl decides the hash from
    // the scroll fraction against journey.chapters(), so that is what this
    // reads.
    const stationCount = await page.locator('#city a[href^="/projects/"]').count();
    const beat = chapters(stationCount);
    expect(beat.length, 'the film has chapters to walk').toBeGreaterThan(3);
    for (const chapter of beat) {
      await scrollToFraction(page, (chapter.from + chapter.to) / 2);
      // `hero` is the bare path by design — it is the top of the document.
      expect(new URL(page.url()).hash, `at ${chapter.id}`).toBe(
        chapter.id === 'hero' ? '' : `#${chapter.id}`,
      );
    }

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
      // The scroll track is deliberately pointer-transparent so the canvas
      // behind it stays reachable, so a probe appended into <main> inherits
      // `pointer-events: none` and stops being a stand-in for a real anchor.
      // Park it somewhere unambiguous and give it back its own pointer events.
      a.style.cssText =
        'position:fixed;left:8px;top:400px;z-index:70;pointer-events:auto;' +
        'background:#000;color:#fff;padding:4px 8px';
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

    // Any exterior model: the default was renamed with the v7 estate
    // (exterior_estate_v7.glb), and the rollbacks keep their exterior_mansion names.
    expect(glbs.some((u) => /\/models\/exterior_/.test(u)), 'the exterior loads first').toBe(true);

    await scrollToFraction(page, 0.35);
    await page.waitForTimeout(2500);
    expect(
      glbs.some((u) => /interior_hall/.test(u)),
      `the interior is armed before the crossover at ${CROSSOVER}`,
    ).toBe(true);

    await scrollToFraction(page, 0.62);
    await page.waitForTimeout(1500);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('dragging a table turns the table, not the camera or the page', async ({ page }) => {
    // The interaction the brief is most specific about: ONLY the table base
    // rotates. None of it is visible from the DOM, so the scene is read through
    // three's own devtools event.
    //
    // THREE THINGS THIS GOT WRONG BEFORE, ALL OF THEM MEASURED:
    //
    //  1. It aimed at the TURNTABLE_ node. The drag target is not the turntable
    //     — it is an invisible cylinder proxy at the station anchor, which is
    //     now named `station_drag_<id>` precisely so a test can aim at it.
    //     The turntable's origin sits on the floor and projected 251px BELOW
    //     the viewport.
    //  2. It used the station chapter's own midpoint, where the camera frames
    //     the HOLOGRAM at eye height and the table is mostly out of frame. A
    //     sweep of the interior leg found the tables reachable at 0.55-0.60
    //     (S1), 0.64-0.70 (S2) and 0.74-0.76 (S3); the test now searches for a
    //     proxy that is actually on screen instead of assuming one is.
    //  3. It asserted the camera did not move AT ALL. The rig applies pointer
    //     parallax by design (PARALLAX 0.42 m), so any mouse movement moves the
    //     camera a little. The contract is that the table drag must not ORBIT
    //     the camera, which is a different and much larger number.
    await page.addInitScript(DEVTOOLS_HOOK);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);

    await page.evaluate(() => {
      const w = window as unknown as Record<string, any>;
      const gl = w.__PROBE__?.renderers?.[w.__PROBE__.renderers.length - 1];
      if (!gl || gl.__e2ePatched) return;
      const orig = gl.render.bind(gl);
      gl.render = function (scene: any, camera: any) {
        if (scene?.isScene) {
          let isWorld = false;
          scene.traverse((o: any) => {
            if (!isWorld && /^(station_drag_|mansion_|ashlar_)/.test(o.name || '')) isWorld = true;
          });
          if (isWorld) w.__PAIR__ = { scene, camera };
        }
        return orig(scene, camera);
      };
      gl.__e2ePatched = true;
    });

    /** The projected centre of any drag proxy currently on screen. */
    type Proxy = { name: string; id: string; x: number; y: number };
    const findProxy = (): Promise<Proxy | null> =>
      page.evaluate(() => {
        const w = window as unknown as Record<string, any>;
        const pair = w.__PAIR__;
        if (!pair) return null;
        const V = pair.camera.position.constructor;
        let best: { name: string; id: string; x: number; y: number } | null = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const set = (v: any) => { best = v; };
        pair.scene.traverse((o: any) => {
          if (best || !/^station_drag_/.test(o.name || '')) return;
          const c = o.getWorldPosition(new V());
          const p = c.clone().project(pair.camera);
          const x = Math.round(((p.x + 1) / 2) * window.innerWidth);
          const y = Math.round(((-p.y + 1) / 2) * window.innerHeight);
          if (x > 60 && x < window.innerWidth - 60 && y > 110 && y < window.innerHeight - 60) {
            set({ name: o.name, id: o.name.replace('station_drag_', ''), x, y });
          }
        });
        return best;
      });

    let proxy: Proxy | null = null;
    // The station BEATS in document scroll, recomputed after the city chapter
    // was added: buildInteriorBeats(3) renormalises the interior leg by
    // 0.26 + 3*0.19 + 0.18 + 0.20 = 1.21, so the three stations land at
    // legProgress 0.2149 / 0.3719 / 0.5289 and therefore at these fractions.
    // The old list was written against a 1.01 span; after the change it pointed
    // BETWEEN stations, where every station's emphasis is under the interaction
    // gate and a drag correctly does nothing.
    // MEASURED, not derived. Recomputing these from the chapter weights was
    // tried and was wrong for the reason this test's own comment already gives:
    // at a station's BEAT the camera frames the hologram and the table is
    // mostly out of frame, so the beat is exactly where the proxy is NOT
    // reachable. tools/capture/station_sweep.mjs walks the interior leg in 0.01
    // steps and reports which proxies project inside the frame AND have the
    // canvas under them; after the city chapter renormalised the leg it
    // returned S2 at 0.61 (866,699), S1 at 0.51 and 0.52, and nothing else
    // clickable — 0.74 and 0.75 put S2 on screen but behind the page's own
    // imagery, where a visitor could not click it either.
    //
    // RE-EXPRESSED AS INTERIOR-LEG PROGRESS when the approach to the front door
    // moved the crossover. The camera inside is a function of leg progress
    // alone, so the measured positions are 0.341 (S2) and 0.114 / 0.136 (S1) of
    // the leg; written as document fractions they went stale the moment the
    // exterior grew, which is exactly the duplicated-constant failure the
    // address-bar walk below already records.
    const legToDocument = (leg: number) => DOOR_IN + leg * (JOURNEY_END - DOOR_IN);
    for (const frac of [0.341, 0.114, 0.136].map(legToDocument)) {
      await scrollToFraction(page, frac);
      await page.waitForTimeout(1500);
      proxy = await findProxy();
      if (proxy) break;
    }
    expect(proxy, 'a table is reachable somewhere on the interior leg').not.toBeNull();

    const read = () =>
      page.evaluate((id: string) => {
        const w = window as unknown as Record<string, any>;
        const pair = w.__PAIR__;
        let t: any = null;
        pair.scene.traverse((o: any) => {
          if (o.name === 'TURNTABLE_' + id) t = o;
        });
        return {
          rot: t ? t.rotation.y : null,
          cam: pair.camera.position.toArray() as number[],
          scrollY: window.scrollY,
        };
      }, proxy!.id);

    const before = await read();
    await page.mouse.move(proxy!.x, proxy!.y);
    await page.mouse.down();
    for (let i = 1; i <= 16; i += 1) await page.mouse.move(proxy!.x + i * 11, proxy!.y);
    await page.mouse.up();
    await page.waitForTimeout(1200);
    const after = await read();

    expect(Math.abs(after.rot! - before.rot!), 'the table turned').toBeGreaterThan(0.004);

    const camMoved = Math.hypot(
      after.cam[0] - before.cam[0],
      after.cam[1] - before.cam[1],
      after.cam[2] - before.cam[2],
    );
    // Pointer parallax is designed and bounded at 0.42 m of offset; an orbit
    // would be metres. 0.9 separates the two without pretending the camera is
    // frozen.
    expect(camMoved, 'the camera did not orbit').toBeLessThan(0.9);
    expect(after.scrollY, 'the page did not scroll under the drag').toBe(before.scrollY);
  });
});

test.describe('the front door', () => {
  // BY CLIENT REVIEW: the passage into the hall "must open from the actual
  // door", accelerate, go white, and decelerate inside. None of that is a DOM
  // fact, so — like the turntable case — the camera is read through three's own
  // devtools event, and the passage reports its state and its white coverage on
  // <html data-doorway data-doorway-coverage>, written by the same frame that
  // paints the light.
  test('wheeling through the door plays the passage and lands inside', async ({ page }) => {
    const errors = watchErrors(page);
    await page.addInitScript(DEVTOOLS_HOOK);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);

    await page.evaluate(() => {
      const w = window as unknown as Record<string, any>;
      const gl = w.__PROBE__?.renderers?.[w.__PROBE__.renderers.length - 1];
      if (!gl || gl.__e2eDoorPatched) return;
      const orig = gl.render.bind(gl);
      gl.render = function (scene: any, camera: any) {
        // The world scene is found once and then only its camera is refreshed;
        // the composer's own full-screen scenes are small and never match.
        if (w.__DOOR__?.scene === scene) {
          w.__DOOR__.camera = camera;
        } else if (scene?.isScene) {
          let isWorld = false;
          scene.traverse((o: any) => {
            if (!isWorld && /^(mansion_|ashlar_|door_leaf_)/.test(o.name || '')) isWorld = true;
          });
          if (isWorld) w.__DOOR__ = { scene, camera };
        }
        return orig(scene, camera);
      };
      gl.__e2eDoorPatched = true;
    });

    const stationCount = await page.locator('#city a[href^="/projects/"]').count();
    const approach = chapters(stationCount).find((c) => c.id === 'approach');
    expect(approach, 'the film has an approach chapter').toBeTruthy();

    // Stand at the door. A JUMP, not a crossing — this must not start anything.
    // The approach CHAPTER runs on across the doorway band (journey.ts); the door
    // itself is DOOR_OUT.
    await scrollToFraction(page, DOOR_OUT - 0.003);
    expect(await page.locator('html').getAttribute('data-doorway')).toBe('idle');

    // The hall must be in the scene for the passage to swap into it without a
    // hold; it is armed well before the door, so wait for it rather than guess.
    await page
      .waitForFunction(
        () => {
          const p = (window as unknown as Record<string, any>).__DOOR__;
          return !!p?.scene.getObjectByName('int_wall_front');
        },
        undefined,
        { timeout: 45_000, polling: 250 },
      )
      .catch(() => undefined);
    await page.waitForTimeout(800);

    const pose = () =>
      page.evaluate(() => {
        const p = (window as unknown as Record<string, any>).__DOOR__;
        const el = document.documentElement;
        return {
          cam: p ? (p.camera.position.toArray() as number[]) : null,
          state: el.dataset.doorway ?? null,
          coverage: Number(el.dataset.doorwayCoverage ?? 0),
          y: window.scrollY,
        };
      });

    const atDoor = await pose();
    expect(atDoor.cam, 'the camera was observed').not.toBeNull();
    // Square on the entry axis, out beyond the fountain.
    expect(Math.abs(atDoor.cam![0])).toBeLessThan(0.6);
    expect(atDoor.cam![2]).toBeGreaterThan(18);

    // By hand, across the door.
    await page.mouse.move(720, 450);
    let started = false;
    for (let i = 0; i < 12 && !started; i += 1) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(90);
      started = (await pose()).state === 'enter';
    }
    expect(started, 'a crossing made by hand at the door starts the passage').toBe(true);

    // Sample the passage. Before the swap the page is held at the door, so the
    // scroll position tells the two sides apart.
    const heldY = (await pose()).y;
    let nearestTheDoor = Infinity;
    let peak = 0;
    const scrollYs = new Set<number>();
    for (let i = 0; i < 80; i += 1) {
      const s = await pose();
      if (s.state !== 'enter') break;
      scrollYs.add(s.y);
      if (s.y === heldY && s.cam) nearestTheDoor = Math.min(nearestTheDoor, s.cam[2]);
      peak = Math.max(peak, s.coverage);
      // Try to scroll the page out from under the passage; it must not move.
      if (i % 5 === 0) await page.mouse.wheel(0, 400);
      await page.waitForTimeout(60);
    }

    expect(peak, 'the light fills the frame').toBeGreaterThan(0.99);
    // THE CAMERA HAS TO FLY IN, AND THIS IS WHAT PROVES IT DID.
    //
    // The samples are taken while the page is HELD, and the last one lands just
    // after the swap — so what this reads is either the near end of the exterior
    // rush (DOORWAY.exteriorPass, z 7.5) or the hall side's own start
    // (DOORWAY.hallStart, z 10.6), whichever the loop catches before the state
    // leaves 'enter'. Both are inside the portico. What it must NOT read is the
    // door beat the passage began at, z 33.6, out beyond the fountain — a
    // passage that plays with the camera parked there is the regression this
    // guards, and it would measure 33.
    //
    // 9 -> 14 with the estate rebuilt and the hall extended. The numbers this
    // was written against — a door plane at z 5.06 and a fountain at 13.2 —
    // are the v5 exterior's; v7 puts the door leaves at z 8.17..8.31 and the
    // fountain at 26.05..33.95, and the hall's start moved out from 8.2 to 10.6
    // with a room 2.4 m longer.
    expect(nearestTheDoor, 'the camera flew over the fountain to the door').toBeLessThan(14);
    expect(
      scrollYs.size,
      'the page is held at the door, then landed once — the wheel does not move it',
    ).toBeLessThanOrEqual(2);

    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-doorway') === 'idle',
      undefined,
      { timeout: 20_000 },
    );
    await page.waitForTimeout(900);

    const inside = await pose();
    expect(inside.coverage, 'and the light has gone').toBe(0);
    // In the hall: interior_hall.glb's walls stand at x +/-9.9 and z +/-7.7
    // since it was extended by bays for the client review.
    expect(Math.abs(inside.cam![0])).toBeLessThan(9.9);
    expect(inside.cam![2]).toBeLessThan(7.7);
    expect(inside.cam![2]).toBeGreaterThan(-7.7);
    expect(new URL(page.url()).hash, 'the page landed on the first chapter inside').toBe(
      '#establish',
    );
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
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

test.describe('the district field', () => {
  // The last chapter, and the one Phase 6 recorded as missing entirely. Its
  // contract is not "a city appears" — it is that what appears is DERIVED from
  // published data, reachable without a pointer, and routes to pages that exist.
  //
  // 0.90 is the city beat: journey.ts puts JOURNEY_END there, and
  // buildInteriorBeats(3) renormalises the interior leg by
  // 0.26 + 3*0.19 + 0.18 + 0.20 = 1.21, which lands `city` at legProgress 1.0.
  const CITY = 0.9;

  test('opens with one marker per published project, and no others', async ({ page }) => {
    await page.addInitScript(DEVTOOLS_HOOK);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);
    await scrollToFraction(page, CITY);
    await page.waitForTimeout(1600);

    // The DOM list is the authority, so it decides how many markers there
    // should be. Reading the count from the page rather than hardcoding three
    // keeps this true the day a fourth project publishes.
    const links = await page.locator('#city a[href^="/projects/"]').all();
    expect(links.length, 'the chapter lists every published project').toBeGreaterThan(0);

    const slugs = (await Promise.all(links.map((l) => l.getAttribute('href')))).map((h) =>
      (h ?? '').replace('/projects/', ''),
    );

    const beacons = await page.evaluate(() => {
      const w = window as unknown as Record<string, any>;
      if (!w.__PROBE__) return null;
      const found: string[] = [];
      let ground = false;
      for (const scene of w.__PROBE__.scenes as any[]) {
        scene.traverse((o: any) => {
          if (o.name === 'city_ground') ground = true;
          const m = /^beacon_(.+)$/.exec(o.name || '');
          if (m && !found.includes(m[1])) found.push(m[1]);
        });
      }
      return { ground, found };
    });

    expect(beacons, 'the scene was observed').not.toBeNull();
    expect(beacons!.ground, 'the district ground is in the scene').toBe(true);
    expect(
      beacons!.found.slice().sort(),
      'one marker per published project, and no invented ones',
    ).toEqual(slugs.slice().sort());
  });

  test('every listed project is a real page, not a 404', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);

    const hrefs = (
      await Promise.all(
        (await page.locator('#city a[href^="/projects/"]').all()).map((l) =>
          l.getAttribute('href'),
        ),
      )
    ).filter(Boolean) as string[];
    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect(res.status(), `${href} responds`).toBe(200);
    }
  });

  test('the field states that it is a diagram and not a map', async ({ page }) => {
    // The one claim this chapter must never make. No published project has a
    // centroid, so a visitor must not be able to read these positions as
    // geography — and the page has to say so in words, not only in a comment.
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);
    await expect(page.locator('#city')).toContainText(/diagram of the network, not a map/i);
  });

  test('a keyboard can reach a project without touching the scene', async ({ page }) => {
    // The canvas is aria-hidden, so the beacons are deliberately NOT focusable.
    // The contract is that the list beside them is, and that it goes to the
    // same place.
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);
    await scrollToFraction(page, CITY);

    const first = page.locator('#city a[href^="/projects/"]').first();
    const href = await first.getAttribute('href');
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('selecting a marker dives, veils, and lands on that project', async ({ page }) => {
    const errors = watchErrors(page);
    const documents: string[] = [];
    page.on('request', (r) => {
      if (r.resourceType() === 'document') documents.push(r.url());
    });

    await page.addInitScript(DEVTOOLS_HOOK);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);
    await scrollToFraction(page, CITY);
    await page.waitForTimeout(1800);

    await page.evaluate(() => {
      const w = window as unknown as Record<string, any>;
      const gl = w.__PROBE__?.renderers?.[w.__PROBE__.renderers.length - 1];
      if (!gl || gl.__e2eCityPatched) return;
      const orig = gl.render.bind(gl);
      gl.render = function patched(scene: any, camera: any) {
        if (scene?.isScene) {
          let isWorld = false;
          scene.traverse((o: any) => {
            if (!isWorld && /^(beacon_|city_ground)/.test(o.name || '')) isWorld = true;
          });
          if (isWorld) w.__CITY__ = { scene, camera };
        }
        return orig(scene, camera);
      };
      gl.__e2eCityPatched = true;
    });
    await page.waitForTimeout(400);

    // SETTLE FIRST. The rig damps toward the scroll pose with a 3.1s time
    // constant, so for seconds after a jump the camera is still travelling —
    // and a marker projected through a moving camera has moved by more than its
    // own width by the time a click round-trips. Measured: this test passed
    // alone and failed inside the suite, on nothing but that.
    await page
      .waitForFunction(
        () => {
          const w = window as unknown as Record<string, any>;
          const p = w.__CITY__;
          if (!p) return false;
          const c = p.camera.position;
          const last = w.__camLast as number[] | undefined;
          w.__camLast = [c.x, c.y, c.z];
          if (!last) return false;
          const d = Math.hypot(c.x - last[0], c.y - last[1], c.z - last[2]);
          w.__camStill = d < 0.002 ? (w.__camStill ?? 0) + 1 : 0;
          return (w.__camStill ?? 0) >= 6;
        },
        undefined,
        { timeout: 12_000, polling: 120 },
      )
      .catch(() => undefined);

    // Where a marker actually is on screen, projected through the camera the
    // app is drawing with — the same technique the turntable test uses, and for
    // the same reason: none of this is visible from the DOM.
    const marker = await page.evaluate(() => {
      const w = window as unknown as Record<string, any>;
      const pair = w.__CITY__;
      if (!pair) return null;
      const V = pair.camera.position.constructor;
      let best: { slug: string; x: number; y: number } | null = null;
      pair.scene.traverse((o: any) => {
        if (best) return;
        const m = /^beacon_(.+)$/.exec(o.name || '');
        if (!m) return;
        const c = o.getWorldPosition(new V());
        const p = c.clone().project(pair.camera);
        const x = Math.round(((p.x + 1) / 2) * window.innerWidth);
        const y = Math.round(((-p.y + 1) / 2) * window.innerHeight);
        if (
          p.z < 1 &&
          x > 40 &&
          x < window.innerWidth - 40 &&
          y > 110 &&
          y < window.innerHeight - 40
        ) {
          // AND REACHABLE. The chapter's copy column is a real, interactive
          // block of the page sitting over the left of the canvas, so a marker
          // projected behind it is on screen and not clickable — a click there
          // lands on the list, not the scene. Asking the document what is
          // actually under the point is the only way to know, and it is also
          // what a visitor's pointer would find.
          const hit = document.elementFromPoint(x, y);
          if (hit && hit.tagName === 'CANVAS') best = { slug: m[1], x, y };
        }
      });
      return best as { slug: string; x: number; y: number } | null;
    });

    expect(marker, 'at least one marker is on screen at the city beat').not.toBeNull();

    const before = documents.length;
    const camBefore = await page.evaluate(() => {
      const p = (window as unknown as Record<string, any>).__CITY__;
      return p ? [p.camera.position.x, p.camera.position.y, p.camera.position.z] : null;
    });

    await page.mouse.click(marker!.x, marker!.y);

    // THE DIVE, caught while it runs — SAMPLED, not sampled once. dive.ts hands
    // over to the veil at 300 ms and travels for 620, and a single reading at a
    // fixed offset is a race against the frame the browser happened to draw.
    // The furthest the camera gets from where it started is the number that
    // means something.
    let moved = 0;
    for (let i = 0; i < 9; i += 1) {
      const now = await page.evaluate(() => {
        const p = (window as unknown as Record<string, any>).__CITY__;
        return p ? [p.camera.position.x, p.camera.position.y, p.camera.position.z] : null;
      });
      if (now && camBefore) {
        moved = Math.max(
          moved,
          Math.hypot(now[0] - camBefore[0], now[1] - camBefore[1], now[2] - camBefore[2]),
        );
      }
      await page.waitForTimeout(70);
    }

    // THE DESTINATION IS ASSERTED FIRST, ON PURPOSE. Both of these can fail,
    // and they fail for entirely different reasons — one says the marker was
    // never hit, the other says it was hit and the camera did not move. Putting
    // the navigation first means the error names which.
    await expect(page).toHaveURL(new RegExp(`/projects/${marker!.slug}$`), { timeout: 12_000 });

    // Pointer parallax alone is worth at most ~0.42 m; a dive is metres.
    expect(moved, 'the camera travels toward the marker before the veil closes').toBeGreaterThan(
      1.2,
    );

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(documents.length, 'client-side navigation, not a document load').toBe(before);

    // BACK lands on the film again, and the film still works.
    await page.goBack();
    await expect(page).toHaveURL(/localhost:3001\/($|#|\?)/);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('reduced motion routes from the chapter list with no camera animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(DEVTOOLS_HOOK);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await consent(page);
    await ready(page);
    await scrollToFraction(page, CITY);
    await page.waitForTimeout(1600);

    // The list is the path that must keep working when the scene does not
    // animate — same destination, same client-side push, no dissolve.
    //
    // NOT the marker: this case was titled "from a marker" and never touched
    // one. The marker path under reduced motion — startDive() returning false
    // and select() routing at once — is measured in PHASE6_REPORT.md §6B.34.3
    // (0.237 m of camera displacement against 25.386 m with motion allowed)
    // and is deliberately still not asserted here, because projecting and
    // clicking a beacon needs the settle machinery the dive case carries.
    const first = page.locator('#city a[href^="/projects/"]').first();
    const href = await first.getAttribute('href');
    const documents: string[] = [];
    page.on('request', (r) => {
      if (r.resourceType() === 'document') documents.push(r.url());
    });
    await first.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(documents, 'still a client-side navigation under reduced motion').toEqual([]);
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
