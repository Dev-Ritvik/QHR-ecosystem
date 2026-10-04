// apps/public/src/components/experience/stationModel.test.ts
//
// The stations' site models (the refinement brief, section E): which style a
// station is built in, which layout stands on which table, the files the
// models ship as, and how the model is put on — and taken off — the hall's own
// station rig.

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MODEL_BRASS,
  MODEL_LIGHT,
  PLAN_MODELS,
  STAND,
  TRAY,
  parsePlanModel,
  planModelFor,
  planModelUrls,
} from './StationModel';
import { DEFAULT_STATION_STYLE, styleFromSearch } from './stationStyle';

const here = __dirname;
const publicDir = join(here, '..', '..', '..', 'public');
const source = (file: string) => readFileSync(join(here, file), 'utf8');

describe('how a station shows its layout', () => {
  it('is a site model, and the projection is one word away', () => {
    expect(DEFAULT_STATION_STYLE).toBe('model');
    expect(styleFromSearch('')).toBe('model');
    expect(styleFromSearch('?debug=1')).toBe('model');
    // The last physical model on these tables was sent back; the holograms
    // are kept whole and shown by a query on any build.
    expect(styleFromSearch('?stations=hologram')).toBe('hologram');
    expect(styleFromSearch('?debug=1&stations=hologram')).toBe('hologram');
    expect(styleFromSearch('?stations=model')).toBe('model');
    expect(styleFromSearch('?stations=lasers')).toBe('model');
  });

  it('builds one or the other, never both, and only the projection drifts', () => {
    const station = source('ProjectStation.tsx');
    expect(station).toContain("{style === 'hologram' ? (");
    expect(station).toContain('<StationDressing');
    expect(station).toContain('<StationModel');
    // A model someone is reading holds still: the idle turn is the hologram's.
    expect(station).toContain("} else if (style === 'hologram') {");
    expect(station).toContain('turntable={turntable}');
  });
});

describe('which layout stands on which table', () => {
  it("reads it from the station's own sanctioned sheet, then from the slug", () => {
    expect(planModelFor('kartikeya_holo_tex', undefined)).toBe('kartikeya');
    expect(planModelFor('lucky_holo_tex', 'anything')).toBe('lucky');
    expect(planModelFor(undefined, 'vsr-gayatri-township')).toBe('gayatri');
    expect(planModelFor('', 'kartikeya-water-front')).toBe('kartikeya');
    // A fourth project with no model made for it stands as a bare table.
    expect(planModelFor('new_holo_tex', 'a-fourth-layout')).toBeNull();
    expect(planModelFor(undefined, undefined)).toBeNull();
  });
});

