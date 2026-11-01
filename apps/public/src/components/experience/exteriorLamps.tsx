'use client';

// apps/public/src/components/experience/exteriorLamps.tsx
//
// THE ESTATE'S LAMPS, ONCE THE SUN HAS GONE (the user's references, 2026-11-01):
// at the blue hour a string of warm points round the forecourt and along the new
// roads, the fountain lit; at midnight lanterns on the front of the house, a lamp
// on each die beside the steps, the car's headlights on.
//
// THREE THINGS, NONE OF THEM A LIGHT IN THE SCENE. A real light is paid for by
// every pixel of the estate on every frame, and the estate has one sun, one sky
// and one lantern (WorldCanvas): on the integrated card that a laptop's browser
// picks, the budget is already spent.
//
//   THE POINT YOU SEE. A soft additive dot, a sprite that holds a pixel or two at
//   any distance (from the layout a lamp's head is a tenth of a pixel, and a
//   thing that size blinks as the camera moves) and grows like a thing in the
//   world once it is near. Over the bloom's threshold, so it has its halo. One
//   draw for all of them.
//
//   WHAT IT DOES TO THE GROUND. Baked with the lit rooms' pools (nightPools.ts,
//   LAMP_POOLS): one texture fetch a pixel, already paid.
//
//   WHAT IT DOES TO THE STONE (WASH). The lanterns' light on the wall and the
//   columns round them, the die lamps' on the balustrade, the fountain's on its
//   bowls: a short loop in the stone's shader, over the few lamps there are, on
//   the front of the house and its forecourt only. Shaded by the surface's own
//   normal, so the mouldings stand out in it; no shadow.
//
// All of it rides lampsOn(), and comes up as the twilight does.

import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { filmState } from './FilmGrade';
import { markFocusDepth } from './LensFocus';
import { journeyState } from './journey';
import { layoutOn } from './exteriorLayout';
import { ld } from './lookdev';

type V3 = readonly [number, number, number];

/** The fountain's centre and the carriage ring's outer radius (build_estate_v7.py). */
const FOUNTAIN_Z = 30;
const RING_OUTER = 14;
/** A bollard on the ring's outer verge, a hand beyond the kerb. */
const BOLLARD_R = RING_OUTER + 0.45;
const BOLLARD_HEAD = 0.66;

/**
 * Round the ring's outer verge, on both sides. None on the arc in front of the
 * door (the forecourt stands dark under "The door is open.", in the reference
 * and on the door's lens), and none across the avenue's mouth.
 */
export const RING_BOLLARDS: readonly V3[] = [-1, 1].flatMap((sx) =>
  [-20, 0, 20, 40, 60].map((deg): V3 => {
    const t = (deg * Math.PI) / 180;
    return [sx * BOLLARD_R * Math.cos(t), 0, FOUNTAIN_Z + BOLLARD_R * Math.sin(t)];
  }),
);

/**
 * Down the west walk (build_estate_v7.py, WALK_BOLLARDS), on its terrace side: the walk
 * and the border beside it (the brief of 2026-11-01), lit as the ring is. Their light
 * on the ground and the stone is in the bake (exteriorGI.ts).
 */
export const WALK_BOLLARDS: readonly V3[] = [32, 18, -15, -29, -43, -57, -71].map((z): V3 => [-36.88, 0, z]);

/** Along the layout's roads, seen only over it (no post: from where the film
 *  stands while they are there, a lamp is its light). exteriorLayout.ts has the
 *  roads at z 45.5 and 91.22, from x -52 to 70, 9 m wide. */
export const ROAD_LAMPS: readonly V3[] = [
  ...[-40, -24, 14, 28, 42, 56, 68].map((x): V3 => [x, 0.8, 40.4]),
  ...[-34, -14, 20, 38, 56, 70].map((x): V3 => [x, 0.8, 50.8]),
  ...[14, 32, 50, 68].map((x): V3 => [x, 0.8, 86.2]),
  ...[-30, 22, 44, 66].map((x): V3 => [x, 0.8, 96.4]),
  ...[60, 74, 86].map((z): V3 => [5.4, 0.8, z]),
  ...[56, 72, 88].map((z): V3 => [-5.4, 0.8, z]),
];

/** The lamp on each die beside the steps. (podium_balustrade: x +/-7.6.) */
export const DIE_LAMPS: readonly V3[] = [
  [-7.6, 1.96, 12.2],
  [7.6, 1.96, 12.2],
];

