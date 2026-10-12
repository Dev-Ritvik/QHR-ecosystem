// apps/public/src/components/experience/hallWalnut.ts
//
// THE HALL'S WALNUT: two sheets of veneer, laid at the timber's own size.
//
// The hall's wall panels (wallpanel_*, MAT_Wood_Dark) arrived with a
// parquet-strip texture on UV coordinates that run into the thousands, so the
// texture tiled into mush; hallFinish cleared it and painted the panels a flat
// brown, and a flat brown rectangle with a highlight on it is what the client
// called a television. So the walnut is drawn (tools/gltf/
// make_walnut_veneer.py) and projected here.
//
// ITS FIRST CUT (2026-09-21) was one sheet of six crown-cut leaves stretched
// whole over whatever wore it: a 2.1 m wall panel, the 3.7 m arch behind the
// portrait, a 60 cm model board. The forensic audit of 2026-10-09 (#37): "One
// procedural grain at one scale is used on a three-metre wall panel, a 60 cm
// board and a table top, so the grain is cartoon-large on the small objects."
//
// Now there are two sheets, both at two-thirds of a millimetre to the pixel:
//
//   crown      four crown-cut leaves, book-matched in pairs: the fields of the
//              panelling, the arch behind the portrait, the stair's apron
//   straight   two quarter-cut leaves: the framing (stiles, rails, the dado
//              and the doors), and the small things, which wear it finer
//
// and every surface is laid in METRES: u across the grain, v along it, the
// sheet repeating mirrored (an end match along the grain, a book match across
// it). Nothing stretches a sheet to fit itself any more, so a rail's grain is
// the size of a panel's.
//
// A SATIN FINISH, not a lacquer. At a roughness of 0.24 and the room's whole
// reflection, a panel seen along the wall was a mirror: the audit's "half
// washed pale grey and half black" (#36) was the opposite wall in it. Waxed
// walnut shows a soft sheen and its own colour from every side.
//
// The textures stream in after the hall; until they land every walnut surface
// holds a 1x1 stand-in of the sheet's own mean colour, so nothing recompiles
// when the real maps arrive.

import * as THREE from 'three';
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

export type WalnutCut = 'crown' | 'straight';

/** A leaf's width and a sheet's length along the grain, metres; and how many
 *  leaves each sheet lays side by side (make_walnut_veneer.py). */
export const WALNUT_LEAF = 0.341;
export const WALNUT_SHEET = {
  crown: { url: '/textures/hall/walnut_crown.ktx2', across: 4 * WALNUT_LEAF, along: 4 * WALNUT_LEAF },
  straight: { url: '/textures/hall/walnut_straight.ktx2', across: 2 * WALNUT_LEAF, along: 4 * WALNUT_LEAF },
} as const;

/** The sheets' own mean colour (sRGB), measured from the generated sheets; the
 *  stand-ins and the turned posts use it. */
export const WALNUT_MEAN = '#957457';

/** Waxed, not lacquered: and half the room in it (hallProbe.PROBE_GAIN). */
export const WALNUT_FINISH = { roughness: 0.52, gain: 0.55 } as const;

/**
 * THE SHEET'S TONE UNDER THE BAKE (linear, a multiplier on the sheet). The
 * sheets are drawn at a waxed mid-brown, three times the first sheet's
 * chocolate, because the panelling takes its light from the room's probe and
 * at the old tone it was an espresso band round a room that is to be bright
 * (make_walnut_veneer.py). The two fields the bake lights - the arch the
 * portrait hangs on, the apron under the landing - stand in a far stronger
 * light, and at the new sheet's own tone printed a pale honey (the arch: 207,
 * 177, 138 where it had been 172, 144, 114). This is the old sheet's mean over
 * the new one's, channel by channel, so those two print as they were approved:
 * the portrait's own ground is the client's ("the portrait is fine as it is").
 */
export const BAKED_TONE = [0.373, 0.351, 0.337] as const;

/**
 * The flat walnut fields the hall's own file carries and the bake reaches: the
 * arched panel the portrait hangs on and the panel on the court's face of the
 * landing (imperial_hall_v7.py). Each keeps its bake and takes the crown sheet
 * at its true size. (The wall panels are no longer among them: they are built
 * as framed panelling, hallPanelling.ts.)
 */
const BAKED_FIELD = /^(arch_panel|stair_apron_panel)/;

/**
 * Planar UVs across one flat panel, in METRES of veneer: u across the panel
 * from its centre line (so the book match meets on it), v from its top edge
 * down. KTX2 textures load with flipY false, so v = 0 — the sheet's first row,
 * a leaf's top — lands on the panel's top edge, and the flames point up.
 *
 * The axes are read from the mesh's world matrix rather than assumed: the thin
 * local axis is the wall normal, and of the other two, the one closest to
 * world up is up. Sizes are world sizes (a node's scale is part of them).
 */
