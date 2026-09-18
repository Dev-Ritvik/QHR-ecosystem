'use client';

// apps/public/src/components/experience/DoorwayRig.tsx
//
// The front doors, made to open — the part of the doorway (doorway.ts) that is
// geometry rather than camera. The white that covers the page during a passage
// is painted by the journey driver in WorldCanvas.tsx.
//
// THE DOORS. The exterior GLB ships the doors as ONE slab — `mansion_doors`, 44
// triangles, 16 of which run the full 2.47 m width — with `door_relief` (the
// panel mouldings, 1,144 triangles, split exactly 572 left and 572 right) and
// two handles laid over it. A slab cannot swing open, so at mount the slab is
// cut down its centre line into two leaves, each is capped where it was cut,
// the relief and the handles are dealt to the leaf they sit on, and each leaf is
// hung on a hinge at its jamb. Closed, the leaves are the original geometry in
// the original place with the original material; the shipped meshes are hidden,
// not removed, and come back if this unmounts.
//
// THE LIGHT. Behind the leaves, inside the house, stands a panel of unlit warm
// white that the doorway ramps up as the doors part. It is what the camera flies
// into, and it also hides the one thing an open door would otherwise show: the
// exterior is a shell, and through a real opening you would see its inside.

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DOORWAY, doorwayState } from './doorway';

interface Vert {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  u: number;
  v: number;
}

function readVert(
  pos: THREE.BufferAttribute,
  nor: THREE.BufferAttribute | undefined,
  uv: THREE.BufferAttribute | undefined,
  i: number,
): Vert {
  return {
    x: pos.getX(i),
    y: pos.getY(i),
    z: pos.getZ(i),
    nx: nor ? nor.getX(i) : 0,
    ny: nor ? nor.getY(i) : 1,
    nz: nor ? nor.getZ(i) : 0,
    u: uv ? uv.getX(i) : 0,
    v: uv ? uv.getY(i) : 0,
  };
}

function mix(a: Vert, b: Vert, t: number): Vert {
  const nx = a.nx + (b.nx - a.nx) * t;
  const ny = a.ny + (b.ny - a.ny) * t;
  const nz = a.nz + (b.nz - a.nz) * t;
  const len = Math.hypot(nx, ny, nz) || 1;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    nx: nx / len,
    ny: ny / len,
    nz: nz / len,
    u: a.u + (b.u - a.u) * t,
    v: a.v + (b.v - a.v) * t,
  };
}

/** Sutherland–Hodgman against one half-space: keeps the part where d >= 0. */
function clipPolygon(poly: Vert[], d: (v: Vert) => number): Vert[] {
  const out: Vert[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = d(a);
    const db = d(b);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) out.push(mix(a, b, da / (da - db)));
  }
  return out;
}

class Builder {
  p: number[] = [];
  n: number[] = [];
  uv: number[] = [];
  tri(a: Vert, b: Vert, c: Vert) {
    for (const v of [a, b, c]) {
      this.p.push(v.x, v.y, v.z);
      this.n.push(v.nx, v.ny, v.nz);
      this.uv.push(v.u, v.v);
    }
  }
  geometry(offset: THREE.Vector3): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(this.p);
    for (let i = 0; i < p.length; i += 3) {
      p[i] -= offset.x;
      p[i + 1] -= offset.y;
      p[i + 2] -= offset.z;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.n), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/** A mesh's geometry expressed in `root` space, one vertex per triangle corner. */
function inRootSpace(mesh: THREE.Mesh, toRoot: THREE.Matrix4): THREE.BufferGeometry {
  const g = (mesh.geometry as THREE.BufferGeometry).clone();
  g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld));
  if (!g.index) return g;
  const flat = g.toNonIndexed();
  g.dispose();
  return flat;
}

function forEachTriangle(g: THREE.BufferGeometry, fn: (a: Vert, b: Vert, c: Vert) => void) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nor = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
  for (let i = 0; i + 2 < pos.count; i += 3) {
    fn(readVert(pos, nor, uv, i), readVert(pos, nor, uv, i + 1), readVert(pos, nor, uv, i + 2));
  }
}

interface DoorRig {
  left: THREE.Group;
  right: THREE.Group;
  glow: THREE.Mesh;
  glowMaterial: THREE.MeshBasicMaterial;
}

/**
 * The front doors, made to open. Mount beside the exterior model and hand it
 * the model's root. Renders nothing of its own; it rebuilds part of that graph.
 */
