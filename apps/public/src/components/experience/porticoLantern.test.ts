// apps/public/src/components/experience/porticoLantern.test.ts
//
// The portico's lantern, as a contract: it hangs where a lantern can hang
// (under the soffit, between the wall and the columns, clear of a head and of
// the door's leaves), and it is lit by the evening and not by the day.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANTERN, LANTERN_BODY, LANTERN_FROM, lanternOn } from './PorticoLantern';
import { DOORWAY } from './doorway';
import { ESTATE_ARCHITECTURE } from './estateBounds';

/** The portico as built (tools/blender/build_estate_v7.py): the wall face the
 *  door stands in, the line of the columns, the soffit, the floor. */
const PORTICO = { wall: 8.4, columns: 10.85, soffit: 4.4, floor: 0.6, columnsX: [-4.15, -1.75, 1.75, 4.15] };

describe('the portico lantern', () => {
  it('hangs from the soffit, on the door\'s axis, between the wall and the columns', () => {
    expect(LANTERN.soffit).toBe(PORTICO.soffit);
    expect(LANTERN.x).toBe(0);
    expect(LANTERN.z).toBeGreaterThan(PORTICO.wall + 0.6);
    expect(LANTERN.z).toBeLessThan(PORTICO.columns - 0.6);
    // Inside the house's own footprint: the mansion's box reaches the portico.
    const mansion = ESTATE_ARCHITECTURE.find((b) => b.name === 'mansion')!;
    expect(LANTERN.z).toBeLessThan(mansion.max[2]);
  });

  it('clears a head, and the leaves of the door as they swing', () => {
    const foot = LANTERN.soffit - LANTERN.chain - 0.14 - LANTERN.body.height - 0.09;
    // Two and a half metres over the portico floor.
    expect(foot - PORTICO.floor).toBeGreaterThan(2.5);
    // The leaves are hinged at the jambs and swing inward (doorway.ts), so the
    // lantern only has to stand off the door's own plane.
    expect(LANTERN.z - LANTERN.body.width / 2).toBeGreaterThan(DOORWAY.doorPlaneZ + 0.5);
  });

  it('is a lamp of a porch, not a floodlight: its light is spent on the forecourt', () => {
    // Inverse square: what reaches the wall behind it against what reaches a
    // point fifteen metres down the drive.
    const atWall = LANTERN.power / (LANTERN.z - PORTICO.wall) ** 2;
    const atDrive = LANTERN.power / 15 ** 2;
    expect(atWall / atDrive).toBeGreaterThan(80);
    expect(LANTERN.reach).toBeGreaterThan(20);
    // And the glass is a source to the bloom (its threshold outside is 1.0).
    expect(LANTERN.glow).toBeGreaterThan(1);
  });

  it('is dark by day, comes on with the evening and stays on through the night', () => {
    expect(lanternOn(0, 0)).toBe(0);
    expect(lanternOn(LANTERN_FROM[0], 0)).toBe(0);
    expect(lanternOn(1, 0)).toBe(1);
    expect(lanternOn(1, 1)).toBe(1);
    // A reading page that holds the night without the evening still has it lit.
    expect(lanternOn(0, 1)).toBe(1);
    let last = 0;
    for (let e = 0; e <= 1.0001; e += 0.05) {
      const on = lanternOn(e, 0);
      expect(on).toBeGreaterThanOrEqual(last);
      last = on;
    }
  });
});

// THE GENERATED BODY (the client's Tripo lantern; tools/blender/
// tripo_assets_v7.py and build_estate_v7.py). The site hangs it, lamps it and
// lights its glass; these hold the two files to the one place and the one name.
describe("the lantern's body, where the estate carries the generated one", () => {
  const src = readFileSync(join(__dirname, 'PorticoLantern.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const build = readFileSync(join(__dirname, '../../../../../tools/blender/build_estate_v7.py'), 'utf8').replace(/\r\n/g, '\n');
  const assets = readFileSync(join(__dirname, '../../../../../tools/blender/tripo_assets_v7.py'), 'utf8').replace(/\r\n/g, '\n');

  it('is found by the name the build gives it, and hangs where the chain ends', () => {
    expect(build).toContain(`tripo_object("lantern", "${LANTERN_BODY}", col,`);
    // The build's place and the site's are one place (three's z is Blender's -y).
    const at = /LANTERN_AT = \(([-\d.]+), ([-\d.]+)\)/.exec(build)!;
    expect(Number(at[1])).toBe(LANTERN.x);
    expect(-Number(at[2])).toBe(LANTERN.z);
    expect(build).toContain('LANTERN_TOP = 4.4 - 0.5');
    expect(LANTERN.soffit - LANTERN.chain).toBeCloseTo(4.4 - 0.5, 9);
    // ...and as tall as the library makes it.
    const height = Number(/LANTERN_HEIGHT = ([\d.]+)/.exec(build)![1]);
    expect(assets).toContain(`"lantern": {"height": ${height.toFixed(1)},`);
    // Clear of a head: its foot over the portico floor (0.6).
    expect(LANTERN.soffit - LANTERN.chain - height - 0.6).toBeGreaterThan(2.4);
  });

  it('is lit by its own glass, casts no shadow of the lamp inside it, and replaces the scripted cage', () => {
    expect(src).toContain("m.defines = { ...(m.defines ?? {}), ESTATE_EMITTER: '' };");
    expect(src).toContain('o.castShadow = false;');
    expect(src).toContain('if (cage.current) cage.current.visible = !body.current;');
    expect(src).toContain("if (body.current) body.current.material.emissiveIntensity = ld('lanternGlow', LANTERN.glow) * on;");
    // The glass is a mask of the model's own pale panes, made with the model.
    expect(assets).toContain('nt.links.new(node.outputs["Color"], bsdf.inputs["Emission Color"])');
  });

  it('is cut free of the wall bracket it was generated on', () => {
    expect(assets).toContain('"trim": "bracket"');
    expect(assets).toContain('if c.x - cx > wide[band(c.z)] * 1.03 + 0.004 * H:');
  });
});
