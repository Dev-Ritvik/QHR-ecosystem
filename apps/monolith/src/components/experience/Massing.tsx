'use client';

// apps/monolith/src/components/experience/Massing.tsx
//
// The industrial corridor — MASTER_SPEC §1, §5 Act I.
//
// The belt the client sells into is not empty countryside. It is a working
// industrial coast: the port, the estates along NH-16, the Super Smelters plant
// at Garividi (§1, 1,085 acres and ₹8,570 crore, which is the reason the
// Lucky Garden layout is worth what it is worth). Act I has to show that,
// because "why here" is the only question a plot buyer actually asks.
//
// ONE DRAW CALL FOR ALL OF IT.
//
// Several hundred buildings as separate meshes is several hundred draw calls
// and blows L8's budget of 100 on its own. As a single InstancedMesh it is one
// call and one geometry upload, regardless of count. Every building is a box —
// at the altitudes Act I flies at, a box with correct proportion, orientation
// and grouping is indistinguishable from a modelled shed, and the silhouette is
// doing all the work.
//
// TWO THINGS THAT MAKE IT READ AS BUILT RATHER THAN SCATTERED
//
//   1. CLUSTERS WITH A SHARED YAW. Industrial estates align to their access
//      road, so every building in a cluster shares a base angle with only a few
//      degrees of jitter. Uniform-random yaw is the single clearest tell of
//      procedural scatter, and it is what makes a scattered field read as
//      confetti instead of as a town.
//
//   2. THE GROUND FUNCTION IS MIRRORED FROM THE SHADER. Buildings have to sit
//      on terrain that is displaced on the GPU, so the height field is
//      duplicated here in TypeScript. That duplication is a real risk — the
//      same class of risk the CI gates exist for — so it is bounded rather than
//      trusted: every box is extended SKIRT metres below its computed height,
//      and a mismatch shows as a slightly buried building rather than as one
//      hovering over its own shadow.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '@/state/sceneStore';

/** Instances by tier. The cost is vertex work and one matrix upload, not draw
 *  calls, so the phone tier is cut for fill and transform time only. */
const COUNT: Record<string, number> = { A: 620, B: 380, C: 190, D: 0 };

/** How far each box is sunk below its computed ground height — the tolerance
 *  on the mirrored height function above. */
const SKIRT = 14;

// ── THE HEIGHT FIELD, MIRRORED FROM Terrain.tsx ─────────────────────────────
// Must stay in step with GEO/VERT in that file. Asserted by
// scripts/massing-check.mjs, which samples both and compares.

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  const top = a + (b - a) * ux;
  const bot = c + (d - c) * ux;
  return top + (bot - top) * uy;
}

function ridge(x: number, y: number): number {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 5; i += 1) {
    let n = noise(x * f, y * f);
    n = 1 - Math.abs(n * 2 - 1);
    s += n * n * a;
    f *= 2.07;
    a *= 0.46;
  }
  return s;
}

export function spineX(z: number): number {
  return 430 + Math.sin(z * 0.00085) * 205 + Math.sin(z * 0.0021 + 1.7) * 72;
}

function runwayPad(wx: number, wy: number): number {
  const rx = wx - 640;
  const ry = wy - -1010;
  const ca = Math.cos(0.34);
  const sa = Math.sin(0.34);
  const lx = rx * ca + ry * sa;
  const ly = -rx * sa + ry * ca;
  return (1 - smoothstep(150, 215, Math.abs(ly))) * (1 - smoothstep(520, 585, Math.abs(lx)));
}

/** Ground height at world (X, Z). `w` matches the shader's plane-local basis:
 *  the mesh is rotated -PI/2 about X, so local +y runs to world -z. */
function groundHeight(X: number, Z: number): number {
  const wx = X;
  const wy = -Z;
  const coast = smoothstep(700, 1050, wx);
  const hills = smoothstep(-250, -1400, wx);
  const relief = ridge(wx * 0.0016, wy * 0.0016) * 260 * hills;
  const plain = (noise(wx * 0.0032, wy * 0.0032) - 0.5) * 14 * (1 - coast) * (1 - hills);
  const parcel = 1 - smoothstep(180, 420, Math.hypot(wx, wy));

  let h = (relief + plain) * (1 - parcel);
  h = h + (-18 - h) * coast;

  const bed = 1 - smoothstep(34, 108, Math.abs(wx - spineX(wy)));
  const graded = h * 0.16 + 1.5;
  h = h + (graded - h) * (bed * 0.92 * (1 - coast));

  const pad = runwayPad(wx, wy) * 0.96 * (1 - coast);
  h = h + (5 - h) * pad;

  return h;
}

