'use client';

// apps/public/src/components/experience/Motes.tsx
//
// A drifting particle field in the air around the building.
//
// Purpose is atmosphere, not spectacle: the frame reads as an empty navy void
// because nothing occupies the space BETWEEN the camera and the architecture.
// Motes give that volume something to describe. Warm amber, low opacity, moving
// slowly enough that they read as dust catching the key light rather than as
// snow.
//
// Implementation notes that matter for the 50-lakh performance target:
//
//   * ONE THREE.Points with a BufferGeometry, not instanced meshes. 2,400
//     points is one draw call and one attribute upload; 2,400 InstancedMesh
//     entries would be one draw call but 2,400 matrices recomputed per frame
//     on the CPU. Points are the right primitive for something with no
//     silhouette.
//
//   * Displacement happens in the VERTEX SHADER, on the GPU. The CPU never
//     touches the positions after upload — useFrame writes a single uniform.
//     Animating 2,400 positions in JS and flagging needsUpdate every frame is
//     the classic way a particle field costs more than the building it
//     decorates.
//
//   * The noise is a cheap sin/cos lattice rather than real simplex. At this
//     size and speed the difference is invisible, and a full simplex
//     implementation is ~80 lines of shader that every fragment would pay for.
//
//   * depthWrite off, additive blending, and NO depth test disable — motes must
//     still be occluded BY the building, or they float in front of the facade
//     and instantly read as an overlay rather than as air.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COUNT = 2400;

/** The volume the motes occupy, in metres, centred on the approach axis. Sized
 *  to the camera path (z 9..30, x -15..2) plus margin, so they are always in
 *  shot without wasting points behind the camera. */
const SPREAD = { x: 46, y: 4.0, z: 44, zOffset: 8 };

/** The fountain, which the motes circulate around. Air in a forecourt moves
 *  around the thing in the middle of it, and anchoring the swirl to real
 *  geometry is what stops this reading as a screensaver. */
const FOUNTAIN = { x: 0, z: 13.2 };

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform vec2 uSwirl;
  attribute float aSeed;
  attribute float aScale;
  varying float vFade;

  void main() {
    vec3 p = position;

    // Three offset sines per axis: enough to look unrepeating over the ~40s a
    // visitor spends on the page, cheap enough to be free.
    float t = uTime * 0.08 + aSeed * 6.2831;

    // SWIRL. Rotate about the fountain axis at a rate that falls off with
    // distance, so the air turns fastest where the fountain is and barely moves
    // at the edge of the forecourt. This is what makes the field read as
    // volume circulating around something, rather than as points drifting.
    vec2 rel = p.xz - uSwirl;
    float rad = length(rel);
    float spin = uTime * 0.055 / (1.0 + rad * 0.18) + aSeed * 0.9;
    float cs = cos(spin);
    float sn = sin(spin);
    p.xz = uSwirl + vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs);

    p.x += sin(t * 1.3) * 0.5 + sin(t * 0.41) * 0.8;
    // Vertical wander damped hard: motes must stay in the low band they were
    // seeded into or they climb back out of it over time.
    p.y += cos(t * 0.9) * 0.22 + sin(t * 0.23) * 0.3;
    p.z += sin(t * 1.1 + 1.7) * 0.5;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    // Fade at both ends of the depth range: motes that pop in at the far plane
    // or slide past the near plane are the tell that this is a particle system.
    float d = -mv.z;
    vFade = smoothstep(2.0, 9.0, d) * (1.0 - smoothstep(38.0, 62.0, d));

    gl_Position = projectionMatrix * mv;
    // Perspective-correct sizing, clamped so near motes do not become discs.
    gl_PointSize = clamp(uSize * aScale * (18.0 / d), 1.0, 7.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;

  void main() {
    // Round, soft-edged. gl_PointCoord is 0..1 across the sprite; without this
    // every mote is a hard square, which is the single most recognisable
    // "default THREE.Points" look.
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = dot(d, d);
    if (r > 0.25) discard;
    float alpha = smoothstep(0.25, 0.0, r) * vFade * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function Motes({ count = COUNT }: { count?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const scale = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * SPREAD.x;
      // Biased low: dust hangs near the ground and thins with height, so a
      // uniform distribution reads as a cube of static rather than as air.
      // Ceiling of 4m and heavily biased to the floor. It was 14m with a mild
      // bias, which put most of the field ABOVE the roofline — motes against
      // open sky with no geometry near them, which is why it read as a flat
      // 2D starfield pasted over the frame rather than as air in a place. Dust
      // hangs low; anything higher has nothing to belong to.
      pos[i * 3 + 1] = Math.pow(Math.random(), 2.6) * SPREAD.y + 0.25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD.z + SPREAD.zOffset;
      seed[i] = Math.random();
      scale[i] = 0.45 + Math.random() * 0.9;
    }

    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    // Frustum culling off: the bounding sphere is computed from the UNMOVED
    // positions, but the shader displaces by up to ~2.6m, so a mote near the
    // edge would be culled while still visible.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 8), 60);
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 2.6 },
      uSwirl: { value: new THREE.Vector2(FOUNTAIN.x, FOUNTAIN.z) },
      uColor: { value: new THREE.Color('#E8B98A') },
      uOpacity: { value: 0.34 },
    }),
    [],
  );

  useFrame((state) => {
    if (mat.current) mat.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={2}>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
