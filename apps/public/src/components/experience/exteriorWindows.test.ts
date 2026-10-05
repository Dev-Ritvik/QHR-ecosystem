// apps/public/src/components/experience/exteriorWindows.test.ts
//
// The rooms behind the windows, and the ageing of the stone, as contracts:
// each window is found as its own piece and centred on itself, the pass is
// idempotent on drei's shared geometry, and only the surfaces it names are
// dressed.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DAY_INTERIOR,
  EVENING_DRIVE_MAX,
  EVENING_INTERIOR,
  INTERIOR_FRAGMENT,
  LAMP_DAY,
  dressWindows,
  markRooms,
  roomOn,
} from './exteriorWindows';
import { ASHLAR, SKY_FACE, dressSurfaces } from './exteriorSurfaces';

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
    // and it is seen by its own light: the contact occlusion leaves it alone
    expect((panes.material as THREE.Material).defines).toHaveProperty('ESTATE_EMITTER');
  });

  it('is a lived-in house: a quarter of its rooms dark, most with their lamps on, no two alike', () => {
    const on = Array.from({ length: 2000 }, (_, i) => roomOn((i + 0.5) / 2000));
    const dark = on.filter((v) => v < 0.1).length / on.length;
    const lit = on.filter((v) => v > 0.6).length / on.length;
    expect(dark).toBeGreaterThan(0.2);
    expect(dark).toBeLessThan(0.3);
    expect(lit).toBeGreaterThan(0.5);
    expect(lit).toBeLessThan(0.6);
    // the lit rooms are spread over their range, not at one strength
    const lamps = on.filter((v) => v > 0.6);
    expect(Math.max(...lamps) - Math.min(...lamps)).toBeGreaterThan(0.3);
    // and the shader decides it the same way
    expect(INTERIOR_FRAGMENT).toContain(
      'r < 0.25 ? 0.035 : r < 0.45 ? 0.16 + 0.2 * fract(r * 7.13) : 0.62 + 0.38 * fract(r * 7.13)',
    );
  });

  it('shows daylight by day and lamps by night, and never a light box', () => {
    // By day the lamps are a fraction of the daylight the window lets in.
    expect(LAMP_DAY).toBeLessThan(DAY_INTERIOR / 2);
    // At full night the brightest wall of the brightest room (0.7 ivory under
    // 1.5 of lamp) stays under the print's white: the first drive put it at
    // five times white and every lit pane clipped alike, the second at two and
    // a half, and the paid audit (2026-10-04) still read the lit windows as
    // "bright yellow/orange rectangles". A room glows; a light box clips.
    const night = LAMP_DAY + EVENING_INTERIOR * EVENING_DRIVE_MAX;
    expect(0.7 * 1.5 * night).toBeLessThan(1.0);
    // ...and is still a lit room: several times the daylight it had at noon.
    expect(night).toBeGreaterThan(DAY_INTERIOR * 1.5);
    // The daylight dies into the room, and goes with the evening.
    expect(INTERIOR_FRAGMENT).toContain('exp(-depth / ');
    expect(INTERIOR_FRAGMENT).toContain('uInteriorDay * (1.0 - 0.92 * dusk)');
    // The drapes' folds are filtered before they alias.
    expect(INTERIOR_FRAGMENT).toContain('fwidth(a0)');
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

  it('lays the wall in courses, and neither the trim nor the rusticated base', () => {
    const root = new THREE.Group();
    const mk = (name: string) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ name }));
      root.add(m);
      return m.material as THREE.MeshStandardMaterial;
    };
    const wall = mk('MAT_Stone_Wall_AO');
    const trim = mk('MAT_Stone_Trim_AO');
    const rustic = mk('MAT_Stone_Rustic_AO');
    dressSurfaces(root);
    expect(wall.defines).toHaveProperty('ESTATE_ASHLAR');
    expect(trim.defines ?? {}).not.toHaveProperty('ESTATE_ASHLAR');
    expect(rustic.defines ?? {}).not.toHaveProperty('ESTATE_ASHLAR');
    expect(trim.defines).toHaveProperty('ESTATE_TRIM');
    const shader = {
      uniforms: {},
      vertexShader: 'void main() { #include <begin_vertex> }',
      fragmentShader: 'void main() { #include <color_fragment> #include <roughnessmap_fragment> }',
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    wall.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    // a joint as wide as it is, drawn at its share of a pixel, so it cannot alias
    expect(shader.fragmentShader).toContain('float px = max(length(fwidth(w)), 1.0e-4);');
    expect(shader.fragmentShader).toContain('- min(dh, dv)) / px, 0.0, 1.0)');
    // quiet: a joint a few millimetres wide, a stone a couple of per cent from the next
    expect(ASHLAR.joint).toBeLessThanOrEqual(0.012);
    expect(ASHLAR.tone).toBeLessThanOrEqual(0.03);
    // courses a mason would lay: a stone two to three times as long as it is high
    expect(ASHLAR.stone / ASHLAR.course).toBeGreaterThan(2);
    expect(ASHLAR.stone / ASHLAR.course).toBeLessThan(3);
  });

  it('weathers what faces the sky, and leaves every upright face its hone', () => {
    // The honed trim's level tops were white strips under a low sun seen from
    // behind it (the roof balustrade on the revolve): the sun's glint, gone at
    // full roughness. Only a face that looks up is roughened, and only ever
    // roughened — never polished.
    const root = new THREE.Group();
    const trim = new THREE.MeshStandardMaterial({ name: 'MAT_Stone_Trim_AO' });
    root.add(new THREE.Mesh(new THREE.PlaneGeometry(), trim));
    dressSurfaces(root);
    const shader = {
      uniforms: {},
      vertexShader: 'void main() { #include <begin_vertex> }',
      fragmentShader: 'void main() { #include <color_fragment> #include <roughnessmap_fragment> }',
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    trim.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    const frag = shader.fragmentShader;
    // the face's own normal, toward the eye: a soffit seen from below looks down
    expect(frag).toContain('normalize(cross(dFdx(vAgeWorld), dFdy(vAgeWorld)))');
    expect(frag).toContain(`smoothstep(${SKY_FACE.from.toFixed(2)}, ${SKY_FACE.to.toFixed(2)}, faceUp.y)`);
    expect(frag).toContain(`max(roughnessFactor, ${SKY_FACE.rough.toFixed(2)})`);
    // after the stone's own roughness has been read, not instead of it
    expect(frag.indexOf('#include <roughnessmap_fragment>')).toBeLessThan(frag.indexOf('faceUp'));
    // a wall (its normal level) and a soffit (looking down) are below the ramp
    expect(SKY_FACE.from).toBeGreaterThan(0.3);
    expect(SKY_FACE.to).toBeLessThan(1);
    expect(SKY_FACE.rough).toBeGreaterThan(0.85);
    expect(SKY_FACE.rough).toBeLessThanOrEqual(1);
  });
});
