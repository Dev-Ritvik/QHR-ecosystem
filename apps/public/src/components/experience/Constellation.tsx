'use client';

// apps/public/src/components/experience/Constellation.tsx
//
// The glowing ball above the house: "a glowing ball made up of multiple glowing
// spheres ... and it will have the same hover effect" (the storyboard), after
// the reference the client sent — Vertex3D's sphere of glowing beads that
// streams away from the cursor like a disturbed fluid and settles back.
//
// WHAT IT WAS, AND WHY IT WENT. Three shells of soft point sprites, champagne,
// no glow: at dusk over the house the second client review read it as "a raw,
// unstyled particle system from a default game engine ... [with no] light-spill
// or aura". A sprite is a disc that always faces the lens; nothing about it is
// an object.
//
// WHAT IT IS.
//
//   BEADS, NOT SPRITES. ~1,300 small glowing beads on a Fibonacci lattice, one
//   instanced draw call. Each is drawn out along its own radius, so the ball
//   has the reference's fine, spiked silhouette — a dandelion clock, not a
//   golf ball — and each is a lit volume: hot where it faces the lens, amber at
//   its rim, dimmer on the far side of the ball. Bright enough to cross the
//   bloom threshold, so the ball spills light (PostFX, BLOOM).
//
//   AN AURA. A soft halo of warm light behind the ball, additive, so it glows
//   into the evening sky around it the way a lamp does in air.
//
//   A BODY, SIMULATED (ballSim.ts). The client found the first version rigid
//   and its hover cheap: beads displaced by a formula of the pointer, moving
//   exactly as far as the formula said and stopping when the hand did. Now
//   every bead has mass and is held by springs — to its place, and to its
//   neighbours, so the beads hold together as a skin — the ball floats and
//   squashes as a whole, and the hand is a force field moving through it. What
//   the eye reads is inertia: motion that builds, carries on, overshoots a
//   little and settles by itself. Each bead is drawn out along its own motion,
//   and brightens while it moves.
//
// Gilt, not the reference's pink: the palette is the estate's.
//
// DEPTH-IN-ALPHA. The exterior lens and the contact occlusion read the view
// depth from the frame's alpha (LensFocus.tsx). The beads write theirs; the
// aura blends colour only and leaves the alpha alone.
//
// GLSL NOTE: GLSL ES 3.00 reserves words GLSL ES 1.00 allowed (shaders.test.ts
// scans this file). Rename, do not weaken the test.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createBallSim, stepBall, type BallPointer } from './ballSim';

/** Beads on the ball, at full density. */
const BEADS = 1300;
/** A bead's width and length, in units of the ball's radius. */
const BEAD_W = 0.013;
const BEAD_L = 0.05;

function fibonacciSphere(count: number): Float32Array {
  const out = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out[i * 3] = Math.cos(theta) * r;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = Math.sin(theta) * r;
  }
  return out;
}

const VERT = /* glsl */ `
  uniform float uReveal;
  uniform vec3  uDrift;     // the ball's own velocity: a bead riding the
                            // whole ball's sway is not stirred by it

  attribute vec3  aPos;      // the bead's simulated place, unit-sphere space
  attribute vec3  aVel;      // and its velocity
  attribute float aSeed;

  varying vec3  vNormalV;
  varying vec3  vViewPos;
  varying float vDepth;
  varying float vStir;

  void main() {
    vec3 own = aVel - uDrift;
    float speed = length(own);
    // The bead's long axis: outward, bent into its own motion, and drawn out
    // while it moves, so a disturbed patch of the ball reads as a current.
    vec3 axis = normalize(normalize(aPos) + own * 0.22);
    vec3 side = normalize(cross(axis, abs(axis.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 fwd = cross(side, axis);
    float grow = smoothstep(0.0, 1.0, uReveal);
    float len = ${BEAD_L.toFixed(3)} * (0.75 + 0.5 * aSeed) * (1.0 + min(speed * 0.9, 1.6)) * grow;
    float wid = ${BEAD_W.toFixed(3)} * (0.8 + 0.4 * aSeed) * grow;
    vec3 local = aPos + side * position.x * wid + axis * position.y * len + fwd * position.z * wid;
    vec3 nrm = normalize(side * normal.x * len + axis * normal.y * wid + fwd * normal.z * len);

    vec4 mv = modelViewMatrix * vec4(local, 1.0);
    gl_Position = projectionMatrix * mv;
    vViewPos = mv.xyz;
    vNormalV = normalize(normalMatrix * nrm);
    vec3 cView = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vDepth = clamp(0.5 + (mv.z - cView.z) / (2.0 * length(modelMatrix[0].xyz)), 0.0, 1.0);
    vStir = min(1.0, speed * 0.8);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3  uHot;
  uniform vec3  uAmber;
  uniform float uReveal;
  uniform float uPower;

  varying vec3  vNormalV;
  varying vec3  vViewPos;
  varying float vDepth;
  varying float vStir;

  void main() {
    vec3 v = normalize(-vViewPos);
    float facing = clamp(abs(dot(normalize(vNormalV), v)), 0.0, 1.0);
    // White-hot where the bead faces the lens, amber at its rim.
    vec3 col = mix(uAmber, uHot, pow(facing, 1.6));
    // The far side of the ball glows through the near side, dimmer.
    float depth = 0.28 + 0.72 * vDepth;
    float power = uPower * depth * (1.0 + vStir * 0.9) * uReveal;
    // Depth in metres into the alpha, for the lens and the occlusion
    // (LensFocus.installFocusDepth; never 1.0, which means "far").
    gl_FragColor = vec4(col * power, max(-vViewPos.z, 1.05));
  }
`;

