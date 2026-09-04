/**
 * Phase 5 / P5B acceptance: how visible is the ground's far edge, in numbers.
 *
 *   Playwright MCP:  browser_run_code_unsafe { filename: this file }
 *   Model via the MODEL global; defaults to p5b.
 *
 * WHY THE EDGE'S POSITION IS THE WRONG MEASUREMENT. The first instinct is to
 * check that extending the ground pushed its silhouette further up the frame.
 * It does not, and it cannot: ground at infinity projects to the horizon line,
 * so ground at 146 m and ground at 260 m both land within a few pixels of it.
 * Measured, extending the plane from 120 m to 260 m moved the WEST silhouette's
 * top row from 359 to 357. Two pixels. If that were the criterion, P5B would
 * read as a failure.
 *
 * WHAT ACTUALLY MATTERS is whether there is a VISIBLE STEP there - a value or
 * hue discontinuity between the last of the ground and the first of the
 * backdrop. That is what the eye reads as "a plane ending", and it is what fog
 * is supposed to remove. So this walks each column of the ground's own
 * silhouette, samples the visible frame in a band just INSIDE the edge and a
 * band just OUTSIDE it, and reports the step between them.
 *
 * A step of zero means the ground has dissolved into the backdrop and the plane
 * has no visible boundary. The shipped baseline is the control: whatever this
 * reports for p4e is what "a hard edge across mid-frame" measures as.
 */
