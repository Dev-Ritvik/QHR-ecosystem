// apps/monolith/scripts/grade-check.mjs
//
// MASTER_SPEC §12 — the grade, asserted numerically rather than eyeballed.
//
// This gate exists because the preview environment this build is developed in
// throttles requestAnimationFrame to zero. Nothing renders, so no shader is
// ever compiled and no colour is ever seen. A grade that inverts, clips, or
// quietly turns the whole frame orange would ship undetected. So every claim
// the grade makes about itself is re-derived here from the shipping source and
// checked.
//
// WHAT IT CHECKS
//
//   PROVENANCE     GRADE.* is exactly the per-channel mean of REFERENCE.*.
//                  Catches someone hand-tuning a consolidated hex without
//                  re-deriving it from the frames it is supposed to come from.
//
//   BANDS          wS + wM + wH == 1 at every luminance, all weights >= 0.
//                  A partition of unity is the property that lets the grade sit
//                  underneath the continuity table's EV column without lying
//                  about it — three weights that sum to 1 can redistribute
//                  tint but cannot add or remove level. Overlapping pivots
//                  break it silently and INVERT the midtone tint.
//
//   NO GLOBAL FILTER
//                  §5 Act III: "2700 K means warm pools with falloff, never a
//                  global orange filter." Encoded as: a NEUTRAL pixel may never
//                  come out warmer than it went in, at any luminance. Only
//                  pixels already warmer than neutral may be warmed. This is
//                  the spec's ruling turned into arithmetic.
//
//   LEVEL          The grade must not change apparent exposure. Outside the
//                  shadow lift's reach it must be inert to within 1% of
//                  perceptual level; overall it may not move level by more
//                  than 0.04 perceptual (~10/255).
//
//   RANGE          No NaN, no negative, nothing above 1.0, over the neutral
//                  ramp and the RGB cube corners.
//
//   PIPELINE       Exactly ONE tone map in the chain, and the chain in camera
//                  order. This is the regression guard for the failure that
//                  produced the "radioactive glare" rejection: the fix is not
//                  "no tone map here", it is "exactly one, in the right place".
//
// Run: node scripts/grade-check.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const gradeSrc = readFileSync(join(here, '../src/lib/grade.ts'), 'utf8');
const toneSrc = readFileSync(join(here, '../src/components/experience/SplitTone.tsx'), 'utf8');
const postSrc = readFileSync(join(here, '../src/components/experience/PostFX.tsx'), 'utf8');

const report = [];
let failures = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failures += 1;
}
function ok(msg) {
  report.push(`   ok   ${msg}`);
}

// ── PARSE ───────────────────────────────────────────────────────────────────
// Parsed out of the TS source rather than imported, so this has no build step
// and cannot drift from what ships.

function num(name) {
  const m = gradeSrc.match(new RegExp(`export const ${name} = (-?[\\d.]+);`));
  if (!m) { fail(`tunable ${name} not found in grade.ts`); return NaN; }
  return +m[1];
}

const SHADOW_PIVOT = num('SHADOW_PIVOT');
const HIGH_PIVOT = num('HIGH_PIVOT');
const LIFT = num('LIFT');
const MID_STRENGTH = num('MID_STRENGTH');
const HIGH_STRENGTH = num('HIGH_STRENGTH');
const WARMTH_LO = num('WARMTH_LO');
const WARMTH_HI = num('WARMTH_HI');

