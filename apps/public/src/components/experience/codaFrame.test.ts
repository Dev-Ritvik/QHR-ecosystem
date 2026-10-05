// apps/public/src/components/experience/codaFrame.test.ts
//
// The film's last frame is composed for the colophon that stands on it: the
// lit map table beside the sign-off on a wide frame, above it on a phone.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CODA_AIM, CODA_CAMERA, CODA_SCROLL, HALL_AIM_OFFSET, codaEase, codaPose, codaProgress } from './codaFrame';
import { buildInteriorBeats } from './interiorPath';
import { HEADER_BAND } from './lensFilter';
import { MAP_TABLE, MAP_TOP } from './mapTablePlan';
import {
  PHONE_CODA,
  PHONE_FRAMING,
  TABLET_CODA,
  applyShift,
  codaFrameFor,
  phoneFrameInCoda,
  phoneWeight,
  tabletWeight,
  widenFov,
} from './phoneFraming';

const canvas = readFileSync(join(__dirname, 'WorldCanvas.tsx'), 'utf8').replace(/\r\n/g, '\n');

const map = buildInteriorBeats(3).find((b) => b.id === 'map')!;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * The camera `e` of the way through the coda on a frame of this size, as
 * WorldCanvas makes it: the path's last pose, carried by codaPose, aimed left
 * of its target by the offset along its own right vector, through the lens of
 * the map's beat — and, on a frame taller than it is wide, the phone's.
 */
function cameraAt(e: number, width: number, height: number): THREE.PerspectiveCamera {
  const aspect = width / height;
  const upright = phoneWeight(aspect);
  const position = new THREE.Vector3(...map.position);
  const look = new THREE.Vector3(...map.target);
  const offset = codaPose(e, upright, position, look);
  const fwd = look.clone().sub(position).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
  look.addScaledVector(right, -offset);

  const pf = phoneFrameInCoda(PHONE_FRAMING.map, e, width);
  const widen = 1 + (pf.widen - 1) * upright;
  const cam = new THREE.PerspectiveCamera(widenFov(map.fov, widen), aspect, 0.1, 100);
  cam.position.copy(position);
  cam.lookAt(look);
  applyShift(cam, aspect, pf.rise * upright, pf.shift * upright);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return cam;
}

/** Where a circle of the table's top stands on the screen: fractions of the
 *  frame from its top-left (what MapTable publishes as mapStage.screen). */
function onScreen(cam: THREE.PerspectiveCamera, radius: number) {
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (let i = 0; i < 96; i += 1) {
    const a = (i / 96) * Math.PI * 2;
    const v = new THREE.Vector3(
      MAP_TABLE.x + radius * Math.cos(a),
      MAP_TABLE.topY,
      MAP_TABLE.z + radius * Math.sin(a),
    ).project(cam);
    l = Math.min(l, (v.x + 1) / 2);
    r = Math.max(r, (v.x + 1) / 2);
    t = Math.min(t, (1 - v.y) / 2);
    b = Math.max(b, (1 - v.y) / 2);
  }
  return { l, t, r, b };
}

/**
 * THE COLOPHON AT THE PAGE'S END, measured on the built page (the words of
 * each line, as fractions of the frame): how far across the sign-off's column
 * reaches, and how far down the first row of links stands.
 */
const COLOPHON_END: Record<string, { signOffRight: number; linksTop: number }> = {
  '1440x900': { signOffRight: 0.392, linksTop: 0.667 },
  '1536x730': { signOffRight: 0.432, linksTop: 0.626 },
  '1920x945': { signOffRight: 0.415, linksTop: 0.671 },
  '1920x1080': { signOffRight: 0.401, linksTop: 0.683 },
  '2560x1300': { signOffRight: 0.41, linksTop: 0.697 },
  '1366x657': { signOffRight: 0.451, linksTop: 0.569 },
  '1280x593': { signOffRight: 0.474, linksTop: 0.554 },
  '1024x768': { signOffRight: 0.378, linksTop: 0.632 },
  '1280x1024': { signOffRight: 0.37, linksTop: 0.693 },
};

