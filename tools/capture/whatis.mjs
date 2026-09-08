/**
 * PHASE 6B — "what is that thing in the frame".
 *
 *   node tools/capture/whatis.mjs --frac 0.4974 --rect 40,470,330,620
 *
 * Settles at a scroll fraction, then lists every visible mesh whose projected
 * screen box overlaps a rectangle of the frame, nearest first, with its
 * material and how much of the rectangle it covers.
 *
 * Written because an unexplained black slab was sitting in the interior
 * establishing shot and three plausible explanations (a hologram plate seen
 * edge-on, an unlit wall panel, a shadow) were all consistent with the picture.
 * Guessing which costs a rebuild each time; asking the scene costs one run.
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
const FRAC = parseFloat(args.get('frac') || '0.4974');
const RECT = (args.get('rect') || '0,0,1440,900').split(',').map(Number);
// --at x,y[;x,y...] raycasts through frame pixels instead of comparing bounding
// boxes. The box comparison was written first and is useless here: a mesh that
// straddles the camera projects to a box thousands of pixels wide, so every
// large object 'overlaps' every rectangle. A ray answers the actual question.
const AT = (args.get('at') || '').split(';').filter(Boolean)
  .map((p2) => p2.split(',').map(Number));
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
  if (!h || !h.renderers.length) return { ok: false };
  const gl = h.renderers[h.renderers.length - 1];
  if (!gl.__probePatched) {
    const orig = gl.render.bind(gl);
    gl.render = function patched(scene, camera) {
      if (scene && scene.isScene && scene.children && scene.children.length > 2) {
        window.__PROBE_PAIR__ = { scene, camera };
      }
      return orig(scene, camera);
    };
    gl.__probePatched = true;
  }
  return { ok: true };
};

const SETTLE = async (frac) => {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  window.scrollTo(0, Math.round(frac * max));
  const t0 = performance.now();
  let last = null;
  let stable = 0;
  while (performance.now() - t0 < 25000) {
    await new Promise((r) => requestAnimationFrame(r));
    const p = window.__PROBE_PAIR__;
    if (!p || !p.camera) continue;
    const c = p.camera.position;
    if (last) {
      const d = Math.hypot(c.x - last[0], c.y - last[1], c.z - last[2]);
      stable = d < 0.0005 ? stable + 1 : 0;
    }
    last = [c.x, c.y, c.z];
    if (stable >= 45) break;
  }
  return { frac: +(window.scrollY / max).toFixed(4) };
};

const LIST = (rect) => {
  const { scene, camera } = window.__PROBE_PAIR__;
  const Vector3 = scene.position.constructor;
  let Box3 = null;
  scene.traverse((o) => {
    if (!Box3 && o.isMesh && o.geometry) {
      o.geometry.computeBoundingBox();
      if (o.geometry.boundingBox) Box3 = o.geometry.boundingBox.constructor;
    }
  });
  const W = window.innerWidth;
  const H = window.innerHeight;
  const out = [];
  const v = new Vector3();
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    let vis = o.visible;
    let p = o.parent;
    while (vis && p) { vis = p.visible; p = p.parent; }
    if (!vis) return;
    const box = new Box3().setFromObject(o);
    if (box.isEmpty()) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let near = Infinity;
    let front = false;
    for (let i = 0; i < 8; i += 1) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y,
            i & 4 ? box.max.z : box.min.z);
      const world = v.clone();
      v.project(camera);
      if (v.z < 1) front = true;
      near = Math.min(near, world.distanceTo(camera.position));
      const x = (v.x * 0.5 + 0.5) * W;
      const y = (-v.y * 0.5 + 0.5) * H;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (!front) return;
    const ox = Math.min(maxX, rect[2]) - Math.max(minX, rect[0]);
    const oy = Math.min(maxY, rect[3]) - Math.max(minY, rect[1]);
    if (ox <= 0 || oy <= 0) return;
    const area = (rect[2] - rect[0]) * (rect[3] - rect[1]);
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    out.push({
      name: o.name || o.type,
      material: m ? (m.name || m.type) : null,
      blending: m ? m.blending : null,
      transparent: m ? m.transparent : null,
      emissive: m && m.emissive ? '#' + m.emissive.getHexString() : null,
      emissiveIntensity: m ? m.emissiveIntensity : null,
      colour: m && m.color ? '#' + m.color.getHexString() : null,
      dist: +near.toFixed(2),
      cover: +((ox * oy) / area).toFixed(3),
      box: [minX, minY, maxX, maxY].map(Math.round),
    });
  });
  out.sort((a, b) => b.cover - a.cover || a.dist - b.dist);
  return out.slice(0, 24);
};

const PICK = (points) => {
  const { scene, camera } = window.__PROBE_PAIR__;
  const Vector2 = scene.position.constructor === undefined ? null : null;
  void Vector2;
  const W = window.innerWidth;
  const H = window.innerHeight;
  // Raycaster is not on window either; take it from the app's own three by
  // walking a known object's constructor chain is not possible, so build the
  // ray by hand from the camera's matrices, which needs only Vector3.
  const V3 = scene.position.constructor;
  const out = [];
  const meshes = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    let vis = o.visible;
    let p = o.parent;
    while (vis && p) { vis = p.visible; p = p.parent; }
    if (vis) meshes.push(o);
  });
  for (const [px, py] of points) {
    const ndc = new V3(((px / W) * 2) - 1, -(((py / H) * 2) - 1), 0.5);
    ndc.unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    // Triangle-accurate hit test, walking each geometry's index buffer.
    let best = null;
    const a = new V3(); const b = new V3(); const c = new V3();
    const e1 = new V3(); const e2 = new V3(); const pv = new V3();
    const tv = new V3(); const qv = new V3();
    for (const m of meshes) {
      const g = m.geometry;
      const pos = g.attributes && g.attributes.position;
      if (!pos) continue;
      const idx = g.index;
      const count = idx ? idx.count : pos.count;
      if (count > 200000) continue;
      for (let i = 0; i < count; i += 3) {
        const i0 = idx ? idx.getX(i) : i;
        const i1 = idx ? idx.getX(i + 1) : i + 1;
        const i2 = idx ? idx.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld);
        b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld);
        c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
        e1.subVectors(b, a); e2.subVectors(c, a);
        pv.crossVectors(dir, e2);
        const det = e1.dot(pv);
        if (Math.abs(det) < 1e-9) continue;
        const inv = 1 / det;
        tv.subVectors(camera.position, a);
        const u = tv.dot(pv) * inv;
        if (u < 0 || u > 1) continue;
        qv.crossVectors(tv, e1);
        const v = dir.dot(qv) * inv;
        if (v < 0 || u + v > 1) continue;
        const t = e2.dot(qv) * inv;
        if (t <= 0.01) continue;
        if (!best || t < best.t) best = { t, m };
      }
    }
    if (!best) { out.push({ px, py, hit: null }); continue; }
    const mat = Array.isArray(best.m.material) ? best.m.material[0] : best.m.material;
    out.push({
      px, py,
      hit: best.m.name || best.m.type,
      dist: +best.t.toFixed(2),
      material: mat ? (mat.name || mat.type) : null,
      colour: mat && mat.color ? '#' + mat.color.getHexString() : null,
      emissive: mat && mat.emissive ? '#' + mat.emissive.getHexString() : null,
      emissiveIntensity: mat ? mat.emissiveIntensity : null,
      lightMap: !!(mat && mat.lightMap),
      map: !!(mat && mat.map),
      blending: mat ? mat.blending : null,
      transparent: mat ? mat.transparent : null,
      opacity: mat ? mat.opacity : null,
      metalness: mat ? mat.metalness : null,
      roughness: mat ? mat.roughness : null,
    });
  }
  return out;
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
    .waitForFunction(() => document.documentElement.style.overflow === 'hidden',
                     undefined, { timeout: 9000 })
    .then(() => true, () => false);
  if (locked) {
    await page.waitForFunction(
      () => document.documentElement.style.overflow !== 'hidden', undefined, { timeout: 60000 });
  }
  await page.evaluate(ATTACH);
  await page.waitForTimeout(600);
  const s = await page.evaluate(SETTLE, FRAC);
  await page.waitForTimeout(1500);
  if (AT.length) {
    const picks = await page.evaluate(PICK, AT);
    console.log('settled at', s.frac);
    for (const p2 of picks) console.log('  ', JSON.stringify(p2));
    await browser.close();
    return;
  }
  const list = await page.evaluate(LIST, RECT);
  console.log('settled at', s.frac, 'rect', RECT.join(','));
  for (const r of list) {
    console.log(
      `  cover ${String(r.cover).padStart(5)}  d ${String(r.dist).padStart(6)}  ${r.name}`
      + `  [${r.material}] blend=${r.blending} transp=${r.transparent}`
      + ` emissive=${r.emissive}x${r.emissiveIntensity} colour=${r.colour} box=${r.box}`,
    );
  }
  await browser.close();
};

main().catch((e) => { console.error(e); process.exit(1); });
