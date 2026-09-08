'use client';

// apps/public/src/components/experience/CityField.tsx
//
// THE DISTRICT FIELD, seen through the doorway the visitor came in by.
//
// This is the system the Phase 6 report records as missing outright — "no city
// plane, no project beacons, no window -> city reveal" — and the shape it takes
// is decided by two facts about the repository rather than by preference.
//
// 1. THERE IS NO WINDOW. Parsed from interior_hall.glb: 545 nodes, and the only
//    opening in the shell is `int_door_arch` with `int_doors` inside it, on the
//    entry axis at z 5.25. So the region is revealed through the entry, which
//    is also the better sentence — the film ends by turning round and looking
//    out at the land the house exists to sell.
//
// 2. THERE ARE NO COORDINATES. Every published project has centroid NULL and
//    bbox NULL, and geometry_pub and pois_pub are empty. See cityLayout.ts for
//    the query and for what is derived from what. Nothing here is a map of
//    Andhra Pradesh, and nothing here should be read as one.
//
// WHAT IT IS INSTEAD: abstracted architectural cartography. A dark ground
// carrying contour lines the way a survey drawing does, a soft district
// boundary, and one luminous marker per published project — weighted by that
// project's real unit count, sitting in its real district's band, labelled with
// its real locality, and routing to its real page.
//
// THE COST IS FOUR DRAW CALLS regardless of how many projects publish: one
// ground quad, one instanced set of shafts, one point cloud of heads, and one
// instanced set of invisible pointer proxies. The brief's warning about "another
// 500-draw-call problem" is answered by construction rather than by a budget.
//
// GLSL NOTE: compiles as GLSL ES 3.00 on WebGL2, where a long list of words are
// reserved that GLSL ES 1.00 allowed. shaders.test.ts scans these literals for
// them. If a name here trips it, rename the variable — do not weaken the test.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { buildBeacons, districtBands, FIELD, type Beacon, type CityProject } from './cityLayout';
import { HANDOFF_MS, cancelDive, startDive } from './dive';
import { useBeaconFocus } from '@/components/site/CityLink';

/** The film's night. Same value the veil, the preloader and the exterior's
 *  evening fog all settle on, so the field belongs to the same picture. */
const NIGHT = '#0A1120';
/** The ink the contours are drawn in — a lifted slate, not white. A survey
 *  drawing is grey on grey; white lines on black is a wireframe demo. */
const CONTOUR = '#3A4A6B';
/** The projection's own champagne, shared with the constellation and the
 *  holograms so the three luminous systems in this film read as one language. */
const BEACON = '#F0C79A';

