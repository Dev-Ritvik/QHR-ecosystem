/**
 * PHASE 6B — framing solver.
 *
 *   node tools/capture/frame_solve.mjs
 *
 * Projects the estate's MEASURED bounds through a candidate camera and prints
 * where each subject lands on a 1440x900 frame. No browser, no build, no
 * screenshot — so a pose can be argued about in numbers before it costs four
 * minutes of rebuild-and-capture.
 *
 * It reproduces exactly what WorldCanvas does to build the view matrix,
 * including the frame offset: the aim is pushed `frameOffset` metres LEFT in
 * CAMERA space, which is what holds a subject in the right of frame while the
 * copy column occupies the left. Getting that wrong is how a pose that reads
 * perfectly in a top-down diagram lands with the subject half off the edge.
 *
 * Bounds below are the ones cameraPath.ts documents as measured from
 * exterior_mansion.glb, not new numbers.
 */

const W = 1440;
const H = 900;

const SUBJECTS = {
  // Mansion shell plus its rustic base, and the spire that defines the
  // silhouette the brief opens on.
  mansion: { min: [-9.64, 0, -6.54], max: [9.64, 11.72, 8.34] },
  spire: { min: [-0.18, 9.19, -0.18], max: [0.18, 11.72, 0.18] },
  fountain: { min: [-2.78, 0, 10.42], max: [2.78, 2.67, 15.98] },
  // The authored ground plane. Its far edge is the hard line that reads as the
  // edge of a table when fog does not reach it.
  terrain: { min: [-120, -2.97, -120], max: [120, 0.97, 120] },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => {
  const l = Math.hypot(...a) || 1;
  return mul(a, 1 / l);
};

/**
 * Camera basis, matching three's lookAt with the default up (0,1,0), then the
 * aim shifted left in camera space by `frameOffset`.
 */
function basis(pos, target, frameOffset) {
  let fwd = norm(sub(target, pos));
  let right = norm(cross(fwd, [0, 1, 0]));
  // Shift the AIM, not the camera: the same thing WorldCanvas does, so the
  // vantage is unchanged and only the subject's place in the frame moves.
  const aim = add(target, mul(right, -frameOffset));
  fwd = norm(sub(aim, pos));
  right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  return { fwd, right, up, aim };
}

function project(p, cam) {
  const { pos, fov } = cam;
  const b = cam.b;
  const d = sub(p, pos);
  const z = dot(d, b.fwd);
  const x = dot(d, b.right);
  const y = dot(d, b.up);
  const halfH = Math.tan((fov * Math.PI) / 360);
  const halfW = halfH * (W / H);
  return {
    z,
    sx: (x / (z * halfW)) * 0.5 * W + W / 2,
    sy: -(y / (z * halfH)) * 0.5 * H + H / 2,
  };
}

function boxOnScreen(box, cam) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let anyFront = false;
  let near = Infinity;
  let far = -Infinity;
  for (let i = 0; i < 8; i += 1) {
    const p = [
      i & 1 ? box.max[0] : box.min[0],
      i & 2 ? box.max[1] : box.min[1],
      i & 4 ? box.max[2] : box.min[2],
    ];
    const q = project(p, cam);
    if (q.z > 0) {
      anyFront = true;
      near = Math.min(near, q.z);
      far = Math.max(far, q.z);
      minX = Math.min(minX, q.sx);
      maxX = Math.max(maxX, q.sx);
      minY = Math.min(minY, q.sy);
      maxY = Math.max(maxY, q.sy);
    }
  }
  if (!anyFront) return { inFrame: false, coverage: 0 };
  const cx = clamp(maxX, 0, W) - clamp(minX, 0, W);
  const cy = clamp(maxY, 0, H) - clamp(minY, 0, H);
  return {
    inFrame: cx > 0 && cy > 0,
    box: [minX, minY, maxX, maxY].map(Math.round),
    widthPct: +(((maxX - minX) / W) * 100).toFixed(1),
    coverage: +((Math.max(0, cx) * Math.max(0, cy)) / (W * H)).toFixed(3),
    depth: [+near.toFixed(1), +far.toFixed(1)],
  };
}

