'use client';

// apps/public/src/components/experience/StationModel.tsx
//
// THE SITE MODEL ON ITS STAND.
//
// The refinement brief (2026-10-03, section E; ordered by the client
// 2026-10-04): "Replace the glowing/translucent sci-fi presentation with a
// tactile, architectural-model treatment: physical/digital scale model,
// gallery object, matte architectural material, wood/card/marble-like
// treatment ... Reduce the number of simultaneous visual layers around the
// model. The section should communicate 'beautiful way to understand land',
// not 'cool WebGL effect'." Its reference standard is the film's own last
// frame, the map table: plaster on a dark ground in a brass bezel, on walnut.
//
// WHAT STANDS ON THE TABLE NOW. Where the plan was projected, at the same
// place and tilt in the frame (so every station's shot, copy and lens stand as
// they were), the layout is a made thing:
//
//   THE MODEL    every plot of the sanctioned plan a block of ivory plaster on
//                a walnut board, its number and its dimensions engraved where
//                the sanctioned sheet prints them; the open land a sage inlay;
//                land held back a stone slab
//                (tools/blender/make_plan_model_geo.py, from the same cells
//                the hall's own plan was built from, solid; its face is
//                tools/gltf/make_plan_models.py's).
//   THE TRAY     walnut, with a brass bezel, a brass fillet round the plan and
//                the layout's name on an ebonised plaque in gilt capitals:
//                the storyboard's "name of the project and its floor map",
//                as the founder's portrait carries its own.
//   THE STAND    a turned brass column on the table's centre, a ball at its
//                head, the tray on a hub over it.
//
// WHAT IS GONE: the projector, its beam and motes, the frosted pane, the scan
// line, the lettering hanging in the air and its leaders, the warm pool under
// the table. One object, lit by the room.
//
// IT TURNS. Turning the table turns the model with it, in its own plane, on
// the stand's hub (the tray is a turntable's platter; the stand, like the
// projector before it, holds still, as the storyboard asks: "the whole system
// must not move"). So a visitor does what the room's copy tells them — "Turn
// one to read it from another side" — and the plan stays facing them while it
// turns. At rest it is still: an idle drift would turn a model someone is
// reading.
//
// ITS LIGHT. The hall's light is baked and the room has one real-time light
// (the portrait's), so the model takes the room from the hall's own probe and
// its key from the chandelier, added per pixel as the map table's sun is
// (MapTable.tsx): the lamp that hangs over the room is what lights a model
// standing in it, and it keeps its print when the house lights go down, as
// every lamp does (hallLight.ts).

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { StationAnchor } from './interiorPath';
import { hallEnv, hallKTX2 } from './HallModel';
import { PROBE_DEFINES, warmHallPrograms } from './hallProbe';
import { trackHallMaterial, untrackHallMaterials } from './hallLight';
import { cssFamily, glowMaterial, spaced, type StationDetails } from './StationDressing';

/** The layouts with a model, by the name the hall's file gives a station's
 *  sanctioned sheet (and, failing that, by what the project's slug holds). */
export const PLAN_MODELS = ['kartikeya', 'lucky', 'gayatri'] as const;
export type PlanModel = (typeof PLAN_MODELS)[number];

export function planModelFor(sheet: string | undefined, slug: string | undefined): PlanModel | null {
  const from = `${sheet ?? ''} ${slug ?? ''}`.toLowerCase();
  return PLAN_MODELS.find((p) => from.includes(p)) ?? null;
}

export const planModelUrls = (plan: PlanModel) => ({
  geometry: `/models/plans/${plan}_model.glb`,
  face: `/textures/plans/${plan}_model.ktx2`,
});

/** The table's top, and the hall's chandelier (interior_hall.glb,
 *  LGT_chandelier), three's metres. */
const TABLE_TOP = 0.8;
const CHANDELIER = new THREE.Vector3(0, 10.9, 0);

/**
 * The tray round the plan, metres: a margin on three sides, a rail at the foot
 * for the plaque, a brass bezel standing proud of its edge and a fillet round
 * the plan.
 */
export const TRAY = {
  margin: 0.03,
  rail: 0.088,
  thick: 0.026,
  bezel: 0.008,
  bezelProud: 0.006,
  fillet: 0.003,
  plaque: { width: 0.44, height: 0.04 },
} as const;

