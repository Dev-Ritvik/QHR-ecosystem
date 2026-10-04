// apps/public/src/components/experience/exteriorLawn.test.ts
//
// The lawn as a contract: only the lawn is dressed, its shader carries the
// bands, their fade and the macro field, and texture filtering is set once.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BAND_M, GRAVEL_MAP_FRAGMENT, GRAVEL_TILE_M, LAWN_MAP_FRAGMENT, dressLawn, sharpenTextures } from './exteriorLawn';

function mesh(name: string, map = true) {
  const mat = new THREE.MeshStandardMaterial({ name });
  if (map) mat.map = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  return new THREE.Mesh(new THREE.PlaneGeometry(), mat);
}

describe('the estate lawn', () => {
  it('dresses the lawn and nothing else', () => {
    const root = new THREE.Group();
    const lawn = mesh('MAT_Lawn_AOG');
    const paving = mesh('MAT_Stone_Paving_AOG');
    root.add(lawn, paving);
    expect(dressLawn(root)).toBe(1);
    expect((lawn.material as THREE.Material).customProgramCacheKey()).toBe('estate-lawn');
    expect((paving.material as THREE.Material).customProgramCacheKey()).not.toBe('estate-lawn');
    // Idempotent: a second pass over the same (shared, cached) material does nothing.
    expect(dressLawn(root)).toBe(0);
  });

  it('injects bands that depend on the view and fade before they alias', () => {
    const lawn = mesh('MAT_Lawn_AOG');
    const root = new THREE.Group();
    root.add(lawn);
    dressLawn(root);
    const shader = {
      uniforms: {},
      vertexShader: 'void main() {\n#include <begin_vertex>\n}',
      fragmentShader: 'void main() {\n#include <map_fragment>\n}',
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    (lawn.material as THREE.Material).onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.vertexShader).toContain('vLawnWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    expect(shader.fragmentShader).toContain('float lawnNoise(vec2 p)');
    expect(shader.fragmentShader).not.toContain('#include <map_fragment>');
    expect(LAWN_MAP_FRAGMENT).toContain(`m.x / ${BAND_M.toFixed(2)}`);
    expect(LAWN_MAP_FRAGMENT).toContain('cameraPosition - vLawnWorld');
    expect(LAWN_MAP_FRAGMENT).toContain('fwidth(t)');
  });

  it('reads the gravel twice, so its three-metre tile is no lattice, and mows no bands into it', () => {
    const root = new THREE.Group();
    const gravel = mesh('MAT_Gravel_AOG');
    root.add(gravel, mesh('MAT_Lawn_AOG'), mesh('MAT_Stone_Flags_AOG'));
    expect(dressLawn(root)).toBe(2);
    expect((gravel.material as THREE.Material).customProgramCacheKey()).toBe('estate-gravel');
    const shader = {
      uniforms: {},
      vertexShader: 'void main() {\n#include <begin_vertex>\n}',
      fragmentShader: 'void main() {\n#include <map_fragment>\n}',
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    (gravel.material as THREE.Material).onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toContain('texture2D( map, turned )');
    expect(shader.fragmentShader).not.toContain('#include <map_fragment>');
    expect(shader.fragmentShader).not.toContain('fwidth(t)');
    expect(GRAVEL_MAP_FRAGMENT).toContain(`vMapUv * ${GRAVEL_TILE_M.toFixed(1)}`);
  });

  it('filters every estate texture anisotropically, once', () => {
    const root = new THREE.Group();
    const a = mesh('MAT_Lawn_AOG');
    const b = mesh('MAT_Stone_Wall');
    (b.material as THREE.MeshStandardMaterial).normalMap = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    root.add(a, b);
    expect(sharpenTextures(root, 8)).toBe(3);
    expect((a.material as THREE.MeshStandardMaterial).map!.anisotropy).toBe(8);
    expect(sharpenTextures(root, 8)).toBe(0);
  });
});
