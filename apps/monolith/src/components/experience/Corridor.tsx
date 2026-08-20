'use client';

// apps/monolith/src/components/experience/Corridor.tsx
//
// The scene graph — MASTER_SPEC §5, L8.
//
// Composes the world and owns the light budget. Four dynamic lights, hard cap,
// asserted by scripts/continuity-check.mjs against the table's `lights` column.
// The 2700K interior warmth in Act III comes from colour and falloff, not from
// adding a fifth light.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Terrain } from './Terrain';
import { subscribe } from '@/lib/ticker';
import { useSceneStore } from '@/state/sceneStore';
import { TIER_BUDGET } from '@/lib/tier';

/**
 * Dusk sky as a gradient on an inverted sphere.
 *
 * BackSide on a sphere rather than a cube map: no six textures to fetch, no
 * seams, and the gradient is a two-line shader. This is the "procedural
 * everything" claim in §1 being literal — there is no HDRI anywhere in this
 * build.
 */
function Sky() {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#070810') },
      uHorizon: { value: new THREE.Color('#1b1c24') },
      // The one warm note in the sky, low and west, matching the terrain's sun
      // direction. Dusk, not sunset — the ember is nearly spent.
      uEmber: { value: new THREE.Color('#c8642a') },
      uSunDir: { value: new THREE.Vector3(-0.82, 0.16, -0.34).normalize() },
    }),
    [],
  );

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[3400, 32, 24]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uHorizon;
          uniform vec3 uEmber;
          uniform vec3 uSunDir;
          varying vec3 vDir;

          void main() {
            vec3 d = normalize(vDir);

            // Vertical gradient, biased so the horizon band is tight. A soft
            // gradient across the whole dome reads as a studio backdrop; a
            // tight band reads as atmosphere with depth behind it.
            float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 col = mix(uHorizon, uTop, pow(h, 0.75));

            // Ember glow around the sun's bearing, falling off fast.
            float toward = clamp(dot(d, normalize(uSunDir)), 0.0, 1.0);
            col += uEmber * pow(toward, 22.0) * 0.55;
            col += uEmber * pow(toward, 4.0) * 0.06 * (1.0 - h);

            // Dither. Banding in a dark vertical gradient on an 8-bit display
            // is the most common tell of an amateur WebGL sky.
            float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
            col += (n - 0.5) * 0.004;

            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

/**
 * The water — Kartikeya's lake, which the project is named after (§1②).
 *
 * Flat plane, Gerstner displacement in the vertex stage, normals reconstructed
 * from the displaced surface. Three low-amplitude waves: this is surface
 * tension on an inland lake, not ocean.
 */
function Water() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSky: { value: new THREE.Color('#1b1c24') },
      uDeep: { value: new THREE.Color('#05080c') },
      uSunDir: { value: new THREE.Vector3(-0.82, 0.16, -0.34).normalize() },
    }),
    [],
  );

  useEffect(
    () =>
      subscribe(() => {
        if (mat.current) {
          mat.current.uniforms.uTime.value = performance.now() * 0.001;
        }
      }),
    [],
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[64, 1.2, 96]} frustumCulled={false}>
      <planeGeometry args={[168, 128, 96, 72]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          uniform float uTime;
          varying vec3 vWorld;
          varying vec3 vNormal2;

          vec3 gerstner(vec2 p, vec2 dir, float amp, float len, float speed, float t) {
            float k = 6.28318 / len;
            float f = k * (dot(normalize(dir), p) - speed * t);
            return vec3(normalize(dir) * (amp * cos(f)), amp * sin(f)).xzy;
          }

          void main() {
            vec3 p = position;
            vec2 w = p.xy;

            vec3 d = vec3(0.0);
            d += gerstner(w, vec2( 1.0, 0.35), 0.16, 14.0, 0.55, uTime);
            d += gerstner(w, vec2(-0.4, 1.00), 0.11,  9.0, 0.42, uTime);
            d += gerstner(w, vec2( 0.7,-0.70), 0.07,  5.0, 0.71, uTime);

            p.x += d.x;
            p.y += d.z;
            p.z += d.y;

            vec4 world = modelMatrix * vec4(p, 1.0);
            vWorld = world.xyz;
            vNormal2 = vec3(0.0, 1.0, 0.0);
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uSky;
          uniform vec3 uDeep;
          uniform vec3 uSunDir;
          varying vec3 vWorld;

          void main() {
            // Normals from the displaced surface, same reasoning as the
            // terrain: the attribute normals are all straight up and would
            // light this as glass.
            vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
            if (n.y < 0.0) n = -n;

            vec3 view = normalize(cameraPosition - vWorld);

            // Schlick Fresnel. At a grazing angle the lake mirrors the sky; from
            // above it goes to its own dark body colour. That ratio IS the
            // material — there is no reflection probe here.
            float f0 = 0.02;
            float fres = f0 + (1.0 - f0) * pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 5.0);

            vec3 col = mix(uDeep, uSky, fres);

            // A single specular glint on the sun's bearing. Tight exponent so
            // it is a line on the water, not a bloom.
            vec3 h = normalize(normalize(uSunDir) + view);
            col += vec3(0.85, 0.55, 0.30) * pow(clamp(dot(n, h), 0.0, 1.0), 220.0) * 0.7;

            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

/**
 * Act III massing — the model duplex villa (§1③).
 *
 * Deliberately primitive for now: the threshold machinery (signed distance to
 * the glass plane, exposure lag, the dissolve) needs a plane to breach and a
 * volume to be inside, and it can be developed against boxes before any real
 * model exists. Replacing this with modelled geometry changes nothing above it.
 */
function Villa() {
  return (
    <group position={[0, 0, -14]}>
      <mesh position={[0, 3.2, 0]} castShadow>
        <boxGeometry args={[18, 6.4, 13]} />
        <meshStandardMaterial color="#15161b" roughness={0.92} metalness={0} />
      </mesh>
      {/* The glass the camera breaches at q 0.66. Its own material for now;
          the distance-driven dissolve replaces this. */}
      <mesh position={[0, 2.6, 6.55]}>
        <planeGeometry args={[11, 5]} />
        <meshPhysicalMaterial
          color="#0b0e14"
          roughness={0.06}
          metalness={0}
          transmission={0.82}
          thickness={0.4}
          transparent
        />
      </mesh>
    </group>
  );
}

export function Corridor() {
  const tier = useSceneStore((s) => s.tier);
  const budget = TIER_BUDGET[tier];

  return (
    <>
      <Sky />
      <Terrain />
      <Water />
      <Villa />

      {/* LIGHT BUDGET — four, hard cap (L8).
          1: the dusk key, low and west, matching both shaders' uSunDir.
          2: cool sky fill so shadowed faces separate without lifting toward
             the key's colour.
          3–4: interior practicals, only above tier C. */}
      <directionalLight position={[-820, 160, -340]} intensity={1.2} color="#ffb478" />
      <hemisphereLight args={['#2b3550', '#0a0806', 0.42]} />

      {budget.maxLights >= 3 && (
        <pointLight position={[0, 2.6, -12]} intensity={14} distance={22} decay={2} color="#ffd6aa" />
      )}
      {budget.maxLights >= 4 && (
        <pointLight position={[-5, 2.2, -18]} intensity={10} distance={18} decay={2} color="#ffd6aa" />
      )}
    </>
  );
}
