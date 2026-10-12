// apps/public/src/components/experience/exteriorSurfaces.test.ts
//
// The estate's stone as a contract: which materials are dressed, and that a
// baked soffit keeps the light from below.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BOUNCE_UNDER_COVER, BOUNDARY, GABLE_BOUNCE, dressSurfaces } from './exteriorSurfaces';

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
    expect(dressSurfaces(root)).toEqual({ stone: 3, slate: 1, hedge: 1 });
    expect(dressSurfaces(root)).toEqual({ stone: 0, slate: 0, hedge: 0 });
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
});
