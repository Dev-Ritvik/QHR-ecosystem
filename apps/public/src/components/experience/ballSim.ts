// apps/public/src/components/experience/ballSim.ts
//
// The glowing ball's body: a soft sphere of beads, simulated.
//
// THE CLIENT: "the ball is still rigid, the hover effect ... cheap and rigid.
// Make the particles a little rigid to stay together but the ball itself and
// the hover effects must be effortless." The first version displaced beads by a
// formula of the pointer's position — so they moved exactly as far as the
// formula said, snapped back exactly as fast, and nothing ever carried on
// moving once the hand stopped. That is what reads as rigid and cheap.
//
// Here the ball is a body with mass, and every motion is the result of forces:
//
//   COHESION. Each bead is sprung to its place on the ball and coupled to its
//   six nearest neighbours' displacement, so a disturbance spreads across the
//   surface as a wave instead of moving one bead: the beads hold together as a
//   skin, which is the "a little rigid" asked for.
//
//   THE BALL AS A WHOLE floats on a soft spring of its own and has a squash
//   mode along the direction it was pushed, so a pass of the hand makes the
//   whole ball sway and wobble like a drop of something heavier than water.
//
//   THE HAND. The pointer is a wide, smooth force field — beads are dragged
//   along its motion and parted round it — applied as force, not position, so
//   the response has inertia: it builds, overshoots a little and settles.
//
//   IDLE. A slow flow field drifts the beads along the surface and three long
//   waves breathe through its shape, so the ball is never still.
//
// Everything is lightly underdamped (damping ratios 0.45-0.6), which is where
// motion stops reading as mechanical. Unit-sphere space; the renderer scales.

export interface BallPointer {
  /** 0..1, how engaged the pointer is with the ball. */
  gain: number;
  /** Where the pointer meets the ball, unit-sphere space. */
  at: [number, number, number];
  /** The pointer's velocity across the ball, unit-sphere units per second. */
  vel: [number, number, number];
}

export interface BallSim {
  n: number;
  home: Float32Array;
  pos: Float32Array;
  vel: Float32Array;
  disp: Float32Array;
  nbr: Int32Array;
  centre: Float32Array; // position (3) and velocity (3)
  squash: Float32Array; // amount, rate, axis (3)
  t: number;
}

export const NEIGHBOURS = 6;
/** Bead spring (per s^2), damping, and neighbour coupling. */
export const K_HOME = 26;
export const D_HOME = 2 * 0.5 * Math.sqrt(K_HOME);
export const K_COUPLE = 30;
/** The ball's own float and squash. */
const K_CENTRE = 5;
const D_CENTRE = 2 * 0.45 * Math.sqrt(K_CENTRE);
const K_SQUASH = 14;
const D_SQUASH = 2 * 0.4 * Math.sqrt(K_SQUASH);
/** The hand's field: reach, drag along its motion, push apart. */
const REACH = 0.46;
const DRAG = 15;
const PUSH = 5.5;
/** The slow current that keeps the ball from ever being still. */
const FLOW = 0.85;

export function createBallSim(dirs: Float32Array): BallSim {
  const n = dirs.length / 3;
  const nbr = new Int32Array(n * NEIGHBOURS);
  const best = new Float64Array(NEIGHBOURS);
  const bestI = new Int32Array(NEIGHBOURS);
  for (let i = 0; i < n; i += 1) {
    best.fill(Infinity);
    bestI.fill(i);
    const ax = dirs[i * 3], ay = dirs[i * 3 + 1], az = dirs[i * 3 + 2];
    for (let j = 0; j < n; j += 1) {
      if (j === i) continue;
      const dx = dirs[j * 3] - ax, dy = dirs[j * 3 + 1] - ay, dz = dirs[j * 3 + 2] - az;
      const d = dx * dx + dy * dy + dz * dz;
      if (d >= best[NEIGHBOURS - 1]) continue;
      let k = NEIGHBOURS - 1;
      while (k > 0 && best[k - 1] > d) {
        best[k] = best[k - 1];
        bestI[k] = bestI[k - 1];
        k -= 1;
      }
      best[k] = d;
      bestI[k] = j;
    }
    nbr.set(bestI, i * NEIGHBOURS);
  }
  return {
    n,
    home: dirs.slice(),
    pos: dirs.slice(),
    vel: new Float32Array(n * 3),
    disp: new Float32Array(n * 3),
    nbr,
    centre: new Float32Array(6),
    squash: new Float32Array([0, 0, 0, 1, 0]),
    t: 0,
  };
}

const SUB = 1 / 90;

/** Advance the ball by dt seconds under the pointer. */
export function stepBall(sim: BallSim, dt: number, p: BallPointer): void {
  const steps = Math.max(1, Math.ceil(Math.min(dt, 0.1) / SUB));
  const h = Math.min(dt, 0.1) / steps;
  for (let s = 0; s < steps; s += 1) substep(sim, h, p);
}

