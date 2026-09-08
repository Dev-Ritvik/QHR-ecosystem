/**
 * PHASE 6B — composition probe.
 *
 *   node tools/capture/frame_probe.mjs --out out6b_before --shots hero,constellation
 *
 * A STANDALONE Playwright script rather than a file for the MCP runner. The
 * runner evaluates a bare arrow function in a vm with no module loader, no fs
 * and — the reason three runs died during Phase 6 — no global URL. Everything
 * here needs fs (it writes PNGs and a JSON report next to them) and node's own
 * argv, so it drives playwright directly.
 *
 * WHAT IT MEASURES, AND WHY EACH NUMBER EXISTS
 *
 *   pose        camera position, look direction, fov. A composition claim that
 *               does not name the pose it was made at cannot be reproduced.
 *   reveal      the constellation's own uReveal uniform. The chapter fades the
 *               object in over scroll, so "the constellation looks faint" is
 *               ambiguous until you know whether it was photographed at 0.2 or
 *               at 1.0.
 *   onScreen    projected screen box of named objects. This is how "the mansion
 *               leaves the frame" stops being an impression and becomes a
 *               number: coverage 0 means not one pixel of it is in shot.
 *   .keybg      the same held frame with scene.background swapped for magenta,
 *               so a reader can count exactly which pixels are sky rather than
 *               geometry. That is the "photographic background dominates"
 *               claim, quantified.
 *   .nocon      the same held frame with the constellation hidden. Additive
 *               points over a bright sky can be at full reveal and still put
 *               almost nothing on screen; only a differenced pair separates
 *               "faint because it is fading in" from "invisible because it is
 *               additive against daylight".
 *
 * DETERMINISM
 *
 * Same discipline as tools/capture/phase6_audit.mjs, for the same reason: the
 * embers, the constellation spin and the hologram emissives are driven by
 * elapsed time, so two runs that settle at different wall-clock offsets
 * photograph different animation phases. Every shot holds to a deadline
 * measured from navigation, and every capture REPORTS the phase it was taken at
 * (uTime) plus any deadline it overran (lateBy). A pair of runs whose phases
 * disagree is not a valid comparison and must be discarded, not explained.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// playwright is a dependency of apps/public, not of the repo root, and pnpm
// does not hoist it. ESM resolves bare specifiers relative to THIS file, which
// lives in tools/, so the import has to be anchored at the workspace that owns
// the dependency rather than at the script.
const appRequire = createRequire(
  pathToFileURL(path.join(process.cwd(), 'apps/public/package.json')).href,
);
const { chromium } = appRequire('playwright');

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
}
const OUT = path.join('C:/dev/estate/tools/capture', args.get('out') || 'out6b');
const BASE = args.get('base') || 'http://localhost:3001';
const QUERY = args.get('query') || '';
const WANT = (args.get('shots') || 'hero,revolution,turn,constellation,late').split(',');
const VIEW = (args.get('viewport') || '1440x900').split('x').map(Number);
// --dom keep photographs the page as a visitor sees it, copy and all. The
// default strips the DOM so a pixel statistic is a statement about the FRAME;
// legibility of the type over it is a different question and needs the type.
const KEEP_DOM = args.get('dom') === 'keep';

fs.mkdirSync(OUT, { recursive: true });

/**
 * Chapter fractions in DOCUMENT scroll. journey.ts: CROSSOVER 0.46,
 * JOURNEY_END 0.90, exterior thirds hero / revolution / constellation at
 * 0..0.138 / 0.138..0.285 / 0.285..0.46. The constellation is sampled four
 * times across its own chapter rather than once, because the defect under
 * investigation is that the object may only be at strength for a sliver of it.
 */
const SHOTS = {
  hero: 0.0,
  revolution: 0.1,
  turn: 0.285,
  'con-early': 0.32,
  constellation: 0.3725,
  'con-late': 0.41,
  late: 0.42,
  veil: 0.46,
  establish: 0.52,
  'station-1': 0.62,
  'station-2': 0.7,
  'station-3': 0.78,
  portrait: 0.87,
};