/** The stand: the ball at the column's head and the hub the tray turns on. */
export const STAND = { ball: 0.036, hub: 0.014, hubRadius: 0.075, foot: 0.118 } as const;

/** The chandelier on the model, scene-linear; and how much of the room's own
 *  light (its probe) each surface takes. */
export const MODEL_LIGHT = {
  key: [1.0, 0.9, 0.76] as const,
  power: 0.95,
  plaster: 0.55,
  board: 0.6,
  walnut: 0.6,
  brass: 0.85,
} as const;

/** Aged brass, not gilt: the bezel, the fillet and the stand. The first cut
 *  used the projector's polished #c9a060 and the stand read as gold plate;
 *  seen at four tones on the running build, this is the one that reads as old
 *  metal against the walnut. It takes half the chandelier's key: a mirror for
 *  a lamp is what made it gold. */
export const MODEL_BRASS = { colour: '#7b6540', roughness: 0.46, key: 0.5 } as const;

/** The hall's walnut panels (hallWalnut.ts): the tray wears their veneer. */
const PANEL = /^wallpanel/;

const KEY_PARS = /* glsl */ `
uniform vec3 uModelKeyDir;
uniform vec3 uModelKeyColor;
`;
const KEY_LIGHT = /* glsl */ `
{
  IncidentLight keyLight;
  keyLight.direction = uModelKeyDir;
  keyLight.color = uModelKeyColor;
  keyLight.visible = true;
  RE_Direct( keyLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
}
#include <lights_fragment_end>
`;

interface KeyUniforms {
  uModelKeyDir: { value: THREE.Vector3 };
  uModelKeyColor: { value: THREE.Color };
}

/** A surface of the model: the hall's probe and lens depth, the room's dimmer,
 *  and the chandelier's key. */
