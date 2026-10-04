// apps/public/src/components/experience/hallTables.test.ts
//
// The station tables are lit live, not baked (HallModel.liveTurntables): they
// share one mesh per part across four tables and they turn, so a lightmap on
// them is always the wrong light. This holds the contract on a stand-in hall.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { liveTurntables } from './HallModel';

function hall() {
  const root = new THREE.Group();
  const baked = new THREE.MeshStandardMaterial({ name: 'MAT_Table_Base_LM' });
  baked.lightMap = new THREE.Texture();
  // A foot: a floor-level disc (the export's upward underside) and a raised ring.
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 0, 0, 1, // on the floor
    0, 0, 0, 1, 0.1, 0, 0, 0.1, 1, // rising off it
  ], 3));
  g.setIndex([0, 1, 2, 3, 4, 5]);
  const tables: THREE.Mesh[] = [];
  for (const id of ['S1', 'S2']) {
    const turntable = new THREE.Group();
    turntable.name = `TURNTABLE_${id}`;
    turntable.position.set(id === 'S1' ? -7.85 : 7.85, 0, 0);
    const base = new THREE.Mesh(g, baked);
    base.name = `table_base_${id}`;
    turntable.add(base);
    root.add(turntable);
    tables.push(base);
  }
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(), baked);
  wall.name = 'int_wall_left';
  root.add(wall);
  return { root, baked, tables, wall, g };
}

describe('the station tables', () => {
  it('lose their bake, and nothing else does', () => {
    const { root, baked, tables, wall } = hall();
    const out = liveTurntables(root);
    expect(out.meshes).toBe(2);
    for (const t of tables) {
      const m = t.material as THREE.MeshStandardMaterial;
      expect(m).not.toBe(baked);
      expect(m.lightMap).toBeNull();
      // The base is inside out at source: drawn from both sides, three turns
      // each face's normal toward the viewer.
      expect(m.side).toBe(THREE.DoubleSide);
      // The name stays, so the finishes and probe gains still find it.
      expect(m.name).toBe('MAT_Table_Base_LM');
    }
    // One live material shared by every table, as the baked one was.
    expect(tables[0].material).toBe(tables[1].material);
    // The room keeps its bake.
    expect(wall.material).toBe(baked);
    expect(baked.lightMap).not.toBeNull();
  });

  it('drops the underside lying on the floor, once, and keeps the rest of the foot', () => {
    const { root, g } = hall();
    const first = liveTurntables(root);
    expect(first.feet).toBe(1);
    expect(Array.from(g.index!.array)).toEqual([3, 4, 5]);
    expect(liveTurntables(root).feet).toBe(0);
  });
});
