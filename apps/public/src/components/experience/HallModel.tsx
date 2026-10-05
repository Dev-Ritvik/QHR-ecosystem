'use client';

// apps/public/src/components/experience/HallModel.tsx
//
// Loads interior_hall.glb and honours the contract in
// apps/public/public/models/interior_hall.manifest.json.
//
// The part that is easy to get wrong: baked GI rides in the OCCLUSION slot,
// because glTF has no lightmap slot. GLTFLoader brings it in as material.aoMap
// on uv1, so it has to be promoted to lightMap on load — and the colour space
// declared explicitly, because GLTFLoader treats occlusion as linear data while
// this atlas is sRGB-encoded. Skip that and the room renders roughly twice as
// dark as it was baked.
//
// Both loaders are mandatory: KHR_texture_basisu and KHR_draco_mesh_compression
// are in extensionsRequired, so the file will not parse without them.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { guardAnisotropy } from './materialGuards';
import { finishHall } from './hallFinish';
import { faceTheFrieze, refurnishHall } from './hallJoinery';
import { dressWalnut } from './hallWalnut';
import { applyHallLevel, hallLight, trackHallMaterial, untrackHallMaterials } from './hallLight';
import { dressHallDetail } from './hallDetail';
import { dressFloor } from './hallFloor';
import { hallPortal } from './doorPortal';
import { NO_DEPTH, markFocusDepth } from './LensFocus';
import {
  beginHallProbe,
  installHallProbe,
  type HallProbeCapture,
  isShown,
  prepareHallProbe,
  roomCube,
  warmHallPrograms,
} from './hallProbe';

export const HALL_MODEL_URL = '/models/interior_hall.glb';

// Before any hall program compiles: the box-projected probe and the bake/probe
// split are ShaderChunk edits (hallProbe.ts).
installHallProbe();

/**
 * The hall's reflection probe, for anything in the room that is not part of the
 * GLB — the nameplate, the stations' own pieces. Null until the first capture;
 * `version` moves on every capture so a consumer can re-bind cheaply.
 */
export const hallEnv: {
  texture: THREE.Texture | null;
  version: number;
  /** The 256-face stand-in bound before the capture, for pieces created
   *  before the probe exists (they bind it so their programs never change). */
  stand: THREE.Texture | null;
} = {
  texture: null,
  version: 0,
  stand: null,
};

/**
 * Bind the hall's probe to every standard material under `group` — for pieces
 * that live in the room but not in the GLB (the portrait's nameplate). Explicit,
 * so each keeps its own gain; re-bound whenever the probe is re-captured. Give
 * those materials PROBE_DEFINES when they are created, so the first binding
 * costs no recompile.
 */
export function useProbeBinding(
  group: React.RefObject<THREE.Object3D>,
  gain: (m: THREE.MeshStandardMaterial) => number = () => 1,
) {
  const bound = useRef(-1);
  useFrame(() => {
    const g = group.current;
    if (!g || !hallEnv.texture || bound.current === hallEnv.version) return;
    bound.current = hallEnv.version;
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const mat = m as THREE.MeshStandardMaterial;
        if (!mat?.isMeshStandardMaterial) continue;
        mat.envMap = hallEnv.texture;
        mat.envMapIntensity = gain(mat);
      }
    });
  });
}

/** From interior_hall.manifest.json — the bake's normalisation divisor. Changing
 *  the bake means changing this, so it is named rather than inlined.
 *
 *  3.0801 is the divisor of the bake for the EXTENDED hall (the client review:
 *  "bigger, taller, wider, and importantly longer"). It replaces 4.6597, which
 *  belonged to the 15.0 x 10.6 x 6.4m room: the atlas is normalised by its own
 *  99.5th percentile, and a room whose surfaces stand further from the same
 *  lamps has a lower one. Using the old number would render the new bake 51%
 *  too bright.
 *
 *  3.8566 since the old-money pass: the same lamps RE-BAKED on the same layout
 *  (tools/blender/rebake_hall_lightmap_v7.py, 1024 spp) and denoised
 *  (tools/gltf/finish_hall_lightmap.py). The 99.5th percentile moved because the
 *  tail moved — a noisy atlas and a clean one rank their brightest texels
 *  differently — while the light did not: a flat wall bakes to 0.560 in the
 *  shipped atlas and 0.558 in this one.
 *
 *  8.294 since the hall was made imperial (imperial_hall_v7.py): a new room,
 *  so a new layout and a new bake (768 spp, OIDN-finished). The divisor more
 *  than doubled because the atlas now holds light SOURCES' surroundings the
 *  old room never had — the oculus pools light on the floor under the dome and
 *  the clerestory windows wash the attic walls — and those set the 99.5th
 *  percentile the atlas is normalised by.
 *
 *  5.2441 since the refinement brief (2026-10-03): the REFINED hall (Attic
 *  bases, the stair's apron frames, column shafts unrolled to one lightmap
 *  island each: tools/blender/refine_hall_v7.py, bake_lightmap.py), baked as
 *  two families of light - the lamps, and the windows with the oculus - and
 *  mixed at 1.6 : 0.55 (tools/gltf/mix_hall_passes.py). The lamps lead a
 *  little and the windows' wash is halved, for a room whose panes are now the
 *  sky after sunset (DUSK_GLASS). A fully lamp-led mix (4.5 : 0.1) was tried
 *  and measured: the wall behind the tables' copy came out 2.7 to 3.7 times
 *  brighter and the second table's plan washed out, so the room keeps the
 *  distribution its levels and filters were tuned on. */
const LIGHTMAP_INTENSITY = 5.2441;

let ktx2Singleton: KTX2Loader | null = null;
let dracoSingleton: DRACOLoader | null = null;

/** The shared KTX2 transcoder: one worker pool for the GLB and for every loose
 *  KTX2 texture the hall loads beside it (hallWalnut.ts). */
export function hallKTX2(gl: THREE.WebGLRenderer): KTX2Loader {
  if (!ktx2Singleton) {
    ktx2Singleton = new KTX2Loader()
      .setTranscoderPath('/basis/')
      .detectSupport(gl);
  }
  return ktx2Singleton;
}

/** Loaders are shared across every mount. Creating a KTX2Loader per mount spawns
 *  a fresh worker pool each time, which on mid-tier phones is a stall the user
 *  can feel. */
export function attachLoaders(loader: GLTFLoader, gl: THREE.WebGLRenderer) {
  if (!dracoSingleton) {
    dracoSingleton = new DRACOLoader().setDecoderPath('/draco/');
  }
  loader.setKTX2Loader(hallKTX2(gl));
  loader.setDRACOLoader(dracoSingleton);
}

/** A table's material without its bake, one per baked material, kept across
 *  remounts the way the promotion guard keeps the originals. */
