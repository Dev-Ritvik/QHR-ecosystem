// apps/public/src/components/experience/hallJoinery.test.ts
//
// The replacement joinery, proved without a browser: the profiles are turnable,
// the pieces fit the footprints they replace, and the swap puts each piece where
// its original stood and can be undone.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  BALUSTER,
  JOINERY_NAMES,
  NEWEL,
  SCONCE,
  URN_FILL,
  URN_GILT_SPANS,
  URN_PROFILE,
  balusterGeometry,
  newelGeometry,
  refurnishHall,
  sampleProfile,
  sconceGeometry,
  urnGeometry,
  type Profile,
} from './hallJoinery';

const boundsOf = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!;
};

describe('profiles', () => {
  const profiles: [string, Profile][] = [
    ['urn', URN_PROFILE],
    ['baluster', BALUSTER.turned],
    ['newel', NEWEL.turned],
    ['finial', NEWEL.finial],
  ];

  it.each(profiles)('%s climbs and never turns inside out', (_, profile) => {
    for (let i = 1; i < profile.length; i++) {
      expect(profile[i][1]).toBeGreaterThanOrEqual(profile[i - 1][1]);
    }
    for (const [r] of profile) expect(r).toBeGreaterThanOrEqual(0);
  });

  it('sampling passes through every control point', () => {
    const pts = sampleProfile(URN_PROFILE);
    for (const [r, y] of URN_PROFILE) {
      expect(pts.some((p) => Math.abs(p.x - r) < 1e-9 && Math.abs(p.y - y) < 1e-9)).toBe(true);
    }
  });

  it('the urn is closed at the foot and the finial', () => {
    expect(URN_PROFILE[0][0]).toBe(0);
    expect(URN_PROFILE[URN_PROFILE.length - 1][0]).toBe(0);
  });

  it('the gilt spans are ordered and inside the profile', () => {
    let last = 0;
    for (const [a, b] of URN_GILT_SPANS) {
      expect(a).toBeGreaterThanOrEqual(last);
      expect(b).toBeGreaterThan(a);
      expect(b).toBeLessThanOrEqual(URN_PROFILE.length - 1);
      last = b;
    }
  });
});

describe('geometry', () => {
  it('the urn is one metre tall, fits its plinth, and draws in two materials', () => {
    const g = urnGeometry();
    const b = boundsOf(g);
    expect(b.max.y - b.min.y).toBeCloseTo(1, 1);
    // The plinth top is 0.68 m square; the urn is scaled by ~0.94 in place.
    expect((b.max.x - b.min.x) * URN_FILL).toBeLessThan(0.62);
    expect(g.groups.map((gr) => gr.materialIndex)).toEqual([0, 1]);
    const covered = g.groups.reduce((n, gr) => n + gr.count, 0);
    expect(covered).toBe(g.index!.count);
  });

  it('a baluster fits the 0.11 m footprint of the one it replaces', () => {
    const b = boundsOf(balusterGeometry());
    expect(b.max.y).toBeCloseTo(1, 5);
    expect(b.min.y).toBeCloseTo(0, 5);
    expect(b.max.x - b.min.x).toBeLessThanOrEqual(0.11);
  });

  it('a newel is 1.4 m and stays inside a 0.25 m square', () => {
    const b = boundsOf(newelGeometry());
    expect(b.max.y).toBeCloseTo(NEWEL.height, 5);
    expect(b.max.x - b.min.x).toBeLessThanOrEqual(0.25);
    expect(b.max.z - b.min.z).toBeLessThanOrEqual(0.25);
  });

  it('every normal is unit length (no shattered shading)', () => {
    for (const g of [urnGeometry(), balusterGeometry(), newelGeometry()]) {
      const n = g.attributes.normal;
      for (let i = 0; i < n.count; i++) {
        const len = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
        expect(Math.abs(len - 1)).toBeLessThan(1e-3);
      }
    }
  });
});

