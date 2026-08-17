'use client';

// apps/public/src/components/experience/Terrain.tsx
//
// Karst ground, displaced on the GPU.
//
// Replaces the flat 450m plane the building was standing on. The brief is
// specific and regional: weathered limestone karst of the kind around the Borra
// Caves in the Ananthagiri hills — NOT desert canyon, which is the reference
// site's own landscape and belongs to their brand rather than this one.
//
// WHY THIS IS A SHADER AND NOT A BLENDER RE-EXPORT
//
// Displacement needs vertices to displace, and the exported ground_plane is
// effectively two triangles. Getting relief out of it in Blender means
// subdividing to ~65k verts, sculpting, re-baking the lightmap and re-exporting
// a model that is already 2.3MB. Here the same relief costs one PlaneGeometry
// built at runtime and zero bytes over the wire, and the shape can be tuned by
// changing a number instead of by a twenty-minute export.
//
// The GLB's own ground_plane is hidden by ExteriorModel when this mounts.
//
// KARST, SPECIFICALLY
//
// Karst is not dunes. Its signature is flat-topped limestone blocks separated
// by deep, near-vertical dissolution channels — so the height function is a
// TERRACED ridge field, not smooth fBm. `floor()` on the accumulated ridge is
// what produces the bedding planes; without it this reads as generic hills.
//
// The building sits on a level apron: the mansion, fountain and forecourt need
// flat ground under them or the geometry intersects the terrain. `uFlat` is a
// smooth mask around the origin that holds displacement at zero there and
// blends outward, so the relief starts beyond the hedging and never pushes
// through the entry steps.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScrollProgress } from './useScrollProgress';
import { atmosphereAt } from './cameraPath';

/** Metres. Wide enough to reach the fog's far plane at every point on the
 *  camera path, so the terrain never ends visibly. */
const SIZE = 460;

/** Vertices per side. 320 gives ~1.4m between samples — fine enough that the
 *  terraces read as edges rather than as stairs at the distances the camera
 *  actually stands, and 102k verts is a single static upload. */
const SEGMENTS = 320;

/** Radius of the level apron under the building, and the distance over which
 *  the terrain blends up to full height beyond it. */
// BUG THIS FIXES: 34 + 26 meant full relief only began 60m from the origin,
// but the camera orbits at radius 13-30 looking AT the origin — so every metre
// of ground in frame was inside the flat apron. The karst existed and was
// entirely off screen. Building is +/-9.55, hedges +/-15.9, fountain reaches
// z 16.3, so the apron only needs to clear ~20m.
const FLAT_RADIUS = 20;
const FLAT_FEATHER = 14;