const liveMaterials = new WeakMap<THREE.Material, THREE.Material>();
/** Table geometries already cleared of their floor-level underside. */
const clearedFeet = new WeakSet<THREE.BufferGeometry>();

/**
 * THE TABLES ARE LIT LIVE, NOT BAKED.
 *
 * The client: "the bases of these stations must be fixed". What was wrong was
 * the light, not the turning. The four tables share ONE mesh per part
 * (table_base, table_top, table_inlay), and the bake lightmapped them anyway:
 * four tables baked into the same texels, so every table wore the light of
 * whichever was baked last — in the imperial hall, a pedestal gone nearly
 * black under its own top and a foot whose upper slope glared like a pale
 * paper disc. And a table TURNS (the station's drag), which no bake can
 * follow: the light would have turned with it.
 *
 * So every mesh under a TURNTABLE_* node gets its material without the
 * lightmap, which hands its diffuse to the hall's probe (hallProbe.ts) like
 * the rest of the unbaked joinery; its grounding is drawn by StationDressing.
 * Names are kept, so the finishes and probe gains still find them.
 *
 * AND THE BASE IS INSIDE OUT. Measured on the source mesh: the pedestal's side
 * walls face inward (normal . radial = -1.00), its sloping tops face down, and
 * its underside faces up. Single-sided, the camera looked through the near
 * wall at the inside of the far one — the "black lump" — and through the foot
 * at that underside lying on the floor — the flat pale disc. The live
 * materials are therefore double-sided: three flips a back face's normal
 * toward the viewer (faceDirection), so an inside-out wall shades as the outer
 * surface it should have been, and a correctly built part is unaffected (its
 * back faces are behind its front ones). The underside disc is removed, since
 * double-sided it would fight the marble it lies on.
 */
export function liveTurntables(root: THREE.Object3D): { meshes: number; feet: number } {
  let meshes = 0;
  let feet = 0;
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const underTurntable = (o: THREE.Object3D) => {
    for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) {
      if (p.name.startsWith('TURNTABLE_')) return true;
    }
    return false;
  };
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !underTurntable(mesh)) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let changed = false;
    const live = mats.map((m) => {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat?.lightMap) return m;
      let l = liveMaterials.get(mat);
      if (!l) {
        const c = mat.clone();
        c.lightMap = null;
        c.side = THREE.DoubleSide;
        c.needsUpdate = true;
        liveMaterials.set(mat, c);
        l = c;
      }
      changed = true;
      return l;
    });
    if (changed) {
      mesh.material = Array.isArray(mesh.material) ? live : live[0];
      meshes += 1;
    }

    // The underside: triangles whose three corners all lie on the floor.
    const g = mesh.geometry as THREE.BufferGeometry;
    if (!/^table_base/.test(mesh.name) || clearedFeet.has(g) || !g.index) return;
    clearedFeet.add(g);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const toRootMesh = new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld);
    const onFloor = new Uint8Array(pos.count);
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(toRootMesh);
      onFloor[i] = v.y < 0.004 ? 1 : 0;
    }
    const src = g.index.array;
    const kept: number[] = [];
    for (let t = 0; t < src.length; t += 3) {
      if (onFloor[src[t]] && onFloor[src[t + 1]] && onFloor[src[t + 2]]) continue;
      kept.push(src[t], src[t + 1], src[t + 2]);
    }
    if (kept.length < src.length) {
      g.setIndex(kept);
      feet += 1;
    }
  });
  return { meshes, feet };
}

/**
 * Promote the baked GI from the occlusion slot to lightMap.
 *
 * Idempotent: drei caches the parsed GLTF, so a remount hands back the same
 * material instances. Without the guard a second mount would find aoMap already
 * null and quietly strip the lighting.
 */
export function promoteLightmaps(root: THREE.Object3D): number {
  let promoted = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial & { __lightmapPromoted?: boolean };
      if (!mat || mat.__lightmapPromoted) continue;
      if (!mat.aoMap) continue;

      mat.lightMap = mat.aoMap;
      // Required. GLTFLoader marks occlusion as linear data; this atlas is
      // sRGB-encoded because linear 8-bit puts the room near value 13 and bands.
      mat.lightMap.colorSpace = THREE.SRGBColorSpace;
      mat.lightMapIntensity = LIGHTMAP_INTENSITY;
      mat.aoMap = null;
      mat.__lightmapPromoted = true;
      mat.needsUpdate = true;
      promoted += 1;
    }
  });
  return promoted;
}

/**
 * Collapse the per-material COPIES of the lightmap atlas onto one texture each.
 *
 * THE DEFECT, MEASURED BEFORE IT WAS FIXED.
 *
 * interior_hall.glb carries ONE lightmap image (images[3], 1,472 KB on the
 * wire), referenced by ONE textures[] entry, used by SEVEN materials as
 * occlusionTexture. On the wire it is unambiguously a single asset. At runtime
 * the probe found SEVEN distinct THREE.Texture objects named "lightmap", each
 * 4096x4096 with 13 mip levels and 21,845 KB of transcoded payload — sharing
 * exactly ONE ArrayBuffer and ONE image between them, and FOUR of them already
 * holding their own `__webglTexture` in the renderer's WebGLProperties.
 *
 * Four GL objects for one atlas is 85.3 MB of VRAM where 21.3 MB would do, and
 * the remaining three upload as soon as their materials are drawn — 149 MB at a
 * camera that sees the whole room.
 *
 * WHY THE COPIES EXIST. GLTFLoader's assignTexture clones a texture whenever a
 * material asks for a non-zero texCoord, because `channel` lives on the texture
 * rather than on the binding:
 *
 *     if ( mapDef.texCoord !== undefined && mapDef.texCoord > 0 ) {
 *       texture = texture.clone();
 *       texture.channel = mapDef.texCoord;
 *     }
 *
 * Six of the seven materials declare `texCoord: 1`, so six clones are made. The
 * clone shares `image` and `mipmaps` — which is why there is one ArrayBuffer —
 * but it is a distinct object, and WebGLProperties keys on the object, so each
 * one gets its own upload. Nothing is wrong with the loader or the asset; the
 * cost is structural and it is the consumer's job to collapse it.
 *
 * WHAT IS AND IS NOT MERGED. The key includes `channel` deliberately: the whole
 * reason the clones exist is that they may sample different UV sets, and merging
 * across that would silently re-map the atlas onto the wrong coordinates. It
 * also includes the sampling state that would change a pixel — colour space,
 * wrapping, filtering, flipY and the offset/repeat transform. Two textures share
 * an object only when every one of those agrees, so this cannot change how a
 * single texel is fetched. `MAT_Ceiling_Plaster_LM` declares no texCoord and so
 * keeps its own channel-0 texture; whether that is right for the ceiling is an
 * asset question and is deliberately NOT decided here.
 *
 * The orphans are disposed, not merely dereferenced. three frees a GL texture
 * only on an explicit `dispose()`, so dropping the reference would leave every
 * duplicate resident for the life of the context — the exact leak this exists to
 * remove. Disposing a clone is safe precisely because the payload is shared: the
 * renderer deletes that texture's own GL object and the ArrayBuffer stays owned
 * by the survivor.
 */