describe("the coda's move", () => {
  it('is the move WorldCanvas makes', () => {
    expect(canvas).toContain('offset = HALL_AIM_OFFSET;');
    expect(canvas).toMatch(
      /offset = codaPose\(\s*codaEase\(coda\),\s*phoneWeight\(size\.width \/ Math\.max\(1, size\.height\)\),\s*desired\.current,\s*look\.current,\s*\);/,
    );
    expect(canvas).toMatch(
      /phoneFrameInCoda\(\s*phoneFrameAt\(interior\.beats, journeyState\.legProgress, size\.width\),\s*codaEase\(journeyState\.coda\),\s*size\.width,\s*\)/,
    );
    // ...and the offset is applied along the camera's own right vector.
    expect(canvas).toContain('look.current.addScaledVector(right.current, -offset);');
  });

  it('begins after the list of layouts has left, and is over before the sign-off stands whole', () => {
    expect(canvas).toContain("journeyState.coda = journeyState.leg === 'interior' ? codaProgress(past) : 0;");
    expect(codaProgress(0)).toBe(0);
    expect(codaProgress(CODA_SCROLL.from)).toBe(0);
    expect(codaProgress(CODA_SCROLL.from + CODA_SCROLL.over)).toBe(1);
    expect(codaProgress(9)).toBe(1);
    expect(codaProgress(CODA_SCROLL.from + CODA_SCROLL.over / 2)).toBeCloseTo(0.5, 9);
    // The page's unit is 1.1 of the frame's height (the journey driver's).
    // Measured on a laptop's 1536x730, in frames before the page's end: the
    // coda's first frame at 1.27; the sign-off whole in the frame (its foot
    // at the frame's foot) at 0.53; the first row of links coming in at 0.37.
    const framesToUnits = 1 / 1.1;
    const codaBegins = 1.27;
    const at = (framesBeforeEnd: number) =>
      codaEase(codaProgress(CODA_SCROLL.from + (codaBegins - framesBeforeEnd) * framesToUnits));
    // all but done when the sign-off stands whole (it was 0.84 of the way)...
    expect(at(0.53)).toBeGreaterThan(0.95);
    // ...and at rest before the links come in.
    expect(at(0.37)).toBe(1);
  });

  it('begins exactly where the film ends, and comes to rest at both ends', () => {
    const p = new THREE.Vector3(1, 2, 3);
    const l = new THREE.Vector3(4, 5, 6);
    expect(codaPose(0, 0, p, l)).toBe(HALL_AIM_OFFSET);
    expect(p.toArray()).toEqual([1, 2, 3]);
    expect(l.toArray()).toEqual([4, 5, 6]);
    expect(codaEase(0)).toBe(0);
    expect(codaEase(1)).toBe(1);
    expect(codaEase(-1)).toBe(0);
    expect(codaEase(2)).toBe(1);
    // no speed at either end
    expect(codaEase(0.001)).toBeLessThan(1e-5);
    expect(1 - codaEase(0.999)).toBeLessThan(1e-5);
  });

  it('rises off the table and eases back, on every frame', () => {
    for (const upright of [0, 1]) {
      const p = new THREE.Vector3(...map.position);
      const l = new THREE.Vector3(...map.target);
      codaPose(1, upright, p, l);
      expect(p.y - map.position[1]).toBeCloseTo(CODA_CAMERA.y, 9);
      expect(p.z - map.position[2]).toBeCloseTo(CODA_CAMERA.z, 9);
      expect(p.x - map.position[0]).toBeCloseTo(CODA_CAMERA.x, 9);
    }
  });

  it('keeps the aim it always had on a phone held upright: there the lens does the placing', () => {
    const p = new THREE.Vector3(...map.position);
    const l = new THREE.Vector3(...map.target);
    expect(codaPose(1, 1, p, l)).toBe(HALL_AIM_OFFSET);
    expect(l.y - map.target[1]).toBeCloseTo(CODA_AIM.upright.y, 9);
    expect(CODA_AIM.upright.y).toBeGreaterThan(0);
    expect(CODA_AIM.wide.y).toBeLessThan(0);
    expect(CODA_AIM.wide.offset).toBeGreaterThan(HALL_AIM_OFFSET);
  });
});