const AURA_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // A billboard: the quad's corners laid out in view space around the centre.
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float s = length(modelMatrix[0].xyz);
    mv.xy += position.xy * s;
    gl_Position = projectionMatrix * mv;
  }
`;

const AURA_FRAG = /* glsl */ `
  uniform vec3  uAmber;
  uniform float uReveal;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float halo = exp(-r * r * 3.2) * 0.55 + exp(-r * 7.0) * 0.35;
    gl_FragColor = vec4(uAmber * halo * 0.32 * uReveal, 0.0);
  }
`;

export function Constellation({
  /** World position of the ball's centre. */
  position,
  /** World radius. */
  radius = 5.2,
  /** 0..1 — how present this chapter is. The beads grow in and the glow comes
   *  up with it, so the arrival is a bloom rather than a pop. */
  reveal,
  /** Thinner on the low tier. */
  density = 1,
}: {
  position: [number, number, number];
  radius?: number;
  reveal: React.MutableRefObject<number>;
  density?: number;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const group = useRef<THREE.Group>(null);
  const beads = useRef<THREE.InstancedMesh>(null);

  const count = Math.max(200, Math.round(BEADS * density));

  const geometry = useMemo(() => {
    // A low sphere: at a bead's size on screen, 80 triangles are a sphere.
    const g = new THREE.IcosahedronGeometry(1, 1);
    const dirs = fibonacciSphere(count);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const j = Math.sin(i * 12.9898) * 43758.5453;
      seed[i] = j - Math.floor(j);
      // A little jitter off the lattice, so the ball is not a perfect grid.
      const k = Math.sin(i * 78.233) * 43758.5453;
      const jit = (k - Math.floor(k) - 0.5) * 0.018;
      dirs[i * 3] += jit;
      dirs[i * 3 + 2] -= jit;
      const n = Math.hypot(dirs[i * 3], dirs[i * 3 + 1], dirs[i * 3 + 2]);
      dirs[i * 3] /= n;
      dirs[i * 3 + 1] /= n;
      dirs[i * 3 + 2] /= n;
    }
    const sim = createBallSim(dirs);
    // The simulation's own arrays ARE the attributes: no copy per frame.
    const aPos = new THREE.InstancedBufferAttribute(sim.pos, 3);
    const aVel = new THREE.InstancedBufferAttribute(sim.vel, 3);
    aPos.setUsage(THREE.DynamicDrawUsage);
    aVel.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aPos', aPos);
    g.setAttribute('aVel', aVel);
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.0);
    g.userData.sim = sim;
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uReveal: { value: 0 },
      uDrift: { value: new THREE.Vector3() },
      uHot: { value: new THREE.Color('#FFDDA6') },
      uAmber: { value: new THREE.Color('#C87A30') },
      // Over the bloom threshold (PostFX BLOOM, 0.82 scene-linear) at the
      // front of the ball, so it spills light; under it at the back.
      uPower: { value: 1.35 },
    }),
    [],
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        depthWrite: true,
        depthTest: true,
      }),
    [uniforms],
  );

  const aura = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uAmber: uniforms.uAmber, uReveal: uniforms.uReveal },
      vertexShader: AURA_VERT,
      fragmentShader: AURA_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      // Additive in colour, and the alpha — the scene's depth — left alone.
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    return m;
  }, [uniforms]);
  const auraGeometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      aura.dispose();
      auraGeometry.dispose();
    },
    [geometry, material, aura, auraGeometry],
  );

  // ── The pointer on the ball ──────────────────────────────────────────────
  //
  // The pointer ray is intersected with the ball; where it misses, the point
  // of the ray nearest the centre stands in and the response tapers with the
  // miss, so the surface starts to stir as the hand approaches rather than
  // switching on at the silhouette.
  const ndc = useRef(new THREE.Vector2(0, 0));
  const engaged = useRef(false);
  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.current.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      engaged.current = true;
    };
    const onLeave = () => {
      engaged.current = false;
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
  const onBall = useRef(new THREE.Vector3(0, 0, 1));
  const last = useRef(new THREE.Vector3(0, 0, 1));
  const handVel = useRef(new THREE.Vector3());
  const inverse = useRef(new THREE.Quaternion());
  const toCam = useRef(new THREE.Vector3());
  const moved = useRef(new THREE.Vector3());
  const pointer = useRef<BallPointer>({ gain: 0, at: [0, 0, 1], vel: [0, 0, 0] });
  const wasOn = useRef(false);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(0.05, Math.max(1e-4, delta));
    uniforms.uReveal.value += (reveal.current - uniforms.uReveal.value) * Math.min(1, dt * 3.5);

    g.visible = uniforms.uReveal.value > 0.004;
    if (!g.visible) {
      pointer.current.gain = 0;
      wasOn.current = false;
      return;
    }
    // The ball turns, slowly, as a whole.
    g.rotation.y += dt * 0.045;

    let gain = 0;
    if (engaged.current) {
      ray.current.setFromCamera(ndc.current, camera);
      g.getWorldPosition(centre.current);
      ray.current.ray.closestPointToPoint(centre.current, nearest.current);
      const miss = nearest.current.distanceTo(centre.current);
      gain = 1 - THREE.MathUtils.smoothstep(miss, radius * 0.7, radius * 1.8);
      // Onto the ball, in its own (turning) frame, on the camera's side.
      onBall.current.copy(nearest.current).sub(centre.current).divideScalar(radius);
      toCam.current.copy(camera.position).sub(centre.current).normalize();
      const flat = onBall.current.length();
      onBall.current.addScaledVector(toCam.current, Math.sqrt(Math.max(0, 1 - Math.min(1, flat * flat))));
      if (onBall.current.lengthSq() > 1e-8) onBall.current.normalize();
      g.getWorldQuaternion(inverse.current).invert();
      onBall.current.applyQuaternion(inverse.current);
    }
    // The hand's velocity across the ball, smoothed; zero on the first frame
    // of an approach so arriving is not read as a flick.
    const m = moved.current.copy(onBall.current).sub(last.current).divideScalar(dt);
    last.current.copy(onBall.current);
    if (!wasOn.current || gain < 0.01) m.set(0, 0, 0);
    wasOn.current = gain >= 0.01;
    if (m.length() > 4) m.setLength(4);
    handVel.current.lerp(m, Math.min(1, dt * 9));
    const pt = pointer.current;
    pt.gain += (gain - pt.gain) * Math.min(1, dt * 5);
    pt.at[0] = onBall.current.x;
    pt.at[1] = onBall.current.y;
    pt.at[2] = onBall.current.z;
    pt.vel[0] = handVel.current.x;
    pt.vel[1] = handVel.current.y;
    pt.vel[2] = handVel.current.z;

    const sim = geometry.userData.sim;
    stepBall(sim, dt, pt);
    uniforms.uDrift.value.set(sim.centre[3], sim.centre[4], sim.centre[5]);
    (geometry.getAttribute('aPos') as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getAttribute('aVel') as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    // Named so the capture probe can find it, hide it and photograph the same
    // held frame twice.
    <group ref={group} name="CONSTELLATION" position={position} scale={radius}>
      <instancedMesh
        ref={beads}
        args={[geometry, material, count]}
        frustumCulled={false}
      />
      <mesh geometry={auraGeometry} material={aura} scale={2.1} frustumCulled={false} renderOrder={2} />
    </group>
  );
}