export function shareDuplicateTextures(root: THREE.Object3D): {
  merged: number;
  freedMB: number;
} {
  type Keyed = THREE.Texture & { __canonicalised?: boolean };
  const canonical = new Map<string, THREE.Texture>();
  const orphans = new Set<THREE.Texture>();
  const kept = new Set<THREE.Texture>();
  let merged = 0;
  let freedBytes = 0;

  const bytesOf = (t: THREE.Texture): number => {
    const mips = (t as THREE.CompressedTexture).mipmaps;
    if (!mips || !mips.length) return 0;
    let n = 0;
    for (const m of mips) n += (m as { data?: ArrayBufferView }).data?.byteLength ?? 0;
    return n;
  };

  const SLOTS = [
    'map', 'lightMap', 'aoMap', 'normalMap', 'roughnessMap',
    'metalnessMap', 'emissiveMap', 'alphaMap',
  ] as const;

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as unknown as Record<string, unknown>;
      if (!mat) continue;
      for (const slot of SLOTS) {
        const tex = mat[slot] as Keyed | null | undefined;
        // `image` identity is the join: clones share it, unrelated textures
        // cannot. Anything without a decoded source is left alone.
        if (!tex || !tex.image) continue;

        const key = [
          slot,
          // Object identity as a string: a WeakMap-assigned tag would be
          // cleaner, but uuid on the SHARED image is not available, so the
          // image object itself is registered in a side list below.
          imageId(tex.image),
          tex.channel,
          tex.colorSpace,
          tex.wrapS, tex.wrapT,
          tex.magFilter, tex.minFilter, tex.anisotropy,
          tex.flipY ? 1 : 0,
          tex.offset.x, tex.offset.y, tex.repeat.x, tex.repeat.y, tex.rotation,
        ].join('|');

        const first = canonical.get(key);
        if (!first) {
          canonical.set(key, tex);
          kept.add(tex);
          continue;
        }
        if (first === tex) continue;

        freedBytes += bytesOf(tex);
        orphans.add(tex);
        mat[slot] = first;
        merged += 1;
      }
    }
  });

  // Only dispose what nothing kept. A texture can legitimately be both the
  // survivor for one key and a duplicate for another (different slot, same
  // object), and disposing it then would delete a texture still in use.
  for (const t of orphans) {
    if (kept.has(t)) continue;
    t.dispose();
  }

  return { merged, freedMB: +(freedBytes / 1048576).toFixed(2) };
}

/**
 * A stable id for a decoded texture source, so two textures can be compared by
 * the image they share rather than by a name that is neither unique nor
 * required. WeakMap so nothing here can keep an image alive.
 */
const imageIds = new WeakMap<object, number>();
let nextImageId = 1;
function imageId(image: unknown): number {
  if (typeof image !== 'object' || image === null) return 0;
  const existing = imageIds.get(image as object);
  if (existing !== undefined) return existing;
  const id = nextImageId;
  nextImageId += 1;
  imageIds.set(image as object, id);
  return id;
}

/**
 * Remove the punctual lights the GLB carries, because the bake already contains
 * them.
 *
 * `KHR_lights_punctual` is in this file's extensionsRequired, so GLTFLoader
 * instantiates every lamp that was in the Blender scene — and the lightmap was
 * baked FROM those same lamps. Keeping both double-counts the lighting on the
 * 147 lightmapped meshes.
 *
 * This was not a subtle amount. MEASURED at the verified `hall` camera pose:
 *
 *   LGT_chandelier   PointLight  intensity 41307
 *   LGT_portrait     SpotLight   intensity 10327
 *   LGT_sconce_* x8  PointLight  intensity 869.6
 *
 * glTF stores punctual intensity in candela and Blender's exporter derives it
 * from watts, so these arrive as four- and five-figure numbers; with decay 2 and
 * distance 0 they are unbounded. The result was 89.5% of the frame at pure
 * white (mean luma 250.1/255) — a plain lightmapped wall 14m from the camera
 * read (255,255,255). Zeroing them alone took the same frame to 0% clipped,
 * mean 87.9, while zeroing the lightmap gain or the emissive strengths instead
 * changed nothing measurable. These lamps were the whole fault.
 *
 * WorldCanvas already states the contract this restores: inside, GI is baked, so
 * the only real-time light is a low ambient to lift the instanced ornament that
 * carries no lightmap.
 *
 * Removed from the CLONE, so drei's cached parse is untouched and turning this
 * off restores the lamps.
 */
export function stripBakedLights(root: THREE.Object3D): number {
  const lights: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as THREE.Light).isLight) lights.push(o);
  });
  for (const l of lights) l.removeFromParent();
  return lights.length;
}

/**
 * The handful of interior materials the final Blender delivery does NOT fix,
 * and the presentation change the holograms need.
 *
 * THIS FUNCTION USED TO DO FAR MORE. It rebuilt the stair runner (generating a
 * planar UV1 and borrowing the floor rug's carpet maps, dyed oxblood) and lit
 * the founder's portrait with an emissive copy of its own albedo. Both were
 * workarounds for defects in the previous export, and both are now DELETED
 * rather than left in place, because the delivered asset fixes them at source
 * and a workaround that fights a correct asset is worse than no workaround:
 *
 *   MAT_Runner_LM   now ships `carpet_runner_oxblood` on UV0 with roughness,
 *                   normal and the lightmap on UV1 — a real wool runner
 *                   unwrapped along 8.078m of stair arc. The old code would
 *                   have cloned it, overwritten the map with the RUG texture
 *                   and written a competing UV1 over the artist's.
 *   MAT_Portrait    now carries `founder_portrait_graded`, and the glass in
 *                   front of it went from transmission 1.0 (which rendered the
 *                   sky HDRI over the founder's face) to a BLEND pane at 0.1.
 *                   The emissive lift would now double-light a correct
 *                   painting.
 *
 * What is left is only what the delivery genuinely does not address.
 */
