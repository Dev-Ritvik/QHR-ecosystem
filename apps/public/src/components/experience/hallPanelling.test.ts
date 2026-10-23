// apps/public/src/components/experience/hallPanelling.test.ts
//
// The hall's panelling as joinery: where it goes, how it is divided, and that
// every face of it looks into the room.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DOOR,
  Mesher,
  SLEEVE,
  WAINSCOT,
  doorLeaf,
  fieldedPanel,
  frameFace,
  moulding,
  openingsAcross,
  panelHall,
  sleeveColumns,
  surveyPanelling,
  tiers,
  wainscot,
} from './hallPanelling';
import { WALNUT_SHEET, type WalnutStock } from './hallWalnut';
import { HALL_FRONT } from './doorPortal';

const W = WAINSCOT;

/** The hall as delivered, in the pieces the panelling reads: four walls, the
 *  skirting, columns down the side walls, the slabs, the doors. */
function hall() {
  const root = new THREE.Group();
  const add = (name: string, size: [number, number, number], at: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ name: 'MAT_Wood_Dark' }));
    m.name = name;
    m.position.set(...at);
    root.add(m);
    return m;
  };
  add('int_wall_left', [0.3, 13, 15.4], [-10.05, 6.5, 0]);
  add('int_wall_right', [0.3, 13, 15.4], [10.05, 6.5, 0]);
  add('int_wall_back', [20.4, 13, 0.3], [0, 6.5, -7.85]);
  add('int_wall_front', [20.4, 13, 0.3], [0, 6.5, 7.85]);
  add('int_skirt_l', [0.2, 0.4, 15.4], [-9.8, 0.2, 0]);
  for (const z of [-7.2, -4.8, -2.4, 0, 2.4, 4.8, 7.2]) {
    add(`pilaster_-1_${z.toFixed(1)}`, [0.7, 5.7, 0.6], [-9.65, 3.25, z]);
    add(`pilaster_1_${z.toFixed(1)}`, [0.7, 5.7, 0.6], [9.65, 3.25, z]);
    add(`pilaster_-1_${z.toFixed(1)}_up`, [0.4, 3.4, 0.4], [-9.8, 9.9, z]);
  }
  const slabs: THREE.Mesh[] = [];
  for (const z of [-6, -3.6, -1.2, 1.2, 3.6, 6]) {
    slabs.push(add(`wallpanel_-1_${z}`, [0.56, 2.07, 2.112], [-9.78, 1.56, z]));
    slabs.push(add(`wallpanel_1_${z}`, [0.56, 2.07, 2.112], [9.78, 1.56, z]));
  }
  for (const x of [-8, -5.4, -2.8, 2.8, 5.4, 8]) slabs.push(add(`wallpanel_f_${x}`, [2.112, 2.07, 0.39], [x, 1.56, 7.58]));
  add('int_doors', [2.99, 4.255, 0.115], [0, 2.1275, 7.631]);
  return { root, slabs };
}

const stock = (): WalnutStock => ({
  fields: 0,
  material: (_cut, name, params) => Object.assign(new THREE.MeshStandardMaterial(params), { name }),
  dispose() {},
});

describe('where the panelling goes', () => {
  it('is one run to a side wall, corner to corner, and one either side of the doors', () => {
    const { root } = hall();
    const { runs, doors, slabs } = surveyPanelling(root);
    expect(slabs).toHaveLength(18);
    expect(runs).toHaveLength(4);
    const side = runs.filter((r) => Math.abs(r.inward.x) === 1);
    const front = runs.filter((r) => Math.abs(r.inward.z) === 1);
    expect(side).toHaveLength(2);
    expect(front).toHaveLength(2);
    for (const r of side) {
      // the whole wall, behind the columns
      expect(r.length).toBeCloseTo(15.4, 5);
      expect(r.ends).toEqual([false, false]);
      // on the wall's face, at the skirting's top
      expect(Math.abs(r.origin.x)).toBeCloseTo(9.9, 5);
      expect(r.origin.y).toBeCloseTo(0.4, 5);
      // to a little over the old slabs' top edge: the bake's dark rim round
      // each ends five centimetres above it
      expect(r.origin.y + r.height).toBeCloseTo(2.595 + W.over, 5);
      // a clear stretch between each pair of columns, and none worth an
      // opening between the last column and the corner
      expect(r.spans).toHaveLength(6);
      for (const [a, b] of r.spans) expect(b - a).toBeCloseTo(2.4 - 2 * 0.3 * W.column, 5);
    }
    for (const r of front) {
      // from the corner to short of the doors
      expect(r.length).toBeCloseTo(9.9 - 1.495 - W.jamb, 5);
      // the end by the doors shows; the corner's does not
      expect(r.ends.filter(Boolean)).toHaveLength(1);
      expect(r.inward.z).toBe(-1);
    }
    // right-handed, so nothing is built inside out
    for (const r of runs) {
      expect(new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), r.inward).distanceTo(r.along)).toBeLessThan(1e-9);
    }
    expect(doors).not.toBeNull();
    expect(doors!.width).toBeCloseTo(2.99, 5);
    expect(doors!.height).toBeCloseTo(4.255, 5);
    // on the doors' room-side face
    expect(doors!.origin.z).toBeCloseTo(7.631 - 0.0575, 5);
  });

  it('leaves a wall that never carried a slab as it is (the stair wall)', () => {
    const { root } = hall();
    const { runs } = surveyPanelling(root);
    expect(runs.some((r) => r.inward.z === 1)).toBe(false);
  });
});