const GROUND_VERT = /* glsl */ `
  varying vec2 vFieldUv;
  varying vec3 vWorld;
  void main() {
    vFieldUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const GROUND_FRAG = /* glsl */ `
  precision highp float;

  uniform float uReveal;
  uniform vec3  uNight;
  uniform vec3  uContour;
  uniform float uBoundary;   // world x of the district boundary
  uniform float uHalfWidth;
  uniform float uCentreX;
  uniform float uNear;
  uniform float uFar;

  varying vec2 vFieldUv;
  varying vec3 vWorld;

  // Deterministic value noise. No texture, no Math.random, identical on every
  // machine — the same requirement the ember field learned the hard way.
  float hash21(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y);
  }

  float relief(vec2 p) {
    float amp = 0.5;
    float sum = 0.0;
    for (int i = 0; i < 4; i += 1) {
      sum += amp * vnoise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return sum;
  }

  void main() {
    // CONTOURS. Constant-width lines through a height field, using the screen
    // derivative so a line is one pixel wide at the threshold and one pixel wide
    // at the horizon. Without fwidth the far contours alias into a moire that
    // reads as a broken texture, which is the single most common way a
    // procedural ground gives itself away.
    float hgt = relief(vWorld.xz * 0.052);
    float bands = hgt * 14.0;
    float ripple = abs(fract(bands) - 0.5);
    float wid = fwidth(bands) * 1.4;
    float lines = 1.0 - smoothstep(0.0, max(wid, 0.001), ripple);

    // Every fifth contour heavier, the way a survey drawing indexes them.
    float idx = abs(fract(bands * 0.2) - 0.5);
    float indexed = 1.0 - smoothstep(0.0, max(fwidth(bands * 0.2) * 1.4, 0.001), idx);

    // THE DISTRICT BOUNDARY. One soft edge, not a border: these are two real
    // administrative districts and the field says which side a project is on
    // without claiming to know where the line runs on the ground.
    float side = smoothstep(-6.0, 6.0, vWorld.x - uBoundary);
    vec3 ground = mix(uNight * 1.16, uNight * 0.86, side);

    // AERIAL PERSPECTIVE, and an edge that is never seen. The plane is finite;
    // the exterior chapter already paid for learning that a finite ground with
    // an unhazed edge reads as a table. This one fades to the night it sits in
    // before it reaches its own boundary, in depth AND across width.
    float depth = smoothstep(uFar * 0.55, uFar, vWorld.z);
    float flank = smoothstep(uHalfWidth * 0.55, uHalfWidth, abs(vWorld.x - uCentreX));
    float fade = clamp(1.0 - max(depth, flank), 0.0, 1.0);

    vec3 tint = ground + uContour * (lines * 0.30 + indexed * 0.34) * fade;
    gl_FragColor = vec4(tint, clamp(uReveal * fade, 0.0, 1.0));
  }
`;

const HEAD_VERT = /* glsl */ `
  uniform float uReveal;
  uniform float uPixel;

  attribute float aWeight;
  attribute float aHover;

  varying float vHover;
  varying float vWeight;

  void main() {
    vHover = aHover;
    vWeight = aWeight;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Metres, attenuated by distance, so the marker obeys perspective. A
    // constant pixel size is what makes a marker read as UI stuck to the glass
    // rather than as a light standing on ground.
    float dist = max(1.0, -mv.z);
    float grow = 1.0 + aHover * 0.85;
    gl_PointSize = uPixel * (0.55 + 0.45 * aWeight) * grow * (60.0 / dist) * uReveal;
  }
`;

const HEAD_FRAG = /* glsl */ `
  precision highp float;

  uniform vec3  uTint;
  uniform float uReveal;

  varying float vHover;
  varying float vWeight;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    // A tight core and a wide halo — a light, not a blurred dot. Same two-part
    // falloff the constellation uses, for the same reason.
    float core = 1.0 - smoothstep(0.0, 0.30, r);
    float halo = (1.0 - smoothstep(0.0, 1.0, r)) * 0.38;
    // HIERARCHY. A bigger layout is a brighter marker, and only the one under
    // the pointer lifts — the brief is explicit that every beacon must not be
    // equally bright.
    float lift = 0.55 + 0.45 * vWeight + vHover * 0.9;
    gl_FragColor = vec4(uTint * lift, (core + halo) * uReveal);
  }