/**
 * THE PROJECTION, AND WHY ADDITIVE BLENDING ALONE WAS NEVER GOING TO BE ENOUGH.
 *
 * The plan plates and the extruded plot blocks carry the sanctioned layout sheet
 * as an emissive texture, drawn additively so the room shows through. That is
 * the right instinct and it produced the wrong picture, because of what the
 * sheet actually is. Measured on assets/floorplans/kartikeya_holo_tex.png:
 *
 *     60.0% of pixels above luma 200        the paper
 *      4.6% below luma 60                   the drawing
 *
 * Additive blending emits what is BRIGHT. On a brochure sheet that is the paper,
 * so a station rendered as a white rectangle with the plan washed out inside it
 * — a lightbox on a stick, which is exactly what "essentially a bright quad"
 * described. The plate was not flat because it lacked geometry; the extruded
 * blocks are there, 9,960 vertices of them. They were invisible because they
 * were white-on-white.
 *
 * SO THE PLATE EMITS ITS INK, NOT ITS PAPER. A hologram is a drawing in light,
 * and a drawing in light has always been light lines on nothing — a blueprint,
 * a plan table, a projected transparency. Every line stays exactly where the
 * sanctioned sheet puts it and nothing is redrawn, moved or relabelled; what
 * changes is which end of the sheet's own value range emits. Paper falls out,
 * plot outlines, road edges, dimensions, plot numbers and the greenery come
 * forward.
 *
 * The ink mask is a smoothstep rather than a plain inversion because a plain
 * one leaves the paper emitting at 17% over 60% of the area, which is most of a
 * lightbox back. Luma is read in LINEAR space, after three has decoded the sRGB
 * texture, so the thresholds are linear too: 0.62 is roughly sRGB 205.
 *
 * CHROMA IS KEPT, PARTLY. Neutral ink is tinted to the projection's own colour;
 * saturated ink keeps its hue. That is what lets the lake read as water and the
 * planting as planting on a plan whose whole job is to say which land is which,
 * without turning the station into a colour wheel.
 *
 * THE BLOCK SIDES GET A FRESNEL, and that is what makes the extrusion read as
 * extrusion. MAT_Holo3D_Side is flat white at emissive strength 4: additively
 * blended, a box lit that way is a solid glowing lump with no silhouette. A
 * view-dependent falloff dims the faces square to the lens and keeps the
 * grazing ones, so each plot volume shows its edges and its far wall through
 * its near one. Restrained on purpose — this is a plan of land, not a city of
 * neon.
 */
const HOLO_TINT = new THREE.Color('#FFD9A8');

/**
 * Every hologram gain below, scaled for the hall's print. The gains were set
 * against a hall that left the renderer as clamped scene-linear; the hall now
 * prints through a filmic curve at exposure 2.3 (FilmGrade's HALL_GRADE), which
 * took the plans to a blown cream sheet with the plots washed out. Swept live
 * at the first station: 0.35 of the old gain at exposure 1.0 is where the plots,
 * roads and planting all read in champagne — the plan as a gilded site model
 * rather than a light box — and at exposure 2.3 that is 0.16.
 */
const HOLO_PRINT = 0.16;

/**
 * Per-role treatment. The three materials that carry the plan are doing three
 * different jobs and were all being drawn the same way, which is most of why
 * the station read as one white sheet.
 *
 *   plate   THE DRAWING. Roads, boundaries, plot numbers, dimensions. Pure ink:
 *           a tight window at the very bottom of the sheet's value range, so
 *           what emits is the line work and nothing else. No floor — paper must
 *           reach zero or the plate is a lightbox again.
 *   top     THE PLOT SURFACES, one per extruded volume. A low floor so each
 *           plot reads as a lit face rather than a hole, plus its own patch of
 *           ink so the number and the "30' X 56'" stay legible on top of it.
 *   side    THE EXTRUSION WALLS. No texture at all; a grazing-angle falloff is
 *           the whole treatment, because that is what gives a transparent
 *           volume a silhouette.
 *
 * THE FIRST ATTEMPT USED ONE WINDOW FOR ALL THREE and is worth recording,
 * because it looked plausible and was measurably wrong: smoothstep(0.03, 0.62)
 * emits everything below linear 0.62, which on this sheet is the tree canopies
 * and the road surfaces — so the LANDSCAPING lit up and the plots, whose fills
 * are pale yellow at linear 0.87, went black. A layout plan where the plots are
 * the holes is the product turned inside out.
 */
const HOLO_ROLE = {
  // gain 0.42 -> 0.26. With the paper gone, the plate is the SITE GROUND —
  // the land the plots stand on — and it was rendering brighter than the
  // plots themselves, which puts the product behind its own backdrop.
  //
  // chroma 0.9 -> 0.18 (the art-direction audit: the map should read as "a
  // glowing, frosted-glass hologram", not as a video game). The sheet's print
  // colours made a board game of it — and its north-point stamp, printed in
  // yellow, a gold coin floating beside the plan. In one champagne light the
  // stamp is a drawn compass again; a trace of hue still tells water and
  // planting from plots.
  plate: { lo: 0.004, hi: 0.13, floor: 0.0, gain: 0.26, chroma: 0.18, soft: 0 },
  // chroma 1.1 -> 0.55. At full chroma the plot fills keep the sheet's own
  // print colours — scarlet, bottle green, cobalt — and a hundred saturated
  // blocks read as a board game rather than as a projection. Half-strength
  // keeps which-land-is-which legible while the whole model stays in the
  // projection's colour.
  // And 0.55 -> 0.25 with the audit, for the same reason.
  top: { lo: 0.01, hi: 0.4, floor: 0.2, gain: 0.5, chroma: 0.25, soft: 0 },
} as const;

/**
 * THE BLOCKS ARE SOLID; THE PLAN AND THE LABELS ARE LIGHT.
 *
 * Everything under MAT_Holo* was drawn additively with depthWrite off, and for
 * the plate and the callouts that is right — they are a projection and the room
 * should show through them. For the extruded plot volumes it is not, and the
 * second station is where it showed: from a lower vantage the blocks stack in
 * depth, and additive blending with no depth write sums EVERY layer, so a
 * hundred plot volumes each contributing a fifth of a unit arrived at the frame
 * as a flat white sheet. Overdraw, not exposure.
 *
 * Solid blocks fix it structurally rather than by tuning a number down until
 * the symptom goes: the volumes write depth, so each pixel is one block instead
 * of fifteen, they occlude each other the way a physical site model does, and
 * the plate underneath is correctly hidden where a block stands on it. Their
 * base colour is black and their only output is emissive, so they still read as
 * luminous rather than as lit plastic.
 */
const HOLO_SOLID = /^MAT_Holo3D_(Top|Side)/;

/**
 * THE SCAN. The second client review read the layout models as "raw,
 * untextured CAD data dumps ... grey plastic". A still model in light is a
 * still model; what makes a projection read as projected is that the light
 * moves through it. Every few seconds a fine line of light crosses each model
 * — plan, plot faces and edges alike, in world space so it runs across the
 * whole station at once — and a faint line structure lies across the surfaces,
 * the way a projector's raster does. Both are a few percent of the emission
 * between sweeps; the sweep itself briefly doubles it along one line.
 *
 * One clock for every station, advanced by HallModel.
 */
