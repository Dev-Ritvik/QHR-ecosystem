'use client';

// apps/monolith/src/components/experience/Terrain.tsx
//
// The corridor floor — MASTER_SPEC §1, §5 Acts I–II.
//
// This is the Visakhapatnam–Vizianagaram–Srikakulam belt in the abstract: the
// Eastern Ghats falling away to the west, the coastal plain, the sea to the
// east, the NH-16 spine running north–south through it, and Bhogapuram's runway
// north-east of the parcel. Not a literal DEM — a reading of the ground the
// company builds on.
//
// Everything here is procedural. No heightmap texture, no HDRI, no splat maps,
// and — the point of this file — NO GEOMETRY for any of the infrastructure.
// That is a payload decision (§9.2, < 2MB total media) and a Developer Award
// decision: a jury can be shown that the entire landscape is arithmetic.
//
// FOUR THINGS THIS SHADER OWNS THAT WOULD OTHERWISE COST DRAW CALLS
//
//   1. AERIAL PERSPECTIVE. A single global FogExp2 density cannot serve both a
//      6m void at q=0 and a 691m vista at q=0.18. So the long-range haze that
//      sells landscape scale lives here, as a distance+height term with its own
//      curve, and scene.fog is left to do only what it is good at.
//
//   2. THE NH-16 SPINE. Carriageways, median, edge lines, lane dashes and lamp
//      rows, all as a distance field from an analytic curve. As geometry this
//      is a ribbon mesh of several thousand triangles plus a lamp instance
//      buffer; here it is zero of both.
//
//   3. BHOGAPURAM. Runway, apron, centreline dashes, threshold bars and the
//      approach-light rows — one rotated rectangle's worth of arithmetic.
//
//   4. THE PLOTTING GRID. Survey lines rise out of the ground during Act II —
//      §1④. 189 plot boundaries at zero draw calls and zero vertices. This is
//      the single most product-honest frame in the build: the moment the land
//      becomes sellable in the viewer's mind.
//
// ON COLOUR: every value below is on the cold side of neutral, including the
// plotting grid, which used to be drawn amber. §5 Act III allows warmth only as
// "warm pools with falloff" from the 2700 K practicals inside the villa, and
// src/lib/grade.ts builds its two-tint highlight logic on the grid being cool.
// Enforced by scripts/grade-check.mjs.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { subscribe } from '@/lib/ticker';
import { continuityAt } from '@/lib/continuity';
import { useSceneStore } from '@/state/sceneStore';
import { VOID_COLOR } from '@/lib/grade';

const SIZE = 4200;

/** Vertices per side, by tier. The heightfield is a static upload — cost is
 *  memory and one-time transfer, not per-frame — but 400² on a mid phone is
 *  still 160k verts of vertex shader every frame. */
const SEGMENTS: Record<string, number> = { A: 420, B: 320, C: 200, D: 0 };

/**
 * Shared between the vertex and fragment stages.
 *
 * The two MUST agree on where the road and the runway are: the vertex stage
 * grades the ground under them, the fragment stage paints them. If these
 * drifted apart the highway would be painted onto terrain levelled somewhere
 * else — a ribbon climbing a ridge it should have been cut through, which is
 * the clearest possible tell that a road was decal-ed on rather than built.
 *
 * Putting hash/noise here also removes the copy that used to exist in both
 * stages.
 */
const GEO = /* glsl */ `
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

  // NH-16 / AH-16: its easting as a function of northing. A trunk road meanders
  // around terrain rather than running true, and a dead-straight line from the
  // air is the fastest way to read as a wireframe instead of a map.
  float spineX(float z) {
    return 430.0 + sin(z * 0.00085) * 205.0 + sin(z * 0.00210 + 1.7) * 72.0;
  }

  // Bhogapuram, north-east of the parcel, aligned off-axis so it reads as
  // surveyed rather than snapped to the world grid.
  vec2 runwayLocal(vec2 w) {
    vec2 rp = w - vec2(640.0, -1010.0);
    float ca = cos(0.34), sa = sin(0.34);
    return vec2(rp.x * ca + rp.y * sa, -rp.x * sa + rp.y * ca);
  }

  float runwayPad(vec2 w) {
    vec2 r = runwayLocal(w);
    return (1.0 - smoothstep(150.0, 215.0, abs(r.y)))
         * (1.0 - smoothstep(520.0, 585.0, abs(r.x)));
  }
`;