describe('how a run is divided', () => {
  it('into openings near the house width, with a stile at each end and muntins between', () => {
    const got = openingsAcross(0, 1.92);
    expect(got).toHaveLength(3);
    expect(got[0][0]).toBeCloseTo(W.stile, 9);
    expect(got[2][1]).toBeCloseTo(1.92 - W.stile, 9);
    for (let i = 0; i < 2; i += 1) expect(got[i + 1][0] - got[i][1]).toBeCloseTo(W.muntin, 9);
    for (const [a, b] of got) expect(Math.abs(b - a - W.panel)).toBeLessThan(0.05);
    // and none in a stretch too short for one
    expect(openingsAcross(0, 0.4)).toEqual([]);
  });

  it('into two tiers: a low one over the base, the tall one under the dado rail', () => {
    const [lower, upper] = tiers(2.3);
    expect(lower[0]).toBeCloseTo(0.09 + W.rails.bottom, 9);
    expect(lower[1] - lower[0]).toBeCloseTo(W.lower, 9);
    expect(upper[0] - lower[1]).toBeCloseTo(W.rails.middle, 9);
    expect(upper[1]).toBeCloseTo(2.3 - 0.11 - W.rails.top, 9);
    expect(upper[1] - upper[0]).toBeGreaterThan(1.1);
  });
});

/** Every triangle's own normal, and the one it was given. */
function faces(m: Mesher) {
  const out: { n: THREE.Vector3; given: THREE.Vector3; area: number; centre: THREE.Vector3 }[] = [];
  const p = (i: number) => new THREE.Vector3(m.position[i * 3], m.position[i * 3 + 1], m.position[i * 3 + 2]);
  for (let t = 0; t < m.index.length; t += 3) {
    const [a, b, c] = [p(m.index[t]), p(m.index[t + 1]), p(m.index[t + 2])];
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const i = m.index[t];
    out.push({
      n: n.clone().normalize(),
      given: new THREE.Vector3(m.normal[i * 3], m.normal[i * 3 + 1], m.normal[i * 3 + 2]),
      area: n.length() / 2,
      centre: a.add(b).add(c).divideScalar(3),
    });
  }
  return out;
}