export function ExteriorDoorway({ root }: { root: THREE.Object3D | null }) {
  const rig = useRef<DoorRig | null>(null);

  useEffect(() => {
    if (!root) return;
    const slab = root.getObjectByName('mansion_doors') as THREE.Mesh | undefined;
    if (!slab?.isMesh || Array.isArray(slab.material)) return;
    const relief = root.getObjectByName('door_relief') as THREE.Mesh | undefined;
    const handles = [0, 1]
      .map((i) => root.getObjectByName(`door_handle_${i}`) as THREE.Mesh | undefined)
      .filter((m): m is THREE.Mesh => !!m?.isMesh);

    root.updateMatrixWorld(true);
    const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();

    const slabGeo = inRootSpace(slab, toRoot);
    slabGeo.computeBoundingBox();
    const box = slabGeo.boundingBox!;
    const reliefGeo = relief?.isMesh ? inRootSpace(relief, toRoot) : null;
    const reliefShares = !!relief && relief.material === slab.material;

    // Hinges on the jambs, on the INSIDE face: the leaves open inward, into the
    // house, the way a front door does.
    const hingeZ = box.min.z;
    const pivots = {
      left: new THREE.Vector3(box.min.x, 0, hingeZ),
      right: new THREE.Vector3(box.max.x, 0, hingeZ),
    };

    const owned: THREE.BufferGeometry[] = [];
    const ownedMaterials: THREE.Material[] = [];
    const made: THREE.Object3D[] = [];

    const buildLeaf = (side: 'left' | 'right') => {
      const keep = side === 'left' ? (v: Vert) => -v.x : (v: Vert) => v.x;
      const wood = new Builder();
      const reliefOnly = new Builder();

      forEachTriangle(slabGeo, (a, b, c) => {
        const poly = clipPolygon([a, b, c], keep);
        for (let i = 1; i + 1 < poly.length; i += 1) wood.tri(poly[0], poly[i], poly[i + 1]);
      });

      // The cut face. A flat cap across the slab's thickness, facing the other
      // leaf; without it the meeting edge of each leaf is open and the inside of
      // the slab shows as a slot of nothing the moment the doors part.
      const y0 = box.min.y;
      const y1 = box.max.y;
      const z0 = box.min.z;
      const z1 = box.max.z;
      const nx = side === 'left' ? 1 : -1;
      const at = (y: number, z: number): Vert => ({ x: 0, y, z, nx, ny: 0, nz: 0, u: 0.5, v: 0.5 });
      if (side === 'left') {
        wood.tri(at(y0, z1), at(y0, z0), at(y1, z1));
        wood.tri(at(y0, z0), at(y1, z0), at(y1, z1));
      } else {
        wood.tri(at(y1, z1), at(y0, z0), at(y0, z1));
        wood.tri(at(y1, z1), at(y1, z0), at(y0, z0));
      }

      if (reliefGeo) {
        const target = reliefShares ? wood : reliefOnly;
        forEachTriangle(reliefGeo, (a, b, c) => {
          const cx = (a.x + b.x + c.x) / 3;
          if ((side === 'left') === cx < 0) target.tri(a, b, c);
        });
      }

      const pivot = pivots[side];
      const group = new THREE.Group();
      group.name = `door_leaf_pivot_${side}`;
      group.position.copy(pivot);

      const woodGeo = wood.geometry(pivot);
      owned.push(woodGeo);
      const leaf = new THREE.Mesh(woodGeo, slab.material);
      leaf.name = `door_leaf_${side}`;
      leaf.castShadow = slab.castShadow;
      leaf.receiveShadow = slab.receiveShadow;
      group.add(leaf);

      if (reliefGeo && !reliefShares && relief && reliefOnly.p.length) {
        const g = reliefOnly.geometry(pivot);
        owned.push(g);
        const m = new THREE.Mesh(g, relief.material);
        m.name = `door_leaf_relief_${side}`;
        m.castShadow = relief.castShadow;
        m.receiveShadow = relief.receiveShadow;
        group.add(m);
      }

      // Each handle goes with the leaf it is fixed to. Its geometry is shared
      // with the cached parse, so it is re-hung, not copied.
      for (const handle of handles) {
        const local = new THREE.Matrix4().multiplyMatrices(toRoot, handle.matrixWorld);
        const p = new THREE.Vector3();
        const q = new THREE.Quaternion();
        const s = new THREE.Vector3();
        local.decompose(p, q, s);
        if ((side === 'left') !== p.x < 0) continue;
        const m = new THREE.Mesh(handle.geometry, handle.material);
        m.name = `door_leaf_handle_${side}`;
        m.position.copy(p).sub(pivot);
        m.quaternion.copy(q);
        m.scale.copy(s);
        m.castShadow = handle.castShadow;
        m.receiveShadow = handle.receiveShadow;
        group.add(m);
      }

      root.add(group);
      made.push(group);
      return group;
    };

    const left = buildLeaf('left');
    const right = buildLeaf('right');
    slabGeo.dispose();
    reliefGeo?.dispose();

    // The light, a panel inside the house behind the opening. Wider and taller
    // than the doorway so the reveal crops it from every vantage on the axis,
    // and deeper than the open leaves reach (1.24 m) so they never pass through
    // it.
    const glowGeo = new THREE.PlaneGeometry(3.6, 4.3);
    owned.push(glowGeo);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      toneMapped: false,
      fog: false,
    });
    ownedMaterials.push(glowMaterial);
    const glow = new THREE.Mesh(glowGeo, glowMaterial);
    glow.name = 'door_light';
    glow.position.set(0, (box.min.y + box.max.y) / 2, hingeZ - 1.42);
    glow.visible = false;
    root.add(glow);
    made.push(glow);

    const hidden: THREE.Object3D[] = [slab, ...(relief ? [relief] : []), ...handles];
    for (const o of hidden) o.visible = false;

    rig.current = { left, right, glow, glowMaterial };

    return () => {
      rig.current = null;
      for (const o of made) root.remove(o);
      for (const o of hidden) o.visible = true;
      for (const g of owned) g.dispose();
      for (const m of ownedMaterials) m.dispose();
    };
  }, [root]);

  useFrame(() => {
    const r = rig.current;
    if (!r) return;
    const c = doorwayState.channels;
    const swing = c.exteriorDoors * DOORWAY.leafSwing;
    // Left leaf hinged at -x swings its free edge toward -z with a positive
    // turn about +y; the right leaf mirrors it.
    if (r.left.rotation.y !== swing) {
      r.left.rotation.y = swing;
      r.right.rotation.y = -swing;
    }
    const k = c.exteriorGlow;
    r.glow.visible = k > 0.002;
    if (r.glow.visible) {
      // Above 1.0 on purpose: tone mapping is off for this material, and the
      // excess is what the bloom pass reads as a source rather than a surface.
      const e = 1.8 * k;
      r.glowMaterial.color.setRGB(e, 0.93 * e, 0.82 * e);
    }
  });

  return null;
}
