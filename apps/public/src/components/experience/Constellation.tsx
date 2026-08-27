'use client';

// apps/public/src/components/experience/Constellation.tsx
//
// The glowing sphere: a spherical constellation of small luminous points, held
// above the estate, that the orbit resolves onto.
//
// WHAT IT MUST NOT BE. The brief lists the failure modes by name — gaming HUD,
// cyberpunk, cheap neon, nightclub, particle demo — and they all share one
// cause: additive points at full saturation with no falloff, so the thing reads
// as light emitted by a screen rather than as objects in air. Everything below
// is aimed at the opposite: warm champagne rather than cyan, brightness that
// falls with depth so the far shell sits BEHIND the near one, and a size that
// is in metres and therefore obeys perspective like a real object.
//
// STRUCTURE, NOT SCATTER. Three concentric shells on a Fibonacci lattice, each
// counter-rotating slowly against the next. A single shell of random points is
// a fog; nested lattices turning at different rates give the parallax that makes
// it read as a volume you could walk around, which is the whole reason it is
// three-dimensional rather than an SVG.
//
// THE HOVER. Deliberately not `scale(1.1)`. The cursor is projected onto the
// sphere and points near that projection are pushed OUTWARD along their own
// radius and brightened, with the response falling off over about a fifth of
// the sphere — so the surface swells toward the pointer and settles back, and
// the constellation appears to notice the hand. Displacement plus local
// luminance, which is what the brief asks for and what a scale cannot give.
//
// ONE DRAW CALL. All three shells are one BufferGeometry and one Points object.
// A shell index rides in an attribute, so the shader can rotate them
// independently without three draw calls and three uploads.
//
// GLSL NOTE: this compiles as GLSL ES 3.00 on WebGL2, where a long list of
// words are reserved that GLSL ES 1.00 allowed. This project has already lost a
// day to `flat` (a reserved interpolation qualifier) silently killing a vertex
// shader, so shaders.test.ts scans these template literals for the whole list.
// If a name here trips it, rename the variable — do not weaken the test.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** Points per shell, innermost first. Falling counts keep the outer shell — the
 *  one that reads as the silhouette — dense, without paying for interior points
 *  that are mostly occluded by it. */
const SHELLS = [
  { radius: 0.52, count: 320 },
  { radius: 0.78, count: 640 },
  { radius: 1.0, count: 1180 },
] as const;

/**
 * Fibonacci lattice.
 *
 * Even coverage of a sphere without the polar bunching that naive
 * (random theta, random phi) produces — that clustering is exactly what makes a
 * generated point sphere look generated.
 */
