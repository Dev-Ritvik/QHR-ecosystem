// apps/public/src/components/experience/hallTurnings.test.ts
//
// The tables' turned work (the forensic audit of 2026-10-09, #38: "The rim is
// visibly faceted and the turned pedestal has flat sides ... Expected: smooth
// rims and turnings").

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TABLE_ROUND, TABLE_TURNED_RE, ringTargets, roundGeometry, roundTables } from './hallTables';

/** A ring of `n` vertices at height `y` whose radius goes in and out by `lobe`. */
function lobedLathe(n: number, lobe: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const rings = [
    [0.5, 0.0],
    [0.56, 0.02],
    [0.5, 0.04],
  ];
  rings.forEach(([r, y]) => {
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const rr = r + (i % 2 === 0 ? lobe / 2 : -lobe / 2);
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
    }
  });
  for (let k = 0; k < rings.length - 1; k += 1) {
    for (let i = 0; i < n; i += 1) {
      const a = k * n + i;
      const b = k * n + ((i + 1) % n);
      const c = (k + 1) * n + i;
      const d = (k + 1) * n + ((i + 1) % n);
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

describe('a ring of a turned piece', () => {
  it('is set to the middle of its wander when it wanders, and left when it is true', () => {
    // a gadrooned ring: eleven millimetres in and out
    const lobed = [0.564, 0.575, 0.5665, 0.572, 0.569];
    expect(ringTargets(lobed)).toEqual(lobed.map(() => (0.564 + 0.575) / 2));
    // a true ring is not moved
    expect(ringTargets([0.26, 0.26, 0.26])).toEqual([0.26, 0.26, 0.26]);
    // a disc's middle and its edge are two things at one height
    expect(ringTargets([0, 0.5, 0.5, 0])).toEqual([0, 0.5, 0.5, 0]);
    // the foot's bottom face: its middle is left, its lobed outline is rounded
    const foot = ringTargets([0, 0.374, 0.396, 0.385]);
    expect(foot[0]).toBe(0);
    for (const r of foot.slice(1)) expect(r).toBeCloseTo(0.385, 6);
    // and nothing near the axis is touched
    expect(ringTargets([0.01, 0.02, 0.03])).toEqual([0.01, 0.02, 0.03]);
    expect(TABLE_ROUND.lobe).toBeGreaterThan(0.011);
    expect(TABLE_ROUND.lobe).toBeLessThan(0.02);
  });
});

describe('the tables', () => {
  it('have true rings and are shaded round, with their own vertices, uvs and count of faces', () => {
    const src = lobedLathe(48, 0.011);
    const uv = new Float32Array((src.attributes.position.count) * 2).map((_, i) => (i % 7) / 7);
    src.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
    const out = roundGeometry(src, TABLE_ROUND.crease.top);
    const p = out.attributes.position;
    // the same faces (it is not rebuilt), unrolled a corner a vertex
    expect(p.count).toBe(src.index!.count);
    expect(out.attributes.uv1.count).toBe(p.count);
    // every ring is one radius now
    const byHeight = new Map<string, Set<string>>();
    for (let i = 0; i < p.count; i += 1) {
      const k = p.getY(i).toFixed(3);
      if (!byHeight.has(k)) byHeight.set(k, new Set());
      byHeight.get(k)!.add(Math.hypot(p.getX(i), p.getZ(i)).toFixed(4));
    }
    expect([...byHeight.values()].map((s) => s.size)).toEqual([1, 1, 1]);
    expect([...byHeight.get('0.020')!][0]).toBe('0.5600');
    // and round the ring the corners that meet at one place share a normal:
    // 7.5 degrees between faces is under the crease
    const n = out.attributes.normal;
    const at = new Map<string, Set<string>>();
    for (let i = 0; i < p.count; i += 1) {
      const k = [p.getX(i), p.getY(i), p.getZ(i)].map((v) => v.toFixed(4)).join(',');
      if (!at.has(k)) at.set(k, new Set());
      at.get(k)!.add([n.getX(i), n.getY(i), n.getZ(i)].map((v) => v.toFixed(2)).join(','));
    }
    const split = [...at.values()].filter((s) => s.size > 1).length;
    // only the ridge of the half-round may crease (its two slopes meet at 113 degrees here)
    expect(split).toBeLessThanOrEqual(48);
    // the source is not touched: every mount of the hall shares it
    expect(src.index).not.toBeNull();
    expect(Math.hypot(src.attributes.position.getX(0), src.attributes.position.getZ(0))).toBeCloseTo(0.5 + 0.0055, 5);
  });

  it('are found by the model’s names, once a geometry however many tables share it', () => {
    for (const name of ['table_top_S1', 'table_base_S4', 'table_top_S12']) expect(TABLE_TURNED_RE.test(name)).toBe(true);
    for (const name of ['table_inlay_S1', 'TURNTABLE_S1', 'map_table_top', 'table_top']) expect(TABLE_TURNED_RE.test(name)).toBe(false);
    const shared = lobedLathe(24, 0.011);
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial();
    for (const name of ['table_top_S1', 'table_top_S2', 'table_inlay_S1']) {
      const m = new THREE.Mesh(shared, mat);
      m.name = name;
      root.add(m);
    }
    expect(roundTables(root)).toBe(2);
    const [a, b, inlay] = root.children as THREE.Mesh[];
    expect(a.geometry).not.toBe(shared);
    expect(a.geometry).toBe(b.geometry);
    expect(inlay.geometry).toBe(shared);
    // a second mount of the hall takes the same rounded geometry
    const again = new THREE.Group();
    const m = new THREE.Mesh(shared, mat);
    m.name = 'table_top_S3';
    again.add(m);
    roundTables(again);
    expect(m.geometry).toBe(a.geometry);
    // and it is done where the hall is furnished
    const hall = readFileSync(join(__dirname, 'HallModel.tsx'), 'utf8');
    expect(hall).toContain('roundTables(root);');
  });
});