/**
 * THE PHASE PIN, and why it is measured in the scene's own clock rather than in
 * wall time.
 *
 * phase6_audit.mjs pins on a deadline measured from navigation. That is only a
 * PROXY for the animation clock, and this probe's first run showed how weak a
 * proxy: settling from the hero to the turn takes ~33 s of scene time on this
 * machine, so every deadline was missed — `lateBy` 27 s, 59 s, 66 s, 73 s, 79 s,
 * 84 s. A pin that is never met is worse than no pin, because the report still
 * carries a column that looks like one.
 *
 * So the pin is the constellation's own uTime, which is the value the shaders
 * actually animate against. After settling, the probe holds until that clock
 * reaches the shot's target. Two runs then photograph the same phase whatever
 * the machine was doing, and `lateBy` — now in seconds of scene clock — is zero
 * when the pin held.
 *
 * The numbers are budgeted from that measured run plus half again: the first
 * shot arrived at 41.7, and later settles cost 10.9 / 9.9 / 9.6 / 8.8.
 */
const FIRST_UT = 60;
const SLOT_UT = 18;

const INIT = () => {
  const hits = { scenes: [], renderers: [] };
  const tgt = new EventTarget();
  tgt.addEventListener('observe', (e) => {
    const o = e.detail;
    if (!o) return;
    if (o.isScene) hits.scenes.push(o);
    else if (o.isWebGLRenderer) hits.renderers.push(o);
  });
  window.__THREE_DEVTOOLS__ = tgt;
  window.__PROBE__ = hits;
};

const ATTACH = () => {
  const h = window.__PROBE__;
  if (!h || !h.renderers.length) return { ok: false, why: 'no renderer observed' };
  const gl = h.renderers[h.renderers.length - 1];
  if (!gl.__probePatched) {
    const orig = gl.render.bind(gl);
    gl.render = function patched(scene, camera) {
      const main = scene && scene.isScene && scene.children && scene.children.length > 2;
      if (main) window.__PROBE_PAIR__ = { scene, camera };
      const r = orig(scene, camera);
      if (main) {
        const i = gl.info.render;
        window.__PROBE_DRAW__ = { calls: i.calls, triangles: i.triangles, frame: i.frame };
      }
      return r;
    };
    gl.__probePatched = true;
  }
  return { ok: true, renderers: h.renderers.length, scenes: h.scenes.length };
};

/**
 * three is not on window, and importing a second copy would be a different
 * class identity. Steal the constructors off live objects instead.
 */
const GRAB_THREE = () => {
  const { scene } = window.__PROBE_PAIR__;
  const Vector3 = scene.position.constructor;
  let Box3 = null;
  let Color = null;
  scene.traverse((o) => {
    if (!Box3 && o.isMesh && o.geometry) {
      o.geometry.computeBoundingBox();
      if (o.geometry.boundingBox) Box3 = o.geometry.boundingBox.constructor;
    }
    const m = o.material;
    if (!Color && m && m.color && m.color.isColor) Color = m.color.constructor;
  });
  if (!Color && scene.background && scene.background.isColor) {
    Color = scene.background.constructor;
  }
  window.__PROBE_THREE__ = { Vector3, Box3, Color };
  return { Vector3: !!Vector3, Box3: !!Box3, Color: !!Color };
};

const SETTLE = async (frac) => {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  window.scrollTo(0, Math.round(frac * max));
  const t0 = performance.now();
  let last = null;
  let stable = 0;
  let frames = 0;
  let why = 'timeout';
  while (performance.now() - t0 < 25000) {
    await new Promise((r) => requestAnimationFrame(r));
    frames += 1;
    const p = window.__PROBE_PAIR__;
    if (!p || !p.camera) continue;
    const c = p.camera.position;
    if (last) {
      const d = Math.hypot(c.x - last[0], c.y - last[1], c.z - last[2]);
      stable = d < 0.0005 ? stable + 1 : 0;
    }
    last = [c.x, c.y, c.z];
    if (stable >= 45) {
      why = 'asymptote';
      break;
    }
  }
  return {
    frames,
    settled: why !== 'timeout',
    why,
    scrollY: Math.round(window.scrollY),
    frac: +(window.scrollY / max).toFixed(4),
  };
};

/**
 * Hold until the constellation's uTime reaches `target`, then let one more
 * frame draw so the renderer has actually painted at that phase. Returns the
 * clock it stopped at, so an overrun is a number in the report rather than an
 * assumption.
 */
