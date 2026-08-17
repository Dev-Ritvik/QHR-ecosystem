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
const FLAT_RADIUS = 34;
const FLAT_FEATHER = 26;

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
    float steps = 0.85;
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
  varying float vHeight;
  varying vec3 vWorld;

  void main() {
    // Normals from screen-space derivatives rather than a normal attribute.
    // The displacement happens in the vertex shader, so the geometry's own
    // normals all still point straight up and would light this as a flat plane.
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));

    // Weathered limestone: paler on the exposed bedding planes, darker in the
    // dissolution channels where water sits and vegetation takes hold.
    float exposure = clamp(vHeight / 9.0, 0.0, 1.0);
    vec3 albedo = mix(uLow, uHigh, exposure);

    // Single directional term matching the scene's warm key, kept deliberately
    // dim: this is ground at night, and it must sit UNDER the building rather
    // than compete with it.
    vec3 sun = normalize(vec3(-0.55, 0.62, 0.56));
    float lambert = clamp(dot(n, sun), 0.0, 1.0);
    vec3 col = albedo * (0.16 + lambert * 0.34);

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
      uHeight: { value: 11.0 },
      uLow: { value: new THREE.Color('#141A22') },
      uHigh: { value: new THREE.Color('#3A3B33') },
      uFog: { value: new THREE.Color('#0A1120') },
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
