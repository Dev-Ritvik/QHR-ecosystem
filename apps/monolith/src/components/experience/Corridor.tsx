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
import { Massing } from './Massing';
import { subscribe } from '@/lib/ticker';
import { useSceneStore } from '@/state/sceneStore';
import { TIER_BUDGET } from '@/lib/tier';
import { PRACTICAL_2700K, VOID_COLOR } from '@/lib/grade';

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
      uTop: { value: new THREE.Color('#07070C') },
      uHorizon: { value: new THREE.Color(VOID_COLOR) },
      // A COLD directional lift where the sun went down — not an ember.
      //
      // This used to be #c8642a at 0.55 intensity with a second, much broader
      // pow(toward, 4.0) term, and between them they laid an orange wash across
      // the whole western horizon. That is the "global orange filter" §5 Act III
      // forbids by name, arriving through the sky instead of through a grade.
      // The narrow term survives so the dome still has a light direction; the
      // broad one is gone, and the colour is now the blue of the hour after
      // sunset rather than the hour before it.
      uGlow: { value: new THREE.Color('#28324E') },
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
          uniform vec3 uGlow;
          uniform vec3 uSunDir;
          varying vec3 vDir;

          void main() {
            vec3 d = normalize(vDir);

            // Vertical gradient, biased so the horizon band is tight. A soft
            // gradient across the whole dome reads as a studio backdrop; a
            // tight band reads as atmosphere with depth behind it.
            float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 col = mix(uHorizon, uTop, pow(h, 0.75));

            // Cold glow around the sun's bearing, falling off fast. The
            // exponent stays high deliberately: anything broader than this
            // stops being a light direction and becomes a filter over the
            // horizon, which is the failure this replaced.
            float toward = clamp(dot(d, normalize(uSunDir)), 0.0, 1.0);
            col += uGlow * pow(toward, 22.0) * 0.30;

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
      uSky: { value: new THREE.Color(VOID_COLOR) },
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
            // Same reasoning as Terrain.tsx, including the length check: the
            // attribute normals are all straight up and would light this as
            // glass, and an unguarded normalize() of a degenerate cross product
            // emits NaN into the frame.
            vec3 dpx = dFdx(vWorld), dpy = dFdy(vWorld);
            vec3 cr = cross(dpx, dpy);
            float crl = length(cr);
            vec3 n = crl > 1e-9 ? cr / crl : vec3(0.0, 1.0, 0.0);
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
            col += vec3(0.58, 0.68, 0.82) * pow(clamp(dot(n, h), 0.0, 1.0), 220.0) * 0.7;

            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

/**
 * ACT III — THE THRESHOLD (§5 Act III).
 *
 * The placeholder box massing is gone. It was a 18x6.4x13m primitive sitting on
 * open ground with nothing around it, and from every camera position in Act III
 * that is exactly what it looked like: a black cube floating in space. A stand-in
 * that reads as a stand-in is worse than no stand-in, because it is the frame the
 * client actually sees.
 *
 * What replaces it is the only object this act structurally needs: THE GLASS.
 * §5 makes the pane, not the building, the master variable — the act is driven by
 * "the signed distance from camera to glass plane", and the breach is the moment
 * the story crosses from the plot you buy to the house you build on it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DISSOLVE — via onBeforeCompile, and NEVER by moving camera.near
 *
 * §5: "never touch camera.near". Pulling the near plane in to avoid clipping
 * wrecks depth precision for the entire scene, and it does so globally to solve
 * one local problem.
 *
 * Instead the pane phases out of existence as the camera arrives. Opacity and
 * alpha both fall to zero via smoothstep on the SIGNED distance along the pane's
 * own normal, so the glass is gone before the near plane can ever intersect it.
 *
 * Two details that are easy to get wrong:
 *
 *   worldPosition comes from the VERTEX stage. MeshPhysicalMaterial does not
 *   hand the fragment shader a world position, so the vertex chunk has to
 *   compute and pass one. Without it there is nothing to measure distance from.
 *
 *   The distance is SIGNED, not absolute. An absolute distance dissolves the
 *   pane symmetrically and it fades back IN once the camera is inside, which
 *   puts a sheet of glass behind the viewer in the interior.
 *
 * A brief luminance veil rides the same signed distance — the 120-180ms optical
 * spike §5 asks for, masking the geometric penetration.
 */
function Threshold() {
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  const uniforms = useRef({ uBreach: { value: 0 } });

  const onBeforeCompile = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uBreach = uniforms.current.uBreach;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vThresholdWorld;`,
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vThresholdWorld = (modelMatrix * vec4(position, 1.0)).xyz;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uBreach;
           varying vec3 vThresholdWorld;`,
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>

           // SIGNED distance along the pane's normal (+Z in its local frame,
           // and the group is unrotated). Positive = camera still outside.
           float sd = cameraPosition.z - vThresholdWorld.z;

           // Phase out across the last 1.6m of approach, and STAY out. The
           // second term is what stops the pane re-forming behind the viewer.
           float present = smoothstep(0.0, 1.6, sd);

           // The optical veil: a short luminance spike right at contact, which
           // is what actually sells the crossing. It rides the same signed
           // distance so it cannot desynchronise from the dissolve.
           float veil = exp(-pow(sd / 0.42, 2.0)) * 0.9;
           gl_FragColor.rgb += vec3(0.42, 0.52, 0.66) * veil;

           gl_FragColor.a *= present;
           if (gl_FragColor.a < 0.004) discard;`,
        );
    },
    [],
  );

  // Scale: this is an architectural elevation, not a window. It spans the whole
  // viewport at the breach so the camera cannot travel around it, which is the
  // other half of never needing to touch camera.near.
  return (
    <group position={[0, 0, -14]}>
      <mesh position={[0, 5.4, 6.55]}>
        <planeGeometry args={[52, 15]} />
        <meshPhysicalMaterial
          ref={mat}
          onBeforeCompile={onBeforeCompile}
          color="#0A0F16"
          roughness={0.045}
          metalness={0}
          transmission={0.9}
          thickness={0.35}
          ior={1.46}
          transparent
          side={THREE.DoubleSide}
          // The dissolve writes alpha per fragment; depth writing would leave a
          // hole punched in the buffer where a fully transparent fragment used
          // to be, and the interior would render through it in bands.
          depthWrite={false}
        />
      </mesh>

      {/* Mullions. Three hairlines are what makes a transparent plane read as
          architecture rather than as a post-processing artefact — without them
          the glass is invisible until it distorts something. */}
      {[-17, 0, 17].map((x) => (
        <mesh key={x} position={[x, 5.4, 6.56]}>
          <boxGeometry args={[0.16, 15, 0.16]} />
          <meshStandardMaterial color="#0D1016" roughness={0.7} metalness={0.1} />
        </mesh>
      ))}
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
      <Massing />
      <Water />
      <Threshold />

      {/* LIGHT BUDGET — four, hard cap (L8).
          1: the dusk key, low and west, matching both shaders' uSunDir.
          2: cool sky fill so shadowed faces separate without lifting toward
             the key's colour.
          3–4: interior practicals, only above tier C. */}
      <directionalLight position={[-820, 160, -340]} intensity={1.2} color="#93A7C4" />
      <hemisphereLight args={['#232C46', '#0A0A0E', 0.42]} />

      {budget.maxLights >= 3 && (
        <pointLight position={[0, 2.6, -12]} intensity={14} distance={22} decay={2} color={PRACTICAL_2700K} />
      )}
      {budget.maxLights >= 4 && (
        <pointLight position={[-5, 2.2, -18]} intensity={10} distance={18} decay={2} color={PRACTICAL_2700K} />
      )}
    </>
  );
}
