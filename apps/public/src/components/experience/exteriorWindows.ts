// apps/public/src/components/experience/exteriorWindows.ts
//
// Rooms behind the windows.
//
// THE REVIEW: "the windows are opaque, flat black voids that show no interior
// depth, glass reflectivity, or indoor lighting". Behind every pane of the v7
// house is one flat plane (MAT_Window_Interior, authored as a drawn curtain)
// under a tinted glass sheet: in daylight it sat in the shade of its reveal and
// read as a dark card, every window the same.
//
// INTERIOR MAPPING (van Dongen, 2008). The plane stays a plane; its shader
// follows the view ray THROUGH it into a virtual room — ROOM_DEPTH deep, a
// margin wider than the window on each side, its floor below the sill and its
// ceiling above the head — and shades whichever surface the ray reaches first:
// the back wall, a side wall, the floor or the ceiling. Move the camera and the
// room moves behind the glass with true parallax, which is the whole
// difference between a window and a picture of one.
//
// ONE ROOM PER WINDOW, centred on it. A world grid was tried first and the
// look-dev view (?roomdebug=1) showed why it cannot work: the windows are not
// on any grid, so a side wall cut through most panes and a floor line crossed
// the arched ones. So each window's pane is found once at load — the connected
// pieces of the interior mesh — and its centre and half-size are written to
// every vertex of it (aRoomC, aRoomH), in the mesh's own space.
//
// EACH ROOM ITS OWN. A hash of the room's cell decides whether its lamps are
// on and how warm they are, so the house reads as lived in rather than lit —
// not every window is lit, which is what the review asked for too. By day a
// room shows the daylight its own window lets in and little else; its lamps
// come up with the evening, riding the emissive strength ExteriorLighting
// already drives (DAY_INTERIOR and LAMP_DAY, below).
//
// The curtain the plane was authored as is not drawn: its pleats, lit by the
// sun, printed over the rooms as bright stripes.

import * as THREE from 'three';
import type { RoomLight } from './nightPools';

/** Room depth behind the facade; the room's margin beyond the window's sides,
 *  below its sill and above its head; metres. */
export const ROOM_DEPTH = 5.5;
export const SIDE_MARGIN = 1.4;
export const SILL_DROP = 0.95;
export const HEAD_RISE = 0.85;
/**
 * THE ROOMS' LIGHT, RE-MEASURED (the refinement brief, 2026-10-03: "glowing
 * windows"; its audits: every window lit, and lit alike).
 *
 * By day a room seen from outside is lit by the window it is seen through:
 * daylight on the sill, the floor and the drapes, gone a few metres in, and
 * neutral. Its lamps, if they are on at all, are eight stops under the sun.
 * The rooms used to show their LAMPS by day (DAY_INTERIOR 1.0 on the lamp
 * term), which is a house with every light on at noon.
 *
 * By night the lamps are all there is, and they were driven to five times the
 * print's white (1 + 3.2 x 1.3): every lit room clipped to the same cream
 * pane with a halo round it, which is a light box and not a room. Now a lit
 * room's walls print as warm amber with the lamp itself the only thing near
 * white, so the picture on its wall, the dado and the drapes can be seen.
 */
/** Daylight in the room, by day; it goes with the evening. */
export const DAY_INTERIOR = 0.5;
/** How fast the daylight dies into the room, metres. */
export const DAYLIGHT_REACH = 2.2;
/** The lamps by day, and what the evening's drive (0..1.3) adds to them. */
export const LAMP_DAY = 0.16;
export const EVENING_INTERIOR = 1.7;
/** The drive's own ceiling (WorldCanvas: WINDOW_EVENING_GLOW + WINDOW_NIGHT_GLOW). */
export const EVENING_DRIVE_MAX = 1.3;

const INTERIOR_RE = /^MAT_Window_Interior/;

