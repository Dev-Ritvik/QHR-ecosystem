/**
 * P5H stop-condition: does the dusk arrival need a light of its own?
 *
 *   Playwright MCP:  browser_run_code_unsafe { filename: this file }
 *
 * WHY A LIVE SWEEP AND NOT AN AUTHORED CANDIDATE. The mandate allows P5H to add
 * localised dusk lighting "if, and only if, the measurements justify it", and
 * warns that a light that steals focus from the entrance is not finished. A
 * lighting change cannot be carried in a candidate GLB - it lives in
 * WorldCanvas and would therefore apply to v5 and p4e too - so authoring it to
 * find out what it does would mean editing a shared, locked system on a
 * hypothesis. phase5_fogsweep.mjs already established the alternative: sweep
 * the value on the LIVE scene, measure, and restore. That is what this does.
 *
 * WHAT IS SWEPT. Two warm point lights at the foot of the entry steps, at
 * (+/-3.9, 1.0, 7.4) - the position tools/gltf/p5h_visibility.py measured as
 * the only in-frame lamp station of the three tested (the forecourt kerb at
 * z 16 falls 96 px BELOW the HERO frame and 561 below WEST). Three intensities
 * are swept so the answer is a curve rather than one guess.
 *
 * WHAT IS RESTORED, AND CHECKED. Every light added is removed and the scene's
 * light count is re-asserted against the value read before the sweep. The run
 * reports `restored` explicitly; a false there invalidates the run.
 */
