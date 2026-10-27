'use client';

// apps/public/src/components/experience/MapTable.tsx
//
// THE MAP TABLE: the land, carved into a walnut table in the court of the
// stair. mapTablePlan.ts has the account of why it replaced the district field;
// make_map_table.py has the geography and the finish.
//
// WHAT IT IS MADE OF. A round walnut top, 2.2 m across, on a turned pedestal
// and a plinth. Set into it, inside a brass bezel, the two districts in plaster
// relief: the lacquered sea, the coast, the rivers in gilt, the ghats rising to
// the north-west — one mesh, displaced on the GPU from a height map, 256
// segments a side on a desktop. A brass pin stands in the district of every
// published layout, its length its plots, and like the obelisks it replaces it
// is a real link: hover and it lifts, click and the camera leans in and the
// route opens (the same veiled push the holograms and the list use).
//
// THE LIGHT IS BAKED (the critique asked for "baked, cinematic lighting with
// high contrast and deep shadows"). No light is added to the hall — every
// program in the room would recompile at the door if one were. The table is
// lit by the low sun the clerestory lets in (mapTablePlan.MAP_SUN), and the part
// of that light a real light cannot be without — the shadows the ranges throw
// across the plains, the bezel's across the sea — was ray-marched into a
// shadow map offline. This component adds the sun per pixel through three's
// own direct-light function with the relief's normal map, so the light is
// baked and the shading is still as sharp as the carving. The pins, which are
// data, cast their shadows analytically in the same shader. Everything else is
// the room: its probe for the reflections, its ambient for the fill, and the
// occlusion baked with the shadows.
//
// GLSL NOTE: shaders.test.ts scans this file for GLSL ES 3.00 reserved words.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { hallEnv, hallKTX2 } from './HallModel';
import { warmHallPrograms } from './hallProbe';
import { markFocusDepth } from './LensFocus';
import {
  MAP_SUN,
  MAP_TABLE,
  MAP_TEXTURES,
  MAP_TOP,
  mapStage,
  placeLabels,
  placePins,
  type LabelPoint,
  type LabelSize,
  type MapMeta,
  type Pin,
  type PinProject,
} from './mapTablePlan';
import { journeyState } from './journey';
import { copyZone, filmIsWide } from './copyZone';
import { useBeaconFocus } from '@/components/site/CityLink';
import { clicksSuppressed } from './stationControls';
import { HANDOFF_MS, cancelDive, startDive } from './dive';

/** The sun's strength on the table, linear. Set against the hall's print so the
 *  lit plaster reads as ivory in the last frame, not as white. */
const KEY_POWER = 1.6;
/** How much of the room's own light (its probe) reaches the table. Low: the
 *  table is a lit exhibit in a room whose house lights are down, and the sun
 *  across it is what models the relief — a full probe of ivory walls fills
 *  every shadow the ranges throw and the land goes flat. */
const ROOM_LIGHT = 0.28;
const KEY_COLOUR = new THREE.Color(1.0, 0.86, 0.68).multiplyScalar(KEY_POWER);
/** Points round the rim, for where the top stands on the screen (mapStage). */
const RIM_POINTS = 24;
const SUN = new THREE.Vector3(...MAP_SUN);
const WALNUT = '#3b281b';
const BRASS = '#d2ad6c';

/** The pins' parts, metres. */
const STEM_R = 0.0024;
const HEAD_R = 0.0095;
const MAX_PINS = 4;

/**
 * THE PINS' NAMES (the forensic audit of 2026-10-09, #49: "the map's pins
 * carry no labels ... Expected: the list on plain ground; pins that can be
 * told apart"). The list beside the table names the layouts and the pins were
 * three brass heads alike, told apart only by pointing at one. So each pin
 * carries its layout's name, on a plate of the hall's own kind (gilt capitals
 * on the dark of the station tables' name plates), set over its head or beside
 * it (mapTablePlan.placeLabels), in the page and not in the picture, so it is
 * as sharp as the list's type and the same size as the film's other capitals.
 * Not a link (the pin is one, and so is the list's name) and not read out
 * twice: the film's layer is hidden from a screen reader, and the list is what
 * it reads. In the film only (mapStage.named): a page's still frame has the
 * table where its place puts it. Up with the film on the table (`from`, `to`, of the map beat's
 * emphasis), gone as the colophon comes up (`coda`, of the coda's progress:
 * measured at 390x844, the sign-off's first line enters the frame at 0.24
 * and reaches the table's band after 0.3; going from 0 they were half gone
 * where the film comes to rest on the table), and only while the top stands
 * wide enough in the frame (`minWidth`, of the frame's width) to be read as a
 * map. `gap`: pixels between a head and its plate.
 *
 * AND NEVER ON THE CHAPTER'S WORDS OR ITS DOTS (the second forensic audit,
 * 2026-10-24, #9). On a frame that is not wide the map's list stands across
 * the top, and on a short phone (390x664) the table comes up under its last
 * line: the topmost plate, set over its head, crossed the note. So there the
 * plates are kept below the copy's foot (copyZone) for as long as they are
 * up, and on every frame left of the chapter rail's column (ChapterRail),
 * where the third ran out under the dots.
 */
