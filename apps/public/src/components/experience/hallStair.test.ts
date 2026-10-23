// apps/public/src/components/experience/hallStair.test.ts
//
// The stair's strings, closed (the forensic audit of 2026-10-09, #44: "A black
// wedge-shaped gap opens at every step between the stringer and the treads
// ... Expected: a closed stringer with a crisp cap").

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { STAIR_STRINGS, closeString, closeStrings } from './hallStair';

const C = STAIR_STRINGS.centre;
const [OUTER, INNER] = STAIR_STRINGS.caps;

/**
 * A stand-in cap on a circle of radius `r` about the stair's centre: its open
 * face (looking `side` of the circle) in facets between sections, and its top
 * sharing the face's upper corners. The first `climbing` facets rise with a
 * flight; the rest run level, as the inner cap does across the landing.
 */
function cap(r: number, side: 1 | -1, climbing: number, level: number) {
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv1: number[] = [];
  const idx: number[] = [];
  const sections = climbing + level + 1;
  const at = (k: number) => {
    const a = 2.2 + k * 0.025;
    const y = Math.min(k, climbing) * 0.087;
    return { x: C.x + Math.cos(a) * r, z: C.z + Math.sin(a) * r, y, a };
  };
  for (let k = 0; k < sections - 1; k += 1) {
    const s0 = at(k);
    const s1 = at(k + 1);
    const mid = (s0.a + s1.a) / 2;
    const nx = Math.cos(mid) * side;
    const nz = Math.sin(mid) * side;
    const base = pos.length / 3;
    // the face: top and foot of each end, the light's island top (u 0.1) to foot (u 0.2)
    for (const [s, kk] of [[s0, k], [s1, k + 1]] as const) {
      pos.push(s.x, s.y + 0.49, s.z, s.x, s.y, s.z);
      nrm.push(nx, 0, nz, nx, 0, nz);
      uv1.push(0.1, 0.01 * kk, 0.2, 0.01 * kk);
    }
    idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    // the top, sharing the face's upper corners
    const top = pos.length / 3;
    for (const s of [s0, s1]) {
      pos.push(s.x, s.y + 0.49, s.z);
      nrm.push(0, 1, 0);
      uv1.push(0.5, 0.5);
    }
    const inner = { x: C.x + Math.cos(mid) * (r - side * 0.23), z: C.z + Math.sin(mid) * (r - side * 0.23) };
    pos.push(inner.x, s0.y + 0.49, inner.z);
    nrm.push(0, 1, 0);
    uv1.push(0.5, 0.5);
    idx.push(top, top + 1, top + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
  g.setIndex(idx);
  return g;
}

const radius = (g: THREE.BufferGeometry, i: number) =>
  Math.hypot(g.attributes.position.getX(i) - C.x, g.attributes.position.getZ(i) - C.z);

describe('a cap of the stair', () => {
  it('stands proud of the step ends where it climbs with a flight, and is lit from its top band', () => {
    const src = cap(OUTER.face, 1, 6, 0);
    const out = closeString(src, OUTER);
    const n = out.attributes.normal;
    const uv = out.attributes.uv1;
    for (let i = 0; i < out.attributes.position.count; i += 1) {
      const upright = Math.abs(n.getY(i)) < 0.1;
      if (upright) {
        // the face, a hand's breadth in front of nothing: 12 mm proud of the steps' 4.6 m
        expect(radius(out, i)).toBeCloseTo(OUTER.steps + STAIR_STRINGS.proud, 4);
        // its light from a tenth of the way down from its top, top to foot
        expect(uv.getX(i)).toBeCloseTo(0.1 + STAIR_STRINGS.band * 0.1, 6);
      } else if (radius(src, i) > OUTER.face - 0.01) {
        // the top's outer corners go with it
        expect(radius(out, i)).toBeCloseTo(OUTER.steps + STAIR_STRINGS.proud, 4);
        expect(uv.getX(i)).toBe(0.5);
      } else {
        // its inner edge does not move
        expect(radius(out, i)).toBeCloseTo(radius(src, i), 6);
      }
    }
    // the parse's own geometry is not touched: every mount of the hall shares it
    expect(radius(src, 0)).toBeCloseTo(OUTER.face, 5);
    expect(src.attributes.uv1.getX(1)).toBeCloseTo(0.2, 6);
  });

  it('stands in front of the step ends toward the well on the inner edge, and is left where it runs level', () => {
    const src = cap(INNER.face, -1, 4, 4);
    const out = closeString(src, INNER);
    const p = out.attributes.position;
    const n = out.attributes.normal;
    const proud = INNER.steps - STAIR_STRINGS.proud;
    let climbing = 0;
    let level = 0;
    for (let i = 0; i < p.count; i += 1) {
      if (Math.abs(n.getY(i)) > 0.1) continue;
      const section = Math.round((Math.atan2(p.getZ(i) - C.z, p.getX(i) - C.x) - 2.2) / 0.025);
      // the section where the flight meets the landing is the last that moves
      if (section <= 4) {
        expect(radius(out, i)).toBeCloseTo(proud, 4);
        climbing += 1;
      } else {
        expect(radius(out, i)).toBeCloseTo(INNER.face, 5);
        level += 1;
      }
    }
    expect(climbing).toBeGreaterThan(0);
    expect(level).toBeGreaterThan(0);
  });

  it('is found by the model’s names, closed once however many mounts share it, and never twice', () => {
    for (const name of ['bal_plinth_outL', 'bal_plinth_outR']) expect(OUTER.re.test(name)).toBe(true);
    expect(INNER.re.test('bal_plinth_in')).toBe(true);
    for (const name of ['bal_rail_outL', 'bal_plinth_outL_2', 'stair_flight_L', 'bal_1_l3']) {
      expect(STAIR_STRINGS.caps.some((c) => c.re.test(name))).toBe(false);
    }
    const shared = cap(OUTER.face, 1, 6, 0);
    const mat = new THREE.MeshStandardMaterial();
    const hall = () => {
      const root = new THREE.Group();
      for (const name of ['bal_plinth_outL', 'bal_rail_outL']) {
        const m = new THREE.Mesh(shared, mat);
        m.name = name;
        root.add(m);
      }
      return root;
    };
    const a = hall();
    expect(closeStrings(a)).toBe(1);
    const [capA, rail] = a.children as THREE.Mesh[];
    expect(capA.geometry).not.toBe(shared);
    expect(rail.geometry).toBe(shared);
    // a second mount takes the same closed geometry
    const b = hall();
    closeStrings(b);
    expect((b.children[0] as THREE.Mesh).geometry).toBe(capA.geometry);
    // and a pass run again on a mount does not bring the face out a second time
    const before = radius(capA.geometry, 0);
    closeStrings(a);
    expect(capA.geometry).toBe((b.children[0] as THREE.Mesh).geometry);
    expect(radius(capA.geometry, 0)).toBeCloseTo(before, 6);
    // and it is done where the hall is furnished
    const model = readFileSync(join(__dirname, 'HallModel.tsx'), 'utf8');
    expect(model).toContain('closeStrings(root);');
  });
});