function substep(sim: BallSim, h: number, p: BallPointer) {
  const { n, home, pos, vel, disp, nbr, centre, squash } = sim;
  sim.t += h;
  const t = sim.t;
  const g = p.gain;
  const [ux, uy, uz] = p.vel;
  const speed = Math.hypot(ux, uy, uz);

  // The ball's own float: pushed by the hand, bobbing slowly at rest.
  const bob = 0.018 * Math.sin(t * 0.55);
  for (let k = 0; k < 3; k += 1) {
    const idle = k === 1 ? bob : 0.012 * Math.sin(t * (0.37 + k * 0.11) + k);
    const push = g * (k === 0 ? ux : k === 1 ? uy : uz) * 0.55;
    const a = -K_CENTRE * (centre[k] - idle) - D_CENTRE * centre[k + 3] + push;
    centre[k + 3] += a * h;
    centre[k] += centre[k + 3] * h;
  }
  // The squash, along the direction the hand moved.
  if (g * speed > 0.02) {
    const ax = ux / speed, ay = uy / speed, az = uz / speed;
    squash[2] += (ax - squash[2]) * Math.min(1, h * 6);
    squash[3] += (ay - squash[3]) * Math.min(1, h * 6);
    squash[4] += (az - squash[4]) * Math.min(1, h * 6);
  }
  const sa = -K_SQUASH * squash[0] - D_SQUASH * squash[1] + g * Math.min(speed, 3) * 0.8;
  squash[1] += sa * h;
  squash[0] += squash[1] * h;
  const al = Math.hypot(squash[2], squash[3], squash[4]) || 1;
  const sx = squash[2] / al, sy = squash[3] / al, sz = squash[4] / al;
  const amt = Math.max(-0.25, Math.min(0.25, squash[0]));

  // Pass 1: every bead's rest position and displacement from it.
  for (let i = 0; i < n; i += 1) {
    const hx = home[i * 3], hy = home[i * 3 + 1], hz = home[i * 3 + 2];
    const along = hx * sx + hy * sy + hz * sz;
    const breathe =
      0.028 * Math.sin((hx * 2.1 + hy * 1.3 - hz * 1.7) * 2 + t * 0.62) +
      0.018 * Math.sin((-hx * 1.2 + hy * 2.4 + hz * 0.9) * 2.6 - t * 0.47) +
      0.012 * Math.sin((hx * 0.7 - hy * 0.8 + hz * 2.2) * 3.4 + t * 0.83);
    const r = 1 + breathe + amt * 0.5 * (3 * along * along - 1);
    disp[i * 3] = pos[i * 3] - (centre[0] + hx * r);
    disp[i * 3 + 1] = pos[i * 3 + 1] - (centre[1] + hy * r);
    disp[i * 3 + 2] = pos[i * 3 + 2] - (centre[2] + hz * r);
  }

  // Pass 2: forces, then integrate (semi-implicit Euler).
  const [qx, qy, qz] = p.at;
  const inv2s2 = 1 / (2 * REACH * REACH);
  for (let i = 0; i < n; i += 1) {
    const i3 = i * 3;
    let nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < NEIGHBOURS; k += 1) {
      const j3 = nbr[i * NEIGHBOURS + k] * 3;
      nx += disp[j3];
      ny += disp[j3 + 1];
      nz += disp[j3 + 2];
    }
    nx /= NEIGHBOURS;
    ny /= NEIGHBOURS;
    nz /= NEIGHBOURS;
    let ax = -K_HOME * disp[i3] - D_HOME * vel[i3] + K_COUPLE * (nx - disp[i3]);
    let ay = -K_HOME * disp[i3 + 1] - D_HOME * vel[i3 + 1] + K_COUPLE * (ny - disp[i3 + 1]);
    let az = -K_HOME * disp[i3 + 2] - D_HOME * vel[i3 + 2] + K_COUPLE * (nz - disp[i3 + 2]);

    const px = pos[i3], py = pos[i3 + 1], pz = pos[i3 + 2];
    // Idle flow along the surface: a slow field, coherent across neighbours.
    ax += FLOW * Math.sin(py * 2.1 + t * 0.45);
    ay += FLOW * Math.sin(pz * 1.9 + t * 0.38);
    az += FLOW * Math.sin(px * 2.4 + t * 0.52);

    if (g > 0.001) {
      const dx = px - qx, dy = py - qy, dz = pz - qz;
      const d2 = dx * dx + dy * dy + dz * dz;
      const w = g * Math.exp(-d2 * inv2s2);
      if (w > 1e-4) {
        const d = Math.sqrt(d2) + 1e-4;
        ax += w * (ux * DRAG + (dx / d) * PUSH);
        ay += w * (uy * DRAG + (dy / d) * PUSH);
        az += w * (uz * DRAG + (dz / d) * PUSH);
      }
    }
    vel[i3] += ax * h;
    vel[i3 + 1] += ay * h;
    vel[i3 + 2] += az * h;
    // A speed limit well above anything the hand asks for: stability, not look.
    const v2 = vel[i3] * vel[i3] + vel[i3 + 1] * vel[i3 + 1] + vel[i3 + 2] * vel[i3 + 2];
    if (v2 > 9) {
      const f = 3 / Math.sqrt(v2);
      vel[i3] *= f;
      vel[i3 + 1] *= f;
      vel[i3 + 2] *= f;
    }
    pos[i3] += vel[i3] * h;
    pos[i3 + 1] += vel[i3 + 1] * h;
    pos[i3 + 2] += vel[i3 + 2] * h;
  }
}