export const holoClock = { value: 0 };
const HOLO_SCAN = /* glsl */ `
  {
    // A thin band travelling along the station's diagonal, once every ~7 s.
    float s = fract(dot(vHoloWorld.xz, vec2(0.21, 0.09)) - uHoloTime * 0.14);
    float band = smoothstep(0.0, 0.012, s) * (1.0 - smoothstep(0.012, 0.05, s));
    float raster = 0.94 + 0.06 * sin(dot(vHoloWorld, vec3(0.0, 90.0, 60.0)) + uHoloTime * 1.7);
    totalEmissiveRadiance *= raster * (1.0 + 1.3 * band);
  }
`;

function holographic(mat: THREE.MeshStandardMaterial & { __holo?: boolean }) {
  if (mat.__holo) return;
  mat.__holo = true;

  const isSide = /Side$/.test(mat.name);
  const role = /Plate/.test(mat.name) ? HOLO_ROLE.plate : HOLO_ROLE.top;

  const u = {
    uInkLo: { value: role.lo },
    uInkHi: { value: role.hi },
    uInkSoft: { value: role.soft },
    uInkFloor: { value: role.floor },
    // The sides carry no texture, so their whole output is uGain times the
    // grazing term against an authored emissive strength of 4.8 — untamed, a
    // face square to the lens arrives at 4.8, which is five times white.
    //
    // 0.34 -> 0.6 once the tops were lifted above the ground plate. With the
    // ground and the plot faces close in value, the EDGES are what separate one
    // plot volume from the next, and a grazing-angle rim is the only thing in
    // this material doing that.
    uGain: { value: (isSide ? 0.6 : role.gain) * HOLO_PRINT },
    uChroma: { value: role.chroma },
    uTint: { value: HOLO_TINT },
    // Square-on faces keep this much of their emission; grazing faces keep all.
    uEdgeFloor: { value: 0.1 },
    uEdgePow: { value: 1.5 },
  };

  // Reachable for look-dev through the scene graph (?debug=1): the uniforms are
  // shared by reference with the compiled program, so a write lands next frame.
  mat.userData.holo = u;
  // THE LAYERS OF LIGHT STAMP THEIR OWN DEPTH (LensFocus's hall lens). An
  // additive layer used to ADD to the frame's alpha, which the lens reads as
  // depth — so the plan inherited the depth of the wall behind it, plus one,
  // and blurred with the wall. Their alpha now blends with MIN: where the plan
  // glows it writes its own view depth, elsewhere NO_DEPTH, which changes
  // nothing. The colour is still purely additive (One/One), exactly what
  // SRC_ALPHA/ONE gave at the alpha of 1 these materials render at.
  const additive = !HOLO_SOLID.test(mat.name);
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.uniforms.uHoloTime = holoClock;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vHoloWorld;\nvoid main() {')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vHoloWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_begin>',
      `${HOLO_SCAN}
       #include <lights_fragment_begin>`,
    );
    if (additive) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         gl_FragColor.a = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) > 0.02
           ? max( vViewPosition.z, 1.05 ) : ${NO_DEPTH.toExponential()};`,
      );
    }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform float uHoloTime;
         varying vec3 vHoloWorld;
         uniform float uInkLo;
         uniform float uInkHi;
         uniform float uInkSoft;
         uniform float uInkFloor;
         uniform float uGain;
         uniform float uChroma;
         uniform vec3  uTint;
         uniform float uEdgeFloor;
         uniform float uEdgePow;
         void main() {`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        isSide
          ? `#include <emissivemap_fragment>
             {
               // vViewPosition points FROM the fragment TO the camera in view
               // space and vNormal is the view-space normal, so their angle is
               // exactly the grazing term a volume needs to show a silhouette.
               // Clamped: a rounding error past 1.0 makes the base negative and
               // pow() NaN (StationDressing, beamMaterial).
               float f = clamp(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0);
               totalEmissiveRadiance *= uTint * uGain * mix(uEdgeFloor, 1.0, pow(f, uEdgePow));
             }`
          : `#ifdef USE_EMISSIVEMAP
               vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
               {
                 vec3 c = emissiveColor.rgb;
                 // THE SHEET CARRIES ITS OWN MASK, AND IT IS THE AUTHORED ONE.
                 // 85-89% of every plan texture is TRANSPARENT — the paper is
                 // already cut away in alpha, leaving only the drawing opaque.
                 // Nothing in the pipeline was reading it: glTF declares these
                 // materials OPAQUE, and even after dressInterior forces
                 // transparency the alpha that reaches the blend comes from the
                 // BASE colour and never from an emissive map. So the plates
                 // were emitting paper the artist had already deleted.
                 //
                 // uInkLo/uInkHi stay as a SECOND, optional gate on top of the
                 // mask, weighted by uInkSoft, for pale fills inside the drawing.
                 // Luma is read in LINEAR space — three has already decoded the
                 // sRGB texture by here — so those thresholds are linear.
                 float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
                 float ink = emissiveColor.a
                   * mix(1.0, 1.0 - smoothstep(uInkLo, uInkHi, luma), uInkSoft);
                 float mx = max(max(c.r, c.g), c.b);
                 float mn = min(min(c.r, c.g), c.b);
                 float sat = mx > 0.0015 ? (mx - mn) / mx : 0.0;
                 vec3 hue = mx > 0.0015 ? c / mx : vec3(1.0);
                 vec3 tinted = uTint * mix(vec3(1.0), hue, clamp(sat * uChroma, 0.0, 1.0));
                 emissiveColor.rgb = tinted * (uInkFloor + (1.0 - uInkFloor) * ink) * uGain;
               }
               totalEmissiveRadiance *= emissiveColor.rgb;
             #endif`,
      );
  };
  // ONE PROGRAM PER MATERIAL, BY NAME, and that is not caution — it is a fix.
  //
  // The first version keyed by ROLE: 'holo-plate', 'holo-top', 'holo-side'.
  // Every plate then shared one compiled program, and station 2's plate
  // rendered its raw sheet at emissive strength 3.1 — a blown white rectangle
  // behind the model — while station 1's, with identical code and identical
  // uniforms, inverted correctly. Materials that share a cache key share the
  // compiled GLSL, so which of them compiles FIRST decides what all of them
  // run; anything the key does not distinguish (a missing emissive map on one
  // of the callout materials that also lands in the 'holo-top' bucket, say)
  // silently becomes everyone's shader.
  //
  // Eleven programs instead of three, for eleven materials that are on screen
  // one station at a time. Correctness is worth more than eight programs.
  mat.customProgramCacheKey = () => `holo-${mat.name}`;
}