// ── PLACEMENT ───────────────────────────────────────────────────────────────

/** Deterministic PRNG. The corridor must be identical on every load — a
 *  skyline that reshuffles between navigations destroys the continuity the
 *  freeze state machine (L6) exists to protect. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Industrial estates, each with its own access-road orientation. Placed on the
 *  plain, off the parcel, off the highway and clear of the airfield. */
const CLUSTERS: { x: number; z: number; r: number; yaw: number; weight: number }[] = [
  { x: 585, z: 455, r: 240, yaw: 0.15, weight: 1.35 },   // port-side works
  { x: 250, z: -545, r: 210, yaw: -0.28, weight: 1.0 },  // NH-16 north estate
  { x: 300, z: -905, r: 165, yaw: 0.34, weight: 0.8 },   // airport freight
  { x: -95, z: 175, r: 200, yaw: 0.62, weight: 0.9 },    // inland estate
  { x: 165, z: 745, r: 225, yaw: -0.12, weight: 1.05 },  // southern belt
  { x: 660, z: -215, r: 175, yaw: 0.05, weight: 0.85 },  // coastal strip
];

function rejected(X: number, Z: number): boolean {
  const wx = X;
  const wy = -Z;
  if (smoothstep(700, 1050, wx) > 0.02) return true;              // in the sea
  if (Math.hypot(wx, wy) < 470) return true;                       // the parcel
  if (Math.abs(wx - spineX(wy)) < 42) return true;                 // on the road
  if (runwayPad(wx, wy) > 0.02) return true;                       // on the airfield
  if (smoothstep(-250, -1400, wx) > 0.15) return true;             // in the ghats
  return false;
}

export function Massing() {
  const tier = useSceneStore((s) => s.tier);
  const count = COUNT[tier] ?? 0;

  const { geometry, material, matrices } = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: '#191C22',
      roughness: 0.94,
      metalness: 0,
    });

    const r = rng(0x51ee7);
    const out: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const totalWeight = CLUSTERS.reduce((s, c) => s + c.weight, 0);

    let guard = 0;
    while (out.length < count && guard < count * 40) {
      guard += 1;

      // Pick a cluster by weight, then a point inside it biased toward the
      // centre — estates thin out at their edges rather than ending at a line.
      let pick = r() * totalWeight;
      let cl = CLUSTERS[0];
      for (const c of CLUSTERS) {
        pick -= c.weight;
        if (pick <= 0) { cl = c; break; }
      }
      const a = r() * Math.PI * 2;
      const rad = cl.r * Math.sqrt(r()) * (0.35 + r() * 0.65);
      const X = cl.x + Math.cos(a) * rad;
      const Z = cl.z + Math.sin(a) * rad;
      if (rejected(X, Z)) continue;

      // 9% of the massing is vertical: stacks, silos, cooling towers. Without
      // them the estate is a field of identical flat roofs and reads as one
      // extruded texture rather than as industry.
      const tall = r() < 0.09;
      const w = tall ? 6 + r() * 7 : 17 + r() * 56;
      const d = tall ? w * (0.85 + r() * 0.3) : 13 + r() * 44;
      const hgt = tall ? 27 + r() * 38 : 5 + r() * 19;

      const g = groundHeight(X, Z);
      pos.set(X, g + hgt / 2 - SKIRT / 2, Z);
      scale.set(w, hgt + SKIRT, d);
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), cl.yaw + (r() - 0.5) * 0.16);
      out.push(m.compose(pos, quat, scale).clone());
    }

    return { geometry: geo, material: mat, matrices: out };
  }, [count]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  if (tier === 'D' || matrices.length === 0) return null;

  return (
    <instancedMesh
      key={tier}
      args={[geometry, material, matrices.length]}
      // The bounding sphere is computed from the BASE geometry, which is a 1m
      // cube at the origin — so frustum culling would drop the entire corridor
      // the moment the camera stopped looking at world zero. It is one draw
      // call either way.
      frustumCulled={false}
      ref={(inst) => {
        if (!inst) return;
        matrices.forEach((mx, i) => inst.setMatrixAt(i, mx));
        inst.instanceMatrix.needsUpdate = true;
      }}
    />
  );
}