export const INTERIOR_FRAGMENT = /* glsl */ `
uniform float uInteriorDay;
uniform float uInteriorEvening;
uniform float uLampDay;
varying vec3 vInteriorWorld;
varying vec3 vRoomC;
varying vec3 vRoomH;
varying float vRoomSeed;
// Hashed on the window's centre ROUNDED to 10 cm: the centre arrives as an
// interpolated varying, equal across the pane only to the last few bits, and a
// sine hash turns those bits into a different room per pixel (a speckle over
// every window, measured).
float roomHash(vec3 c) { c = floor(c * 10.0 + 0.5); return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
vec3 interiorRoom(vec3 pos, vec3 rd, vec3 nW, float evening) {
  vec3 inw = -nW;
  vec3 along = normalize(cross(vec3(0.0, 1.0, 0.0), inw));
  float rIn = max(dot(rd, inw), 1.0e-3);
  float rAl = dot(rd, along);
  float rUp = rd.y;
  // Room-local: along from the window's centre, up from its centre.
  float halfW = abs(dot(vRoomH, along)) + ${SIDE_MARGIN.toFixed(2)};
  float floorY = -vRoomH.y - ${SILL_DROP.toFixed(2)};
  float ceilY = vRoomH.y + ${HEAD_RISE.toFixed(2)};
  float a0 = dot(pos - vRoomC, along);
  float u0 = pos.y - vRoomC.y;
  float tBack = ${ROOM_DEPTH.toFixed(2)} / rIn;
  float tSide = abs(rAl) > 1.0e-4 ? ((rAl > 0.0 ? halfW : -halfW) - a0) / rAl : 1.0e4;
  float tUp = abs(rUp) > 1.0e-4 ? ((rUp > 0.0 ? ceilY : floorY) - u0) / rUp : 1.0e4;
  float t = min(tBack, min(tSide, tUp));
  float depth = t * rIn;
  float hAl = a0 + rAl * t + halfW;
  float hUp = u0 + rUp * t - floorY;
  float roomH = ceilY - floorY;
  // Surfaces: ivory walls with a darker dado, a walnut floor, a pale ceiling.
  // The side walls take the lamp at a glance and the back wall full on, so
  // they are shaded apart: from an oblique view a room is mostly side wall,
  // and without that difference it reads as one flat colour.
  vec3 col;
  if (t == tUp) {
    col = rUp < 0.0 ? vec3(0.14, 0.08, 0.05) : vec3(0.7, 0.64, 0.56);
  } else {
    col = hUp < 0.95 ? vec3(0.34, 0.26, 0.19) : vec3(0.64, 0.55, 0.43);
    if (t == tSide) col *= 0.62;
    // A picture on the back wall of some rooms: a dark frame round a warm field.
    if (t == tBack) {
      float pic = roomHash(vRoomC + 7.0);
      vec2 c = vec2(hAl - halfW, hUp - roomH * 0.58);
      vec2 half_ = vec2(0.7, 0.5) * (0.7 + 0.6 * pic);
      if (pic > 0.35 && all(lessThan(abs(c), half_))) {
        col = all(lessThan(abs(c), half_ - 0.07)) ? vec3(0.3, 0.2, 0.12) * (0.6 + pic) : vec3(0.35, 0.26, 0.1);
      }
    }
  }
  // A lamp at the room's centre, near the ceiling; falloff with distance and
  // a darkening into the room's corners.
  vec3 lampRel = vec3(hAl - halfW, hUp - (roomH - 0.9), depth - ${(ROOM_DEPTH * 0.55).toFixed(2)});
  float lamp = 0.18 + 1.5 * exp(-dot(lampRel, lampRel) / 5.0);
  float corner = smoothstep(0.0, 0.7, hAl) * smoothstep(0.0, 0.7, 2.0 * halfW - hAl);
  corner *= smoothstep(0.0, 0.5, hUp) * smoothstep(0.0, 0.6, roomH - hUp);
  corner *= smoothstep(0.0, 0.8, ${ROOM_DEPTH.toFixed(2)} - depth) * 0.5 + 0.5;
  lamp *= 0.45 + 0.55 * corner;
  // WHICH ROOMS ARE LIVED IN, and how warm their lamps are: the room's own
  // seed (aRoomSeed), shared with the pools of light it casts on the ground
  // (nightPools.ts), so a dark window never throws a lit pool. One room in
  // four is dark: nobody is in it. One in five is lit from the room beyond, a
  // door left open on a lit passage. The rest have their own lamps on, no two
  // at the same strength. (Until the refinement brief seven in ten were lit to
  // the same clipped white and the rest a fifth on: a facade of identical
  // panes. With four in ten dark the house the door opens on read as shut.)
  float r = vRoomSeed;
  float on = r < 0.25 ? 0.035 : r < 0.45 ? 0.16 + 0.2 * fract(r * 7.13) : 0.62 + 0.38 * fract(r * 7.13);
  // Lamplight, not daylight: 2700-3000K, so the rooms read warm against
  // the cool shade of the facade they sit in.
  vec3 tint = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.76, 0.48), fract(r * 3.7));
#ifdef ROOM_DEBUG
  return t == tUp ? (rUp < 0.0 ? vec3(0.0, 0.6, 0.0) : vec3(0.0, 0.0, 0.6)) : t == tSide ? vec3(0.6, 0.0, 0.0) : vec3(0.6);
#endif
  // How far the evening has come, 0..1, and the two lights a room is seen by:
  // the window's own daylight, dying into the room, and the lamps.
  float dusk = clamp(evening / ${EVENING_DRIVE_MAX.toFixed(2)}, 0.0, 1.0);
  float sky = uInteriorDay * (1.0 - 0.92 * dusk);
  float lamps = (uLampDay + uInteriorEvening * evening) * on;
  vec3 room = col * (vec3(0.9, 0.95, 1.0) * sky * exp(-depth / ${DAYLIGHT_REACH.toFixed(2)}) + tint * lamps * lamp);
  // DRAPES, just inside the glass: ivory silk in soft folds, seen by the
  // daylight on their face and by the room behind them. How far they are drawn
  // is the room's own: most stand open at the window's edges, some half across,
  // and one room in seven has them closed. A lit room with its curtains drawn
  // is a pane of warm silk, not a view.
  float wHalf = abs(dot(vRoomH, along));
  float edge = fract(r * 11.7) < 0.14 ? -1.0 : mix(0.4, 0.74, fract(r * 5.3));
  float drape = smoothstep(edge - 0.03, edge + 0.03, abs(a0) / max(wHalf, 0.05));
  if (drape > 0.0) {
    // The folds give way to their mean as they shrink toward a pixel: at the
    // hero's distance they printed as a moire over every pane.
    float keep = clamp(1.0 - fwidth(a0) * 41.0 * 0.6, 0.0, 1.0);
    float fold = 0.72 + 0.28 * keep * sin(a0 * 41.0 + sin(u0 * 3.0) * 0.6);
    vec3 silk = vec3(0.8, 0.72, 0.6) * fold * (vec3(0.9, 0.95, 1.0) * sky * 0.8 + tint * lamps * 0.5);
    room = mix(room, silk, drape);
  }
  return room;
}
`;

