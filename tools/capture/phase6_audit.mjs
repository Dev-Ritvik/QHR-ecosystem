/**
 * PHASE 6 — forensic runtime audit of the shipped experience.
 *
 *   Playwright MCP:  browser_run_code_unsafe { filename: this file }
 *
 * A bare `async (page) => {...}`: the MCP runner evaluates it in a vm with no
 * module loader and no fs, so everything is inline and every artefact is
 * written through Playwright's own screenshot API.
 *
 * WHAT THIS IS FOR
 * Phase 6 STEP 0 says the repository is the source of truth and the
 * documentation is not. The same applies to the running build: a component
 * existing in src/ is not evidence that it draws anything. This walks the
 * ACTUAL journey the visitor scrolls, captures each chapter at a settled
 * camera, and takes one renderer census — so every later Phase 6 claim can be
 * measured against a real starting frame rather than against a file listing.
 *
 * REUSED FROM tools/capture/phase5_probe.mjs, deliberately and without change
 * in substance:
 *   • __THREE_DEVTOOLS__ as the way in. three's WebGLRenderer and Scene each
 *     dispatch an `observe` CustomEvent at that global when it exists, so a
 *     listener installed before the bundle runs hands the harness the live
 *     renderer and scene with ZERO source change. Nothing debug-shaped can
 *     ship by accident, and we measure the production path, not a debug one.
 *   • Wrapping the renderer's own `render` (an INSTANCE property; the
 *     prototype is untouched) to learn which camera the app draws the main
 *     scene with — r3f keeps the camera outside the scene graph.
 *   • Snapshotting info.render immediately after the world pass. info.render
 *     is reset at the top of every render() and the app draws through an
 *     EffectComposer, so anything reading it later sees the last fullscreen
 *     quad (calls 1, triangles 1) rather than the scene.
 *   • Settling on POSE ERROR where a target pose is known, never on per-frame
 *     movement — a fixed per-frame threshold is frame-rate dependent and let a
 *     0.157 m error through in Phase 5.
 *
 * NEW HERE, AND WHY
 * The Phase 5 probe settled against three known exterior beats. Phase 6 walks
 * the WHOLE journey including the interior leg, where the target pose for a
 * given scroll fraction is not a constant this file can hold. So chapters
 * without a known beat settle on the asymptote instead, and each capture
 * REPORTS which test it used. An asymptote settle is a weaker guarantee and is
 * labelled as one rather than presented as a pose match.
 */
