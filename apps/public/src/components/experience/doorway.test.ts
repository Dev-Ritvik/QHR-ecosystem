// apps/public/src/components/experience/doorway.test.ts
//
// The doorway, proved as arithmetic.
//
// A passage through the front door is a timed move across two models, and the
// ways it can go wrong are all measurable without a browser: a dark that is not
// full at the instant the models swap, a camera that is not yet through the
// door when the frame is covered, a flight line that clips the portico or the
// fountain, an "acceleration" that is not one, an iris that does not open, a
// hand-back that jumps. Each is asserted here.

import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  CUT_MS,
  DOORWAY,
  DOOR_ZONE,
  EDGE,
  ENTER,
  ENTER_MS,
  EXIT,
  EXIT_MS,
  FAR_FRAMES,
  MAX_FAR_WAIT_MS,
  MAX_HOLD_MS,
  cancelDoorway,
  doorwayChannels,
  doorwayState,
  enterResidence,
  noteDoorwayInput,
  setDoorwayHost,
  stepDoorway,
  THRESHOLD_DARK,
  type DoorwayHost,
} from './doorway';
import { BEATS } from './cameraPath';
import { buildInteriorBeats } from './interiorPath';
import { CROSSOVER, DOOR_BAND, DOOR_IN, DOOR_OUT } from './journey';

type Box = { name: string; min: [number, number, number]; max: [number, number, number] };

function distanceToBox(p: THREE.Vector3, b: Box): number {
  const dx = Math.max(b.min[0] - p.x, 0, p.x - b.max[0]);
  const dy = Math.max(b.min[1] - p.y, 0, p.y - b.max[1]);
  const dz = Math.max(b.min[2] - p.z, 0, p.z - b.max[2]);
  return Math.hypot(dx, dy, dz);
}

const sample = (n: number) => Array.from({ length: n + 1 }, (_, i) => i / n);

