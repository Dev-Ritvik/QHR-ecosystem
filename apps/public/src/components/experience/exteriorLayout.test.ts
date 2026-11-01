// apps/public/src/components/experience/exteriorLayout.test.ts
//
// The layout (the founder's frame, 2026-10-28): the plots it draws are the
// sheets' own, on the sheets' own roads, inside the walls, clear of what
// stands there; its drawing is on only for its chapter; and its words are the
// sheets' and nothing else.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAYOUTS } from '@/lib/layouts';
import {
  LAYOUT,
  LAYOUT_LABELS,
  inJunction,
  layoutBlocks,
  layoutAir,
  layoutGroundGeometry,
  layoutLow,
  layoutOn,
  layoutSideRoad,
  onTheLayout,
} from './exteriorLayout';
import { LAYOUT_TREES } from './exteriorJungle';
import { ESTATE_ARCHITECTURE, ESTATE_PLANTING } from './estateBounds';
import { DOOR_OUT, chapters } from './journey';
import { FILM_SHARE } from './cameraPath';

const FT = 0.3048;
const read = (rel: string) => readFileSync(join(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');

describe('the layout on the south lawns', () => {
  it('draws the plots the sheets print, on the roads they print', () => {
    // 30 ft by 60 ft: Kartikeya's sheet prints it, and Gayatri's every plot
    // is 60 by 30 (the same plot turned)
    const sizes = LAYOUTS.flatMap((l) => l.sizes.map((s) => [...s.feet].sort((a, b) => a - b).join('x')));
    expect(sizes).toContain('30x60');
    expect(LAYOUT.plot.frontage).toBeCloseTo(30 * FT, 9);
    expect(LAYOUT.plot.depth).toBeCloseTo(60 * FT, 9);
    // a road thirty feet wide: one of the widths the sheets print
    expect(LAYOUTS.flatMap((l) => l.roadWidths)).toContain(30);
    expect(LAYOUT.road).toBeCloseTo(30 * FT, 9);
  });

  it('lays each block two plots deep between its roads, its plots across it whole', () => {
    const all = layoutBlocks();
    // (and one more, beyond the side road: one row deep, fronting that road)
    expect(all).toHaveLength(2 * (LAYOUT.roads.length - 1) + 1);
    const side = all[all.length - 1];
    const road = layoutSideRoad();
    expect(side[0]).toBeCloseTo(road[1], 6);
    expect(side[1] - side[0]).toBeCloseTo(LAYOUT.plot.depth, 6);
    expect(side[3] - side[2]).toBeCloseTo(LAYOUT.across * LAYOUT.plot.frontage, 6);
    expect(road[1] - road[0]).toBeCloseTo(LAYOUT.road, 6);
    // inside the east wall
    expect(side[1]).toBeLessThan(LAYOUT.reach.east);
    const blocks = all.slice(0, -1);
    for (const [i, [x0, x1, z0, z1]] of blocks.entries()) {
      expect(z1 - z0).toBeCloseTo(2 * LAYOUT.plot.depth, 6);
      expect(x1 - x0).toBeCloseTo(LAYOUT.across * LAYOUT.plot.frontage, 6);
      // the first row on the avenue's verge, where its palms have stood back;
      // the rest clear of their trunks (x +/-7.6)
      expect(Math.min(Math.abs(x0), Math.abs(x1))).toBeGreaterThanOrEqual(i < 2 ? LAYOUT.avenue : LAYOUT.x0);
      expect(Math.max(Math.abs(x0), Math.abs(x1))).toBeLessThan(LAYOUT.reach.west);
      // and no block on a road
      for (const zc of LAYOUT.roads) {
        expect(z0 >= zc + LAYOUT.road / 2 - 1e-6 || z1 <= zc - LAYOUT.road / 2 + 1e-6).toBe(true);
      }
    }
  });

  it('stands inside the walls, clear of the forecourt garden, with the utility strip along the south wall', () => {
    const wall = ESTATE_ARCHITECTURE.filter((b) => b.name === 'estate_wall');
    // (the south wall's runs across the roads' reach, past z 200: its corners
    // come in further, beyond the roads' ends)
    const south = Math.min(
      ...wall.filter((b) => b.min[2] > 200 && b.min[0] < LAYOUT.reach.west && b.max[0] > -LAYOUT.reach.west).map((b) => b.min[2]),
    );
    const west = Math.max(...wall.filter((b) => b.max[0] < -60 && b.min[2] > 100 && b.max[2] < 200).map((b) => b.max[0]));
    const first = LAYOUT.roads[0] - LAYOUT.road / 2;
    const last = LAYOUT.roads[LAYOUT.roads.length - 1] + LAYOUT.road / 2;
    expect(last).toBeLessThan(south);
    expect(south - last).toBeGreaterThan(5);
    expect(-LAYOUT.reach.west).toBeGreaterThan(west);
    expect(LAYOUT.reach.east).toBeLessThan(-west);
    // the first road runs along the foot of the forecourt's ring (its outer
    // kerb at z 44), and the garden's trees in its line stand back
    // (clearJunctions)
    expect(first).toBeLessThan(LAYOUT.ring.z + LAYOUT.ring.r);
    expect(first).toBeGreaterThan(LAYOUT.ring.z + 8);
    const garden = ESTATE_PLANTING.filter((b) => b.name === 'veg_tree_garden');
    expect(garden.filter((b) => inJunction((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2, 2))).toHaveLength(4);
  });

  it('lets nothing of the estate stand in a road, except the palms and garden trees it stands back', () => {
    const palms = ESTATE_PLANTING.filter((b) => b.name === 'veg_palm_avenue');
    const inRoad = palms.filter((b) => inJunction((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2, 0.6));
    expect(palms).toHaveLength(36);
    // the palms between the forecourt and the second road, where the founder's
    // frame has the road open, and a pair at each junction after: under half
    // go, and the avenue from the second road to the gate (its plate, /terms)
    // keeps every one but those.
    const open = palms.filter((b) => {
      const z = (b.min[2] + b.max[2]) / 2;
      return z > LAYOUT.openAvenue[0] && z < LAYOUT.openAvenue[1];
    });
    const gone = new Set([...inRoad, ...open]);
    expect(open).toHaveLength(12);
    expect(gone.size).toBeLessThanOrEqual(18);
    expect(LAYOUT.openAvenue[1]).toBeGreaterThan(LAYOUT.roads[1] + LAYOUT.road / 2);
    // the planting along the walls is thinned only where it stands in a road or
    // on a plot (clearJunctions); what remains stands clear, and nothing but the
    // planting is taken: the estate's own trees are named in the clearing's list
    const src = read('./exteriorLayout.ts');
    expect(src).toContain('/^(veg_tree_|grown_tree_|veg_palm_coconut|veg_palm_forecourt)/');
    expect(src).toContain("!im.name.startsWith('veg_tree_layout')");
    // the jungle sows nothing on the layout's land (exteriorJungle.ts)
    expect(read('./exteriorJungle.ts')).toContain('return out.filter((t) => !onTheLayout(t.at[0], t.at[1]));');
    expect(onTheLayout(35.3, 190.5)).toBe(true);
    expect(onTheLayout(-23, 220.4)).toBe(false);
    expect(onTheLayout(0, 30)).toBe(false);
    expect(onTheLayout(0, 36)).toBe(false);
  });

  it('builds the roads and their kerbs as ground: at the drive’s level, a kerb down each side', () => {
    const { roads, kerbs } = layoutGroundGeometry();
    roads.computeBoundingBox();
    kerbs.computeBoundingBox();
    expect(roads.boundingBox!.max.y).toBeCloseTo(LAYOUT.y, 6);
    expect(roads.boundingBox!.max.y).toBeLessThan(0.012);
    expect(kerbs.boundingBox!.max.y).toBeCloseTo(LAYOUT.kerb.height, 6);
    // a road each side of the avenue for each of the four, and the side road
    expect(roads.index!.count / 6).toBe(2 * LAYOUT.roads.length + 1);
    // the roads are named as the drive, so every pass dresses them as it does
    // (the grade, the polish, the ground's shadow: ExteriorModel)
    expect(read('./exteriorLayout.ts')).toContain("road.name = 'drive_layout';");
    expect(read('./ExteriorModel.tsx')).toContain("mesh.name.startsWith('drive_')");
  });
});

describe('the air and the land over the chapter', () => {
  it('leaves the approved revolution alone: nothing is up before the sweep', () => {
    // (the revolution ends at leg 0.3875: cameraPath.ts)
    expect(layoutAir('exterior', 0.3875)).toBe(0);
    expect(layoutLow('exterior', 0.3875)).toBe(0);
    expect(layoutOn('exterior', 0.3875)).toBe(0);
    const canvas = read('./WorldCanvas.tsx');
    expect(canvas).toContain('const AIR_ALOFT = { over: [0.39, 0.45, 0.7, 0.78]');
  });

  it('lays the land low before the drawing comes and until after it has gone', () => {
    for (let s = 0.3; s <= 0.85; s += 0.002) {
      if (layoutOn('exterior', s) > 0) expect(layoutLow('exterior', s), `leg ${s.toFixed(3)}`).toBeGreaterThan(0);
    }
    expect(layoutLow('exterior', FILM_SHARE)).toBe(1);
    expect(layoutLow('exterior', 0.8)).toBe(0);
    expect(layoutLow('interior', FILM_SHARE)).toBe(0);
    expect(layoutLow('exterior', FILM_SHARE, false)).toBe(0);
  });

  it('plants no tree for the frame in a road, and none stands in any other chapter', () => {
    for (const t of LAYOUT_TREES) {
      expect(inJunction(t.at[0], t.at[1]), `${t.species} at ${t.at.join(', ')}`).toBe(false);
    }
    // planted after the clearing's test: the clearing passes over them by name
    expect(read('./exteriorLayout.ts')).toContain("!im.name.startsWith('veg_tree_layout')");
    // each its own material that comes with the layout's air, casting nothing,
    // and not drawn at all until that air is up
    const jungle = read('./exteriorJungle.ts');
    expect(jungle).toContain('own.userData.arrive = true;');
    expect(jungle).toContain('mesh.castShadow = src.castShadow && !arrive;');
    expect(read('./exteriorHaze.ts')).toContain('#ifdef HAZE_ARRIVE');
    expect(read('./ExteriorModel.tsx')).toContain('for (const m of fades.current.arriving) m.visible = air > 0;');
  });

  it('lays nothing of the plan on the estate but while it is shown', () => {
    const layout = read('./exteriorLayout.ts');
    // the roads and their kerbs arrive with the air, each on its own material
    expect(layout).toContain('new THREE.Mesh(roads, arriving(drive as THREE.Material))');
    expect(layout).toContain('new THREE.Mesh(kerbs, arriving(trim as THREE.Material))');
    // what stands where it is laid goes with it, on a copy that keeps what the
    // passes compiled in, and casts nothing
    expect(layout).toContain('own.onBeforeCompile = src.onBeforeCompile;');
    expect(layout).toContain('own.userData.leave = true;');
    expect(layout).toContain('mesh.castShadow = false;');
    expect(read('./exteriorHaze.ts')).toContain('#ifdef HAZE_LEAVE');
    expect(read('./ExteriorModel.tsx')).toContain('for (const m of fades.current.leaving) m.visible = air < 1 || (m.userData.back === true && back > 0);');
    // and the air is only up over the chapter
    expect(layoutAir('exterior', 0.2)).toBe(0);
    expect(layoutAir('exterior', FILM_SHARE)).toBe(1);
    expect(layoutAir('exterior', 0.9)).toBe(0);
    expect(layoutAir('interior', FILM_SHARE)).toBe(0);
    expect(layoutAir('exterior', FILM_SHARE, false)).toBe(0);
  });

  it('cuts only the far land, the forest’s roof and what already discards, never the house', () => {
    const haze = read('./exteriorHaze.ts');
    expect(haze).toContain("const ground = mesh.name === 'ground_plane';");
    expect(haze).toContain("const roof = mat.name === 'MAT_Jungle_Canopy';");
    expect(haze).toContain('const cut = ground || roof ||');
    for (const m of haze.matchAll(/discard;/g)) {
      const before = haze.slice(Math.max(0, m.index - 1200), m.index);
      expect(before).toMatch(/#ifdef HAZE_(CUT|DISSOLVE|ARRIVE|FAR|LEAVE)/);
    }
  });
});

describe('the drawing', () => {
  it('is on only for its chapter, and comes and goes without a step', () => {
    expect(layoutOn('exterior', 0)).toBe(0);
    expect(layoutOn('exterior', 0.4)).toBe(0);
    expect(layoutOn('exterior', FILM_SHARE)).toBe(1);
    expect(layoutOn('exterior', 0.8)).toBe(0);
    expect(layoutOn('interior', FILM_SHARE)).toBe(0);
    // and never on a page that only stands its camera on a pose
    expect(layoutOn('exterior', FILM_SHARE, false)).toBe(0);
    let last = 0;
    for (let s = 0.5; s <= 0.75; s += 0.001) {
      const now = layoutOn('exterior', s);
      expect(Math.abs(now - last)).toBeLessThan(0.05);
      last = now;
    }
  });

  it('is up before the chapter’s words, and still up while they are', () => {
    const holdings = chapters(3).find((c) => c.id === 'holdings')!;
    // the chapter's words, as leg progress (journey.ts: document scroll over
    // the exterior leg's share of it)
    const leg = (doc: number) => doc / DOOR_OUT;
    expect(layoutOn('exterior', leg(holdings.copy.in[1]))).toBe(1);
    expect(layoutOn('exterior', leg(holdings.copy.out[0]))).toBe(1);
    // and on its way up before the words begin
    expect(layoutOn('exterior', leg(holdings.copy.in[0]))).toBeGreaterThan(0.5);
  });

  it('stands no crosshair anywhere: not on the ground, by its status, or after its cue', () => {
    // (the founder's frame had them; the user took them off the site, 2026-11-01)
    expect(read('../../app/(site)/(experience)/site-home/page.tsx')).not.toMatch(/layout-mark|layout-hud-mark/);
    expect(read('../../app/globals.css')).not.toMatch(/layout-mark|layout-hud-mark|start-cue-crosshair|start-cue-ticks/);
    expect(read('./StartCue.tsx')).not.toContain('start-cue-crosshair');
    expect(read('./exteriorLayout.ts')).not.toMatch(/LAYOUT_MARKS|data-layout-mark/);
  });

  it('labels every word it lays on the ground', () => {
    const page = readFileSync(join(__dirname, '../../app/(site)/(experience)/site-home/page.tsx'), 'utf8');
    const labels = [...page.matchAll(/data-layout-label="(\d+)"/g)].map((m) => Number(m[1]));
    expect(labels.sort((a, b) => a - b)).toEqual(LAYOUT_LABELS.map((_, i) => i));
    // the words are the drawing's, told to a screen reader in the chapter's own
    expect(page).toContain('<div aria-hidden className="layout-sheet">');
    // and say only what the sheets say: no plot of 12,500 sq ft, no approval
    // number the sheets do not carry, and no plot marked available
    expect(page).not.toMatch(/12,500/);
    expect(page).not.toMatch(/LP NO/i);
    expect(page).not.toMatch(/>\s*Available\s*</i);
    expect(page).toContain('{`[${LAYOUT_PLOT.size} // ${LAYOUT_PLOT.sqFt} sq ft each]`}');
  });
});
