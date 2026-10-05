// apps/public/src/components/experience/doorThrough.test.ts
//
// The passage inward as one move through the open door (doorway.ts, THROUGH;
// the refinement brief, 2026-10-03: "a continuous physical/cinematic entry
// through the architecture"). What can go wrong with it is arithmetic: a frame
// of dark, a camera that brakes or lurches where the sets change, a door that
// shrinks as the lens opens, a doorway that does not fill the frame when the
// hall takes over from it. Each is asserted here; doorway.test.ts keeps the
// dark threshold, which is still the fallback and the way out.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DOORWAY,
  EDGE,
  HALL_IN_EXTERIOR,
  MAX_FAR_WAIT_MS,
  THROUGH,
  THROUGH_MS,
  THROUGH_OUT_MS,
  THROUGH_SWAP,
  cancelDoorway,
  doorwayChannels,
  doorwayState,
  setDoorwayHost,
  stepDoorway,
  type DoorwayHost,
} from './doorway';
import { PORTAL_BEHIND, PORTAL_SIZE } from './DoorwayRig';
import { doorwayRect, hallPortal, panelFillsFrame, portalScale, registerHallRoot } from './doorPortal';
import { ESTATE_DOOR } from './estateBounds';
import { BEATS } from './cameraPath';
import { buildInteriorBeats } from './interiorPath';
import { CROSSOVER, DOOR_IN, DOOR_OUT } from './journey';

const N = 2000;
const at = (u: number) => doorwayChannels('enter', u, undefined, 'through');
const doorBeat = BEATS[BEATS.length - 1];
const threshold = buildInteriorBeats(3)[0];

/** The camera's place on the move, metres from where it began, on the line it
 *  flies: the door beat to the point inside the door, then on to the
 *  threshold frame. */
const from = new THREE.Vector3(...doorBeat.position);
const pass = new THREE.Vector3(...DOORWAY.exteriorPass);
const rest = new THREE.Vector3(...threshold.position).add(new THREE.Vector3(...HALL_IN_EXTERIOR));
const outside = from.distanceTo(pass);
const inside = pass.distanceTo(rest);
const travelled = (u: number) => {
  const c = at(u);
  return c.side === 'near' ? c.leave * outside : outside + c.arrive * inside;
};
const eyeAt = (u: number) => {
  const c = at(u);
  return c.side === 'near' ? from.clone().lerp(pass, c.leave) : pass.clone().lerp(rest, c.arrive);
};

