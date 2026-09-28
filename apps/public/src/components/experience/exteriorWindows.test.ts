// apps/public/src/components/experience/exteriorWindows.test.ts
//
// The rooms behind the windows, and the ageing of the stone, as contracts:
// each window is found as its own piece and centred on itself, the pass is
// idempotent on drei's shared geometry, and only the surfaces it names are
// dressed.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dressWindows, markRooms } from './exteriorWindows';
import { dressSurfaces } from './exteriorSurfaces';

/** Two separate window panes, split at a crease like the export splits them. */
function twoPanes(): THREE.BufferGeometry {
  const quad = (cx: number, cy: number, w: number, h: number) => [
    cx - w, cy - h, 0, cx + w, cy - h, 0, cx + w, cy + h, 0,
    // the second triangle repeats two corners as NEW vertices (a crease split)
    cx - w, cy - h, 0, cx + w, cy + h, 0, cx - w, cy + h, 0,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...quad(0, 2, 0.6, 1), ...quad(4, 6, 0.7, 1.4)], 3));
  return g;
}

describe('the rooms behind the windows', () => {
  it('finds each pane as one window, welding the crease, and centres its room on it', () => {
    const g = twoPanes();
    expect(markRooms(g)).toBe(2);
    const c = g.getAttribute('aRoomC');
    const h = g.getAttribute('aRoomH');
    // every vertex of the first pane carries the first pane's centre and size
    for (let i = 0; i < 6; i += 1) {
      expect([c.getX(i), c.getY(i)]).toEqual([0, 2]);
      expect(h.getX(i)).toBeCloseTo(0.6);
      expect(h.getY(i)).toBeCloseTo(1);
    }
    expect([c.getX(6), c.getY(6)]).toEqual([4, 6]);
    expect(h.getY(11)).toBeCloseTo(1.4);
  });

  it('leaves a geometry that is already marked alone (shared between mounts)', () => {
    const g = twoPanes();
    markRooms(g);
    const before = g.getAttribute('aRoomC');
    expect(markRooms(g)).toBe(-1);
    expect(g.getAttribute('aRoomC')).toBe(before);
  });

  it('dresses the window interiors and nothing else', () => {
    const root = new THREE.Group();
    const panes = new THREE.Mesh(twoPanes(), new THREE.MeshStandardMaterial({ name: 'MAT_Window_Interior' }));
    const wall = new THREE.Mesh(twoPanes(), new THREE.MeshStandardMaterial({ name: 'MAT_Stone_Wall' }));
    root.add(panes, wall);
    expect(dressWindows(root)).toBe(2);
    expect((panes.material as THREE.Material).customProgramCacheKey()).toBe('estate-interior-rooms');
    expect(wall.geometry.getAttribute('aRoomC')).toBeUndefined();
    const shader = {
      uniforms: {},
      vertexShader: 'void main() {\n#include <begin_vertex>\n}',
      fragmentShader:
        'void main() {\n#include <emissivemap_fragment>\nvec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;\n}',
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    (panes.material as THREE.Material).onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.vertexShader).toContain('attribute vec3 aRoomC;');
    expect(shader.fragmentShader).toContain('vec3 interiorRoom(');
    // unlit: the room is all the plane emits
    expect(shader.fragmentShader).toContain('vec3 outgoingLight = totalEmissiveRadiance;');
  });
});

describe('the ageing of the surfaces', () => {
  it('weathers the stone, the slate and the hedges, and not the lawn or the gilt', () => {
    const root = new THREE.Group();
    const mk = (name: string) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ name }));
      root.add(m);
      return m.material as THREE.MeshStandardMaterial;
    };
    const stone = mk('MAT_Stone_Wall_AO');
    mk('MAT_Stone_Trim');
    const slate = mk('MAT_Roof_Slate_AO');
    const hedge = mk('MAT_Hedge');
    const lawn = mk('MAT_Lawn_AOG');
    const gold = mk('MAT_Gold');
    expect(dressSurfaces(root)).toEqual({ stone: 2, slate: 1, hedge: 1 });
    expect(stone.customProgramCacheKey()).toBe('estate-aged-stone');
    expect(slate.customProgramCacheKey()).toBe('estate-aged-slate');
    expect(hedge.customProgramCacheKey()).toBe('estate-aged-hedge');
    expect(lawn.customProgramCacheKey()).not.toContain('estate-aged');
    expect(gold.customProgramCacheKey()).not.toContain('estate-aged');
    // idempotent
    expect(dressSurfaces(root)).toEqual({ stone: 0, slate: 0, hedge: 0 });
  });
});
