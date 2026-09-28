'use client';

// apps/public/src/components/experience/StationDressing.tsx
//
// What turns a station from a prop into a piece: the projector, its beam, and
// the words on the hologram.
//
// THREE THINGS THE DELIVERED RIG DID NOT HAVE
//
// 1. A PROJECTOR. projector_Sn is a 12-triangle box in brushed steel — a
//    shoebox on an antique table. It is replaced (the box hidden, its node kept,
//    so InteriorStage still seats it on the table and the brief's rule holds:
//    the table turns, the projector does not) by a turned brass instrument: a
//    beaded foot, a cove, a knurled drum, a shoulder and a crystal lens, the way
//    a nineteenth-century maker would have spun it. Lathe geometry, a few
//    hundred triangles, lit by the hall's own reflection probe.
//
// 2. A BEAM. Nothing joined the lens to the plan, so the plan floated with no
//    source. A soft cone of light now rises from the lens to the hologram: an
//    open cone, additive, bright at its rim and fading with height, with a slow
//    drift of motes through it. It breathes with the station's emphasis, so only
//    the station being looked at is lit.
//
// 3. THE NAME. The storyboard asks the hologram to show "the name of the
//    project and its floor map". The GLB carries a title card and three callout
//    cards for exactly that — and every one of them is a blank emissive
//    rectangle (MAT_Holo3D_Card has no texture), which is what the grey slabs
//    hanging over the plans were. They are replaced by labels drawn in the
//    site's own type — the project name in Playfair Display, its place in
//    letter-spaced Inter, the plot counts on the callouts — engraved in light.
//
// All of it is data-driven: a station with no project gets its projector and
// no beam, no words.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { StationAnchor } from './interiorPath';
import { hallEnv } from './HallModel';
import { PROBE_DEFINES, warmHallPrograms } from './hallProbe';
import { NO_DEPTH } from './LensFocus';

/** What a station shows. `total`/`available` are the plot counts. */
export interface StationDetails {
  name: string;
  locality: string;
  city: string;
  total?: number | null;
  available?: number | null;
  soldOut?: boolean;
}

/** Table top, from the delivered GLB (table_top_Sn max y). */
const TABLE_TOP = 0.8;
/** projector_Sn is a box 0.09 tall about its origin; its base is 0.045 below. */
const BOX_HALF = 0.045;

/** The light: a warm champagne, the colour of gilt catching a lamp. */
const CHAMPAGNE = new THREE.Color('#F6DFB2');

/**
 * The instrument, bottom to top, [radius, height] in metres: a beaded foot, a
 * cove up to a knurled drum, a ring, a shoulder, and the collar the lens sits
 * in. 16 cm across, 9 cm tall — the footprint of the box it replaces.
 */
const PROJECTOR_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.0], [0.08, 0.0], [0.083, 0.003], [0.083, 0.011], [0.079, 0.015],
  [0.07, 0.017], [0.064, 0.024], [0.061, 0.032], [0.058, 0.036],
  [0.058, 0.058], [0.062, 0.06], [0.062, 0.065], [0.057, 0.067],
  [0.05, 0.069], [0.041, 0.075], [0.035, 0.08], [0.034, 0.086],
  [0.03, 0.088], [0.0, 0.088],
];
const LENS_TOP = 0.088;

/** The hall's box-projected probe, and the depth write the hall's lens reads.
 *  Bound to the probe (or its stand-in) from the start, so the program these
 *  compile with is the one they keep when the room's own capture arrives. */
function probe(mat: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  mat.defines = { ...(mat.defines ?? {}), ...PROBE_DEFINES, ESTATE_FOCUS: '' };
  mat.envMap = hallEnv.texture ?? hallEnv.stand;
  return mat;
}

/**
 * Additive colour, MIN alpha — the hall's convention for layers of light
 * (see HallModel.holographic): colour adds, and the frame's alpha, which the
 * lens reads as depth, only ever moves nearer, to this layer's own depth where
 * it glows.
 */