describe('the passage inward, in one move', () => {
  it('starts at rest outside and ends exactly on the film inside', () => {
    const a = at(0);
    expect(a.side).toBe('near');
    expect(a.leave).toBe(0);
    expect(a.portal).toBe(0);
    expect(a.exteriorDoors).toBe(0);
    const z = at(1);
    expect(z.side).toBe('far');
    expect(z.arrive).toBe(1);
    expect(z.settle).toBe(1);
    expect(z.warp).toBeCloseTo(0, 9);
    expect(z.defocus).toBe(0);
  });

  it('is never dark, never under-exposed, and never shows the vestibule: there is nothing to cover', () => {
    for (let i = 0; i <= N; i += 1) {
      const c = at(i / N);
      expect(c.dark).toBe(0);
      expect(c.vestibule).toBe(0);
      expect(c.exposure).toBe(1);
    }
  });

  it('opens the leaves onto the hall before the camera has moved a metre, and keeps them open', () => {
    const open = at(THROUGH.doorsTo);
    expect(open.exteriorDoors).toBe(1);
    expect(open.portal).toBe(1);
    expect(travelled(THROUGH.doorsTo * 0.5)).toBeLessThan(1);
    // Open, with the hall behind them, until the sets have changed and after:
    // the leaves are still in the picture until then.
    for (let i = Math.ceil(THROUGH.doorsTo * N); i <= N; i += 1) {
      expect(at(i / N).exteriorDoors).toBe(1);
      expect(at(i / N).portal).toBe(1);
    }
  });

  it('is what the two models are: the hall on the same axis, its floor under the door sill', () => {
    // exterior mansion_doors y 0.55.., hall int_doors y 0.. (doorway.ts, DOORWAY)
    expect(HALL_IN_EXTERIOR).toEqual([0, 0.55, 0]);
    // and the share of the move that lies outside the door is the share it is
    expect(outside / (outside + inside)).toBeCloseTo(THROUGH.doorShare, 2);
    // the point the sets change at is past the exterior's door plane and
    // short of the doorway's panel behind it
    expect(pass.z).toBeLessThan(DOORWAY.doorPlaneZ);
    expect(pass.z).toBeGreaterThan(DOORWAY.doorPlaneZ - PORTAL_BEHIND + 0.5);
  });

  it('changes sets exactly where the camera crosses into the hall', () => {
    const before = at(THROUGH_SWAP - 1e-6);
    const after = at(THROUGH_SWAP + 1e-6);
    expect(before.side).toBe('near');
    expect(after.side).toBe('far');
    expect(before.leave).toBeCloseTo(1, 3);
    expect(after.arrive).toBeCloseTo(0, 3);
    // and the aim, the lens and the grade are continuous across it
    expect(before.aim).toBe(1);
    expect(after.settle).toBeCloseTo(0, 3);
    expect(before.warp).toBeCloseTo(1, 3);
    expect(after.warp).toBeCloseTo(1, 3);
    expect(before.grade).toBe(1);
    expect(after.grade).toBe(1);
  });

  it('never goes back, never jumps, and is slowing to a walk as it crosses the sill', () => {
    const dt = THROUGH_MS / 1000 / N;
    let last = travelled(0);
    let top = 0;
    let lastSpeed = 0;
    let hardest = 0;
    for (let i = 1; i <= N; i += 1) {
      const d = travelled(i / N);
      const speed = (d - last) / dt;
      expect(speed).toBeGreaterThanOrEqual(-1e-6);
      top = Math.max(top, speed);
      if (i > 1) hardest = Math.max(hardest, Math.abs(speed - lastSpeed) / dt);
      last = d;
      lastSpeed = speed;
    }
    expect(last).toBeCloseTo(outside + inside, 6);
    // a dolly, not a rush: under eleven metres a second at its fastest
    expect(top).toBeLessThan(11);
    // no lurch anywhere, the change of sets included: under 12 m/s^2
    expect(hardest).toBeLessThan(12);
    // at the door it is at a walk, and still moving
    const i = Math.round(THROUGH_SWAP * N);
    const atDoor = (travelled((i + 1) / N) - travelled((i - 1) / N)) / (2 * dt);
    expect(atDoor).toBeLessThan(4);
    expect(atDoor).toBeGreaterThan(1.5);
  });

  it('grows the door at every frame: the lens opens only as fast as the distance closes', () => {
    const fovAt = (u: number) => {
      const c = at(u);
      return doorBeat.fov + (THROUGH.sillFov - doorBeat.fov) * c.warp;
    };
    let last = 0;
    for (let i = 0; i <= N; i += 1) {
      const u = (i / N) * THROUGH_SWAP;
      const d = eyeAt(u).z - DOORWAY.doorPlaneZ;
      if (d < 0.6) break;
      const size = 1 / (d * Math.tan((fovAt(u) * Math.PI) / 360));
      expect(size).toBeGreaterThanOrEqual(last - 1e-9);
      last = size;
    }
    expect(THROUGH.sillFov).toBeGreaterThan(doorBeat.fov);
    expect(THROUGH.sillFov).toBeLessThanOrEqual(threshold.fov ?? 60);
  });

  it('has the print at the hall\'s grade before the sets change, and not before the door is close', () => {
    // eight-tenths of the way down the forecourt it is still the night's print
    let u = 0;
    while (at(u).leave < THROUGH.gradeFrom && u < 1) u += 1 / N;
    expect(at(u - 2 / N).grade).toBe(0);
    expect(eyeAt(u).z - DOORWAY.doorPlaneZ).toBeLessThan(6);
    // and it is the room's by the sill
    expect(at(THROUGH_SWAP - 1 / N).grade).toBe(1);
    let last = 0;
    for (let i = 0; i <= N; i += 1) {
      const g = at(i / N).grade;
      expect(g).toBeGreaterThanOrEqual(last);
      last = g;
    }
  });
});