/** Screen box of a sphere, from its centre and radius. */
function sphereOnScreen(centre, radius, cam) {
  const c = project(centre, cam);
  if (c.z <= 0) return { inFrame: false, coverage: 0 };
  const halfH = Math.tan((cam.fov * Math.PI) / 360);
  const rPx = (radius / (c.z * halfH)) * 0.5 * H;
  const box = [c.sx - rPx, c.sy - rPx, c.sx + rPx, c.sy + rPx];
  const cx = clamp(box[2], 0, W) - clamp(box[0], 0, W);
  const cy = clamp(box[3], 0, H) - clamp(box[1], 0, H);
  return {
    inFrame: cx > 0 && cy > 0,
    box: box.map(Math.round),
    centre: [Math.round(c.sx), Math.round(c.sy)],
    diameterPct: +(((rPx * 2) / H) * 100).toFixed(1),
    coverage: +((Math.max(0, cx) * Math.max(0, cy)) / (W * H)).toFixed(3),
    depth: +c.z.toFixed(1),
  };
}

/**
 * Where the horizon of a finite ground plane lands, and how strongly fog has
 * buried its far edge. A visible hard line here is the single artefact that
 * most reads as a diorama on a table.
 */
function groundEdge(cam, fog) {
  const y = SUBJECTS.terrain.max[1];
  const samples = [];
  for (const [label, p] of [
    ['far-centre', [0, y, -120]],
    ['far-left', [-120, y, -120]],
    ['far-right', [120, y, -120]],
    ['near-centre', [0, y, 120]],
  ]) {
    const q = project(p, cam);
    if (q.z <= 0) continue;
    const haze = clamp((q.z - fog[0]) / (fog[1] - fog[0]), 0, 1);
    samples.push({ label, sy: Math.round(q.sy), sx: Math.round(q.sx),
                   dist: Math.round(q.z), haze: +haze.toFixed(2) });
  }
  return samples;
}

export function evaluate(name, spec) {
  const cam = { pos: spec.position, fov: spec.fov };
  cam.b = basis(spec.position, spec.target, spec.frameOffset ?? 0);
  const out = {
    name,
    position: spec.position,
    target: spec.target,
    fov: spec.fov,
    frameOffset: spec.frameOffset ?? 0,
    aim: cam.b.aim.map((v) => +v.toFixed(2)),
    mansion: boxOnScreen(SUBJECTS.mansion, cam),
    spire: boxOnScreen(SUBJECTS.spire, cam),
    fountain: boxOnScreen(SUBJECTS.fountain, cam),
    ground: groundEdge(cam, spec.fog ?? [60, 220]),
  };
  if (spec.constellation) {
    out.constellation = sphereOnScreen(spec.constellation, spec.constellationRadius, cam);
  }
  return out;
}

const show = (r) => {
  console.log(`\n=== ${r.name} ===`);
  console.log(`  pos ${JSON.stringify(r.position)} -> ${JSON.stringify(r.target)}`
    + `  fov ${r.fov}  offset ${r.frameOffset}  aim ${JSON.stringify(r.aim)}`);
  const line = (k, v) => {
    if (!v || !v.inFrame) { console.log(`  ${k.padEnd(14)} NOT IN FRAME`); return; }
    console.log(`  ${k.padEnd(14)} box ${JSON.stringify(v.box)}`
      + `  cover ${v.coverage}`
      + (v.widthPct !== undefined ? `  width ${v.widthPct}%` : '')
      + (v.diameterPct !== undefined ? `  dia ${v.diameterPct}%h  centre ${JSON.stringify(v.centre)}` : '')
      + `  depth ${JSON.stringify(v.depth)}`);
  };
  line('mansion', r.mansion);
  line('spire', r.spire);
  line('fountain', r.fountain);
  if (r.constellation) line('constellation', r.constellation);
  console.log('  ground  ' + r.ground.map((g) => `${g.label} y${g.sy} d${g.dist} haze${g.haze}`).join('  '));
};

// ── Candidates ────────────────────────────────────────────────────────────
// SHIPPED is the pose the probe measured on the live build, restated here so
// every candidate is compared against the same instrument rather than against
// a memory of it.
const CASES = process.argv.slice(2).length
  ? []
  : [
      ['SHIPPED con (beat 1.0)', {
        position: [0, 16, -24], target: [0, 16, -46], fov: 38, frameOffset: 2.6,
        constellation: [0, 16, -46], constellationRadius: 6.2,
      }],
      ['SHIPPED turn (beat 0.82)', {
        position: [-6, 12.2, -14], target: [0, 12, -34], fov: 46, frameOffset: 4.2,
        constellation: [0, 16, -46], constellationRadius: 6.2,
      }],
    ];

for (const [n, s] of CASES) show(evaluate(n, s));
