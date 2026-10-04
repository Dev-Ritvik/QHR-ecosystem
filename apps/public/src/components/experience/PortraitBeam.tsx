'use client';

// apps/public/src/components/experience/PortraitBeam.tsx
//
// The picture light, made visible.
//
// THE THIRD REVIEW: "add dedicated, gallery-style volumetric spotlights above
// it to give the focal point physical presence." The portrait already has its
// light — LGT_portrait, in the bake, and the brass picture light on the frame —
// but light in clean air is invisible, so nothing said where it came from.
// A gallery's air is never clean: a faint sheet of light falls from the lamp
// over the canvas, brightest at the lamp and fading down the painting, with
// dust turning slowly in it.
//
// One quad in front of the canvas, shaped as the fan the lamp throws (narrow at
// the lamp, the canvas's width at its foot), drawn additively. Colour only: the
// alpha channel carries the frame's view depth for the lens (LensFocus), and a
// sheet of air must not move the painting's focus.

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** The lamp's bar and the canvas's foot, from the GLB (InteriorStage.PORTRAIT):
 *  the imperial hall hangs the portrait a quarter larger, its frame's foot at
 *  y 5.00, so the fan the lamp throws is scaled and raised with it. */
const TOP = { y: 9.26, z: -7.2, half: 0.78 };
const FOOT = { y: 5.13, z: -7.48, half: 1.43 };

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  uniform vec3  uWarm;
  varying vec2 vUv;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    // v: 1 at the lamp, 0 at the canvas's foot. u: across the fan.
    float fromLamp = 1.0 - vUv.y;
    // Spent before it reaches the sitter. At a fall of 2.4 the sheet was still
    // at six-tenths over the hair, a quarter of the way down the canvas, and
    // from the door that read as the light covering it (the client,
    // 2026-10-01). At 9 it is a tenth there: brightest in the hand's breadth
    // of air under the lamp, gone by the brow.
    float falloff = exp(-fromLamp * 9.0);
    float edges = smoothstep(0.0, 0.22, vUv.x) * smoothstep(0.0, 0.22, 1.0 - vUv.x);
    // Air, not glass: a slow drift of density through the sheet...
    float air = 0.75 + 0.25 * n2(vec2(vUv.x * 6.0, vUv.y * 3.0 - uTime * 0.05));
    // ...and dust catching the light.
    vec2 g = vec2(vUv.x * 90.0, vUv.y * 120.0 + uTime * 1.3);
    float mote = step(0.992, h(floor(g))) * (0.5 + 0.5 * sin(uTime * 2.0 + h(floor(g)) * 30.0));
    float a = falloff * edges * air * uPower + mote * edges * falloff * 0.6 * uPower;
    gl_FragColor = vec4(uWarm * a, 0.0);
  }
`;

export function PortraitBeam() {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array([
      -FOOT.half, FOOT.y, FOOT.z,
      FOOT.half, FOOT.y, FOOT.z,
      TOP.half, TOP.y, TOP.z,
      -TOP.half, TOP.y, TOP.z,
    ]);
    const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          // 0.055 -> 0.03, with the lamp turned down (HallModel.PICTURE_LAMP).
          uPower: { value: 0.03 },
          uWarm: { value: new THREE.Color('#FFD7A0') },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendEquationAlpha: THREE.AddEquation,
        blendSrcAlpha: THREE.ZeroFactor,
        blendDstAlpha: THREE.OneFactor,
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt;
  });
  return <mesh name="portrait_beam" geometry={geometry} material={material} renderOrder={3} />;
}
