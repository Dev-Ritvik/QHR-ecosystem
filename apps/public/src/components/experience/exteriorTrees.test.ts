// apps/public/src/components/experience/exteriorTrees.test.ts
//
// The generated palms as a contract: their crowns hang each in its own way,
// and they are lit as trees are (exteriorFoliage, PALM_LIGHT).

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PALM_LIGHT, PALM_SCATTER, TRANSLUCENCY, foliageUniforms } from './exteriorFoliage';
import { PALM_CROWN, PALM_LEAF, PALM_THROUGH, dressPalmCrowns } from './exteriorTrees';

function palm(name: string) {
  return new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ name }));
}

function compiled(m: THREE.Mesh) {
  const shader = {
    uniforms: {} as Record<string, unknown>,
    vertexShader: 'void main() {\n#include <begin_vertex>\n}',
    fragmentShader: 'void main() {\n#include <color_fragment>\n#include <lights_fragment_end>\n}',
  };
  (m.material as THREE.Material).onBeforeCompile(
    shader as unknown as THREE.WebGLProgramParametersWithUniforms,
    {} as THREE.WebGLRenderer,
  );
  return shader;
}

describe('the generated palms', () => {
  it('dresses the two generated palms and no other tree', () => {
    const root = new THREE.Group();
    root.add(palm('MAT_Palm_Royal'), palm('MAT_Palm_Coconut'), palm('MAT_Palm_Frond'), palm('MAT_Leaves_Mango'));
    expect(Object.keys(PALM_CROWN)).toEqual(['MAT_Palm_Royal', 'MAT_Palm_Coconut']);
    expect(dressPalmCrowns(root)).toBe(2);
    expect(dressPalmCrowns(root)).toBe(0);
  });

  it('tells the fragment where the crown is, and bends only the crown', () => {
    const root = new THREE.Group();
    const royal = palm('MAT_Palm_Royal');
    root.add(royal);
    dressPalmCrowns(root);
    const { vertexShader } = compiled(royal);
    expect(vertexShader).toContain('varying float vPalmCrown;');
    expect(vertexShader).toContain('vPalmCrown = crown;');
    const c = PALM_CROWN.MAT_Palm_Royal;
    expect(vertexShader).toContain(`smoothstep(${(c.from * c.height).toFixed(3)}, ${(c.to * c.height).toFixed(3)}, transformed.y)`);
  });

  it('passes the sun through what is leaf, by the key the other trees follow', () => {
    const root = new THREE.Group();
    const coconut = palm('MAT_Palm_Coconut');
    root.add(coconut);
    dressPalmCrowns(root);
    const shader = compiled(coconut);
    // the same uniforms the broadleaf cards read: one sun, one evening
    expect(shader.uniforms.uFoliageSunDir).toBe(foliageUniforms.uSunDir);
    expect(shader.uniforms.uFoliageSunColor).toBe(foliageUniforms.uSunColor);
    expect(shader.uniforms.uFoliageGlow).toBe(foliageUniforms.uGlow);
    expect(shader.uniforms.uPalmThrough).toBe(foliageUniforms.uPalmThrough);
    // leaf is the crown where it is green; the trunk is never lit from behind
    expect(PALM_LEAF).toContain('palmLeaf = vPalmCrown * smoothstep(1.0, 1.2, green);');
    // its green is taken toward the crowns it stands among, never past grey
    expect(PALM_LEAF).toContain('mix(vec3(value), diffuseColor.rgb, uPalmChroma)');
    expect(PALM_LIGHT.chroma).toBeGreaterThan(0.3);
    expect(PALM_LIGHT.chroma).toBeLessThanOrEqual(1);
    expect(shader.uniforms.uPalmChroma).toBe(foliageUniforms.uPalmChroma);
    expect(PALM_THROUGH).toContain(`uPalmThrough * uFoliageGlow * (back + wrap + ${PALM_SCATTER.toFixed(2)}) * palmLeaf`);
    expect(PALM_SCATTER).toBeGreaterThan(0);
    expect(PALM_SCATTER).toBeLessThan(0.5);
    expect(shader.fragmentShader).toContain(PALM_LEAF.trim());
    expect(shader.fragmentShader).toContain(PALM_THROUGH.trim());
    // a frond passes at least what a leaf card does, and nothing is darkened
    expect(PALM_LIGHT.through).toBeGreaterThanOrEqual(TRANSLUCENCY);
    expect(PALM_LIGHT.leaf).toBeGreaterThanOrEqual(1);
    expect(PALM_LIGHT.trunk).toBeGreaterThanOrEqual(1);
    expect(foliageUniforms.uPalmThrough.value).toBe(PALM_LIGHT.through);
  });
});