describe('the doorway onto the hall', () => {
  const panelZ = DOORWAY.doorPlaneZ - 0.08 - PORTAL_BEHIND; // the hinge line is the leaves' inner face
  const panel: [number, number, number, number] = [
    -PORTAL_SIZE[0] / 2, 0.55 - 0.6, PORTAL_SIZE[0] / 2, 0.55 - 0.6 + PORTAL_SIZE[1],
  ];
  const level = new THREE.Quaternion();
  const tangents = (fov: number, aspect: number) => {
    const ty = Math.tan((fov * Math.PI) / 360);
    return [ty * aspect, ty] as const;
  };

  it('fills the frame where the sets change, on every screen the passage runs on', () => {
    // the pose at the swap: just inside the door, the lens at its widest
    for (const aspect of [16 / 9, 1536 / 730, 21 / 9, 32 / 9, 4 / 3, 820 / 1180, 390 / 844]) {
      const [tx, ty] = tangents(THROUGH.sillFov, aspect);
      expect(panelFillsFrame(pass, level, tx, ty, panelZ, panel), `aspect ${aspect.toFixed(2)}`).toBe(true);
    }
  });

  it('still fills it with the aim already rising to the dome, for the frames a slow commit takes', () => {
    // the aim after a tenth of a second inside: a few degrees up
    const up = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (8 * Math.PI) / 180);
    const eye = pass.clone().lerp(rest, 0.5);
    for (const aspect of [16 / 9, 21 / 9, 390 / 844]) {
      const [tx, ty] = tangents(THROUGH.sillFov, aspect);
      expect(panelFillsFrame(eye, up, tx, ty, panelZ, panel), `aspect ${aspect.toFixed(2)}`).toBe(true);
    }
  });

  it('is not seen from behind, and is cropped by the opening from the forecourt', () => {
    const [tx, ty] = tangents(30, 16 / 9);
    // from the door beat the panel is a small part of the frame: it does not fill it
    expect(panelFillsFrame(from, level, tx, ty, panelZ, panel)).toBe(false);
    // and an eye past it sees nothing of it
    expect(panelFillsFrame(new THREE.Vector3(0, 2, panelZ - 1), level, tx, ty, panelZ, panel)).toBe(false);
  });

  it('draws the room at the frame\'s own size where the machine can, and three-quarters where it cannot', () => {
    expect(portalScale('high')).toBe(1);
    expect(portalScale('mid')).toBeLessThan(1);
    expect(portalScale('mid')).toBeGreaterThanOrEqual(0.7);
  });

  it('keeps a register of what the hall is, and forgets a root that unmounts', () => {
    const g = new THREE.Group();
    const off = registerHallRoot(g);
    expect(hallPortal.roots.has(g)).toBe(true);
    off();
    expect(hallPortal.roots.has(g)).toBe(false);
  });
});

