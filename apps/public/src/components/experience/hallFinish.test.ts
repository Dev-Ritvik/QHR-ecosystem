// apps/public/src/components/experience/hallFinish.test.ts
//
// The finishes as a contract: the room the client asked for is light, its wood
// is wood rather than black, and applying the finishes is safe to repeat.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HALL_FINISHES, finishHall } from './hallFinish';

const luminance = (hex: string) => {
  const c = new THREE.Color(hex); // linear working space
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

describe('the finishes', () => {
  it('paints the plaster and mouldings ivory, not grey', () => {
    for (const name of ['MAT_Wall_Plaster_LM', 'MAT_Trim_Cream', 'MAT_Trim_Cream_LM', 'MAT_Ceiling_Plaster_LM']) {
      expect(luminance(HALL_FINISHES[name].color as string)).toBeGreaterThan(0.7);
    }
  });

  it('keeps the walnut a wood and not a black slab', () => {
    for (const name of ['MAT_Wood_Dark', 'MAT_Wood_Dark_LM']) {
      const l = luminance(HALL_FINISHES[name].color as string);
      expect(l).toBeGreaterThan(0.07);
      expect(l).toBeLessThan(0.25);
    }
  });

  it('clears the granite and damp-plaster maps that made the room look worn', () => {
    for (const name of ['MAT_Trim_Cream', 'MAT_Trim_Cream_LM', 'MAT_Wall_Plaster_LM', 'MAT_Wood_Dark']) {
      expect(HALL_FINISHES[name].clear).toContain('map');
      expect(HALL_FINISHES[name].clear).toContain('normalMap');
    }
    // The marble keeps its veining.
    expect(HALL_FINISHES.MAT_MarbleFloor_LM.clear).not.toContain('map');
  });
});

describe('finishHall', () => {
  const room = () => {
    const tex = new THREE.Texture();
    const plaster = new THREE.MeshStandardMaterial({ name: 'MAT_Wall_Plaster_LM', map: tex, normalMap: tex });
    const floor = new THREE.MeshPhysicalMaterial({ name: 'MAT_MarbleFloor_LM', map: tex, roughnessMap: tex });
    const holo = new THREE.MeshStandardMaterial({ name: 'MAT_Holo3D_Plate_S1', map: tex });
    const root = new THREE.Group();
    for (const m of [plaster, floor, holo]) root.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    return { root, plaster, floor, holo, tex };
  };

  it('finishes what it names and nothing else', () => {
    const { root, plaster, floor, holo, tex } = room();
    const done = finishHall(root);
    expect(done.sort()).toEqual(['MAT_MarbleFloor_LM', 'MAT_Wall_Plaster_LM']);
    expect(plaster.map).toBeNull();
    expect(plaster.normalMap).toBeNull();
    expect('#' + plaster.color.getHexString()).toBe('#efe7da');
    expect(floor.map).toBe(tex);
    expect(floor.roughnessMap).toBeNull();
    expect(floor.color.r).toBeCloseTo(1.4, 5); // linear, above 1 on purpose
    expect(holo.map).toBe(tex);
  });

  it('is idempotent', () => {
    const { root, plaster } = room();
    finishHall(root);
    const colour = plaster.color.clone();
    expect(finishHall(root)).toEqual([]);
    expect(plaster.color.equals(colour)).toBe(true);
  });
});
