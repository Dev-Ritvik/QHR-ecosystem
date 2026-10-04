// apps/public/src/components/experience/mapTablePlan.ts
//
// THE MAP TABLE — the numbers, and where each layout's pin stands.
//
// The film's last chapter used to open the hall's front doors onto a field of
// contoured relief under a night sky, with a brass obelisk for each layout. The
// fourth art-direction critique (2026-09-30) saw "a low-poly, abstract desert
// with floating golden pillars ... like an entirely different project was
// spliced in", and asked for it removed: "Keep the camera inside the
// architectural world. If you need to show the raw land, transition to a highly
// realistic, beautifully lit topographical map on the grand table."
//
// So the land is a table now: a round walnut map table standing in the court
// of the horseshoe stair, under the portrait, with the two districts carved in
// plaster relief into its top (tools/gltf/make_map_table.py has the geography
// and the finish) and a brass pin standing in the district of every published
// layout. This module is the part with no three.js in it: the table's
// dimensions, the texture set, and the pin placement, which is deterministic
// per project so a layout's pin stands in the same place on every visit.

import type { ScreenBox } from './copyZone';

/** The table's centre on the hall floor, three-space metres. The horseshoe's
 *  centre is (0, -3.1) (imperial_hall_v7.py: C = (0, 3.1) in Blender); the
 *  court within its inner radius of 2.6 m is open floor, and the table stands
 *  a touch forward of the centre so a 1.1 m radius clears the landing's face by
 *  1.5 m all round. */
export const MAP_TABLE = {
  x: 0,
  z: -3.05,
  /** The walnut rim's surface. */
  topY: 0.86,
  /** The round top. */
  radius: 1.1,
} as const;

/** The top's texture square and the relief inside it (make_map_table.py). */
export const MAP_TOP = {
  /** Half the texture square, metres: the whole round top. */
  half: 1.1,
  reliefRadius: 0.86,
  bezel: [0.862, 0.895] as const,
  /** Metres the lacquer sea stands below the rim; the displacement's zero. */
  seaDrop: 0.004,
  /** Metres of relief across the displacement's 0..1. */
  heightRange: 0.1,
  bezelRise: 0.006,
} as const;

export const MAP_TEXTURES = {
  color: '/textures/maptable/top_color.ktx2',
  normal: '/textures/maptable/top_normal.ktx2',
  orm: '/textures/maptable/top_orm.ktx2',
  height: '/textures/maptable/top_height.ktx2',
  shadow: '/textures/maptable/top_shadow.ktx2',
  /** 128 x 128, R height (0..255 of heightRange), G district. */
  meta: '/textures/maptable/top_meta.png',
} as const;

/**
 * THE LIGHT ON THE TABLE: the same low sun the clerestory lets in
 * (WindowLight.DIR, reversed — from the east, 37 degrees up), which is the
 * direction make_map_table.py baked the relief's shadows from. World space,
 * pointing toward the light.
 */
export const MAP_SUN: readonly [number, number, number] = (() => {
  const v = [0.66, 0.52, 0.2];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l] as const;
})();

/**
 * How much the film is on the table right now, 0..1 — written every frame by
 * InteriorStage from the camera's place on the path (1 on /hall, which has no
 * path). The pins are only targets while it is up: a pin the visitor cannot
 * see, across the room from the establishing shot, is not a link.
 *
 * `screen` is where the round top stands on the screen right now — its rim's
 * circle through the camera it is drawn with, as a box — or null while it is
 * not in front of the camera. Written every frame by MapTable; the lens reads
 * it for the colophon that comes up over the film's last frame
 * (lensFilter.codaFilter).
 */
export const mapStage: { emphasis: number; screen: ScreenBox | null } = { emphasis: 0, screen: null };

/** District ids in the meta map. */
export const DISTRICT = { sea: 0, vizianagaram: 1, srikakulam: 2, other: 3 } as const;

/** A project's district, read from its published city. */
export function districtOf(city: string | null | undefined): number | null {
  const c = (city ?? '').toLowerCase();
  if (c.includes('vizian')) return DISTRICT.vizianagaram;
  if (c.includes('srikak')) return DISTRICT.srikakulam;
  return null;
}

/** What the placement reads from the meta map. */
export interface MapMeta {
  size: number;
  /** Row-major, row 0 north: height 0..255 of heightRange. */
  height: Uint8Array;
  district: Uint8Array;
}

export interface PinProject {
  slug: string;
  name: string;
  city: string;
  totalUnits: number;
}