const VERT = GEO + /* glsl */ `
  varying vec3 vWorld;
  varying float vHeight;
  varying float vShore;

  void main() {
    vec3 p = position;

    // WORLD XZ FROM PLANE-LOCAL COORDS. The mesh is rotated -PI/2 about X, so
    // local (x, y, z) maps to world (x, z, -y): local +y runs to world -z, and
    // the local z we displace along is world height.
    vec2 w = vec2(p.x, -p.y);

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

    // A HIGHWAY IS GRADED BEFORE IT IS LAID. Flatten the corridor it runs
    // through — see the note on GEO above.
    float bed = 1.0 - smoothstep(34.0, 108.0, abs(w.x - spineX(w.y)));
    h = mix(h, h * 0.16 + 1.5, bed * 0.92 * (1.0 - coast));

    // The apron is levelled harder still. An airfield is the flattest thing in
    // any landscape, and that flatness is most of how it reads from the air.
    h = mix(h, 5.0, runwayPad(w) * 0.96 * (1.0 - coast));

    p.z += h;

    vHeight = h;
    vShore = coast;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = GEO + /* glsl */ `
  uniform vec3 uSky;
  uniform vec3 uSun;
  uniform float uGrid;
  uniform float uHaze;        // aerial-perspective strength, driven by q
  uniform float uInfra;       // 0..1, infrastructure reveal across the descent
  varying vec3 vWorld;
  varying float vHeight;
  varying float vShore;

  void main() {
    // NORMALS FROM SCREEN-SPACE DERIVATIVES OF THE DISPLACED WORLD POSITION.
    // The geometry's own normal attribute still points straight up —
    // displacement happens in the vertex stage and never touches it — so
    // without this the whole landscape shades as a flat plane no matter how
    // much relief it has.
    //
    // THE CROSS PRODUCT MUST BE LENGTH-CHECKED BEFORE NORMALISING. Where two
    // adjacent fragments land on the same world position — a silhouette edge,
    // a fully levelled pad, the far plane at a grazing angle — the cross
    // product is the zero vector and normalize() returns NaN. That NaN
    // propagates through lambert into col, survives the composer, and lands as
    // an arbitrary colour: measured at 8,666 spurious warm pixels and 429
    // green ones in a single Act I frame, which read as exactly the stray
    // warmth §5 forbids. The sign flips with triangle winding, hence forced up.
    vec3 dpx = dFdx(vWorld), dpy = dFdy(vWorld);
    vec3 cr = cross(dpx, dpy);
    float crl = length(cr);
    vec3 n = crl > 1e-9 ? cr / crl : vec3(0.0, 1.0, 0.0);
    if (n.y < 0.0) n = -n;

    float lambert = clamp(dot(n, normalize(uSun)), 0.0, 1.0);

    // Ground palette. Cold: this is the coastal belt an hour after sunset, lit
    // by sky rather than by sun. It used to be warm laterite red-brown, which
    // put a warm cast across the largest surface in the build.
    vec3 plain = vec3(0.095, 0.100, 0.115);
    vec3 rock  = vec3(0.072, 0.077, 0.089);
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
    //
    // THE AMBIENT TERM IS THE REASON ACT I READS AT ALL. It was 0.16 + 0.44,
    // and at that level raising the sensor did nothing useful: measured across
    // the descent, more exposure lifted the ceiling (bright spread 15 -> 57)
    // while the mean stayed at 23 and 88-99% of the frame sat in a single
    // perceptual band. The frame was not underexposed, it was FLAT — the ground
    // was returning almost no light to lift.
    //
    // An hour after sunset the dominant source is the whole sky dome, not the
    // sun, so a large ambient with a small directional is also the physically
    // honest reading of this hour. lambert is left alone: it is what still
    // separates a west-facing slope from an east-facing one.
    float wrap = clamp(dot(n, normalize(uSun)) * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = albedo * (0.34 + wrap * 0.68 + lambert * 0.85);

    vec2 W = vWorld.xz;
    float land = 1.0 - vShore;

    // POINT FEATURES MUST FADE WITH DISTANCE. A lamp head is well under one
    // pixel at a kilometre, and an un-attenuated sub-pixel highlight does not
    // sit still: it scintillates on every camera move and picks up a green /
    // magenta fringe from the chromatic aberration pass. Measured at 455 fringe
    // pixels around the approach lights before this was added.
    float pointFade = 1.0 - smoothstep(420.0, 1400.0, length(vWorld - cameraPosition));

    // ── THE NH-16 SPINE ────────────────────────────────────────────────────
    // A distance field from spineX(). Blacktop either side of a median: six
    // lanes, which is what the six-laning of this stretch actually built.
    float dRoad = abs(W.x - spineX(W.y));
    float carriage = (1.0 - smoothstep(11.5, 13.5, dRoad)) * land * uInfra;
    float median = 1.0 - smoothstep(1.4, 2.4, dRoad);
    carriage *= 1.0 - median * 0.88;
    col = mix(col, vec3(0.028, 0.030, 0.036), carriage * 0.94);

    // Edge lines continuous, lane lines dashed. The dash pitch is what tells
    // the eye how fast it is travelling when the camera moves along the road.
    float edge = 1.0 - smoothstep(0.0, 0.8, abs(dRoad - 11.2));
    float dash = step(0.52, fract(W.y / 26.0));
    float lane = (1.0 - smoothstep(0.0, 0.55, abs(dRoad - 6.4))) * dash;
    col += vec3(0.50, 0.57, 0.66) * (edge * 0.55 + lane * 0.30) * carriage;

    // Lamp rows on both shoulders. PALE, not sodium: §5 keeps every warm source
    // inside the villa, and at this distance the reference frames show these as
    // small cool points regardless.
    float lampRow = 1.0 - smoothstep(0.0, 1.2, abs(dRoad - 13.4));
    float lampTick = smoothstep(0.962, 1.0, fract(W.y / 62.0));
    col += vec3(0.56, 0.64, 0.78) * lampRow * lampTick * land * uInfra * pointFade * 1.15;

    // ── SECONDARY NETWORK ──────────────────────────────────────────────────
    // District roads across the plain. Thin and dim — they exist to make the
    // ground read as occupied, not to be looked at.
    vec2 sc = W / vec2(268.0, 331.0);
    vec2 sg = abs(fract(sc) - 0.5);
    float minor = 1.0 - smoothstep(0.0, 0.0065, min(sg.x, sg.y));
    minor *= land * uInfra * (1.0 - smoothstep(520.0, 940.0, abs(W.x - 100.0)));
    col += vec3(0.085, 0.098, 0.120) * minor * 0.7;

    // ── BHOGAPURAM ─────────────────────────────────────────────────────────
    vec2 rl = runwayLocal(W);
    float apron = runwayPad(W) * land * uInfra;
    col = mix(col, vec3(0.050, 0.054, 0.063), apron * 0.75);

    float strip = (1.0 - smoothstep(20.0, 23.0, abs(rl.y)))
                * (1.0 - smoothstep(468.0, 486.0, abs(rl.x))) * land * uInfra;
    col = mix(col, vec3(0.034, 0.037, 0.044), strip);

    float centre = (1.0 - smoothstep(0.0, 0.7, abs(rl.y)))
                 * step(0.5, fract(rl.x / 44.0)) * strip;
    float thresh = (1.0 - smoothstep(0.0, 1.6, abs(abs(rl.x) - 458.0)))
                 * (1.0 - smoothstep(14.0, 18.0, abs(rl.y))) * land * uInfra;
    col += vec3(0.58, 0.66, 0.80) * (centre * 0.55 + thresh * 0.7);

    // Approach lighting, running out past each threshold.
    float appr = (1.0 - smoothstep(0.0, 1.8, abs(rl.y)))
               * smoothstep(0.90, 1.0, fract(rl.x / 58.0))
               * smoothstep(470.0, 480.0, abs(rl.x))
               * (1.0 - smoothstep(660.0, 700.0, abs(rl.x))) * land * uInfra;
    col += vec3(0.54, 0.63, 0.78) * appr * pointFade * 0.85;

    // ── SURF ───────────────────────────────────────────────────────────────
    // The coastline needs an edge, or the sea reads as a flat colour swap.
    float surf = 1.0 - smoothstep(0.0, 0.055, abs(vShore - 0.5));
    col += vec3(0.26, 0.32, 0.40) * surf * 0.38;

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
    col += vec3(0.62, 0.72, 0.84) * grid * 0.55;

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
      uInfra: { value: 0 },
      uSky: { value: new THREE.Color(VOID_COLOR) },
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

      // INFRASTRUCTURE RESOLVES DURING THE DESCENT. §5 opens Act I on a void
      // and withholds scale until q 0.10 — a highway legible in frame one
      // hands over the scale the descent exists to reveal. So the road, the
      // runway and the district network fade up across the punch, arriving as
      // the ground becomes readable rather than being switched on.
      u.uInfra.value = THREE.MathUtils.smoothstep(q, 0.045, 0.16);

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