describe("the models' files", () => {
  for (const plan of PLAN_MODELS) {
    it(`${plan}: solid blocks on the unit square, their face a multiple of four`, () => {
      const urls = planModelUrls(plan);
      const glb = join(publicDir, urls.geometry);
      const ktx = join(publicDir, urls.face);
      expect(existsSync(glb), urls.geometry).toBe(true);
      expect(existsSync(ktx), urls.face).toBe(true);

      const file = readFileSync(glb);
      const parts = parsePlanModel(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
      expect(Object.keys(parts).sort()).toEqual(['plan_board', 'plan_sides', 'plan_tops']);

      const tops = parts.plan_tops;
      const pos = tops.getAttribute('position');
      const uv = tops.getAttribute('uv');
      const nor = tops.getAttribute('normal');
      expect(pos.count).toBeGreaterThan(300);
      expect(tops.getIndex()!.count % 3).toBe(0);
      let high = 0;
      for (let i = 0; i < pos.count; i += 1) {
        // on the sheet's own square, a few centimetres proud of the board
        expect(Math.abs(pos.getX(i))).toBeLessThanOrEqual(0.5 + 1e-4);
        expect(Math.abs(pos.getZ(i))).toBeLessThanOrEqual(0.5 + 1e-4);
        expect(pos.getY(i)).toBeGreaterThan(0);
        high = Math.max(high, pos.getY(i));
        // the face runs 0..1 across it, v down from the sheet's top (-z)
        expect(uv.getX(i)).toBeCloseTo(pos.getX(i) + 0.5, 4);
        expect(uv.getY(i)).toBeCloseTo(pos.getZ(i) + 0.5, 4);
        expect(nor.getY(i)).toBe(1);
      }
      expect(high).toBeGreaterThanOrEqual(0.018);
      expect(high).toBeLessThanOrEqual(0.03);

      // the sides carry their own material's colour, and stand on the board
      const sides = parts.plan_sides;
      expect(sides.getAttribute('color')).toBeDefined();
      const sp = sides.getAttribute('position');
      let low = 1;
      for (let i = 0; i < sp.count; i += 1) low = Math.min(low, sp.getY(i));
      expect(low).toBe(0);

      // the face: a KTX2 whose sides the encoder's blocks divide
      const k = readFileSync(ktx);
      expect(k.subarray(1, 7).toString('latin1')).toBe('KTX 20');
      const w = k.readUInt32LE(20);
      const h = k.readUInt32LE(24);
      expect(w % 4).toBe(0);
      expect(h % 4).toBe(0);
      expect(Math.max(w, h)).toBeLessThanOrEqual(2048);
    });
  }
});

describe('how the model is put on the station', () => {
  const model = source('StationModel.tsx');

  it("puts the projection away without removing it, and brings it back on the way out", () => {
    // Everything under HOLO_Sn and the projector: the hall's own nodes, which
    // `?stations=hologram` wants as they were.
    expect(model).toContain('for (const o of [...holo.children, root.getObjectByName(`projector_${anchor.id}`)])');
    expect(model).toContain('for (const o of hidden) o.visible = true;');
    // Its own pieces hang on the hall's rig, so the door's eye sees them.
    expect(model).toContain('holo.add(spin);');
    expect(model).toContain('station.add(ball, column);');
    expect(model).toContain('holo.remove(spin, hub);');
    expect(model).toContain('station.remove(ball, column);');
  });

  it("turns with its table from the table's own rest, in its own plane", () => {
    // The tables stand in the hall's file at angles of their own; copying the
    // angle put the second model 37 degrees round on its stand.
    expect(model).toContain('if (table && rest.current === null) rest.current = table.rotation.y;');
    expect(model).toContain('b.spin.rotation.y = table && rest.current !== null ? table.rotation.y - rest.current : 0;');
  });

  it("takes the room from the hall's probe and its key from the chandelier", () => {
    expect(model).toContain('...PROBE_DEFINES, ESTATE_FOCUS');
    expect(model).toContain('trackHallMaterial(mat);');
    expect(model).toContain('untrackHallMaterials(list);');
    expect(model).toContain("replace('#include <lights_fragment_end>', KEY_LIGHT)");
    expect(model).toContain('const CHANDELIER = new THREE.Vector3(0, 10.9, 0);');
    // compiled with the hall, not on the frame a table first comes into view
    expect(model.match(/warmHallPrograms\(/g)!.length).toBeGreaterThanOrEqual(6);
  });

  it('is a quiet object: aged brass, a lit model no brighter than the room\'s plaster', () => {
    // The first cut's polished brass read as gold plate.
    expect(MODEL_BRASS.roughness).toBeGreaterThanOrEqual(0.4);
    expect(MODEL_BRASS.key).toBeLessThanOrEqual(0.6);
    expect(MODEL_LIGHT.power).toBeLessThanOrEqual(1.0);
    expect(MODEL_LIGHT.plaster).toBeLessThan(1);
    // the plaque fits its rail, and the rail is the tray's widest margin
    expect(TRAY.rail).toBeGreaterThan(TRAY.margin * 2);
    expect(TRAY.plaque.height).toBeLessThan(TRAY.rail - TRAY.fillet);
    expect(TRAY.bezelProud).toBeLessThan(0.02);
    expect(STAND.hubRadius).toBeGreaterThan(STAND.ball);
  });

  it('adds no light, beam, glow or lettering in the air', () => {
    for (const gone of ['beamMaterial', 'glassMaterial', 'giltLetters', 'titleTexture', 'calloutTexture', 'holoClock']) {
      expect(model, gone).not.toContain(gone);
    }
    // the ground under the turning table is kept, with no warm lift
    expect(model).toContain('glowMaterial(0, 1.2, 0.4)');
    expect(model).toContain('glowMaterial(0, 0.75, STAND.foot)');
  });
});