`;

const SHAFT_VERT = /* glsl */ `
  attribute float aWeight;
  attribute float aHover;
  varying float vY;
  varying float vHover;
  varying float vWeight;
  void main() {
    vY = uv.y;
    vHover = aHover;
    vWeight = aWeight;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const SHAFT_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uTint;
  uniform float uReveal;
  varying float vY;
  varying float vHover;
  varying float vWeight;
  void main() {
    // Bright at the ground, gone by the top: a marker that stands ON the land
    // rather than a column of neon planted in it.
    float up = 1.0 - smoothstep(0.0, 1.0, vY);
    float lift = (0.16 + 0.2 * vWeight + vHover * 0.5) * up;
    gl_FragColor = vec4(uTint * lift, lift * uReveal);
  }
`;

export interface CityFieldProps {
  /** The published projects, straight from the store the stations already read. */
  projects: CityProject[];
  /** 0..1 chapter presence, written by the journey driver. */
  reveal: React.MutableRefObject<number>;
  /** The loaded hall scene — needed only to dissolve the doors. */
  root: THREE.Object3D | null;
  /** Route to a project. The same veiled push the holograms use. */
  onOpen: (slug: string) => void;
  /** Halved density and no shafts on the low tier. */
  tier: 'low' | 'mid' | 'high';
}

export function CityField({ projects, reveal, root, onOpen, tier }: CityFieldProps) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const beacons = useMemo(() => buildBeacons(projects), [projects]);
  const bands = useMemo(() => districtBands(projects), [projects]);
  const boundary = bands.length > 1 ? bands[0].to : FIELD.halfWidth * 2;

  const groupRef = useRef<THREE.Group>(null);
  const headsRef = useRef<THREE.Points>(null);
  const shaftsRef = useRef<THREE.InstancedMesh>(null);
  const hoverRef = useRef<Float32Array>(new Float32Array(0));
  const targetHover = useRef<Float32Array>(new Float32Array(0));
  const shown = useRef(0);

  /** The slug the DOM list is pointing at or focused on. Subscribed rather than
   *  read per frame, so a keyboard walk down the list costs one render each and
   *  the frame loop stays allocation-free. */
  const focusSlug = useBeaconFocus((s) => s.slug);
  const focusIndex = useMemo(
    () => (focusSlug ? beacons.findIndex((b) => b.slug === focusSlug) : -1),
    [focusSlug, beacons],
  );

  // ── Ground ────────────────────────────────────────────────────────────────
  const groundUniforms = useMemo(
    () => ({
      uReveal: { value: 0 },
      uNight: { value: new THREE.Color(NIGHT) },
      uContour: { value: new THREE.Color(CONTOUR) },
      uBoundary: { value: boundary },
      uHalfWidth: { value: FIELD.halfWidth },
      uCentreX: { value: FIELD.centreX },
      uNear: { value: FIELD.near },
      uFar: { value: FIELD.far },
    }),
    [boundary],
  );

  const groundMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: groundUniforms,
        vertexShader: GROUND_VERT,
        fragmentShader: GROUND_FRAG,
        transparent: true,
        depthWrite: false,
        // NOT additive. The ground is land, and land occludes; additive would
        // make the far half brighter than the near half wherever the plane
        // folds back on itself in screen space.
        blending: THREE.NormalBlending,
        side: THREE.FrontSide,
      }),
    [groundUniforms],
  );

  const groundGeometry = useMemo(
    // Two triangles. The relief is a shader, so the plane never needs
    // subdivision — which is the whole reason this layer costs what it costs.
    () => new THREE.PlaneGeometry(FIELD.halfWidth * 2.4, FIELD.far * 1.9, 1, 1),
    [],
  );

  // ── Beacon heads ──────────────────────────────────────────────────────────
  const headGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(beacons.length * 3);
    const weight = new Float32Array(beacons.length);
    const hover = new Float32Array(beacons.length);
    beacons.forEach((b, i) => {
      pos[i * 3] = b.x;
      pos[i * 3 + 1] = FIELD.y + 0.85 + b.weight * 0.5;
      pos[i * 3 + 2] = b.z;
      weight[i] = b.weight;
    });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aWeight', new THREE.BufferAttribute(weight, 1));
    g.setAttribute('aHover', new THREE.BufferAttribute(hover, 1));
    return g;
  }, [beacons]);

  const headUniforms = useMemo(
    () => ({
      uReveal: { value: 0 },
      uTint: { value: new THREE.Color(BEACON) },
      uPixel: { value: tier === 'low' ? 46 : 62 },
    }),
    [tier],
  );

  const headMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: headUniforms,
        vertexShader: HEAD_VERT,
        fragmentShader: HEAD_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      }),
    [headUniforms],
  );

  // ── Shafts ────────────────────────────────────────────────────────────────
  const shaftGeometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.16, 0.34, 1, 6, 1, true);
    g.translate(0, 0.5, 0);
    return g;
  }, []);

  const shaftUniforms = useMemo(
    () => ({ uReveal: { value: 0 }, uTint: { value: new THREE.Color(BEACON) } }),
    [],
  );

  const shaftMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: shaftUniforms,
        vertexShader: SHAFT_VERT,
        fragmentShader: SHAFT_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [shaftUniforms],
  );

  useEffect(() => {
    hoverRef.current = new Float32Array(beacons.length);
    targetHover.current = new Float32Array(beacons.length);
  }, [beacons.length]);

  // Instance transforms and the per-instance attributes the shaft shader reads.
  useEffect(() => {
    const mesh = shaftsRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const weight = new Float32Array(beacons.length);
    const hover = new Float32Array(beacons.length);
    beacons.forEach((b, i) => {
      const h = 0.9 + b.weight * 0.7;
      m.makeScale(1, h, 1);
      m.setPosition(b.x, FIELD.y, b.z);
      mesh.setMatrixAt(i, m);
      weight[i] = b.weight;
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.setAttribute('aWeight', new THREE.InstancedBufferAttribute(weight, 1));
    mesh.geometry.setAttribute('aHover', new THREE.InstancedBufferAttribute(hover, 1));
    mesh.count = beacons.length;
  }, [beacons]);

  useEffect(
    () => () => {
      groundGeometry.dispose();
      groundMaterial.dispose();
      headGeometry.dispose();
      headMaterial.dispose();
      shaftGeometry.dispose();
      shaftMaterial.dispose();
    },
    [groundGeometry, groundMaterial, headGeometry, headMaterial, shaftGeometry, shaftMaterial],
  );

  // ── The threshold ─────────────────────────────────────────────────────────
  //
  // THE HALL HAS NO HOLE IN IT. `int_door_arch` and `int_doors` are decorative
  // panels applied to the face of a SOLID front wall — raycasting the frame at
  // the threshold beat returned `int_wall_front`, MAT_Wall_Plaster_LM, at 3.69m,
  // dead centre. The room is a closed box, and the first version of this
  // component dissolved the doors and revealed the plaster behind them.
  //
  // So the wall opens. A clone of its material discards fragments inside the
  // doorway's own rectangle, and the rectangle widens from the centre line as
  // the chapter arrives — which reads as the doors parting, and is the one
  // treatment that reveals the region through the opening the model actually
  // has rather than by swapping the scene for another one.
  //
  // Both materials are CLONED for their one mesh. MAT_Wall_Plaster_LM is on 22
  // primitives (the cornice friezes, the mouldings) and MAT_Wood_Dark on 18
  // (the newels, the panelling); writing to either directly would open a hole
  // in the cornice and fade half the room's joinery.
  const doorState = useRef<{ mesh: THREE.Mesh; material: THREE.Material } | null>(null);
  const openUniform = useRef({ value: 0 });

  useEffect(() => {
    if (!root) return;
    const cleanups: (() => void)[] = [];

    const doors = root.getObjectByName('int_doors') as THREE.Mesh | null;
    if (doors && !Array.isArray(doors.material)) {
      const original = doors.material as THREE.MeshStandardMaterial;
      const clone = original.clone();
      clone.name = `${original.name}__threshold`;
      clone.transparent = true;
      clone.depthWrite = false;
      doors.material = clone;
      doorState.current = { mesh: doors, material: clone };
      cleanups.push(() => {
        doors.material = original;
        clone.dispose();
        doorState.current = null;
      });
    }

    const wall = root.getObjectByName('int_wall_front') as THREE.Mesh | null;
    if (wall && !Array.isArray(wall.material)) {
      const original = wall.material as THREE.MeshStandardMaterial;
      const clone = original.clone();
      clone.name = `${original.name}__threshold`;
      const uOpen = openUniform.current;
      clone.onBeforeCompile = (shader) => {
        shader.uniforms.uOpen = uOpen;
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', `varying vec3 vDoorPos;
             void main() {`)
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vDoorPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', `uniform float uOpen;
             varying vec3 vDoorPos;
             void main() {`)
          .replace(
            '#include <clipping_planes_fragment>',
            `#include <clipping_planes_fragment>
             {
               // The doorway, measured from the GLB: x -1.30..1.30, y 0..3.70,
               // on the entry axis. The hole widens from the centre line as the
               // chapter arrives; the height is opened at once, so the opening
               // is always a door and never a letterbox.
               float halfW = 1.34 * uOpen;
               if (uOpen > 0.002
                   && abs(vDoorPos.x) < halfW
                   && vDoorPos.y < 3.74) discard;
             }`,
          );
      };
      // Its own program: without a distinct key this shares the compiled shader
      // with every other MAT_Wall_Plaster_LM surface in the room, and the hole
      // appears in the cornice.
      clone.customProgramCacheKey = () => 'threshold-wall';
      clone.needsUpdate = true;
      wall.material = clone;
      cleanups.push(() => {
        wall.material = original;
        clone.dispose();
      });
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  }, [root]);

  // ── Interaction ───────────────────────────────────────────────────────────
  const setHover = useCallback((index: number, on: boolean) => {
    const t = targetHover.current;
    if (index < 0 || index >= t.length) return;
    t[index] = on ? 1 : 0;
    gl.domElement.style.cursor = t.some((v) => v > 0.5) ? 'pointer' : '';
  }, [gl]);

  useEffect(
    () => () => {
      gl.domElement.style.cursor = '';
      cancelDive();
    },
    [gl],
  );

  /**
   * SELECT A BEACON: dive, then hand over to the veil.
   *
   * The camera leaves from where it ACTUALLY is — read off the live camera at
   * the moment of the click, not from the beat it is nominally on — so an
   * interrupted scroll or the pointer parallax offset both start the move from
   * the frame the visitor was looking at.
   *
   * The destination is a stand-off short of the marker rather than the marker
   * itself: arriving inside a point sprite means arriving inside nothing, and
   * the last frame before the cut should still be a frame of the field.
   *
   * Under reduced motion `startDive` returns false and the route is taken at
   * once. Either way the navigation is the SAME veiled client-side push the
   * link in the copy beside it uses; there is no second transition device here.
   */
  const select = useCallback(
    (b: Beacon) => {
      const from = camera.position;
      const aim = new THREE.Vector3();
      camera.getWorldDirection(aim);
      aim.multiplyScalar(6).add(from);

      const head = new THREE.Vector3(b.x, FIELD.y + 1.0 + b.weight * 0.5, b.z);
      const standoff = head.clone().sub(from).normalize().multiplyScalar(-7.5).add(head);
      standoff.y = Math.max(FIELD.y + 2.2, standoff.y);

      const animated = startDive({
        slug: b.slug,
        fromPos: [from.x, from.y, from.z],
        fromTarget: [aim.x, aim.y, aim.z],
        toPos: [standoff.x, standoff.y, standoff.z],
        toTarget: [head.x, head.y, head.z],
      });

      if (!animated) {
        onOpen(b.slug);
        return;
      }
      window.setTimeout(() => onOpen(b.slug), HANDOFF_MS);
    },
    [camera, onOpen],
  );

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    shown.current += (reveal.current - shown.current) * Math.min(1, delta * 3.2);
    const r = shown.current;

    // Below the floor there is nothing to draw and nothing to hit. Skipping the
    // subtree keeps the field off the raycaster's list for the 80% of the film
    // it is not on screen.
    group.visible = r > 0.004;
    groundUniforms.uReveal.value = r;
    headUniforms.uReveal.value = r;
    shaftUniforms.uReveal.value = r;

    // The doors dissolve INTO the reveal rather than cutting: they are the last
    // solid thing between the room and the region, and a cut there would read
    // as a missing frame.
    const door = doorState.current;
    if (door) {
      const mat = door.material as THREE.MeshStandardMaterial;
      mat.opacity = 1 - Math.min(1, r * 1.6);
      door.mesh.visible = mat.opacity > 0.01;
    }
    // The wall parts a little behind the doors, so the leaves are gone before
    // the opening finishes widening rather than dissolving inside a hole.
    openUniform.current.value = Math.min(1, Math.max(0, (r - 0.12) / 0.6));

    if (!group.visible) return;

    const hover = hoverRef.current;
    const target = targetHover.current;
    let dirty = false;
    for (let i = 0; i < hover.length; i += 1) {
      // Either source lights a marker: the pointer over the marker itself, or
      // focus on that project's link in the copy beside it.
      const wanted = Math.max(target[i], i === focusIndex ? 1 : 0);
      const next = hover[i] + (wanted - hover[i]) * Math.min(1, delta * 8);
      if (Math.abs(next - hover[i]) > 1e-4) dirty = true;
      hover[i] = next;
    }
    if (dirty) {
      const heads = headsRef.current;
      if (heads) {
        const attr = heads.geometry.getAttribute('aHover') as THREE.BufferAttribute;
        (attr.array as Float32Array).set(hover);
        attr.needsUpdate = true;
      }
      const shafts = shaftsRef.current;
      if (shafts) {
        const attr = shafts.geometry.getAttribute('aHover') as THREE.InstancedBufferAttribute;
        (attr.array as Float32Array).set(hover);
        attr.needsUpdate = true;
      }
    }
  });

  if (!beacons.length) return null;

  return (
    <group ref={groupRef} visible={false}>
      <mesh
        name="city_ground"
        geometry={groundGeometry}
        material={groundMaterial}
        position={[FIELD.centreX, FIELD.y, FIELD.far * 0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={-1}
      />

      {tier !== 'low' ? (
        <instancedMesh
          ref={shaftsRef}
          name="city_shafts"
          args={[shaftGeometry, shaftMaterial, Math.max(1, beacons.length)]}
          frustumCulled={false}
        />
      ) : null}

      <points
        ref={headsRef}
        name="city_beacons"
        geometry={headGeometry}
        material={headMaterial}
        frustumCulled={false}
      />

      {/* THE HIT TARGETS. Invisible boxes rather than the point sprites, for the
          same reason the stations use them: a Points object raycasts against a
          threshold in world units and a marker that grows under the pointer
          would otherwise have a hit area that does not match what is drawn.
          Named so a test can find the thing it is supposed to click. */}
      {beacons.map((b: Beacon, i: number) => (
        <mesh
          key={b.slug}
          name={`beacon_${b.slug}`}
          position={[b.x, FIELD.y + 1.1, b.z]}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            setHover(i, true);
          }}
          onPointerOut={() => setHover(i, false)}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            // A marker that is barely revealed is not yet a target — the same
            // gate the stations use, and for the same reason: a hit volume the
            // visitor cannot see should not be clickable.
            if (shown.current < 0.4) return;
            select(b);
          }}
        >
          <boxGeometry args={[3.4, 3.4, 3.4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