export function projectPanelUVs(mesh: THREE.Mesh, cut: WalnutCut = 'crown'): void {
  const g = mesh.geometry as THREE.BufferGeometry;
  const pos = g.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return;
  g.computeBoundingBox();
  const b = g.boundingBox!;
  const min = [b.min.x, b.min.y, b.min.z];
  const ext = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
  mesh.updateWorldMatrix(true, false);
  const e = mesh.matrixWorld.elements;
  const cols = [
    [e[0], e[1], e[2]],
    [e[4], e[5], e[6]],
    [e[8], e[9], e[10]],
  ];
  const scale = cols.map((c) => Math.hypot(c[0], c[1], c[2]) || 1);
  const upness = cols.map((c, i) => c[1] / scale[i]);
  const thin = ext.indexOf(Math.min(...ext));
  const others = [0, 1, 2].filter((i) => i !== thin);
  const up = Math.abs(upness[others[0]]) >= Math.abs(upness[others[1]]) ? others[0] : others[1];
  const along = others[0] === up ? others[1] : others[0];
  const upSign = upness[up] >= 0 ? 1 : -1;
  const sheet = WALNUT_SHEET[cut];

  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    // metres from the panel's centre line, and down from its top edge
    const across = (p[along] - min[along] - ext[along] / 2) * scale[along];
    const h = (p[up] - min[up]) * scale[up];
    const down = upSign > 0 ? ext[up] * scale[up] - h : h;
    uv[i * 2] = across / sheet.across;
    uv[i * 2 + 1] = down / sheet.along;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function standIn(hex: string): THREE.DataTexture {
  // The texture's bytes are sRGB-encoded, as the hex is. (They were written
  // from a THREE.Color once, whose channels are linear: a stand-in a third as
  // bright as the sheet it stood in for.)
  const n = parseInt(hex.slice(1), 16);
  const t = new THREE.DataTexture(new Uint8Array([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]), 1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * The sheets as they stand, for whatever else in the room is made of the same
 * timber (the site models' trays, StationModel.tsx): null until the hall has
 * its stock, a stand-in until a sheet has streamed in. `version` moves when a
 * sheet lands.
 */
export const walnutSheets: {
  crown: THREE.Texture | null;
  straight: THREE.Texture | null;
  version: number;
} = { crown: null, straight: null, version: 0 };

export interface WalnutStock {
  /** A walnut surface the bake does not reach, in one of the two cuts. Each
   *  call is a material of its own (a caller may want vertex colours). */
  material(cut: WalnutCut, name: string, params?: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial;
  /** How many of the hall's own baked fields were laid with the crown sheet. */
  fields: number;
  dispose(): void;
}

/**
 * The hall's stock of walnut: the two sheets (streamed), a maker of materials
 * that wear them, and the hall's own baked fields laid with the crown sheet.
 * Synchronous for the geometry and the materials, so the hall's reflection
 * probe (hallProbe.ts), which is prepared after this, binds every walnut
 * surface with everything else; the maps swap in when they arrive.
 */
export function stockWalnut(root: THREE.Object3D, ktx2: Pick<KTX2Loader, 'load'>): WalnutStock {
  const stand = { crown: standIn(WALNUT_MEAN), straight: standIn(WALNUT_MEAN) };
  const sheets: Record<WalnutCut, THREE.Texture> = { ...stand };
  const wearing: Record<WalnutCut, THREE.MeshStandardMaterial[]> = { crown: [], straight: [] };
  walnutSheets.crown = sheets.crown;
  walnutSheets.straight = sheets.straight;
  walnutSheets.version += 1;

  const finish = (m: THREE.MeshStandardMaterial, cut: WalnutCut) => {
    m.color.set('#ffffff');
    m.map = sheets[cut];
    m.roughness = WALNUT_FINISH.roughness;
    m.roughnessMap = null;
    m.metalness = 0;
    m.metalnessMap = null;
    m.normalMap = null;
    m.needsUpdate = true;
    wearing[cut].push(m);
  };

  // The hall's own flat fields: each baked material gets one veneered clone,
  // so a baked panel keeps its bake.
  const fields: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = [];
  const originalUV = new Map<THREE.BufferGeometry, THREE.BufferAttribute | undefined>();
  const veneers = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !BAKED_FIELD.test(mesh.name)) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (Array.isArray(mat) || !mat?.isMeshStandardMaterial) return;
    let walnut = veneers.get(mat);
    if (!walnut) {
      walnut = mat.clone();
      walnut.name = 'MAT_Walnut_Crown_LM';
      finish(walnut, 'crown');
      walnut.color.setRGB(BAKED_TONE[0], BAKED_TONE[1], BAKED_TONE[2], THREE.LinearSRGBColorSpace);
      veneers.set(mat, walnut);
    }
    const g = mesh.geometry as THREE.BufferGeometry;
    fields.push({ mesh, material: mesh.material });
    if (!originalUV.has(g)) {
      originalUV.set(g, g.getAttribute('uv') as THREE.BufferAttribute | undefined);
      projectPanelUVs(mesh, 'crown');
    }
    mesh.material = walnut;
  });

  const made: THREE.MeshStandardMaterial[] = [];
  let dead = false;
  const loaded: THREE.Texture[] = [];
  for (const cut of ['crown', 'straight'] as const) {
    ktx2.load(
      WALNUT_SHEET[cut].url,
      (tex) => {
        if (dead) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        // An end match along the grain and a book match across it.
        tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
        loaded.push(tex);
        sheets[cut] = tex;
        for (const m of wearing[cut]) m.map = tex;
        walnutSheets[cut] = tex;
        walnutSheets.version += 1;
      },
      undefined,
      // A missing sheet leaves the stand-in: a flat walnut, not a hole.
      () => {},
    );
  }

  return {
    fields: fields.length,
    material(cut, name, params) {
      const m = new THREE.MeshStandardMaterial(params);
      m.name = name;
      finish(m, cut);
      made.push(m);
      return m;
    },
    dispose() {
      dead = true;
      for (const p of fields) p.mesh.material = p.material;
      for (const [g, uv] of originalUV) {
        if (uv) g.setAttribute('uv', uv);
        else g.deleteAttribute('uv');
      }
      for (const m of [...veneers.values(), ...made]) m.dispose();
      for (const t of [...loaded, stand.crown, stand.straight]) t.dispose();
      if (walnutSheets.crown === sheets.crown) walnutSheets.crown = null;
      if (walnutSheets.straight === sheets.straight) walnutSheets.straight = null;
      walnutSheets.version += 1;
    },
  };
}
