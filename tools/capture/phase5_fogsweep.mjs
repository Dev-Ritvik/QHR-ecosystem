/**
 * Phase 5 / P5B stop condition: is the RESIDUAL seam a fog-colour mismatch?
 *
 *   Playwright MCP:  browser_run_code_unsafe { filename: this file }
 *
 * P5B moved the ground's edge from 146 m (54% fogged) to 260 m (100% fogged)
 * and the measured luminance step across it fell 14% at HERO and WEST. Real,
 * but not a fix. The numbers say why: at WEST the fully-fogged ground reads
 * L 81.6 while the backdrop immediately above it reads L 60.1. The edge is no
 * longer a fog gradient ending early - it is now the FOG COLOUR standing
 * against a backdrop 21 luma darker than itself.
 *
 * DAYLIGHT_HAZE (#5E6147) is a locked grade value, and the mandate is explicit
 * that it may not be changed casually. So this changes nothing: it sweeps
 * candidate fog colours on the LIVE scene, measures the seam under each, and
 * restores the original - producing the evidence a decision needs without a
 * source edit. Whatever it finds is reported, not applied.
 *
 * It also reports what the backdrop actually is at each camera's horizon, which
 * is the number the current haze was supposed to have been sampled from.
 */
async (page) => {
  const BEATS = [
    { name: 'HERO', scroll: 0.0 },
    { name: 'WEST', scroll: 0.187952 },
    { name: 'NW',   scroll: 0.245042 },
  ];
  // The shipped value first, so it is the control rather than a comparison.
  const FOGS = ['#5E6147', '#565A44', '#4E5240', '#464A3C', '#3E4238'];

  const INIT = () => {
    const hits = { renderers: [] };
    const t = new EventTarget();
    t.addEventListener('observe', (e) => { if (e.detail && e.detail.isWebGLRenderer) hits.renderers.push(e.detail); });
    window.__THREE_DEVTOOLS__ = t; window.__PROBE__ = hits;
  };
  const ATTACH = () => {
    const gl = window.__PROBE__.renderers[window.__PROBE__.renderers.length - 1];
    if (!gl.__probePatched) {
      const orig = gl.render.bind(gl);
      gl.__probeOrigRender = orig;
      gl.render = function (s, c) {
        if (s && s.isScene && s.children && s.children.length > 2) window.__PROBE_PAIR__ = { scene: s, camera: c };
        return orig(s, c);
      };
      gl.__probePatched = true;
    }
    return { ok: true };
  };
  const SETTLE = async (frac) => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.round(frac * max));
    const t0 = performance.now();
    let last = null, stable = 0;
    while (performance.now() - t0 < 30000) {
      await new Promise((r) => requestAnimationFrame(r));
      const p = window.__PROBE_PAIR__; if (!p || !p.camera) continue;
      const c = p.camera.position;
      if (last) {
        const d = Math.hypot(c.x - last[0], c.y - last[1], c.z - last[2]);
        stable = d < 0.004 ? stable + 1 : 0; if (stable >= 12) break;
      }
      last = [c.x, c.y, c.z];
    }
    return stable >= 12;
  };

  /** Build the two masks once per beat; they do not depend on the fog colour. */
  const MASKS = async () => {
    const { scene, camera } = window.__PROBE_PAIR__;
    const gl = window.__PROBE__.renderers[window.__PROBE__.renderers.length - 1];
    const render = gl.__probeOrigRender;
    const ground = scene.getObjectByName('ground_plane');
    const sFog = scene.fog, sBg = scene.background, sMat = ground.material;
    const sTone = gl.toneMapping, sCs = gl.outputColorSpace;
    const idm = new sMat.constructor();
    idm.color.setRGB(0, 0, 0); idm.emissive.setRGB(1, 1, 1);
    idm.roughness = 1; idm.metalness = 0; idm.envMapIntensity = 0;
    idm.toneMapped = false; idm.fog = false; idm.vertexColors = false;
    scene.fog = null; scene.background = null;
    gl.toneMapping = 0; gl.outputColorSpace = 'srgb-linear'; gl.setClearColor(0x000000, 1);

    const grab = () => new Promise((res) => requestAnimationFrame(() => {
      render(scene, camera);
      const c = gl.getContext(), w = gl.domElement.width, h = gl.domElement.height;
      const b = new Uint8Array(w * h * 4);
      c.readPixels(0, 0, w, h, c.RGBA, c.UNSIGNED_BYTE, b);
      res({ w, h, b });
    }));

    const vis0 = [];
    scene.traverse((o) => { if (o.isMesh) { vis0.push([o, o.visible]); o.visible = (o === ground); } });
    ground.material = idm;
    const gmask = await grab();
    for (const [o, v] of vis0) o.visible = v;
    ground.material = sMat;

    const mat0 = [];
    scene.traverse((o) => { if (o.isMesh) { mat0.push([o, o.material]); o.material = idm; } });
    const amask = await grab();
    for (const [o, m] of mat0) o.material = m;

    scene.fog = sFog; scene.background = sBg;
    gl.toneMapping = sTone; gl.outputColorSpace = sCs;
    idm.dispose();
    window.__MASKS__ = { g: gmask, a: amask.b };
    return { w: gmask.w, h: gmask.h };
  };

  const MEASURE = async (hex) => {
    const { scene } = window.__PROBE_PAIR__;
    const orig = scene.fog ? scene.fog.color.getHex() : null;
    if (hex && scene.fog) scene.fog.color.set(hex);
    const vis = await new Promise((res) => requestAnimationFrame(() => {
      requestAnimationFrame(() => {          // one extra frame so the change lands
        const cv = document.querySelector('canvas');
        const t = document.createElement('canvas');
        t.width = cv.width; t.height = cv.height;
        t.getContext('2d').drawImage(cv, 0, 0);
        res(t.getContext('2d').getImageData(0, 0, cv.width, cv.height).data);
      });
    }));
    const { g, a } = window.__MASKS__;
    const { w, h, b } = g;
    const isG = (x, y) => b[((h - 1 - y) * w + x) * 4] > 200;
    const isA = (x, y) => a[((h - 1 - y) * w + x) * 4] > 200;
    const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    let n = 0, sum = 0, sIn = 0, sOut = 0, mx = 0;
    for (let x = 0; x < w; x += 4) {
      let top = -1;
      for (let y = 0; y < h; y++) if (isG(x, y)) { top = y; break; }
      if (top < 12 || top > h - 2) continue;
      let I = [0, 0, 0], O = [0, 0, 0], ni = 0, no = 0;
      for (let k = 2; k < 12; k++) {
        if (top + k < h && isG(x, top + k)) { const i = ((top + k) * w + x) * 4; I[0] += vis[i]; I[1] += vis[i + 1]; I[2] += vis[i + 2]; ni++; }
        if (top - k >= 0 && !isA(x, top - k)) { const i = ((top - k) * w + x) * 4; O[0] += vis[i]; O[1] += vis[i + 1]; O[2] += vis[i + 2]; no++; }
      }
      if (!ni || no < 8) continue;
      const li = lum(I.map((v) => v / ni)), lo = lum(O.map((v) => v / no));
      const st = Math.abs(li - lo);
      n++; sum += st; sIn += li; sOut += lo; if (st > mx) mx = st;
    }
    if (orig !== null && scene.fog) scene.fog.color.setHex(orig);
    return { fog: hex || 'shipped', columns: n,
             meanStepL: +(sum / n).toFixed(2), maxStepL: +mx.toFixed(2),
             insideL: +(sIn / n).toFixed(2), backdropL: +(sOut / n).toFixed(2) };
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addInitScript(INIT);
  await page.goto('http://localhost:3001/?model=p5b', { waitUntil: 'load' });
  await page.waitForTimeout(10000);
  await page.evaluate(ATTACH);

  const out = {};
  for (const bt of BEATS) {
    out[bt.name] = { settled: await page.evaluate(SETTLE, bt.scroll), size: await page.evaluate(MASKS), rows: [] };
    for (const f of FOGS) out[bt.name].rows.push(await page.evaluate(MEASURE, f));
  }
  // Prove the sweep left nothing behind.
  out.fogAfter = await page.evaluate(() => {
    const s = window.__PROBE_PAIR__.scene;
    return s.fog ? { color: '#' + s.fog.color.getHexString(), near: s.fog.near, far: s.fog.far } : null;
  });
  return out;
}
