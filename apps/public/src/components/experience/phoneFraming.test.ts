// apps/public/src/components/experience/phoneFraming.test.ts
//
// The phone's lens: the tables exactly as they are, the portrait and the map
// reframed, and nothing at all on a landscape screen.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildInteriorBeats } from './interiorPath';
import {
  PHONE_CODA,
  PHONE_FRAMING,
  TABLET_TABLES,
  applyShift,
  phoneFrameAt,
  phoneFrameInCoda,
  phoneWeight,
  widenFov,
} from './phoneFraming';

const beats = buildInteriorBeats(3);
const atBeat = (pred: (b: (typeof beats)[number]) => boolean) => beats.find(pred)!.at;

describe('the phone lens', () => {
  it('stands each table’s site model whole in the frame, and holds it there through the dwell', () => {
    // While the plans were projected in light the tables took no phone lens,
    // and the plan ran off the right edge of every upright screen.
    for (const b of beats.filter((x) => x.station)) {
      const f = phoneFrameAt(beats, b.at);
      expect(f).toEqual(PHONE_FRAMING[b.id]);
      // wider, and the front shifted so the model comes left into the frame
      expect(f.widen).toBeGreaterThan(1.2);
      expect(f.shift).toBeGreaterThan(0.1);
      const dwell = beats.find((x) => x.id === `dwell-${b.station}`);
      if (dwell) expect(phoneFrameAt(beats, dwell.at)).toEqual(f);
      // a tablet held upright is wider for its height and needs less of both
      expect(phoneFrameAt(beats, b.at, 390)).toEqual(f);
      expect(phoneFrameAt(beats, b.at, 820)).toEqual(TABLET_TABLES);
      expect(TABLET_TABLES.widen).toBeLessThan(f.widen);
    }
    // the other beats do not change with the screen's width
    const portrait = atBeat((x) => x.id === 'portrait');
    expect(phoneFrameAt(beats, portrait, 820)).toEqual(phoneFrameAt(beats, portrait, 390));
    // The projection keeps the frame it always had (`?stations=hologram`).
    const src = readFileSync(join(__dirname, 'phoneFraming.ts'), 'utf8').replace(/\r\n/g, '\n');
    expect(src).toContain("if (stationStyle() === 'hologram') return NONE;");
  });

  it('reframes the portrait and the map', () => {
    expect(phoneFrameAt(beats, atBeat((b) => b.id === 'portrait'))).toEqual(PHONE_FRAMING.portrait);
    expect(phoneFrameAt(beats, atBeat((b) => b.id === 'map'))).toEqual(PHONE_FRAMING.map);
    expect(PHONE_FRAMING.portrait.rise).toBeGreaterThan(0);
    expect(PHONE_FRAMING.map.rise).toBeLessThan(0);
  });

  it("goes on from the map's frame to the coda's, and is the map's own until the coda begins", () => {
    const at = phoneFrameAt(beats, 1);
    expect(at).toEqual(PHONE_FRAMING.map);
    expect(phoneFrameInCoda(at, 0)).toBe(at);
    expect(phoneFrameInCoda(at, 1)).toEqual(PHONE_CODA);
    expect(phoneFrameInCoda(at, 2)).toEqual(PHONE_CODA);
    expect(phoneFrameInCoda(at, 1, 390)).toBe(PHONE_CODA);
    // the table goes UP the frame (the map's frame holds it low), and closer
    expect(PHONE_CODA.rise).toBeGreaterThan(PHONE_FRAMING.map.rise);
    expect(PHONE_CODA.widen).toBeLessThan(PHONE_FRAMING.map.widen);
    expect(PHONE_CODA.widen).toBeGreaterThanOrEqual(1);
  });

  it('keeps the door passage and the first frame inside as they are', () => {
    expect(phoneFrameAt(beats, 0)).toEqual({ widen: 1, rise: 0, shift: 0 });
  });

  it('is the whole lens on a phone and none on a landscape screen', () => {
    expect(phoneWeight(390 / 844)).toBe(1);
    expect(phoneWeight(1440 / 900)).toBe(0);
    expect(phoneWeight(1)).toBe(0);
  });

  it('opens the field on the tangent', () => {
    expect(widenFov(40, 1)).toBe(40);
    const w = widenFov(40, 1.35);
    expect(Math.tan((w * Math.PI) / 360)).toBeCloseTo(Math.tan((40 * Math.PI) / 360) * 1.35, 6);
  });
});

describe('the shifted front', () => {
  const camera = () => {
    const c = new THREE.PerspectiveCamera(40, 390 / 844, 0.1, 100);
    c.position.set(0, 0, 0);
    c.lookAt(0, 0, -1);
    c.updateMatrixWorld();
    return c;
  };

  it("keeps the picture's proportions (a view offset writes the aspect)", () => {
    const c = camera();
    applyShift(c, 390 / 844, 0.2, 0.1);
    expect(c.aspect).toBeCloseTo(390 / 844, 9);
  });

  it('moves the subject up by `rise` of the height and left by `shift` of the width', () => {
    const c = camera();
    applyShift(c, 390 / 844, 0.2, 0.1);
    const p = new THREE.Vector3(0, 0, -10).project(c);
    // NDC spans 2 across the frame: 0.2 of the height is 0.4 of NDC.
    expect(p.y).toBeCloseTo(0.4, 6);
    expect(p.x).toBeCloseTo(-0.2, 6);
  });

  it('clears to the plain lens at zero', () => {
    const c = camera();
    applyShift(c, 390 / 844, 0.2, 0);
    applyShift(c, 390 / 844, 0, 0);
    expect(c.view?.enabled ?? false).toBe(false);
    const p = new THREE.Vector3(0, 0, -10).project(c);
    expect(p.y).toBeCloseTo(0, 6);
    expect(c.aspect).toBeCloseTo(390 / 844, 9);
  });
});