describe('the joinery', () => {
  it('cuts a frame round its openings: rails with the grain along, stiles with it upright', () => {
    const m = new Mesher();
    const o = { x0: 0.2, x1: 0.8, y0: 0.3, y1: 0.9 };
    frameFace(m, 1, 0, 1.2, 0.07, [o]);
    // its face's area is the rectangle's less the opening's
    expect(faces(m).reduce((s, f) => s + f.area, 0)).toBeCloseTo(1.2 - 0.36, 9);
    for (const f of faces(m)) {
      expect(f.n.z).toBeCloseTo(1, 9);
      // nothing of it inside the opening
      expect(f.centre.x > o.x0 && f.centre.x < o.x1 && f.centre.y > o.y0 && f.centre.y < o.y1).toBe(false);
    }
    // grain: v of the sheet runs along a rail's length, and up a stile
    const along = (q: number) => {
      const [i0, i1] = [m.index[q * 6], m.index[q * 6 + 1]];
      const dx = m.position[i1 * 3] - m.position[i0 * 3];
      return { dx, du: m.uv[i1 * 2] - m.uv[i0 * 2], dv: m.uv[i1 * 2 + 1] - m.uv[i0 * 2 + 1] };
    };
    const rail = along(0); // the band under the opening: full width
    expect(rail.dx).toBeCloseTo(1, 9);
    expect(rail.dv).toBeCloseTo(1 / WALNUT_SHEET.straight.along, 9);
    expect(rail.du).toBeCloseTo(0, 9);
    const stile = along(1); // the piece left of the opening
    expect(stile.dx).toBeCloseTo(0.2, 9);
    expect(stile.du).toBeCloseTo(0.2 / WALNUT_SHEET.straight.across, 9);
    expect(stile.dv).toBeCloseTo(0, 9);
  });

  it('fields a panel: a moulding down from the frame, a flat, a bevel, the field standing back up', () => {
    const frame = new Mesher();
    const fields = new Mesher();
    const o = { x0: 0, x1: 0.5, y0: 0, y1: 1.2 };
    fieldedPanel(frame, fields, o, W.frame, 0);
    expect(frame.quads).toBe(4); // the moulding is the frame's timber
    expect(fields.quads).toBe(9); // the flat, the bevel, the field
    for (const f of [...faces(frame), ...faces(fields)]) {
      // wound as its normal says, and never facing the wall
      expect(f.n.dot(f.given)).toBeCloseTo(1, 6);
      expect(f.n.z).toBeGreaterThan(0.1);
    }
    const ws = fields.position.filter((_, i) => i % 3 === 2);
    // the field stands below the frame's face, and above the flat round it
    expect(Math.max(...ws)).toBeCloseTo(W.frame - W.recess + W.raise, 9);
    expect(Math.max(...ws)).toBeLessThan(W.frame);
    expect(Math.min(...ws)).toBeCloseTo(W.frame - W.recess, 9);
    // the moulding's faces look into the opening: the one at its foot up, the one at its head down
    const foot = faces(frame)[0];
    expect(foot.n.y).toBeGreaterThan(0.5);
    // the shade a bake would have left inside the frame is in the colours
    expect(Math.min(...frame.color)).toBeLessThan(0.7);
    expect(Math.max(...frame.color)).toBe(1);
    // a book-matched pair: the sheet's coordinate is mirrored about the centre line
    const us = fields.uv.filter((_, i) => i % 2 === 0);
    const joint = 0.25;
    expect(Math.min(...us)).toBeCloseTo(joint - (0.25 - W.sticking) / WALNUT_SHEET.crown.across, 9);
    expect(Math.max(...us)).toBeCloseTo(joint + (0.25 - W.sticking) / WALNUT_SHEET.crown.across, 9);
    // ...and the next panel is cut from the other pair
    const next = new Mesher();
    fieldedPanel(new Mesher(), next, o, W.frame, 1);
    expect(next.uv[next.uv.length - 8]).not.toBeCloseTo(fields.uv[fields.uv.length - 8], 3);
  });

  it('runs a moulding along the wall, every face of it outward, its underside in shade', () => {
    const m = new Mesher();
    const cap = W.cap.map(([w, v]) => [W.frame + w, 2 + v] as const);
    moulding(m, cap, 0, 3, 1);
    expect(m.quads).toBe(W.cap.length - 1);
    for (const f of faces(m)) {
      expect(f.n.dot(f.given)).toBeCloseTo(1, 6);
      expect(f.n.x).toBeCloseTo(0, 9);
      expect(f.n.z).toBeGreaterThan(-1e-9);
    }
    // the cap stands out over the frame, so most of it looks down
    expect(Math.min(...m.color)).toBeLessThan(0.9);
    expect(Math.max(...cap.map(([w]) => w))).toBeGreaterThan(W.frame + 0.04);
  });

  it('builds a run: two tiers of openings in every clear stretch, a base, a rail, and ends only where they show', () => {
    const run = { length: 5, height: 2.3, spans: [[0.07, 2.2], [2.8, 4.93]] as [number, number][], ends: [false, false] as [boolean, boolean] };
    const frame = new Mesher();
    const fields = new Mesher();
    const n = wainscot(frame, fields, run, 1);
    // three openings to each stretch, in two tiers
    expect(n).toBe(2 * 2 * openingsAcross(0.07, 2.2).length);
    expect(n).toBe(12);
    expect(fields.quads).toBe(n * 9);
    const all = [...faces(frame), ...faces(fields)];
    for (const f of all) expect(f.n.dot(f.given)).toBeCloseTo(1, 6);
    // within its own rectangle, and no further off the wall than the rail
    const [xs, ys, ws] = [0, 1, 2].map((k) => [...frame.position, ...fields.position].filter((_, i) => i % 3 === k));
    expect(Math.min(...xs)).toBeCloseTo(0, 9);
    expect(Math.max(...xs)).toBeCloseTo(5, 9);
    expect(Math.min(...ys)).toBeCloseTo(0, 9);
    expect(Math.max(...ys)).toBeCloseTo(2.3, 9);
    expect(Math.min(...ws)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ws)).toBeCloseTo(W.frame + 0.052, 9);
    // no end faces: nothing of it looks along the wall but the panels' own mouldings
    expect(all.filter((f) => Math.abs(f.n.x) > 0.99)).toHaveLength(0);
    const shown = new Mesher();
    wainscot(shown, new Mesher(), { ...run, ends: [true, false] }, 1);
    const end = faces(shown).filter((f) => f.n.x < -0.99);
    expect(end.length).toBeGreaterThan(0);
    for (const f of end) expect(f.centre.x).toBeCloseTo(0, 9);
  });

  it('builds a door leaf: three fields between four rails, its edges closed', () => {
    const frame = new Mesher();
    const fields = new Mesher();
    expect(doorLeaf(frame, fields, 1.49, 4.255, 0)).toBe(3);
    for (const f of [...faces(frame), ...faces(fields)]) expect(f.n.dot(f.given)).toBeCloseTo(1, 6);
    const ws = frame.position.filter((_, i) => i % 3 === 2);
    expect(Math.max(...ws)).toBeCloseTo(DOOR.frame, 9);
    // both edges and the head
    expect(faces(frame).some((f) => f.n.x < -0.99)).toBe(true);
    expect(faces(frame).some((f) => f.n.x > 0.99)).toBe(true);
    expect(faces(frame).some((f) => f.n.y > 0.99)).toBe(true);
  });
});

