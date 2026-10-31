// apps/public/src/components/experience/exteriorFoliage.test.ts
//
// The petals' own lift is the frangipani's alone: the broadleaf cards are
// painted bright enough that a mask shared with them would take part of their
// leaves' lift too.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FOLIAGE_GAIN, FOLIAGE_TINT, PETAL_GAIN, dressFoliage, foliageUniforms } from './exteriorFoliage';

function estate(names: string[]): THREE.Group {
  const root = new THREE.Group();
  for (const name of names) {
    const mat = new THREE.MeshStandardMaterial();
    mat.name = name;
    root.add(new THREE.Mesh(new THREE.PlaneGeometry(), mat));
  }
  return root;
}

function material(root: THREE.Object3D, name: string): THREE.MeshStandardMaterial {
  let found: THREE.MeshStandardMaterial | null = null;
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && m.name === name) found = m;
  });
  if (!found) throw new Error(name);
  return found;
}

describe('the frangipani petals', () => {
  it('only the frangipani card compiles the petal branch', () => {
    const root = estate([
      'MAT_Leaves_Frangipani',
      'MAT_Leaves_Mango',
      'MAT_Leaves_Neem',
      'MAT_Leaves_Rain',
      'MAT_Leaves_Bougainvillea',
      'MAT_Palm_Frond',
    ]);
    expect(dressFoliage(root)).toBe(6);
    expect(material(root, 'MAT_Leaves_Frangipani').defines).toHaveProperty('FOLIAGE_PETALS');
    for (const n of ['MAT_Leaves_Mango', 'MAT_Leaves_Neem', 'MAT_Leaves_Rain', 'MAT_Leaves_Bougainvillea', 'MAT_Palm_Frond']) {
      expect(material(root, n).defines).not.toHaveProperty('FOLIAGE_PETALS');
    }
    // And its programs are cached apart from the leaves'.
    expect(material(root, 'MAT_Leaves_Frangipani').customProgramCacheKey()).not.toBe(
      material(root, 'MAT_Leaves_Mango').customProgramCacheKey(),
    );
  });

  it('the grown trees are foliage, the coconut sways as a frond, the barks stay bark', () => {
    // (the names build_estate_v7.py's grown_names gives grow_trees_v7.py's
    // species; fix_estate_materials_v7.py cuts the same names out)
    const grown = ['MAT_Leaves_Globe', 'MAT_Leaves_Mango_Grown', 'MAT_Leaves_Banyan', 'MAT_Leaves_Tamarind'];
    const root = estate([...grown, 'MAT_Palm_Frond_Coconut', 'MAT_Bark_Coconut', 'MAT_Bark_Banyan']);
    expect(dressFoliage(root)).toBe(5);
    for (const n of grown) {
      expect(material(root, n).defines).toHaveProperty('ESTATE_FOLIAGE');
      expect(material(root, n).defines).not.toHaveProperty('FOLIAGE_FROND');
    }
    expect(material(root, 'MAT_Palm_Frond_Coconut').defines).toHaveProperty('FOLIAGE_FROND');
    for (const n of ['MAT_Bark_Coconut', 'MAT_Bark_Banyan']) {
      expect(material(root, n).defines ?? {}).not.toHaveProperty('ESTATE_FOLIAGE');
    }
  });

  it('a leaf keeps the full lift; a petal takes less than it', () => {
    // Outside the petal branch the tint is the leaf's lift, unchanged.
    expect(FOLIAGE_TINT).toMatch(new RegExp(`#else\\s+float lift = ${FOLIAGE_GAIN.toFixed(2)};`));
    expect(PETAL_GAIN).toBeLessThan(1);
    expect(foliageUniforms.uPetal.value).toBe(PETAL_GAIN);
  });
});