function lightLayer<T extends THREE.Material>(mat: T): T {
  mat.transparent = true;
  mat.depthWrite = false;
  mat.blending = THREE.CustomBlending;
  mat.blendEquation = THREE.AddEquation;
  mat.blendSrc = THREE.OneFactor;
  mat.blendDst = THREE.OneFactor;
  mat.blendEquationAlpha = THREE.MinEquation;
  mat.blendSrcAlpha = THREE.OneFactor;
  mat.blendDstAlpha = THREE.OneFactor;
  return mat;
}

function cssFamily(variable: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

/** Draw letter-spaced text centred on x, since canvas letterSpacing is not
 *  everywhere yet. */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let cx = x - total / 2;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + tracking;
  });
}

function labelTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255,255,255,0.35)';
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

async function titleTexture(d: StationDetails) {
  const serif = cssFamily('--font-serif', 'Georgia, serif');
  const sans = cssFamily('--font-sans', 'Arial, sans-serif');
  const W = 2048;
  const H = 512;
  await Promise.all([
    document.fonts?.load(`500 150px ${serif}`, d.name),
    document.fonts?.load(`500 46px ${sans}`, 'A'),
  ]).catch(() => undefined);
  return labelTexture((ctx) => {
    let size = 164;
    ctx.font = `500 ${size}px ${serif}`;
    while (ctx.measureText(d.name).width > W * 0.9 && size > 64) {
      size -= 6;
      ctx.font = `500 ${size}px ${serif}`;
    }
    ctx.shadowBlur = 6;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(d.name, W / 2, H * 0.5);
    ctx.shadowBlur = 3;
    ctx.fillRect(W / 2 - 150, H * 0.62, 300, 4);
    ctx.font = `500 46px ${sans}`;
    spaced(ctx, `${d.locality} · ${d.city}`.toUpperCase(), W / 2, H * 0.83, 14);
  }, W, H);
}

async function calloutTexture(big: string, small: string) {
  const serif = cssFamily('--font-serif', 'Georgia, serif');
  const sans = cssFamily('--font-sans', 'Arial, sans-serif');
  const W = 1024;
  const H = 256;
  await Promise.all([
    document.fonts?.load(`500 128px ${serif}`, big),
    document.fonts?.load(`600 40px ${sans}`, small),
  ]).catch(() => undefined);
  return labelTexture((ctx) => {
    ctx.textBaseline = 'alphabetic';
    ctx.shadowBlur = 5;
    ctx.font = `500 128px ${serif}`;
    ctx.textAlign = 'center';
    ctx.fillText(big, W / 2, H * 0.58);
    ctx.shadowBlur = 3;
    ctx.font = `600 40px ${sans}`;
    spaced(ctx, small.toUpperCase(), W / 2, H * 0.9, 12);
  }, W, H);
}

/** The beam: open cone, additive, rim-bright, fading up its length, with a
 *  slow drift of motes. `uAmount` is the station's emphasis. Its alpha is
 *  NO_DEPTH: a haze of light is not a surface to focus on. */
