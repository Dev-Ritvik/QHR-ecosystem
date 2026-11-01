// apps/public/src/components/experience/exteriorRealism.test.ts
//
// The brief of 2026-11-01 and the reference frame that came with it: what the baked
// light, the ground, the pool's mirror and the blades promise, where a screenshot would
// not show it until it had gone wrong.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GROUND_FIELD, stampFootprints, standingTrunks } from './exteriorGround';
import { GI, dressEstateGI, followGI, giUniforms } from './exteriorGI';
import { GRASS, groundPlane, isGrassLawn, tuftPlaces } from './exteriorGrass';
import { POOL } from './exteriorWater';
import { MIRROR_RE, MIRROR_SHARE, placeMirror, poolShare } from './poolMirror';

const read = (rel: string) => readFileSync(join(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');

describe('the ground at a tree’s foot', () => {
  const texel = (d: Uint8Array, x: number, z: number, channel: number) => {
    const { px, span } = GROUND_FIELD;
    const c = Math.floor(((x + span / 2) / span) * px);
    const r = Math.floor(((z + span / 2) / span) * px);
    return d[(r * px + c) * 2 + channel];
  };

  it('is bare and dark at the trunk, and open lawn a little way off', () => {
    const d = stampFootprints([{ x: 40, z: -60, h: 18, palm: false }]);
    expect(texel(d, 40, -60, 0)).toBe(255);
    expect(texel(d, 40, -60, 1)).toBeGreaterThan(240);
    expect(texel(d, 40 + 10, -60, 0)).toBe(0);
    expect(texel(d, 40 + 10, -60, 1)).toBe(0);
  });

  it('gives a palm a smaller foot than a broadleaf of its height', () => {
    const a = stampFootprints([{ x: 0, z: 0, h: 14, palm: false }]);
    const b = stampFootprints([{ x: 0, z: 0, h: 14, palm: true }]);
    expect(texel(b, 1.4, 0, 0)).toBeLessThan(texel(a, 1.4, 0, 0));
  });

  it('finds every instance of a tree on the model, once, and not what comes and goes with the layout', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 12, 1);
    const bark = new THREE.MeshStandardMaterial({ name: 'MAT_Bark_Mango_Grown' });
    const trees = new THREE.InstancedMesh(geometry, bark, 2);
    trees.name = 'grown_tree_mango';
    trees.setMatrixAt(0, new THREE.Matrix4().makeTranslation(5, 0, 6));
    trees.setMatrixAt(1, new THREE.Matrix4().makeTranslation(-7, 0, 8));
    const again = new THREE.InstancedMesh(geometry, bark, 1);
    again.name = 'grown_tree_mango_copy';
    again.setMatrixAt(0, new THREE.Matrix4().makeTranslation(5, 0, 6));
    const leaving = new THREE.InstancedMesh(geometry, bark, 1);
    leaving.name = 'grown_tree_mango_leaving';
    const planted = new THREE.InstancedMesh(geometry, bark, 1);
    planted.name = 'veg_tree_layout_mango';
    const leaves = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ name: 'MAT_Leaves_Mango_Grown' }), 1);
    root.add(trees, again, leaving, planted, leaves);
    const found = standingTrunks(root);
    expect(found.map((t) => [t.x, t.z])).toEqual([
      [5, 6],
      [-7, 8],
    ]);
    expect(found[0].h).toBeCloseTo(12);
  });
});

describe('the baked light', () => {
  const stone = (name: string, extra: Partial<THREE.MeshStandardMaterial> = {}) => {
    const mat = new THREE.MeshStandardMaterial({ name });
    Object.assign(mat, extra);
    return new THREE.Mesh(new THREE.BoxGeometry(), mat);
  };

  it('reads the atlas on what has one, the corners on what has them, and leaves the rest alone', () => {
    const root = new THREE.Group();
    const tex = new THREE.Texture();
    const atlas = stone('MAT_Stone_Wall_AO', { emissiveMap: tex });
    const corners = stone('MAT_Stone_Trim', { vertexColors: true });
    const plain = stone('MAT_Stone_Trim');
    const lantern = stone('MAT_Lantern_Bronze', { emissiveMap: tex });
    root.add(atlas, corners, plain, lantern);
    expect(dressEstateGI(root)).toEqual({ atlas: 1, corners: 1 });
    // the attribute is light here: it must not multiply the stone's colour as well
    expect((corners.material as THREE.MeshStandardMaterial).vertexColors).toBe(false);
    expect((lantern.material as THREE.Material).customProgramCacheKey()).not.toContain('gi-');
    expect(dressEstateGI(root)).toEqual({ atlas: 0, corners: 0 });
  });

  it('goes down with the sun, and comes up with the lamps', () => {
    const sun = new THREE.DirectionalLight('#ffffff', 4);
    followGI(sun, 0);
    expect(giUniforms.uGiBounce.value.r).toBeCloseTo(4 * GI.bounce * GI.range);
    expect(giUniforms.uGiLamps.value.r).toBe(0);
    sun.intensity = 0;
    followGI(sun, 1);
    expect(giUniforms.uGiBounce.value.r).toBe(0);
    expect(giUniforms.uGiLamps.value.r).toBeCloseTo(GI.lamps * GI.lampTint[0]);
  });

  it('keeps the bake’s numbers with the bake', () => {
    const bake = read('../../../../../tools/blender/bake_estate_gi_v7.py');
    expect(bake).toContain(`GI_BOUNCE_RANGE = ${GI.range}`);
    // the same sun, in Blender's axes
    expect(bake).toContain('SUN_DIR = np.array([86.0, -50.0, 25.0])');
    expect(read('softSunShadows.ts')).toContain('DAY_SUN: readonly [number, number, number] = [86, 25, 50]');
  });
});