async (page) => {
  const OUT = 'C:/dev/estate/tools/capture/out/';

  const CLASSES = [
    ['terrain',  '^ground_plane$',                                  [1.00, 0.00, 0.00]],
    ['drive',    '^drive_',                                         [0.60, 0.30, 0.00]],
    ['hedge',    '^hedge_',                                         [0.00, 1.00, 0.00]],
    ['cypress',  '^cyp_',                                           [0.00, 0.00, 1.00]],
    ['water',    '^(fount_water|fountain_jet|fountain_water)$',    [1.00, 0.75, 0.85]],
    ['fountain', '^fount',                                          [1.00, 1.00, 0.00]],
    ['terrace',  '^terrace_',                                       [1.00, 0.00, 1.00]],
    ['steps',    '^entry_',                                         [0.00, 1.00, 1.00]],
    ['urn',      '^urn_',                                           [0.30, 0.60, 1.00]],
    ['roof',     '^(mansion_roof|roof_peak|spire_|finial_|cupola_)', [1.00, 0.50, 0.00]],
    ['masonry',  '^(ashlar_|rustic_)',                              [0.50, 0.00, 1.00]],
    ['mansion',  '^(mansion_|portico_|arch|door|lion_)',            [0.00, 0.55, 0.30]],
  ];

  const INIT = () => {
    const hits = { scenes: [], renderers: [] };
    const tgt = new EventTarget();
    tgt.addEventListener('observe', (e) => {
      const o = e.detail; if (!o) return;
      if (o.isScene) hits.scenes.push(o);
      else if (o.isWebGLRenderer) hits.renderers.push(o);
    });
    window.__THREE_DEVTOOLS__ = tgt;
    window.__PROBE__ = hits;
  };

  const ATTACH = () => {
    const h = window.__PROBE__;
    if (!h || !h.renderers.length) return { ok: false };
    const gl = h.renderers[h.renderers.length - 1];
    if (!gl.__probePatched) {
      const orig = gl.render.bind(gl);
      gl.__probeOrigRender = orig;
      gl.render = function (scene, camera) {
        const main = scene && scene.isScene && scene.children && scene.children.length > 2;
        if (main) window.__PROBE_PAIR__ = { scene, camera };
        return orig(scene, camera);
      };
      gl.__probePatched = true;
    }
    return { ok: true };
  };

  const SETTLE = async (arg) => {
    const { frac, beat } = arg;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.round(frac * max));
    const t0 = performance.now();
    let err = Infinity, last = null, stable = 0;
    while (performance.now() - t0 < 40000) {
      await new Promise((r) => requestAnimationFrame(r));
      const p = window.__PROBE_PAIR__; if (!p || !p.camera) continue;
      const c = p.camera.position;
      err = Math.hypot(c.x - beat[0], c.y - beat[1], c.z - beat[2]);
      if (last) { const d = Math.hypot(c.x - last[0], c.y - last[1], c.z - last[2]);
                  stable = d < 0.0005 ? stable + 1 : 0; }
      last = [c.x, c.y, c.z];
      if (err < 0.008 || stable >= 60) break;
    }
    return { poseErrM: +err.toFixed(4) };
  };

  // Add / remove the swept lights. A PointLight is cloned from one the scene
  // already has, so no constructor has to be imported into the page.
  const LIGHTS = (spec) => {
    const { scene } = window.__PROBE_PAIR__;
    if (window.__SWEEP__) { for (const l of window.__SWEEP__) l.parent && l.parent.remove(l); window.__SWEEP__ = null; }
    if (!spec) {
      let n = 0; scene.traverse((o) => { if (o.isLight) n++; });
      return { added: 0, lights: n };
    }
    let proto = null;
    scene.traverse((o) => { if (!proto && o.isPointLight) proto = o; });
    if (!proto) return { error: 'no PointLight to clone' };
    const made = [];
    for (const x of [-spec.x, spec.x]) {
      const l = proto.clone();
      l.position.set(x, spec.y, spec.z);
      l.intensity = spec.intensity; l.distance = spec.distance; l.decay = 2;
      l.color.setStyle(spec.color); l.castShadow = false; l.name = 'SWEEP_stepLamp';
      scene.add(l); made.push(l);
    }
    window.__SWEEP__ = made;
    let n = 0; scene.traverse((o) => { if (o.isLight) n++; });
    return { added: made.length, lights: n };
  };

  const COVERAGE = async (spec) => {
    const { scene, camera } = window.__PROBE_PAIR__;
    const gl = window.__PROBE__.renderers[window.__PROBE__.renderers.length - 1];
    const render = gl.__probeOrigRender;
    const rules = spec.map(([n, re, rgb]) => [n, new RegExp(re), rgb]);
    const idOf = (n) => { for (const r of rules) if (r[1].test(n)) return [r[0], r[2]]; return ['other', [0.5, 0.5, 0.5]]; };
    const isDark = (d) => {
      let dark = 0, n = 0;
      const step = Math.max(4, Math.floor(d.length / 4 / 4000)) * 4;
      for (let i = 0; i < d.length; i += step) { n++; if (d[i] + d[i + 1] + d[i + 2] < 12) dark++; }
      return dark / n >= 0.92;
    };
    const grabGL = () => {
      const ctx = gl.getContext();
      const w = gl.domElement.width, hh = gl.domElement.height;
      const raw = new Uint8Array(w * hh * 4);
      ctx.readPixels(0, 0, w, hh, ctx.RGBA, ctx.UNSIGNED_BYTE, raw);
      const flip = new Uint8Array(w * hh * 4); const row = w * 4;
      for (let y = 0; y < hh; y++) flip.set(raw.subarray((hh - 1 - y) * row, (hh - y) * row), y * row);
      return flip;
    };
    let vis = null;
    for (let a = 0; a < 30; a++) {
      await new Promise((r) => requestAnimationFrame(r));
      const g = grabGL(); if (!isDark(g)) { vis = g; break; }
    }

    const saved = [], idMats = new Map();
    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const [cls, rgb] = idOf(o.name || '');
      let m = idMats.get(cls);
      if (!m) {
        const src = Array.isArray(o.material) ? o.material[0] : o.material;
        m = new src.constructor();
        m.color.setRGB(0, 0, 0); m.emissive.setRGB(rgb[0], rgb[1], rgb[2]);
        m.emissiveIntensity = 1; m.roughness = 1; m.metalness = 0; m.envMapIntensity = 0;
        m.toneMapped = false; m.fog = false; m.transparent = false; m.opacity = 1;
        m.vertexColors = false; idMats.set(cls, m);
      }
      saved.push([o, o.material]); o.material = m;
    });
    const sFog = scene.fog, sBg = scene.background;
    const sTone = gl.toneMapping, sExp = gl.toneMappingExposure, sCs = gl.outputColorSpace;
    scene.fog = null; scene.background = null;
    gl.toneMapping = 0; gl.toneMappingExposure = 1; gl.outputColorSpace = 'srgb-linear';
    gl.setClearColor(0x000000, 1);
    const px = await new Promise((resolve) => {
      requestAnimationFrame(() => {
        render(scene, camera);
        const ctx = gl.getContext();
        const w = gl.domElement.width, hh = gl.domElement.height;
        const buf = new Uint8Array(w * hh * 4);
        ctx.readPixels(0, 0, w, hh, ctx.RGBA, ctx.UNSIGNED_BYTE, buf);
        resolve({ w, h: hh, buf });
      });
    });
    for (const [o, m] of saved) o.material = m;
    scene.fog = sFog; scene.background = sBg;
    gl.toneMapping = sTone; gl.toneMappingExposure = sExp; gl.outputColorSpace = sCs;
    for (const m of idMats.values()) m.dispose();

    const table = rules.map((r) => [r[0], r[2]]); table.push(['other', [0.5, 0.5, 0.5]]);
    const stat = {}; const { w, h: hh, buf } = px;
    let clipped = 0, lit = 0;
    for (let i = 0; i < w * hh; i++) {
      const r = buf[i * 4], g2 = buf[i * 4 + 1], b = buf[i * 4 + 2];
      if (r < 6 && g2 < 6 && b < 6) continue;
      let best = null, bd = 1e9;
      for (const [n, rgb] of table) {
        const d = Math.abs(r - rgb[0] * 255) + Math.abs(g2 - rgb[1] * 255) + Math.abs(b - rgb[2] * 255);
        if (d < bd) { bd = d; best = n; }
      }
      if (bd > 24 || !vis) continue;
      const rowFromTop = hh - 1 - Math.floor(i / w);
      const vi = (rowFromTop * w + (i % w)) * 4;
      const R = vis[vi], G = vis[vi + 1], B = vis[vi + 2];
      const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      // Blown highlights are the failure mode a lamp introduces, so they are
      // counted rather than hidden inside a mean.
      if (R > 250 && G > 250 && B > 250) clipped++;
      lit++;
      const st = stat[best] || (stat[best] = { n: 0, l: 0, l2: 0, clip: 0 });
      st.n++; st.l += L; st.l2 += L * L;
      if (R > 250 && G > 250 && B > 250) st.clip++;
    }
    const shade = {};
    for (const [k, v] of Object.entries(stat)) {
      const mL = v.l / v.n;
      shade[k] = { L: +mL.toFixed(2), sd: +Math.sqrt(Math.max(v.l2 / v.n - mL * mL, 0)).toFixed(2),
                   clipPct: +(100 * v.clip / v.n).toFixed(3) };
    }
    return { shade, shadeUnavailable: !vis, clippedPx: clipped, litPx: lit };
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addInitScript(INIT);
  await page.goto('http://localhost:3001/?model=p5h&grade=dusk', { waitUntil: 'load' });
  await page.waitForTimeout(10000);
  await page.evaluate(ATTACH);
  const pose = await page.evaluate(SETTLE, { frac: 0.0, beat: [-20.0, 15.5, 27.0] });

  const out = { pose, steps: [] };
  const BEFORE = await page.evaluate(LIGHTS, null);
  out.lightsBefore = BEFORE.lights;
  out.steps.push({ label: 'baseline', lights: BEFORE.lights,
                   ...(await page.evaluate(COVERAGE, CLASSES)) });
  await page.locator('canvas').screenshot({ path: OUT + '_p5h_lamp_off.png' });

  for (const intensity of [2.0, 4.4, 8.0]) {
    const st = await page.evaluate(LIGHTS,
      { x: 3.9, y: 1.0, z: 7.4, intensity, distance: 12, color: '#FFC98A' });
    await page.waitForTimeout(1200);
    out.steps.push({ label: 'stepLamp i=' + intensity, lights: st.lights,
                     ...(await page.evaluate(COVERAGE, CLASSES)) });
    if (intensity === 4.4) await page.locator('canvas').screenshot({ path: OUT + '_p5h_lamp_on.png' });
  }

  const AFTER = await page.evaluate(LIGHTS, null);
  await page.waitForTimeout(1200);
  out.lightsAfter = AFTER.lights;
  out.restored = AFTER.lights === BEFORE.lights;
  out.restoreCheck = await page.evaluate(COVERAGE, CLASSES);
  return out;
}
