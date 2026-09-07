/**
 * PHASE 6 — is the interior lightmap uploaded once, or four times?
 *
 *   Playwright MCP:  browser_run_code_unsafe { filename: this file }
 *
 * The census found FOUR distinct 4096x4096 textures named "lightmap", 21,845 KB
 * each. interior_hall.glb carries ONE lightmap image, referenced by ONE
 * textures[] entry, used by seven materials as occlusionTexture — so on the
 * wire it is unambiguously a single asset. Four resident copies would be ~64 MB
 * of avoidable GPU memory, which §52 makes a Phase 6 concern.
 *
 * But "four Texture objects" and "four GPU uploads" are not the same claim, and
 * neither is "four ArrayBuffers". This settles all three:
 *
 *   • uuid            — distinct THREE.Texture objects?
 *   • image identity  — do they share one decoded source?
 *   • mip[0] buffer   — do they share one ArrayBuffer? (identity, not equality)
 *   • __webglTexture  — does the RENDERER hold distinct GL objects for them?
 *     This is the only one that actually costs VRAM, read out of the
 *     renderer's own WebGLProperties rather than inferred.
 *   • holders         — which materials/slots reference each.
 */
async (page) => {
  const BASE = 'http://localhost:3001';

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
      gl.render = function (scene, camera) {
        if (scene && scene.isScene && scene.children && scene.children.length > 2) {
          window.__PROBE_PAIR__ = { scene, camera };
        }
        return orig(scene, camera);
      };
      gl.__probePatched = true;
    }
    return { ok: true };
  };

  const LIGHTMAPS = () => {
    const { scene } = window.__PROBE_PAIR__;
    const gl = window.__PROBE__.renderers[window.__PROBE__.renderers.length - 1];
    const props = gl.properties;

    const byTex = new Map();
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        if (!m) continue;
        for (const slot of ['lightMap', 'aoMap', 'map', 'emissiveMap']) {
          const tx = m[slot];
          if (!tx) continue;
          const w = (tx.mipmaps && tx.mipmaps[0] && tx.mipmaps[0].width) || (tx.image && tx.image.width) || 0;
          // Only the big atlas is in question here.
          if (w < 2048) continue;
          if (!byTex.has(tx.uuid)) byTex.set(tx.uuid, { tx, holders: [] });
          byTex.get(tx.uuid).holders.push((m.name || m.type) + '.' + slot);
        }
      }
    });

    const entries = [...byTex.values()];
    // ArrayBuffer identity across the set: index of the first entry sharing
    // this buffer, so equal indices mean one buffer shared.
    const buffers = [];
    const images = [];
    const out = entries.map((e, i) => {
      const tx = e.tx;
      const b = tx.mipmaps && tx.mipmaps[0] && tx.mipmaps[0].data ? tx.mipmaps[0].data.buffer : null;
      let bi = buffers.indexOf(b); if (bi < 0) { buffers.push(b); bi = buffers.length - 1; }
      const im = tx.image || null;
      let ii = images.indexOf(im); if (ii < 0) { images.push(im); ii = images.length - 1; }
      const p = props.get(tx);
      return {
        i, uuid: tx.uuid.slice(0, 8), name: tx.name,
        size: [(tx.mipmaps && tx.mipmaps[0] ? tx.mipmaps[0].width : 0),
               (tx.mipmaps && tx.mipmaps[0] ? tx.mipmaps[0].height : 0)],
        levels: tx.mipmaps ? tx.mipmaps.length : 0,
        kb: tx.mipmaps ? Math.round(tx.mipmaps.reduce((a, m) => a + ((m.data && m.data.byteLength) || 0), 0) / 1024) : 0,
        bufferGroup: bi, imageGroup: ii,
        // The number that actually costs memory.
        hasGL: !!(p && p.__webglTexture),
        glVersion: p ? p.__version : null,
        colorSpace: tx.colorSpace,
        holderCount: e.holders.length,
        holders: e.holders.slice(0, 8),
      };
    });

    return {
      distinctTextureObjects: out.length,
      distinctArrayBuffers: buffers.filter(Boolean).length,
      distinctImages: images.filter(Boolean).length,
      uploadedToGL: out.filter((o) => o.hasGL).length,
      totalKbIfEachUploaded: out.reduce((a, o) => a + o.kb, 0),
      textures: out,
      rendererTextureCount: gl.info.memory.textures,
    };
  };

  await page.addInitScript(INIT);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  try {
    const b = page.getByRole('button', { name: /essential only/i });
    await b.waitFor({ state: 'visible', timeout: 6000 });
    await b.click();
  } catch (e) { /* already consented */ }
  await page.waitForTimeout(2500);
  await page.evaluate(ATTACH);

  // Scroll into the interior so the hall is mounted, visible and drawn — a
  // texture that is never rendered may not have been uploaded yet, and
  // "uploaded" is the question.
  await page.evaluate(async () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.round(0.62 * max));
    await new Promise((r) => setTimeout(r, 4000));
  });

  const lm = await page.evaluate(LIGHTMAPS);
  return JSON.stringify(lm, null, 2);
}