describe('the pool’s mirror', () => {
  const camera = () => {
    const c = new THREE.PerspectiveCamera(40, 2, 0.5, 600);
    c.position.set(-50, 20, 30);
    c.lookAt(-27, 0, 0);
    c.updateMatrixWorld(true);
    c.updateProjectionMatrix();
    return c;
  };

  it('stands as far under the water as the eye is over it', () => {
    const m = new THREE.PerspectiveCamera();
    expect(placeMirror(m, camera())).toBe(true);
    expect(m.position.x).toBeCloseTo(-50);
    expect(m.position.z).toBeCloseTo(30);
    expect(m.position.y).toBeCloseTo(2 * POOL.level - 20);
  });

  it('shows, at a point of the water, what a ray from the eye bounces up to from there', () => {
    const c = camera();
    const m = new THREE.PerspectiveCamera();
    placeMirror(m, c);
    const at = (p: THREE.Vector3) => p.clone().applyMatrix4(m.matrixWorldInverse).applyMatrix4(m.projectionMatrix);
    // a point of the house, and where the line from the eye to its image crosses the water
    const house = new THREE.Vector3(-13.1, 6, 2);
    const image = new THREE.Vector3(house.x, 2 * POOL.level - house.y, house.z);
    const eye = c.position.clone();
    const t = (POOL.level - eye.y) / (image.y - eye.y);
    const water = eye.clone().lerp(image, t);
    const a = at(house);
    const b = at(water);
    expect(a.x).toBeCloseTo(b.x, 5);
    expect(a.y).toBeCloseTo(b.y, 5);
  });

  it('will not stand on the wrong side of the water', () => {
    const c = camera();
    c.position.y = 0.1;
    c.updateMatrixWorld(true);
    expect(placeMirror(new THREE.PerspectiveCamera(), c)).toBe(false);
  });

  it('draws the house and what stands round the water, not the trees or the water itself', () => {
    for (const n of ['mansion_walls', 'podium_balustrade', 'pool_rail_steel', 'pergola_stone']) expect(MIRROR_RE.test(n)).toBe(true);
    for (const n of ['pool_water', 'grown_tree_mango', 'ground_plane', 'pool_coping', 'jungle_canopy']) expect(MIRROR_RE.test(n)).toBe(false);
  });

  it('is drawn under exactly the lights the film’s camera sees: a light of the hall’s here is a new program for every material', () => {
    expect(read('poolMirror.ts')).toContain('(o as THREE.Light).isLight && o.layers.test(camera.layers)');
  });

  it('is only paid for while the pool is enough of the frame to show it', () => {
    expect(poolShare(camera())).toBeGreaterThan(MIRROR_SHARE[1]);
    const far = camera();
    far.position.set(-140, 90, 150);
    far.lookAt(0, 0, 0);
    far.updateMatrixWorld(true);
    expect(poolShare(far)).toBeLessThan(MIRROR_SHARE[0]);
  });
});

describe('the blades', () => {
  it('read the ground’s maps at their foot, by the planes the ground’s mesh is mapped in', () => {
    // as the build maps it: u = x / 6, v = 1 + z / 6 (glTF's flip of the build's -z)
    const xs = [-900, 0, 900, 12];
    const zs = [-840, 960, 60, -3];
    const p = groundPlane(xs, zs, xs.map((x) => x / 6), zs.map((z) => 1 + z / 6));
    expect(p.u[0]).toBeCloseTo(1 / 6, 9);
    expect(p.u[1]).toBeCloseTo(0, 9);
    expect(p.v[0]).toBeCloseTo(1 / 6, 9);
    expect(p.v[1]).toBeCloseTo(1, 9);
  });

  it('stand on the lawn, and on nothing the car drives over', () => {
    expect(isGrassLawn(12, 20)).toBe(true);
    expect(isGrassLawn(6, 6)).toBe(false); // the apron
    expect(isGrassLawn(0, 60)).toBe(false); // the avenue
    expect(isGrassLawn(0, 30 + 11)).toBe(false); // the ring
    expect(isGrassLawn(6, 30)).toBe(true); // the fountain's lawn
    expect(isGrassLawn(0, 30 + 2)).toBe(false); // the fountain
  });

  it('are the same lawn every visit, and shuffled, so half of them is half of them everywhere', () => {
    const a = tuftPlaces();
    const b = tuftPlaces();
    expect(a[100]).toEqual(b[100]);
    expect(a.length).toBeLessThan(40000);
    const half = a.slice(0, a.length / 2);
    const east = (list: typeof a) => list.filter((p) => p.x > 7.4).length / list.length;
    expect(Math.abs(east(half) - east(a))).toBeLessThan(0.03);
    for (const p of a) {
      expect(isGrassLawn(p.x, p.z)).toBe(true);
      expect(p.h).toBeLessThanOrEqual(GRASS.height[1]);
    }
  });
});

describe('the sky’s density', () => {
  it('is gone once the orbit’s line has gone: the reference’s bright horizon', () => {
    const lens = read('lensFilter.ts');
    expect(lens).toContain('off: [0.278, 0.31] as const,');
  });
});