/** The lanterns on the front of the house: a pair at the balcony's door, a pair
 *  at the front door (build_estate_v7.py, wall_lanterns). */
export const WALL_LANTERNS: readonly V3[] = [
  [-1.95, 7.15, 8.15],
  [1.95, 7.15, 8.15],
  [-1.45, 3.35, 8.65],
  [1.45, 3.35, 8.65],
];

/** The saloon at the steps: where its headlamps are, nose to the south
 *  (motor_court: court_car_saloon_steps). */
export const HEADLAMPS: readonly V3[] = [
  [4.82, 0.82, 19.25],
  [5.98, 0.82, 19.25],
];

/** How lit the estate's lamps are, 0..1, for this much of the twilight. */
export const LAMPS_ON = [0.25, 0.8] as const;
export function lampsOn(twilight: number): number {
  const t = Math.min(1, Math.max(0, (twilight - LAMPS_ON[0]) / (LAMPS_ON[1] - LAMPS_ON[0])));
  return t * t * (3 - 2 * t);
}

/**
 * A POINT: where, how wide in the world, metres, how bright, its colour, and
 * whether it is the layout's. A lamp's colour is the lamps' 2700 K. (Headlamps
 * are whiter; they are halogen and they are on a car.)
 */
const WARM: V3 = [1.0, 0.66, 0.34];
const HALOGEN: V3 = [1.0, 0.88, 0.72];

type Glow = { at: V3; size: number; gain: number; colour: V3; layout: number };
export const GLOWS: readonly Glow[] = [
  ...RING_BOLLARDS.map((p): Glow => ({ at: [p[0], BOLLARD_HEAD, p[2]], size: 0.72, gain: 3, colour: WARM, layout: 0 })),
  ...WALK_BOLLARDS.map((p): Glow => ({ at: [p[0], BOLLARD_HEAD, p[2]], size: 0.72, gain: 3, colour: WARM, layout: 0 })),
  ...ROAD_LAMPS.map((p): Glow => ({ at: p, size: 0.8, gain: 3, colour: WARM, layout: 1 })),
  ...DIE_LAMPS.map((p): Glow => ({ at: p, size: 0.8, gain: 2.6, colour: WARM, layout: 0 })),
  ...WALL_LANTERNS.map((p): Glow => ({ at: [p[0], p[1], p[2] + 0.2], size: 0.42, gain: 1.7, colour: WARM, layout: 0 })),
  ...HEADLAMPS.map((p): Glow => ({ at: p, size: 0.36, gain: 3.2, colour: HALOGEN, layout: 0 })),
];

/** The ground's pools (nightPools.ts): where, how far, how much, what colour. */
export const LAMP_POOLS: readonly { x: number; z: number; r: number; power: number; colour: V3 }[] = [
  ...RING_BOLLARDS.map((p) => ({ x: p[0], z: p[2], r: 2.6, power: 0.16, colour: WARM })),
  ...DIE_LAMPS.map((p) => ({ x: p[0], z: p[2] + 0.8, r: 3.2, power: 0.06, colour: WARM })),
  // the fountain's lamps on the lawn round its basin
  { x: 0, z: FOUNTAIN_Z, r: 7, power: 0.05, colour: WARM },
  // the headlamps on the forecourt in front of the car
  { x: 5.4, z: 22.5, r: 5.5, power: 0.25, colour: HALOGEN },
];

/**
 * THE WASH: the lamps whose light is on the stone. (x, y, z, reach in metres) and
 * how strong. The fountain's stands over its bowls.
 */
export const WASH: readonly { at: V3; reach: number; power: number; white?: boolean }[] = [
  ...WALL_LANTERNS.map((p, i) => ({ at: [p[0], p[1], p[2] + 0.35] as V3, reach: i < 2 ? 4.6 : 3.6, power: i < 2 ? 0.95 : 0.7 })),
  ...DIE_LAMPS.map((p) => ({ at: [p[0], p[1] + 0.05, p[2] + 0.25] as V3, reach: 4.5, power: 1.3 })),
  { at: [0, 5.6, FOUNTAIN_Z + 0.4], reach: 9, power: 3.4, white: true },
];