const HOLD_UNTIL = async (target) => {
  const read = () => {
    const { scene } = window.__PROBE_PAIR__;
    const o = scene.getObjectByName('CONSTELLATION');
    const m = o && o.material;
    return m && m.uniforms && m.uniforms.uTime ? m.uniforms.uTime.value : null;
  };
  const t0 = performance.now();
  let uTime = read();
  if (uTime === null) return { uTime: -1, why: 'no clock' };
  while (uTime < target && performance.now() - t0 < 90000) {
    await new Promise((r) => requestAnimationFrame(r));
    uTime = read();
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return { uTime: +read().toFixed(3), why: uTime >= target ? 'pinned' : 'timeout' };
};

/**
 * Screen-space box of a named object, in CSS pixels, plus the share of the
 * viewport it covers. Projects the eight corners of the world bounding box —
 * cheap, and correct enough to answer "is it in frame at all".
 */
const REPORT = (names) => {
  const { scene, camera } = window.__PROBE_PAIR__;
  const T = window.__PROBE_THREE__;
  const W = window.innerWidth;
  const H = window.innerHeight;

  const onScreen = {};
  for (const n of names) {
    const obj = scene.getObjectByName(n);
    if (!obj || !T.Box3) {
      onScreen[n] = null;
      continue;
    }
    const box = new T.Box3().setFromObject(obj);
    if (box.isEmpty()) {
      onScreen[n] = null;
      continue;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let anyFront = false;
    const v = new T.Vector3();
    for (let i = 0; i < 8; i += 1) {
      v.set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      );
      v.project(camera);
      if (v.z < 1) anyFront = true;
      const x = (v.x * 0.5 + 0.5) * W;
      const y = (-v.y * 0.5 + 0.5) * H;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const cx = Math.max(0, Math.min(W, maxX) - Math.max(0, minX));
    const cy = Math.max(0, Math.min(H, maxY) - Math.max(0, minY));
    onScreen[n] = {
      inFront: anyFront,
      box: [minX, minY, maxX, maxY].map((k) => Math.round(k)),
      coverage: anyFront ? +((cx * cy) / (W * H)).toFixed(4) : 0,
    };
  }

  let reveal = null;
  let uTime = null;
  let uTimeAny = null;
  let uTimeAnyFrom = null;
  let turn = null;
  scene.traverse((o) => {
    const m = o.material;
    if (m && m.uniforms) {
      if (o.name === 'CONSTELLATION') {
        if (m.uniforms.uReveal) reveal = +m.uniforms.uReveal.value.toFixed(4);
        if (m.uniforms.uTime) uTime = +m.uniforms.uTime.value.toFixed(3);
      }
      if (m.uniforms.uTime && uTimeAny === null) {
        uTimeAny = +m.uniforms.uTime.value.toFixed(3);
        uTimeAnyFrom = o.name || o.type;
      }
    }
    if (turn === null && /^TURNTABLE_/.test(o.name || '')) turn = +o.rotation.y.toFixed(4);
  });

  const c = camera;
  const dir = new T.Vector3();
  c.getWorldDirection(dir);
  const d = window.__PROBE_DRAW__ || {};
  return {
    position: [c.position.x, c.position.y, c.position.z].map((k) => +k.toFixed(3)),
    dir: [dir.x, dir.y, dir.z].map((k) => +k.toFixed(3)),
    fov: +c.fov.toFixed(2),
    reveal,
    phase: { uTime, uTimeAny, uTimeAnyFrom, turn },
    draw: { calls: d.calls, triangles: d.triangles },
    fog: scene.fog
      ? {
          near: +scene.fog.near.toFixed(1),
          far: +scene.fog.far.toFixed(1),
          color: '#' + scene.fog.color.getHexString(),
        }
      : null,
    onScreen,
  };
};

/**
 * Hide the DOM so a capture photographs the FRAME rather than the page. The
 * copy is judged separately; mixing the two makes every pixel statistic partly
 * a statement about typography.
 */
const CHROME = (hidden) => {
  // [data-cursor-ring] is not inside any of the landmarks — it is a fixed
  // element parked on <body> — so an earlier version of this pass left a gold
  // circle sitting over the scene in every composition capture.
  for (const s of ['header', 'main', 'footer', '[data-cursor-ring]']) {
    for (const el of document.querySelectorAll(s)) {
      el.style.visibility = hidden ? 'hidden' : '';
    }
  }
};

const SET_VISIBLE = (arg) => {
  const { scene } = window.__PROBE_PAIR__;
  const o = scene.getObjectByName(arg.name);
  if (!o) return false;
  if (arg.visible === false) o.__probeWas = o.visible;
  o.visible = arg.visible === false ? false : o.__probeWas !== false;
  return true;
};

/** Swap scene.background for a flat key colour so a later pass can count
 *  exactly which pixels are sky. Restored immediately after. */
const KEY_BG = (on) => {
  const { scene } = window.__PROBE_PAIR__;
  const T = window.__PROBE_THREE__;
  if (on) {
    scene.__probeBg = scene.background;
    scene.background = new T.Color(0xff00ff);
  } else if (scene.__probeBg !== undefined) {
    scene.background = scene.__probeBg;
    delete scene.__probeBg;
  }
  return true;
};

const main = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: VIEW[0], height: VIEW[1] } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 240));
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 240)));

  await page.addInitScript(INIT);
  const t0 = Date.now();
  await page.goto(BASE + '/' + QUERY, { waitUntil: 'domcontentloaded' });

  let consent = 'not shown';
  try {
    const b = page.getByRole('button', { name: /essential only/i });
    await b.waitFor({ state: 'visible', timeout: 6000 });
    await b.click();
    consent = 'dismissed';
  } catch {
    /* cookie already present */
  }

  // The cover LOCKS scroll, and `overflow !== 'hidden'` is already true before
  // the dynamic(ssr:false) Preloader has mounted — a naive wait returns at
  // ~350ms with an empty scene. Wait for the lock to be applied, then released.
  const locked = await page
    .waitForFunction(() => document.documentElement.style.overflow === 'hidden', undefined, {
      timeout: 9000,
    })
    .then(() => true, () => false);
  if (locked) {
    await page.waitForFunction(
      () => document.documentElement.style.overflow !== 'hidden',
      undefined,
      { timeout: 60000 },
    );
  }
  const coverLiftedMs = Date.now() - t0;

  const attached = await page.evaluate(ATTACH);
  await page.waitForTimeout(700);
  const three = await page.evaluate(GRAB_THREE);

  const NAMES = ['CONSTELLATION', 'mansion_walls', 'ground_plane'];
  const report = {
    base: BASE,
    query: QUERY,
    viewport: VIEW,
    consent,
    coverLiftedMs,
    attached,
    three,
    shots: [],
    errors: [],
  };

  let slot = 0;
  for (const name of WANT) {
    const frac = SHOTS[name];
    if (frac === undefined) {
      report.shots.push({ name, skipped: 'unknown shot' });
      continue;
    }
    const settle = await page.evaluate(SETTLE, frac);

    // Phase pin, in the scene's own clock. See FIRST_UT.
    const target = FIRST_UT + slot * SLOT_UT;
    slot += 1;
    const pin = await page.evaluate(HOLD_UNTIL, target);

    const info = await page.evaluate(REPORT, NAMES);
    const lateBy = +(pin.uTime - target).toFixed(3);

    if (!KEEP_DOM) await page.evaluate(CHROME, true);
    await page.waitForTimeout(140);
    const file = (suffix) => path.join(OUT, `${name}${suffix}.png`);
    await page.screenshot({ path: file('') });

    let pair = null;
    if (!KEEP_DOM && info.onScreen.CONSTELLATION) {
      await page.evaluate(KEY_BG, true);
      await page.waitForTimeout(140);
      await page.screenshot({ path: file('.keybg') });
      await page.evaluate(KEY_BG, false);
      await page.evaluate(SET_VISIBLE, { name: 'CONSTELLATION', visible: false });
      await page.waitForTimeout(140);
      await page.screenshot({ path: file('.nocon') });
      await page.evaluate(SET_VISIBLE, { name: 'CONSTELLATION', visible: true });
      pair = { keybg: `${name}.keybg.png`, nocon: `${name}.nocon.png` };
    }
    if (!KEEP_DOM) await page.evaluate(CHROME, false);
    await page.waitForTimeout(100);

    report.shots.push({ name, frac, settle, pin: { target, ...pin }, lateBy, pair, ...info });
    process.stdout.write(
      `${name}: frac ${settle.frac} reveal ${info.reveal} uTime ${info.phase.uTime}`
        + ` pin ${pin.why} lateBy ${lateBy}\n`,
    );
  }

  report.errors = errors;
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log('\nwrote ' + path.join(OUT, 'report.json'));
  console.log('errors: ' + errors.length);
  if (errors.length) console.log(errors.slice(0, 6).join('\n'));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