describe('the passage, as a clock', () => {
  for (const dir of ['enter', 'exit'] as const) {
    const T = dir === 'enter' ? ENTER : EXIT;

    describe(dir, () => {
      it('starts at rest and ends exactly on the film', () => {
        const a = doorwayChannels(dir, 0);
        expect(a.side).toBe('near');
        expect(a.leave).toBe(0);
        expect(a.dark).toBe(0);
        expect(a.exposure).toBe(1);

        // At 1 the far-side blend IS the live pose: nothing left to hand back.
        const z = doorwayChannels(dir, 1);
        expect(z.side).toBe('far');
        expect(z.arrive).toBe(1);
        expect(z.settle).toBe(1);
        expect(z.warp).toBeCloseTo(0, 9);
        expect(z.dark).toBeCloseTo(0, 9);
        expect(z.exposure).toBeCloseTo(1, 9);
        expect(z.defocus).toBeCloseTo(0, 9);
        expect(z.exteriorDoors).toBeCloseTo(0, 9);
        expect(z.vestibule).toBe(0);
      });

      it('is fully dark, and the camera through the doorway, before the models swap', () => {
        // The swap is the one instant in the film where a single visible frame
        // would show two models at once.
        const justBefore = doorwayChannels(dir, T.swap - 1e-6);
        expect(justBefore.side).toBe('near');
        expect(justBefore.dark).toBe(1);
        expect(justBefore.leave).toBe(1);
        const at = doorwayChannels(dir, T.swap);
        expect(at.side).toBe('far');
        expect(at.dark).toBe(1);
        expect(at.arrive).toBe(0);
      });

      it('holds full dark from the end of the rush until the clearing begins', () => {
        for (const u of sample(200)) {
          if (u >= T.darkTo && u < T.clearFrom) {
            expect(doorwayChannels(dir, u).dark, `u=${u}`).toBe(1);
          }
        }
      });

      it('never goes to white: the passage only ever takes light away', () => {
        // The fourth art-direction critique: "Remove the blinding white
        // flash." Nothing in the passage may lift the exposure above rest or
        // paint anything but the threshold's dark.
        for (const u of sample(400)) {
          const c = doorwayChannels(dir, u);
          expect(c.exposure, `u=${u}`).toBeLessThanOrEqual(1);
          expect(c.dark, `u=${u}`).toBeGreaterThanOrEqual(0);
        }
        const hex = THRESHOLD_DARK.replace('#', '');
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
        expect(0.2126 * r + 0.7152 * g + 0.0722 * b).toBeLessThan(8);
      });

      it('opens the iris on the far side: the room comes up from five stops under', () => {
        const T2 = T as typeof T & { irisFrom: number; irisTo: number };
        const start = doorwayChannels(dir, T.swap + 1e-6);
        expect(start.exposure).toBeCloseTo(DOORWAY.exposureFloor, 6);
        let prev = start.exposure;
        for (const u of sample(400)) {
          if (u <= T.swap) continue;
          const e = doorwayChannels(dir, u).exposure;
          expect(e, `u=${u}`).toBeGreaterThanOrEqual(prev - 1e-12);
          prev = e;
        }
        expect(doorwayChannels(dir, T2.irisTo).exposure).toBeCloseTo(1, 9);
        // And the dark layer is gone while the room is still well under: what
        // it uncovers is the render's own dark, not the room.
        const T3 = T as typeof T & { clearTo: number };
        expect(doorwayChannels(dir, T3.clearTo).exposure).toBeLessThan(0.12);
      });

      it('racks the focus out from the door to the room as the iris opens', () => {
        const T2 = T as typeof T & { rackFrom: number; rackTo: number };
        const a = doorwayChannels(dir, T2.rackFrom);
        const b = doorwayChannels(dir, T2.rackTo);
        expect(a.focus).toBeCloseTo(DOORWAY.rackNear, 6);
        expect(b.focus).toBeCloseTo(DOORWAY.rackFar, 6);
        expect(a.defocus).toBeCloseTo(1, 6);
        expect(b.defocus).toBeCloseTo(0, 6);
      });

      it('ACCELERATES into the doorway and DECELERATES out of it', () => {
        // The review asked for exactly this, in those words. Velocity is the
        // first difference of the travel channel: it must rise through the
        // near-side move and fall through the far-side one.
        const moveFrom = dir === 'enter' ? ENTER.moveFrom : 0;
        const v = (f: (u: number) => number, u: number) => f(u + 0.002) - f(u);
        const leave = (u: number) => doorwayChannels(dir, u).leave;
        const arrive = (u: number) => doorwayChannels(dir, u).arrive;

        const near = [0.25, 0.5, 0.75].map((k) => moveFrom + (T.moveTo - moveFrom) * k);
        const vn = near.map((u) => v(leave, u));
        expect(vn[1]).toBeGreaterThan(vn[0]);
        expect(vn[2]).toBeGreaterThan(vn[1]);

        const far = [0.1, 0.4, 0.7].map((k) => T.swap + 0.001 + (1 - T.swap) * k);
        const vf = far.map((u) => v(arrive, u));
        expect(vf[1]).toBeLessThan(vf[0]);
        expect(vf[2]).toBeLessThan(vf[1]);
      });

      it('never jumps: every channel moves by a small step per frame', () => {
        // One frame at 60fps is 1/60 of a second of a 2-second clock.
        const step = 1 / 60 / ((dir === 'enter' ? ENTER_MS : EXIT_MS) / 1000);
        let prev = doorwayChannels(dir, 0);
        for (let u = step; u <= 1; u += step) {
          const c = doorwayChannels(dir, u);
          // (`vestibule` is a visibility flag — the panel behind the open
          // leaves — so it is not in this list.)
          const keys = ['aim', 'settle', 'warp', 'dark', 'exposure', 'defocus', 'exteriorDoors'] as const;
          // Continuous across the swap as well as within each side.
          const across = new Set(['aim', 'settle', 'warp', 'dark']);
          for (const k of keys) {
            // The rest reset at the swap, under full dark, where no frame of
            // the change can be seen.
            if (!across.has(k) && prev.side !== c.side) continue;
            expect(Math.abs(c[k] - prev[k]), `${k} at u=${u.toFixed(3)}`).toBeLessThan(0.2);
          }
          prev = c;
        }
      });
    });
  }

  it('grows the door on screen at every frame of the rush — never a pull-back', () => {
    // The door's apparent height goes as 1 / (distance x tan(fov / 2)). The
    // first build widened the lens from the first frame of an ease-in move, and
    // the passage opened by shrinking the very door it was flying into.
    const door = BEATS[BEATS.length - 1];
    const doorPlaneZ = 8.21;
    let prev = Infinity;
    for (const u of sample(1000)) {
      const c = doorwayChannels('enter', u);
      if (c.side !== 'near') break;
      const z = door.position[2] + (DOORWAY.exteriorPass[2] - door.position[2]) * c.leave;
      const distance = z - doorPlaneZ;
      if (distance <= 0.6) break; // through the near plane; the light has it
      const fov = door.fov + (DOORWAY.warpFov - door.fov) * c.warp;
      const product = distance * Math.tan((fov * Math.PI) / 360);
      expect(product, `u=${u}`).toBeLessThanOrEqual(prev + 1e-9);
      prev = product;
    }
  });

  it('opens the front doors before the camera starts to move, and has them open when it arrives', () => {
    expect(doorwayChannels('enter', ENTER.moveFrom).exteriorDoors).toBeGreaterThan(0);
    const door = BEATS[BEATS.length - 1].position;
    // The first instant the camera is within a metre of the door plane.
    for (const u of sample(2000)) {
      const c = doorwayChannels('enter', u);
      if (c.side !== 'near') break;
      const z = door[2] + (DOORWAY.exteriorPass[2] - door[2]) * c.leave;
      if (z < 6.16) {
        expect(c.exteriorDoors, `u=${u}`).toBe(1);
        // And the vestibule's dark has all but filled the frame by the time the
        // lens is at the door, so the inside of the shell is never what the
        // camera sees.
        if (z < 8.35) expect(c.dark, `u=${u}`).toBeGreaterThan(0.85);
      }
    }
  });
});

