'use client';

// apps/monolith/src/components/experience/Terrain.tsx
//
// The corridor floor — MASTER_SPEC §1, §5 Acts I–II.
//
// This is the Visakhapatnam–Vizianagaram–Srikakulam belt in the abstract: the
// Eastern Ghats falling away to the west, the coastal plain, the sea to the
// east. Not a literal DEM — a reading of the ground the company builds on.
//
// Everything here is procedural. No heightmap texture, no HDRI, no splat maps.
// That is a payload decision (§9.2, < 2MB total media) and a Developer Award
// decision: a jury can be shown that the entire landscape is arithmetic.
//
// TWO THINGS THIS SHADER OWNS THAT scene.fog CANNOT
//
//   1. AERIAL PERSPECTIVE. A single global FogExp2 density cannot serve both a
//      6m void at q=0 and a 691m vista at q=0.18 — measured, see
//      scripts/fog-check.mjs. So the long-range haze that sells landscape scale
//      lives here, as a distance+height term with its own curve, and
//      scene.fog is left to do only what it is good at.
//
//   2. THE PLOTTING GRID. Survey lines rise out of the ground during Act II —
//      §1④. They are drawn in the fragment shader, not built as geometry, so
//      189 plot boundaries cost zero draw calls and zero vertices. This is the
//      single most product-honest frame in the build: the moment the land
//      becomes sellable in the viewer's mind.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { subscribe } from '@/lib/ticker';
import { continuityAt } from '@/lib/continuity';
import { useSceneStore } from '@/state/sceneStore';

const SIZE = 4200;

/** Vertices per side, by tier. The heightfield is a static upload — cost is
 *  memory and one-time transfer, not per-frame — but 400² on a mid phone is
 *  still 160k verts of vertex shader every frame. */
const SEGMENTS: Record<string, number> = { A: 420, B: 320, C: 200, D: 0 };

