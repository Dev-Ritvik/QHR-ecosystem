// apps/public/src/components/experience/exteriorWater.test.ts
//
// The estate's water as contracts: one treatment for every sheet of it, a
// mirror that is never brighter than what it faces, the house and the hedges
// where a mirror would put them, and no noise in the trough.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CANAL,
  CANAL_MATERIAL,
  CANAL_MESH,
  FOUNTAIN,
  FOUNTAIN_TIERS,
  HOUR_STEP,
  MAX_PROXIES,
  POOL,
  PROBE_AT,
  PROXIES,
  ROUNDEL,
  ROUNDEL_TIERS,
  WATER,
  WATER_COLOUR,
  WATER_FRESNEL,
  WATER_FUNCTIONS,
  WATER_NORMAL,
  WATER_REFLECTION,
  WATER_SUN,
  dressWater,
  followWaterHour,
  splitCanal,
  waterKind,
  waterShared,
  waterUniforms,
} from './exteriorWater';

const read = (p: string) => readFileSync(join(__dirname, p), 'utf8').replace(/\r\n/g, '\n');

/** The estate's three sheets of water, as the file names them. */
function estate(): { root: THREE.Group; pool: THREE.Mesh; canal: THREE.Mesh; fountain: THREE.Mesh } {
  const root = new THREE.Group();
  const water = new THREE.MeshPhysicalMaterial({ name: 'MAT_Water' });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshPhysicalMaterial({ name: 'MAT_Water_Pool' }));
  pool.name = 'pool_water';
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), water);
  canal.name = CANAL_MESH;
  const fountain = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), water);
  fountain.name = 'fountain_water';
  root.add(pool, canal, fountain);
  return { root, pool, canal, fountain };
}

const SHADER = {
  vertexShader: 'void main() {\n#include <begin_vertex>\n}',
  fragmentShader: [
    'void main() {',
    '#include <color_fragment>',
    '#include <normal_fragment_maps>',
    '#include <lights_physical_fragment>',
    '#include <lights_fragment_maps>',
    '#include <lights_fragment_end>',
    '}',
  ].join('\n'),
};

