'use client';

// apps/public/src/components/experience/WindowLight.tsx
//
// Light falling through the clerestory windows, made visible.
//
// AT DUSK NOW (the refinement brief, 2026-10-03: "reduce beam/glowing
// windows"; HallModel.DUSK_GLASS has the account). The sun these were drawn
// for has set: what comes through the glass is the last of the sky, cool and
// a fifth of what it was, the air of a tall room rather than a beam across
// it. The shafts keep their place and their dust; SHAFT has their strength
// and colour.
//
// THE ART-DIRECTION AUDIT (2026-09-30): "The interior is moody, dramatically
// lit by light spilling through the windows." The imperial hall has windows
// (imperial_hall_v7.py: six arched lights a side between the attic pilasters,
// 8.6 m to 11.65 m up) and the bake already carries the light they let in; what
// the eye needs is the air it passes through. So each window on the sun side
// throws a shaft down across the room.
//
// A TRUE VOLUME, IN ONE PASS. Each shaft is the window's opening swept along
// the light: a sheared prism. The matrix that builds it from a unit box also
// maps the view ray into that box, where the prism is [-1,1] x [-1,1] x [0,1]
// and the ray's way in and out is a slab test. The shader walks that span,
// adding a haze that is densest at the glass and thins as the light travels,
// softest at the shaft's edges, with a slow drift of density and dust in it —
// so a shaft reads as air with light in it from any angle, including from
// inside it. It stops at the floor. Additive in colour; the alpha (the lens's
// depth, LensFocus) is left alone.
//
// GLSL NOTE: shaders.test.ts scans this file for GLSL ES 3.00 reserved words.

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hallLight } from './hallLight';

/** The shafts' strength in the room at full house light, and their colour:
 *  the sky after sunset. (0.2 and a warm #FFE2B8 while they were the sun's;
 *  0.04 until the paid audit of 2026-10-04, when the panes went from a lit
 *  ultramarine to the slate dusk that is outside the door: a window that dim
 *  throws no beam a visitor could point at, only a trace of paler air under
 *  the clerestory.) */
export const SHAFT = { power: 0.016, colour: '#C9CED6' } as const;

/** The windows on the lit wall (+x), three-space centres along z, from the GLB. */
const WINDOW_Z = [-6.0, -3.6, -1.2, 1.2, 3.6, 6.0];
const WALL_X = 9.86;
/** The opening, approximated by its rectangle: sill to crown, and its width. */
const SILL = 8.6;
const CROWN = 11.65;
const HALF_W = 0.62;
/** Into the room and down: the low sun of the exterior's hour. */
const DIR = new THREE.Vector3(-0.66, -0.52, -0.2).normalize();
/**
 * How far above the floor the shafts stop, metres.
 *
 * They are drawn by their back faces, against the room's depth: a prism
 * reaching under the floor would lose its far faces to the floor and cut the
 * shaft off, so it ended exactly where the sill's edge meets the marble. But
 * the hall's rug lies 4 cm proud of the marble, and for the last 4 cm of its
 * length the prism was under the rug's surface: there its far faces lost the
 * depth test, and a bar of rug 4 cm wide and the window's width long stood
 * unlit in the middle of the light — across the rug's border below the fourth
 * window, plain in the film's last frame, where the house lights are down and
 * the shafts are what lights the floor (seen as a thin black rod at the foot
 * of the picture). So the shafts stop clear of anything that lies on the
 * floor.
 */
export const SHAFT_FLOOR_CLEAR = 0.06;
/** Until the sill's edge is that far above the floor. By there the light has
 *  thinned to a fifth of what it was at the glass, and its end is the end of
 *  a haze. */
const LENGTH = (SILL - SHAFT_FLOOR_CLEAR) / -DIR.y;

const VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */ `
  uniform mat3  uToBox;     // world offset from the origin -> unit-box coordinates
  uniform mat3  uFromBox;   // and back
  uniform vec3  uOrigin;    // the window's centre, the box's (0, 0, 0)
  uniform vec3  uDir;       // the light's direction, world
  uniform vec3  uWarm;
  uniform float uPower;
  uniform float uTime;
  uniform float uSeed;
  varying vec3 vWorld;

  float h1(float n) { return fract(sin(n) * 43758.5453); }
  float n3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = i.x + i.y * 57.0 + i.z * 113.0;
    return mix(mix(mix(h1(n), h1(n + 1.0), f.x), mix(h1(n + 57.0), h1(n + 58.0), f.x), f.y),
               mix(mix(h1(n + 113.0), h1(n + 114.0), f.x), mix(h1(n + 170.0), h1(n + 171.0), f.x), f.y), f.z);
  }

  void main() {
    // The view ray, in the box's space: a line stays a line under a linear map.
    vec3 ro = uToBox * (cameraPosition - uOrigin);
    vec3 rd = uToBox * normalize(vWorld - cameraPosition);
    vec3 lo = vec3(-1.0, -1.0, 0.0), hi = vec3(1.0, 1.0, 1.0);
    vec3 inv = 1.0 / rd;
    vec3 t0 = (lo - ro) * inv, t1 = (hi - ro) * inv;
    vec3 tmin = min(t0, t1), tmax = max(t0, t1);
    float ta = max(max(tmin.x, tmin.y), max(tmin.z, 0.0));
    float tb = min(min(tmax.x, tmax.y), tmax.z);
    if (tb <= ta) discard;

    // Walk it. Six samples: the density is smooth, and the span is short.
    float acc = 0.0;
    float span = tb - ta;
    for (int i = 0; i < 6; i += 1) {
      float t = ta + span * (float(i) + 0.5) / 6.0;
      vec3 q = ro + rd * t;                     // box space
      vec3 w = uOrigin + uFromBox * q;          // world, for the floor and the dust
      if (w.y < 0.0) continue;
      // Crisp-edged: a shaft is read by its edges, not by its haze.
      float edge = (1.0 - smoothstep(0.78, 1.0, abs(q.x))) * (1.0 - smoothstep(0.78, 1.0, abs(q.y)));
      float along = exp(-q.z * 1.6);
      float drift = 0.7 + 0.3 * n3(w * 0.9 + vec3(0.0, -uTime * 0.05, uSeed));
      float dust = step(0.985, n3(w * 22.0 + vec3(uTime * 0.12, 0.0, uSeed))) * 0.6;
      acc += edge * along * (drift + dust);
    }
    // Length of the walk in world metres, so a long look through a shaft is
    // brighter than a glance across it, as air is.
    float metres = span * length(uFromBox * rd);
    float a = acc / 6.0 * metres * uPower;
    gl_FragColor = vec4(uWarm * a, 0.0);
  }
`;

export function WindowLight({ power = SHAFT.power }: { power?: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(2, 2, 1);
    g.translate(0, 0, 0.5);
    return g;
  }, []);

  const shafts = useMemo(
    () =>
      WINDOW_Z.map((z, i) => {
        const origin = new THREE.Vector3(WALL_X, (SILL + CROWN) / 2, z);
        // Box axes: across the window (z), up the window (y), along the light.
        const ax = new THREE.Vector3(0, 0, HALF_W);
        const ay = new THREE.Vector3(0, (CROWN - SILL) / 2, 0);
        const az = DIR.clone().multiplyScalar(LENGTH);
        const m = new THREE.Matrix4().makeBasis(ax, ay, az).setPosition(origin);
        const fromBox = new THREE.Matrix3().setFromMatrix4(m);
        const toBox = fromBox.clone().invert();
        const material = new THREE.ShaderMaterial({
          uniforms: {
            uToBox: { value: toBox },
            uFromBox: { value: fromBox },
            uOrigin: { value: origin },
            uDir: { value: DIR },
            uWarm: { value: new THREE.Color(SHAFT.colour) },
            uPower: { value: power },
            uTime: { value: 0 },
            uSeed: { value: i * 7.3 },
          },
          vertexShader: VERT,
          fragmentShader: FRAG,
          transparent: true,
          depthWrite: false,
          // The back faces: one fragment per pixel the shaft covers, even with
          // the camera inside it.
          side: THREE.BackSide,
          blending: THREE.CustomBlending,
          blendEquation: THREE.AddEquation,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneFactor,
          blendEquationAlpha: THREE.AddEquation,
          blendSrcAlpha: THREE.ZeroFactor,
          blendDstAlpha: THREE.OneFactor,
        });
        return { matrix: m, material };
      }),
    [power],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      for (const s of shafts) s.material.dispose();
    },
    [geometry, shafts],
  );

  useFrame((state) => {
    // The shafts were set for the room at full house light; in the dim room
    // (hallLight.ts) that much haze washes the frame, so they come down with
    // it — to about a third, still the brightest air in the room.
    const p = power * (0.35 + 0.65 * hallLight.level);
    for (const s of shafts) {
      s.material.uniforms.uTime.value = state.clock.elapsedTime;
      s.material.uniforms.uPower.value = p;
    }
  });

  return (
    <group name="window_light">
      {shafts.map((s, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={s.material}
          matrixAutoUpdate={false}
          matrix={s.matrix}
          renderOrder={4}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