export const PIN_NAMES = { from: 0.55, to: 0.9, coda: [0.12, 0.3] as const, minWidth: 0.16, gap: 7 } as const;

/**
 * THE RIM'S HIGHLIGHT IS A LINE, NOT A ROW OF SPARKS (the forensic audit of
 * 2026-10-09, #49: "the table's rim highlight is a dotted line"). The top's
 * edge rolls through a quarter circle in three centimetres, and from where the
 * film looks at it the roll printed as a row of bright points (78 of them in
 * the rim's front at the film's 89%).
 *
 * Mostly the grain's doing. The rim wears the top's own maps, laid from
 * above (lathe, `planar`), and that laying has no direction on a face that
 * stands upright: down the roll the map's coordinates do not change, the
 * frame three builds for a normal map from how they change is a guess, and
 * the walnut's relief came out as a scatter of normals a pixel apart. So the
 * grain's relief is kept to where the rim faces up (`grain`: the cosine with
 * the vertical at which it starts to fade, and at which it is whole); the roll
 * is shaded by its own turning, which is smooth. MEASURED on the running
 * build: 60 bright points along the front of the rim, 2 with the grain kept
 * to the top.
 *
 * And the car's cure (ExteriorModel, CAR_SPECULAR) for what is left: how fast
 * the normal turns across a pixel is how much rougher the surface is drawn
 * there, so a pixel holds the whole highlight. Capped, as a GGX variance, so
 * the lacquer seen close is still a lacquer.
 */
export const MAP_SPECULAR = { cap: 0.18, grain: [0.55, 0.85] as const } as const;
const MAP_GRAIN_ON_TOP = /* glsl */ `
#include <normal_fragment_maps>
{
  vec3 upView = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float onTop = smoothstep(${MAP_SPECULAR.grain[0].toFixed(2)}, ${MAP_SPECULAR.grain[1].toFixed(2)}, abs(dot(nonPerturbedNormal, upView)));
  normal = normalize(mix(nonPerturbedNormal, normal, onTop));
}
`;
const MAP_SPECULAR_AA = /* glsl */ `
#include <lights_physical_fragment>
{
  vec3 rollDx = dFdx(normal), rollDy = dFdy(normal);
  float rollTurn = min(2.0 * 0.25 * (dot(rollDx, rollDx) + dot(rollDy, rollDy)), ${MAP_SPECULAR.cap.toFixed(2)});
  material.roughness = sqrt(clamp(material.roughness * material.roughness + rollTurn, 0.0, 1.0));
}
`;

// ── the key light, added to three's standard material ────────────────────────

const KEY_PARS = /* glsl */ `
uniform vec3 uKeyDir;
uniform vec3 uKeyColor;
#ifdef MAP_KEY_SHADOW
uniform sampler2D uKeyShadow;
#endif
#ifdef MAP_PINS
uniform vec4 uPins[${MAX_PINS}];
uniform int uPinCount;
uniform vec3 uKeyLocal;
varying vec3 vTablePos;
float pinShade(vec3 p) {
  float lit = 1.0;
  vec2 lh = uKeyLocal.xz;
  float lh2 = max(dot(lh, lh), 1e-6);
  for (int i = 0; i < ${MAX_PINS}; i++) {
    if (i >= uPinCount) break;
    vec4 pin = uPins[i];
    vec2 d = pin.xy - p.xz;
    float t = dot(d, lh) / lh2;
    if (t <= 0.0) continue;
    float miss = length(d - t * lh);
    float y = p.y + t * uKeyLocal.y;
    float stem = (1.0 - smoothstep(${STEM_R.toFixed(4)}, ${(STEM_R * 3.0).toFixed(4)}, miss))
      * step(pin.z, y) * step(y, pin.w);
    vec3 oc = vec3(pin.x, pin.w, pin.y) - p;
    float tc = dot(oc, uKeyLocal);
    float dh = length(oc - tc * uKeyLocal);
    float head = tc > 0.0 ? 1.0 - smoothstep(${(HEAD_R * 0.7).toFixed(4)}, ${(HEAD_R * 1.7).toFixed(4)}, dh) : 0.0;
    lit *= 1.0 - 0.82 * max(stem, head);
  }
  return lit;
}
#endif
`;

