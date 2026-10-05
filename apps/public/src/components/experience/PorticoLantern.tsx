// apps/public/src/components/experience/PorticoLantern.tsx
//
// THE PORTICO'S LANTERN.
//
// WHAT IT REPLACES. Until the refinement brief (2026-10-03) the entry at night
// was lit by three invisible panels of light — RectAreaLights the size of the
// door and of the arched window either side of it, standing 35 cm in front of
// the wall and aimed AT it. Nothing in the picture explained them. The door
// stood in a rectangle of white stone exactly the panel's size, the two windows
// in two more, and the brief's audits read the front as what it was: lighting
// that "visibly announces itself", a lit sticker round each opening.
//
// WHAT IS HERE INSTEAD. One lantern, hung from the portico's soffit over the
// middle of the steps, as the porch of a house of this kind is lit. It is a
// thing in the picture (bronze, with glass that glows once it is lit), and its
// light is a point's: brightest on the door and the wall behind it, falling
// off by the inverse square across the portico floor and gone a few metres
// down the forecourt. It casts SHADOWS — the four columns throw theirs out
// over the steps, and the soffit keeps the light off the wall above it — which
// is the whole difference between a porch at night and a wall with a glow
// painted on it.
//
// ITS BODY IS THE CLIENT'S GENERATED LANTERN, where the estate carries one
// (tools/blender/tripo_assets_v7.py; build_estate_v7.py, portico_lantern): a
// six-sided bronze lantern with candles in it, in the model's own file, named
// LANTERN_BODY. This component then draws only what hangs it — the rose on the
// soffit and the chain — puts the lamp inside it, and lights its glass: the
// model's one material carries a mask of its panes as its emission, and the
// evening drives that emission's strength. Without the model the cage below
// is drawn, as it was.
//
// THE SHADOW IS DRAWN ONCE. The house does not move, so the cube map is
// rendered when the lantern first comes on and again only while the door's
// leaves swing (doorway.ts). By day the light is at zero and three skips its
// shadow lookup altogether (a light whose colour is black is not `visible` to
// the fragment), and beyond its reach the same holds: what this costs is paid
// only by the pixels the lantern lights, at night.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DeviceTier } from '@estate/domain/telemetry/device-tier';
import { doorwayState } from './doorway';
import { filmState } from './FilmGrade';
import { markFocusDepth } from './LensFocus';
import { ld } from './lookdev';

/**
 * Where it hangs, and how it is made; metres, three's axes (y up, the front of
 * the house toward +z). The soffit is the underside of the portico's
 * entablature (tools/blender/build_estate_v7.py: 4.4 m); the lantern hangs
 * midway between the wall face (z 8.4) and the line of the columns (z 10.85).
 */
export const LANTERN = {
  x: 0,
  z: 9.62,
  soffit: 4.4,
  chain: 0.5,
  body: { width: 0.36, height: 0.56 },
  /** The lamp's strength at night, candela, and how far it is carried. */
  power: 8,
  reach: 34,
  colour: '#FFB56B',
  /** The glass's own glow at night (scene-linear, over the bloom's threshold
   *  so the source reads as a source). */
  glow: 2.6,
} as const;

/** The generated lantern's node in the estate's file (build_estate_v7.py). */
export const LANTERN_BODY = 'portico_lantern_body';

/** The lantern is lit from this much evening, fully by the second figure. */
export const LANTERN_FROM = [0.5, 0.95] as const;

/** How lit the lantern is, 0..1, for an evening and a night (filmState). */
export function lanternOn(evening: number, night: number): number {
  const t = Math.min(1, Math.max(0, (evening - LANTERN_FROM[0]) / (LANTERN_FROM[1] - LANTERN_FROM[0])));
  return Math.max(t * t * (3 - 2 * t), night);
}