/** The picture lamp's tube, as a share of the emissive strength it shipped at
 *  (see dressInterior). */
export const PICTURE_LAMP = 0.3;

/**
 * THE GLASS AT THE EXTERIOR'S HOUR.
 *
 * The film comes to the door after sundown: the estate's lamps are lit and its
 * sky is going to ink. Inside, the clerestory and the oculus were still noon —
 * panes of warm white at three and six times the wall's light, each a shaft of
 * sun across the room. The refinement brief (2026-10-03): "reduce beam/glowing
 * windows"; and since the entry became one move through the open door, the two
 * hours are a single frame apart.
 *
 * So the panes are the sky a quarter of an hour after sunset: a deep blue, well
 * under the room's lamplit ivory and far under the bloom's threshold, which is
 * what a window is in a lit room at that hour — the darkest pale thing in it.
 * The room's light is mixed to match (LIGHTMAP_INTENSITY has the account: the
 * windows' wash on the walls is halved, the lamps raised).
 *
 * AND THE SAME DUSK AS THE ONE OUTSIDE THE DOOR (the paid audit of 2026-10-04,
 * pass 1: "interior/exterior color relationship"; pass 5: the windows as "the
 * strongest remaining CG giveaways"). The panes were a saturated ultramarine
 * (#1E3A5F under the hall's print: about 70, 90, 160), the one pure colour in
 * an ivory room and nothing like the sky the visitor had just walked in under,
 * which since the audit's first pass is a slate dusk, a third of the day's
 * sky. Glass seen from a lit room at that hour is a dim grey-blue: the room's
 * own lamps are brighter than what is left outside, and the eye goes to them.
 */
export const DUSK_GLASS: Readonly<Record<string, { colour: string; strength: number }>> = {
  MAT_Clerestory: { colour: '#3F4955', strength: 0.62 },
  MAT_OculusSky: { colour: '#39424D', strength: 0.58 },
};

function dressInterior(root: THREE.Object3D): string[] {
  const touched: string[] = [];

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;

    // Draw order for the additively-blended plans. Set on the MESH because
    // renderOrder is a node property, not a material one.
    if (mesh.name.startsWith('holo3d_') || mesh.name.startsWith('projlens_')) {
      mesh.renderOrder = 3;
    }

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial & { __dressed?: boolean };
      if (!mat || mat.__dressed) continue;

      // A THIRD OF THE ROOM CARRIES NO LIGHTMAP — the anthemion frieze, the
      // capitals and every ornament (MAT_Trim_Cream, 216 primitives with no
      // UV1), the sconce arms and picture light (MAT_Gold), the newels and wall
      // panels (MAT_Wood_Dark), the urn plinths and the rug. This block used to
      // lift them with envMapIntensity 6 against the RoomEnvironment cube. On
      // three r173 that never applied: a material with no envMap of its own has
      // its envMapIntensity replaced by scene.environmentIntensity every frame.
      // They are now lit by the hall's reflection probe (hallProbe.ts), which
      // is bound explicitly and is the room's own light rather than a studio's.

      // THE BENCH. Material 'model' arrives metalness 0.8, roughness 0.5, base
      // 0.5 grey, with no maps — and the interior's environment intensity is
      // 0.1, so it renders as a dark grey slab. A metal reflects; with nothing
      // to reflect it is simply black. It is a hall bench: dielectric walnut.
      //
      // Still required against the final delivery — re-checked by parsing it.
      if (mat.name === 'model') {
        mat.metalness = 0.0;
        mat.roughness = 0.58;
        mat.color.setHex(0x3b2a1e);
        mat.needsUpdate = true;
        mat.__dressed = true;
        touched.push('bench');
      }

      // THE WINDOWS, AT DUSK (DUSK_GLASS).
      const dusk = DUSK_GLASS[mat.name];
      if (dusk) {
        mat.emissive.set(dusk.colour);
        mat.emissiveIntensity = dusk.strength;
        mat.__dressed = true;
        touched.push('dusk glass');
      }

      // THE PICTURE LAMP, TURNED DOWN. Its tube shipped at an emissive strength
      // several times the hall's bloom threshold, and the halo it threw stood
      // over the top of the print: from the door the founder's hair was under
      // it (the client, 2026-10-01: "the founder's hair is covered with the
      // lighting"; "reduce the intensity of the light"). Scaled to a lit tube
      // with a breath of glow, so the print's top edge is clear.
      if (mat.name === 'MAT_PicLight') {
        mat.emissiveIntensity *= PICTURE_LAMP;
        mat.__dressed = true;
        touched.push('picture lamp');
      }

      // THE CHANDELIER'S CRYSTAL, WITHOUT TRANSMISSION. It was the only
      // transmissive material in the hall, and three renders the whole opaque
      // scene a second time into a transmission target whenever one is in
      // view: MEASURED at the establishing shot, p90 frame time 66.7 ms with
      // it and 16.7 ms without. Seven metres up, refraction through faceted
      // drops is invisible; what reads is sparkle, which the hall's own probe
      // gives them (PROBE_GAIN) as reflections of the lit room.
      if (mat.name === 'Glass_Crystal_Kognaq_Simple.001') {
        const phys = mat as THREE.MeshPhysicalMaterial;
        if (phys.transmission > 0) {
          phys.transmission = 0;
          phys.transparent = true;
          phys.opacity = 0.42;
          phys.roughness = 0.03;
          phys.metalness = 0;
          phys.needsUpdate = true;
          touched.push('crystal');
        }
      }

      // THE URNS are no longer dressed here. material_0.001 was the decimated
      // photogrammetry urn, and no response setting could hide an atlas that no
      // longer matched its mesh; hallJoinery.ts replaces both urns outright.

      // THE HOLOGRAMS. Every MAT_Holo* material is emissive-only: a black base
      // colour, a white emissive factor, an emissive strength of 2.6 to 9, and
      // for the plan plates an emissive texture of the layout itself. That is
      // correct authoring — and rendered OPAQUE it produces a solid black
      // rectangle with a few bright lines on it, because the dark texels of the
      // plan are exactly as opaque as the bright ones. Verified in frame
      // against the previous delivery: the Kartikeya plate read as a black slab
      // hanging over the table.
      //
      // A projection is ADDITIVE. Light is added to whatever is behind it and
      // nothing is subtracted, so the dark parts of the plan contribute zero
      // and simply are not there. The plot outlines, the leader lines and the
      // extruded blocks float; the black ground disappears; the room shows
      // through. That is what makes it read as light in the air rather than as
      // a screen.
      //
      // S4 IS EXCLUDED, DELIBERATELY. The delivery disables it at source —
      // MAT_Holo3D_Top_S4 carries no emissive at all, and MAT_Holo3D_Plate_S4
      // is alphaMode MASK with a base alpha of 0 — so that the fourth station
      // cannot leak a project it does not have. Additive blending on those
      // would also render nothing, so this guard changes no pixels; it exists
      // so that a future edit to this block cannot accidentally switch a
      // deliberately dark station back on.
      if (/^MAT_Holo/.test(mat.name) && !/_S4$/.test(mat.name)) {
        const solid = HOLO_SOLID.test(mat.name);
        mat.transparent = !solid;
        if (solid) {
          mat.blending = THREE.NormalBlending;
        } else {
          // Additive colour, MIN alpha: see holographic() for why.
          mat.blending = THREE.CustomBlending;
          mat.blendEquation = THREE.AddEquation;
          mat.blendSrc = THREE.OneFactor;
          mat.blendDst = THREE.OneFactor;
          mat.blendEquationAlpha = THREE.MinEquation;
          mat.blendSrcAlpha = THREE.OneFactor;
          mat.blendDstAlpha = THREE.OneFactor;
        }
        mat.depthWrite = solid;
        // A PROJECTION IS NOT A METAL. These arrive metalness 1 / roughness 1
        // with a black base, which in a room with an environment map is a rough
        // mirror — so the plan plates rendered the WALL rather than the plan.
        // Their entire output should be their own emissive.
        mat.metalness = 0;
        mat.envMapIntensity = 0;
        // Tone mapping stays ON. These sit inside a room graded by ACES, and an
        // untone-mapped emissive in a tone-mapped frame is the one thing
        // guaranteed to look pasted on.
        holographic(mat);
        mat.needsUpdate = true;
        mat.__dressed = true;
        if (!touched.includes('holograms')) touched.push('holograms');
      }
    }
  });

  return touched;
}