function beamMaterial() {
  return lightLayer(new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: CHAMPAGNE.clone() },
      uAmount: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAmount;
      uniform float uTime;
      varying vec3 vN;
      varying vec3 vV;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        // Rim-bright: a thin shell of light seen edge-on is brighter, which is
        // what makes a cone of light read as a volume and not as a lampshade.
        // pow() of a negative base is NaN, and both bases can dip below zero by
        // a rounding error: |dot| of two unit vectors past 1.0 at a grazing
        // pixel, and an interpolated v past 1.0 on the rim. One such pixel,
        // spread by the lens and the bloom, whited out half the frame at the
        // second station. Clamped, both are exact at their ends.
        float rim = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.6);
        // v runs 0 at the lens to 1 at the plan: strong at the source.
        float along = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.35) * smoothstep(0.0, 0.05, vUv.y) + 0.12 * vUv.y;
        // Motes: sparse points drifting up the cone.
        vec2 g = vec2(vUv.x * 48.0, vUv.y * 22.0 - uTime * 0.35);
        float m = step(0.985, hash(floor(g))) * smoothstep(0.5, 0.0, length(fract(g) - 0.5));
        float a = ((0.1 + 0.9 * rim) * along * 0.55 + m * 0.35 * (1.0 - vUv.y)) * 0.42;
        gl_FragColor = vec4(uColor * a * uAmount, ${NO_DEPTH.toExponential()});
      }`,
    side: THREE.DoubleSide,
  }));
}

/**
 * A LABEL IS GILT LETTERING, NOT LIGHT.
 *
 * The first version drew the names as additive champagne light, and on the
 * walnut behind the first station they glowed beautifully — and against the
 * ivory corner behind the second they vanished, because light added to a bright
 * wall is a bright wall. A name has to read on both. So the letters are solid
 * gilt, laid over the frame with normal blending (the colour of gold leaf a
 * shade brighter than the lit plaster): bright gold on walnut, gold on ivory.
 * That is also the more old-money answer — brass lettering, not a screen.
 *
 * Two draws share the plane. The letters blend colour and leave the frame's
 * alpha alone; a second, colourless draw stamps the letters' depth into that
 * alpha with a MIN blend, so the hall's lens holds the name sharp.
 */
type LabelUniforms = {
  map: { value: THREE.Texture | null };
  uOpacity: { value: number };
};

const LABEL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

/** Gold leaf in the hall's scene-linear light: prints to about (230, 205, 135)
 *  at the hall's exposure, a step brighter and warmer than lit ivory plaster. */
const GILT = new THREE.Color().setRGB(0.44, 0.31, 0.12, THREE.LinearSRGBColorSpace);

function giltLetters(u: LabelUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { ...u, uColor: { value: GILT.clone() } },
    vertexShader: LABEL_VERTEX,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(map, vUv);
        gl_FragColor = vec4(uColor * t.rgb, t.a * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
}

function depthStamp(u: LabelUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: LABEL_VERTEX,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vDepth;
      void main() {
        float cover = texture2D(map, vUv).a * uOpacity;
        gl_FragColor = vec4(0.0, 0.0, 0.0, cover > 0.08 ? max(vDepth, 1.05) : ${NO_DEPTH.toExponential()});
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.MinEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
  });
}

/**
 * THE UNDER-GLOW. The third review: "add a subtle, volumetric under-glow to the
 * tables so the models appear as curated, high-value museum exhibits". A pool
 * of warm light on the marble round each table's foot and a halo on its top
 * round the instrument — the light a lit exhibit spills — both answering the
 * station's emphasis, so the table the camera is at is the one that glows.
 * Additive in colour; the alpha (the lens's depth) is left alone.
 */
const GLOW_FRAG = /* glsl */ `
  uniform vec3  uWarm;
  uniform float uAmount;
  uniform float uEdge;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float pool = exp(-r * r * 3.0) * (1.0 - smoothstep(uEdge, 1.0, r));
    gl_FragColor = vec4(uWarm * pool * uAmount, 0.0);
  }
