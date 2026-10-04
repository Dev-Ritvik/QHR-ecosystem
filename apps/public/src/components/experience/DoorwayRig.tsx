'use client';

// apps/public/src/components/experience/DoorwayRig.tsx
//
// The front doors, made to open — the part of the doorway (doorway.ts) that is
// geometry rather than camera. The dark that covers the swap during a passage
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
// THE VESTIBULE. Behind the leaves, inside the house, stands the dark of an
// unlit entrance hall: near black, with a far glimmer low in it — light under
// an inner door, a room beyond — so it reads as a space in shadow and not as a
// black card. It is what the camera pushes into (the fourth art-direction
// critique asked for exactly this: "the camera pushes into the actual dark
// threshold of the door"; it replaced a panel of white light), and it also
// hides the one thing an open door would otherwise show: the exterior is a
// shell, and through a real opening you would see its inside.

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DOORWAY, doorwayState } from './doorway';
import { hallPortal, portalUniforms, portalWanted } from './doorPortal';
import { warmProgramsUnder } from './hallProbe';

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
  vestibule: THREE.Mesh;
  portal: THREE.Mesh;
}

/**
 * THE DOORWAY ONTO THE HALL (the continuous passage; doorPortal.ts). A panel in
 * the vestibule's place that shows, where it stands on screen, the hall as
 * drawn from the camera's own eye (HallPortal): through the opening the room is
 * where it would be. Its alpha is the room's own depth, so the lens focuses
 * into it as into anything else.
 */
const PORTAL_VERT = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const PORTAL_FRAG = /* glsl */ `
uniform sampler2D tHall;
uniform vec2 uResolution;
uniform float uGain;
void main() {
  vec4 hall = texture2D(tHall, gl_FragCoord.xy / uResolution);
  gl_FragColor = vec4(hall.rgb * uGain, hall.a);
}
`;
/** The panel's size, metres: wider and taller than any frame can see past
 *  from the door plane to the point the sets change (PORTAL_AT), on any screen
 *  the continuous passage runs on. */
export const PORTAL_SIZE = [11, 7.2] as const;
/** How far behind the hinge line the panel stands (the vestibule's place). */
export const PORTAL_BEHIND = 1.42;

/**
 * The vestibule's dark, in scene-linear light before the print: a floor of
 * 0.004, a breath warmer and lighter toward the sill, and a narrow upright
 * glimmer of 0.035 low in the middle — an inner door with a lamp beyond it,
 * about a hundredth of the forecourt's lit stone.
 */
const VESTIBULE_VERT = /* glsl */ `
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
// Alpha carries the view depth in metres, as every estate surface's does
// (LensFocus.installFocusDepth): the lens reads the vestibule at its real
// distance, behind the door it is focused on.
const VESTIBULE_FRAG = /* glsl */ `
varying vec2 vUv;
varying float vDepth;
void main() {
  vec3 dark = vec3(0.0042, 0.0036, 0.0031);
  float sill = 1.0 - smoothstep(0.0, 0.45, vUv.y);
  vec2 g = (vUv - vec2(0.5, 0.3)) / vec2(0.07, 0.24);
  float glimmer = exp(-dot(g, g));
  vec3 col = dark * (1.0 + 0.8 * sill) + vec3(0.035, 0.025, 0.015) * glimmer;
  gl_FragColor = vec4(col, max(vDepth, 1.05));
}
`;

/**
 * The front doors, made to open. Mount beside the exterior model and hand it
 * the model's root. Renders nothing of its own; it rebuilds part of that graph.
 */
export function ExteriorDoorway({ root }: { root: THREE.Object3D | null }) {
  const rig = useRef<DoorRig | null>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  /** The two panels' programs have been asked for (once per rig). */
  const warmed = useRef<DoorRig | null>(null);

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

    // The vestibule, a panel inside the house behind the opening. Wider and
    // taller than the doorway so the reveal crops it from every vantage on the
    // axis, and deeper than the open leaves reach (1.24 m) so they never pass
    // through it.
    const vestibuleGeo = new THREE.PlaneGeometry(3.6, 4.3);
    owned.push(vestibuleGeo);
    const vestibuleMaterial = new THREE.ShaderMaterial({
      vertexShader: VESTIBULE_VERT,
      fragmentShader: VESTIBULE_FRAG,
      fog: false,
      toneMapped: false,
    });
    ownedMaterials.push(vestibuleMaterial);
    const vestibule = new THREE.Mesh(vestibuleGeo, vestibuleMaterial);
    vestibule.name = 'door_vestibule';
    vestibule.position.set(0, (box.min.y + box.max.y) / 2, hingeZ - 1.42);
    vestibule.visible = false;
    root.add(vestibule);
    made.push(vestibule);

    // And the same place as a doorway onto the hall, for the continuous
    // passage: larger, because the camera goes on toward it after the sill.
    const portalGeo = new THREE.PlaneGeometry(PORTAL_SIZE[0], PORTAL_SIZE[1]);
    owned.push(portalGeo);
    const portalMaterial = new THREE.ShaderMaterial({
      vertexShader: PORTAL_VERT,
      fragmentShader: PORTAL_FRAG,
      uniforms: portalUniforms,
      fog: false,
      toneMapped: false,
    });
    ownedMaterials.push(portalMaterial);
    const portal = new THREE.Mesh(portalGeo, portalMaterial);
    portal.name = 'door_portal';
    portal.position.set(0, box.min.y + PORTAL_SIZE[1] / 2 - 0.6, hingeZ - PORTAL_BEHIND);
    portal.visible = false;
    // The room is drawn as the frame reaches the panel that shows it, and not
    // at all on a frame the panel is out of (doorPortal.ts, `draw`).
    portal.onBeforeRender = (renderer, scene, camera) => {
      if ((scene as THREE.Scene).isScene) hallPortal.draw?.(renderer, scene as THREE.Scene, camera);
    };
    root.add(portal);
    made.push(portal);

    const hidden: THREE.Object3D[] = [slab, ...(relief ? [relief] : []), ...handles];
    for (const o of hidden) o.visible = false;

    rig.current = { left, right, vestibule, portal };

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
    // The panels are first drawn on the frame the door begins to open, and a
    // program's first use waits for its compile. Asked for here, once, on a
    // frame of the film's own (the estate's lights are mounted by then, and a
    // program is keyed on them), through the queue that builds a few
    // milliseconds a frame (hallProbe.ts).
    if (warmed.current !== r) {
      warmed.current = r;
      void warmProgramsUnder(gl, camera, r.vestibule, scene);
      void warmProgramsUnder(gl, camera, r.portal, scene);
    }
    // Only while the leaves are open: closed, they cover it, and a hidden mesh
    // is not drawn. Behind them stands the hall itself (the continuous
    // passage), or the vestibule's dark.
    const through = portalWanted();
    r.portal.visible = through;
    r.vestibule.visible = !through && (c.vestibule > 0.5 || c.exteriorDoors > 0.001);
  });

  return null;
}
