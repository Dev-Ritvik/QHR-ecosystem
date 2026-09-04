/**
 * Phase 5 runtime probe: pose-verified captures, a renderer census, and an
 * exact per-class screen-coverage pass, taken through the PRODUCTION build.
 *
 *   Playwright MCP:  browser_run_code_unsafe { filename: this file }
 *
 * It is a bare `async (page) => {...}` because the MCP runner evaluates the
 * file in a vm with no module loader and no fs - so everything is inline and
 * every artefact is written through Playwright's own screenshot API.
 *
 * WHY __THREE_DEVTOOLS__ AND NOT A DEBUG EXPORT
 * three's WebGLRenderer and Scene each dispatch an `observe` CustomEvent at
 * window.__THREE_DEVTOOLS__ when that global exists. Installing a listener
 * before the bundle runs hands the harness the live renderer and scene with
 * ZERO source change: no debug global the app has to carry, nothing that can
 * ship by accident, and no risk of measuring a debug path instead of the
 * production one. r3f keeps the camera OUTSIDE the scene graph, so the
 * renderer's own `render` is wrapped (an instance property - the prototype is
 * untouched) to learn which camera the app draws the main scene with.
 *
 * WHY THE POSE IS VERIFIED RATHER THAN ASSUMED
 * The camera is a damped follower of a centripetal Catmull-Rom driven through
 * Lenis's smoothed scroll, so a screenshot taken at a scroll offset is only "at
 * a beat" once the rig has converged. Each capture scrolls to a fraction
 * derived by inverting SWING (0.2s + 0.8*power2.inOut) over CROSSOVER 0.46 and
 * then holds until the camera is AT the beat - see SETTLE, which converges on
 * the pose error itself rather than on per-frame movement, because a per-frame
 * threshold is frame-rate dependent and let a 0.157 m error through. Phase 2.5B
 * lost a day to measurements made against a mis-derived camera; this is the
 * guard.
 *
 * WHY COVERAGE IS RENDERED, NOT PROJECTED
 * A world-axis bounding box overstates a cypress cone and cannot see occlusion.
 * The coverage pass moves every mesh onto a black, unlit material whose
 * EMISSIVE carries a per-class id, disables fog, background, tone mapping and
 * the sRGB transfer, draws one frame with the app's own camera straight to the
 * default framebuffer, and reads it back in the SAME task - which is what makes
 * the read legal under preserveDrawingBuffer:false. What comes out is the
 * number of pixels each class actually owns: occlusion, silhouette and all.
 */