/**
 * The hall's reflection probe (hallProbe.ts).
 *
 * Bound to a stand-in at once, so every hall program compiles exactly once with
 * the probe's defines and a probe-shaped environment; replaced by a photograph
 * of the room taken over the first six frames the room is actually on screen,
 * which on the journey are the frames the door passage swaps sets, under the
 * veil. Swapping one 256-face PMREM for another changes no program parameter,
 * so the capture costs a face of the hall a frame and no shader compiles.
 */
function useHallProbe(root: THREE.Object3D) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const probe = useRef<{
    mats: THREE.MeshStandardMaterial[];
    shot: THREE.WebGLRenderTarget | null;
    /** A capture in progress, one face a frame (hallProbe.ts, beginHallProbe). */
    capture: HallProbeCapture | null;
    /** Main-thread time the capture has taken so far, for the log. */
    ms: number;
  } | null>(null);

  useEffect(() => {
    // The shared room cube (hallProbe.ts, roomCube): made under the preloader,
    // so arming the hall mid-scroll renders nothing for the first time.
    const stand = roomCube(gl);
    const mats = prepareHallProbe(root, stand.texture);
    // Every probed hall material goes on the house-light dimmer (hallLight.ts),
    // at the strengths it has just been given as full.
    for (const m of mats) trackHallMaterial(m);
    // Every opaque surface writes its depth for the hall's lens (LensFocus),
    // in the same define pass, so nothing compiles twice.
    markFocusDepth(root);
    probe.current = { mats, shot: null, capture: null, ms: 0 };
    hallEnv.stand = stand.texture;

    // Compile every hall program now, off the main thread, under the hall's
    // own light state (hallProbe.ts, warmHallPrograms), instead of all at once
    // on the frame the door passage swaps sets.
    let alive = true;
    const t0 = performance.now();
    warmHallPrograms(gl, camera, root, stand.texture).then(() => {
      if (!alive) return;
      // eslint-disable-next-line no-console
      console.info('[hall_warm] programs ready in %sms', (performance.now() - t0).toFixed(0));
    });

    // A lost context takes both render targets' contents with it, and neither
    // can re-upload from the CPU (a PMREM target has no CPU copy). Take the
    // rebuilt room cube and let the next frame photograph the room again.
    const canvas = gl.domElement;
    const onRestored = () => {
      const p = probe.current;
      if (!p) return;
      const cube = roomCube(gl).texture;
      hallEnv.stand = cube;
      if (p.shot && hallEnv.texture === p.shot.texture) {
        hallEnv.texture = null;
        hallEnv.version += 1;
      }
      p.shot?.dispose();
      p.shot = null;
      p.capture?.cancel();
      p.capture = null;
      p.ms = 0;
      for (const m of p.mats) m.envMap = cube;
    };
    canvas.addEventListener('webglcontextrestored', onRestored);

    return () => {
      alive = false;
      canvas.removeEventListener('webglcontextrestored', onRestored);
      const p = probe.current;
      probe.current = null;
      if (!p) return;
      hallEnv.stand = null;
      // drei shares these materials with the next mount, which binds its own.
      untrackHallMaterials(p.mats);
      for (const m of p.mats) m.envMap = null;
      if (p.shot && hallEnv.texture === p.shot.texture) {
        hallEnv.texture = null;
        hallEnv.version += 1;
      }
      p.shot?.dispose();
      p.capture?.cancel();
    };
  }, [gl, root, camera]);

  // The holograms' scan (holoClock), one clock for every station.
  useFrame((_, delta) => {
    holoClock.value += delta;
  });

  // The house lights (hallLight.ts): the level InteriorStage wrote this frame.
  useFrame(() => {
    applyHallLevel(hallLight.level);
  });

  // Default priority, so each face lands before the composer draws the frame.
  // With the door open on the hall the portal's pass takes the faces instead,
  // under the room's own light state (HallPortal, pumpProbe): here the scene
  // still wears the exterior's fog and sky.
  const step = useCallback(() => {
    const p = probe.current;
    if (!p || p.shot || !isShown(root)) return;
    const t0 = performance.now();
    p.capture ??= beginHallProbe(gl, scene, root);
    const shot = p.capture.step();
    p.ms += performance.now() - t0;
    if (!shot) return;
    p.capture = null;
    p.shot = shot;
    for (const m of p.mats) m.envMap = shot.texture;
    hallEnv.texture = shot.texture;
    hallEnv.version += 1;
    // eslint-disable-next-line no-console
    console.info('[hall_probe] captured in %sms over 6 frames, %d materials', p.ms.toFixed(1), p.mats.length);
  }, [gl, scene, root]);
  useEffect(() => {
    hallPortal.pumpProbe = step;
    return () => {
      if (hallPortal.pumpProbe === step) hallPortal.pumpProbe = null;
    };
  }, [step]);
  useFrame(() => {
    if (!hallPortal.open) step();
  });
}

