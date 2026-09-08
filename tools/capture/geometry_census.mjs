/**
 * PHASE 6B — geometry census, by category.
 *
 *   node tools/capture/geometry_census.mjs --frac 0
 *
 * The brief is explicit that performance work starts with a classification and
 * not with a merge: "First classify geometry. Build a census. ... Then optimise
 * the highest-value category first." This is that census, taken from the live
 * scene at a settled camera rather than from the glTF, so what it counts is
 * what the frame actually draws.
 *
 * Per family (the name prefix up to the first digit or underscore group) it
 * reports how many meshes are visible, how many triangles they carry, which
 * materials they use, whether they cast shadows, and — the number that decides
 * whether merging is worth anything — how many DRAW CALLS the family is
 * costing, which for an opaque shadow-casting mesh is two.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const appRequire = createRequire(
  pathToFileURL(path.join(process.cwd(), 'apps/public/package.json')).href,
);
const { chromium } = appRequire('playwright');

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
}
const FRAC = parseFloat(args.get('frac') || '0');
const BASE = args.get('base') || 'http://localhost:3001';

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
  if (!h || !h.renderers.length) return false;
  const gl = h.renderers[h.renderers.length - 1];
  if (gl.__cePatched) return true;
  const orig = gl.render.bind(gl);
  gl.render = function patched(scene, camera) {
    const main = scene && scene.isScene && scene.children && scene.children.length > 2;
    if (main) window.__PAIR__ = { scene, camera };
    const r = orig(scene, camera);
    if (main) {
      const i = gl.info.render;
      window.__DRAW__ = { calls: i.calls, triangles: i.triangles };
    }
    return r;
  };
  gl.__cePatched = true;
  return true;
};

const CENSUS = () => {
  const { scene, camera } = window.__PAIR__;
  const V = scene.position.constructor;
  const box = (() => {
    let B = null;
    scene.traverse((o) => {
      if (B || !o.isMesh || !o.geometry) return;
      o.geometry.computeBoundingBox();
      if (o.geometry.boundingBox) B = o.geometry.boundingBox.constructor;
    });
    return B;
  })();

  camera.updateMatrixWorld();
  const families = new Map();
  let visibleMeshes = 0;
  let visibleTris = 0;

  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    let vis = o.visible;
    let p = o.parent;
    while (vis && p) { vis = p.visible; p = p.parent; }
    if (!vis) return;

    // In frustum? A mesh outside it costs nothing, so a census that counts it
    // overstates every family that happens to be behind the camera.
    let inFrame = true;
    if (box) {
      const b = new box().setFromObject(o);
      if (!b.isEmpty()) {
        const c = b.getCenter(new V());
        const p2 = c.clone().project(camera);
        inFrame = p2.z < 1 && Math.abs(p2.x) < 2.2 && Math.abs(p2.y) < 2.2;
      }
    }

    const g = o.geometry;
    const tris = g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
    const name = o.name || o.type;
    // Family = the name with trailing indices and coordinates stripped.
    const family = name
      .replace(/[-_.]?-?\d+(\.\d+)?$/g, '')
      .replace(/_[-\d.]+_[-\d.]+$/g, '')
      .replace(/_\d+$/g, '') || name;

    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const key = family;
    const row = families.get(key) || {
      family: key,
      meshes: 0,
      inFrame: 0,
      tris: 0,
      trisInFrame: 0,
      materials: new Set(),
      castShadow: 0,
      attrs: new Set(),
    };
    row.meshes += 1;
    row.tris += tris;
    if (inFrame) {
      row.inFrame += 1;
      row.trisInFrame += tris;
      visibleMeshes += 1;
      visibleTris += tris;
    }
    if (o.castShadow) row.castShadow += 1;
    for (const m of mats) if (m) row.materials.add(m.name || m.type);
    row.attrs.add(Object.keys(g.attributes).sort().join(','));
    families.set(key, row);
  });

  const rows = [...families.values()]
    .map((r) => ({
      ...r,
      materials: [...r.materials],
      attrs: [...r.attrs],
      tris: Math.round(r.tris),
      trisInFrame: Math.round(r.trisInFrame),
    }))
    .sort((a, b) => b.inFrame - a.inFrame || b.trisInFrame - a.trisInFrame);

  return {
    draw: window.__DRAW__,
    visibleMeshes,
    visibleTris: Math.round(visibleTris),
    rows: rows.slice(0, 26),
  };
};

const main = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  try {
    const b = page.getByRole('button', { name: /essential only/i });
    await b.waitFor({ state: 'visible', timeout: 6000 });
    await b.click();
  } catch { /* consented */ }
  const locked = await page
    .waitForFunction(() => document.documentElement.style.overflow === 'hidden', undefined,
                     { timeout: 9000 })
    .then(() => true, () => false);
  if (locked) {
    await page.waitForFunction(
      () => document.documentElement.style.overflow !== 'hidden', undefined, { timeout: 60000 });
  }
  await page.evaluate(ATTACH);
  await page.evaluate((f) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.round(f * max));
  }, FRAC);
  await page.waitForTimeout(4000);

  const out = await page.evaluate(CENSUS);
  console.log(`frac ${FRAC}  draw ${JSON.stringify(out.draw)}  visibleMeshes ${out.visibleMeshes}  visibleTris ${out.visibleTris}`);
  console.log('family                    inFrame/meshes   trisInFrame   shadow   materials');
  for (const r of out.rows) {
    console.log(
      `  ${r.family.padEnd(26)} ${String(r.inFrame).padStart(4)}/${String(r.meshes).padEnd(5)}`
      + ` ${String(r.trisInFrame).padStart(9)}   ${String(r.castShadow).padStart(4)}   `
      + r.materials.slice(0, 3).join(', ')
      + (r.attrs.length > 1 ? `  [attrs x${r.attrs.length}]` : ''),
    );
  }
  await browser.close();
};

main().catch((e) => { console.error(e); process.exit(1); });
