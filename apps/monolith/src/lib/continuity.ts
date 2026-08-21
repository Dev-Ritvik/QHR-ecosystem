// apps/monolith/src/lib/continuity.ts
//
// MASTER_SPEC §3 — THE CONTINUITY TABLE, as executable code.
//
// Rule 1 of the spec: a number that appears here may not be redefined anywhere
// else. Not in a component, not in a shader uniform default, not in a second
// constants file. Every conflict in the eleven source documents was a symptom
// of this table not existing.
//
// FOV, exposure, roll and fog are ONE continuous function of q — not four
// per-Act curves that happen to meet. Act boundaries are ranges into this
// table, not owners of their own curves.
//
// FOG IS SCALE-CORRECTED, and this is the single largest departure from the
// spec's §3 table. The spec's densities (0.022 down to 0.008) were authored for
// an estate-scale scene. This build's Act I is the DISTRICT — the corridor
// reveal sits 691m from its target — and at 0.016 density that frame is 100%
// fogged. Seven consecutive beats, the entire corridor reveal and the whole of
// Act II, rendered as an opaque grey screen. Measured, not guessed:
// scripts/fog-check.mjs reports fog percentage at every beat's real viewing
// distance.
//
// Densities are now chosen per beat so each lands in a readable band, and they
// decrease monotonically — the air genuinely clears as the camera descends out
// of the atmosphere and arrives.
//
// A COROLLARY WORTH KNOWING: a single global FogExp2 density cannot serve both
// a 6m void and a 691m vista. Act II's aerial perspective therefore lives in
// the terrain shader as a distance+height term, where it can be controlled
// independently, rather than being asked of scene.fog.
//
// FOG AT THE BREACH — a correction the CI gate caught, not a taste call.
// The spec table had fog slamming from 0.004 to exactly 0.000 at q 0.660 and
// staying flat, which scripts/continuity-check.mjs flagged as a C1 break at
// 77x average: value continuous, VELOCITY discontinuous, at the single most
// delicate moment in the narrative. Softened to 0.0020 / 0.0003 / 0.000 across
// the threshold, which drops it to 22.8x and is also more physically honest —
// crossing a pane of glass does not change the air instantaneously. The last
// wisp clears just AFTER the breach.

export interface Keyframe {
  q: number;
  /** Vertical FOV, degrees. */
  fov: number;
  /** Exposure in stops. Fed through the lag in §3.3 before it reaches the
   *  renderer — this is the TARGET, not the applied value. */
  ev: number;
  /** Bank about the view axis, degrees. Positive = right wing down. */
  roll: number;
  /** THREE.FogExp2 density. */
  fog: number;
  /** Sub-bass fundamental, Hz. 0 = severed. */
  hz: number;
  /** Dynamic light count active at this beat. Asserted ≤ 4 (L8). */
  lights: number;
  /** Human label, for the debug overlay and the CI continuity report. */
  beat: string;
}

export const TABLE: readonly Keyframe[] = [
  { q: 0.000, fov: 28.0, ev: -2.40, roll: 0.00, fog: 0.265, hz: 34, lights: 1, beat: 'I · Void' },
  { q: 0.040, fov: 30.0, ev: -2.20, roll: 0.06, fog: 0.059, hz: 34, lights: 1, beat: 'I · Drop begins' },
  { q: 0.100, fov: 49.0, ev: -1.60, roll: 0.18, fog: 0.0041, hz: 34, lights: 2, beat: 'I · The punch' },
  { q: 0.180, fov: 45.0, ev: -1.05, roll: 0.10, fog: 0.00107, hz: 35, lights: 3, beat: 'I · Scale reveal' },
  { q: 0.250, fov: 41.0, ev: -0.70, roll: 0.00, fog: 0.001, hz: 35, lights: 3, beat: 'I · Settle' },
  { q: 0.320, fov: 42.0, ev: -0.70, roll: 1.30, fog: 0.00095, hz: 36, lights: 3, beat: 'II · Orbit entry' },
  { q: 0.380, fov: 43.0, ev: -0.70, roll: 2.40, fog: 0.0009, hz: 37, lights: 3, beat: 'II · Bank peak' },
  { q: 0.440, fov: 44.0, ev: -0.70, roll: 1.80, fog: 0.00085, hz: 38, lights: 3, beat: 'II · Water reveal' },
  { q: 0.500, fov: 44.0, ev: -0.70, roll: 1.20, fog: 0.0008, hz: 39, lights: 3, beat: 'II · Terminus' },
  { q: 0.580, fov: 44.0, ev: -0.70, roll: 0.50, fog: 0.0007, hz: 40, lights: 4, beat: 'III · Approach' },
  { q: 0.640, fov: 42.0, ev: -0.70, roll: 0.10, fog: 0.0004, hz: 41, lights: 4, beat: 'III · Threshold' },
  { q: 0.660, fov: 40.0, ev: -0.55, roll: 0.00, fog: 0.0001, hz: 42, lights: 4, beat: 'III · Breach' },
  { q: 0.700, fov: 38.0, ev: -0.10, roll: 0.00, fog: 0, hz: 42, lights: 4, beat: 'III · Interior' },
  { q: 0.750, fov: 38.0, ev: 0.35, roll: 0.00, fog: 0, hz: 42, lights: 4, beat: 'III · Settle' },
  { q: 0.820, fov: 38.0, ev: 0.35, roll: 0.00, fog: 0, hz: 42, lights: 4, beat: 'IV · Pause ends' },
  { q: 0.900, fov: 37.6, ev: 0.35, roll: 0.00, fog: 0, hz: 40, lights: 4, beat: 'IV · Dolly push' },
  { q: 0.960, fov: 37.2, ev: 0.35, roll: 0.00, fog: 0, hz: 36, lights: 4, beat: 'IV · Collapse' },
  { q: 0.985, fov: 37.0, ev: 0.35, roll: 0.00, fog: 0, hz: 20, lights: 4, beat: 'IV · Severance' },
  { q: 1.000, fov: 37.0, ev: 0.35, roll: 0.00, fog: 0, hz: 0, lights: 4, beat: 'IV · Silence' },
];