async (page) => {
  const OUT = 'C:/dev/estate/tools/capture/out/';

  // Document-scroll fractions that land the rig on each beat.
  const BEATS = [
    { name: 'HERO', scroll: 0.0,      pos: [-20.0, 15.5, 27.0], fov: 41 },
    { name: 'WEST', scroll: 0.187952, pos: [-26.0,  9.0,  2.0], fov: 56 },
    { name: 'NW',   scroll: 0.245042, pos: [-15.0,  8.4, -19.0], fov: 52 },
  ];

  // Node-name regexes and an id colour per class, chosen so no two ids land
  // within 24/255 of each other in the readback.
  const CLASSES = [
    ['terrain',  '^ground_plane$',                                  [1.00, 0.00, 0.00]],
    ['drive',    '^drive_',                                         [0.60, 0.30, 0.00]],
    ['hedge',    '^hedge_',                                         [0.00, 1.00, 0.00]],
    ['cypress',  '^cyp_',                                           [0.00, 0.00, 1.00]],
    ['water',    '^(fount_water|fountain_jet|fountain_water)$',    [1.00, 0.75, 0.85]],
    ['fountain', '^fount',                                          [1.00, 1.00, 0.00]],
    ['terrace',  '^terrace_',                                       [1.00, 0.00, 1.00]],
    ['steps',    '^entry_',                                         [0.00, 1.00, 1.00]],
    // P5H. Matched BEFORE nothing else can claim it - `urn_entry_*` collides
    // with no rule above (`^entry_` needs the name to START with entry_), and
    // this id is >= 24/255 from every other in the table, the separation the
    // nearest-id classifier depends on.
    ['urn',      '^urn_',                                           [0.30, 0.60, 1.00]],
    // P5K. The edging was invisible and therefore never worth its own class;
    // once its winding is repaired it has to be measurable on its own, because
    // "it renders now" and "it improves the frame" are different questions.
    // Nearest neighbour in the table is roof at an L1 distance of 89/255.
    ['edging',   '^edging_',                                        [0.85, 0.45, 0.15]],
    ['roof',     '^(mansion_roof|roof_peak|spire_|finial_|cupola_)', [1.00, 0.50, 0.00]],
    ['masonry',  '^(ashlar_|rustic_)',                              [0.50, 0.00, 1.00]],
    ['mansion',  '^(mansion_|portico_|arch|door|lion_)',            [0.00, 0.55, 0.30]],
  ];

  // ---------------- page-side functions (serialised by page.evaluate) -------
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
    if (!h || !h.renderers.length) return { ok: false, why: 'no renderer observed' };
    const gl = h.renderers[h.renderers.length - 1];
    if (!gl.__probePatched) {
      const orig = gl.render.bind(gl);
      gl.__probeOrigRender = orig;
      gl.render = function (scene, camera) {
        const main = scene && scene.isScene && scene.children && scene.children.length > 2;
        if (main) window.__PROBE_PAIR__ = { scene, camera };
        const r = orig(scene, camera);
        // renderer.info.render is RESET at the top of every render(), and the
        // app draws through an EffectComposer - so by the time anything outside
        // the frame reads it, it holds the last fullscreen quad (calls 1,
        // triangles 1) rather than the scene. Snapshot it here, immediately
        // after the pass that drew the world.
        if (main) {
          const i = gl.info.render;
          window.__PROBE_DRAW__ = { calls: i.calls, triangles: i.triangles,
                                    lines: i.lines, points: i.points, frame: i.frame };
        }
        return r;
      };
      gl.__probePatched = true;
    }
    return { ok: true, renderers: h.renderers.length, scenes: h.scenes.length };
  };

  // SETTLE CONVERGES ON THE POSE ERROR, NOT ON PER-FRAME MOVEMENT, and that
  // correction matters more than it looks.
  //
  // The original test was "12 consecutive frames moving under 4 mm". The rig is
  // a first-order lag, so per-frame movement is (remaining distance / tau) * dt
  // - it is proportional to the FRAME TIME. A run that happens to render faster
  // therefore takes smaller steps and trips a fixed per-frame threshold EARLIER,
  // while still further from the beat. That is exactly what happened on the
  // first p5h run: 94-101 rAF/s and a settled pose 0.157 / 0.174 / 0.164 m from
  // the beat, against p5g's 0.000 / 0.014 / 0.024 at 78-85. At HERO's
  // 0.0245 m/px that is a SIX PIXEL shift between the two frames being
  // differenced - larger than the 0.07% object under test - and it moved sky
  // and terrain coverage by 0.35 points on its own.
  //
  // So the loop now runs until the camera is actually AT the beat (8 mm), and
  // only falls back to an asymptote test - 60 frames under 0.5 mm - when the
  // rig genuinely cannot get closer. The residual floor is the scroll
  // quantisation: window.scrollTo takes integer pixels, so a derived fraction
  // lands a pixel off and WEST/NW bottom out around 0.02 m while HERO, at
  // scroll 0, is exact.
  const SETTLE = async (arg) => {
    const { frac, beat } = arg;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.round(frac * max));
    const t0 = performance.now();
    let last = null, stable = 0, frames = 0, err = Infinity, why = 'timeout';
    while (performance.now() - t0 < 40000) {
      await new Promise((r) => requestAnimationFrame(r));
      frames++;
      const p = window.__PROBE_PAIR__;
      if (!p || !p.camera) continue;
      const c = p.camera.position;
      err = Math.hypot(c.x - beat[0], c.y - beat[1], c.z - beat[2]);
      if (last) {
        const d = Math.hypot(c.x - last[0], c.y - last[1], c.z - last[2]);
        stable = d < 0.0005 ? stable + 1 : 0;
      }
      last = [c.x, c.y, c.z];
      if (err < 0.008) { why = 'onBeat'; break; }
      if (stable >= 60) { why = 'asymptote'; break; }
    }
    const c = window.__PROBE_PAIR__.camera;
    return {
      frames, ms: Math.round(performance.now() - t0),
      fps: +(frames / ((performance.now() - t0) / 1000)).toFixed(1),
      scrollY: window.scrollY, maxScroll: max,
      settled: err < 0.008 || stable >= 60, why,
      position: [c.position.x, c.position.y, c.position.z].map((v) => +v.toFixed(4)),
      fov: c.fov,
    };
  };

  const CENSUS = () => {
    const { scene, camera } = window.__PROBE_PAIR__;
    const gl = window.__PROBE__.renderers[window.__PROBE__.renderers.length - 1];
    const info = gl.info;
    const mats = new Map(), texs = new Map();
    let meshes = 0, visibleMeshes = 0, tris = 0, visTris = 0, dbl = 0, tsp = 0;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      let vis = o.visible, p = o.parent;
      while (vis && p) { vis = p.visible; p = p.parent; }
      if (vis) visibleMeshes++;
      const g = o.geometry;
      const t = g ? (g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0)) : 0;
      tris += t; if (vis) visTris += t;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        if (!m) continue;
        if (!mats.has(m.uuid)) {
          mats.set(m.uuid, m.name || m.type);
          if (m.side === 2) dbl++;
          if (m.transparent) tsp++;
        }
        for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
                         'emissiveMap', 'alphaMap', 'lightMap', 'envMap']) {
          const tx = m[k];
          if (!tx || texs.has(tx.uuid)) continue;
          // COMPRESSED vs TRANSCODED-TO-RGBA is the difference between the
          // KTX2 payload on the wire and what the GPU actually holds, and it
          // depends on which compressed formats the CLIENT supports. Recorded
          // explicitly rather than inferred, because a headless run without
          // S3TC/ASTC transcodes to RGBA8 and would otherwise be reported as
          // the shipping number.
          let bytes = 0, w = 0, hh = 0, levels = 0;
          const compressed = !!tx.isCompressedTexture;
          if (tx.mipmaps && tx.mipmaps.length) {
            levels = tx.mipmaps.length; w = tx.mipmaps[0].width; hh = tx.mipmaps[0].height;
            for (const mp of tx.mipmaps) bytes += (mp.data && mp.data.byteLength) || 0;
          } else if (tx.image) {
            w = tx.image.width || 0; hh = tx.image.height || 0;
            bytes = Math.round(w * hh * 4 * (tx.generateMipmaps ? 4 / 3 : 1));
          }
          texs.set(tx.uuid, { name: (tx.name || '') + ':' + k, w, h: hh, levels,
                              kb: Math.round(bytes / 1024), compressed, fmt: tx.format });
        }
      }
    });
    let lights = 0, casters = 0;
    scene.traverse((o) => { if (o.isLight) { lights++; if (o.castShadow) casters++; } });
    const list = [...texs.values()].sort((a, b) => b.kb - a.kb);
    const d = window.__PROBE_DRAW__ || {};
    return {
      sceneDrawCalls: d.calls, sceneTriangles: d.triangles,
      composerLastPass: { calls: info.render.calls, triangles: info.render.triangles },
      geometries: info.memory.geometries, glTextures: info.memory.textures,
      programs: info.programs ? info.programs.length : null,
      meshes, visibleMeshes, tris: Math.round(tris), visTris: Math.round(visTris),
      materials: mats.size, doubleSided: dbl, transparent: tsp, lights, shadowCasters: casters,
      texCount: texs.size, texMB: +(list.reduce((a, t) => a + t.kb, 0) / 1024).toFixed(2),
      texTop: list.slice(0, 3),
      camera: { fov: camera.fov, near: camera.near, far: camera.far },
      fog: scene.fog ? { near: +scene.fog.near.toFixed(1), far: +scene.fog.far.toFixed(1),
                         color: '#' + scene.fog.color.getHexString() } : null,
      tone: gl.toneMapping, exposure: +gl.toneMappingExposure.toFixed(3),
      buffer: [gl.domElement.width, gl.domElement.height], dpr: gl.getPixelRatio(),
      gpu: (() => {
        const c = gl.getContext();
        const dbg = c.getExtension('WEBGL_debug_renderer_info');
        return {
          renderer: dbg ? c.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
          s3tc: !!c.getExtension('WEBGL_compressed_texture_s3tc'),
          astc: !!c.getExtension('WEBGL_compressed_texture_astc'),
          etc: !!c.getExtension('WEBGL_compressed_texture_etc'),
          bptc: !!c.getExtension('EXT_texture_compression_bptc'),
        };
      })(),
    };
  };

  const COVERAGE = async (spec) => {
    const { scene, camera } = window.__PROBE_PAIR__;
    const gl = window.__PROBE__.renderers[window.__PROBE__.renderers.length - 1];
    const render = gl.__probeOrigRender;
    const rules = spec.map(([n, re, rgb]) => [n, new RegExp(re), rgb]);
    const idOf = (n) => { for (const r of rules) if (r[1].test(n)) return [r[0], r[2]]; return ['other', [0.5, 0.5, 0.5]]; };

    // THE VISIBLE FRAME IS GRABBED FIRST - before a single piece of renderer
    // state is touched - and the grab is CHECKED.
    //
    // Under preserveDrawingBuffer:false the canvas only holds a frame between
    // the app's draw and the next clear. A callback registered while r3f's own
    // rAF is running is queued after it, so exactly ONE hop lands inside that
    // window; two hops land after the following clear and read black. The
    // original code did one hop with no check and was silently unreliable:
    // three of four p5j captures came back with every class at L 0, sd 0,
    // rgb [0,0,0] and were one step from being reported as measurements.
    //
    // The guard is the point. It cannot make the read reliable, but it makes a
    // failed read FAIL rather than return zeros, and it is what exposed that
    // the read had never been sound - earlier runs had simply been lucky.
    // REPAIRED, AND THE REPAIR IS MEASURED RATHER THAN ARGUED.
    //
    // The original read went through a 2D canvas: drawImage(webglCanvas) then
    // getImageData. That path asks the browser for a SNAPSHOT of the drawing
    // buffer, which under preserveDrawingBuffer:false is only valid between
    // the app's draw and the compositor's clear - so it depended on where the
    // probe's rAF landed relative to r3f's, and three of four p5j captures
    // came back black.
    //
    // readPixels on the context reads the BACK BUFFER itself. It is not a
    // snapshot and does not go through the compositor, so it holds whatever
    // was last drawn until something clears it - which is the next render, not
    // the next paint. Same rAF ordering, materially weaker dependency on it.
    //
    // Both reads are taken and compared. `visAgreeMAD` is the mean absolute
    // difference between them over the frame; if the two independent paths
    // agree, the new one is validated by measurement rather than by argument.
    // readPixels is bottom-up and getImageData is top-down, so the GL read is
    // flipped into top-down here and `vis` keeps its original orientation.
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
      const flip = new Uint8Array(w * hh * 4);
      const row = w * 4;
      for (let y = 0; y < hh; y++) flip.set(raw.subarray((hh - 1 - y) * row, (hh - y) * row), y * row);
      return flip;
    };
    const grab2D = () => {
      const cv = document.querySelector('canvas');
      const t = document.createElement('canvas');
      t.width = cv.width; t.height = cv.height;
      t.getContext('2d').drawImage(cv, 0, 0);
      return t.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    };
    let vis = null, vis2d = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((r) => requestAnimationFrame(r));
      const a = grabGL();
      if (isDark(a)) continue;
      vis = a;
      const b = grab2D();
      if (!isDark(b)) vis2d = b;
      break;
    }
    let visAgreeMAD = null;
    if (vis && vis2d) {
      let s = 0, n = 0;
      for (let i = 0; i < vis.length; i += 4 * 37) {
        s += Math.abs(vis[i] - vis2d[i]) + Math.abs(vis[i + 1] - vis2d[i + 1])
           + Math.abs(vis[i + 2] - vis2d[i + 2]);
        n += 3;
      }
      visAgreeMAD = +(s / n).toFixed(3);
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
        m.vertexColors = false; m.name = 'ID_' + cls;
        idMats.set(cls, m);
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

    // The VISIBLE frame, read back through a 2D canvas on the very next frame,
    // so the id mask and the picture it indexes are one frame apart at most and
    // the camera is settled in both. This is what turns the mask into a
    // measurement: per-class mean luminance and chroma from the actual render,
    // which is the Phase 4 material-mask instrument applied to Phase 5 classes.

    const table = rules.map((r) => [r[0], r[2]]); table.push(['other', [0.5, 0.5, 0.5]]);
    const counts = {}, stat = {}; let bg = 0, unk = 0;
    const { w, h: hh, buf } = px;
    // Horizon: the row (from the top) above which no classified pixel appears.
    let firstRow = hh;
    for (let i = 0; i < w * hh; i++) {
      const r = buf[i * 4], g2 = buf[i * 4 + 1], b = buf[i * 4 + 2];
      if (r < 6 && g2 < 6 && b < 6) { bg++; continue; }
      let best = null, bd = 1e9;
      for (const [n, rgb] of table) {
        const d = Math.abs(r - rgb[0] * 255) + Math.abs(g2 - rgb[1] * 255) + Math.abs(b - rgb[2] * 255);
        if (d < bd) { bd = d; best = n; }
      }
      if (bd > 24) { unk++; continue; }
      counts[best] = (counts[best] || 0) + 1;
      const rowFromTop = hh - 1 - Math.floor(i / w);   // readPixels is bottom-up
      if (rowFromTop < firstRow) firstRow = rowFromTop;
      if (!vis) continue;
      const vi = (rowFromTop * w + (i % w)) * 4;
      const st = stat[best] || (stat[best] = { n: 0, r: 0, g: 0, b: 0, l: 0, l2: 0 });
      const R = vis[vi], G = vis[vi + 1], B = vis[vi + 2];
      const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      st.n++; st.r += R; st.g += G; st.b += B; st.l += L; st.l2 += L * L;
    }
    const total = w * hh;
    const shade = {};
    for (const [k, v] of Object.entries(stat)) {
      const mL = v.l / v.n;
      shade[k] = { L: +mL.toFixed(2), sd: +Math.sqrt(Math.max(v.l2 / v.n - mL * mL, 0)).toFixed(2),
                   rgb: [v.r / v.n, v.g / v.n, v.b / v.n].map((x) => +x.toFixed(1)),
                   RG: +((v.r / v.n) / Math.max(v.g / v.n, 1e-6)).toFixed(3) };
    }
    return {
      size: [w, hh], skyPct: +(100 * bg / total).toFixed(2), unclassifiedPct: +(100 * unk / total).toFixed(2),
      horizonRow: firstRow,
      classes: Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [k, +(100 * v / total).toFixed(2)])),
      shade: vis ? shade : null,
      shadeUnavailable: !vis,
      // null when the 2D path failed and the GL path did not - which is the
      // asymmetry the repair exists to produce.
      visAgreeMAD,
      visPaths: (vis ? 'gl' : '-') + '/' + (vis2d ? '2d' : '-'),
    };
  };

  // THE CONSENT PANEL HAS TO GO BEFORE ANYTHING IS CAPTURED.
  //
  // It is a DOM overlay with a full-frame scrim, so `locator('canvas')
  // .screenshot()` renders the page region and comes back darkened - the
  // captures are unusable for visual judgement even though the MEASUREMENTS are
  // unaffected (readPixels reads the WebGL back buffer, and drawImage reads the
  // canvas; neither sees the DOM, which is why terrain still measured 70.53
  // against 70.52 on a clean run). Earlier passes only escaped this because a
  // cookie happened to persist across runs; restarting the server exposed it.
  // "Essential only" is chosen deliberately - it is the privacy-preserving
  // option, and analytics have no business in a measurement run.
  const dismissConsent = async (pg) => {
    try {
      const b = pg.getByRole('button', { name: /essential only/i });
      await b.waitFor({ state: 'visible', timeout: 4000 });
      await b.click();
      await pg.waitForTimeout(400);
      return true;
    } catch (e) { return false; }
  };

  // ---------------- drive -------------------------------------------------
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 300)));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addInitScript(INIT);

  const out = {};
  const MODELS = (typeof MODEL_LIST !== 'undefined') ? MODEL_LIST : ['p5m','p5k'];
  for (const model of MODELS)
  for (const grade of ['daylight', 'dusk']) {
    if (grade === 'dusk' && false) continue;   // dusk on the newest candidate only
    await page.goto('http://localhost:3001/?model=' + model + (grade === 'dusk' ? '&grade=dusk' : ''),
                    { waitUntil: 'load' });
    await dismissConsent(page);
    await page.waitForTimeout(10000);
    const att = await page.evaluate(ATTACH);
    if (!att.ok) throw new Error('attach failed: ' + JSON.stringify(att));

    for (const b of BEATS) {
      if (grade === 'dusk' && b.name !== 'HERO') continue;
      const key = model + '_' + b.name + '_' + grade;
      const settle = await page.evaluate(SETTLE, { frac: b.scroll, beat: b.pos });
      const err = Math.hypot(settle.position[0] - b.pos[0], settle.position[1] - b.pos[1],
                             settle.position[2] - b.pos[2]);
      await page.locator('canvas').screenshot({ path: OUT + key + '.png' });
      out[key] = {
        poseErrM: +err.toFixed(4), poseOk: err < 0.05, settled: settle.settled, why: settle.why,
        fps: settle.fps, frames: settle.frames, scrollY: settle.scrollY, maxScroll: settle.maxScroll,
        position: settle.position, fov: settle.fov,
        census: await page.evaluate(CENSUS),
        coverage: await page.evaluate(COVERAGE, CLASSES),
      };
    }
  }
  // Interior regression, in the same run and the same context: the Phase 5
  // work is exterior-only and /hall must be provably untouched.
  await page.goto('http://localhost:3001/hall', { waitUntil: 'load' });
  await dismissConsent(page);
  await page.waitForTimeout(9000);
  await page.locator('canvas').screenshot({ path: OUT + (MODELS[0] || 'x') + '_interior_hall.png' });
  out.interiorErrors = errors.length;
  out.consoleErrors = errors;
  // Compact return: the census repeats verbatim across beats and the texture
  // list is invariant, so the caller gets the numbers that differ and the rest
  // is available from the screenshots and the per-run census below.
  const slim = {};
  for (const [k, v] of Object.entries(out)) {
    if (k === 'consoleErrors' || k === 'interiorErrors') { slim[k] = v; continue; }
    slim[k] = {
      poseErrM: v.poseErrM, settled: v.settled, why: v.why, fps: v.fps,
      calls: v.census.sceneDrawCalls, tris: v.census.sceneTriangles,
      mats: v.census.materials, texN: v.census.texCount, texMB: v.census.texMB,
      geo: v.census.geometries, progs: v.census.programs,
      sky: v.coverage.skyPct, unk: v.coverage.unclassifiedPct, horizon: v.coverage.horizonRow,
      cov: v.coverage.classes, shade: v.coverage.shade, shadeNA: v.coverage.shadeUnavailable,
      visPaths: v.coverage.visPaths, visAgreeMAD: v.coverage.visAgreeMAD,
      lights: v.census.lights, casters: v.census.shadowCasters,
    };
  }
  return slim;
}