export function HallModel({
  onReady,
  onRoot,
}: {
  onReady?: (info: { promoted: number; meshes: number; tris: number }) => void;
  /**
   * Hands the loaded scene graph to the caller.
   *
   * <InteriorStage> needs it because the interaction layer works by ADOPTING
   * geometry that is already in this file — the four pedestals, the projectors,
   * the hologram volumes — rather than by building a second set beside them.
   * There is no other way to reach those nodes: they arrive from a Draco/KTX2
   * parse inside drei's cache, not from JSX.
   *
   * Called with null on unmount so a consumer holding the previous root cannot
   * keep re-parenting meshes inside a scene that is no longer rendered.
   */
  onRoot?: (root: THREE.Object3D | null) => void;
}) {
  const gl = useThree((s) => s.gl);
  // The second argument is `useDraco`, and it must be the local decoder path.
  //
  // Leaving it undefined does NOT mean "leave Draco alone" — drei defaults it
  // to true and then attaches its own DRACOLoader pointed at
  // https://www.gstatic.com/draco/..., applied AFTER the extendLoader callback
  // below. So attachLoaders' setDecoderPath('/draco/') was being silently
  // overwritten on every mount, the decoder fetch was blocked by our own CSP
  // (connect-src does not allow gstatic, and should not), and the model never
  // decoded. The hall rendered nothing on every device, not just mobile.
  //
  // Passing the path explicitly makes drei configure its loader against the
  // copy we already ship in public/draco/.
  const { scene } = useGLTF(HALL_MODEL_URL, '/draco/', undefined, (loader) => {
    attachLoaders(loader as unknown as GLTFLoader, gl);
  });

  // Clone so two mounts cannot fight over one object graph. `clone` shares
  // geometry and materials, which is what we want — the promotion guard makes
  // sharing safe and the GPU upload is not duplicated.
  const root = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const disarmed = guardAnisotropy(root);
    // The frieze's anthemions, turned to face the room (hallJoinery.ts).
    faceTheFrieze(root);
    const promoted = promoteLightmaps(root);
    // Straight after the promotion, before any pass clones or finishes the
    // tables' materials: they are lit live (see liveTurntables).
    const tables = liveTurntables(root);
    const strippedLights = stripBakedLights(root);
    // AFTER the promotion, not before: dressInterior clones the runner's
    // material, and cloning it while its lightmap was still sitting in the
    // occlusion slot would hand the clone an aoMap nothing ever promotes.
    const dressed = dressInterior(root);
    // The room's finishes (hallFinish.ts) after the dressing, so a finish that
    // names a response — the walnut's environment gain — is the value that
    // stands, and before the texture merge, so the maps it clears are never
    // counted as shared.
    const finished = finishHall(root);
    // The floor re-cut into slabs (hallFloor.ts), after its finish is set.
    dressFloor(root);
    // The runner's pile and the portrait behind glass (hallDetail.ts).
    dressHallDetail(root);
    // LAST of the material passes, and it has to be. It compares textures by
    // their sampling state — anisotropy included — so it must run after
    // guardAnisotropy has settled that, after the promotion has moved the atlas
    // into the lightMap slot, and after dressInterior's material clone exists to
    // be collapsed with the rest.
    const shared = shareDuplicateTextures(root);
    let meshes = 0;
    let tris = 0;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes += 1;
      const g = m.geometry as THREE.BufferGeometry;
      tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    });

    // The scene's real extents, logged once.
    //
    // Every camera pose in poses.ts is a Blender coordinate converted by hand,
    // and there is no way to tell a correct pose from one standing inside a
    // wall except by knowing how big the room actually is. The first render on
    // a device came back looking up at the ceiling from under the staircase,
    // and there was no number anywhere in the app to say whether the camera was
    // misplaced or the model was a hundred times too large.
    //
    // Measured against this exact GLB: x -10.20..10.20, y -0.13..8.10,
    // z -8.55..8.00 — the hall as extended by bays for the client review
    // (tools/blender/extend_hall_v7.py); it was x -7.80..7.80, y -0.10..6.50,
    // z -5.98..5.60. Metres, floor at zero. If these numbers ever drift, the
    // model changed and every pose in poses.ts needs re-checking.
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    // eslint-disable-next-line no-console
    console.info(
      '[hall_ready] meshes=%d tris=%d lightmaps=%d liveTables=%d/%d bakedLightsRemoved=%d texturesMerged=%d freedMB=%s dressed=[%s] finished=%d anisotropyDisarmed=[%s] | size %sx%sx%s | centre %s,%s,%s | y %s..%s',
      meshes,
      Math.round(tris),
      promoted,
      tables.meshes,
      tables.feet,
      strippedLights,
      shared.merged,
      shared.freedMB.toFixed(2),
      dressed.join(','),
      finished.length,
      disarmed.join(','),
      size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2),
      centre.x.toFixed(2), centre.y.toFixed(2), centre.z.toFixed(2),
      box.min.y.toFixed(2), box.max.y.toFixed(2),
    );

    onReady?.({ promoted, meshes, tris: Math.round(tris) });
  }, [root, onReady]);

  // The turned joinery and the urns (hallJoinery.ts). Its own effect because
  // it is the one pass that ADDS to the graph, so it is the one that has to be
  // undone: a remount gets a fresh clone, and the replacements, the geometry
  // they were built from and the originals' visibility must not outlive it.
  useEffect(() => {
    const joinery = refurnishHall(root);
    return () => joinery.dispose();
  }, [root]);

  // The panelling's walnut veneer (hallWalnut.ts): its own material and UVs,
  // created here so the probe below binds it with the rest of the room.
  useEffect(() => {
    const walnut = dressWalnut(root, hallKTX2(gl));
    return () => walnut.dispose();
  }, [root, gl]);

  // AFTER the joinery and the panelling, so what they add is probed with
  // everything else.
  useHallProbe(root);

  // Separate from the counting pass, and deliberately so: the consumer
  // re-parents nodes inside `root`, and running that in the same effect as the
  // traversal that counts them would have the count depend on whether the
  // surgery had happened yet.
  useEffect(() => {
    onRoot?.(root);
    return () => onRoot?.(null);
  }, [root, onRoot]);

  return <primitive object={root} />;
}

// No module-scope preload.
//
// useGLTF.preload() takes no loader configuration, so it ran with drei's
// defaults: the gstatic Draco decoder (CSP-blocked) and no KTX2 loader at all.
// It could never have succeeded — every texture in this GLB is KTX2, and
// KTX2Loader needs detectSupport(renderer) to pick a transcode target, so it
// cannot be built before a WebGL context exists.
//
// It fired on every page that imports this module, so a route with no 3D on it
// still paid for a doomed cross-origin request. The component's own useGLTF
// above is correctly configured and is the only place the model is fetched.