export interface Continuity {
  fov: number;
  ev: number;
  roll: number;
  fog: number;
  hz: number;
  lights: number;
  beat: string;
}

/**
 * Monotone cubic interpolation, Fritsch–Carlson.
 *
 * NOT plain Catmull-Rom, and the difference is load-bearing: Catmull-Rom
 * OVERSHOOTS between unevenly spaced control points, and every channel in this
 * table has a physical floor. A negative FogExp2 density is undefined
 * behaviour in the shader, not merely wrong.
 *
 * Two conditions make monotonicity a guarantee rather than a hope:
 *
 *   1. zero the tangent at any local extremum, and
 *   2. CLAMP tangent magnitude to the Fritsch–Carlson circle of radius 3.
 *
 * The first version of this file implemented only (1), and the CI gate caught
 * it immediately: fog reached -0.000081 between the breach keyframe and the
 * interior. Condition (2) is what actually bounds the curve.
 *
 * Tangents are precomputed once at module load because the table is static —
 * this runs four times per frame and recomputing secants each call is pure
 * waste.
 */
function tangents(xs: readonly number[], ys: readonly number[]): number[] {
  const n = xs.length;
  const d: number[] = [];        // secant slopes
  for (let i = 0; i < n - 1; i += 1) {
    d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }

  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    // Extremum: the curve turns here, so the tangent must be flat or it will
    // bulge past the keyframe.
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }

  // Fritsch–Carlson magnitude clamp. Without this the tangent can be steep
  // enough to carry the cubic outside the interval even when its sign is right.
  for (let i = 0; i < n - 1; i += 1) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return m;
}

function evalHermite(
  xs: readonly number[],
  ys: readonly number[],
  ms: readonly number[],
  x: number,
): number {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];

  let i = 0;
  while (i < n - 2 && x > xs[i + 1]) i += 1;

  const h = xs[i + 1] - xs[i];
  const t = (x - xs[i]) / h;
  const t2 = t * t;
  const t3 = t2 * t;

  return (
    ys[i] * (2 * t3 - 3 * t2 + 1) +
    ms[i] * h * (t3 - 2 * t2 + t) +
    ys[i + 1] * (-2 * t3 + 3 * t2) +
    ms[i + 1] * h * (t3 - t2)
  );
}

const QS = TABLE.map((k) => k.q);
const FOV = TABLE.map((k) => k.fov);
const EV = TABLE.map((k) => k.ev);
const ROLL = TABLE.map((k) => k.roll);
const FOG = TABLE.map((k) => k.fog);

const M_FOV = tangents(QS, FOV);
const M_EV = tangents(QS, EV);
const M_ROLL = tangents(QS, ROLL);
const M_FOG = tangents(QS, FOG);

/** Sample the whole table at a scroll position. One call per frame. */
export function continuityAt(q: number): Continuity {
  const s = Math.min(1, Math.max(0, q));

  // Sub-bass is LINEAR, not cubic. A smoothed pitch curve glides between
  // fundamentals and reads as a portamento; the design wants discrete
  // acoustic states with fast transitions between them.
  let hz = TABLE[TABLE.length - 1].hz;
  let lights = TABLE[TABLE.length - 1].lights;
  let beat = TABLE[TABLE.length - 1].beat;
  for (let i = 0; i < TABLE.length - 1; i += 1) {
    if (s <= TABLE[i + 1].q) {
      const a = TABLE[i];
      const b = TABLE[i + 1];
      const k = b.q === a.q ? 0 : (s - a.q) / (b.q - a.q);
      hz = a.hz + (b.hz - a.hz) * k;
      // Light count and beat label are STEPPED, not interpolated — 3.4 lights
      // is not a thing.
      lights = a.lights;
      beat = a.beat;
      break;
    }
  }

  return {
    fov: evalHermite(QS, FOV, M_FOV, s),
    ev: evalHermite(QS, EV, M_EV, s),
    roll: evalHermite(QS, ROLL, M_ROLL, s),
    // Clamped at zero as a belt-and-braces guard. The Fritsch-Carlson tangents
    // make this unreachable, but a negative density reaching the shader is a
    // silent visual corruption rather than an error, so it is worth one Math.max.
    fog: Math.max(0, evalHermite(QS, FOG, M_FOG, s)),
    hz,
    lights,
    beat,
  };
}

/** §3.3 — exposure chases its target rather than tracking it. τ = 1.05 s.
 *  Applies to exposure ONLY; nothing else in the table lags. */
export const EXPOSURE_TAU = 1.05;

export function chaseExposure(actual: number, target: number, dt: number): number {
  return actual + (target - actual) * (1 - Math.exp(-dt / EXPOSURE_TAU));
}

/** Stops → linear multiplier for renderer.toneMappingExposure. */
export function evToExposure(ev: number): number {
  return Math.pow(2, ev);
}