const KEY_LIGHT = /* glsl */ `
{
  float keyVis = 1.0;
  #ifdef MAP_KEY_SHADOW
  keyVis *= texture2D( uKeyShadow, vMapUv ).r;
  #endif
  #ifdef MAP_PINS
  keyVis *= pinShade( vTablePos );
  #endif
  IncidentLight keyLight;
  keyLight.direction = uKeyDir;
  keyLight.color = uKeyColor * keyVis;
  keyLight.visible = true;
  RE_Direct( keyLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
}
#include <lights_fragment_end>
`;

interface Keyed {
  uKeyDir: { value: THREE.Vector3 };
  uKeyColor: { value: THREE.Color };
  uKeyShadow?: { value: THREE.Texture | null };
  uPins?: { value: THREE.Vector4[] };
  uPinCount?: { value: number };
  uKeyLocal?: { value: THREE.Vector3 };
}

/** Put the table's sun on a standard material. `grain`: its normal map is laid
 *  from above, and only holds where it faces up (MAP_SPECULAR). */
function keyed(
  mat: THREE.MeshStandardMaterial,
  opts: { shadow?: THREE.Texture | null; pins?: boolean; grain?: boolean },
  key: string,
): Keyed {
  const u: Keyed = {
    uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
    uKeyColor: { value: KEY_COLOUR.clone() },
  };
  if (opts.shadow !== undefined) u.uKeyShadow = { value: opts.shadow };
  if (opts.pins) {
    u.uPins = { value: Array.from({ length: MAX_PINS }, () => new THREE.Vector4()) };
    u.uPinCount = { value: 0 };
    u.uKeyLocal = { value: SUN.clone() };
  }
  mat.defines = {
    ...(mat.defines ?? {}),
    ...(opts.shadow !== undefined ? { MAP_KEY_SHADOW: '' } : {}),
    ...(opts.pins ? { MAP_PINS: '' } : {}),
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    if (opts.pins) {
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying vec3 vTablePos;\nvoid main() {')
        .replace('#include <displacementmap_vertex>', '#include <displacementmap_vertex>\n  vTablePos = transformed;');
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${KEY_PARS}\nvoid main() {`)
      .replace('#include <lights_fragment_end>', KEY_LIGHT)
      .replace('#include <lights_physical_fragment>', MAP_SPECULAR_AA);
    if (opts.grain) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', MAP_GRAIN_ON_TOP);
  };
  mat.customProgramCacheKey = () => `map-table-${key}`;
  return u;
}

// ── geometry ─────────────────────────────────────────────────────────────────

const uvOf = (x: number, z: number): [number, number] => [
  (x + MAP_TOP.half) / (2 * MAP_TOP.half),
  (z + MAP_TOP.half) / (2 * MAP_TOP.half),
];

/** The relief: a flat grid over the disc's square, displaced on the GPU. */
function reliefGrid(segments: number): THREE.BufferGeometry {
  const e = MAP_TOP.reliefRadius + 0.006;
  const n = segments + 1;
  const pos = new Float32Array(n * n * 3);
  const nor = new Float32Array(n * n * 3);
  const uv = new Float32Array(n * n * 2);
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const k = j * n + i;
      const x = -e + (2 * e * i) / segments;
      const z = -e + (2 * e * j) / segments;
      pos.set([x, 0, z], k * 3);
      nor.set([0, 1, 0], k * 3);
      uv.set(uvOf(x, z), k * 2);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < segments; j += 1) {
    for (let i = 0; i < segments; i += 1) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      // Wound for +y: (a, c, b) and (b, c, d) with z growing down the rows.
      index.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  // The displacement lifts it up to heightRange: say so, or it is culled.
  g.boundingBox = new THREE.Box3(new THREE.Vector3(-e, -0.01, -e), new THREE.Vector3(e, MAP_TOP.heightRange, e));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.03, 0), e * Math.SQRT2);
  return g;
}

/** A turned profile, with the top's planar UVs laid over it so the bezel and
 *  the rim take the same colour, occlusion and baked light as the relief. */
function lathe(profile: [number, number][], segments: number, planar: boolean): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
  if (planar) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i += 1) {
      const [u, v] = uvOf(p.getX(i), p.getZ(i));
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
  }
  return g;
}

/** Heights relative to the rim's surface (y 0), radii from the centre. */
const RIM: [number, number][] = [
  [0.8605, -0.0045], [0.862, 0.0], [0.866, 0.0038], [0.872, 0.0057], [0.878, 0.006],
  [0.884, 0.0057], [0.89, 0.0038], [0.894, 0.001], [0.8955, 0.0], [0.95, 0.0], [1.07, 0.0],
  [1.082, -0.0018], [1.092, -0.0075], [1.099, -0.0175], [1.1, -0.028], [1.098, -0.038],
  [1.09, -0.045], [1.08, -0.048], [1.045, -0.048],
];
const APRON: [number, number][] = [
  [1.045, -0.048], [1.045, -0.16], [1.036, -0.168], [1.0, -0.172], [0.3, -0.172],
];
/** The pedestal, floor up: a low stepped plinth, a slender turned column with
 *  a vase at its foot and a ring below the collar, and the collar that takes
 *  the top — a library table's column, not a drum. */
const PEDESTAL: [number, number][] = [
  [0.0, 0.0], [0.4, 0.0], [0.4, 0.028], [0.37, 0.034], [0.34, 0.046], [0.3, 0.052],
  [0.22, 0.066], [0.16, 0.09], [0.135, 0.13], [0.125, 0.18], [0.1, 0.24], [0.085, 0.32],
  [0.08, 0.42], [0.085, 0.5], [0.105, 0.54], [0.11, 0.56], [0.095, 0.575], [0.09, 0.62],
  [0.13, 0.655], [0.19, 0.678], [0.22, 0.688], [0.0, 0.688],
];

/** A soft ground under the table: the room's light occluded by the top. */
const CONTACT_FRAG = /* glsl */ `
  uniform float uHalf;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0 * uHalf;
    float under = 1.0 - smoothstep(0.35, 1.25, r);
    float foot = exp(-pow(max(r - 0.54, 0.0) / 0.05, 2.0)) * step(0.5, r);
    float f = 1.0 - 0.42 * under - 0.22 * foot;
    gl_FragColor = vec4(vec3(f) * 0.5, 0.0);
  }
`;
const CONTACT_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ── the table ────────────────────────────────────────────────────────────────

export interface MapTableProps {
  projects: PinProject[];
  /** Route to a project: the same veiled push the holograms use. */
  onOpen: (slug: string) => void;
  tier?: 'low' | 'mid' | 'high';
}

interface Loaded {
  color: THREE.Texture;
  normal: THREE.Texture;
  orm: THREE.Texture;
  height: THREE.Texture;
  shadow: THREE.Texture;
  meta: MapMeta;
}

async function loadMeta(url: string): Promise<MapMeta> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  const n = c.width;
  const height = new Uint8Array(n * n);
  const district = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i += 1) {
    height[i] = px[i * 4];
    district[i] = px[i * 4 + 1];
  }
  return { size: n, height, district };
}

export function MapTable({ projects, onOpen, tier = 'high' }: MapTableProps) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const [maps, setMaps] = useState<Loaded | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  // The textures stream in after the hall; until they land there is no table.
  useEffect(() => {
    let dead = false;
    const ktx = hallKTX2(gl);
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const tex = async (url: string, colour: boolean) => {
      const t = await ktx.loadAsync(url);
      t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = aniso;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    };
    Promise.all([
      tex(MAP_TEXTURES.color, true),
      tex(MAP_TEXTURES.normal, false),
      tex(MAP_TEXTURES.orm, false),
      tex(MAP_TEXTURES.height, false),
      tex(MAP_TEXTURES.shadow, false),
      loadMeta(MAP_TEXTURES.meta),
    ])
      .then(([color, normal, orm, height, shadow, meta]) => {
        if (dead) {
          for (const t of [color, normal, orm, height, shadow]) t.dispose();
          return;
        }
        setMaps({ color, normal, orm, height, shadow, meta });
      })
      .catch((err) => console.warn('[map_table] textures failed', err));
    return () => {
      dead = true;
    };
  }, [gl]);
  useEffect(
    () => () => {
      if (maps) for (const t of [maps.color, maps.normal, maps.orm, maps.height, maps.shadow]) t.dispose();
    },
    [maps],
  );

  const segments = tier === 'high' ? 256 : tier === 'mid' ? 176 : 112;
  const geos = useMemo(
    () => ({
      reliefNear: reliefGrid(segments),
      reliefFar: reliefGrid(Math.round(segments / 3)),
      rim: lathe(RIM, 256, true),
      apron: lathe(APRON, 128, false),
      pedestal: lathe(PEDESTAL, 96, false),
      stem: new THREE.CylinderGeometry(STEM_R, STEM_R, 1, 10, 1).translate(0, 0.5, 0),
      head: new THREE.SphereGeometry(HEAD_R, 20, 14),
      contact: new THREE.PlaneGeometry(2.8, 2.8).rotateX(-Math.PI / 2),
    }),
    [segments],
  );
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  // The materials, and the uniforms each shares with its shader.
  const mats = useMemo(() => {
    if (!maps) return null;
    const relief = new THREE.MeshStandardMaterial({
      map: maps.color,
      normalMap: maps.normal,
      aoMap: maps.orm,
      aoMapIntensity: 1,
      roughnessMap: maps.orm,
      metalnessMap: maps.orm,
      roughness: 1,
      metalness: 1,
      displacementMap: maps.height,
      displacementScale: MAP_TOP.heightRange,
      displacementBias: -MAP_TOP.seaDrop,
      alphaTest: 0.5,
      envMapIntensity: ROOM_LIGHT,
    });
    relief.name = 'map_relief';
    const rim = new THREE.MeshStandardMaterial({
      map: maps.color,
      normalMap: maps.normal,
      aoMap: maps.orm,
      roughnessMap: maps.orm,
      metalnessMap: maps.orm,
      roughness: 1,
      metalness: 1,
      side: THREE.DoubleSide,
      envMapIntensity: ROOM_LIGHT * 1.4,
    });
    rim.name = 'map_rim';
    const body = new THREE.MeshStandardMaterial({
      color: WALNUT,
      roughness: 0.42,
      metalness: 0,
      side: THREE.DoubleSide,
      envMapIntensity: ROOM_LIGHT * 1.4,
    });
    body.name = 'map_body';
    // Its roll too (MAP_SPECULAR): the apron's lip and the pedestal's beads.
    body.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_fragment>', MAP_SPECULAR_AA);
    };
    body.customProgramCacheKey = () => 'map-table-body';
    const brass = new THREE.MeshStandardMaterial({ color: BRASS, roughness: 0.26, metalness: 1 });
    brass.name = 'map_pin';
    const contact = new THREE.ShaderMaterial({
      uniforms: { uHalf: { value: 1.4 } },
      vertexShader: CONTACT_VERT,
      fragmentShader: CONTACT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.SrcColorFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    const keys = [
      keyed(relief, { shadow: maps.shadow, pins: true }, 'relief'),
      keyed(rim, { shadow: maps.shadow, grain: true }, 'rim'),
      keyed(brass, {}, 'pin'),
    ];
    return { relief, rim, body, brass, contact, keys, relief_u: keys[0] };
  }, [maps]);
  useEffect(
    () => () => {
      if (!mats) return;
      for (const m of [mats.relief, mats.rim, mats.body, mats.brass, mats.contact]) m.dispose();
    },
    [mats],
  );

  // ── the pins ──────────────────────────────────────────────────────────────
  const pins = useMemo<Pin[]>(() => (maps ? placePins(projects, maps.meta).slice(0, MAX_PINS) : []), [
    projects,
    maps,
  ]);
  const stemsRef = useRef<THREE.InstancedMesh>(null);
  const headsRef = useRef<THREE.InstancedMesh | null>(null);
  const hover = useRef<number[]>([]);
  const target = useRef<number[]>([]);
  const focusSlug = useBeaconFocus((s) => s.slug);
  const focusIndex = useMemo(
    () => (focusSlug ? pins.findIndex((p) => p.slug === focusSlug) : -1),
    [focusSlug, pins],
  );
  useEffect(() => {
    hover.current = pins.map(() => 0);
    target.current = pins.map(() => 0);
  }, [pins]);

  // Compiled with the hall, off the frame the chapter first draws them.
  useEffect(() => {
    const g = groupRef.current;
    if (!g || !mats) return;
    markFocusDepth(g);
    void warmHallPrograms(gl, camera, g, hallEnv.stand);
  }, [gl, camera, mats, pins]);

  const setHover = useCallback(
    (i: number, on: boolean) => {
      if (i < 0 || i >= target.current.length) return;
      target.current[i] = on ? 1 : 0;
      gl.domElement.style.cursor = target.current.some((v) => v > 0.5) ? 'pointer' : '';
    },
    [gl],
  );
  useEffect(
    () => () => {
      gl.domElement.style.cursor = '';
      cancelDive();
    },
    [gl],
  );

  /** Lean in toward the pin, then open its page (dive.ts). */
  const select = useCallback(
    (p: Pin) => {
      const from = camera.position;
      const aim = new THREE.Vector3();
      camera.getWorldDirection(aim);
      aim.multiplyScalar(3).add(from);
      const head = new THREE.Vector3(
        MAP_TABLE.x + p.x,
        MAP_TABLE.topY + p.base + p.length,
        MAP_TABLE.z + p.z,
      );
      const toward = head.clone().sub(from);
      const stand = from.clone().addScaledVector(toward, 0.55);
      const animated = startDive({
        slug: p.slug,
        fromPos: [from.x, from.y, from.z],
        fromTarget: [aim.x, aim.y, aim.z],
        toPos: [stand.x, stand.y, stand.z],
        toTarget: [head.x, head.y, head.z],
      });
      if (!animated) {
        onOpen(p.slug);
        return;
      }
      window.setTimeout(() => onOpen(p.slug), HANDOFF_MS);
    },
    [camera, onOpen],
  );

  // THE PINS' NAMES (PIN_NAMES). Plain DOM in the canvas's own box: drawn over
  // the picture, under everything the page puts over the film, and clipped by
  // its frame.
  const size = useThree((st) => st.size);
  const names = useRef<HTMLElement[]>([]);
  const nameSizes = useRef<LabelSize[]>([]);
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host || !pins.length) return;
    const layer = document.createElement('div');
    // (`film-stage`: the film's own capitals, sized in the frame's unit.)
    layer.className = 'map-pin-names film-stage';
    layer.setAttribute('aria-hidden', 'true');
    const els = pins.map((p) => {
      const el = document.createElement('span');
      el.className = 'map-pin-name';
      el.textContent = p.name;
      layer.appendChild(el);
      return el;
    });
    host.appendChild(layer);
    names.current = els;
    const measure = () => {
      nameSizes.current = els.map((el) => ({ w: el.offsetWidth, h: el.offsetHeight }));
    };
    measure();
    void document.fonts?.ready.then(measure);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      layer.remove();
      names.current = [];
      nameSizes.current = [];
    };
  }, [gl, pins]);
  const namePoint = useMemo(() => new THREE.Vector3(), []);
  const namePoints = useRef<LabelPoint[]>([]);
  // The copy's foot while the plates are up, in pixels: held, not followed,
  // so a plate does not jump when the words go first (PIN_NAMES).
  const copyFoot = useRef(0);
  // The rail's left edge in the canvas's box, read once a frame size.
  const rail = useRef<{ w: number; h: number; left: number } | null>(null);

  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const sunView = useMemo(() => new THREE.Vector3(), []);
  const lod = useRef<{ near: THREE.Mesh | null; far: THREE.Mesh | null }>({ near: null, far: null });
  const onScreen = useMemo(() => ({ l: 0, t: 0, r: 0, b: 0 }), []);
  useEffect(
    () => () => {
      mapStage.screen = null;
    },
    [],
  );

  useFrame((_, delta) => {
    if (!mats) return;
    const env = hallEnv.texture ?? hallEnv.stand;
    for (const m of [mats.relief, mats.rim, mats.body, mats.brass]) {
      if (env && m.envMap !== env) {
        m.envMap = env;
        m.needsUpdate = true;
      }
    }
    // The sun, in the view space three's lights are in.
    sunView.copy(SUN).transformDirection(camera.matrixWorldInverse);
    for (const k of mats.keys) k.uKeyDir.value.copy(sunView);

    // Near the table the full relief; across the room a third of it.
    const g = groupRef.current;
    if (g) {
      const d = camera.position.distanceTo(v.set(MAP_TABLE.x, MAP_TABLE.topY, MAP_TABLE.z));
      const near = d < 7.5;
      if (lod.current.near) lod.current.near.visible = near;
      if (lod.current.far) lod.current.far.visible = !near;
    }

    // WHERE THE TOP STANDS ON THE SCREEN (mapStage.screen), for the lens: the
    // rim's circle through the camera this frame is drawn with — its view
    // offset included, which is the phone's lens — as a box in fractions of
    // the frame. Nothing while any of it is behind the camera or the whole of
    // it is out of the frame.
    {
      let l = Infinity;
      let t = Infinity;
      let r = -Infinity;
      let b = -Infinity;
      let ahead = true;
      for (let i = 0; i < RIM_POINTS && ahead; i += 1) {
        const a = (i / RIM_POINTS) * Math.PI * 2;
        v.set(
          MAP_TABLE.x + MAP_TABLE.radius * Math.cos(a),
          MAP_TABLE.topY,
          MAP_TABLE.z + MAP_TABLE.radius * Math.sin(a),
        ).applyMatrix4(camera.matrixWorldInverse);
        if (v.z > -0.05) {
          ahead = false;
          break;
        }
        v.applyMatrix4(camera.projectionMatrix);
        const x = (v.x + 1) / 2;
        const y = (1 - v.y) / 2;
        if (x < l) l = x;
        if (x > r) r = x;
        if (y < t) t = y;
        if (y > b) b = y;
      }
      if (ahead && r > 0 && l < 1 && b > 0 && t < 1) {
        onScreen.l = l;
        onScreen.t = t;
        onScreen.r = r;
        onScreen.b = b;
        mapStage.screen = onScreen;
      } else {
        mapStage.screen = null;
      }
    }

    // The pins: lift on hover (the pin's own, or its link's in the list).
    const stems = stemsRef.current;
    const heads = headsRef.current;
    const u = mats.relief_u;
    if (u.uPinCount) u.uPinCount.value = pins.length;
    for (let i = 0; i < pins.length; i += 1) {
      const p = pins[i];
      const want = Math.max(target.current[i] ?? 0, i === focusIndex ? 1 : 0);
      const h = (hover.current[i] ?? 0) + (want - (hover.current[i] ?? 0)) * Math.min(1, delta * 8);
      hover.current[i] = h;
      const lift = 0.012 * h;
      const top = p.base + p.length + lift;
      if (stems) {
        v.set(p.x, p.base, p.z);
        s.set(1, p.length + lift, 1);
        stems.setMatrixAt(i, m4.compose(v, q, s));
      }
      if (heads) {
        v.set(p.x, top, p.z);
        s.set(1, 1, 1);
        heads.setMatrixAt(i, m4.compose(v, q, s));
        col.setRGB(1 + 0.35 * h, 1 + 0.25 * h, 1 + 0.1 * h);
        heads.setColorAt(i, col);
      }
      if (u.uPins) u.uPins.value[i].set(p.x, p.z, p.base, top);
    }
    if (stems) stems.instanceMatrix.needsUpdate = true;
    if (heads) {
      heads.instanceMatrix.needsUpdate = true;
      if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    }

    // The pins' names: over their heads, while the film is on the table.
    const els = names.current;
    if (els.length && els.length === pins.length) {
      const st = mapStage.screen;
      const ramp = (a: number, b: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
      };
      const up =
        mapStage.named && st && st.r - st.l >= PIN_NAMES.minWidth
          ? ramp(PIN_NAMES.from, PIN_NAMES.to, mapStage.emphasis) *
            (1 - ramp(PIN_NAMES.coda[0], PIN_NAMES.coda[1], journeyState.coda))
          : 0;
      if (up <= 0.002) {
        copyFoot.current = 0;
        for (const el of els) {
          if (el.style.visibility !== 'hidden') {
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
          }
        }
      } else {
        if (!filmIsWide(size.width, size.height)) {
          const city = copyZone.panes.find((p) => p.id === 'city');
          if (city) copyFoot.current = Math.max(copyFoot.current, city.bottom * size.height);
        }
        if (!rail.current || rail.current.w !== size.width || rail.current.h !== size.height) {
          const nav = document.querySelector('nav.rail');
          const host = gl.domElement.parentElement;
          const r = nav?.getBoundingClientRect();
          rail.current =
            r && host && r.width > 0
              ? { w: size.width, h: size.height, left: r.left - host.getBoundingClientRect().left }
              : null;
        }
        const pts = namePoints.current;
        pts.length = pins.length;
        for (let i = 0; i < pins.length; i += 1) {
          const p = pins[i];
          const lift = 0.012 * (hover.current[i] ?? 0);
          namePoint
            .set(MAP_TABLE.x + p.x, MAP_TABLE.topY + p.base + p.length + lift + HEAD_R, MAP_TABLE.z + p.z)
            .project(camera);
          pts[i] = { x: ((namePoint.x + 1) / 2) * size.width, y: ((1 - namePoint.y) / 2) * size.height };
        }
        const at = placeLabels(pts, nameSizes.current, {
          width: size.width,
          height: size.height,
          gap: PIN_NAMES.gap,
          margin: 8,
          top: Math.max(Math.min(96, size.height * 0.1), copyFoot.current + PIN_NAMES.gap * 2),
          right: rail.current ? rail.current.left - PIN_NAMES.gap : undefined,
        });
        for (let i = 0; i < els.length; i += 1) {
          const el = els[i];
          el.style.visibility = 'visible';
          el.style.opacity = up.toFixed(3);
          el.style.transform = `translate3d(${at[i].x.toFixed(1)}px, ${at[i].y.toFixed(1)}px, 0)`;
        }
      }
    }
  });

  if (!mats) return null;

  return (
    <group ref={groupRef} name="map_table" position={[MAP_TABLE.x, 0, MAP_TABLE.z]}>
      <mesh
        ref={(m) => {
          lod.current.near = m;
        }}
        name="map_relief"
        geometry={geos.reliefNear}
        material={mats.relief}
        position={[0, MAP_TABLE.topY, 0]}
      />
      <mesh
        ref={(m) => {
          lod.current.far = m;
        }}
        name="map_relief_far"
        geometry={geos.reliefFar}
        material={mats.relief}
        position={[0, MAP_TABLE.topY, 0]}
        visible={false}
      />
      <mesh name="map_rim" geometry={geos.rim} material={mats.rim} position={[0, MAP_TABLE.topY, 0]} />
      <mesh name="map_apron" geometry={geos.apron} material={mats.body} position={[0, MAP_TABLE.topY, 0]} />
      <mesh name="map_pedestal" geometry={geos.pedestal} material={mats.body} />
      <mesh name="map_contact" geometry={geos.contact} material={mats.contact} position={[0, 0.003, 0]} renderOrder={1} />
      {pins.length ? (
        <group position={[0, MAP_TABLE.topY, 0]}>
          <instancedMesh
            ref={stemsRef}
            name="map_pin_stems"
            args={[geos.stem, mats.brass, pins.length]}
            frustumCulled={false}
          />
          <instancedMesh
            ref={(m) => {
              headsRef.current = m;
              // Instance colours exist before the first draw, so the hover's
              // tint is a buffer write and never a recompile.
              if (m && !m.instanceColor) {
                const white = new THREE.Color(1, 1, 1);
                for (let i = 0; i < m.count; i += 1) m.setColorAt(i, white);
              }
            }}
            name="map_pin_heads"
            args={[geos.head, mats.brass, pins.length]}
            frustumCulled={false}
          />
          {/* The hit targets: a slim box round each pin, a little taller than
              it, so the head and the stem are one target. Named so a test can
              find the thing it is meant to click. */}
          {pins.map((p, i) => (
            <mesh
              key={p.slug}
              name={`map_pin_${p.slug}`}
              position={[p.x, p.base + (p.length + 0.02) / 2, p.z]}
              onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                if (mapStage.emphasis > 0.4) setHover(i, true);
              }}
              onPointerOut={() => setHover(i, false)}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                // A pin in a chapter that is not on screen is not a target.
                if (mapStage.emphasis < 0.4 || clicksSuppressed()) return;
                select(p);
              }}
            >
              <boxGeometry args={[0.07, p.length + 0.04, 0.07]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  );
}