describe('the last frame on a wide frame', () => {
  it('stands the table beside the sign-off, clear of its column', () => {
    for (const [size, c] of Object.entries(COLOPHON_END)) {
      const [w, h] = size.split('x').map(Number);
      const rim = onScreen(cameraAt(1, w, h), MAP_TABLE.radius);
      // right of the sign-off's last word, by a clear twentieth of the frame
      expect(rim.l - c.signOffRight, size).toBeGreaterThan(0.05);
      // and whole within the frame
      expect(rim.r, size).toBeLessThan(0.95);
    }
  });

  it('and above the first row of links, on every size of desk and laptop', () => {
    for (const [size, c] of Object.entries(COLOPHON_END)) {
      const [w, h] = size.split('x').map(Number);
      const rim = onScreen(cameraAt(1, w, h), MAP_TABLE.radius);
      // (the picture keeps its height: the table's rows are the same on all)
      expect(rim.b, size).toBeLessThan(0.52);
      // clear by more than the lens's reach (CODA_FADE.reach): it stays lit
      expect(c.linksTop - rim.b, size).toBeGreaterThan(0.04);
    }
  });

  it("with its lit relief below the header's band", () => {
    const relief = onScreen(cameraAt(1, 1440, 900), MAP_TOP.reliefRadius);
    expect(relief.t).toBeGreaterThanOrEqual(HEADER_BAND.zero);
    const rim = onScreen(cameraAt(1, 1440, 900), MAP_TABLE.radius);
    // the rim's far edge, which is walnut, is in the last of the band's fall:
    // an eighth of a stop
    const t = (rim.t - HEADER_BAND.full) / (HEADER_BAND.zero - HEADER_BAND.full);
    expect(HEADER_BAND.hall * (1 - t * t * (3 - 2 * t))).toBeLessThan(0.15);
  });

  it('gets there before the sign-off has come up beside it', () => {
    // The sign-off enters the foot of the frame four-tenths of the way through
    // the coda and is not as high as the table's foot until eight-tenths
    // (measured at 1440x900: its eyebrow at the frame's foot at 0.43, its
    // block from 59% down at 0.83). From six-tenths on the table is already
    // clear of its column, on every size. (Whatever a frame's layout does,
    // no line stands ON the lit table: the lens sees to that — codaFilter.)
    for (const [size, c] of Object.entries(COLOPHON_END)) {
      const [w, h] = size.split('x').map(Number);
      for (let coda = 0.6; coda <= 1.0001; coda += 0.05) {
        const rim = onScreen(cameraAt(codaEase(coda), w, h), MAP_TABLE.radius);
        expect(rim.l, `${size} at ${coda.toFixed(2)}`).toBeGreaterThan(c.signOffRight);
      }
    }
  });

  it('is the same picture against the same copy at every wide size: placed from the middle of the frame', () => {
    // The copy's grid is centred and set in the frame's unit; the picture
    // keeps its height. So the table's distance from the middle, in frame
    // heights, is one number.
    const at = (w: number, h: number) => {
      const rim = onScreen(cameraAt(1, w, h), MAP_TABLE.radius);
      return ((rim.l + rim.r) / 2 - 0.5) * (w / h);
    };
    const design = at(1440, 900);
    for (const [w, h] of [[1536, 730], [1920, 945], [1366, 657], [1280, 593], [2560, 1300], [844, 390]]) {
      expect(at(w, h)).toBeCloseTo(design, 6);
    }
  });
});