const VERT = /* glsl */ `
  uniform float uFlatRadius;
  uniform float uFlatFeather;
  uniform float uHeight;
  varying float vHeight;
  varying vec2 vUvW;
  varying vec3 vWorld;

  // Cheap value noise. Karst wants hard edges, and those come from the terrace
  // step below rather than from the noise itself, so gradient noise would cost
  // more for a difference this geometry cannot show.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Ridged multifractal: 1 - |noise| sharpens each octave into a crest, which
  // is what gives limestone its blade-like fins rather than rounded dunes.
  float ridge(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 5; i++) {
      float n = noise(p * freq);
      n = 1.0 - abs(n * 2.0 - 1.0);
      n *= n;
      sum += n * amp;
      freq *= 2.03;
      amp *= 0.47;
    }
    return sum;
  }

  void main() {
    vec3 p = position;

    // Plane is built in XY and rotated to XZ by the mesh, so displacement is
    // along local +Z here.
    vec2 w = p.xy;
    float d = length(w);

    float r = ridge(w * 0.012);

    // THE TERRACES. Quantising the ridge into 0.85m bands is the whole karst
    // signature: flat bedding planes with sharp risers between them. The
    // fractional remainder is added back at low weight so the tops are not
    // perfectly level, which would read as CAD rather than as rock.
    // BUG THIS FIXES: steps was 0.85 while ridge() sums to a maximum of ~0.92,
    // so floor(r / steps) only ever returned 0 or 1. The terrain had exactly
    // TWO elevations and rendered as a flat disc. The step has to be small
    // relative to the ridge's range or there are no terraces to see.
    float steps = 0.11;
    float terraced = floor(r / steps) * steps + fract(r / steps) * steps * 0.22;

    // Level apron under the building.
    float flat = smoothstep(uFlatRadius, uFlatRadius + uFlatFeather, d);

    float h = terraced * uHeight * flat;
    p.z += h;

    vHeight = h;
    vUvW = w;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uLow;
  uniform vec3 uHigh;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uSunDir;
  varying float vHeight;
  varying vec3 vWorld;

  void main() {
    // Face normals from screen-space derivatives of the DISPLACED world
    // position. The geometry's own normal attribute all points straight up —
    // displacement happens in the vertex shader and never touches it — so
    // without this the lighting engine shades the terraces as a flat plane no
    // matter how much relief the vertices actually have.
    //
    // The cross product's sign depends on which way the triangle winds on
    // screen, which flips depending on the viewing angle, so the result is
    // forced to point upward. Getting this wrong lights the terrain from
    // underneath, which reads as flat in a different way.
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (n.y < 0.0) n = -n;

    // Weathered limestone: paler on the exposed bedding planes, darker in the
    // dissolution channels where water sits and vegetation takes hold.
    float exposure = clamp(vHeight / 9.0, 0.0, 1.0);
    vec3 albedo = mix(uLow, uHigh, exposure);

    // Key direction comes in as a uniform rather than being hardcoded. It was
    // baked in as (-0.55, 0.62, 0.56) — the OLD sun position — so after the key
    // was relocated the ground was being lit from a direction the scene no
    // longer had a light in. The terrain and the building must agree about
    // where the sun is or neither reads as solid.
    float lambert = clamp(dot(n, uSunDir), 0.0, 1.0);

    // Wrapped term so the faces turned away from the key still separate from
    // each other instead of crushing to one flat shadow value — this is what
    // makes the terrace risers legible on the unlit side.
    float wrap = clamp(dot(n, uSunDir) * 0.5 + 0.5, 0.0, 1.0);

    // A hard rim on the near-vertical risers. Karst reads as rock because the
    // bedding planes catch light and the risers between them do not, so the
    // slope itself is worth shading on.
    float slope = 1.0 - clamp(n.y, 0.0, 1.0);

    // The key is nearly horizontal (elevation 15 against an 80m throw), so
    // upward-facing ground receives a lambert of only ~0.17. Lighting the
    // terrain on lambert alone therefore produced a near-black plane no matter
    // how much relief it had. The wrap term carries the base illumination and
    // lambert supplies the raking contrast on the slopes facing the sun —
    // which is exactly where a low sun SHOULD be creating the terrace edges.
    vec3 col = albedo * (0.20 + wrap * 0.55 + lambert * 0.95);

    // Risers catch a warm edge from the same low sun. This is the line that
    // makes a terrace read as a step rather than as a tonal gradient.
    col += vec3(0.55, 0.42, 0.30) * slope * lambert * 0.85;

    // Fog matched to the scene's own THREE.Fog so the terrain dissolves into
    // the same navy at the same distance. Without this the ground would run to
    // a hard visible edge while everything else faded.
    float depth = length(vWorld - cameraPosition);
    float f = smoothstep(uFogNear, uFogFar, depth);
    gl_FragColor = vec4(mix(col, uFog, f), 1.0);
  }
`;

export function Terrain({ driveByScroll = true }: { driveByScroll?: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const scroll = useScrollProgress();

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS),
    [],
  );

  const uniforms = useMemo(
    () => ({
      uFlatRadius: { value: FLAT_RADIUS },
      uFlatFeather: { value: FLAT_FEATHER },
      // Exposed scalar, raised from 11. The height field was never the problem
      // (measured: 8.72m of range and 537 distinct terrace levels across the
      // visible annulus) — it was invisible because the SHADING crushed it to
      // ~3% luminance. Both are addressed: more relief, and enough light on it
      // to see the relief that was always there.
      uHeight: { value: 30.0 },
      // Was #141A22 / #3A3B33 — around 0.10 luminance. Multiplied by the
      // lighting term below that landed at 0.027, i.e. black. Limestone is a
      // PALE rock; these are lifted to where the terraces can actually read
      // against the #0A1120 sky.
      uLow: { value: new THREE.Color('#2E3440') },
      uHigh: { value: new THREE.Color('#8A8778') },
      uFog: { value: new THREE.Color('#0A1120') },
      // Normalised direction TO the key light at (30, 15, -80). Must be kept
      // in step with the directionalLight in WorldCanvas.
      uSunDir: { value: new THREE.Vector3(30, 15, -80).normalize() },
      uFogNear: { value: 34 },
      uFogFar: { value: 190 },
    }),
    [],
  );

  // Fog travels with the camera along the path, so the terrain has to follow it
  // or the ground and the building would fade at different distances.
  useFrame(() => {
    if (!mat.current || !driveByScroll) return;
    // Read the SAME atmosphere function the scene fog uses, so the ground and
    // the building fade at identical distances. Taking fog as a static prop
    // would have pinned the terrain to the hero's 34..190 while the scene
    // closed to 14..95 under the portico, and the ground would have stayed
    // visible past the point everything else had dissolved.
    const a = atmosphereAt(scroll.current);
    mat.current.uniforms.uFogNear.value = a.near;
    mat.current.uniforms.uFogFar.value = a.far;
  });

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.02, 0]}
      frustumCulled={false}
      receiveShadow={false}
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
