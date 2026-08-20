// apps/monolith/scripts/path-check.mjs
//
// MASTER_SPEC L7 — "≥ 12 m of camera travel per viewport of scroll."
//
// This gate exists because the failure it prevents already shipped. On
// apps/public a scroll track was lengthened 6x to fix pacing while the camera
// path was left at its original length. Travel per screen dropped to a sixth
// and the camera was reported by the client as completely frozen — while
// moving perfectly correctly. Acts defined in percentages give NO protection
// against this: percentages are scale-free, and the bug is entirely about
// scale.
//
// Also asserts the beats themselves are sane: monotonically increasing `at`,
// spanning exactly 0..1, and no zero-length leg (which makes the curve
// parameterisation degenerate).
//
// Run: node scripts/path-check.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../src/lib/cameraPath.ts'), 'utf8');

const beats = [...src.matchAll(
  /at:\s*([\d.]+),\s*position:\s*\[([^\]]+)\],\s*target:\s*\[([^\]]+)\]/g,
)].map((m) => ({
  at: +m[1],
  p: m[2].split(',').map(Number),
  t: m[3].split(',').map(Number),
}));

if (beats.length < 8) {
  console.error(`FAIL: parsed only ${beats.length} beats — file shape changed?`);
  process.exit(1);
}

let failures = 0;

// ── Beat sanity ──────────────────────────────────────────────────────────────
if (beats[0].at !== 0 || beats[beats.length - 1].at !== 1) {
  console.error(`FAIL: beats must span exactly 0..1 (got ${beats[0].at}..${beats[beats.length - 1].at})`);
  failures += 1;
}
for (let i = 1; i < beats.length; i += 1) {
  if (beats[i].at <= beats[i - 1].at) {
    console.error(`FAIL: beat ${i} at=${beats[i].at} does not increase past ${beats[i - 1].at}`);
    failures += 1;
  }
}

// ── Centripetal Catmull-Rom, transcribed from three.js ───────────────────────
// Same reasoning as the continuity gate: approximating the curve here would
// audit a path the browser never takes.
function crSample(pts, t) {
  const n = pts.length;
  const p = (n - 1) * t;
  let i = Math.floor(p);
  let w = p - i;
  if (w === 0 && i === n - 1) { i = n - 2; w = 1; }

  const p0 = i > 0 ? pts[i - 1] : pts[0].map((v, k) => 2 * v - pts[1][k]);
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = i + 2 < n ? pts[i + 2] : pts[n - 1].map((v, k) => 2 * v - pts[n - 2][k]);

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let dt0 = Math.pow(dist(p0, p1), 0.25);
  let dt1 = Math.pow(dist(p1, p2), 0.25);
  let dt2 = Math.pow(dist(p2, p3), 0.25);
  if (dt1 < 1e-4) dt1 = 1;
  if (dt0 < 1e-4) dt0 = dt1;
  if (dt2 < 1e-4) dt2 = dt1;

  const out = [];
  for (let k = 0; k < 3; k += 1) {
    const x0 = p0[k], x1 = p1[k], x2 = p2[k], x3 = p3[k];
    let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
    let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
    t1 *= dt1; t2 *= dt1;
    const c0 = x1, c1 = t1;
    const c2 = -3 * x1 + 3 * x2 - 2 * t1 - t2;
    const c3 = 2 * x1 - 2 * x2 + t1 + t2;
    const w2 = w * w;
    out.push(c0 + c1 * w + c2 * w2 + c3 * w2 * w);
  }
  return out;
}

const P = beats.map((b) => b.p);
const N = 4000;
let arc = 0;
let prev = crSample(P, 0);
let maxStep = 0;
for (let i = 1; i <= N; i += 1) {
  const cur = crSample(P, i / N);
  const d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]);
  arc += d;
  if (d > maxStep) maxStep = d;
  prev = cur;
}

// §3.4 — 1000vh desktop, 800vh mobile.
const VIEWPORTS_DESKTOP = 10;
const VIEWPORTS_MOBILE = 8;
const LIMIT = 12;

const perDesktop = arc / VIEWPORTS_DESKTOP;
const perMobile = arc / VIEWPORTS_MOBILE;

console.log(`  arc length          ${arc.toFixed(1)} m`);
console.log(`  desktop (1000vh)    ${perDesktop.toFixed(1)} m/viewport   (min ${LIMIT})`);
console.log(`  mobile  (800vh)     ${perMobile.toFixed(1)} m/viewport   (min ${LIMIT})`);

if (perDesktop < LIMIT) {
  console.error(`FAIL L7: desktop travel ${perDesktop.toFixed(1)} m/viewport is below ${LIMIT}`);
  failures += 1;
}
if (perMobile < LIMIT) {
  console.error(`FAIL L7: mobile travel ${perMobile.toFixed(1)} m/viewport is below ${LIMIT}`);
  failures += 1;
}

// A curve that bulges hard between two beats produces a huge single step. On a
// centripetal spline over uneven legs this is the overshoot signature.
const avgStep = arc / N;
const bulge = maxStep / avgStep;
console.log(`  max step / avg      ${bulge.toFixed(1)}x`);
if (bulge > 25) {
  console.error(`FAIL: curve bulges ${bulge.toFixed(0)}x average between beats — overshoot`);
  failures += 1;
}

console.log(
  `\n${failures ? `FAILED (${failures})` : 'PATH OK'}  —  ${beats.length} beats, ${N} samples`,
);
process.exit(failures ? 1 : 0);
