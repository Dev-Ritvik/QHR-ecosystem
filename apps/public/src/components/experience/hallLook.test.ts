// apps/public/src/components/experience/hallLook.test.ts
//
// The old-money hall pass as a contract: the reflection probe's shader patches,
// the bake/probe split, the walnut sheet's orientation on a panel, and the
// floor's slab cut.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HALL_BOX, PROBE_GAIN, installHallProbe, prepareHallProbe } from './hallProbe';
import { projectPanelUVs } from './hallWalnut';
import { SLAB, dressFloor } from './hallFloor';
import { beatEmphasis, buildInteriorBeats } from './interiorPath';
import { faceTheFrieze } from './hallJoinery';

installHallProbe();
const C = THREE.ShaderChunk as unknown as Record<string, string>;

describe('the hall probe', () => {
  it('box-projects the specular lookup, and only under its define', () => {
    const chunk = C.envmap_physical_pars_fragment;
    expect(chunk).toContain('vec3 hallParallax( const in vec3 dir )');
    const at = chunk.indexOf('reflectVec = hallParallax( reflectVec );');
    const sample = chunk.indexOf('vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(sample);
    expect(chunk.slice(chunk.lastIndexOf('#ifdef HALL_PROBE', at), at)).toContain('#ifdef HALL_PROBE');
  });

  it('keeps diffuse light on lightmapped surfaces to the bake alone', () => {
    // No probe irradiance...
    expect(C.lights_fragment_maps).toMatch(
      /#if !\( defined\( HALL_PROBE \) && defined\( USE_LIGHTMAP \) \)\s*iblIrradiance \+= getIBLIrradiance\( geometryNormal \);\s*#endif/,
    );
    // ...and no ambient.
    expect(C.lights_fragment_begin).toMatch(
      /getAmbientLightIrradiance\( ambientLightColor \);\s*#if defined\( HALL_PROBE \) && defined\( USE_LIGHTMAP \)\s*irradiance = vec3\( 0\.0 \);/,
    );
  });

  it('installs once', () => {
    const before = C.envmap_physical_pars_fragment;
    installHallProbe();
    expect(C.envmap_physical_pars_fragment).toBe(before);
    expect(before.split('vec3 hallParallax(').length).toBe(2);
  });

  it('binds the probe explicitly, so each material keeps its own gain', () => {
    const env = new THREE.Texture();
    const floor = new THREE.MeshStandardMaterial({ name: 'MAT_MarbleFloor_LM' });
    const gold = new THREE.MeshStandardMaterial({ name: 'MAT_Gold' });
    const holo = new THREE.MeshStandardMaterial({ name: 'MAT_Holo3D_Plate_S1' });
    const root = new THREE.Group();
    for (const m of [floor, gold, holo]) root.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    const mats = prepareHallProbe(root, env);
    expect(mats).toHaveLength(3);
    for (const m of mats) expect(m.envMap).toBe(env);
    expect(gold.envMapIntensity).toBe(PROBE_GAIN.MAT_Gold);
    expect(floor.defines).toHaveProperty('HALL_PROBE');
    // A hologram is light, not a surface: no reflection, no box projection.
    expect(holo.envMapIntensity).toBe(0);
    expect(holo.defines ?? {}).not.toHaveProperty('HALL_PROBE');
  });

  it('projects inside the room it was measured from', () => {
    for (let i = 0; i < 3; i += 1) expect(HALL_BOX.max[i]).toBeGreaterThan(HALL_BOX.min[i]);
    // The floor is at 0 and the room is the extended hall's 19.8 x 8 x 15.4.
    expect(HALL_BOX.min[1]).toBe(0);
    expect(HALL_BOX.max[0] - HALL_BOX.min[0]).toBeCloseTo(19.8, 5);
    expect(HALL_BOX.max[2] - HALL_BOX.min[2]).toBeCloseTo(15.4, 5);
  });
});

describe('the walnut panels', () => {
  it('lays one sheet per panel, top edge at v = 0', () => {
    // A panel on a side wall: thin in x, 2.1 m along z, 2.07 m tall.
    const g = new THREE.BoxGeometry(0.05, 2.07, 2.1);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
    projectPanelUVs(mesh);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    let us = [Infinity, -Infinity];
    for (let i = 0; i < pos.count; i += 1) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      us = [Math.min(us[0], u), Math.max(us[1], u)];
      // KTX2 loads with flipY false, so the sheet's first row is v = 0: the top.
      if (pos.getY(i) > 1) expect(v).toBeCloseTo(0, 5);
      if (pos.getY(i) < -1) expect(v).toBeCloseTo(1, 5);
    }
    expect(us[0]).toBeCloseTo(0, 5);
    expect(us[1]).toBeCloseTo(1, 5);
  });

  it('finds up from the world, not from the geometry', () => {
    // The same panel authored lying down and stood up by its node.
    const g = new THREE.BoxGeometry(2.1, 0.05, 2.07);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
    mesh.rotation.x = -Math.PI / 2; // local +z becomes world +y
    projectPanelUVs(mesh);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i += 1) {
      if (pos.getZ(i) > 1) expect(uv.getY(i)).toBeCloseTo(0, 5);
    }
  });
});