describe('the flight lines', () => {
  // Measured from exterior_estate_v7.glb (world metres; estateBounds.ts and the
  // generator's own dimensions for the parts inside the portico hull). The
  // house's own hull is not in this list: the whole point is to go through its
  // front door.
  const EXTERIOR: Box[] = [
    { name: 'entablature', min: [-4.7, 4.4, 8.3], max: [4.7, 5.6, 11.25] },
    { name: 'cornice', min: [-5.2, 5.22, 11.25], max: [5.2, 5.6, 11.8] },
    { name: 'balcony', min: [-4.7, 5.6, 8.4], max: [4.7, 6.77, 11.3] },
    { name: 'column_l_inner', min: [-2.21, 0.6, 10.39], max: [-1.29, 4.4, 11.31] },
    { name: 'column_r_inner', min: [1.29, 0.6, 10.39], max: [2.21, 4.4, 11.31] },
    { name: 'column_l_outer', min: [-4.61, 0.6, 10.39], max: [-3.69, 4.4, 11.31] },
    { name: 'column_r_outer', min: [3.69, 0.6, 10.39], max: [4.61, 4.4, 11.31] },
    { name: 'surround_l', min: [-1.59, 0.6, 8.3], max: [-1.3, 4.25, 8.51] },
    { name: 'surround_r', min: [1.3, 0.6, 8.3], max: [1.59, 4.25, 8.51] },
    { name: 'wall_above_door', min: [-13.1, 4.25, 7.8], max: [13.1, 9.4, 8.51] },
    { name: 'cheek_l', min: [-5.31, 0.0, 11.4], max: [-4.6, 2.2, 13.25] },
    { name: 'cheek_r', min: [4.6, 0.0, 11.4], max: [5.31, 2.2, 13.25] },
    { name: 'platform', min: [-5.2, 0.0, 8.4], max: [5.2, 0.6, 11.4] },
    { name: 'steps', min: [-4.6, 0.0, 11.4], max: [4.6, 0.45, 12.66] },
    { name: 'fountain', min: [-3.95, 0.0, 26.05], max: [3.95, 3.38, 33.95] },
  ];
  const doorPose = new THREE.Vector3(...BEATS[BEATS.length - 1].position);

  const line = (a: THREE.Vector3, b: THREE.Vector3, n = 400) =>
    sample(n).map((t) => a.clone().lerp(b, t));

  for (const [name, from, to] of [
    ['in, through the front door', doorPose, new THREE.Vector3(...DOORWAY.exteriorPass)],
    ['out, back to the forecourt', new THREE.Vector3(...DOORWAY.exteriorStart), doorPose],
  ] as const) {
    it(`clears the portico, the steps and the fountain going ${name}`, () => {
      // The exterior near plane is 0.5 m; nothing may come closer.
      const hits: string[] = [];
      for (const p of line(from, to)) {
        for (const b of EXTERIOR) {
          const d = distanceToBox(p, b);
          if (d < 0.5) hits.push(`${b.name} d=${d.toFixed(2)} at ${p.toArray().map((v) => v.toFixed(2))}`);
        }
      }
      expect(hits).toEqual([]);
    });
  }

  it('crosses the door plane inside the opening, with room to spare', () => {
    const a = doorPose;
    const b = new THREE.Vector3(...DOORWAY.exteriorPass);
    const t = (8.21 - a.z) / (b.z - a.z);
    const p = a.clone().lerp(b, t);
    // mansion_doors: x -1.35..1.35, y 0.55..3.95, less the half-metre near plane.
    expect(Math.abs(p.x)).toBeLessThanOrEqual(0.85);
    expect(p.y).toBeGreaterThanOrEqual(1.05);
    expect(p.y).toBeLessThanOrEqual(3.45);
    // And it stops short of the vestibule panel behind the leaves (hinge z 8.17
    // less 1.42, DoorwayRig) by more than the near plane.
    expect(b.z - (8.17 - 1.42)).toBeGreaterThan(0.5);
  });

  it('arrives inside the hall, and backs out, without ever leaving the room', () => {
    // In the dark there is nothing to fly through the front wall for: the
    // camera is simply a pace inside the doors (int_doors z 7.57..7.69) when
    // the iris begins to open, and is there again, in the dark, when it backs
    // out. The hall's near plane is 0.1 m; the doors stay behind it.
    const threshold = new THREE.Vector3(...buildInteriorBeats(3)[0].position);
    for (const [from, to] of [
      [new THREE.Vector3(...DOORWAY.hallStart), threshold],
      [threshold, new THREE.Vector3(...DOORWAY.hallPass)],
    ] as const) {
      for (const p of line(from, to)) {
        expect(p.z, 'in front of the doors').toBeLessThan(7.57 - 0.15);
        expect(Math.abs(p.x)).toBeLessThan(1.3);
        expect(p.y).toBeGreaterThan(0.5);
        expect(p.y).toBeLessThan(4.0);
      }
    }
  });
});

