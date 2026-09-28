// apps/public/src/components/experience/hallWalnut.ts
//
// THE PANELLING, IN WALNUT.
//
// The hall's wall panels (wallpanel_*, MAT_Wood_Dark) were the least expensive
// thing in it. They arrived with a parquet-strip texture on UV coordinates that
// run into the thousands (measured on the GLB: u -2879..2880, v -1499..1500), so
// the texture tiled into mush; hallFinish cleared it and painted the panels a
// flat brown, and a flat brown rectangle with a highlight on it is what the
// client called a television.
//
// Real boiserie is one book-matched set of veneer leaves per field. So each
// panel is re-projected here onto its own face — u across the panel, v from its
// top edge down — and carries one whole sheet of walnut veneer
// (tools/gltf/make_walnut_veneer.py): six crown-cut leaves, mirrored in pairs,
// cathedral figure pointing up, under a lacquer whose roughness follows the
// pores. Every panel shows the same sheet, which is exactly what a set of
// panels cut from one flitch looks like.
//
// The textures stream in after the hall; until they land the panels hold 1x1
// stand-ins of the same average colour and roughness, so nothing recompiles
// when the real maps arrive.

import * as THREE from 'three';
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

export const WALNUT_MAPS = {
  map: '/textures/hall/walnut_basecolor.ktx2',
  roughness: '/textures/hall/walnut_roughness.ktx2',
} as const;

/** The veneer's own mean colour (sRGB) and lacquer roughness, measured from
 *  the generated sheet; the stand-ins and the turned posts use them. */
export const WALNUT_MEAN = '#5e4632';
const WALNUT_ROUGHNESS_MEAN = 0.24;

/**
 * The walnut fields: the wall panels, and since the imperial hall the arched
 * panel the portrait hangs on and the panel on the court's face of the landing
 * (imperial_hall_v7.py). The wall panels are instanced and unbaked; the two new
 * ones are lightmapped, so each source material gets its own veneer clone and
 * a baked panel keeps its bake.
 */
const PANEL = /^(wallpanel|arch_panel|stair_apron_panel)/;

/**
 * Planar UVs across one panel, in its geometry's local space: u along the wall,
 * v from the top edge down. KTX2 textures load with flipY false, so v = 0 — the
 * veneer sheet's first row, its top — lands on the panel's top edge.
 *
 * The axes are read from the mesh's world matrix rather than assumed: the thin
 * local axis is the wall normal, and of the other two, the one closest to world
 * up is up.
 */
export function projectPanelUVs(mesh: THREE.Mesh): void {
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
  const upness = cols.map((c) => c[1] / (Math.hypot(c[0], c[1], c[2]) || 1));
  const thin = ext.indexOf(Math.min(...ext));
  const others = [0, 1, 2].filter((i) => i !== thin);
  const up = Math.abs(upness[others[0]]) >= Math.abs(upness[others[1]]) ? others[0] : others[1];
  const along = others[0] === up ? others[1] : others[0];
  const upSign = upness[up] >= 0 ? 1 : -1;

  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const u = (p[along] - min[along]) / (ext[along] || 1);
    const h = (p[up] - min[up]) / (ext[up] || 1);
    uv[i * 2] = u;
    uv[i * 2 + 1] = upSign > 0 ? 1 - h : h;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function standIn(hex: string, colorSpace: THREE.ColorSpace): THREE.DataTexture {
  const c = new THREE.Color(hex);
  const t = new THREE.DataTexture(
    new Uint8Array([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255]),
    1,
    1,
  );
  t.colorSpace = colorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Dress every panel under `root` in the walnut sheet. Synchronous for the
 * geometry and the material, so the hall's reflection probe (hallProbe.ts),
 * which is prepared after this, binds the new material with everything else;
 * the maps swap in when they arrive.
 */
export function dressWalnut(
  root: THREE.Object3D,
  ktx2: KTX2Loader,
): { panels: number; dispose: () => void } {
  const panels: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = [];
  // Per GEOMETRY, captured before its first projection: panels can share one.
  const originalUV = new Map<THREE.BufferGeometry, THREE.BufferAttribute | undefined>();
  const veneers = new Map<THREE.Material, THREE.MeshStandardMaterial>();

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !PANEL.test(mesh.name)) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (Array.isArray(mat) || !mat?.isMeshStandardMaterial) return;
    let walnut = veneers.get(mat);
    if (!walnut) {
      walnut = mat.clone();
      veneers.set(mat, walnut);
      walnut.name = 'MAT_Walnut_Panel';
      walnut.color.set('#ffffff');
      walnut.map = standIn(WALNUT_MEAN, THREE.SRGBColorSpace);
      walnut.roughness = 1;
      walnut.roughnessMap = standIn(
        `#${Math.round(WALNUT_ROUGHNESS_MEAN * 255).toString(16).padStart(2, '0').repeat(3)}`,
        THREE.NoColorSpace,
      );
      walnut.metalness = 0;
      walnut.normalMap = null;
      walnut.metalnessMap = null;
      walnut.needsUpdate = true;
    }
    const g = mesh.geometry as THREE.BufferGeometry;
    panels.push({ mesh, material: mesh.material });
    if (!originalUV.has(g)) {
      originalUV.set(g, g.getAttribute('uv') as THREE.BufferAttribute | undefined);
      projectPanelUVs(mesh);
    }
    mesh.material = walnut;
  });

  let dead = false;
  const loaded: THREE.Texture[] = [];
  const materials = [...veneers.values()];
  if (materials.length) {
    const bind = (url: string, apply: (t: THREE.Texture) => void) => {
      ktx2.load(
        url,
        (tex) => {
          if (dead) {
            tex.dispose();
            return;
          }
          tex.anisotropy = 8;
          tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
          loaded.push(tex);
          apply(tex);
        },
        undefined,
        // A missing sheet leaves the stand-in: a flat walnut, not a hole.
        () => {},
      );
    };
    // One sheet, shared by every veneer; each drops its own stand-in.
    bind(WALNUT_MAPS.map, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      for (const m of materials) {
        m.map?.dispose();
        m.map = t;
      }
    });
    bind(WALNUT_MAPS.roughness, (t) => {
      t.colorSpace = THREE.NoColorSpace;
      for (const m of materials) {
        m.roughnessMap?.dispose();
        m.roughnessMap = t;
      }
    });
  }

  return {
    panels: panels.length,
    dispose() {
      dead = true;
      for (const p of panels) p.mesh.material = p.material;
      for (const [g, uv] of originalUV) {
        if (uv) g.setAttribute('uv', uv);
        else g.deleteAttribute('uv');
      }
      for (const m of materials) {
        // the stand-ins are each material's own; the loaded sheet is shared
        if (m.map && !loaded.includes(m.map)) m.map.dispose();
        if (m.roughnessMap && !loaded.includes(m.roughnessMap)) m.roughnessMap.dispose();
        m.dispose();
      }
      for (const t of loaded) t.dispose();
    },
  };
}
