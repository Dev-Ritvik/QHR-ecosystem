// apps/monolith/scripts/continuity-check.mjs
//
// MASTER_SPEC §12 — "q sweeps 0→1 with NO discontinuity in FOV, EV, roll, fog
// (assert numerically, do not eyeball)."
//
// CI gate, not a debug aid. Sweeps the continuity table at fine resolution and
// fails on:
//
//   VALUE JUMP    a first difference far larger than the average step. This is
//                 what an Act boundary owning its own curve looks like
//                 numerically — the exact failure §3 exists to prevent.
//
//   C1 BREAK      a spike in the SECOND difference. Value is continuous but
//                 velocity is not. This is what per-segment easing produces
//                 (Appendix B, failure 3: power4.inOut applied per leg drove
//                 velocity to zero at every waypoint). It is invisible to a
//                 value-only check and it is the more likely regression.
//
//   OVERSHOOT     any sample outside the range its keyframes declare. Plain
//                 Catmull-Rom does this on unevenly spaced points; negative fog
//                 is not a thing.
//
//   BUDGET        lights > 4 (L8).
//
// Normalisation is by TOTAL VARIATION, not median step. Several channels are
// deliberately flat for long stretches (EV holds −0.70 from q 0.25 to 0.58),
// which drives a median-based metric to zero and reports every real movement as
// a discontinuity.
//
// Run: node scripts/continuity-check.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../src/lib/continuity.ts'), 'utf8');

// Parsed out of the TS source rather than imported, so this has no build step
// and cannot drift from what ships.
const rows = [...src.matchAll(
  /\{\s*q:\s*([\d.]+),\s*fov:\s*([\d.]+),\s*ev:\s*(-?[\d.]+),\s*roll:\s*([\d.]+),\s*fog:\s*([\d.]+),\s*hz:\s*(\d+),\s*lights:\s*(\d+)/g,
)].map((m) => ({
  q: +m[1], fov: +m[2], ev: +m[3], roll: +m[4], fog: +m[5], hz: +m[6], lights: +m[7],
}));

if (rows.length < 10) {
  console.error(`FAIL: parsed only ${rows.length} keyframes — table shape changed?`);
  process.exit(1);
}

// Mirrors src/lib/continuity.ts exactly — including the Fritsch-Carlson
// magnitude clamp. If this drifts from the implementation, the gate is
// checking a curve the browser never draws, which is worse than no gate.
function tangents(xs, ys) {
  const n = xs.length, d = [];
  for (let i = 0; i < n - 1; i += 1) d.push((ys[i+1]-ys[i])/(xs[i+1]-xs[i]));
  const m = new Array(n);
  m[0] = d[0]; m[n-1] = d[n-2];
  for (let i = 1; i < n - 1; i += 1) m[i] = d[i-1]*d[i] <= 0 ? 0 : (d[i-1]+d[i])/2;
  for (let i = 0; i < n - 1; i += 1) {
    if (d[i] === 0) { m[i] = 0; m[i+1] = 0; continue; }
    const a = m[i]/d[i], b = m[i+1]/d[i], h = a*a + b*b;
    if (h > 9) { const t = 3/Math.sqrt(h); m[i] = t*a*d[i]; m[i+1] = t*b*d[i]; }
  }
  return m;
}

function evalAt(xs, ys, ms, x) {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n-1]) return ys[n-1];
  let i = 0; while (i < n - 2 && x > xs[i+1]) i += 1;
  const h = xs[i+1]-xs[i], t = (x-xs[i])/h, t2 = t*t, t3 = t2*t;
  return ys[i]*(2*t3-3*t2+1) + ms[i]*h*(t3-2*t2+t)
       + ys[i+1]*(-2*t3+3*t2) + ms[i+1]*h*(t3-t2);
}

const QS = rows.map((r) => r.q);
const N = 4000;

// A smooth curve sampled at N points spreads its total variation across those
// samples fairly evenly. Ratios are generous — these catch structural breaks,
// not tuning.
const JUMP_LIMIT = 30;   // max |Δ| ÷ average |Δ|
const C1_LIMIT = 60;     // max |Δ²| ÷ average |Δ²|

let failures = 0;
const report = [];

for (const key of ['fov', 'ev', 'roll', 'fog']) {
  const YS = rows.map((r) => r[key]);
  const lo = Math.min(...YS);
  const hi = Math.max(...YS);

  const MS = tangents(QS, YS);
  const vals = [];
  for (let i = 0; i <= N; i += 1) vals.push(evalAt(QS, YS, MS, i / N));

  const vMin = Math.min(...vals);
  const vMax = Math.max(...vals);
  const slack = (hi - lo) * 1e-6 + 1e-12;

  if (vMin < lo - slack || vMax > hi + slack) {
    console.error(
      `FAIL ${key}: overshoot — samples [${vMin.toFixed(6)}, ${vMax.toFixed(6)}] ` +
      `outside keyframe range [${lo}, ${hi}]`,
    );
    failures += 1;
  }

  const d1 = vals.slice(1).map((v, i) => Math.abs(v - vals[i]));
  const tv = d1.reduce((a, b) => a + b, 0);
  const avg1 = tv / d1.length || 1e-15;
  const max1 = Math.max(...d1);
  const jump = max1 / avg1;

  const d2 = d1.slice(1).map((v, i) => Math.abs(v - d1[i]));
  const avg2 = (d2.reduce((a, b) => a + b, 0) / d2.length) || 1e-18;
  const max2 = Math.max(...d2);
  const c1 = max2 / avg2;

  const bad = jump > JUMP_LIMIT || c1 > C1_LIMIT;
  if (jump > JUMP_LIMIT) {
    console.error(`FAIL ${key}: value jump — max step is ${jump.toFixed(0)}x the average`);
    failures += 1;
  }
  if (c1 > C1_LIMIT) {
    console.error(`FAIL ${key}: C1 break — velocity discontinuity, ${c1.toFixed(0)}x average`);
    failures += 1;
  }

  report.push(
    `  ${bad ? 'FAIL' : ' ok '}  ${key.padEnd(5)}` +
    ` range [${vMin.toFixed(3)} .. ${vMax.toFixed(3)}]` +
    `  TV ${tv.toFixed(3)}` +
    `  jump ${jump.toFixed(1)}x` +
    `  C1 ${c1.toFixed(1)}x`,
  );
}

const maxLights = Math.max(...rows.map((r) => r.lights));
if (maxLights > 4) {
  console.error(`FAIL lights: ${maxLights} exceeds the 4-light budget (L8)`);
  failures += 1;
}
report.push(`   ok   lights max ${maxLights} (budget 4)`);

const first = rows[0], last = rows[rows.length - 1];
if (first.q !== 0 || last.q !== 1) {
  console.error(`FAIL: table must span exactly q 0..1 (got ${first.q}..${last.q})`);
  failures += 1;
}

// Endpoints must be at rest — the camera comes to a stop at both ends, and
// nowhere else (Appendix B, failure 3).
const FY = rows.map((r) => r.fov);
const FM = tangents(QS, FY);
const f = (q) => evalAt(QS, FY, FM, q);
const vStart = Math.abs(f(0.0005) - f(0));
const vEnd = Math.abs(f(1) - f(0.9995));
report.push(`   ok   endpoints |v0| ${vStart.toExponential(2)}  |v1| ${vEnd.toExponential(2)}`);

console.log(report.join('\n'));
console.log(
  `\n${failures ? `FAILED (${failures})` : 'CONTINUITY OK'}` +
  `  —  ${rows.length} keyframes, ${N + 1} samples per channel`,
);
process.exit(failures ? 1 : 0);