const VERT = /* glsl */ `
  uniform float uGrid;        // 0..1, Act II plotting-grid reveal
  varying vec3 vWorld;
  varying float vHeight;
  varying float vShore;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
  }

  // Ridged multifractal — the Eastern Ghats read as blades, not dunes.
  float ridge(vec2 p) {
    float s = 0.0, a = 0.5, f = 1.0;
    for (int i = 0; i < 5; i++) {
      float n = noise(p * f);
      n = 1.0 - abs(n * 2.0 - 1.0);
      s += n * n * a;
      f *= 2.07;
      a *= 0.46;
    }
    return s;
  }

  void main() {
    vec3 p = position;
    vec2 w = p.xy;

    // The coast runs roughly north-south at x = +900. East of it is sea, west
    // is plain, further west the ghats rise. Everything is expressed as a
    // function of x so the corridor has a legible geography from the air.
    float coast = smoothstep(700.0, 1050.0, w.x);          // 0 inland, 1 sea
    float hills = smoothstep(-250.0, -1400.0, w.x);        // 0 plain, 1 ghats

    float relief = ridge(w * 0.0016) * 260.0 * hills;

    // The plain is not flat — low undulation keeps it from reading as a table.
    float plain = (noise(w * 0.0032) - 0.5) * 14.0 * (1.0 - coast) * (1.0 - hills);

    // The parcel itself is levelled. A layout is graded before it is sold, and
    // geometry has to sit on it without intersecting.
    float parcel = 1.0 - smoothstep(180.0, 420.0, length(w));

    float h = mix(relief + plain, 0.0, parcel);
    h = mix(h, -18.0, coast);                               // seabed

    p.z += h;

    vHeight = h;
    vShore = coast;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uSky;
  uniform vec3 uSun;
  uniform float uGrid;
  uniform float uHaze;        // aerial-perspective strength, driven by q
  varying vec3 vWorld;
  varying float vHeight;
  varying float vShore;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
  }

  void main() {
    // Face normals from screen-space derivatives of the DISPLACED world
    // position. The geometry's own normal attribute still points straight up —
    // displacement happens in the vertex stage and never touches it — so
    // without this the whole landscape shades as a flat plane no matter how
    // much relief it has. The sign flips with triangle winding, hence the
    // forced up.
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (n.y < 0.0) n = -n;

    float lambert = clamp(dot(n, normalize(uSun)), 0.0, 1.0);

    // Ground palette: dry laterite red-brown on the plain, darker rock on the
    // slopes, near-black water east of the coast.
    vec3 plain = vec3(0.106, 0.086, 0.070);
    vec3 rock  = vec3(0.070, 0.066, 0.062);
    vec3 sea   = vec3(0.016, 0.024, 0.034);

    float slope = 1.0 - clamp(n.y, 0.0, 1.0);
    vec3 albedo = mix(plain, rock, smoothstep(0.05, 0.45, slope));
    albedo = mix(albedo, sea, vShore);

    // Micro-surface, so light does not smear across a mathematically smooth
    // plane. Two octaves at metre scale.
    float micro = noise(vWorld.xz * 0.9) * 0.6 + noise(vWorld.xz * 3.7) * 0.4;
    albedo *= 0.82 + micro * 0.36;

    // The key is near the horizon, so upward faces receive very little direct
    // light. A wrapped term carries base illumination and lambert supplies the
    // raking contrast on slopes facing the sun.
    float wrap = clamp(dot(n, normalize(uSun)) * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = albedo * (0.16 + wrap * 0.44 + lambert * 0.85);

    // ── THE PLOTTING GRID ──────────────────────────────────────────────────
    // Survey lines, drawn not built. 30x50 ft plots on 40 ft roads, in metres:
    // roughly 9.1 x 15.2 with 12.2 m carriageways. The reveal sweeps outward
    // from the parcel centre so the layout appears to be surveyed in front of
    // the viewer rather than switched on.
    float ring = length(vWorld.xz);
    float within = 1.0 - smoothstep(150.0, 340.0, ring);
    float sweep = smoothstep(0.0, 1.0, uGrid * 1.35 - ring / 340.0);

    vec2 cell = vWorld.xz / vec2(9.14, 15.24);
    vec2 g = abs(fract(cell) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.03, min(g.x, g.y));

    // Road grid at a coarser pitch, brighter — the 40 ft blacktop.
    vec2 rcell = vWorld.xz / vec2(91.4, 76.2);
    vec2 rg = abs(fract(rcell) - 0.5);
    float road = 1.0 - smoothstep(0.0, 0.012, min(rg.x, rg.y));

    float grid = clamp(line * 0.55 + road * 1.0, 0.0, 1.0) * within * sweep;
    col += vec3(0.78, 0.50, 0.24) * grid * 0.55;

    // ── AERIAL PERSPECTIVE ─────────────────────────────────────────────────
    // The long-range haze scene.fog cannot provide at this scale. Height-aware:
    // the air column is denser near the ground, so low terrain fades before
    // ridge tops do — which is what makes distant hills read as distant.
    float d = length(vWorld - cameraPosition);
    float lowAir = 1.0 - clamp(vHeight / 240.0, 0.0, 1.0);
    float haze = 1.0 - exp(-pow(d * 0.00042 * uHaze * (0.55 + lowAir * 0.85), 2.0));

    gl_FragColor = vec4(mix(col, uSky, clamp(haze, 0.0, 1.0)), 1.0);
  }
`;

export function Terrain() {
  const tier = useSceneStore((s) => s.tier);
  const mat = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const seg = SEGMENTS[tier] ?? 200;
    return new THREE.PlaneGeometry(SIZE, SIZE, seg, seg);
  }, [tier]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uGrid: { value: 0 },
      uHaze: { value: 1 },
      uSky: { value: new THREE.Color('#12131a') },
      // Dusk: low and to the west, behind the ghats. The whole scene is lit
      // near-horizontally, which is why the shader leans on the wrap term.
      uSun: { value: new THREE.Vector3(-0.82, 0.16, -0.34).normalize() },
    }),
    [],
  );

  useEffect(() => {
    return subscribe((q) => {
      if (!mat.current) return;
      const u = mat.current.uniforms;

      // The grid reveals across Act II — §1④. Held at zero through Act I so
      // the corridor reads as land before it reads as inventory.
      u.uGrid.value = THREE.MathUtils.clamp((q - 0.26) / 0.20, 0, 1);

      // Haze tracks the same descent as scene.fog but on its own curve, tuned
      // for the long view rather than the near one.
      const c = continuityAt(q);
      u.uHaze.value = 0.35 + Math.min(1, c.fog / 0.0012) * 0.9;
    });
  }, []);

  if (tier === 'D') return null;

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.4, 0]}
      frustumCulled={false}
    >
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
      />
    </mesh>
  );
}