export interface Pin {
  slug: string;
  name: string;
  /** Table-local metres (the table's centre is 0, 0). */
  x: number;
  z: number;
  /** Height of the relief under the pin, metres above the rim (can be < 0). */
  base: number;
  /** The pin's length above the relief, metres: its layout's size. */
  length: number;
  href: string;
}

/** Bilinear read of the meta height, metres above the rim. */
export function reliefAt(meta: MapMeta, x: number, z: number): number {
  const n = meta.size;
  const fx = ((x + MAP_TOP.half) / (2 * MAP_TOP.half)) * n - 0.5;
  const fz = ((z + MAP_TOP.half) / (2 * MAP_TOP.half)) * n - 0.5;
  const x0 = Math.max(0, Math.min(n - 1, Math.floor(fx)));
  const z0 = Math.max(0, Math.min(n - 1, Math.floor(fz)));
  const x1 = Math.min(n - 1, x0 + 1);
  const z1 = Math.min(n - 1, z0 + 1);
  const tx = Math.min(1, Math.max(0, fx - x0));
  const tz = Math.min(1, Math.max(0, fz - z0));
  const h = (i: number, j: number) => meta.height[j * n + i] / 255;
  const v =
    h(x0, z0) * (1 - tx) * (1 - tz) + h(x1, z0) * tx * (1 - tz) + h(x0, z1) * (1 - tx) * tz + h(x1, z1) * tx * tz;
  return v * MAP_TOP.heightRange - MAP_TOP.seaDrop;
}

function districtAt(meta: MapMeta, x: number, z: number): number {
  const n = meta.size;
  const i = Math.max(0, Math.min(n - 1, Math.floor(((x + MAP_TOP.half) / (2 * MAP_TOP.half)) * n)));
  const j = Math.max(0, Math.min(n - 1, Math.floor(((z + MAP_TOP.half) / (2 * MAP_TOP.half)) * n)));
  return meta.district[j * n + i];
}

/** 32-bit FNV-1a: deterministic, dependency-free, stable across engines. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pins stand at least this far apart, metres (11.5 km of the district). */
export const PIN_GAP = 0.09;
/** And inside this radius, clear of the bezel. */
export const PIN_RADIUS = 0.74;
/** Not on the hills: a plotted layout is on the plain, near a town. Metres of
 *  relief (about 450 m of land). */
export const PIN_MAX_BASE = 0.018;
/** Pin length, by the layout's plots against the largest's. */
export const PIN_MIN = 0.05;
export const PIN_MAX = 0.12;

/**
 * Where each published layout's pin stands.
 *
 * In its own district's land, on the plain, clear of the other pins, at a
 * point drawn from its slug — so the same project stands in the same place on
 * every visit and a new project does not move the others. A project whose city
 * names neither district stands anywhere on the two districts' land. The
 * position within the district is NOT the site's: the page says so beside it.
 */
export function placePins(projects: PinProject[], meta: MapMeta): Pin[] {
  const maxUnits = Math.max(1, ...projects.map((p) => p.totalUnits || 0));
  const out: Pin[] = [];
  for (const p of projects) {
    const want = districtOf(p.city);
    let placed: Pin | null = null;
    let fallback: Pin | null = null;
    for (let attempt = 0; attempt < 600 && !placed; attempt += 1) {
      const a = hash32(`${p.slug}:${attempt}:a`) / 0xffffffff;
      const b = hash32(`${p.slug}:${attempt}:b`) / 0xffffffff;
      // Uniform over the disc.
      const r = PIN_RADIUS * Math.sqrt(a);
      const th = 2 * Math.PI * b;
      const x = r * Math.cos(th);
      const z = r * Math.sin(th);
      const d = districtAt(meta, x, z);
      const inDistrict = want === null ? d === DISTRICT.vizianagaram || d === DISTRICT.srikakulam : d === want;
      if (!inDistrict) continue;
      const base = reliefAt(meta, x, z);
      const clear = out.every((q) => Math.hypot(q.x - x, q.z - z) >= PIN_GAP);
      const pin: Pin = {
        slug: p.slug,
        name: p.name,
        x,
        z,
        base,
        length: PIN_MIN + (PIN_MAX - PIN_MIN) * Math.min(1, (p.totalUnits || 0) / maxUnits),
        href: `/projects/${p.slug}`,
      };
      if (clear && !fallback) fallback = pin;
      if (clear && base <= PIN_MAX_BASE) placed = pin;
    }
    const chosen = placed ?? fallback;
    if (chosen) out.push(chosen);
  }
  return out;
}
