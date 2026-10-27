'use client';

// apps/public/src/components/experience/FountainFish.tsx
//
// THE FOUNTAIN'S FISH, MADE TO LEAP (fishLeap.ts has the account and the
// arc). Mount beside the exterior model and hand it the model's root: it
// finds `fountain_fish` there, lays it under the lower basin's water, and on
// every scroll that comes while the fountain is in the frame sends it once
// over the water and back, with a ring on the surface where it breaks it.
// Renders nothing of its own.
//
// Not while a still is being exposed (scripts/stills/shoot.mjs scrolls the
// film to each chapter: a still must not hold a fish in the air), and not
// under prefers-reduced-motion.

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FOUNTAIN } from './exteriorWater';
import { FISH, FISH_NAME, chord, leapPose, surfaceTimes, type FishPose } from './fishLeap';

interface Ring {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
}

const RING_COLOUR = '#e4eff1';

export function FountainFish({ root }: { root: THREE.Object3D | null }) {
  const camera = useThree((s) => s.camera);
  const fish = useRef<THREE.Object3D | null>(null);
  const rings = useRef<Ring[]>([]);
  /** The estate's own space, in the fish's parent's (set once it is found). */
  const toParent = useRef(new THREE.Matrix4());
  const leap = useRef({ t: -1, k: -1, idle: FISH.rest as number, lastY: Number.NaN, up: false, down: false });
  const off = useRef(false);

  const m = useRef(new THREE.Matrix4());
  const q = useRef(new THREE.Quaternion());
  const qa = useRef(new THREE.Quaternion());
  const v = useRef(new THREE.Vector3());
  const s1 = useRef(new THREE.Vector3(1, 1, 1));
  const Y = useRef(new THREE.Vector3(0, 1, 0));
  const Z = useRef(new THREE.Vector3(0, 0, 1));
  const X = useRef(new THREE.Vector3(1, 0, 0));

  /** Put the fish at a pose in the estate's space. */
  const place = (f: THREE.Object3D, p: FishPose, roll = 0) => {
    q.current.setFromAxisAngle(Y.current, p.yaw);
    q.current.multiply(qa.current.setFromAxisAngle(Z.current, p.pitch));
    if (roll) q.current.multiply(qa.current.setFromAxisAngle(X.current, roll));
    m.current.compose(v.current.set(p.x, p.y, p.z), q.current, s1.current);
    f.matrix.multiplyMatrices(toParent.current, m.current);
    f.matrixWorldNeedsUpdate = true;
  };

  const lieUnder = (f: THREE.Object3D) => {
    const [a, b] = chord(0);
    place(f, {
      x: (a[0] + b[0]) / 2,
      y: FOUNTAIN.level - FISH.restDepth,
      z: (a[1] + b[1]) / 2,
      yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
      pitch: -FISH.tilt,
    });
  };

  useEffect(() => {
    if (!root) return;
    const f = root.getObjectByName(FISH_NAME);
    if (!f) return;
    off.current =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (window as unknown as { __estateStillShoot?: boolean }).__estateStillShoot === true;
    const parent = f.parent ?? root;
    root.updateMatrixWorld(true);
    toParent.current.copy(parent.matrixWorld).invert().multiply(root.matrixWorld);
    f.matrixAutoUpdate = false;
    f.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    lieUnder(f);
    fish.current = f;

    const geo = new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
    const made: Ring[] = [0, 1].map(() => {
      const material = new THREE.MeshBasicMaterial({ color: RING_COLOUR, transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(geo, material);
      mesh.name = 'fountain_fish_ring';
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = 2;
      mesh.visible = false;
      parent.add(mesh);
      return { mesh, material, age: Number.POSITIVE_INFINITY };
    });
    rings.current = made;
    return () => {
      for (const r of made) {
        r.mesh.removeFromParent();
        r.material.dispose();
      }
      geo.dispose();
      f.matrixAutoUpdate = true;
      fish.current = null;
      rings.current = [];
    };
    // (place and lieUnder read refs only)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root]);

  /** Whether the arc the next leap takes is in the frame now. */
  const inView = (f: THREE.Object3D, k: number): boolean => {
    for (let o: THREE.Object3D | null = f; o; o = o.parent) if (!o.visible) return false;
    const [a, b] = chord(k);
    v.current.set((a[0] + b[0]) / 2, FOUNTAIN.level + FISH.peak / 2, (a[1] + b[1]) / 2);
    v.current.applyMatrix4(root!.matrixWorld).project(camera);
    return Math.abs(v.current.x) < 1 && Math.abs(v.current.y) < 1 && v.current.z < 1;
  };

  const splash = (x: number, z: number) => {
    const r = rings.current.find((ring) => ring.age >= FISH.ringLife) ?? rings.current[0];
    if (!r) return;
    r.age = 0;
    r.mesh.userData.at = [x, z];
    r.mesh.visible = true;
  };

  useFrame((_, delta) => {
    const f = fish.current;
    if (!f || !root) return;
    const s = leap.current;
    const dt = Math.min(0.1, Math.max(0, delta));
    const y = window.scrollY;
    const moved = Number.isFinite(s.lastY) && Math.abs(y - s.lastY) > 0.5;
    s.lastY = y;

    if (s.t < 0) {
      s.idle += dt;
      if (moved && !off.current && s.idle >= FISH.rest && inView(f, s.k + 1)) {
        s.k += 1;
        s.t = 0;
        s.up = false;
        s.down = false;
      }
    }
    if (s.t >= 0) {
      s.t += dt / FISH.duration;
      if (s.t >= 1) {
        s.t = -1;
        s.idle = 0;
        lieUnder(f);
      } else {
        const c = chord(s.k);
        const p = leapPose(s.t, c);
        // (a little roll along its length as it goes over: a fish, not a dart)
        place(f, p, 0.16 * Math.sin(Math.PI * 3 * s.t));
        const [tUp, tDown] = surfaceTimes();
        if (!s.up && s.t >= tUp) {
          s.up = true;
          splash(p.x, p.z);
        }
        if (!s.down && s.t >= tDown) {
          s.down = true;
          splash(p.x, p.z);
        }
      }
    }

    for (const r of rings.current) {
      if (r.age >= FISH.ringLife) {
        if (r.mesh.visible) r.mesh.visible = false;
        continue;
      }
      r.age += dt;
      const e = Math.min(1, r.age / FISH.ringLife);
      const grow = 1 - (1 - e) * (1 - e);
      const radius = 0.15 + (FISH.ring - 0.15) * grow;
      const [x, z] = r.mesh.userData.at as [number, number];
      m.current.compose(v.current.set(x, FOUNTAIN.level + 0.012, z), qa.current.identity(), s1.current.setScalar(radius));
      r.mesh.matrix.multiplyMatrices(toParent.current, m.current);
      r.mesh.matrixWorldNeedsUpdate = true;
      s1.current.setScalar(1);
      r.material.opacity = 0.5 * (1 - e) * (1 - e);
    }
  });

  return null;
}
