// apps/public/src/components/experience/hallDetails.test.ts
//
// Two small things in the hall, from the forensic audit of 2026-10-09: lamps
// the colour of their light (#45, #47) and one carpet colour (#50).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARPET, RUG_COLOUR, RUNNER_COLOUR } from './hallDetail';
import { HALL_GRADE } from './FilmGrade';

const read = (p: string) => readFileSync(join(__dirname, p), 'utf8').replace(/\r\n/g, '\n');
const hall = read('HallModel.tsx');

/** The lamp table as the file has it (HallModel pulls in the whole scene; the
 *  numbers are read from its source). */
function lamp(name: string): { colour: number[]; strength: number | null } {
  const m = new RegExp(`${name}: \\{ colour: \\[([\\d., ]+)\\](?:, strength: ([\\d.]+))? \\}`).exec(hall);
  if (!m) throw new Error(`no lamp ${name}`);
  return { colour: m[1].split(',').map(Number), strength: m[2] ? Number(m[2]) : null };
}

describe('a lamp the colour of its light', () => {
  it('prints a flame as a flame: its blue under the print’s shoulder after the balance', () => {
    // "The flames are pale blue-white while the light they throw on the wall
    // is warm." At a strength of 55 every channel was forty times the print's
    // white, and the hall's balance (less red, more blue) made that white a
    // blue one.
    const flame = lamp('MAT_SconceFlame');
    expect(flame.strength).not.toBeNull();
    expect(flame.strength!).toBeLessThan(20);
    expect(flame.strength!).toBeGreaterThan(5);
    const wb = HALL_GRADE.whiteBalance ?? [1, 1, 1];
    const through = flame.colour.map((c, i) => c * flame.strength! * wb[i]);
    // red well over green over blue as it reaches the curve: a warm light
    expect(through[0]).toBeGreaterThan(through[1] * 1.8);
    expect(through[1]).toBeGreaterThan(through[2] * 2.5);
    // and its blue no more than a couple of times the print's white (it was forty)
    expect(through[2]).toBeLessThan(2.5);
  });

  it("warms the picture lamp's tube and leaves its strength as the client had it turned down", () => {
    // "The lamp is a flat bar with a pale-blue glowing line, while the light
    // on the picture is amber." Only the tube: the light on the picture, the
    // print and the lens are his.
    const tube = lamp('MAT_PicLight');
    expect(tube.strength).toBeNull();
    expect(tube.colour[0]).toBeGreaterThan(tube.colour[1]);
    expect(tube.colour[1]).toBeGreaterThan(tube.colour[2] * 2);
    expect(hall).toContain('mat.emissiveIntensity *= PICTURE_LAMP;');
    expect(hall).toContain('if (lamp.strength !== undefined) mat.emissiveIntensity = lamp.strength;');
  });
});

describe('one carpet colour', () => {
  it('dyes the runner and the rug at the door with one ink, a slate and not a navy', () => {
    // "A saturated navy stair carpet stands against a red entrance rug in an
    // ivory room ... Expected: one carpet colour, deeper and less saturated."
    const [r, g, b] = CARPET.ink;
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b);
    // the navy it replaces was (0.16, 0.22, 0.42): 0.62
    expect(sat).toBeLessThan(0.5);
    expect(sat).toBeGreaterThan(0.2);
    expect(b).toBeGreaterThan(r);
    // deeper than the runner was (it was lifted by 1.15)
    expect(CARPET.depth).toBeLessThan(1.15);
    // the same dye on both: each texel keeps its own luminance, so the weave is as it was
    const dye = `vec3 carpetInk = vec3(${CARPET.ink.map((v) => v.toFixed(3)).join(', ')});`;
    expect(RUNNER_COLOUR).toContain(dye);
    expect(RUG_COLOUR).toContain(dye);
    expect(RUG_COLOUR).toContain('float carpetLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));');
    // the rug keeps its own weave and takes none of the runner's pile
    expect(RUG_COLOUR).not.toContain('pileNoise');
    expect(read('hallDetail.ts')).toContain('const RUG_RE = /^MAT_Rug(Field|Border2?)$/;');
  });
});