describe('the portrait beat', () => {
  it('peaks where the camera is on the painting, not facing the front doors', () => {
    const beats = buildInteriorBeats(3);
    const at = (id: string) => beats.find((b) => b.id === id)!.at;
    expect(beatEmphasis(beats, at('portrait'), 'portrait')).toBe(1);
    // Clickable (gate 0.15) on the approach and just after it...
    expect(beatEmphasis(beats, (at('stair-foot') + at('portrait') * 3) / 4, 'portrait')).toBeGreaterThan(0.15);
    // ...and dark by the time the camera has turned to the doors.
    expect(beatEmphasis(beats, at('turn-out'), 'portrait')).toBe(0);
    expect(beatEmphasis(beats, at('city'), 'portrait')).toBe(0);
  });
});

describe('the marble floor', () => {
  it('is a whole number of slabs in both directions', () => {
    const w = HALL_BOX.max[0] - HALL_BOX.min[0];
    const d = HALL_BOX.max[2] - HALL_BOX.min[2];
    expect(Math.abs(w / SLAB - Math.round(w / SLAB))).toBeLessThan(1e-9);
    expect(Math.abs(d / SLAB - Math.round(d / SLAB))).toBeLessThan(1e-9);
  });

  it('re-cuts the marble per slab and roughens the joints', () => {
    const floor = new THREE.MeshStandardMaterial({ name: 'MAT_MarbleFloor_LM' });
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.PlaneGeometry(), floor));
    expect(dressFloor(root)).toBe(1);
    expect(dressFloor(root)).toBe(0); // once
    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.physical.vertexShader,
      fragmentShader: THREE.ShaderLib.physical.fragmentShader,
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    floor.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toContain('textureGrad( map, slabUv, dFdx( vMapUv ), dFdy( vMapUv ) )');
    expect(shader.fragmentShader).toContain('roughnessFactor = mix( roughnessFactor, 0.55, joint );');
    expect(shader.fragmentShader).not.toContain('#include <map_fragment>');
    expect(floor.customProgramCacheKey()).toBe('hall-floor-slabs');
  });
});

describe('the frieze', () => {
  it('turns the anthemions to face the room, once', () => {
    // One triangle facing -Z (into the wall), as the delivered KIT_anth_M does.
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.01, 0, 1, -0.01, 1, 0, -0.01], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, -1, 0, 0, -1, 0, 0, -1], 3));
    g.setIndex([0, 1, 2]);
    const faceNormal = () => {
      const p = g.getAttribute('position');
      const [a, b, c] = [0, 1, 2].map((i) => new THREE.Vector3().fromBufferAttribute(p, g.getIndex()!.getX(i)));
      return new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    };
    expect(faceNormal().z).toBeCloseTo(-1, 5);
    const root = new THREE.Group();
    const a = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
    a.name = 'anth_x0_00';
    const b = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
    b.name = 'anth_x0_01';
    root.add(a, b);
    expect(faceTheFrieze(root)).toBe(1); // shared geometry, mirrored once
    expect(faceNormal().z).toBeCloseTo(1, 5);
    expect(g.getAttribute('normal').getZ(0)).toBeCloseTo(1, 5);
    expect(g.getAttribute('position').getZ(0)).toBeCloseTo(0.01, 5);
    expect(faceTheFrieze(root)).toBe(0); // and never twice
  });
});