describe('the director', () => {
  let progress = 0;
  let animate = true;
  /** Stands in for React: a scroll that names the other model is committed at
   *  once. Turned off to test the hold that waits for the commit. */
  let commits = true;
  const calls: string[] = [];
  const host: DoorwayHost = {
    progress: () => progress,
    jumpTo: (p) => {
      calls.push(`jump ${p.toFixed(4)}`);
      progress = p;
      if (commits) doorwayState.sceneLeg = p >= CROSSOVER ? 'interior' : 'exterior';
    },
    hold: (on) => calls.push(on ? 'hold' : 'release'),
    glideTo: (p, _s, done) => {
      calls.push(`glide ${p.toFixed(4)}`);
      progress = p;
      done();
    },
    canAnimate: () => animate,
  };

  beforeEach(() => {
    cancelDoorway();
    calls.length = 0;
    progress = 0;
    animate = true;
    commits = true;
    doorwayState.sceneLeg = 'exterior';
    doorwayState.hallReady = true;
    doorwayState.lastInput = -Infinity;
    doorwayState.cutAt = -Infinity;
    setDoorwayHost(host);
  });

  /** Runs frames at 60fps until `until` returns true or `ms` elapses. */
  function run(t0: number, ms: number, until?: () => boolean): number {
    let t = t0;
    for (; t <= t0 + ms; t += 1000 / 60) {
      stepDoorway(t);
      if (until?.()) break;
    }
    return t;
  }

  it('plays the passage for a crossing made by hand at the door', () => {
    progress = DOOR_OUT - 0.01;
    stepDoorway(1000);
    noteDoorwayInput(1010);
    progress = DOOR_OUT + 0.004;
    stepDoorway(1016);

    expect(doorwayState.mode).toBe('running');
    expect(doorwayState.dir).toBe('enter');
    // Held on the near edge of the doorway band — the leg must not flip under a
    // camera that is still outside, and the approach's copy stays pinned.
    expect(calls.slice(0, 2)).toEqual(['hold', `jump ${(DOOR_OUT - EDGE).toFixed(4)}`]);
    expect(progress).toBeLessThan(DOOR_OUT);

    const end = run(1016, ENTER_MS + 100, () => doorwayState.mode === 'idle');
    expect(doorwayState.mode).toBe('idle');
    // Landed across the band, on the first frame inside.
    expect(calls).toContain(`jump ${(DOOR_IN + EDGE).toFixed(4)}`);
    expect(calls.filter((c) => c === 'release')).toHaveLength(1);
    expect(progress).toBeGreaterThan(DOOR_IN);
    // And the clock took the time it was authored to take.
    expect(end - 1016).toBeGreaterThan(ENTER_MS - 40);
  });

  it('plays the way out for a crossing back up, by hand', () => {
    doorwayState.sceneLeg = 'interior';
    progress = DOOR_IN + 0.01;
    stepDoorway(0);
    noteDoorwayInput(5);
    progress = DOOR_IN - 0.002;
    stepDoorway(16);
    expect(doorwayState.mode).toBe('running');
    expect(doorwayState.dir).toBe('exit');
    expect(progress).toBeGreaterThan(DOOR_IN);
    run(16, EXIT_MS + 100, () => doorwayState.mode === 'idle');
    expect(progress).toBeLessThan(DOOR_OUT);
  });

  it('spans exactly one viewport of the track, with the swap in its middle', () => {
    // The band is what keeps each side's copy pinned on each side's frame; see
    // DOOR_BAND in journey.ts.
    expect(DOOR_IN - DOOR_OUT).toBeCloseTo(DOOR_BAND, 12);
    expect(CROSSOVER).toBeCloseTo((DOOR_OUT + DOOR_IN) / 2, 12);
  });

  it('cuts, rather than flies, for a crossing nobody made by hand', () => {
    progress = 0.2;
    stepDoorway(0);
    progress = 0.7; // a deep link, a chapter address, a test harness
    stepDoorway(16);
    expect(doorwayState.mode).toBe('idle');
    expect(doorwayState.snap).toBe(true);
    expect(doorwayState.cutAt).toBe(16);
    expect(calls).toEqual([]);
    expect(CUT_MS).toBeGreaterThan(0);
  });

  it('cuts a hand-made jump that did not happen at the door', () => {
    progress = DOOR_OUT - DOOR_ZONE * 3;
    stepDoorway(0);
    noteDoorwayInput(5);
    progress = DOOR_IN + 0.01; // keyboard End, say
    stepDoorway(16);
    expect(doorwayState.mode).toBe('idle');
    expect(doorwayState.snap).toBe(true);
  });

  it('does not animate at all when motion is not allowed', () => {
    animate = false;
    progress = DOOR_OUT - 0.01;
    stepDoorway(0);
    noteDoorwayInput(5);
    progress = DOOR_OUT + 0.004;
    stepDoorway(16);
    expect(doorwayState.mode).toBe('idle');
    expect(calls).toEqual([]);
  });

  it('places the camera, without a passage, when the scroll crosses the swap mid-band', () => {
    // A reduced-motion visitor scrolling through the band, say: the models swap
    // at CROSSOVER and the camera is placed there, not flown.
    animate = false;
    progress = DOOR_OUT + 0.002;
    stepDoorway(0);
    progress = CROSSOVER + 0.002;
    stepDoorway(16);
    expect(doorwayState.mode).toBe('idle');
    expect(doorwayState.snap).toBe(true);
  });

  it('holds the dark for a hall that has not loaded, then carries on', () => {
    doorwayState.hallReady = false;
    progress = DOOR_OUT - 0.01;
    stepDoorway(0);
    noteDoorwayInput(5);
    progress = DOOR_OUT + 0.004;
    stepDoorway(16);

    // Well past the authored swap, still on the near side, still dark.
    let t = run(16, ENTER_MS * ENTER.swap + 1500);
    expect(doorwayState.mode).toBe('running');
    expect(doorwayState.swapped).toBe(false);
    expect(doorwayState.channels.dark).toBe(1);
    expect(progress).toBeLessThan(DOOR_OUT);

    doorwayState.hallReady = true;
    t = run(t, 100, () => doorwayState.swapped);
    expect(doorwayState.swapped).toBe(true);
    expect(progress).toBeGreaterThan(DOOR_IN);
    run(t, ENTER_MS, () => doorwayState.mode === 'idle');
    expect(doorwayState.mode).toBe('idle');
  });

  it('keeps the dark full after the swap until the far model has been drawn', () => {
    commits = false; // React has not committed the swap yet
    progress = DOOR_OUT - 0.01;
    stepDoorway(0);
    noteDoorwayInput(5);
    progress = DOOR_OUT + 0.004;
    stepDoorway(16);

    // Past the swap and well into where the clearing would have been.
    let t = run(16, ENTER_MS * ENTER.clearTo);
    expect(doorwayState.swapped).toBe(true);
    expect(doorwayState.u).toBeCloseTo(ENTER.swap, 9);
    expect(doorwayState.channels.dark).toBe(1);

    // The commit lands; the clock resumes only after FAR_FRAMES frames of it.
    doorwayState.sceneLeg = 'interior';
    for (let i = 0; i < FAR_FRAMES; i += 1) {
      t += 1000 / 60;
      stepDoorway(t);
      expect(doorwayState.channels.dark, `frame ${i}`).toBe(1);
    }
    t = run(t + 1000 / 60, ENTER_MS, () => doorwayState.mode === 'idle');
    expect(doorwayState.mode).toBe('idle');
  });

  it('does not wait for a commit forever', () => {
    commits = false;
    progress = DOOR_OUT - 0.01;
    stepDoorway(0);
    noteDoorwayInput(5);
    progress = DOOR_OUT + 0.004;
    stepDoorway(16);
    run(16, ENTER_MS + MAX_FAR_WAIT_MS + 500, () => doorwayState.mode === 'idle');
    expect(doorwayState.mode).toBe('idle');
  });

  it('gives up holding after MAX_HOLD_MS rather than leaving a visitor in the dark', () => {
    doorwayState.hallReady = false;
    progress = DOOR_OUT - 0.01;
    stepDoorway(0);
    noteDoorwayInput(5);
    progress = DOOR_OUT + 0.004;
    stepDoorway(16);
    run(16, ENTER_MS + MAX_HOLD_MS + 500, () => doorwayState.mode === 'idle');
    expect(doorwayState.mode).toBe('idle');
    expect(progress).toBeGreaterThan(DOOR_IN);
  });

  it('releases the page if the passage is abandoned', () => {
    progress = DOOR_OUT - 0.01;
    stepDoorway(0);
    noteDoorwayInput(5);
    progress = DOOR_OUT + 0.004;
    stepDoorway(16);
    run(16, 400);
    cancelDoorway();
    expect(doorwayState.mode).toBe('idle');
    expect(calls.filter((c) => c === 'hold')).toHaveLength(1);
    expect(calls.filter((c) => c === 'release')).toHaveLength(1);
    expect(doorwayState.channels.dark).toBe(0);
  });

  it('"Step inside" glides to the door first, then plays the passage', () => {
    progress = 0.3;
    stepDoorway(0);
    expect(enterResidence()).toBe(true);
    expect(calls[0]).toBe(`glide ${(DOOR_OUT - EDGE).toFixed(4)}`);
    stepDoorway(16);
    expect(doorwayState.mode).toBe('running');
    expect(doorwayState.dir).toBe('enter');
  });

  it('"Step inside" declines when it cannot animate, so the link does the ordinary thing', () => {
    animate = false;
    progress = 0.3;
    expect(enterResidence()).toBe(false);
  });
});