describe('the director, through the door', () => {
  let progress = 0;
  let through = true;
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
      progress = p;
      done();
    },
    canAnimate: () => true,
    canGoThrough: () => through,
  };

  beforeEach(() => {
    cancelDoorway();
    calls.length = 0;
    progress = 0;
    through = true;
    commits = true;
    doorwayState.sceneLeg = 'exterior';
    doorwayState.hallReady = true;
    doorwayState.estateSeen = false;
    doorwayState.lastInput = -Infinity;
    doorwayState.cutAt = -Infinity;
    setDoorwayHost(host);
  });

  function run(t0: number, ms: number, until?: () => boolean): number {
    let t = t0;
    for (; t <= t0 + ms; t += 1000 / 60) {
      stepDoorway(t);
      if (until?.()) break;
    }
    return t;
  }

  /** Scroll into the doorway band by hand, as a visitor does. */
  function crossIn(t: number) {
    progress = DOOR_OUT - 0.01;
    stepDoorway(t);
    noteDoorwayInput(t + 8);
    progress = DOOR_OUT + 0.004;
    stepDoorway(t + 16);
  }
  function noteDoorwayInput(t: number) {
    doorwayState.lastInput = t;
  }

  it('goes through, with the hall ready and a machine that can draw it', () => {
    crossIn(0);
    expect(doorwayState.mode).toBe('running');
    expect(doorwayState.style).toBe('through');
    expect(calls[0]).toBe('hold');
    expect(calls[1]).toBe(`jump ${(DOOR_OUT - EDGE).toFixed(4)}`);
  });

  it('lands the page inside as the camera crosses the sill, without stopping the clock', () => {
    crossIn(0);
    let dark = 0;
    let stalled = 0;
    let lastU = -1;
    const end = run(32, THROUGH_MS + 200, () => {
      dark = Math.max(dark, doorwayState.channels.dark);
      if (doorwayState.mode === 'running' && doorwayState.u === lastU) stalled += 1;
      lastU = doorwayState.u;
      return doorwayState.mode === 'idle';
    });
    expect(doorwayState.mode).toBe('idle');
    expect(calls).toContain(`jump ${(DOOR_IN + EDGE).toFixed(4)}`);
    expect(dark).toBe(0);
    // the clock never held (the threshold's holds are for a dark to hold in)
    expect(stalled).toBeLessThanOrEqual(1);
    expect(end).toBeLessThan(THROUGH_MS + 120);
    // and the page was given back before the end
    expect(calls.filter((c) => c === 'release').length).toBe(1);
    expect(doorwayState.style).toBe('threshold');
  });

  it('holds its last frame, the doorway still showing the hall, for a commit that is late', () => {
    commits = false;
    crossIn(0);
    run(32, THROUGH_MS + 100);
    // the clock is done, the scene still shows the exterior: not finished
    expect(doorwayState.mode).toBe('running');
    expect(doorwayState.u).toBe(1);
    expect(doorwayState.channels.portal).toBe(1);
    doorwayState.sceneLeg = 'interior';
    stepDoorway(THROUGH_MS + 200);
    expect(doorwayState.mode).toBe('idle');
  });

  it('does not wait for that commit forever', () => {
    commits = false;
    crossIn(0);
    run(32, THROUGH_MS + MAX_FAR_WAIT_MS + 400);
    expect(doorwayState.mode).toBe('idle');
  });

  it('falls back to the dark threshold on a machine that cannot draw the hall twice', () => {
    through = false;
    crossIn(0);
    expect(doorwayState.mode).toBe('running');
    expect(doorwayState.style).toBe('threshold');
  });

  it('falls back to the dark threshold for a hall that has not arrived', () => {
    doorwayState.hallReady = false;
    crossIn(0);
    expect(doorwayState.style).toBe('threshold');
  });

  /** Scroll back out of the hall into the doorway band, by hand. */
  function crossOut(t: number) {
    progress = DOOR_IN + 0.01;
    doorwayState.sceneLeg = 'interior';
    stepDoorway(t);
    doorwayState.lastInput = t + 8;
    progress = DOOR_IN - 0.004;
    stepDoorway(t + 16);
  }

  it('goes out by the threshold from a visit that began inside: the estate has never been drawn', () => {
    crossOut(0);
    expect(doorwayState.mode).toBe('running');
    expect(doorwayState.dir).toBe('exit');
    expect(doorwayState.style).toBe('threshold');
  });

  it('goes out by the same door once the estate has been seen', () => {
    // seen: a frame of the film outside, then in
    progress = 0.2;
    stepDoorway(0);
    expect(doorwayState.estateSeen).toBe(true);
    crossOut(100);
    expect(doorwayState.mode).toBe('running');
    expect(doorwayState.dir).toBe('exit');
    expect(doorwayState.style).toBe('through');
    // held on the hall's side of the door until the sill
    expect(calls).toContain(`jump ${(DOOR_IN + EDGE).toFixed(4)}`);
    let dark = 0;
    let landedAt = -1;
    const end = run(132, THROUGH_OUT_MS + 200, () => {
      dark = Math.max(dark, doorwayState.channels.dark);
      if (landedAt < 0 && calls.includes(`jump ${(DOOR_OUT - EDGE).toFixed(4)}`)) landedAt = doorwayState.u;
      return doorwayState.mode === 'idle';
    });
    expect(doorwayState.mode).toBe('idle');
    expect(dark).toBe(0);
    // the page lands outside as the camera crosses the sill, backing out
    expect(landedAt).toBeGreaterThan(1 - THROUGH_SWAP - 0.01);
    expect(landedAt).toBeLessThan(1 - THROUGH_SWAP + 0.02);
    expect(end).toBeLessThan(132 + THROUGH_OUT_MS + 120);
    expect(calls.filter((c) => c === 'release').length).toBe(1);
  });

  it('and not on a machine that cannot draw the hall through the doorway', () => {
    progress = 0.2;
    stepDoorway(0);
    through = false;
    crossOut(100);
    expect(doorwayState.style).toBe('threshold');
  });
});

