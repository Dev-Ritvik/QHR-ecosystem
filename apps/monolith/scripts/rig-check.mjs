// apps/monolith/scripts/rig-check.mjs
//
// Proves the camera MOVES, without a GPU.
//
// The rig is a pure function of q — position = curve(curveT(swing(q))) — so its
// behaviour can be asserted in Node rather than eyeballed in a browser. That is
// not a workaround for the preview pane being unable to composite; it is a
// better test, because it runs in CI on every commit and a human looking at a
// screen does not.
//
// This gate exists because of a specific, expensive failure on apps/public: the
// camera was reported by the client as "completely frozen" across seven
// screenshots while moving perfectly correctly — the scroll track had been
// lengthened without lengthening the path, so travel per screen fell below the
// perceptual floor. Nobody could tell from looking. Numbers could.
//
// THE METRIC IS RELATIVE, NOT ABSOLUTE, and that correction came from this
// gate's own first run.
//
// The initial version asserted metres of travel per 5% of scroll. It failed
// three windows — and inspecting them showed the metric was wrong, not the
// path. This scene spans district scale (690m viewing distance during the
// corridor reveal) down to room scale (2.6m at the final aperture). 0.2m of
// travel is invisible at 690m and is 8% of the frame at 2.6m. An absolute
// floor cannot be right at both ends.
//
// So the measure is travel DIVIDED BY viewing distance — the fraction of the
// subject's own scale the camera covers, which is what the eye actually reads.
//
// Asserts:
//   MOVES        every 5% window covers a real fraction of viewing distance
//   MONOTONIC    curve parameter never goes backwards
//   PAUSE        the Act IV pause is present AND confined to its window
//   ENDPOINTS    q=0 and q=1 land exactly on the first and last beats
//
// Run: node scripts/rig-check.mjs

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

// power2.inOut, transcribed from GSAP. ONE ease across the whole track.
const swing = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function curveT(q) {
  const s = Math.min(1, Math.max(0, q));
  const n = beats.length - 1;
  for (let i = 0; i < n; i += 1) {
    const a = beats[i].at, b = beats[i + 1].at;
    if (s <= b) return (i + (b === a ? 0 : (s - a) / (b - a))) / n;
  }
  return 1;
}

function crSample(pts, t) {
  const n = pts.length;
  const p = (n - 1) * t;
  let i = Math.floor(p), w = p - i;
  if (w === 0 && i === n - 1) { i = n - 2; w = 1; }
  const p0 = i > 0 ? pts[i - 1] : pts[0].map((v, k) => 2 * v - pts[1][k]);
  const p1 = pts[i], p2 = pts[i + 1];
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
    let a = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
    let b = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
    a *= dt1; b *= dt1;
    const c2 = -3 * x1 + 3 * x2 - 2 * a - b;
    const c3 = 2 * x1 - 2 * x2 + a + b;
    out.push(x1 + a * w + c2 * w * w + c3 * w * w * w);
  }
  return out;
}

const P = beats.map((b) => b.p);
// No ease: beats land exactly where their `at` says. See CameraRig.
const cam = (q) => crSample(P, curveT(q));

let failures = 0;

// ── MOVES ────────────────────────────────────────────────────────────────────
const STEP = 0.05;

/** Minimum travel as a fraction of viewing distance, per 5% of scroll.
 *  0.02 = the camera covers 2% of the distance to its subject. Below that the
 *  frame reads as static regardless of scene scale. */
const MIN_REL = 0.02;

/** MASTER_SPEC §5 Act IV: "From 75%-82% scroll, the camera velocity is zero.
 *  The user sits in the Sanctuary." A stall inside this window is the design;
 *  a stall outside it is the bug. */
const PAUSE = [0.75, 0.82];
const inPause = (q) => q > PAUSE[0] - STEP && q <= PAUSE[1] + 1e-9;

const T = beats.map((b) => b.t);
const target = (q) => crSample(T, curveT(q));

const rows = [];
let prev = cam(0);
let worst = { q: 0, rel: Infinity };
let pauseSeen = false;

for (let q = STEP; q <= 1.0001; q += STEP) {
  const qq = Math.min(1, +q.toFixed(6));
  const cur = cam(qq);
  const d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]);
  const tgt = target(qq);
  const view = Math.hypot(cur[0] - tgt[0], cur[1] - tgt[1], cur[2] - tgt[2]) || 1e-6;
  const rel = d / view;

  rows.push({ q: +qq.toFixed(2), d, view, rel, paused: inPause(qq) });
  prev = cur;

  if (inPause(qq)) {
    if (rel < MIN_REL) pauseSeen = true;
    continue;
  }
  if (rel < worst.rel) worst = { q: +qq.toFixed(2), rel };
  if (rel < MIN_REL) {
    console.error(
      `FAIL stall: q≈${qq.toFixed(2)} covers ${(rel * 100).toFixed(1)}% of a ` +
      `${view.toFixed(1)}m viewing distance (min ${(MIN_REL * 100).toFixed(0)}%)`,
    );
    failures += 1;
  }
}

// The pause is load-bearing. If it stops being there, Act IV has lost the beat
// that makes the final push read as a decision rather than a continuation.
if (!pauseSeen) {
  console.error(`FAIL: the Act IV pause (q ${PAUSE[0]}–${PAUSE[1]}) is missing — camera never rests`);
  failures += 1;
}

// ── MONOTONIC ────────────────────────────────────────────────────────────────
let lastU = -1;
for (let i = 0; i <= 400; i += 1) {
  const u = curveT(i / 400);
  if (u < lastU - 1e-9) {
    console.error(`FAIL: curve parameter went backwards at q=${(i / 400).toFixed(3)}`);
    failures += 1;
    break;
  }
  lastU = u;
}

// ── BEAT HIT ─────────────────────────────────────────────────────────────────
// swing() remaps q, so scrolling to a beat's `at` does NOT land on that beat —
// it lands wherever the ease put it. That is intended (the ease shapes
// velocity, the beats shape geometry), but the ENDPOINTS must still be exact or
// the first and last frames are not the ones that were designed.
const first = cam(0), last = cam(1);
const dFirst = Math.hypot(...first.map((v, k) => v - beats[0].p[k]));
const dLast = Math.hypot(...last.map((v, k) => v - beats[beats.length - 1].p[k]));
if (dFirst > 0.01 || dLast > 0.01) {
  console.error(`FAIL endpoints: q=0 off by ${dFirst.toFixed(3)}m, q=1 off by ${dLast.toFixed(3)}m`);
  failures += 1;
}

console.log('   q      travel   viewdist     rel');
for (const r of rows) {
  const bar = '█'.repeat(Math.min(24, Math.round(r.rel * 24)));
  const tag = r.paused ? '  <- designed pause' : '';
  console.log(
    `  ${r.q.toFixed(2)}  ${r.d.toFixed(1).padStart(7)}m  ${r.view.toFixed(1).padStart(7)}m  ` +
    `${(r.rel * 100).toFixed(1).padStart(5)}%  ${bar}${tag}`,
  );
}
console.log(`
  slowest moving window: q=${worst.q} at ${(worst.rel * 100).toFixed(1)}% of viewing distance`);
console.log(`  endpoints exact: q0 ±${dFirst.toFixed(4)}m, q1 ±${dLast.toFixed(4)}m`);
console.log(`\n${failures ? `FAILED (${failures})` : 'RIG OK'}  —  camera demonstrably moves across the whole track`);
process.exit(failures ? 1 : 0);