export const INTERIOR_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
{
  {
    // The facade's normal is the window's THIN axis, not the surface normal:
    // the planes are pleated curtains, and folds deeper than 45 degrees sent
    // their rays into rooms turned sideways (diagonal stripes, measured).
    vec3 nW = vRoomH.x < vRoomH.z ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
    vec3 rd = normalize(vInteriorWorld - cameraPosition);
    if (dot(rd, nW) > 0.0) nW = -nW;
    float evening = max(max(totalEmissiveRadiance.r, totalEmissiveRadiance.g), totalEmissiveRadiance.b);
    totalEmissiveRadiance = interiorRoom(vInteriorWorld - nW * 0.02, rd, nW, evening);
    // The room is all there is behind the glass: the pleated curtain's own
    // lit folds would print over it as stripes (and see UNLIT, below).
    diffuseColor.rgb = vec3(0.0);
  }
}
`;

/**
 * Write each window's centre and half-size to its vertices (aRoomC, aRoomH, in
 * the geometry's own space). A window is a connected piece of the mesh:
 * vertices are welded by position first (the export splits them at every
 * crease), then triangles union their corners. Idempotent: a geometry that
 * already carries the attributes (drei's cached parse is shared between
 * mounts) is left alone and reports -1. Returns the number of windows found.
 */
export function markRooms(geometry: THREE.BufferGeometry): number {
  if (geometry.getAttribute('aRoomC')) return -1;
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const n = pos.count;
  const weld = new Map<string, number>();
  const canon = new Int32Array(n);
  for (let i = 0; i < n; i += 1) {
    const k = `${Math.round(pos.getX(i) * 1e3)},${Math.round(pos.getY(i) * 1e3)},${Math.round(pos.getZ(i) * 1e3)}`;
    let c = weld.get(k);
    if (c === undefined) {
      c = i;
      weld.set(k, c);
    }
    canon[i] = c;
  }
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const index = geometry.getIndex();
  const corners = index ? index.count : n;
  const at = (k: number) => canon[index ? index.getX(k) : k];
  for (let t = 0; t + 2 < corners; t += 3) {
    union(at(t), at(t + 1));
    union(at(t), at(t + 2));
  }
  const boxes = new Map<number, THREE.Box3>();
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i += 1) {
    const r = find(canon[i]);
    let b = boxes.get(r);
    if (!b) {
      b = new THREE.Box3();
      boxes.set(r, b);
    }
    b.expandByPoint(v.fromBufferAttribute(pos, i));
  }
  const centre = new Float32Array(n * 3);
  const half = new Float32Array(n * 3);
  const c = new THREE.Vector3();
  const h = new THREE.Vector3();
  for (let i = 0; i < n; i += 1) {
    const b = boxes.get(find(canon[i]))!;
    b.getCenter(c).toArray(centre, i * 3);
    b.getSize(h).multiplyScalar(0.5).toArray(half, i * 3);
  }
  geometry.setAttribute('aRoomC', new THREE.BufferAttribute(centre, 3));
  geometry.setAttribute('aRoomH', new THREE.BufferAttribute(half, 3));
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    seed[i] = roomSeed(centre[i * 3], centre[i * 3 + 1], centre[i * 3 + 2]);
  }
  geometry.setAttribute('aRoomSeed', new THREE.BufferAttribute(seed, 1));
  return boxes.size;
}

/** A room's seed, 0..1, from its window's centre rounded to 10 cm (FNV-1a):
 *  the same on every machine, where a GPU sine hash is not. */
export function roomSeed(x: number, y: number, z: number): number {
  const key = `${Math.round(x * 10)},${Math.round(y * 10)},${Math.round(z * 10)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

/** How much of a room's lamp is on, as the shader has it: dark, lit from the
 *  room beyond, or lit. */
export function roomOn(seed: number): number {
  const k = (seed * 7.13) % 1;
  return seed < 0.25 ? 0.035 : seed < 0.45 ? 0.16 + 0.2 * k : 0.62 + 0.38 * k;
}

/** A room's lamp colour, linear, as the shader has it. */
export function roomTint(seed: number, out = new THREE.Color()): THREE.Color {
  const t = (seed * 3.7) % 1;
  return out.setRGB(1.0, 0.62 + (0.76 - 0.62) * t, 0.3 + (0.48 - 0.3) * t);
}

/**
 * Every window of a marked mesh as a light (nightPools.ts): its centre, the
 * way it faces out of the house, its size, and its room's lamp — in world
 * space. The window's thin axis is its facing, as the shader reads it; which
 * way along that axis is out is the side away from the house's middle.
 */
export function roomLights(mesh: THREE.Mesh, houseCentre: THREE.Vector3): RoomLight[] {
  const g = mesh.geometry as THREE.BufferGeometry;
  const c = g.getAttribute('aRoomC') as THREE.BufferAttribute | undefined;
  const h = g.getAttribute('aRoomH') as THREE.BufferAttribute | undefined;
  const sd = g.getAttribute('aRoomSeed') as THREE.BufferAttribute | undefined;
  if (!c || !h || !sd) return [];
  mesh.updateMatrixWorld(true);
  const seen = new Set<string>();
  const out: RoomLight[] = [];
  const m3 = new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld);
  for (let i = 0; i < c.count; i += 1) {
    const key = `${c.getX(i).toFixed(3)},${c.getY(i).toFixed(3)},${c.getZ(i).toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const centre = new THREE.Vector3(c.getX(i), c.getY(i), c.getZ(i)).applyMatrix4(mesh.matrixWorld);
    const half = new THREE.Vector3(h.getX(i), h.getY(i), h.getZ(i));
    const e = m3.elements;
    // World half-size along each world axis (the same abs-matrix the shader uses).
    const hw = new THREE.Vector3(
      Math.abs(e[0]) * half.x + Math.abs(e[3]) * half.y + Math.abs(e[6]) * half.z,
      Math.abs(e[1]) * half.x + Math.abs(e[4]) * half.y + Math.abs(e[7]) * half.z,
      Math.abs(e[2]) * half.x + Math.abs(e[5]) * half.y + Math.abs(e[8]) * half.z,
    );
    const facesX = hw.x < hw.z;
    const normal = facesX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    if (normal.dot(centre.clone().sub(houseCentre)) < 0) normal.negate();
    const seed = roomSeed(c.getX(i), c.getY(i), c.getZ(i));
    const colour = roomTint(seed).multiplyScalar(roomOn(seed));
    out.push({ centre, normal, halfW: facesX ? hw.z : hw.x, halfH: hw.y, colour });
  }
  return out;
}

const UNLIT_FROM = 'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;';
const UNLIT_TO = 'vec3 outgoingLight = totalEmissiveRadiance;';

/** Dress the window interiors under `root`. Returns how many windows. */
export function dressWindows(root: THREE.Object3D): number {
  const done = new Set<THREE.Material>();
  let windows = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (mats.some((m) => m && INTERIOR_RE.test(m.name))) {
      windows += Math.max(0, markRooms(mesh.geometry as THREE.BufferGeometry));
    }
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial & { __interior?: boolean };
      if (!mat || mat.__interior || !INTERIOR_RE.test(mat.name)) continue;
      mat.__interior = true;
      done.add(mat);
      // Look-dev: ?roomdebug=1 paints floor green, ceiling blue, side walls
      // red, back wall grey.
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('roomdebug') === '1') {
        mat.defines = { ...(mat.defines ?? {}), ROOM_DEBUG: '' };
      }
      const prev = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        shader.uniforms.uInteriorDay = { value: DAY_INTERIOR };
        shader.uniforms.uInteriorEvening = { value: EVENING_INTERIOR };
        shader.uniforms.uLampDay = { value: LAMP_DAY };
        shader.vertexShader = shader.vertexShader
          .replace(
            'void main() {',
            'attribute vec3 aRoomC;\nattribute vec3 aRoomH;\nattribute float aRoomSeed;\nvarying vec3 vInteriorWorld;\nvarying vec3 vRoomC;\nvarying vec3 vRoomH;\nvarying float vRoomSeed;\nvoid main() {',
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vInteriorWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
             vRoomC = (modelMatrix * vec4(aRoomC, 1.0)).xyz;
             vRoomSeed = aRoomSeed;
             mat3 roomM = mat3(modelMatrix);
             vRoomH = abs(roomM[0]) * aRoomH.x + abs(roomM[1]) * aRoomH.y + abs(roomM[2]) * aRoomH.z;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', `${INTERIOR_FRAGMENT}\nvoid main() {`)
          .replace('#include <emissivemap_fragment>', INTERIOR_EMISSIVE)
          // UNLIT: the room is emitted, and nothing the sun does to the
          // curtain plane in front of it — a specular glint on every fold —
          // belongs in it. The glass layer adds the reflection.
          .replace(UNLIT_FROM, UNLIT_TO);
      };
      // Seen by its own light: the contact occlusion leaves it alone
      // (LensFocus, EMITTERS).
      mat.defines = { ...(mat.defines ?? {}), ESTATE_EMITTER: '' };
      mat.customProgramCacheKey = () => 'estate-interior-rooms';
      mat.needsUpdate = true;
    }
  });
  return windows;
}