describe('the way out by the same door', () => {
  const out = (u: number) => doorwayChannels('exit', u, undefined, 'through');

  it('is the way in, backwards: every channel at the mirrored instant', () => {
    for (let i = 1; i < N; i += 1) {
      const u = i / N;
      const o = out(u);
      const n = at(1 - u);
      // on the other side of the same door
      expect(o.side === 'near').toBe(n.side === 'far');
      expect(o.dark).toBe(0);
      expect(o.exposure).toBe(1);
      expect(o.exteriorDoors).toBeCloseTo(n.exteriorDoors, 9);
      expect(o.portal).toBe(n.portal);
      expect(o.grade).toBeCloseTo(n.grade, 9);
      expect(o.warp).toBeCloseTo(n.warp, 9);
      expect(o.defocus).toBeCloseTo(n.defocus, 9);
      if (o.side === 'near') {
        // in the hall: back from where it stood to the point inside the door
        expect(o.leave).toBeCloseTo(1 - n.arrive, 9);
        expect(o.aim).toBeCloseTo(1 - n.settle, 9);
      } else {
        // on the forecourt: from that point out to where the scroll says
        expect(o.arrive).toBeCloseTo(1 - n.leave, 9);
        expect(o.settle).toBeCloseTo(1 - n.aim, 9);
      }
    }
  });

  it('starts where the camera stands and ends where the scroll says, the leaves shut', () => {
    const a = out(0);
    expect(a.side).toBe('near');
    expect(a.leave).toBe(0);
    expect(a.aim).toBe(0);
    expect(a.warp).toBe(0);
    const z = out(1);
    expect(z.side).toBe('far');
    expect(z.arrive).toBe(1);
    expect(z.settle).toBe(1);
    expect(z.warp).toBe(0);
    expect(z.exteriorDoors).toBe(0);
    expect(z.grade).toBe(0);
    expect(z.portal).toBe(0);
  });

  it("crosses the sill with the leaves open on the hall and the print still the room's", () => {
    const swap = 1 - THROUGH_SWAP;
    const before = out(swap - 1e-6);
    const after = out(swap + 1e-6);
    expect(before.side).toBe('near');
    expect(after.side).toBe('far');
    expect(before.leave).toBeGreaterThan(0.999);
    expect(after.arrive).toBeLessThan(0.001);
    for (const c of [before, after]) {
      expect(c.exteriorDoors).toBe(1);
      expect(c.portal).toBe(1);
      expect(c.grade).toBe(1);
      expect(c.warp).toBeGreaterThan(0.999);
    }
    // and the leaves stay open until the camera is well out
    expect(out(0.7).exteriorDoors).toBe(1);
    expect(out(0.9).exteriorDoors).toBeLessThan(0.75);
  });

  it("is wired as the way in is: the camera in the hall's space until the scene shows the estate", () => {
    const read = (name: string) => readFileSync(join(__dirname, name), 'utf8').replace(/\r\n/g, '\n');
    const canvas = read('WorldCanvas.tsx');
    expect(canvas).toContain('if (!entering) {');
    expect(canvas).toContain('desired.current.set(...door.fromPos).lerp(TMP.set(...DOORWAY.exteriorPass).sub(HALL_OFFSET), c.leave);');
    expect(canvas).toContain("if (door.sceneLeg === 'interior') {\n              desired.current.sub(HALL_OFFSET);");
    // one answer to "is the hall drawn through the doorway this frame", for the
    // pass and for the panel: asked of the buffer, the panel was a frame late
    // on the frame the sets change, and showed the dark vestibule
    expect(read('HallPortal.tsx')).toContain('const want = portalWanted();');
    // and the pass shows every root of the hall, not the wrapper alone: the
    // stage hides itself on the frame React hides the wrapper, and the room
    // filled the picture for one frame without its shafts and its nameplate
    expect(read('HallPortal.tsx')).toMatch(/for \(const root of hallPortal\.roots\) \{[\s\S]*?root\.visible = true;\s*\}/);
    expect(read('DoorwayRig.tsx')).toContain('const through = portalWanted();');
    // the sky is loaded once and kept while the visitor is inside: loaded
    // again on the frame the sets change, it was 47 ms of texture upload
    expect(canvas).toMatch(/armed\s*\? loadSky\(SKY_EQUIRECT_URL, \(tex\) => \{[\s\S]*?setEnv\(tex\);[\s\S]*?\}\)\s*: undefined,\s*\[armed\],/);
    expect(canvas).toContain('useEffect(() => (armed ? loadSky(SKY_LIGHTING_URL, setLighting) : undefined), [armed]);');
    expect(canvas).toContain('if (made.current?.source !== source || made.current.gl !== gl) {');
    // and the lens's filter stays the hall's stage's to ease away until the
    // passage is over: written by the estate's loop from the frame the sets
    // change, the establishing copy's half stop went in one frame
    expect(canvas).toContain(
      "doorwayState.mode === 'running' && doorwayState.dir === 'exit' && doorwayState.style === 'through';",
    );
    expect(canvas).toContain('if (!hallsFilter) {');
    expect(read('doorPortal.ts')).toContain('hallPortal.draw !== null &&');
    // the door's caption waits for the page to be let go
    const css = readFileSync(join(__dirname, '..', '..', 'app', 'globals.css'), 'utf8').replace(/\r\n/g, '\n');
    expect(css).toContain("html[data-doorway='exit'][data-doorway-held='1'] [data-chapter-fade] {\n  opacity: 0 !important;");
  });
});