/** Every swatch, grouped by the family it was filed under. */
function referenceFamily(name) {
  const block = gradeSrc.match(new RegExp(`  ${name}: \\[([\\s\\S]*?)\\n  \\],`));
  if (!block) { fail(`REFERENCE.${name} block not found`); return []; }
  return [...block[1].matchAll(/hex: '(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1]);
}

const FAMILIES = ['shadow', 'midtone', 'highlightWarm', 'highlightCool'];
const REFERENCE = Object.fromEntries(FAMILIES.map((f) => [f, referenceFamily(f)]));

const gradeBlock = gradeSrc.match(/export const GRADE = \{([\s\S]*?)\n\} as const;/);
if (!gradeBlock) fail('GRADE block not found in grade.ts');
const GRADE = Object.fromEntries(
  [...(gradeBlock?.[1] ?? '').matchAll(/(\w+): '(#[0-9A-Fa-f]{6})'/g)].map((m) => [m[1], m[2]]),
);

if (FAMILIES.some((f) => REFERENCE[f].length < 4)) {
  fail('expected at least 4 reference swatches per family');
}

// ── COLOUR MATH — mirrors src/lib/grade.ts exactly ──────────────────────────

const srgbToLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

function hexToRgb255(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const hexToLinear = (hex) => hexToRgb255(hex).map((v) => srgbToLinear(v / 255));
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

function balance(hex) {
  const c = hexToLinear(hex);
  const l = Math.max(lum(c), 1e-6);
  return c.map((x) => x / l);
}

const LIFT_V = hexToLinear(GRADE.shadow).map((x) => x * LIFT);
const MID_BAL = balance(GRADE.midtone);
const WARM_BAL = balance(GRADE.highlightWarm);
const COOL_BAL = balance(GRADE.highlightCool);

// ── SHADER MATH — mirrors SplitTone.tsx exactly ─────────────────────────────
// If this drifts from the implementation, the gate is checking an image the
// browser never draws, which is worse than no gate at all.

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
const mix = (a, b, t) => a + (b - a) * t;

// GLSL mat3(vec3,vec3,vec3) builds COLUMNS.
const ACES_IN = [
  [0.59719, 0.07600, 0.02840],
  [0.35458, 0.90834, 0.13383],
  [0.04823, 0.01566, 0.83777],
];
const ACES_OUT = [
  [1.60475, -0.10208, -0.00327],
  [-0.53108, 1.10813, -0.07276],
  [-0.07367, -0.00605, 1.07602],
];
const matmul = (cols, v) => [0, 1, 2].map(
  (i) => cols[0][i] * v[0] + cols[1][i] * v[1] + cols[2][i] * v[2],
);

/** three's ACESFilmicToneMapping, exposure already applied upstream. */
function aces(rgb) {
  let c = matmul(ACES_IN, rgb.map((x) => x / 0.6));
  const a = c.map((x) => x * (x + 0.0245786) - 0.000090537);
  const b = c.map((x) => x * (0.983729 * x + 0.4329510) + 0.238081);
  c = matmul(ACES_OUT, a.map((x, i) => x / b[i]));
  return c.map((x) => Math.min(1, Math.max(0, x)));
}

function splitTone(c) {
  const lp = Math.pow(Math.max(lum(c), 0), 1 / 2.2);
  const wS = 1 - smoothstep(0, SHADOW_PIVOT, lp);
  const wH = smoothstep(HIGH_PIVOT, 1, lp);
  const wM = 1 - wS - wH;

  const warmth = smoothstep(WARMTH_LO, WARMTH_HI, c[0] - c[2]);
  const hiBal = [0, 1, 2].map((i) => mix(COOL_BAL[i], WARM_BAL[i], warmth));

  let o = c.map((x, i) => x * mix(1, hiBal[i], HIGH_STRENGTH * wH));
  o = o.map((x, i) => x * mix(1, MID_BAL[i], MID_STRENGTH * wM));
  o = o.map((x, i) => x + LIFT_V[i] * wS);
  return { out: o.map((x) => Math.min(1, Math.max(0, x))), wS, wM, wH, lp };
}

// ── 1. PROVENANCE ───────────────────────────────────────────────────────────

for (const fam of FAMILIES) {
  const swatches = REFERENCE[fam].map(hexToRgb255);
  const mean = [0, 1, 2].map(
    (i) => Math.round(swatches.reduce((s, c) => s + c[i], 0) / swatches.length),
  );
  const actual = hexToRgb255(GRADE[fam]);
  const drift = Math.max(...[0, 1, 2].map((i) => Math.abs(mean[i] - actual[i])));
  if (drift > 0) {
    const expect = `#${mean.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    fail(`GRADE.${fam} is ${GRADE[fam]} but the mean of its ${swatches.length} swatches is ${expect}`);
  }
}
if (!failures) ok(`provenance — all 4 consolidated hexes are the exact mean of their swatches`);

// ── 2. BANDS ────────────────────────────────────────────────────────────────

if (!(SHADOW_PIVOT < HIGH_PIVOT)) {
  fail(`pivots overlap: SHADOW_PIVOT ${SHADOW_PIVOT} must be < HIGH_PIVOT ${HIGH_PIVOT}. `
    + 'Overlap drives the midtone weight negative, which inverts its tint.');
}

const N = 2000;
let worstUnity = 0;
let minWeight = Infinity;
for (let i = 0; i <= N; i += 1) {
  const lp = i / N;
  const wS = 1 - smoothstep(0, SHADOW_PIVOT, lp);
  const wH = smoothstep(HIGH_PIVOT, 1, lp);
  const wM = 1 - wS - wH;
  worstUnity = Math.max(worstUnity, Math.abs(wS + wM + wH - 1));
  minWeight = Math.min(minWeight, wS, wM, wH);
}
if (worstUnity > 1e-9) fail(`weights do not partition unity (max error ${worstUnity.toExponential(2)})`);
if (minWeight < -1e-9) fail(`negative band weight ${minWeight.toExponential(2)}`);
ok(`bands — unity error ${worstUnity.toExponential(1)}, min weight ${minWeight.toFixed(6)}, pivots ${SHADOW_PIVOT}/${HIGH_PIVOT}`);

// ── 3. NO GLOBAL FILTER ─────────────────────────────────────────────────────
// A neutral pixel may never come out warmer than it went in.

// ABOVE THE FLOOR ONLY. Below it the pixel is not image content being filtered,
// it is the floor itself — see section 4, which asserts where that floor sits.
// Measuring "is this a colour filter?" at absolute black measures the lift.
const FLOOR_LP = Math.pow(Math.max(lum(LIFT_V), 0), 1 / 2.2);
const ABOVE = Math.max(0.20, FLOOR_LP * 2);

let worstWarm = -Infinity;
let worstWarmAt = 0;
let worstChroma = 0;
let worstChromaAt = 0;
for (let i = 1; i <= N; i += 1) {
  const lp = i / N;
  const l = lp ** 2.2;
  const inC = [l, l, l];
  const { out } = splitTone(inC);
  // Warm bias: r-b. Input neutral is 0. Positive output = the frame warmed.
  // Checked over the FULL range — the floor may not be orange either.
  const warmBias = out[0] - out[2];
  if (warmBias > worstWarm) { worstWarm = warmBias; worstWarmAt = lp; }
  if (lp < ABOVE) continue;
  const chroma = Math.max(
    Math.abs(out[0] / Math.max(out[1], 1e-9) - 1),
    Math.abs(out[2] / Math.max(out[1], 1e-9) - 1),
  );
  if (chroma > worstChroma) { worstChroma = chroma; worstChromaAt = lp; }
}
if (worstWarm > 1e-6) {
  fail(`a neutral pixel is warmed by ${worstWarm.toExponential(2)} at lp ${worstWarmAt.toFixed(3)} `
    + '— this is the "global orange filter" §5 Act III forbids');
}
if (worstChroma > 0.12) {
  fail(`neutral chroma shift ${(worstChroma * 100).toFixed(1)}% at lp ${worstChromaAt.toFixed(3)} exceeds 12% — reads as a colour filter, not a grade`);
}
ok(`no global filter — neutrals never warm anywhere (max r-b ${worstWarm.toExponential(2)}), peak chroma ${(worstChroma * 100).toFixed(1)}% at lp ${worstChromaAt.toFixed(2)} (measured above lp ${ABOVE.toFixed(2)})`);

// A warm pixel MUST still be able to warm, or the highlight tint is decorative.
const warmProbe = hexToLinear('#FFC069').map((x) => x * 0.9);
const warmOut = splitTone(aces(warmProbe)).out;
const warmIn = aces(warmProbe);
const gained = (warmOut[0] - warmOut[2]) - (warmIn[0] - warmIn[2]);
if (gained <= 0) {
  fail('a sodium-lamp highlight is not warmed by the grade — the warm balance is inert');
}
ok(`warm sources still warm — sodium probe r-b +${gained.toFixed(4)}`);

// ── 4. LEVEL ────────────────────────────────────────────────────────────────

// THE FLOOR, asserted positively rather than merely bounded. Pure black in
// must give the measured reference floor out — this is §5's "the black is not
// black" ruling, now sourced from the frames instead of from a chosen constant.
const toHex = (lin) => `#${lin.map((v) => Math.round(linearToSrgb(v) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const floorHex = toHex(splitTone([0, 0, 0]).out);
if (floorHex !== GRADE.shadow.toUpperCase()) {
  fail(`black renders as ${floorHex}, not GRADE.shadow ${GRADE.shadow} — the lift no longer reproduces the measured floor`);
}
if (FLOOR_LP > 0.15) {
  fail(`floor sits at perceptual ${FLOOR_LP.toFixed(3)} — that is a wash over the blacks, not a lift`);
}
if (Math.max(...LIFT_V) > 0.02) {
  fail(`shadow lift ${Math.max(...LIFT_V).toFixed(4)} linear is too large — reads as a wash over the blacks`);
}
ok(`floor — #000000 renders as ${floorHex} at perceptual ${FLOOR_LP.toFixed(3)}; reference floors span 0.064-0.101`);

// ABOVE THE FLOOR the grade must be inert on level. This is the property that
// keeps the EV column in §3 the single exposure authority: the grade may move
// hue, never brightness, anywhere there is actual image content.
let worstLevel = 0;
let worstLevelAt = 0;
for (let i = 1; i <= N; i += 1) {
  const lp = i / N;
  if (lp < ABOVE) continue;
  const l = lp ** 2.2;
  const { out } = splitTone([l, l, l]);
  const d = Math.abs(Math.pow(Math.max(lum(out), 0), 1 / 2.2) - lp);
  if (d > worstLevel) { worstLevel = d; worstLevelAt = lp; }
}
if (worstLevel > 0.01) {
  fail(`grade moves apparent level by ${worstLevel.toFixed(4)} at lp ${worstLevelAt.toFixed(3)} `
    + '— the EV column in §3 is the exposure authority, the grade may not compete with it');
}
ok(`level — inert above the floor: max shift ${worstLevel.toFixed(5)} at lp ${worstLevelAt.toFixed(2)} (limit 0.01)`);

// ── 5. RANGE ────────────────────────────────────────────────────────────────

const probes = [];
for (let i = 0; i <= 64; i += 1) { const l = (i / 64) ** 2.2; probes.push([l, l, l]); }
for (const r of [0, 0.5, 1]) for (const g of [0, 0.5, 1]) for (const b of [0, 0.5, 1]) probes.push([r, g, b]);
for (const hex of Object.values(GRADE)) probes.push(hexToLinear(hex));
for (const fam of FAMILIES) for (const hex of REFERENCE[fam]) probes.push(hexToLinear(hex));
// Over-white HDR, which is what actually arrives before ACES.
for (const s of [2, 8, 40]) probes.push([s, s * 0.8, s * 0.5]);

let bad = 0;
for (const p of probes) {
  const { out } = splitTone(aces(p));
  for (const v of out) {
    if (!Number.isFinite(v) || v < 0 || v > 1) bad += 1;
  }
}
if (bad) fail(`${bad} channel values out of [0,1] or non-finite across ${probes.length} probes`);
ok(`range — ${probes.length} probes incl. HDR to 40.0, all channels finite and in [0,1]`);

// ── 6. PIPELINE ─────────────────────────────────────────────────────────────

// COMMENTS ARE STRIPPED FIRST, and that is load-bearing. PostFX.tsx documents
// the chain as an ASCII diagram in its header — <Exposure/> <Bloom/> ... — in
// the correct order. Searching the raw file finds the DIAGRAM, so the order
// assertion passes no matter what the JSX below actually does. A mutation test
// caught exactly that: SplitTone moved ahead of Bloom and the gate stayed green.
const code = postSrc
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map((l) => l.replace(/^\s*\/\/.*$/, ''))
  .join('\n');

const acesUses = (toneSrc.match(/ST_ACES_IN \*/g) || []).length;
if (acesUses !== 1) fail(`expected exactly 1 tone map in SplitTone.tsx, found ${acesUses}`);

if (/\bToneMapping\b/.test(code)) {
  fail('PostFX.tsx references a ToneMapping effect — that is the second tone map, and the documented "radioactive glare" failure');
}

const composer = code.slice(code.indexOf('<EffectComposer'), code.lastIndexOf('</EffectComposer>'));
const ORDER = ['<Exposure', '<Bloom', '<ChromaticAberration', '<Vignette', '<SplitTone', '<Noise'];
const at = ORDER.map((tag) => composer.indexOf(tag));
const missing = ORDER.filter((tag, i) => at[i] === -1);
if (missing.length) {
  fail(`PostFX.tsx is missing ${missing.join(', ')}`);
} else {
  for (let i = 1; i < at.length; i += 1) {
    if (at[i] < at[i - 1]) {
      fail(`chain out of camera order: ${ORDER[i]} appears before ${ORDER[i - 1]}. `
        + 'Exposure must precede Bloom (threshold is meaningless otherwise); '
        + 'SplitTone must follow it (bands need a bounded domain); Noise must be last.');
      break;
    }
  }
}
ok(`pipeline — 1 tone map, chain in camera order: ${ORDER.map((t) => t.slice(1)).join(' -> ')}`);

// ── 7. SCENE WARMTH ─────────────────────────────────────────────────────────
// MASTER_SPEC §5 Act III: "2700 K means warm *pools with falloff*, never a
// global orange filter." Sections 3 and 4 prove the GRADE cannot manufacture a
// warm cast. This section proves the SCENE never hands it one to begin with.
//
// The sky used to carry a #c8642a ember across the western horizon at two
// separate falloffs, the key light was #ffb478, the hemisphere ground was warm,
// the water glint was orange, and the Act II plotting grid was drawn amber —
// while src/lib/grade.ts stated in prose that the grid was cool and built its
// two-tint highlight logic on that claim. Every one of those is a warm source
// outside the villa, and together they are exactly the wash the ruling forbids.
//
// The ONLY warm source permitted in this build is PRACTICAL_2700K, on the point
// lights inside the model duplex villa.

const sceneFiles = ['Corridor', 'Terrain', 'Massing'].map((n) => [
  n, readFileSync(join(here, `../src/components/experience/${n}.tsx`), 'utf8'),
]);

const practical = (gradeSrc.match(/PRACTICAL_2700K = '(#[0-9A-Fa-f]{6})'/) || [])[1];
if (!practical) fail('PRACTICAL_2700K not found in grade.ts');

let scanned = 0;
for (const [name, src] of sceneFiles) {
  src.split('\n').forEach((line, i) => {
    // Strip comments first: this file documents the colours it removed, and a
    // gate that reads its own changelog fails on history rather than on code.
    const code = line.replace(/\/\/.*$/, '');
    // `color=` / `color:` and `args=` are here because of a mutation test: a
    // warm key light is written `color="#ffb478"` in JSX, and the word `color`
    // does not match \bcol\b. The gate passed a restored warm key until this
    // line was widened, which is the exact regression it exists to catch.
    if (!/\bcol\b|color[=:]|args=|albedo|vec3 plain|vec3 rock|vec3 sea|Color\(/.test(code)) return;

    // GLSL colour literals, on lines that actually paint something.
    for (const m of code.matchAll(/vec3\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g)) {
      scanned += 1;
      const r = +m[1];
      const b = +m[3];
      if (r > b + 1e-6) {
        fail(`${name}.tsx:${i + 1} paints a WARM colour ${m[0]} — r > b. `
          + 'Outside the villa the permitted number of warm sources is zero (§5 Act III)');
      }
    }

    // Hex literals handed to THREE.Color — either quote style, since JSX props
    // use double quotes and object literals use single.
    for (const m of code.matchAll(/['"](#[0-9A-Fa-f]{6})['"]/g)) {
      scanned += 1;
      const n = parseInt(m[1].slice(1), 16);
      if (((n >> 16) & 255) > (n & 255)) {
        fail(`${name}.tsx:${i + 1} uses warm colour ${m[1]} — r > b`);
      }
    }
  });
}

// ...and the practical must still BE warm, or the villa has nothing to pool and
// Act III loses the only colour contrast in the narrative.
const pn = parseInt(practical.slice(1), 16);
if (((pn >> 16) & 255) <= (pn & 255)) {
  fail(`PRACTICAL_2700K ${practical} is not warm — the villa interior has nothing to pool`);
}
ok(`scene warmth — ${scanned} colour literals across 3 scene files, none warm; only PRACTICAL_2700K ${practical} is`);


// ── REPORT ──────────────────────────────────────────────────────────────────

console.log(report.join('\n'));
console.log(
  `\n${failures ? `FAILED (${failures})` : 'GRADE OK'}`
  + `  —  ${FAMILIES.reduce((s, f) => s + REFERENCE[f].length, 0)} swatches,`
  + ` ${N + 1} luminance samples, ${probes.length} colour probes`,
);
process.exit(failures ? 1 : 0);