function surface(
  name: string,
  params: THREE.MeshStandardMaterialParameters,
  room: number,
  key: KeyUniforms,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial(params);
  mat.name = name;
  mat.defines = { ...(mat.defines ?? {}), ...PROBE_DEFINES, ESTATE_FOCUS: '' };
  mat.envMap = hallEnv.texture ?? hallEnv.stand;
  mat.envMapIntensity = room;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, key);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${KEY_PARS}\nvoid main() {`)
      .replace('#include <lights_fragment_end>', KEY_LIGHT);
  };
  mat.customProgramCacheKey = () => 'plan-model';
  // It reflects the room, so it dims with the room's lights (hallLight.ts).
  trackHallMaterial(mat);
  return mat;
}

const SIZE: Readonly<Record<string, number>> = { SCALAR: 1, VEC2: 2, VEC3: 3 };

/**
 * A plan model's file: three meshes (plan_board, plan_tops, plan_sides) of
 * float32 attributes and uint32 indices, as make_plan_model_geo.py writes
 * them. Read here rather than through a loader: there is nothing in it a
 * loader is needed for, and a loader would suspend the stage.
 */
export function parsePlanModel(buf: ArrayBuffer): Record<string, THREE.BufferGeometry> {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('plan model: not a GLB');
  const jsonLength = dv.getUint32(12, true);
  const doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLength))) as {
    nodes: { name: string; mesh: number }[];
    meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[];
    accessors: { bufferView: number; componentType: number; count: number; type: string }[];
    bufferViews: { byteOffset?: number; byteLength: number }[];
  };
  const bin = 20 + jsonLength + 8;
  const read = (i: number) => {
    const a = doc.accessors[i];
    const v = doc.bufferViews[a.bufferView];
    const from = bin + (v.byteOffset ?? 0);
    const bytes = buf.slice(from, from + a.count * SIZE[a.type] * 4);
    return a.componentType === 5125 ? new Uint32Array(bytes) : new Float32Array(bytes);
  };
  const out: Record<string, THREE.BufferGeometry> = {};
  for (const node of doc.nodes) {
    const prim = doc.meshes[node.mesh].primitives[0];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(read(prim.attributes.POSITION), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(read(prim.attributes.NORMAL), 3));
    if (prim.attributes.TEXCOORD_0 !== undefined) {
      geo.setAttribute('uv', new THREE.BufferAttribute(read(prim.attributes.TEXCOORD_0), 2));
    }
    if (prim.attributes.COLOR_0 !== undefined) {
      geo.setAttribute('color', new THREE.BufferAttribute(read(prim.attributes.COLOR_0), 3));
    }
    geo.setIndex(new THREE.BufferAttribute(read(prim.indices), 1));
    out[node.name] = geo;
  }
  return out;
}

/** The plaque: the layout's name in gilt capitals on an ebonised board, a
 *  gilt hairline round it — the founder's nameplate, at a model's size. */
async function plaqueTexture(name: string): Promise<THREE.CanvasTexture> {
  const serif = cssFamily('--font-serif', 'Georgia, serif');
  const W = 1408;
  const H = 128;
  const text = name.toUpperCase();
  await document.fonts?.load(`500 60px ${serif}`, text).catch(() => undefined);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#14100c';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(196, 160, 96, 0.85)';
  ctx.lineWidth = 2;
  ctx.strokeRect(9, 9, W - 18, H - 18);
  ctx.fillStyle = '#d6b678';
  ctx.textBaseline = 'middle';
  let size = 60;
  const tracking = () => size * 0.16;
  const width = () => [...text].reduce((w, c) => w + ctx.measureText(c).width, 0) + tracking() * (text.length - 1);
  ctx.font = `500 ${size}px ${serif}`;
  while (width() > W - 150 && size > 30) {
    size -= 2;
    ctx.font = `500 ${size}px ${serif}`;
  }
  spaced(ctx, text, W / 2, H / 2 + size * 0.04, tracking());
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/** The stand's column, [radius, height above the table], for a head `h` up:
 *  a turned foot, a baluster, a plain shaft, a collar and the cup the ball
 *  sits in. */
function standProfile(h: number): THREE.Vector2[] {
  const p: [number, number][] = [
    // the foot: a stepped plinth and an ogee up to a bead
    [0, 0], [0.115, 0], [STAND.foot, 0.004], [STAND.foot, 0.012], [0.112, 0.016], [0.104, 0.018],
    [0.104, 0.024], [0.09, 0.029], [0.066, 0.036], [0.046, 0.05], [0.036, 0.066], [0.036, 0.072],
    [0.04, 0.076], [0.04, 0.083], [0.034, 0.087],
    // the baluster
    [0.022, 0.1], [0.02, 0.14], [0.026, 0.19], [0.031, 0.23], [0.027, 0.27], [0.019, 0.305],
    [0.019, 0.312], [0.024, 0.316], [0.024, 0.324], [0.018, 0.328], [0.015, 0.36],
    // the shaft, a collar, and the cup the ball sits in
    [0.014, h - 0.12], [0.02, h - 0.09], [0.022, h - 0.075], [0.016, h - 0.06], [0.014, h - 0.03],
    [0.026, h - 0.012], [0.03, h], [0, h],
  ];
  return p.map(([r, y]) => new THREE.Vector2(r, y));
}

/** Look-dev (?debug=1): window.__estateModel = { key, room, relief } holds the
 *  chandelier's power, the room's share and the blocks' height on a running
 *  build. */
const MODEL_DEV =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';

interface Built {
  key: KeyUniforms;
  toLamp: THREE.Vector3;
  spin: THREE.Group;
  plan: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  walnut: THREE.MeshStandardMaterial;
  /** A wall panel's material: its map is the veneer once that has arrived. */
  panel: THREE.MeshStandardMaterial | null;
}

export function StationModel({
  root,
  anchor,
  project,
  turntable,
}: {
  root: THREE.Object3D | null;
  anchor: StationAnchor;
  /** Null for a table with no published project: it stands bare. */
  project: (StationDetails & { slug?: string }) | null;
  /** The table's own turning node (ProjectStation): the model turns with it. */
  turntable: React.MutableRefObject<THREE.Object3D | null>;
}) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const built = useRef<Built | null>(null);
  const name = project?.name ?? null;
  const slug = project?.slug;

  useEffect(() => {
    if (!root) return;
    const holo = root.getObjectByName(`HOLO_${anchor.id}`);
    const station = holo?.parent;
    if (!holo || !station) return;
    const undo: (() => void)[] = [];
    let dead = false;

    // THE PROJECTION IS PUT AWAY, not removed: its nodes are the hall's own,
    // and `?stations=hologram` wants them as they were.
    const hidden: THREE.Object3D[] = [];
    for (const o of [...holo.children, root.getObjectByName(`projector_${anchor.id}`)]) {
      if (o && o.visible) {
        o.visible = false;
        hidden.push(o);
      }
    }
    undo.push(() => {
      for (const o of hidden) o.visible = true;
    });

    // THE GROUND UNDER THE TABLE, which turns and so is not in the room's bake
    // (StationDressing's glow planes, with no warm lift: a shadow and a
    // contact line at the foot, and the shade of the stand on the top).
    {
      root.updateMatrixWorld(true);
      const at = station.getWorldPosition(new THREE.Vector3());
      const floorMat = glowMaterial(0, 1.2, 0.4);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2), floorMat);
      floor.name = `station_floor_ground_${anchor.id}`;
      floor.position.copy(root.worldToLocal(new THREE.Vector3(at.x, 0.012, at.z)));
      floor.renderOrder = 1;
      const topMat = glowMaterial(0, 0.75, STAND.foot);
      topMat.uniforms.uShade.value = 0.34;
      const top = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), topMat);
      top.name = `station_top_ground_${anchor.id}`;
      top.position.copy(root.worldToLocal(new THREE.Vector3(at.x, TABLE_TOP + 0.006, at.z)));
      top.renderOrder = 1;
      root.add(floor, top);
      void warmHallPrograms(gl, camera, floor, hallEnv.stand);
      void warmHallPrograms(gl, camera, top, hallEnv.stand);
      undo.push(() => {
        root.remove(floor, top);
        floor.geometry.dispose();
        top.geometry.dispose();
        floorMat.dispose();
        topMat.dispose();
      });
    }

    const plate = root.getObjectByName(`holo3d_${anchor.id}_plate`) as THREE.Mesh | undefined;
    const sheet = (plate?.material as THREE.MeshStandardMaterial | undefined)?.emissiveMap?.name;
    const plan = name ? planModelFor(sheet, slug) : null;
    if (!plan || !plate?.isMesh || !name) {
      return () => {
        for (let i = undo.length - 1; i >= 0; i -= 1) undo[i]();
      };
    }
    // The plan's size is the plate's it replaces.
    plate.geometry.computeBoundingBox();
    const size = plate.geometry.boundingBox!.getSize(new THREE.Vector3());
    const w = size.x;
    const d = size.z;
    const urls = planModelUrls(plan);
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());

    Promise.all([
      fetch(urls.geometry).then((r) => {
        if (!r.ok) throw new Error(`${urls.geometry} ${r.status}`);
        return r.arrayBuffer();
      }),
      hallKTX2(gl).loadAsync(urls.face),
      plaqueTexture(name),
    ])
      .then(([file, face, plaque]) => {
        if (dead) {
          face.dispose();
          plaque.dispose();
          return;
        }
        face.colorSpace = THREE.SRGBColorSpace;
        face.anisotropy = aniso;
        face.wrapS = face.wrapT = THREE.ClampToEdgeWrapping;
        const parts = parsePlanModel(file);
        // A wall panel, for its veneer (a stand-in of the same colour until
        // the sheet has streamed in: hallWalnut.ts).
        const panels: THREE.MeshStandardMaterial[] = [];
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!panels.length && m.isMesh && PANEL.test(m.name) && !Array.isArray(m.material)) {
            panels.push(m.material as THREE.MeshStandardMaterial);
          }
        });
        const panel = panels[0] ?? null;

        const key: KeyUniforms = {
          uModelKeyDir: { value: new THREE.Vector3(0, 1, 0) },
          uModelKeyColor: { value: new THREE.Color(...MODEL_LIGHT.key).multiplyScalar(MODEL_LIGHT.power) },
        };
        const L = MODEL_LIGHT;
        // The metal's own share of the key, on the same direction.
        const brassKey: KeyUniforms = {
          uModelKeyDir: key.uModelKeyDir,
          uModelKeyColor: { value: key.uModelKeyColor.value.clone().multiplyScalar(MODEL_BRASS.key) },
        };
        const mats = {
          tops: surface('MAT_PlanModel_Plaster', { map: face, roughness: 0.86, metalness: 0 }, L.plaster, key),
          sides: surface('MAT_PlanModel_Edge', { vertexColors: true, roughness: 0.9, metalness: 0 }, L.plaster, key),
          board: surface('MAT_PlanModel_Board', { map: face, roughness: 0.4, metalness: 0 }, L.board, key),
          walnut: surface('MAT_PlanModel_Walnut', { map: panel?.map ?? null, color: panel?.map ? '#ffffff' : '#5e4632', roughness: 0.4, metalness: 0 }, L.walnut, key),
          brass: surface('MAT_PlanModel_Brass', { color: MODEL_BRASS.colour, roughness: MODEL_BRASS.roughness, metalness: 1 }, L.brass, brassKey),
          plaque: surface('MAT_PlanModel_Plaque', { map: plaque, roughness: 0.5, metalness: 0 }, L.walnut, key),
        };
        const list = Object.values(mats);
        const geos: THREE.BufferGeometry[] = Object.values(parts);
        const mesh = (g: THREE.BufferGeometry, m: THREE.Material, n: string) => {
          const o = new THREE.Mesh(g, m);
          o.name = `${n}_${anchor.id}`;
          return o;
        };
        const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, m: THREE.Material, n: string) => {
          const g = new THREE.BoxGeometry(sx, sy, sz);
          geos.push(g);
          const o = mesh(g, m, n);
          o.position.set(x, y, z);
          return o;
        };

        // ── what turns: the tray and everything on it, in the plan's own plane
        const spin = new THREE.Group();
        spin.name = `MODEL_${anchor.id}`;
        const planGroup = new THREE.Group();
        planGroup.name = `model_plan_${anchor.id}`;
        planGroup.scale.set(w, 1, d);
        planGroup.add(
          mesh(parts.plan_board, mats.board, 'model_board'),
          mesh(parts.plan_tops, mats.tops, 'model_plots'),
          mesh(parts.plan_sides, mats.sides, 'model_edges'),
        );
        spin.add(planGroup);

        const T = TRAY;
        const outerW = w + 2 * T.margin;
        const outerD = d + T.margin + T.rail;
        const midZ = (T.rail - T.margin) / 2;
        const trayTop = -0.001;
        spin.add(box(outerW, T.thick, outerD, 0, trayTop - T.thick / 2, midZ, mats.walnut, 'model_tray'));
        // The bezel, standing proud of the tray's edge on all four sides.
        const by = trayTop + T.bezelProud / 2 - 0.004;
        const bh = T.bezelProud + 0.008;
        spin.add(
          box(outerW + 2 * T.bezel, bh, T.bezel, 0, by, midZ - outerD / 2 - T.bezel / 2, mats.brass, 'model_bezel_n'),
          box(outerW + 2 * T.bezel, bh, T.bezel, 0, by, midZ + outerD / 2 + T.bezel / 2, mats.brass, 'model_bezel_s'),
          box(T.bezel, bh, outerD, -outerW / 2 - T.bezel / 2, by, midZ, mats.brass, 'model_bezel_w'),
          box(T.bezel, bh, outerD, outerW / 2 + T.bezel / 2, by, midZ, mats.brass, 'model_bezel_e'),
        );
        // The fillet: a brass line let into the walnut round the plan.
        const fy = trayTop + 0.0012;
        const f = T.fillet;
        spin.add(
          box(w + 2 * f, 0.002, f, 0, fy, -d / 2 - f / 2, mats.brass, 'model_fillet_n'),
          box(w + 2 * f, 0.002, f, 0, fy, d / 2 + f / 2, mats.brass, 'model_fillet_s'),
          box(f, 0.002, d, -w / 2 - f / 2, fy, 0, mats.brass, 'model_fillet_w'),
          box(f, 0.002, d, w / 2 + f / 2, fy, 0, mats.brass, 'model_fillet_e'),
        );
        // The plaque, on the rail at the foot of the plan.
        const pw = Math.min(T.plaque.width, w * 0.6);
        const plaqueGeo = new THREE.PlaneGeometry(pw, T.plaque.height).rotateX(-Math.PI / 2);
        geos.push(plaqueGeo);
        const plaqueMesh = mesh(plaqueGeo, mats.plaque, 'model_plaque');
        plaqueMesh.position.set(0, trayTop + 0.0015, d / 2 + T.fillet + (T.rail - T.fillet) / 2);
        spin.add(plaqueMesh);
        holo.add(spin);

        // ── what holds still: the hub under the tray, the ball, the column
        const hubGeo = new THREE.CylinderGeometry(STAND.hubRadius, STAND.hubRadius * 0.8, STAND.hub, 48);
        geos.push(hubGeo);
        const hub = mesh(hubGeo, mats.brass, 'model_hub');
        hub.position.set(0, trayTop - T.thick - STAND.hub / 2, 0);
        holo.add(hub);
        // The ball stands on the table's axis and touches the hub's underside.
        const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(holo.quaternion);
        const under = -trayTop + T.thick + STAND.hub;
        const ballY = holo.position.y - (STAND.ball + under) / Math.max(0.2, normal.y);
        const ballGeo = new THREE.SphereGeometry(STAND.ball, 40, 24);
        geos.push(ballGeo);
        const ball = mesh(ballGeo, mats.brass, 'model_ball');
        ball.position.set(holo.position.x, ballY, holo.position.z);
        const columnGeo = new THREE.LatheGeometry(standProfile(ballY - STAND.ball * 0.7 - TABLE_TOP), 64);
        columnGeo.computeVertexNormals();
        geos.push(columnGeo);
        const column = mesh(columnGeo, mats.brass, 'model_stand');
        column.position.set(holo.position.x, TABLE_TOP, holo.position.z);
        station.add(ball, column);

        // The chandelier, from where the model stands.
        const toLamp = CHANDELIER.clone().sub(holo.getWorldPosition(new THREE.Vector3())).normalize();
        built.current = { key, toLamp, spin, plan: planGroup, materials: list, walnut: mats.walnut, panel };

        // Compiled now, under the hall's light state, not on the frame the
        // station first comes into view.
        void warmHallPrograms(gl, camera, spin, hallEnv.stand);
        void warmHallPrograms(gl, camera, hub, hallEnv.stand);
        void warmHallPrograms(gl, camera, ball, hallEnv.stand);
        void warmHallPrograms(gl, camera, column, hallEnv.stand);

        undo.push(() => {
          built.current = null;
          holo.remove(spin, hub);
          station.remove(ball, column);
          untrackHallMaterials(list);
          for (const m of list) m.dispose();
          for (const g of geos) g.dispose();
          face.dispose();
          plaque.dispose();
        });
      })
      .catch((err) => console.warn('[station] the site model failed to load', anchor.id, err));

    return () => {
      dead = true;
      for (let i = undo.length - 1; i >= 0; i -= 1) undo[i]();
    };
  }, [root, anchor.id, name, slug, gl, camera]);

  const keyView = useRef(new THREE.Vector3());
  /** The table's angle as it stands in the hall's file (the tables are set
   *  down at their own angles: 37, -64 and 112 degrees): the model is square
   *  to its stand at that, and turns by what the table has been turned. */
  const rest = useRef<number | null>(null);
  useFrame(() => {
    const table = turntable.current;
    if (table && rest.current === null) rest.current = table.rotation.y;
    const b = built.current;
    if (!b) return;
    // The tray turns with the table, in its own plane.
    b.spin.rotation.y = table && rest.current !== null ? table.rotation.y - rest.current : 0;
    // The veneer, when the panels have theirs.
    if (b.panel?.map && b.walnut.map !== b.panel.map) {
      // (A first map changes the program; a new sheet in its place does not.)
      if (!b.walnut.map) b.walnut.needsUpdate = true;
      b.walnut.map = b.panel.map;
      b.walnut.color.set('#ffffff');
    }
    // The key, in the view space three's lights are in.
    b.key.uModelKeyDir.value.copy(keyView.current.copy(b.toLamp).transformDirection(camera.matrixWorldInverse));
    const env = hallEnv.texture;
    if (env) {
      for (const m of b.materials) if (m.envMap !== env) m.envMap = env;
    }
    if (MODEL_DEV) {
      const dev = (window as unknown as { __estateModel?: { key?: number; relief?: number } }).__estateModel;
      if (dev) {
        if (typeof dev.key === 'number') b.key.uModelKeyColor.value.setRGB(...MODEL_LIGHT.key).multiplyScalar(dev.key);
        if (typeof dev.relief === 'number') b.plan.scale.y = dev.relief;
      }
    }
  });

  return null;
}