// ── THE CUT BEHIND THE DOORWAY, AS WIRING ───────────────────────────────────
// Every one of these was MEASURED in the browser on the first runs of the
// continuous entry (2026-10-03), and each was invisible under the dark
// threshold it replaced. They are facts about which effect runs when, which a
// unit test cannot run — so the source is held to them, as filmStage.test.ts
// holds the page's.
describe('the frame the sets change on', () => {
  const read = (name: string) => readFileSync(join(__dirname, name), 'utf8').replace(/\r\n/g, '\n');
  const canvas = read('WorldCanvas.tsx');
  const portal = read('HallPortal.tsx');

  it('says which set is showing from INSIDE the canvas, in the commit that changes it', () => {
    // The page's own tree commits first; written there, the flag named the hall
    // a frame or more before the scene was the hall, and that frame drew the
    // room under the estate's lights: 33 programs, 11.9 s.
    const mark = canvas.slice(canvas.indexOf('function SceneLegMark'), canvas.indexOf('function EnvIntensity'));
    expect(mark).toContain('useLayoutEffect(() => {\n    doorwayState.sceneLeg = set;');
    expect(canvas.match(/doorwayState\.sceneLeg = /g)).toHaveLength(1);
    expect(canvas).toContain('<SceneLegMark set={set} />');
    // ...and it is a child of the canvas, not of the page.
    const inCanvas = canvas.slice(canvas.indexOf('<ScrollProgressDriver />'), canvas.indexOf('</Canvas>'));
    expect(inCanvas).toContain('<SceneLegMark set={set} />');
  });

  it('draws the hall from inside the frame, so the frame keeps its own light state', () => {
    // A pass drawn before the frame left the room's two lights in the scene's
    // state, and the estate's shadow casters were rebuilt for them.
    const rig = read('DoorwayRig.tsx');
    expect(rig).toContain('portal.onBeforeRender = (renderer, scene, camera) => {');
    expect(rig).toContain('hallPortal.draw?.(renderer, scene as THREE.Scene, camera);');
    expect(portal).toContain('hallPortal.draw = call;');
    const loop = portal.slice(portal.indexOf('useFrame(() => {'));
    expect(loop).not.toContain('.render(');
    // Only for the film's camera, and never from inside itself.
    expect(portal).toContain('if (drawing.current || !hallPortal.open || !rt || by !== camera || of !== scene) return;');
  });

  it('has nothing to compile when the door opens: the panels and the pins are warmed as what they are', () => {
    const rig = read('DoorwayRig.tsx');
    expect(rig).toContain('void warmProgramsUnder(gl, camera, r.vestibule, scene);');
    expect(rig).toContain('void warmProgramsUnder(gl, camera, r.portal, scene);');
    expect(read('hallProbe.ts')).toContain("const instanced = m.isInstancedMesh ? (m.instanceColor ? 'ic' : 'i') : '';");
  });

  it('leaves the header its band, the lamp its aim and the lens its planes on the first frame inside', () => {
    // The band: zeroed by the estate's lighting as it unmounted, a frame in.
    const cleanup = canvas.slice(canvas.indexOf('scene.backgroundIntensity = 1;'), canvas.indexOf('headerBandReach();\n    },'));
    expect(cleanup).toContain("if (doorwayState.sceneLeg === 'interior') return;");
    expect(cleanup.indexOf("=== 'interior') return;")).toBeLessThan(cleanup.indexOf('lensFilter.top = 0;'));
    // The picture light: aimed a frame late, it lit the carpet.
    const lamp = canvas.slice(canvas.indexOf('function InteriorLighting'), canvas.indexOf('function CameraClipping'));
    expect(lamp).toContain('useLayoutEffect(() => {\n    if (spot.current && aim.current) {');
    expect(lamp).toContain('aim.current.updateMatrixWorld();');
    const clip = canvas.slice(canvas.indexOf('function CameraClipping'), canvas.indexOf('const TRANSMISSION_SCALE'));
    expect(clip).toContain('useLayoutEffect(() => {');
  });

  it('carries the occlusion, the bloom and the vignette across with the print', () => {
    const lens = read('LensFocus.tsx');
    expect(lens).toContain("const toHall = journeyState.leg === 'interior' ? 1 : passageLight.grade;");
    expect(lens).toContain('aoLook.radius + (AO_HALL.radius - aoLook.radius) * toHall');
    const fx = read('PostFX.tsx');
    expect(fx).toContain('const g = hall ? 0 : passageLight.grade;');
    expect(fx).toContain('applyLook(bloom.current, vignette.current, rest.current, g, tier);');
    // In the set's own commit, not a frame after it.
    expect(fx).not.toMatch(/\buseEffect\(/);
  });

  it('takes the door\'s caption off with the first steps, and brings the room\'s up as the page is let go', () => {
    const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8').replace(/\r\n/g, '\n');
    expect(css).toContain("html[data-doorway='enter'][data-doorway-held='1'] [data-chapter-fade] {\n  opacity: 0 !important;");
    expect(css).toContain("html[data-doorway='enter'] [data-chapter-fade] {\n  transition: opacity 520ms ease-out;");
    // The establishing copy's filter comes on with it, not at the cut.
    expect(read('InteriorStage.tsx')).toContain(
      'establishNd.current += (stationWeights.establish - establishNd.current) * Math.min(1, delta * 6);',
    );
  });
});

// ── ONLY WHAT THE DOORWAY SHOWS ─────────────────────────────────────────────
describe("the pass's frustum, cropped to the doorway", () => {
  const W = 1920;
  const H = 1080;
  const OPENING = [...ESTATE_DOOR.min, ...ESTATE_DOOR.max] as unknown as readonly [number, number, number, number, number, number];
  const view = (z: number, y: number, fov: number, lookY = 3.2) => {
    const cam = new THREE.PerspectiveCamera(fov, W / H, 0.5, 400);
    cam.position.set(0, y, z);
    cam.lookAt(0, lookY, 8.25);
    cam.updateMatrixWorld();
    return {
      cam,
      vp: new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
    };
  };

  it('is a few per cent of the frame from the forecourt, and holds the whole opening', () => {
    const { cam, vp } = view(33.9, 6.7, 30.1);
    const rect = doorwayRect(vp, W, H, OPENING)!;
    expect(rect).not.toBeNull();
    expect((rect.w * rect.h) / (W * H)).toBeLessThan(0.05);
    // Every corner of the reveal lands inside it.
    for (const x of [ESTATE_DOOR.min[0], ESTATE_DOOR.max[0]]) {
      for (const y of [ESTATE_DOOR.min[1], ESTATE_DOOR.max[1]]) {
        for (const z of [ESTATE_DOOR.min[2], ESTATE_DOOR.max[2]]) {
          const p = new THREE.Vector3(x, y, z).project(cam);
          const px = (p.x * 0.5 + 0.5) * W;
          const py = (p.y * 0.5 + 0.5) * H;
          expect(px).toBeGreaterThanOrEqual(rect.x);
          expect(px).toBeLessThanOrEqual(rect.x + rect.w);
          expect(py).toBeGreaterThanOrEqual(rect.y);
          expect(py).toBeLessThanOrEqual(rect.y + rect.h);
        }
      }
    }
  });

  it('crops the frustum so the rectangle is the whole of clip space, and nothing moves on screen', () => {
    const { cam, vp } = view(24, 5.2, 30.1);
    const rect = doorwayRect(vp, W, H, OPENING)!;
    const sx = W / rect.w;
    const sy = H / rect.h;
    const crop = new THREE.Matrix4().set(
      sx, 0, 0, sx - 1 - (2 * rect.x) / rect.w,
      0, sy, 0, sy - 1 - (2 * rect.y) / rect.h,
      0, 0, 1, 0,
      0, 0, 0, 1,
    );
    const cropped = new THREE.Matrix4().multiplyMatrices(crop, vp);
    // A point of the room seen through the door: its pixel in the buffer is the
    // same whether it is drawn whole or through the crop into the rectangle.
    const point = new THREE.Vector3(0.6, 2.4, 2.0);
    const whole = point.clone().applyMatrix4(vp);
    const part = point.clone().applyMatrix4(cropped);
    expect(rect.x + (part.x * 0.5 + 0.5) * rect.w).toBeCloseTo((whole.x * 0.5 + 0.5) * W, 6);
    expect(rect.y + (part.y * 0.5 + 0.5) * rect.h).toBeCloseTo((whole.y * 0.5 + 0.5) * H, 6);
    // (three's applyMatrix4 divides by w.)
    expect(cam.fov).toBe(30.1);
  });

  it('gives the whole frame back once the opening is most of it, or the camera is in the doorway', () => {
    // At the sill, the lens open: the opening is the frame.
    expect(doorwayRect(view(9.6, 2.5, 46, 2.6).vp, W, H, OPENING)).toBeNull();
    // Between the door's two faces: a corner is behind the eye.
    expect(doorwayRect(view(8.25, 2.3, 46, 2.5).vp, W, H, OPENING)).toBeNull();
    // And it only grows on the way in.
    let last = 0;
    for (let z = 33.9; z > 10; z -= 1.5) {
      const r = doorwayRect(view(z, 2.2 + (z - 8) * 0.17, 30.1).vp, W, H, OPENING);
      const area = r ? r.w * r.h : W * H;
      expect(area).toBeGreaterThanOrEqual(last);
      last = area;
    }
  });
});
