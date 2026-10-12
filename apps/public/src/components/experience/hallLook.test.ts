// apps/public/src/components/experience/hallLook.test.ts
//
// The old-money hall pass as a contract: the reflection probe's shader patches,
// the bake/probe split, the walnut sheet's orientation on a panel, and the
// floor's slab cut.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HALL_BOX, HALL_KEY_TINT, KEY_LIT, PROBE_GAIN, installHallProbe, prepareHallProbe } from './hallProbe';
import { WALNUT_SHEET, projectPanelUVs } from './hallWalnut';
import { SLAB, dressFloor } from './hallFloor';
import { beatEmphasis, buildInteriorBeats } from './interiorPath';
import { FRIEZE, plainFrieze } from './hallJoinery';

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
      /#if !\( defined\( HALL_PROBE \) && defined\( USE_LIGHTMAP \) \)\s*#ifdef HALL_KEY_TINT[\s\S]*?#else\s*iblIrradiance \+= getIBLIrradiance\( geometryNormal \);\s*#endif\s*#endif/,
    );
    // ...and no ambient.
    expect(C.lights_fragment_begin).toMatch(
      /getAmbientLightIrradiance\( ambientLightColor \);\s*#if defined\( HALL_PROBE \) && defined\( USE_LIGHTMAP \)\s*irradiance = vec3\( 0\.0 \);/,
    );
  });

  it('lights what the bake never reached in the key\u2019s colour, at the probe\u2019s brightness', () => {
    // The forensic audit of 2026-10-09 (#34): "The balusters, plinths and
    // capitals render pink beside ivory walls." The probe is a picture of
    // walnut, navy and gilt as well as of plaster; its light on a white
    // baluster was mauve.
    expect(C.lights_fragment_maps).toContain(
      'iblIrradiance += HALL_KEY_TINT * dot( getIBLIrradiance( geometryNormal ), vec3( 0.2126, 0.7152, 0.0722 ) );',
    );
    // a warm white of the same luminance: nothing brighter or darker for it
    const [r, g, b] = HALL_KEY_TINT;
    expect(0.2126 * r + 0.7152 * g + 0.0722 * b).toBeCloseTo(1, 2);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    // the painted trim, the walnut, the urns' marble: and nothing the bake lights
    for (const name of ['MAT_Trim_Cream', 'MAT_Walnut_Crown', 'MAT_Walnut_Straight', 'MAT_Wood_Dark', 'MAT_MarbleFloor']) {
      expect(KEY_LIT.test(name), name).toBe(true);
    }
    for (const name of ['MAT_Trim_Cream_LM', 'MAT_Wall_Plaster_LM', 'MAT_MarbleFloor_LM', 'MAT_Gold']) {
      expect(KEY_LIT.test(name), name).toBe(false);
    }
    const trim = new THREE.MeshStandardMaterial({ name: 'MAT_Trim_Cream' });
    const wall = new THREE.MeshStandardMaterial({ name: 'MAT_Wall_Plaster_LM' });
    const root = new THREE.Group();
    for (const m of [trim, wall]) root.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    prepareHallProbe(root, new THREE.Texture());
    expect(trim.defines).toHaveProperty('HALL_KEY_TINT');
    expect(trim.defines!.HALL_KEY_TINT).toMatch(/^vec3\( 1\.1500, 0\.9800, 0\.7900 \)$/);
    expect(wall.defines).not.toHaveProperty('HALL_KEY_TINT');
    // waxed walnut carries half the room, not all of it (#36: a mirror)
    expect(PROBE_GAIN.MAT_Walnut_Crown).toBeLessThan(0.7);
    expect(PROBE_GAIN.MAT_Walnut_Straight).toBe(PROBE_GAIN.MAT_Walnut_Crown);
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

describe('the walnut fields', () => {
  it('lays a flat panel in metres of veneer: its centre line a book match, its top edge a leaf\u2019s top', () => {
    // The arch behind the portrait: thin in z, 3.7 m across, 7.25 m tall.
    const g = new THREE.BoxGeometry(3.7, 7.25, 0.02);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
    projectPanelUVs(mesh);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    const sheet = WALNUT_SHEET.crown;
    for (let i = 0; i < pos.count; i += 1) {
      // across: metres from the centre line, in sheets (mirrored either side)
      expect(uv.getX(i)).toBeCloseTo(pos.getX(i) / sheet.across, 5);
      // KTX2 loads with flipY false, so the sheet's first row is v = 0: the top.
      if (pos.getY(i) > 1) expect(uv.getY(i)).toBeCloseTo(0, 5);
      if (pos.getY(i) < -1) expect(uv.getY(i)).toBeCloseTo(7.25 / sheet.along, 5);
    }
    // (it was one sheet stretched to the panel: a leaf 62 cm wide and its
    // flames three and a half times too long: the forensic audit, #37)
    expect(3.7 / sheet.across).toBeGreaterThan(2.5);
  });

  it('finds up from the world, not from the geometry, and measures in the world', () => {
    // The same panel authored lying down, and stood up and scaled by its node.
    const g = new THREE.BoxGeometry(2, 0.05, 2);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
    mesh.rotation.x = -Math.PI / 2; // local +z becomes world +y
    mesh.scale.set(0.5, 1, 1.5);
    projectPanelUVs(mesh);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i += 1) {
      if (pos.getZ(i) > 0.5) expect(uv.getY(i)).toBeCloseTo(0, 5);
      if (pos.getZ(i) < -0.5) expect(uv.getY(i)).toBeCloseTo(3 / WALNUT_SHEET.crown.along, 5);
      expect(Math.abs(uv.getX(i))).toBeCloseTo(0.5 / WALNUT_SHEET.crown.across, 5);
    }
  });

  it('draws both sheets at one size: a leaf a third of a metre, four to the sheet\u2019s length', () => {
    expect(WALNUT_SHEET.crown.across).toBeCloseTo(1.364, 3);
    expect(WALNUT_SHEET.straight.across).toBeCloseTo(0.682, 3);
    expect(WALNUT_SHEET.crown.along).toBe(WALNUT_SHEET.straight.along);
    // and the generator says the same (tools/gltf/make_walnut_veneer.py)
    const tool = readFileSync(resolve(__dirname, '../../../../../tools/gltf/make_walnut_veneer.py'), 'utf8');
    expect(tool).toContain('MPP = 0.341 / 512');
    expect(tool).toContain("crown = book([a, a, b, b])");
    expect(tool).toContain("straight = book([s, s])");
  });
});

describe('the portrait beat', () => {
  it('peaks where the camera is on the painting, not over the map table', () => {
    const beats = buildInteriorBeats(3);
    const at = (id: string) => beats.find((b) => b.id === id)!.at;
    expect(beatEmphasis(beats, at('portrait'), 'portrait')).toBe(1);
    // Clickable (gate 0.15) on the approach and just after it...
    expect(beatEmphasis(beats, (at('stair-foot') + at('portrait') * 3) / 4, 'portrait')).toBeGreaterThan(0.15);
    // ...and dark by the time the camera has come down into the court.
    expect(beatEmphasis(beats, at('court'), 'portrait')).toBe(0);
    expect(beatEmphasis(beats, at('map'), 'portrait')).toBe(0);
    // And the table's own emphasis is whole at the last beat, where its pins
    // become targets (MapTable, mapStage).
    expect(beatEmphasis(beats, at('map'), 'map')).toBe(1);
    expect(beatEmphasis(beats, at('portrait'), 'map')).toBe(0);
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
  // A wall on the room's -x side, its face at x = -9.9, with a lightmap
  // coordinate that says where on the wall a point is: u along z, v up.
  const wallAt = (z0: number, z1: number, h: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-9.9, 0, z0, -9.9, 0, z1, -9.9, h, z1, -9.9, h, z0], 3));
    g.setAttribute('uv1', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    // facing the room (+x)
    g.setIndex([0, 2, 1, 0, 3, 2]);
    g.computeVertexNormals();
    const wall = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: 'MAT_Wall_Plaster_LM', color: '#efe7da' }));
    wall.name = 'int_wall_left';
    return wall;
  };
  const room = () => {
    const root = new THREE.Group();
    const left = wallAt(-8, 8, 13);
    // and a wall opposite, so the room has a middle
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.3, 13, 16), new THREE.MeshStandardMaterial());
    right.position.set(10.05, 6.5, 0);
    right.name = 'int_wall_right';
    root.add(left, right);
    const plaque = new THREE.BoxGeometry(0.024, 0.25, 0.226);
    const plaques = [-0.323, 0, 0.323, 0.646].map((z, i) => {
      const m = new THREE.Mesh(plaque, new THREE.MeshStandardMaterial({ name: 'MAT_Trim_Cream' }));
      m.name = `anth_y90_0${i}`;
      m.position.set(-9.89, 7.3, z);
      root.add(m);
      return m;
    });
    return { root, left, plaques };
  };

  it('puts the plaques away and covers their shade with the wall\u2019s own light', () => {
    const { root, left, plaques } = room();
    const frieze = plainFrieze(root);
    expect(frieze.counts.plaques).toBe(4);
    expect(frieze.counts.runs).toBe(1);
    for (const p of plaques) expect(p.visible).toBe(false);
    const strip = root.children.find((o) => o.name.startsWith('frieze_plain_')) as THREE.Mesh;
    expect(strip).toBeDefined();
    const g = strip.geometry;
    const pos = g.getAttribute('position');
    const uv1 = g.getAttribute('uv1');
    const col = g.getAttribute('color');
    g.computeBoundingBox();
    const b = g.boundingBox!;
    // a hair off the wall, toward the room
    expect(b.min.x).toBeCloseTo(-9.9 + FRIEZE.proud, 5);
    expect(b.max.x).toBeCloseTo(-9.9 + FRIEZE.proud, 5);
    // over every plaque, and past them: their shade is a star 25 cm tall
    expect(b.min.z).toBeLessThan(-0.323 - 0.113);
    expect(b.max.z).toBeGreaterThan(0.646 + 0.113);
    expect(b.min.y).toBeLessThan(7.175);
    expect(b.max.y).toBeGreaterThan(7.425);
    for (let i = 0; i < pos.count; i += 1) {
      // THE WALL'S OWN LIGHT, from the clean plaster under the plaques: the
      // lightmap coordinate of the wall at this place along it, and at one
      // height for the whole strip
      expect(uv1.getX(i)).toBeCloseTo((pos.getZ(i) + 8) / 16, 4);
      expect(uv1.getY(i)).toBeCloseTo((7.175 - FRIEZE.below) / 13, 4);
      // the architrave's shade along the top edge, and none below it
      expect(col.getX(i)).toBeCloseTo(pos.getY(i) > 7.43 ? FRIEZE.shade : 1, 5);
    }
    // it is the wall: its material, with the shade drawn in
    const mat = strip.material as THREE.MeshStandardMaterial;
    expect(mat).not.toBe(left.material);
    expect('#' + mat.color.getHexString()).toBe('#efe7da');
    expect(mat.vertexColors).toBe(true);
    expect(mat.polygonOffset).toBe(true);
    // and it faces the room
    const [i0, i1, i2] = [0, 1, 2].map((k) => g.getIndex()!.getX(k));
    const [p0, p1, p2] = [i0, i1, i2].map((i) => new THREE.Vector3().fromBufferAttribute(pos, i));
    expect(new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0)).normalize().x).toBeCloseTo(1, 5);

    frieze.dispose();
    for (const p of plaques) expect(p.visible).toBe(true);
    expect(root.children.some((o) => o.name.startsWith('frieze_plain_'))).toBe(false);
  });

  it('is two strips where the plaques stop for something (the arch on the stair wall)', () => {
    const { root } = room();
    const far = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.25, 0.226), new THREE.MeshStandardMaterial());
    far.name = 'anth_y90_09';
    far.position.set(-9.89, 7.3, 4);
    root.add(far);
    expect(plainFrieze(root).counts.runs).toBe(2);
  });
});