describe('the columns, where the slabs stood into them', () => {
  it('wear a sleeve of their own clean light, from the skirting to over the slabs', () => {
    // A round shaft on the room's -x wall, with a lightmap coordinate that
    // says where on it a point is: u round it, v its height in metres.
    const root = new THREE.Group();
    const g = new THREE.CylinderGeometry(0.346, 0.346, 5.73, 48, 8, true);
    const pos = g.getAttribute('position');
    const uv1 = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i += 1) {
      uv1[i * 2] = Math.atan2(pos.getZ(i), pos.getX(i)) / (2 * Math.PI);
      uv1[i * 2 + 1] = pos.getY(i) + 3.24;
    }
    g.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    const column = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: 'MAT_Trim_Cream_LM', color: '#e6ddcc', side: THREE.DoubleSide }));
    column.name = 'pilaster_-1_0.0';
    column.position.set(-9.65, 3.24, 0);
    root.add(column);
    root.updateMatrixWorld(true);
    const shaft = {
      mesh: column,
      box: new THREE.Box3().setFromObject(column),
      inward: new THREE.Vector3(1, 0, 0),
      along: new THREE.Vector3(0, 0, -1),
    };
    const sleeves = sleeveColumns(root, [shaft], 2.595)!;
    expect(sleeves).not.toBeNull();
    const p = sleeves.geometry.getAttribute('position');
    const l = sleeves.geometry.getAttribute('uv1');
    const n = sleeves.geometry.getAttribute('normal');
    let [lo, hi, far] = [Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.count; i += 1) {
      const r = Math.hypot(p.getX(i) + 9.65, p.getZ(i));
      // a hair off the stone, flat for flat
      expect(r).toBeGreaterThan(0.346 * Math.cos(Math.PI / 48));
      expect(r).toBeLessThan(0.346 + SLEEVE.proud + 1e-6);
      // lit as the shaft is just over where the slab reached: one height
      expect(l.getY(i)).toBeCloseTo(2.595 + SLEEVE.over + SLEEVE.above, 4);
      // facing out of the shaft
      expect(n.getX(i) * (p.getX(i) + 9.65) + n.getZ(i) * p.getZ(i)).toBeGreaterThan(0);
      lo = Math.min(lo, p.getY(i));
      hi = Math.max(hi, p.getY(i));
      far = Math.max(far, Math.abs(Math.atan2(p.getZ(i), p.getX(i) + 9.65)));
    }
    // from the shaft's foot to over the slabs' top edge
    expect(lo).toBeLessThan(0.39);
    expect(hi).toBeCloseTo(2.595 + SLEEVE.over, 5);
    // round past where the panelling's own face meets the shaft
    expect(THREE.MathUtils.radToDeg(far)).toBeCloseTo(SLEEVE.reach, 3);
    // wound to face out
    const idx = sleeves.geometry.getIndex()!;
    const [a, b, c] = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(p, idx.getX(k)));
    const face = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    expect(face.x * (a.x + 9.65) + face.z * a.z).toBeGreaterThan(0);
    // the shaft's own stone, never fighting it for the depth
    const mat = sleeves.material as THREE.MeshStandardMaterial;
    expect('#' + mat.color.getHexString()).toBe('#e6ddcc');
    expect(mat.polygonOffset).toBe(true);
    expect(mat).not.toBe(column.material);
  });

  it('leave a shaft the rays cannot read as it is', () => {
    const root = new THREE.Group();
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.7, 0.6), new THREE.MeshStandardMaterial());
    column.position.set(-9.65, 3.25, 0);
    root.add(column);
    root.updateMatrixWorld(true);
    const shaft = { mesh: column, box: new THREE.Box3().setFromObject(column), inward: new THREE.Vector3(1, 0, 0), along: new THREE.Vector3(0, 0, -1) };
    expect(sleeveColumns(root, [shaft], 2.595)).toBeNull();
  });
});