/**
 * THE STONE UNDER THE BLUE HOUR'S SKY: how much of the fill the house's pale stone
 * takes, against the lawn's. The fill that brings the reference's lawn up (15, 40,
 * 57) took limestone to the brightest thing on the land, with the lit rooms small
 * in it; in the reference the walls are a dim grey (28, 36, 45) and the windows carry
 * the house. Whole again by midnight, whose fill is its own.
 */
export const STONE_AT_DUSK: V3 = [0.66, 0.6, 0.52];

const washGain = { value: 0 };
const stoneFill = { value: new THREE.Vector3(1, 1, 1) };
const washLights = { value: WASH.map((w) => new THREE.Vector4(w.at[0], w.at[1], w.at[2], w.reach)) };
const washPower = { value: WASH.map((w) => w.power) };
/** The lamps are warm; the fountain's light is white (the reference's is a pale blue). */
const washTint = { value: WASH.map((w) => (w.white ? new THREE.Vector3(0.72, 0.88, 1.0) : new THREE.Vector3(1.0, 0.62, 0.32))) };

const WASH_VERTEX = /* glsl */ `
#include <project_vertex>
{
  vec4 washW = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
  washW = batchingMatrix * washW;
  #endif
  #ifdef USE_INSTANCING
  washW = instanceMatrix * washW;
  #endif
  vWashWorld = (modelMatrix * washW).xyz;
}
`;

const WASH_FRAGMENT = /* glsl */ `
#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= uStoneFill;
if (uWashGain > 0.0 && vWashWorld.z > 6.0 && vWashWorld.z < 40.0 && abs(vWashWorld.x) < 18.0) {
  vec3 washN = inverseTransformDirection(normal, viewMatrix);
  vec3 wash = vec3(0.0);
  for (int i = 0; i < ${WASH.length}; i++) {
    vec3 toLamp = uWashLight[i].xyz - vWashWorld;
    float d2 = dot(toLamp, toLamp);
    float r2 = uWashLight[i].w * uWashLight[i].w;
    if (d2 < r2) {
      float k = 1.0 - d2 / r2;
      wash += uWashTint[i] * (uWashPower[i] * k * k * max(dot(washN, toLamp) * inversesqrt(d2), 0.0) / (d2 + 0.35));
    }
  }
  reflectedLight.indirectDiffuse += diffuseColor.rgb * wash * uWashGain;
}
`;

const WASH_RE = /^MAT_Stone_(Wall|Trim|Rustic|Steps|Terrace|Flags)/;

/** Put the lamps' light on the house's stone under `root`. Idempotent. */
export function dressLampWash(root: THREE.Object3D): number {
  let n = 0;
  const seen = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // (a lantern on the wall, in the portico lantern's light, threw its own
    // shadow on the wall at twice its size)
    if (/^wall_lantern_/.test(mesh.name)) mesh.castShadow = false;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial & { __wash?: boolean };
      if (!mat || seen.has(mat) || !mat.isMeshStandardMaterial || !WASH_RE.test(mat.name)) continue;
      seen.add(mat);
      if (mat.__wash) continue;
      mat.__wash = true;
      const prev = mat.onBeforeCompile;
      const key = mat.customProgramCacheKey();
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        shader.uniforms.uWashGain = washGain;
        shader.uniforms.uStoneFill = stoneFill;
        shader.uniforms.uWashLight = washLights;
        shader.uniforms.uWashPower = washPower;
        shader.uniforms.uWashTint = washTint;
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', 'varying vec3 vWashWorld;\nvoid main() {')
          .replace('#include <project_vertex>', WASH_VERTEX);
        shader.fragmentShader = shader.fragmentShader
          .replace(
            'void main() {',
            `uniform float uWashGain;\nuniform vec3 uStoneFill;\nuniform vec4 uWashLight[${WASH.length}];\nuniform float uWashPower[${WASH.length}];\nuniform vec3 uWashTint[${WASH.length}];\nvarying vec3 vWashWorld;\nvoid main() {`,
          )
          .replace('#include <lights_fragment_end>', WASH_FRAGMENT);
      };
      mat.customProgramCacheKey = () => `${key}|lamp-wash`;
      mat.needsUpdate = true;
      n += 1;
    }
  });
  return n;
}