export function PorticoLantern({ tier }: { tier: DeviceTier }) {
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const shadows = tier !== 'low';
  const scene = useThree((s) => s.scene);
  /** The scripted cage and glass: hidden once the generated body is found. */
  const cage = useRef<THREE.Group>(null);
  const body = useRef<{ mesh: THREE.Mesh; material: THREE.MeshStandardMaterial } | null>(null);
  const looked = useRef(0);

  const { bronze, glass } = useMemo(() => {
    const b = new THREE.MeshStandardMaterial({ name: 'lantern_bronze', color: '#33271A', metalness: 0.85, roughness: 0.42 });
    // Seeded glass, opaque to the lens: by day a pale pane, at night the lamp.
    const g = new THREE.MeshStandardMaterial({
      name: 'lantern_glass',
      color: '#CFC3A6',
      roughness: 0.28,
      metalness: 0,
      emissive: new THREE.Color(LANTERN.colour),
      emissiveIntensity: 0,
    });
    // Seen by its own light: no contact occlusion on it (LensFocus, EMITTERS).
    g.defines = { ESTATE_EMITTER: '' };
    return { bronze: b, glass: g };
  }, []);
  useEffect(
    () => () => {
      bronze.dispose();
      glass.dispose();
    },
    [bronze, glass],
  );
  useEffect(() => {
    if (group.current) markFocusDepth(group.current);
  }, []);

  /** Frames of shadow still owed: the cube is drawn while this is positive. */
  const owed = useRef(0);
  const wasOn = useRef(false);
  useFrame(() => {
    const on = lanternOn(filmState.evening, filmState.night);
    glass.emissiveIntensity = LANTERN.glow * on;
    // The generated body, looked for until the estate's file has arrived (and
    // again if that graph is replaced under this component).
    if (looked.current % 30 === 0) {
      const held = body.current;
      if (held && !held.mesh.parent) body.current = null;
      if (!body.current) {
        const o = scene.getObjectByName(LANTERN_BODY) as THREE.Mesh | undefined;
        if (o?.isMesh && !Array.isArray(o.material)) {
          const m = o.material as THREE.MeshStandardMaterial;
          m.emissive.set(LANTERN.colour);
          // Seen by its own light, like the scripted glass: no contact
          // occlusion on it (LensFocus, EMITTERS).
          m.defines = { ...(m.defines ?? {}), ESTATE_EMITTER: '' };
          m.needsUpdate = true;
          // The lamp is inside it: a body that cast the lamp's shadow would
          // be a lantern that lights nothing.
          o.castShadow = false;
          body.current = { mesh: o, material: m };
        }
      }
      if (cage.current) cage.current.visible = !body.current;
    }
    looked.current += 1;
    if (body.current) body.current.material.emissiveIntensity = ld('lanternGlow', LANTERN.glow) * on;
    const l = light.current;
    if (!l) return;
    l.intensity = ld('lantern', LANTERN.power) * on;
    if (!shadows) return;
    l.shadow.autoUpdate = false;
    // Drawn when the lamp comes on (a few frames, for a model still arriving),
    // and for as long as the door's leaves are moving.
    if (on > 0 && !wasOn.current) owed.current = 90;
    wasOn.current = on > 0;
    if (doorwayState.mode === 'running') owed.current = Math.max(owed.current, 2);
    if (owed.current > 0 && on > 0) {
      // Every thirtieth frame of the wait, and every frame of a moving door.
      if (doorwayState.mode === 'running' || owed.current % 30 === 0) l.shadow.needsUpdate = true;
      owed.current -= 1;
    }
  });

  const { x, z, soffit, chain, body: cageBody } = LANTERN;
  const top = soffit - chain;
  const half = cageBody.width / 2;
  const mid = top - 0.14 - cageBody.height / 2;
  return (
    <group ref={group} name="portico_lantern">
      {/* The rose on the soffit and the chain. */}
      <mesh position={[x, soffit - 0.015, z]} material={bronze}>
        <cylinderGeometry args={[0.09, 0.09, 0.03, 16]} />
      </mesh>
      <mesh position={[x, soffit - chain / 2, z]} material={bronze}>
        <cylinderGeometry args={[0.012, 0.012, chain, 6]} />
      </mesh>
      {/* THE SCRIPTED BODY, for an estate without the generated one. */}
      <group ref={cage} name="portico_lantern_cage">
        {/* The crown: a four-sided cap over the glass. */}
        <mesh position={[x, top - 0.07, z]} rotation={[0, Math.PI / 4, 0]} material={bronze}>
          <coneGeometry args={[half * 1.6, 0.14, 4]} />
        </mesh>
        {/* The glass. */}
        <mesh position={[x, mid, z]} material={glass}>
          <boxGeometry args={[cageBody.width - 0.03, cageBody.height - 0.02, cageBody.width - 0.03]} />
        </mesh>
        {/* The cage: four posts, a rail above and below, a foot. */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[x + sx * half, mid, z + sz * half]} material={bronze}>
              <boxGeometry args={[0.024, cageBody.height + 0.02, 0.024]} />
            </mesh>
          )),
        )}
        {[cageBody.height / 2, -cageBody.height / 2].map((dy) => (
          <mesh key={dy} position={[x, mid + dy, z]} material={bronze}>
            <boxGeometry args={[cageBody.width + 0.03, 0.026, cageBody.width + 0.03]} />
          </mesh>
        ))}
        <mesh position={[x, mid - cageBody.height / 2 - 0.05, z]} material={bronze}>
          <sphereGeometry args={[0.034, 12, 8]} />
        </mesh>
      </group>
      <pointLight
        ref={light}
        name="portico_lantern_light"
        // No part of the hall's light state (hallProbe, HallPortal).
        userData={{ outside: true }}
        position={[x, mid, z]}
        color={LANTERN.colour}
        intensity={0}
        distance={LANTERN.reach}
        decay={2}
        castShadow={shadows}
        shadow-mapSize={[512, 512]}
        shadow-camera-near={0.3}
        shadow-camera-far={LANTERN.reach}
        shadow-bias={-0.004}
        shadow-normalBias={0.03}
      />
    </group>
  );
}