describe('one water', () => {
  it('knows the pool, the canal and the fountain apart by their materials', () => {
    expect(waterKind('MAT_Water_Pool')).toBe('pool');
    expect(waterKind(CANAL_MATERIAL)).toBe('canal');
    expect(waterKind('MAT_Water')).toBe('fountain');
  });

  it("gives the canal a material of its own, once, and leaves the fountain's alone", () => {
    const { root, canal, fountain } = estate();
    const shared = fountain.material;
    expect(splitCanal(root)).toBe(true);
    expect((canal.material as THREE.Material).name).toBe(CANAL_MATERIAL);
    expect(fountain.material).toBe(shared);
    const own = canal.material;
    // a second mount of the same parse is given the same one
    const again = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shared as THREE.Material);
    again.name = CANAL_MESH;
    const next = new THREE.Group().add(again);
    expect(splitCanal(next)).toBe(true);
    expect(again.material).toBe(own);
    // and one already split is left as it is
    expect(splitCanal(root)).toBe(true);
    expect(canal.material).toBe(own);
  });

  it('dresses each of them with the same chunks, its own numbers, and once', () => {
    const { root, pool, canal, fountain } = estate();
    splitCanal(root);
    expect(dressWater(root)).toBe(3);
    for (const [mesh, kind] of [[pool, 'pool'], [canal, 'canal'], [fountain, 'fountain']] as const) {
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      expect(mat.customProgramCacheKey()).toBe(`estate-water-v4-${kind}`);
      expect(mat.roughness).toBe(WATER[kind].rough);
      // seen by what it reflects: the contact occlusion leaves it alone
      expect(mat.defines).toHaveProperty('ESTATE_EMITTER');
      expect(mat.defines).toHaveProperty('ESTATE_WATER');
      expect('WATER_PROBE' in mat.defines!).toBe(kind !== 'fountain');
      expect('WATER_POOL' in mat.defines!).toBe(kind === 'pool');
      const shader = { uniforms: {}, ...SHADER } as unknown as THREE.WebGLProgramParametersWithUniforms;
      mat.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
      // one clock for all of it, and each water's own look
      expect(shader.uniforms.uTime).toBe(waterShared.uTime);
      expect(shader.uniforms.uWaterF0).toBe(waterUniforms[kind].uWaterF0);
      expect(shader.uniforms.uProbe).toBe(waterUniforms[kind].uProbe);
      expect(shader.vertexShader).toContain('vRipplePos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      for (const part of ['vec4 waterProxy(', 'vec4 waterStanding(', 'material.specularColor = vec3( uWaterF0 );', 'radiance = seen * waterShade;', 'reflectedLight.directSpecular *= uWaterSun * waterShade;']) {
        expect(shader.fragmentShader).toContain(part);
      }
      // every hook is left in place for whoever dresses the material next
      for (const inc of ['color_fragment', 'normal_fragment_maps', 'lights_physical_fragment', 'lights_fragment_maps', 'lights_fragment_end']) {
        expect(shader.fragmentShader).toContain(`#include <${inc}>`);
      }
    }
    // a second mount finds them dressed and does not wrap them again
    const before = (pool.material as THREE.Material).onBeforeCompile;
    expect(dressWater(root)).toBe(3);
    expect((pool.material as THREE.Material).onBeforeCompile).toBe(before);
  });
});

describe('a mirror, and never more than one', () => {
  it('returns more than water does looked down on, and all of it only at a glance', () => {
    for (const kind of ['pool', 'canal', 'fountain'] as const) {
      // real water is 0.02: a black pool from the film's high frames
      expect(WATER[kind].f0).toBeGreaterThan(0.08);
      // and still a dark mirror, not a sheet of the sky laid on the ground
      expect(WATER[kind].f0).toBeLessThan(0.35);
      expect(WATER[kind].rough).toBeLessThan(0.15);
      expect(WATER[kind].sun).toBeLessThanOrEqual(1);
      expect(WATER[kind].sat).toBeGreaterThan(0.5);
      expect(WATER[kind].sat).toBeLessThanOrEqual(1);
    }
    expect(WATER_FRESNEL).toContain('material.specularF90 = 1.0;');
  });

  it('shows a probe at the strength of the sky that is over it now, with no gain of its own', () => {
    // The forensic audit of 2026-10-09 (#17): at the door frame the pool held
    // the sunset's probe at a gain of 1.6 under a sky gone to a third.
    const src = read('ExteriorModel.tsx');
    expect(src).toContain('const sky = Math.max(1e-3, scene.backgroundIntensity);');
    expect(src).toContain('u.uProbeGain.value = sky / hour.sky;');
    expect(src).toContain('const want = WATER_RE.test(r.mat.name) ? shown : r.gain * base * dusk;');
    expect(WATER_FUNCTIONS).toContain('return textureLod(uProbe, dir, uProbeLod).rgb * uProbeGain;');
    // seven takes or so across an evening: never a stale hour
    expect(Math.ceil(1 / HOUR_STEP)).toBeGreaterThanOrEqual(5);
  });

  it('reads the probe as a mirror does: directly, with its own mipmaps', () => {
    const src = read('poolProbe.ts');
    expect(src).toContain('minFilter: THREE.LinearMipmapLinearFilter');
    expect(src).not.toMatch(/sharedPmrem|fromCubemap/);
    // the mipmaps are made once, by the last face's draw
    expect(src).toContain('cube.texture.generateMipmaps = face === 5;');
  });

  it('never reflects below the horizon, and holds a little of the sky’s colour back: more of it as the dusk comes', () => {
    expect(WATER_REFLECTION).toContain('wR.y = max(wR.y, 0.02);');
    expect(WATER_REFLECTION).toContain('seen = mix(vec3(dot(seen, vec3(0.2126, 0.7152, 0.0722))), seen, uWaterSat);');
    // The client, 2026-10-01: "the blue shadows of this look cheap". The
    // plate's zenith, mirrored whole, is a blue sheet in the dusk's umber.
    for (const kind of ['pool', 'canal', 'fountain'] as const) {
      expect(WATER[kind].dusk).toBeLessThan(WATER[kind].sat);
      expect(WATER[kind].dusk).toBeGreaterThanOrEqual(0.4);
      followWaterHour(0);
      expect(waterUniforms[kind].uWaterSat.value).toBeCloseTo(WATER[kind].sat, 9);
      followWaterHour(1);
      expect(waterUniforms[kind].uWaterSat.value).toBeCloseTo(WATER[kind].dusk, 9);
      followWaterHour(0.5);
      expect(waterUniforms[kind].uWaterSat.value).toBeCloseTo((WATER[kind].sat + WATER[kind].dusk) / 2, 9);
    }
    followWaterHour(0);
  });

  it('gives a rim the share of a pixel it has: a band under a pixel deep is a line, not dashes', () => {
    expect(WATER_FUNCTIONS).toContain('float w = max(r.y * waterFw * 1.5, 1.0e-4);');
    expect(WATER_FUNCTIONS).toContain('float rim = waterRim(P.y + r.y * t - uBoxRimTop, r);');
    expect(WATER_FUNCTIONS).toContain('float rim = waterRim(P.y + r.y * tr - uBasin.w, r);');
    expect(WATER_FUNCTIONS).toContain('return vec4(waterStone(N), share);');
    // the pixel's reach on the water is taken once, at the top of the shader
    expect(WATER_NORMAL).toContain('waterFw = fw;');
  });
});

describe('what the water faces', () => {
  it('stands each probe over the middle of its water, a hand above it', () => {
    expect(PROBE_AT.pool[0]).toBeCloseTo((POOL.x0 + POOL.x1) / 2);
    expect(PROBE_AT.pool[1]).toBeGreaterThan(POOL.level);
    expect(PROBE_AT.pool[1]).toBeLessThan(POOL.level + 0.6);
    expect(PROBE_AT.canal[2]).toBeCloseTo((CANAL.z0 + CANAL.z1) / 2);
    expect(PROBE_AT.canal[1]).toBeGreaterThan(CANAL.level);
  });

  it('puts the house, the balustrade and the hedges where a mirror would', () => {
    for (const kind of ['pool', 'canal'] as const) {
      expect(PROXIES[kind].length).toBeLessThanOrEqual(MAX_PROXIES);
      for (const p of PROXIES[kind]) {
        expect(p.to).toBeGreaterThan(p.from);
        expect(p.top).toBeGreaterThan(0.5);
      }
    }
    // the pool looks east at the house's west wall, the podium's balustrade before it
    const wall = PROXIES.pool.find((p) => p.top > 5)!;
    const rail = PROXIES.pool.find((p) => p.across === 'x' && p.top < 5)!;
    expect(wall.at).toBeGreaterThan(POOL.x1);
    expect(rail.at).toBeGreaterThan(POOL.x1);
    expect(rail.at).toBeLessThan(wall.at);
    // the canal runs to the house's back, between two hedges
    const back = PROXIES.canal.find((p) => p.top > 5)!;
    expect(back.across).toBe('z');
    expect(back.at).toBeGreaterThan(CANAL.z1);
    const hedges = PROXIES.canal.filter((p) => p.across === 'x');
    expect(hedges.map((h) => h.at).sort((a, b) => a - b)).toEqual([-3.2, 3.2]);
    for (const h of hedges) expect(Math.abs(h.at)).toBeGreaterThan(CANAL.x1);
    // a ray that clears them reads the cube along itself, unless the cube would show it the house
    expect(WATER_REFLECTION).toContain('} else if (waterProxy(uProbeAt, wR).w < 0.5) {');
  });

  it('draws what stands in a basin, in it: the rim, the pedestal, the bowl over the water', () => {
    // each tier stands on the one below, inside its basin
    for (const [basin, tiers] of [[FOUNTAIN, FOUNTAIN_TIERS], [ROUNDEL, ROUNDEL_TIERS]] as const) {
      expect(basin.rim).toBeGreaterThan(basin.level);
      let foot: number = basin.level;
      for (const [radius, y0, y1] of tiers) {
        expect(radius).toBeLessThan(basin.r);
        expect(y0).toBeGreaterThanOrEqual(foot - 1e-6);
        expect(y1).toBeGreaterThan(y0);
        foot = y0;
      }
    }
    // the fountain's bowl is wider than its pedestal: its underside is what the basin holds
    expect(FOUNTAIN_TIERS[1][0]).toBeGreaterThan(FOUNTAIN_TIERS[0][0] * 3);
    expect(waterUniforms.fountain.uBasin.value.toArray()).toEqual([FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.r, FOUNTAIN.rim]);
    expect(waterUniforms.canal.uBasin.value.toArray()).toEqual([ROUNDEL.x, ROUNDEL.z, ROUNDEL.r, ROUNDEL.rim]);
    expect(waterUniforms.pool.uBasin.value.z).toBe(0);
    // the stone is lit by the frame's own sun and sky
    expect(WATER_FUNCTIONS).toContain('directionalLights[0].color * max(dot(N, L), 0.0)');
    expect(WATER_FUNCTIONS).toContain('hemisphereLights[0].groundColor');
  });

  it("gives the pool its coping on three sides and none at the overflow, the canal its kerb all round", () => {
    const pool = waterUniforms.pool.uBoxRim.value;
    expect(pool.x).toBeLessThan(-1000);
    expect([pool.y, pool.z, pool.w]).toEqual([POOL.z0, POOL.x1, POOL.z1]);
    expect(waterUniforms.pool.uBoxRimTop.value).toBe(POOL.coping);
    expect(waterUniforms.canal.uBoxRim.value.toArray()).toEqual([CANAL.x0, CANAL.z0, CANAL.x1, CANAL.z1]);
    expect(waterUniforms.canal.uBoxRimTop.value).toBe(CANAL.kerb);
    expect(waterUniforms.fountain.uBoxRimTop.value).toBeLessThan(0);
  });
});

describe('the trough beside the pool', () => {
  it('is dark by where it lies, with no noise in it', () => {
    // The lens's contact occlusion printed its sampling noise on the trough's
    // water as a stipple ("a low-resolution noise texture with visible
    // blocks"). The pass leaves water alone; the slot's shade is by height.
    expect(POOL.trough).toBeLessThan(POOL.level - 0.5);
    expect(WATER.troughShade).toBeLessThan(0.6);
    expect(WATER.troughShade).toBeGreaterThan(0.1);
    expect(WATER_COLOUR).toContain('waterShade = mix(uTroughShade, 1.0, smoothstep(uPoolLevel - 0.35, uPoolLevel - 0.05, vRipplePos.y));');
    expect(WATER_SUN).toContain('waterShade');
  });

  it('is a slate under the reflection, not a resort’s turquoise', () => {
    expect(WATER.pool.body).toBeLessThan(1);
    // most of the file's colour is given up for its own grey
    expect(WATER_COLOUR).toContain('diffuseColor.rgb, 0.3) * uWaterBody;');
  });
});
