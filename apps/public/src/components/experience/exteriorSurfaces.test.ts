// apps/public/src/components/experience/exteriorSurfaces.test.ts
//
// The estate's stone as a contract: which materials are dressed, and that a
// baked soffit keeps the light from below.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BOUNCE_UNDER_COVER, BOUNDARY, BOUNDARY_FAR, GABLE_BOUNCE, dressSurfaces } from './exteriorSurfaces';

function mesh(name: string) {
  return new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ name }));
}

function compiled(m: THREE.Mesh) {
  const shader = {
    uniforms: {},
    vertexShader: 'void main() {\n#include <begin_vertex>\n}',
    fragmentShader:
      'void main() {\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n#include <aomap_fragment>\n}',
  } as unknown as THREE.WebGLProgramParametersWithUniforms;
  (m.material as THREE.Material).onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader.fragmentShader;
}

describe('the estate stone', () => {
  it('dresses the stone, the roof and the hedges, each once', () => {
    const root = new THREE.Group();
    root.add(mesh('MAT_Stone_Wall_AO'), mesh('MAT_Stone_Trim'), mesh('MAT_Stone_Rustic_AO'), mesh('MAT_Roof_Slate_AO'), mesh('MAT_Hedge'), mesh('MAT_Gold'));
    expect(dressSurfaces(root)).toEqual({ stone: 3, slate: 1, hedge: 1, setts: 0, drive: 0 });
    expect(dressSurfaces(root)).toEqual({ stone: 0, slate: 0, hedge: 0, setts: 0, drive: 0 });
  });

  it('puts back under a baked soffit the bounce the occlusion took, and only there', () => {
    const root = new THREE.Group();
    const trim = mesh('MAT_Stone_Trim_AO');
    const slate = mesh('MAT_Roof_Slate_AO');
    root.add(trim, slate);
    dressSurfaces(root);
    const stone = compiled(trim);
    // after the occlusion has been applied, never in place of it
    expect(stone).toMatch(/#include <aomap_fragment>\s*#if defined\( USE_AOMAP \) && \( NUM_HEMI_LIGHTS > 0 \)/);
    // by how squarely the face looks down: nothing on a wall, nothing on a face that looks up
    expect(stone).toContain('float under = saturate( -dot( geometryNormal, hemisphereLights[ 0 ].direction ) );');
    // the ground's colour alone (the sky stays shut out), and only the share the occlusion took
    expect(stone).toContain(
      `${BOUNCE_UNDER_COVER.toFixed(2)} * ( 1.0 - ambientOcclusion ) * under * fromBelow * BRDF_Lambert( material.diffuseColor )`,
    );
    expect(stone.split('fromBelow')[1]).not.toContain('skyColor');
    expect(BOUNCE_UNDER_COVER).toBeGreaterThan(0);
    expect(BOUNCE_UNDER_COVER).toBeLessThanOrEqual(1);
    // A gable's soffit, and only a gable's: above the cornice the walls end
    // at (the model's CORNICE_TOP is 9.4), a face that looks down and leans
    // out takes a share of the light the wall under it stands in.
    expect(GABLE_BOUNCE.from).toBeGreaterThan(9.4);
    expect(GABLE_BOUNCE.from).toBeLessThan(9.5);
    expect(GABLE_BOUNCE.share).toBeGreaterThan(0.1);
    expect(GABLE_BOUNCE.share).toBeLessThan(0.5);
    expect(stone).toContain(`if ( vAgeWorld.y > ${GABLE_BOUNCE.from.toFixed(2)} && under > 0.0 ) {`);
    // the wall under a gable's soffit is the front it stands on, which faces along z
    expect(stone).toContain('vec3 gableN = inverseTransformDirection( geometryNormal, viewMatrix );');
    expect(stone).toContain('directionalLights[ 0 ].color * saturate( sign( gableN.z ) * gableSun.z )');
    // off stone of the house's colour, not the soffit's own (which the shelter has darkened)
    expect(stone).toContain(`vec3( ${GABLE_BOUNCE.stone.map((v) => v.toFixed(2)).join(', ')} ) * BRDF_Lambert( material.diffuseColor )`);
    // nothing on a level soffit: it leans over no wall
    expect(stone).toContain('smoothstep( 0.08, 0.25, gableLean )');
    // the roof has no soffits and keeps three's own occlusion
    expect(compiled(slate)).toContain('#include <aomap_fragment>\n}');
  });

  it('weathers the compound wall as stone, under its own coping and no other ledge', () => {
    const root = new THREE.Group();
    const wall = mesh('MAT_Stone_Boundary');
    const house = mesh('MAT_Stone_Wall_AO');
    root.add(wall, house);
    expect(dressSurfaces(root).stone).toBe(2);
    const defines = (m: THREE.Mesh) => (m.material as THREE.Material).defines ?? {};
    expect(defines(wall)).toHaveProperty('ESTATE_BOUNDARY');
    expect(defines(wall)).toHaveProperty('ESTATE_TRIM');
    expect(defines(house)).not.toHaveProperty('ESTATE_BOUNDARY');
    const frag = compiled(wall);
    // the coping's height is the model's (build_compound_wall: piers to 2.3 m under a coping to 2.42)
    expect(BOUNDARY.coping).toBe(2.3);
    expect(frag).toContain(`float d = ${BOUNDARY.coping.toFixed(2)} - w.y;`);
    expect(frag).toContain('#ifdef ESTATE_BOUNDARY');
    // and its dribbles are shorter than the wall is high
    expect(BOUNDARY.fall[1]).toBeLessThan(BOUNDARY.coping);
  });

  it("shades the far wall's coping and piers as its face while they are under a pixel across", () => {
    const root = new THREE.Group();
    const wall = mesh('MAT_Stone_Boundary');
    const house = mesh('MAT_Stone_Wall_AO');
    root.add(wall, house);
    dressSurfaces(root);
    const frag = compiled(wall);
    // the model's measures (build_compound_wall): side runs at x = ±72, a
    // coping 0.54 across over a wall 0.4 thick, piers 0.7 thick
    expect(BOUNDARY_FAR.x).toBe(72);
    expect(BOUNDARY_FAR.coping).toBeCloseTo(0.27 * 2, 6);
    expect(BOUNDARY_FAR.proud).toBeCloseTo(0.35 - 0.2, 6);
    // after the normal map, on the boundary's material alone
    expect(frag).toMatch(/#include <normal_fragment_maps>\s*#ifdef ESTATE_BOUNDARY/);
    expect(frag).toContain(`abs(abs(bw.x) - ${BOUNDARY_FAR.x.toFixed(1)}) < 1.5`);
    // the wall's own face and the coping's front are never touched
    expect(frag).toContain('if (abs(dot(bFace, bAcross)) < 0.5) {');
    expect(frag).toContain(`smoothstep(${BOUNDARY_FAR.from.toFixed(1)}, ${BOUNDARY_FAR.to.toFixed(1)}, bBreadth / bPerPx)`);
    expect(compiled(house)).toContain('#ifdef ESTATE_BOUNDARY');
    expect((house.material as THREE.Material).defines ?? {}).not.toHaveProperty('ESTATE_BOUNDARY');
    // At the film's 17% the far run is 100 m off and 5.9 degrees under the
    // eye: a pixel of the 945-row frame is 6.7 cm there (40-degree lens), and
    // the coping's top is 0.54 x sin 5.9 = 5.5 cm of it: under `from`, so the
    // wall's face. From the cover's terrace wall, 30 m off and 20 degrees
    // under, it is 9 px: its own.
    const px = (dist: number, deg: number) =>
      (BOUNDARY_FAR.coping * Math.sin((deg * Math.PI) / 180)) / ((2 * dist * Math.tan((20 * Math.PI) / 180)) / 945);
    expect(px(100, 5.9)).toBeLessThan(BOUNDARY_FAR.from);
    expect(px(30, 20)).toBeGreaterThan(BOUNDARY_FAR.to);
  });
});