describe('refurnishHall', () => {
  const wood = new THREE.MeshStandardMaterial({ name: 'MAT_Wood_Dark' });
  const trim = new THREE.MeshStandardMaterial({ name: 'MAT_Trim_Cream' });
  const gold = new THREE.MeshStandardMaterial({ name: 'MAT_Gold' });

  const post = (name: string, x: number, y0: number, z: number, h: number, mat: THREE.Material, w = 0.2) => {
    const g = new THREE.BoxGeometry(w, h, w);
    g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, mat);
    m.name = name;
    m.position.set(x, y0, z);
    return m;
  };

  const hall = () => {
    const root = new THREE.Group();
    root.add(post('newel_bot_-1', -2.45, 0, -0.4, 1.4, wood));
    root.add(post('newel_mid_1', 2.45, 2.64, -4.42, 1.4, wood));
    root.add(post('newel_top_1', 2.45, 2.76, -5.22, 1.4, wood));
    for (let i = 0; i < 3; i++) root.add(post(`bal_-1_r0${i}`, -2.455, 0.3 + i * 0.2, -0.8 - i * 0.3, 0.88, trim, 0.11));
    root.add(post('dress_urn_0', -3.76, 0.57, -0.48, 0.99, trim, 0.5));
    root.add(post('dress_urn_plinth_0', -3.76, 0, -0.48, 0.58, trim, 0.68));
    root.add(post('portrait_frame_outer', 0, 2.75, -5.2, 3.1, gold, 2.3));
    return root;
  };

  it('replaces each piece where it stood, in its own material', () => {
    const root = hall();
    const r = refurnishHall(root);
    expect(r.counts).toEqual({ newels: 2, retired: 1, balusters: 3, urns: 1, sconces: 0 });

    const newel = root.getObjectByName('newel_bot_-1_turned') as THREE.Mesh;
    expect(newel.position.x).toBeCloseTo(-2.45, 5);
    expect(newel.position.y).toBeCloseTo(0, 5);
    expect(newel.position.z).toBeCloseTo(-0.4, 5);
    expect(newel.material).toBe(wood);

    const mid = root.getObjectByName('newel_mid_1_turned') as THREE.Mesh;
    expect(mid.position.y).toBeCloseTo(2.64, 5);
    expect(mid.scale.y).toBeCloseTo(1, 5);

    const run = root.getObjectByName('balusters_turned') as THREE.InstancedMesh;
    expect(run.count).toBe(3);
    expect(run.material).toBe(trim);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    run.getMatrixAt(2, m);
    m.decompose(p, new THREE.Quaternion(), s);
    expect(p.y).toBeCloseTo(0.7, 5);
    expect(p.z).toBeCloseTo(-1.4, 5);
    expect(s.y).toBeCloseTo(0.88, 5);

    const urn = root.getObjectByName('dress_urn_0_turned') as THREE.Mesh;
    expect(urn.position.y).toBeCloseTo(0.58, 5); // on the plinth, not in it
    expect((urn.material as THREE.Material[])[1]).toBe(gold); // the room's own gilt

    for (const name of ['newel_bot_-1', 'newel_mid_1', 'newel_top_1', 'bal_-1_r01', 'dress_urn_0']) {
      expect(root.getObjectByName(name)!.visible).toBe(false);
    }
    expect(root.getObjectByName('newel_top_1_turned')).toBeUndefined();
    expect(root.getObjectByName('dress_urn_plinth_0')!.visible).toBe(true);
  });

  it('hangs a turned sconce off each wall plate, reaching the candle cups', () => {
    const root = hall();
    // The hall's own numbers: a plate 0.30 deep off the +x pilaster face at
    // 7.02, and one off the -x face, arms either side of each.
    const plate = (name: string, x0: number, x1: number, z: number) => {
      const g = new THREE.BoxGeometry(x1 - x0, 0.32, 0.15);
      const m = new THREE.Mesh(g, gold);
      m.name = name;
      m.position.set((x0 + x1) / 2, 3.35, z);
      return m;
    };
    root.add(plate('sconce_plate_1_24', 6.72, 7.02, -2.4));
    root.add(plate('sconce_plate_-1_24', -7.02, -6.72, -2.4));
    root.add(post('sconce_arm_1_24_0', 6.64, 3.33, -2.24, 0.04, gold, 0.04));
    const r = refurnishHall(root);
    expect(r.counts.sconces).toBe(2);

    const run = root.getObjectByName('sconces_turned') as THREE.InstancedMesh;
    expect(run.count).toBe(2);
    expect(run.material).toBe(gold);
    const tip = new THREE.Vector3();
    const m = new THREE.Matrix4();
    for (let i = 0; i < 2; i++) {
      run.getMatrixAt(i, m);
      const wall = new THREE.Vector3().setFromMatrixPosition(m);
      expect(Math.abs(wall.x)).toBeCloseTo(7.02, 5);
      expect(wall.y).toBeCloseTo(3.35, 5);
      // The stem's end, carried through the instance transform, lands on the
      // cups' centre line — into the room, never behind the wall.
      tip.set(SCONCE.reach, 0, 0).applyMatrix4(m);
      expect(Math.abs(tip.x)).toBeCloseTo(6.56, 5);
    }
    expect(root.getObjectByName('sconce_arm_1_24_0')!.visible).toBe(false);
    expect(root.getObjectByName('sconce_plate_-1_24')!.visible).toBe(false);
  });

  it('the sconce brass stands off the wall by its reach and no further', () => {
    const b = boundsOf(sconceGeometry());
    expect(b.min.x).toBeGreaterThanOrEqual(-1e-6);
    expect(b.max.x).toBeLessThanOrEqual(SCONCE.reach + 0.03);
    expect(b.max.y - b.min.y).toBeCloseTo(SCONCE.plate.radius * 2 * SCONCE.plate.tall, 2);
  });

  it('disposes back to the original room', () => {
    const root = hall();
    const before = root.children.length;
    refurnishHall(root).dispose();
    expect(root.children.length).toBe(before);
    root.traverse((o) => expect(o.visible).toBe(true));
  });

  it('leaves a room without joinery untouched', () => {
    const root = new THREE.Group();
    root.add(post('int_wall_front', 0, 0, 5.4, 6.4, trim, 1));
    const r = refurnishHall(root);
    expect(r.counts).toEqual({ newels: 0, retired: 0, balusters: 0, urns: 0, sconces: 0 });
    expect(root.children.length).toBe(1);
  });

  it('matches the names the hall actually uses', () => {
    for (const n of ['newel_bot_1', 'newel_mid_-1']) expect(JOINERY_NAMES.newel.test(n)).toBe(true);
    for (const n of ['bal_-1_r00', 'bal_1_l4', 'bal_1_r21']) expect(JOINERY_NAMES.baluster.test(n)).toBe(true);
    for (const n of ['bal_plinth_1', 'bal_rail_L-1', 'bal_plinth_L1']) expect(JOINERY_NAMES.baluster.test(n)).toBe(false);
    expect(JOINERY_NAMES.urn.test('dress_urn_plinth_0')).toBe(false);
    expect(JOINERY_NAMES.retiredNewel.test('newel_top_-1')).toBe(true);
  });
});