describe('the last frame on a phone', () => {
  it('takes the whole of the coda frame on a phone held upright and none of it on a landscape screen', () => {
    expect(phoneFrameInCoda(PHONE_FRAMING.map, 0)).toBe(PHONE_FRAMING.map);
    expect(phoneFrameInCoda(PHONE_FRAMING.map, 1)).toEqual(PHONE_CODA);
    const half = phoneFrameInCoda(PHONE_FRAMING.map, 0.5);
    expect(half.rise).toBeCloseTo((PHONE_FRAMING.map.rise + PHONE_CODA.rise) / 2, 9);
    // the map's own frame is untouched: the table low, under the list
    expect(PHONE_FRAMING.map.rise).toBeLessThan(0);
    expect(PHONE_CODA.rise).toBeGreaterThan(0);
  });

  it('raises the table to the upper part of the frame, at the width of the screen', () => {
    for (const [w, h] of [[390, 844], [412, 915], [360, 640], [430, 932]]) {
      const rim = onScreen(cameraAt(1, w, h), MAP_TABLE.radius);
      const size = `${w}x${h}`;
      // under the header, over the middle of the frame
      expect(rim.t, size).toBeGreaterThan(0.2);
      expect(rim.b, size).toBeLessThan(0.45);
      // whole within the frame's width
      expect(rim.l, size).toBeGreaterThan(0.05);
      expect(rim.r, size).toBeLessThan(0.95);
    }
    // on a phone it has the screen's width
    const rim = onScreen(cameraAt(1, 390, 844), MAP_TABLE.radius);
    expect(rim.r - rim.l).toBeGreaterThan(0.7);
  });

  it('leaves room beneath it for the whole sign-off, lit', () => {
    // The sign-off is 39% of a 390x844 frame tall (measured: its eyebrow's top
    // to the foot of its telephone number). It can stand whole under the
    // table with the lens still open: the table's foot, the lens's reach, the
    // block.
    const rim = onScreen(cameraAt(1, 390, 844), MAP_TABLE.radius);
    expect(rim.b + 0.04 + 0.39).toBeLessThan(1);
  });

  it('is the phone up to the largest phone, and the tablet from the smallest tablet', () => {
    for (const w of [320, 360, 390, 430, 480, 600, 640]) expect(tabletWeight(w)).toBe(0);
    for (const w of [744, 768, 820, 1024]) expect(tabletWeight(w)).toBe(1);
    expect(codaFrameFor(390)).toBe(PHONE_CODA);
    expect(codaFrameFor(820)).toBe(TABLET_CODA);
    const between = codaFrameFor(690);
    expect(between.shift).toBeLessThan(PHONE_CODA.shift);
    expect(between.shift).toBeGreaterThan(TABLET_CODA.shift);
  });

  it('starts from the frame the list of layouts was read on', () => {
    const before = onScreen(cameraAt(0, 390, 844), MAP_TABLE.radius);
    // (the map's beat: the table low in the frame)
    expect(before.t).toBeGreaterThan(0.6);
  });
});

describe('the last frame on a tablet held upright', () => {
  // The colophon at the page's end on each, measured on the built page: how
  // far across the sign-off's words reach, and where its block and the first
  // row of links stand.
  const TABLETS: Record<string, { signOffRight: number; signOffTop: number; linksTop: number }> = {
    '768x1024': { signOffRight: 0.509, signOffTop: 0.221, linksTop: 0.648 },
    '810x1080': { signOffRight: 0.482, signOffTop: 0.294, linksTop: 0.708 },
    '820x1180': { signOffRight: 0.476, signOffTop: 0.34, linksTop: 0.732 },
    '834x1194': { signOffRight: 0.468, signOffTop: 0.346, linksTop: 0.735 },
    '744x1133': { signOffRight: 0.525, signOffTop: 0.238, linksTop: 0.64 },
    '1024x1366': { signOffRight: 0.38, signOffTop: 0.414, linksTop: 0.78 },
  };

  it('stands the table beside the sign-off, on the right, where a phone has no room', () => {
    for (const [size, c] of Object.entries(TABLETS)) {
      const [w, h] = size.split('x').map(Number);
      const rim = onScreen(cameraAt(1, w, h), MAP_TABLE.radius);
      // clear of the sign-off's last word by more than the lens asks (CODA_FADE.beside)
      expect(rim.l - c.signOffRight, size).toBeGreaterThan(0.04);
      expect(rim.r, size).toBeLessThan(1);
      // in the upper part of the frame, under the header
      expect(rim.t, size).toBeGreaterThan(0.2);
      expect(rim.b, size).toBeLessThan(0.42);
      // and well above the first row of links
      expect(c.linksTop - rim.b, size).toBeGreaterThan(0.2);
    }
  });

  it('where the phone\'s frame would have closed the lens at the page\'s end', () => {
    // The sign-off ends in the table's band of the frame's height on every
    // one of them: under the phone's frame its headline stood across the rim.
    for (const [size, c] of Object.entries(TABLETS)) {
      const phoneRim = { t: 0.209, b: 0.429 };
      expect(c.signOffTop, size).toBeLessThan(phoneRim.b + 0.04);
    }
  });
});