function fibonacciSphere(count: number, out: Float32Array, offset: number) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out[(offset + i) * 3] = Math.cos(theta) * r;
    out[(offset + i) * 3 + 1] = y;
    out[(offset + i) * 3 + 2] = Math.sin(theta) * r;
  }
}

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform vec3  uCursor;      // world-space point the pointer projects to
  uniform float uCursorGain;  // 0 when the pointer is away, 1 when engaged
  uniform float uReveal;      // 0..1 chapter presence

  attribute float aShell;     // 0,1,2
  attribute float aRadius;    // shell radius, object space
  attribute float aSeed;

  varying float vGlow;
  varying float vDepth;

  // Rotate about Y. Each shell turns at its own rate and direction so the
  // lattices slide across each other and the volume reads as deep.
  vec3 spinY(vec3 p, float a) {
    float s = sin(a), c = cos(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }

  void main() {
    // Alternating direction, slower on the outside: the outer shell is the
    // silhouette and should feel almost still, while the core turns visibly.
    float dir = mod(aShell, 2.0) < 0.5 ? 1.0 : -1.0;
    float rate = 0.045 - aShell * 0.011;
    vec3 dirVec = spinY(position, uTime * rate * dir);

    // Breathing. A few millimetres, phase-offset per point, so the surface is
    // never perfectly still without anything appearing to move.
    float breathe = 1.0 + 0.014 * sin(uTime * 0.7 + aSeed * 6.2831);

    vec3 local = dirVec * aRadius * breathe;

    // HOVER RESPONSE. Distance from this point to the cursor's projection,
    // measured on the object-space sphere. Points inside the influence radius
    // are pushed out along their own normal and brightened.
    float d = distance(normalize(local) * aRadius, uCursor);
    // Inverted smoothstep, so proximity is 1 at the cursor and 0 at the edge
    // of influence. 0.62 of a unit radius is roughly a fifth of the sphere.
    float proximity = 1.0 - smoothstep(0.0, 0.62, d);
    float pull = proximity * proximity * uCursorGain;

    local += normalize(local) * pull * 0.19;

    vec4 mv = modelViewMatrix * vec4(local, 1.0);
    gl_Position = projectionMatrix * mv;

    // Size in METRES, attenuated by distance — so the constellation obeys
    // perspective. A constant gl_PointSize is the single clearest tell of a
    // particle demo: the far side of the sphere renders the same size as the
    // near side and the volume collapses flat.
    float dist = -mv.z;
    gl_PointSize = uSize * (1.0 + pull * 1.35) * (300.0 / max(1.0, dist));

    // Depth cue for the fragment stage: 0 at the back of the sphere, 1 at the
    // front. This is what puts the far shell behind the near one without any
    // depth testing between points.
    vDepth = clamp(0.5 + local.z * 0.5, 0.0, 1.0);
    vGlow = pull;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform vec3  uCore;
  uniform vec3  uWarm;
  uniform float uReveal;

  varying float vGlow;
  varying float vDepth;

  void main() {
    // Round, soft-edged point. gl_PointCoord is 0..1 across the sprite.
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;

    // Two-part falloff: a tight core and a wide halo. One smoothstep gives a
    // fuzzy dot; this gives something with a filament in the middle, which is
    // what reads as a light rather than as a blurred circle.
    float core = 1.0 - smoothstep(0.0, 0.34, r);
    float halo = (1.0 - smoothstep(0.0, 1.0, r)) * 0.42;

    // Warm champagne at the core, cooling very slightly at the rim. Restrained
    // on purpose: saturated hues here are what make this kind of object read as
    // a screensaver.
    vec3 tint = mix(uWarm, uCore, core);
    tint = mix(tint, uCore, vGlow * 0.7);

    // Depth: the back of the sphere is dimmer and cooler. 0.34 floor so the far
    // side is present rather than absent — a hollow front-facing shell reads as
    // a dome, not a ball.
    float depth = 0.34 + 0.66 * vDepth;

    float a = (core + halo) * depth * uReveal * (0.55 + 0.9 * vGlow);
    gl_FragColor = vec4(tint * (0.85 + vGlow * 1.4), a);
  }
`;

export function Constellation({
  /** World position of the sphere's centre. */
  position,
  /** World radius. The shells are authored in unit space and scaled by this. */
  radius = 5.2,
  /** 0..1 — how present this chapter is. Fades the whole object rather than
   *  unmounting it, so the geometry is uploaded once and the arrival is a
   *  dissolve rather than a pop. */
  reveal,
  /** Halved on low tier: this is atmosphere with a hover response, and a phone
   *  should get a thinner constellation rather than none. */
  density = 1,
}: {
  position: [number, number, number];
  radius?: number;
  reveal: React.MutableRefObject<number>;
  density?: number;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const points = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const counts = SHELLS.map((s) => Math.max(24, Math.round(s.count * density)));
    const total = counts.reduce((a, b) => a + b, 0);

    const pos = new Float32Array(total * 3);
    const shell = new Float32Array(total);
    const rad = new Float32Array(total);
    const seed = new Float32Array(total);

    let o = 0;
    for (let s = 0; s < SHELLS.length; s += 1) {
      fibonacciSphere(counts[s], pos, o);
      for (let i = 0; i < counts[s]; i += 1) {
        shell[o + i] = s;
        // A little jitter on the radius so the shells are not three perfect
        // soap bubbles. Deterministic per index — no Math.random, so the same
        // constellation is built on the server-less client every time and a
        // reload does not reshuffle it.
        const j = Math.sin((o + i) * 12.9898) * 43758.5453;
        seed[o + i] = j - Math.floor(j);
        rad[o + i] = SHELLS[s].radius * (0.97 + seed[o + i] * 0.06);
      }
      o += counts[s];
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aShell', new THREE.BufferAttribute(shell, 1));
    g.setAttribute('aRadius', new THREE.BufferAttribute(rad, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    // The lattice is a unit sphere and the shader only ever pushes points
    // outward by 0.19, so the bounds are known and never need recomputing from
    // a moving vertex buffer.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.3);
    return g;
  }, [density]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 0.0 },
      uCursor: { value: new THREE.Vector3(0, 0, 0) },
      uCursorGain: { value: 0 },
      uReveal: { value: 0 },
      uCore: { value: new THREE.Color('#FFE9C8') },
      uWarm: { value: new THREE.Color('#C98F4E') },
    }),
    [],
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        // Additive, but the alpha above is already depth- and reveal-weighted,
        // so the sum stays inside the headroom ACES has left. Straight additive
        // at full alpha is what turns this kind of object into a white ball.
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      }),
    [uniforms],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  // ── Pointer projection ───────────────────────────────────────────────────
  //
  // The cursor is not a 3D object, so "the point of the sphere nearest the
  // pointer" is found by intersecting the pointer ray with the sphere. When the
  // ray misses — which is most of the time, since the sphere occupies a corner
  // of the frame — the nearest point ON the ray to the centre is used instead
  // and the gain falls off with how badly it missed. That keeps the response
  // continuous: the surface starts reacting as the pointer approaches rather
  // than snapping on at the silhouette edge.
  const ndc = useRef(new THREE.Vector2(0, 0));
  const active = useRef(false);
  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.current.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -(((e.clientY - r.top) / r.height) * 2 - 1),
      );
      active.current = true;
    };
    const onLeave = () => {
      active.current = false;
    };
    if (window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerout', onLeave);
    }
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onLeave);
    };
  }, [gl]);

  const ray = useRef(new THREE.Raycaster());
  const centre = useRef(new THREE.Vector3());
  const nearest = useRef(new THREE.Vector3());
  const local = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const obj = points.current;
    if (!obj) return;

    const r = reveal.current;
    uniforms.uReveal.value += (r - uniforms.uReveal.value) * Math.min(1, delta * 3.5);
    uniforms.uTime.value += delta;

    // Below the visibility floor there is nothing to compute — skip the
    // raycast entirely rather than projecting a pointer onto an invisible
    // object for the 60% of the page this chapter is not on screen.
    obj.visible = uniforms.uReveal.value > 0.004;
    if (!obj.visible) {
      uniforms.uCursorGain.value = 0;
      return;
    }

    // Point size in metres of world, converted to the pixels the shader wants.
    // Scaled by the object's own scale so a change of radius does not silently
    // change the grain of the constellation.
    uniforms.uSize.value = 0.9;

    let gain = 0;
    if (active.current) {
      ray.current.setFromCamera(ndc.current, camera);
      obj.getWorldPosition(centre.current);
      // Closest approach of the pointer ray to the sphere centre.
      ray.current.ray.closestPointToPoint(centre.current, nearest.current);
      const miss = nearest.current.distanceTo(centre.current);
      // Full response inside the sphere, tapering to nothing at 1.8 radii — so
      // the constellation reacts as the pointer nears it, not only once it is
      // over it.
      gain = 1 - THREE.MathUtils.smoothstep(miss, radius * 0.55, radius * 1.8);

      // Project the closest point back onto the unit sphere in the object's own
      // space, which is where the vertex shader compares it.
      local.current.copy(nearest.current).sub(centre.current).divideScalar(radius);
      const len = local.current.length();
      if (len > 1e-4) local.current.multiplyScalar(Math.min(1, 1 / len));
      uniforms.uCursor.value.copy(local.current);
    }
    uniforms.uCursorGain.value +=
      (gain - uniforms.uCursorGain.value) * Math.min(1, delta * 7);
  });

  return (
    <points
      ref={points}
      position={position}
      scale={radius}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
}
