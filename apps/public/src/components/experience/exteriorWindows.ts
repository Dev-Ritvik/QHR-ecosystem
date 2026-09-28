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
// not every window is lit, which is what the review asked for too. The rooms
// are dim by day (an interior is a stop or two under daylight) and come up with
// the evening, riding the emissive strength ExteriorLighting already drives.
//
// The curtain the plane was authored as is not drawn: its pleats, lit by the
// sun, printed over the rooms as bright stripes.

import * as THREE from 'three';

/** Room depth behind the facade; the room's margin beyond the window's sides,
 *  below its sill and above its head; metres. */
export const ROOM_DEPTH = 5.5;
export const SIDE_MARGIN = 1.4;
export const SILL_DROP = 0.95;
export const HEAD_RISE = 0.85;
/** Interior radiance by day, before any evening. */
export const DAY_INTERIOR = 1.0;
/** Evening gain on the emissive strength ExteriorLighting drives (0..0.7). */
export const EVENING_INTERIOR = 3.2;

const INTERIOR_RE = /^MAT_Window_Interior/;

export const INTERIOR_FRAGMENT = /* glsl */ `
uniform float uInteriorDay;
uniform float uInteriorEvening;
varying vec3 vInteriorWorld;
varying vec3 vRoomC;
varying vec3 vRoomH;
// Hashed on the window's centre ROUNDED to 10 cm: the centre arrives as an
// interpolated varying, equal across the pane only to the last few bits, and a
// sine hash turns those bits into a different room per pixel (a speckle over
// every window, measured).
float roomHash(vec3 c) { c = floor(c * 10.0 + 0.5); return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
vec3 interiorRoom(vec3 pos, vec3 rd, vec3 nW) {
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
  // Which rooms are lived in, and how warm their lamps are.
  float r = roomHash(vRoomC);
  float on = r < 0.28 ? 0.2 : 0.55 + 0.45 * fract(r * 7.13);
  // Lamplight, not daylight: 2700-3000K, so the rooms read warm against
  // the cool shade of the facade they sit in.
  vec3 tint = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.76, 0.48), fract(r * 3.7));
#ifdef ROOM_DEBUG
  return t == tUp ? (rUp < 0.0 ? vec3(0.0, 0.6, 0.0) : vec3(0.0, 0.0, 0.6)) : t == tSide ? vec3(0.6, 0.0, 0.0) : vec3(0.6);
#endif
  vec3 room = col * tint * lamp * on;
  // DRAPES at the window's own edges, just inside the glass: ivory silk in
  // soft folds, lit from the room behind them. They frame the view into the
  // room the way every lit window of a real house is framed.
  float wHalf = abs(dot(vRoomH, along));
  float drape = smoothstep(0.58, 0.64, abs(a0) / max(wHalf, 0.05));
  if (drape > 0.0) {
    float fold = 0.72 + 0.28 * sin(a0 * 41.0 + sin(u0 * 3.0) * 0.6);
    vec3 silk = vec3(0.8, 0.72, 0.6) * fold * tint * (0.35 + 0.55 * on);
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
    vec3 room = interiorRoom(vInteriorWorld - nW * 0.02, rd, nW);
    float evening = max(max(totalEmissiveRadiance.r, totalEmissiveRadiance.g), totalEmissiveRadiance.b);
    totalEmissiveRadiance = room * (uInteriorDay + uInteriorEvening * evening);
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
  return boxes.size;
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
        shader.vertexShader = shader.vertexShader
          .replace(
            'void main() {',
            'attribute vec3 aRoomC;\nattribute vec3 aRoomH;\nvarying vec3 vInteriorWorld;\nvarying vec3 vRoomC;\nvarying vec3 vRoomH;\nvoid main() {',
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vInteriorWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
             vRoomC = (modelMatrix * vec4(aRoomC, 1.0)).xyz;
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
      mat.customProgramCacheKey = () => 'estate-interior-rooms';
      mat.needsUpdate = true;
    }
  });
  return windows;
}