async (page) => {
  const OUT = 'C:/dev/estate/tools/capture/out/';
  const BEATS = [
    { name: 'HERO', scroll: 0.0 },
    { name: 'WEST', scroll: 0.187952 },
    { name: 'NW',   scroll: 0.245042 },
  ];
  const MODELS = (typeof MODEL_LIST !== 'undefined') ? MODEL_LIST : ['p5b', 'p4e'];

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
    return { ok: !!window.__PROBE__.renderers.length };
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
    const c = window.__PROBE_PAIR__.camera;
    return { settled: stable >= 12, pos: [c.position.x, c.position.y, c.position.z].map((v) => +v.toFixed(3)) };
  };

  const SEAM = async (band) => {
    const { scene, camera } = window.__PROBE_PAIR__;
    const gl = window.__PROBE__.renderers[window.__PROBE__.renderers.length - 1];
    const render = gl.__probeOrigRender;
    const ground = scene.getObjectByName('ground_plane');

    // 1. the ground's own silhouette, alone, unlit, unfogged
    const saved = [];
    scene.traverse((o) => { if (o.isMesh) { saved.push([o, o.visible]); o.visible = (o === ground); } });
    const sFog = scene.fog, sBg = scene.background, sMat = ground.material;
    const sTone = gl.toneMapping, sCs = gl.outputColorSpace;
    const idm = new sMat.constructor();
    idm.color.setRGB(0, 0, 0); idm.emissive.setRGB(1, 1, 1);
    idm.roughness = 1; idm.metalness = 0; idm.envMapIntensity = 0;
    idm.toneMapped = false; idm.fog = false; idm.vertexColors = false;
    ground.material = idm;
    scene.fog = null; scene.background = null;
    gl.toneMapping = 0; gl.outputColorSpace = 'srgb-linear'; gl.setClearColor(0x000000, 1);
    const mask = await new Promise((res) => requestAnimationFrame(() => {
      render(scene, camera);
      const c = gl.getContext(), w = gl.domElement.width, h = gl.domElement.height;
      const b = new Uint8Array(w * h * 4);
      c.readPixels(0, 0, w, h, c.RGBA, c.UNSIGNED_BYTE, b);
      res({ w, h, b });
    }));
    // 1b. EVERYTHING, in white. Without this the measurement is contaminated:
    // a column where a cypress or the mansion stands above the far ground would
    // report the step between ground and BUILDING rather than between ground and
    // backdrop, and those columns are exactly the ones that dominate the maximum.
    // Measured on the first run, the five worst WEST columns were 1116-1172,
    // which is the mansion. Only columns whose outside band is genuinely
    // background count.
    const allSaved = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      allSaved.push([o, o.material, o.visible]);
      o.visible = true; o.material = idm;
    });
    const anymask = await new Promise((res) => requestAnimationFrame(() => {
      render(scene, camera);
      const c = gl.getContext(), w = gl.domElement.width, h = gl.domElement.height;
      const bb = new Uint8Array(w * h * 4);
      c.readPixels(0, 0, w, h, c.RGBA, c.UNSIGNED_BYTE, bb);
      res(bb);
    }));
    for (const [o, m, v] of allSaved) { o.material = m; o.visible = v; }

    ground.material = sMat;
    for (const [o, v] of saved) o.visible = v;
    scene.fog = sFog; scene.background = sBg;
    gl.toneMapping = sTone; gl.outputColorSpace = sCs;
    idm.dispose();

    // 2. the visible frame
    const vis = await new Promise((res) => requestAnimationFrame(() => {
      const cv = document.querySelector('canvas');
      const t = document.createElement('canvas');
      t.width = cv.width; t.height = cv.height;
      t.getContext('2d').drawImage(cv, 0, 0);
      res(t.getContext('2d').getImageData(0, 0, cv.width, cv.height).data);
    }));

    const { w, h, b } = mask;
    const isGround = (x, yTop) => b[((h - 1 - yTop) * w + x) * 4] > 200;
    const isAnyGeom = (x, yTop) => anymask[((h - 1 - yTop) * w + x) * 4] > 200;
    const px = (x, yTop) => {
      const i = (yTop * w + x) * 4;
      return [vis[i], vis[i + 1], vis[i + 2]];
    };
    const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];

    let n = 0, sumStep = 0, maxStep = 0, sumIn = 0, sumOut = 0, sumHue = 0, rejected = 0;
    const worst = [];
    for (let x = 0; x < w; x += 4) {
      // topmost ground row in this column
      let top = -1;
      for (let y = 0; y < h; y++) if (isGround(x, y)) { top = y; break; }
      if (top < band + 2 || top > h - 2) continue;
      // a band just INSIDE the edge, and one just OUTSIDE it, skipping two rows
      // either side so the edge's own antialiasing is not what gets measured.
      let inR = 0, inG = 0, inB = 0, outR = 0, outG = 0, outB = 0, ni = 0, no = 0;
      for (let k = 2; k < 2 + band; k++) {
        if (top + k < h && isGround(x, top + k)) { const p = px(x, top + k); inR += p[0]; inG += p[1]; inB += p[2]; ni++; }
        if (top - k >= 0 && !isAnyGeom(x, top - k)) { const p = px(x, top - k); outR += p[0]; outG += p[1]; outB += p[2]; no++; }
      }
      if (!ni || no < band - 2) { rejected++; continue; }   // outside must be true backdrop
      const I = [inR / ni, inG / ni, inB / ni], O = [outR / no, outG / no, outB / no];
      const step = Math.abs(lum(I) - lum(O));
      const hue = Math.abs(I[0] / Math.max(I[1], 1e-6) - O[0] / Math.max(O[1], 1e-6));
      n++; sumStep += step; sumIn += lum(I); sumOut += lum(O); sumHue += hue;
      if (step > maxStep) maxStep = step;
      worst.push([x, +step.toFixed(1)]);
    }
    worst.sort((p, q) => q[1] - p[1]);
    return {
      columns: n, rejectedColumns: rejected, band,
      meanStepL: +(sumStep / n).toFixed(2),
      maxStepL: +maxStep.toFixed(2),
      meanInsideL: +(sumIn / n).toFixed(2),
      meanOutsideL: +(sumOut / n).toFixed(2),
      meanHueStepRG: +(sumHue / n).toFixed(4),
      worstColumns: worst.slice(0, 5),
    };
  };

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addInitScript(INIT);

  const out = {};
  for (const model of MODELS) {
    await page.goto('http://localhost:3001/?model=' + model, { waitUntil: 'load' });
    await page.waitForTimeout(10000);
    await page.evaluate(ATTACH);
    for (const bt of BEATS) {
      const st = await page.evaluate(SETTLE, bt.scroll);
      out[model + '_' + bt.name] = { settled: st.settled, ...(await page.evaluate(SEAM, 10)) };
    }
    await page.locator('canvas').screenshot({ path: OUT + model + '_seam_WEST.png' });
  }
  out.pageErrors = errors;
  return out;
}