describe('panelHall', () => {
  it('puts the slabs away and stands the panelling, the doors and their knobs in the room', () => {
    const { root, slabs } = hall();
    const before = root.children.length;
    const built = panelHall(root, stock());
    expect(built.counts.runs).toBe(4);
    expect(built.counts.slabs).toBe(18);
    expect(built.counts.doors).toBe(2);
    for (const s of slabs) expect(s.visible).toBe(false);
    const frame = root.getObjectByName('panelling_frame') as THREE.Mesh;
    const fields = root.getObjectByName('panelling_fields') as THREE.Mesh;
    expect((frame.material as THREE.Material).name).toBe('MAT_Walnut_Straight');
    expect((fields.material as THREE.Material).name).toBe('MAT_Walnut_Crown');
    expect((frame.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
    // in the room, on its walls: nothing of it behind a wall's face
    const b = new THREE.Box3().setFromObject(frame).union(new THREE.Box3().setFromObject(fields));
    expect(b.min.x).toBeCloseTo(-9.9, 5);
    expect(b.max.x).toBeCloseTo(9.9, 5);
    expect(b.max.z).toBeCloseTo(7.7, 5);
    expect(b.min.z).toBeCloseTo(-7.7, 5);
    expect(b.min.y).toBeCloseTo(0, 5); // the doors' sill
    expect(b.max.y).toBeCloseTo(4.255, 5); // and their head
    // every face of it looks into the room
    const g = frame.geometry;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    for (let i = 0; i < pos.count; i += 97) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i);
      const n = new THREE.Vector3().fromBufferAttribute(nor, i);
      // a point a little way along its normal is no nearer a wall's back
      const q = p.clone().addScaledVector(n, 0.01);
      expect(Math.abs(q.x)).toBeLessThanOrEqual(9.9 + 1e-6);
      expect(q.z).toBeLessThanOrEqual(7.7 + 1e-6);
    }
    // a knob on each leaf, either side of the joint, off the leaf's face
    const knobs = root.children.filter((o) => o.name.startsWith('door_knob_'));
    expect(knobs).toHaveLength(2);
    expect(knobs[0].position.y).toBeCloseTo(DOOR.knob.height, 5);
    expect(Math.abs(knobs[0].position.x)).toBeCloseTo(DOOR.joint / 2 + DOOR.knob.inset, 5);
    expect(knobs[0].position.x).toBeCloseTo(-knobs[1].position.x, 5);
    expect(knobs[0].position.z).toBeCloseTo(7.631 - 0.0575 - DOOR.frame, 5);
    // and both go with the front wall when the room is seen through the
    // open front door (they stood in the doorway as two dark dots)
    for (const k of knobs) expect(HALL_FRONT as readonly string[]).toContain(k.name);

    built.dispose();
    expect(root.children.length).toBe(before);
    for (const s of slabs) expect(s.visible).toBe(true);
  });
});
