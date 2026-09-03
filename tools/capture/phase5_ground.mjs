/**
 * Phase 5 forensic follow-up: the ground plane, specifically.
 *
 *   Playwright MCP:  browser_run_code_unsafe { filename: this file }
 *
 * The coverage pass said the ground plane owns 25-47% of every exterior frame.
 * These are the questions that follow from that and cannot be answered from a
 * screenshot:
 *
 *   WHERE DOES IT END. The far edge of a 240m plane against a photographic
 *   backdrop is the classic "giant plane edge". Measured as the topmost row
 *   classified as terrain, per column, so the profile shows whether the edge is
 *   a straight line, a silhouette of the relief, or hidden by fog.
 *
 *   HOW COARSE IS IT. The ground texture is a single 1024 map clamped across
 *   240m. Ray-casting the ground for a grid of screen pixels gives the world
 *   distance between adjacent pixels, and therefore metres per texel at the
 *   near, middle and far ground - the number that says whether authoring finer
 *   ground detail is worth anything at all at this camera.
 *
 *   WHAT IS ITS VALUE STRUCTURE. Sampled luminance and chroma over the lawn
 *   region only, so "flat green plane" is a statistic rather than an adjective.
 */
async (page) => {
  const BEATS = [
    { name: 'HERO', scroll: 0.0 },
    { name: 'WEST', scroll: 0.187952 },
    { name: 'NW',   scroll: 0.245042 },
  ];

  const ATTACH = () => {
    const h = window.__PROBE__;
    if (!h || !h.renderers.length) return { ok: false };
    const gl = h.renderers[h.renderers.length - 1];
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

  const INIT = () => {
    const hits = { scenes: [], renderers: [] };
    const t = new EventTarget();
    t.addEventListener('observe', (e) => {
      const o = e.detail; if (!o) return;
      if (o.isScene) hits.scenes.push(o); else if (o.isWebGLRenderer) hits.renderers.push(o);
    });
    window.__THREE_DEVTOOLS__ = t; window.__PROBE__ = hits;
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
    return { settled: stable >= 12 };
  };

  const GROUND = async () => {
    const { scene, camera } = window.__PROBE_PAIR__;
    const gl = window.__PROBE__.renderers[window.__PROBE__.renderers.length - 1];
    const render = gl.__probeOrigRender;
    const ground = scene.getObjectByName('ground_plane');

    // ---- 1. the plane's silhouette: render the ground alone, in white -------
    const saved = [];
    scene.traverse((o) => { if (o.isMesh) { saved.push([o, o.visible]); o.visible = (o === ground); } });
    const sFog = scene.fog, sBg = scene.background, sMat = ground.material;
    const sTone = gl.toneMapping, sCs = gl.outputColorSpace;
    const idm = new sMat.constructor();
    idm.color.setRGB(0, 0, 0); idm.emissive.setRGB(1, 1, 1); idm.roughness = 1; idm.metalness = 0;
    idm.envMapIntensity = 0; idm.toneMapped = false; idm.fog = false;
    ground.material = idm;
    scene.fog = null; scene.background = null;
    gl.toneMapping = 0; gl.outputColorSpace = 'srgb-linear'; gl.setClearColor(0x000000, 1);

    const shot = await new Promise((res) => requestAnimationFrame(() => {
      render(scene, camera);
      const c = gl.getContext(), w = gl.domElement.width, h = gl.domElement.height;
      const b = new Uint8Array(w * h * 4);
      c.readPixels(0, 0, w, h, c.RGBA, c.UNSIGNED_BYTE, b);
      res({ w, h, b });
    }));

    ground.material = idm === ground.material ? sMat : sMat;
    for (const [o, v] of saved) o.visible = v;
    scene.fog = sFog; scene.background = sBg;
    gl.toneMapping = sTone; gl.outputColorSpace = sCs;
    idm.dispose();

    const { w, h, b } = shot;
    const topRow = [];
    for (let x = 0; x < w; x += 16) {
      let top = -1;
      for (let yy = h - 1; yy >= 0; yy--) {           // readPixels is bottom-up
        const i = (yy * w + x) * 4;
        if (b[i] > 200) { top = h - 1 - yy; break; }
      }
      topRow.push(top);
    }
    const seen = topRow.filter((v) => v >= 0);
    const edge = {
      columnsWithGround: seen.length, columns: topRow.length,
      topRowMin: seen.length ? Math.min(...seen) : null,
      topRowMax: seen.length ? Math.max(...seen) : null,
      profile: topRow,
    };

    // ---- 2. metres per screen pixel on the ground, by ray-cast --------------
    // Plane y = 0.97 is the ground's own top; the mesh is displaced, so the
    // plane is an approximation used only to bound the sampling rate.
    const dir = (nx, ny) => {
      const v = { x: nx, y: ny, z: 0.5 };
      // unproject through the camera without importing THREE
      const p = camera.position;
      const m = camera.projectionMatrixInverse.elements, mw = camera.matrixWorld.elements;
      const clip = [nx, ny, 1, 1];
      const e = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) e[i] = m[i] * clip[0] + m[i + 4] * clip[1] + m[i + 8] * clip[2] + m[i + 12] * clip[3];
      const ex = e[0] / e[3], ey = e[1] / e[3], ez = e[2] / e[3];
      const wx = mw[0] * ex + mw[4] * ey + mw[8] * ez + mw[12];
      const wy = mw[1] * ex + mw[5] * ey + mw[9] * ez + mw[13];
      const wz = mw[2] * ex + mw[6] * ey + mw[10] * ez + mw[14];
      const d = { x: wx - p.x, y: wy - p.y, z: wz - p.z };
      const l = Math.hypot(d.x, d.y, d.z);
      return { x: d.x / l, y: d.y / l, z: d.z / l };
    };
    const hit = (nx, ny) => {
      const p = camera.position, d = dir(nx, ny);
      if (Math.abs(d.y) < 1e-6) return null;
      const t = (0.0 - p.y) / d.y;
      if (t <= 0) return null;
      return { x: p.x + d.x * t, z: p.z + d.z * t, t };
    };
    const density = [];
    for (const [label, ny] of [['bottom of frame', -0.95], ['lower third', -0.5],
                               ['centre', 0.0], ['near horizon', 0.32]]) {
      const a = hit(0, ny), c2 = hit(2 / w * 2, ny);   // two pixels apart in NDC
      if (!a || !c2) { density.push({ label, offFrame: true }); continue; }
      const dx = Math.hypot(a.x - c2.x, a.z - c2.z) / 2;
      density.push({ label, distM: +a.t.toFixed(1),
                     mPerPixel: +dx.toFixed(4),
                     mPerTexel: 240 / 1024,
                     texelsPerPixel: +(dx / (240 / 1024)).toFixed(3) });
    }

    // ---- 3. lawn value statistics from the VISIBLE frame --------------------
    const vis = await new Promise((res) => requestAnimationFrame(() => {
      const c = document.querySelector('canvas');
      const t = document.createElement('canvas');
      t.width = c.width; t.height = c.height;
      t.getContext('2d').drawImage(c, 0, 0);
      res(t.getContext('2d').getImageData(0, 0, c.width, c.height).data);
    }));
    // sample only pixels the ground silhouette marked, and only below the
    // horizon band, so the backdrop photo cannot leak in.
    let n = 0, sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0, mn = 255, mx = 0;
    for (let yy = 0; yy < h; yy += 3) for (let x = 0; x < w; x += 3) {
      const gi = ((h - 1 - yy) * w + x) * 4;
      if (b[gi] < 200) continue;
      const i = (yy * w + x) * 4;
      const r = vis[i], g2 = vis[i + 1], bb = vis[i + 2];
      const L = 0.2126 * r + 0.7152 * g2 + 0.0722 * bb;
      n++; sr += r; sg += g2; sb += bb; sl += L; sl2 += L * L;
      if (L < mn) mn = L; if (L > mx) mx = L;
    }
    const mean = sl / n;
    return {
      edge, density,
      lawn: { samples: n, meanRGB: [sr / n, sg / n, sb / n].map((v) => +v.toFixed(1)),
              meanL: +mean.toFixed(2), sdL: +Math.sqrt(sl2 / n - mean * mean).toFixed(2),
              minL: mn, maxL: mx },
      groundMaterial: (() => {
        const m = sMat;
        return { name: m.name, map: m.map ? (m.map.name || 'yes') : null,
                 normalMap: m.normalMap ? 'yes' : null, roughnessMap: m.roughnessMap ? 'yes' : null,
                 aoMap: m.aoMap ? 'yes' : null, roughness: m.roughness, metalness: m.metalness,
                 vertexColors: m.vertexColors,
                 hasColorAttr: !!ground.geometry.attributes.color,
                 uv: !!ground.geometry.attributes.uv,
                 wrapS: m.map ? m.map.wrapS : null, repeat: m.map ? [m.map.repeat.x, m.map.repeat.y] : null,
                 receiveShadow: ground.receiveShadow, castShadow: ground.castShadow };
      })(),
    };
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addInitScript(INIT);
  await page.goto('http://localhost:3001/?model=p4e', { waitUntil: 'load' });
  await page.waitForTimeout(10000);
  await page.evaluate(ATTACH);

  const out = {};
  for (const b of BEATS) {
    await page.evaluate(SETTLE, b.scroll);
    out[b.name] = await page.evaluate(GROUND);
  }
  return out;
}