const GLOW_VERTEX = /* glsl */ `
attribute float aSize;
attribute float aGain;
attribute vec3 aColour;
attribute float aLayout;
uniform float uOn;
uniform float uLayoutOn;
uniform float uScale;
varying vec3 vGlow;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = aSize * uScale / max(-mv.z, 0.1);
  // Never under a few pixels across: at that size what is drawn is its halo.
  gl_PointSize = clamp(px, 5.0, 160.0);
  float keep = min(1.0, px / gl_PointSize * 1.6 + 0.5);
  vGlow = aColour * aGain * uOn * mix(1.0, uLayoutOn, aLayout) * keep;
}`;

const GLOW_FRAGMENT = /* glsl */ `
varying vec3 vGlow;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  // A hot core and a soft skirt that reaches nothing at the point's edge.
  float a = exp(-r2 * 16.0) + 0.16 * (1.0 - r2) * (1.0 - r2);
  gl_FragColor = vec4(vGlow * a, 1.0);
}`;

/** The ring's bollards as things in the world: the pool deck's, in steel. */
const BOLLARD_PROFILE: readonly [number, number][] = [
  [0.0, 0.0],
  [0.075, 0.0],
  [0.075, 0.03],
  [0.055, 0.045],
  [0.055, 0.6],
  [0.075, 0.6],
  [0.08, 0.712],
  [0.05, 0.74],
  [0.0, 0.75],
];

export function EstateLamps() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const points = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(GLOWS.flatMap((l) => [...l.at]), 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(GLOWS.map((l) => l.size), 1));
    g.setAttribute('aGain', new THREE.Float32BufferAttribute(GLOWS.map((l) => l.gain), 1));
    g.setAttribute('aColour', new THREE.Float32BufferAttribute(GLOWS.flatMap((l) => [...l.colour]), 3));
    g.setAttribute('aLayout', new THREE.Float32BufferAttribute(GLOWS.map((l) => l.layout), 1));
    const material = new THREE.ShaderMaterial({
      name: 'MAT_Lamp_Glow',
      uniforms: { uOn: { value: 0 }, uLayoutOn: { value: 0 }, uScale: { value: 1000 } },
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      // The frame's alpha is the scene's depth (LensFocus.tsx): left alone.
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    // (the warm-up builds its program either way: nothing compiles at sundown)
    material.visible = false;
    const p = new THREE.Points(g, material);
    p.name = 'estate_lamp_glows';
    p.frustumCulled = false;
    p.renderOrder = 20;
    return p;
  }, []);

  const bollards = useMemo(() => {
    const geometry = new THREE.LatheGeometry(BOLLARD_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 10);
    const material = new THREE.MeshStandardMaterial({ name: 'estate_bollard', color: '#2A2622', metalness: 0.7, roughness: 0.5 });
    const m = new THREE.InstancedMesh(geometry, material, RING_BOLLARDS.length);
    const t = new THREE.Matrix4();
    RING_BOLLARDS.forEach((p, i) => {
      t.makeTranslation(p[0], p[1], p[2]);
      m.setMatrixAt(i, t);
    });
    m.name = 'estate_ring_bollards';
    m.castShadow = false;
    m.receiveShadow = false;
    m.frustumCulled = false;
    markFocusDepth(m);
    return m;
  }, []);

  useEffect(
    () => () => {
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
      bollards.geometry.dispose();
      (bollards.material as THREE.Material).dispose();
    },
    [points, bollards],
  );

  const size = useMemo(() => new THREE.Vector2(), []);
  useFrame(() => {
    const on = lampsOn(filmState.evening);
    washGain.value = on * ld('lampWash', 1);
    const blue = filmState.evening * (1 - filmState.night);
    stoneFill.value.set(1 + (STONE_AT_DUSK[0] - 1) * blue, 1 + (STONE_AT_DUSK[1] - 1) * blue, 1 + (STONE_AT_DUSK[2] - 1) * blue);
    const mat = points.material as THREE.ShaderMaterial;
    mat.visible = on > 0.001;
    if (!mat.visible) return;
    mat.uniforms.uOn.value = on * ld('lampGlow', 1);
    mat.uniforms.uLayoutOn.value = layoutOn(journeyState.leg, journeyState.legProgress, !!journeyState.film);
    gl.getDrawingBufferSize(size);
    mat.uniforms.uScale.value = size.y / (2 * Math.tan((camera.fov * Math.PI) / 360));
  });

  return (
    <>
      <primitive object={bollards} />
      <primitive object={points} />
    </>
  );
}