async (page) => {
  const OUT = 'C:/dev/estate/tools/capture/out6/';
  const BASE = 'http://localhost:3001';

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
   * Scroll to a fraction and hold until the camera stops moving.
   *
   * `beat` is optional. With one, the loop converges on the POSE ERROR, which
   * is the strong test — the frame is provably the one intended. Without one
   * it falls back to the asymptote (60 frames under 0.5 mm), which only proves
   * the rig stopped, and `why` says which was used so a reader can tell the
   * two apart.
   */
  const SETTLE = async (arg) => {
    const { frac, beat } = arg;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    // window.scrollTo is enough even with Lenis running: Lenis's own scroll
    // listener sees an external jump and resyncs its animated and target
    // positions to it, so it converges on the requested offset rather than
    // fighting it. Verified in the settle report below — `frac` is what the
    // page actually held, not what was asked for, so a discrepancy shows up as
    // a number rather than as a wrong frame.
    window.scrollTo(0, Math.round(frac * max));

    const t0 = performance.now();
    let last = null, stable = 0, frames = 0, err = Infinity, why = 'timeout';
    while (performance.now() - t0 < 30000) {
      await new Promise((r) => requestAnimationFrame(r));
      frames++;
      const p = window.__PROBE_PAIR__;
      if (!p || !p.camera) continue;
      const c = p.camera.position;
      if (beat) err = Math.hypot(c.x - beat[0], c.y - beat[1], c.z - beat[2]);
      if (last) {
        const d = Math.hypot(c.x - last[0], c.y - last[1], c.z - last[2]);
        stable = d < 0.0005 ? stable + 1 : 0;
      }
      last = [c.x, c.y, c.z];
      if (beat && err < 0.008) { why = 'onBeat'; break; }
      if (stable >= 60) { why = 'asymptote'; break; }
    }
    const p = window.__PROBE_PAIR__;
    const c = p.camera;
    return {
      frames, ms: Math.round(performance.now() - t0),
      rafPerSec: +(frames / ((performance.now() - t0) / 1000)).toFixed(1),
      scrollY: Math.round(window.scrollY), maxScroll: max,
      frac: +(window.scrollY / max).toFixed(4),
      settled: why !== 'timeout', why,
      poseErr: beat ? +err.toFixed(4) : null,
      position: [c.position.x, c.position.y, c.position.z].map((v) => +v.toFixed(3)),
      fov: +c.fov.toFixed(2),
      // Where it is LOOKING, which a position alone does not tell you.
      dir: (() => { const v = new c.position.constructor(); c.getWorldDirection(v);
                    return [v.x, v.y, v.z].map((n) => +n.toFixed(3)); })(),
      visibleRoots: p.scene.children.filter((o) => o.visible).length,
    };
  };

  const CENSUS = () => {
    const { scene, camera } = window.__PROBE_PAIR__;
    const gl = window.__PROBE__.renderers[window.__PROBE__.renderers.length - 1];
    const info = gl.info;
    const mats = new Map(), texs = new Map();
    let meshes = 0, visibleMeshes = 0, tris = 0, visTris = 0;
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
        if (!mats.has(m.uuid)) mats.set(m.uuid, m.name || m.type);
        for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
                         'emissiveMap', 'alphaMap', 'lightMap', 'envMap']) {
          const tx = m[k];
          if (!tx || texs.has(tx.uuid)) continue;
          let bytes = 0, w = 0, hh = 0;
          if (tx.mipmaps && tx.mipmaps.length) {
            w = tx.mipmaps[0].width; hh = tx.mipmaps[0].height;
            for (const mp of tx.mipmaps) bytes += (mp.data && mp.data.byteLength) || 0;
          } else if (tx.image) {
            w = tx.image.width || 0; hh = tx.image.height || 0;
            bytes = Math.round(w * hh * 4 * (tx.generateMipmaps ? 4 / 3 : 1));
          }
          texs.set(tx.uuid, { name: (tx.name || '') + ':' + k, w, h: hh,
                              kb: Math.round(bytes / 1024), compressed: !!tx.isCompressedTexture });
        }
      }
    });
    let lights = 0, casters = 0;
    scene.traverse((o) => { if (o.isLight) { lights++; if (o.castShadow) casters++; } });
    const list = [...texs.values()].sort((a, b) => b.kb - a.kb);
    const d = window.__PROBE_DRAW__ || {};
    return {
      sceneDrawCalls: d.calls, sceneTriangles: d.triangles,
      geometries: info.memory.geometries, glTextures: info.memory.textures,
      programs: info.programs ? info.programs.length : null,
      meshes, visibleMeshes, tris: Math.round(tris), visTris: Math.round(visTris),
      materialInstances: mats.size, lights, shadowCasters: casters,
      texCount: texs.size, texMB: +(list.reduce((a, t) => a + t.kb, 0) / 1024).toFixed(2),
      texTop: list.slice(0, 4),
      buffer: [gl.domElement.width, gl.domElement.height], dpr: +gl.getPixelRatio().toFixed(2),
      tone: gl.toneMapping, exposure: +gl.toneMappingExposure.toFixed(3),
      fog: scene.fog ? { near: +scene.fog.near.toFixed(1), far: +scene.fog.far.toFixed(1),
                         color: '#' + scene.fog.color.getHexString() } : null,
      gpu: (() => {
        const c = gl.getContext();
        const dbg = c.getExtension('WEBGL_debug_renderer_info');
        return { renderer: dbg ? c.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null };
      })(),
    };
  };

  // ---------------- driver -------------------------------------------------
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 300)));
  const requests = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/\.(glb|ktx2|jpg|png|wasm|js)(\?|$)/.test(u)) requests.push(u.replace(BASE, ''));
  });

  await page.addInitScript(INIT);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });

  // The consent panel is a DOM overlay with a full-frame scrim, so a capture
  // taken under it is darkened and unusable for visual judgement. "Essential
  // only" is the privacy-preserving choice and analytics have no business in a
  // measurement run. (Phase 5 shipped three captures under this scrim before
  // anyone noticed.)
  let consent = 'not shown';
  try {
    const b = page.getByRole('button', { name: /essential only/i });
    await b.waitFor({ state: 'visible', timeout: 6000 });
    await b.click();
    await page.waitForTimeout(400);
    consent = 'dismissed';
  } catch (e) { /* cookie already present */ }

  await page.waitForTimeout(2500);
  const attached = await page.evaluate(ATTACH);

  // Chapters, from journey.ts with CROSSOVER 0.46 / JOURNEY_END 0.90 and three
  // published stations. Fractions are chapter MIDPOINTS — the held frame, not
  // the transition into it.
  const SHOTS = [
    { name: '01-hero',          frac: 0.000, beat: null },
    { name: '02-revolution',    frac: 0.100, beat: null },
    { name: '03-constellation', frac: 0.320, beat: null },
    { name: '04-veil',          frac: 0.460, beat: null },
    { name: '05-establish',     frac: 0.520, beat: null },
    { name: '06-station-1',     frac: 0.620, beat: null },
    { name: '07-station-2',     frac: 0.700, beat: null },
    { name: '08-station-3',     frac: 0.780, beat: null },
    { name: '09-portrait',      frac: 0.870, beat: null },
  ];

  // EVERY CAPTURE IS TAKEN AT A FIXED CLOCK PHASE, AND THAT IS NOT COSMETIC.
  //
  // A settled camera is not a settled FRAME. The embers, the constellation and
  // the hologram emissives are all driven by elapsed time, so two runs that
  // settle at different wall-clock offsets photograph the same pose at
  // different animation phases. The first attempt at a before/after diff here
  // was decided by exactly that: the pre-change run settled 1695 ms into the
  // sequence and the two post-change runs at 1327 and 1345 ms, so the two
  // "same build" runs agreed with each other far more closely than either
  // agreed with the third — and the control understated the noise by a factor
  // of four on the constellation frame. Three frames were flagged as
  // regressions that were nothing but 350 ms of ember drift.
  //
  // So each shot has a DEADLINE measured from page load. The probe settles the
  // camera, then holds until that deadline before the shutter opens, which
  // makes the animation phase identical across runs. `lateBy` reports any shot
  // whose settle overran its slot, because a missed deadline silently
  // reintroduces exactly the artefact this removes.
  // Budgeted from a measured run, not guessed. The first shot cannot open its
  // shutter before the page has loaded, the consent panel has been dismissed and
  // the rig has settled, which took 9.6 s on this machine; a 4 s deadline left
  // the first four shots `lateBy` 5596 / 4486 / 3327 / 1794 ms — i.e. not pinned
  // at all, which is worse than no pin because it looks like one. 13 s clears
  // that with margin, and 3 s per slot covers a 1-2 s settle.
  // AND THE PIN IS VERIFIED, NOT ASSUMED.
  //
  // A wall-clock deadline is only a proxy for the animation clock: it lines up
  // with r3f's elapsed time only if the canvas mounted at the same offset from
  // navigation, which depends on load speed. A second capture run on a warmer,
  // busier browser missed every deadline and its interior frames then differed
  // from the first run by a mean of 16.2 with 527,676 pixels above 8/255 —
  // enormous, and entirely phase. `lateBy` caught it, and the run was discarded.
  //
  // So the probe also READS the scene's own phase at each shutter: the ember
  // shader's uTime (which is r3f's clock, outside) and the first turntable's
  // idle-drift angle (inside). Two captures are only comparable if these agree.
  // A number in the report beats a promise in a comment.
  const SLOT_MS = 3000;
  const FIRST_MS = 13000;
  const HOLD = async (deadline) => {
    const t = performance.now();
    if (t >= deadline) return { lateBy: Math.round(t - deadline) };
    await new Promise((r) => setTimeout(r, deadline - t));
    // One more frame so the renderer has drawn at the held time.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { lateBy: 0 };
  };

  const PHASE = () => {
    const { scene } = window.__PROBE_PAIR__;
    let uTime = null;
    let turn = null;
    scene.traverse((o) => {
      const m = o.material;
      if (uTime === null && m && m.uniforms && m.uniforms.uTime) uTime = m.uniforms.uTime.value;
      if (turn === null && /^TURNTABLE_/.test(o.name || '')) turn = o.rotation.y;
    });
    return {
      uTime: uTime === null ? null : +uTime.toFixed(2),
      turn: turn === null ? null : +turn.toFixed(4),
    };
  };

  const results = [];
  for (let i = 0; i < SHOTS.length; i += 1) {
    const s = SHOTS[i];
    const st = await page.evaluate(SETTLE, { frac: s.frac, beat: s.beat });
    const hold = await page.evaluate(HOLD, FIRST_MS + i * SLOT_MS);
    const phase = await page.evaluate(PHASE);
    await page.locator('canvas').screenshot({ path: OUT + s.name + '.png' });
    results.push({ name: s.name, want: s.frac, ...st, ...hold, ...phase });
  }

  const census = await page.evaluate(CENSUS);

  return JSON.stringify({
    consent, attached, census,
    journey: results,
    errors: errors.slice(0, 20),
    errorCount: errors.length,
    glbRequests: [...new Set(requests.filter((u) => u.endsWith('.glb')))],
  }, null, 2);
}