`;
const GLOW_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
function glowMaterial(power: number, edge: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uWarm: { value: new THREE.Color('#FFC98A').multiplyScalar(power) },
      uAmount: { value: 0.3 },
      uEdge: { value: edge },
    },
    vertexShader: GLOW_VERT,
    fragmentShader: GLOW_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
}

export function StationDressing({
  root,
  anchor,
  project,
  emphasis,
}: {
  root: THREE.Object3D | null;
  anchor: StationAnchor;
  project: StationDetails | null;
  emphasis: React.MutableRefObject<number>;
}) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const parts = useRef<{
    brass: THREE.MeshStandardMaterial[];
    beam: THREE.ShaderMaterial | null;
    labels: LabelUniforms[];
    glows: THREE.ShaderMaterial[];
  }>({ brass: [], beam: null, labels: [], glows: [] });

  const geometry = useMemo(() => {
    const lathe = new THREE.LatheGeometry(
      PROJECTOR_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
      72,
    );
    lathe.computeVertexNormals();
    return lathe;
  }, []);

  useEffect(() => {
    if (!root) return;
    // One object for the life of the component; named here so the cleanup
    // does not read the ref.
    const store = parts.current;
    const box = root.getObjectByName(`projector_${anchor.id}`) as THREE.Mesh | undefined;
    const lens = root.getObjectByName(`projlens_${anchor.id}`) as THREE.Mesh | undefined;
    const holo = root.getObjectByName(`HOLO_${anchor.id}`);
    if (!box) return;
    const undo: (() => void)[] = [];
    const hide = (o: THREE.Object3D | undefined) => {
      if (!o || !(o as THREE.Mesh).isMesh) return;
      const was = (o as THREE.Mesh).material;
      // Hidden by an invisible material rather than `visible = false`: a hidden
      // parent would hide the instrument hung beneath it.
      const nothing = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
      (o as THREE.Mesh).material = nothing;
      undo.push(() => {
        (o as THREE.Mesh).material = was;
        nothing.dispose();
      });
    };
    hide(box);
    hide(lens);

    // THE INSTRUMENT, hung under the box's own node so it is seated with it.
    const brass = probe(
      new THREE.MeshStandardMaterial({ name: 'MAT_Projector_Brass', color: '#c9a060', metalness: 1, roughness: 0.3 }),
    );
    const body = new THREE.Mesh(geometry, brass);
    body.name = `projector_turned_${anchor.id}`;
    body.position.y = -BOX_HALF;
    box.add(body);

    // The lens: a crystal cabochon over a glowing core.
    const crystal = probe(
      new THREE.MeshStandardMaterial({
        name: 'MAT_Projector_Crystal',
        color: '#ffffff',
        metalness: 0,
        roughness: 0.04,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.03, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), crystal);
    dome.position.y = -BOX_HALF + LENS_TOP - 0.004;
    dome.scale.y = 0.6;
    box.add(dome);
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.022, 32).rotateX(-Math.PI / 2),
      // Opaque and standard, so it writes its depth for the lens like the
      // brass around it: an unlit black with an emissive glow.
      new THREE.MeshStandardMaterial({
        color: '#000000',
        emissive: CHAMPAGNE,
        emissiveIntensity: 1.0,
        envMap: hallEnv.texture ?? hallEnv.stand,
        defines: { ESTATE_FOCUS: '' },
      }),
    );
    core.position.y = -BOX_HALF + LENS_TOP + 0.001;
    box.add(core);

    store.brass = [brass, crystal];
    undo.push(() => {
      box.remove(body, dome, core);
      brass.dispose();
      crystal.dispose();
      dome.geometry.dispose();
      core.geometry.dispose();
      (core.material as THREE.Material).dispose();
    });

    // THE UNDER-GLOW: a pool on the floor round the table, a halo on its top.
    {
      const at = box.getWorldPosition(new THREE.Vector3());
      const floorMat = glowMaterial(0.55, 0.55);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2), floorMat);
      floor.name = `station_floor_glow_${anchor.id}`;
      floor.position.copy(root.worldToLocal(new THREE.Vector3(at.x, 0.012, at.z)));
      floor.renderOrder = 1;
      root.add(floor);
      const topMat = glowMaterial(0.16, 0.7);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), topMat);
      top.name = `station_top_glow_${anchor.id}`;
      top.position.copy(root.worldToLocal(new THREE.Vector3(at.x, TABLE_TOP + 0.006, at.z)));
      top.renderOrder = 1;
      root.add(top);
      store.glows = [floorMat, topMat];
      // Compiled with the hall, like the instrument below.
      void warmHallPrograms(gl, camera, floor, hallEnv.stand);
      void warmHallPrograms(gl, camera, top, hallEnv.stand);
      undo.push(() => {
        root.remove(floor, top);
        floor.geometry.dispose();
        top.geometry.dispose();
        floorMat.dispose();
        topMat.dispose();
        store.glows = [];
      });
    }

    // THE BEAM, only where there is something to project.
    if (project && holo) {
      const height = Math.max(0.2, anchor.holoY - TABLE_TOP - LENS_TOP - 0.02);
      const cone = new THREE.CylinderGeometry(0.42, 0.018, height, 64, 1, true);
      cone.translate(0, height / 2, 0);
      const beamMat = beamMaterial();
      const beam = new THREE.Mesh(cone, beamMat);
      beam.name = `projector_beam_${anchor.id}`;
      beam.position.y = -BOX_HALF + LENS_TOP + 0.002;
      beam.renderOrder = 2;
      box.add(beam);
      store.beam = beamMat;
      undo.push(() => {
        box.remove(beam);
        cone.dispose();
        beamMat.dispose();
        store.beam = null;
      });
    }

    // THE WORDS, on the cards the plan was authored with.
    let dead = false;
    if (project && holo) {
      const card = (suffix: string) => root.getObjectByName(`holo3d_${anchor.id}_${suffix}`) as THREE.Mesh | undefined;
      const place = async (suffix: string, w: number, h: number, make: () => Promise<THREE.Texture>) => {
        const target = card(suffix);
        if (!target) return;
        hide(target);
        const u: LabelUniforms = { map: { value: null }, uOpacity: { value: 0 } };
        const geometry = new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2);
        const letters = new THREE.Mesh(geometry, giltLetters(u));
        const stamp = new THREE.Mesh(geometry, depthStamp(u));
        letters.name = `holo_label_${anchor.id}_${suffix}`;
        for (const m of [letters, stamp]) {
          m.position.copy(target.position);
          m.quaternion.copy(target.quaternion);
          // Up the card's own face (the plane's -z once laid flat), so the
          // name sits above the leader that rises to it instead of on it.
          m.position.add(new THREE.Vector3(0, 0, -h * 0.35).applyQuaternion(target.quaternion));
          m.renderOrder = 4;
          holo.add(m);
        }
        store.labels.push(u);
        undo.push(() => {
          holo.remove(letters, stamp);
          geometry.dispose();
          u.map.value?.dispose();
          (letters.material as THREE.Material).dispose();
          (stamp.material as THREE.Material).dispose();
        });
        const tex = await make();
        if (dead) {
          tex.dispose();
          return;
        }
        u.map.value = tex;
      };
      void place('title_card', 0.62, 0.155, () => titleTexture(project));
      // The model's own rule under the title card would strike through the
      // name, which is larger than the card it replaces.
      hide(card('title_rule'));
      if (project.total) void place('c0_card', 0.27, 0.0675, () => calloutTexture(String(project.total), 'plots'));
      // A second "113" beside the first says nothing; when every plot is open,
      // say that instead.
      const all = project.total != null && project.available === project.total;
      const open = project.soldOut
        ? (['Sold', 'out'] as const)
        : all
          ? (['Open', 'every plot'] as const)
          : project.available != null
            ? ([String(project.available), 'available'] as const)
            : null;
      if (open) void place('c1_card', 0.27, 0.0675, () => calloutTexture(open[0], open[1]));
      // c2 has nothing true to say from the data we hold; its card goes dark.
      const c2 = card('c2_card');
      hide(c2);
      for (const s of ['c2_dot', 'c2_leader', 'c2_rule']) hide(card(s));
    }

    // Compile what was just built now, under the hall's light state, rather
    // than on the frame this station first comes into view.
    void warmHallPrograms(gl, camera, box, hallEnv.stand);
    // The words were hung on the plan synchronously, ahead of their textures.
    if (holo) void warmHallPrograms(gl, camera, holo, hallEnv.stand);

    return () => {
      dead = true;
      store.labels = [];
      for (let i = undo.length - 1; i >= 0; i -= 1) undo[i]();
    };
  }, [root, anchor.id, anchor.holoY, project, geometry, gl, camera]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Emphasis drives the beam and the words; the probe arrives after the room
  // is first photographed.
  useFrame((state, delta) => {
    const e = emphasis.current;
    const p = parts.current;
    const env = hallEnv.texture;
    for (const m of p.brass) {
      if (env && m.envMap !== env) m.envMap = env;
    }
    if (p.beam) {
      p.beam.uniforms.uTime.value = state.clock.elapsedTime;
      const a = p.beam.uniforms.uAmount;
      a.value += (e - a.value) * Math.min(1, delta * 4);
    }
    for (const u of p.labels) {
      u.uOpacity.value += (Math.min(1, 0.25 + e) - u.uOpacity.value) * Math.min(1, delta * 4);
    }
    for (const g of p.glows) {
      const a = g.uniforms.uAmount;
      a.value += (0.3 + 0.7 * e - a.value) * Math.min(1, delta * 3);
    }
  });

  return null;
}
