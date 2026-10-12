// apps/public/src/components/experience/poses.test.ts
//
// Where a page's plate is shot from.
//
// A pose is two triples of numbers, and a wrong one fails in a way nothing
// reports: the page still loads, with a wall behind its title. Three of the
// seven did exactly that for months behind the old reading panels (poses.ts
// has the account). These hold the things about a pose that can be held
// without a browser; the frames themselves were judged by eye on the build.

import { describe, expect, it } from 'vitest';
import { PLACES, placeForRoute } from '@estate/domain/experience/places';
import { PROJECTS } from '@estate/domain/leads/branches';
import { STATION_ANCHORS, buildInteriorBeats, stationViewpoint } from './interiorPath';
import { POSES, poseFor, setFor } from './poses';

/** The hall's shell, with a margin: its walls stand at x +/-9.90 and z +/-7.70,
 *  and the oculus is 19 m up. */
const ROOM = { x: 9.6, z: 7.4, top: 18 };

const inside = (p: readonly number[]) =>
  Math.abs(p[0]) <= ROOM.x && Math.abs(p[2]) <= ROOM.z && p[1] > 0.4 && p[1] < ROOM.top;

describe('a pose for every place', () => {
  it('gives every place the registry declares a pose of its own', () => {
    for (const place of PLACES) {
      expect(POSES[place], place).toBeDefined();
      expect(poseFor(place)).toBe(POSES[place]);
    }
    // and no pose the registry has no place for
    expect(Object.keys(POSES).sort()).toEqual([...PLACES].sort());
  });

  it('stands every interior pose, and where its page carries it, inside the room', () => {
    for (const place of PLACES) {
      const p = POSES[place];
      if (p.set !== 'interior') continue;
      expect(inside(p.position), `${place} position`).toBe(true);
      if (p.to) expect(inside(p.to.position), `${place} to`).toBe(true);
    }
  });

  it('gives every still a second frame, and keeps a page with no window to a pace or two', () => {
    // A page with a WINDOW shows its second frame there, and that is a second
    // picture (poses.ts, `to`; the forensic audit of 2026-10-09, #66: the
    // band halfway down repeated the opening picture). A page with none shows
    // its move only as its plate leaves: there it is a push in.
    const pagesWithAWindow = new Set(['tables', 'plots', 'map', 'dome', 'sconces', 'estate', 'door', 'portico', 'portrait', 'reading', 'table', 'window', 'study']);
    for (const place of PLACES) {
      const p = POSES[place];
      if (p.path) continue;
      expect(p.to, place).toBeDefined();
      const d = Math.hypot(
        p.to!.position[0] - p.position[0],
        p.to!.position[1] - p.position[1],
        p.to!.position[2] - p.position[2],
      );
      expect(d, place).toBeGreaterThan(0.2);
      if (!pagesWithAWindow.has(place)) expect(d, place).toBeLessThanOrEqual(p.set === 'interior' ? 1.4 : 7);
    }
  });

  it('gives every pose that is not on the film a lens of its own or the default, and never a wide one indoors', () => {
    for (const place of PLACES) {
      const p = POSES[place];
      if (p.path) continue;
      const fov = p.fov ?? 45;
      expect(fov, place).toBeGreaterThanOrEqual(26);
      expect(fov, place).toBeLessThanOrEqual(56);
    }
  });
});

describe("the layouts' tables", () => {
  const TABLE = { S1: 'table', S2: 'window', S3: 'study' } as const;

  it("looks at each layout's table from where the film stands to read it", () => {
    for (const id of ['S1', 'S2', 'S3'] as const) {
      const anchor = STATION_ANCHORS.find((a) => a.id === id)!;
      const vp = stationViewpoint(anchor);
      const pose = POSES[TABLE[id]];
      expect(pose.set).toBe('interior');
      expect(pose.position).toEqual(vp.position);
      expect(pose.target).toEqual(vp.target);
      // the film's long lens, and its subject right of the middle by a metre or so
      expect(pose.fov).toBe(30);
      expect(pose.frameOffset).toBeGreaterThan(0);
      expect(pose.frameOffset).toBeLessThan(1.2);
      // and the lens ON the model: a still in the hall had the estate's lens,
      // and the model was the one thing not sharp (the audit's #69)
      expect(pose.focus).toEqual([anchor.position[0], anchor.holoY, anchor.position[2]]);
    }
  });

  it('rises over a table for its second frame and looks down on the plan, from the side the film reads it', () => {
    for (const id of ['S1', 'S2', 'S3'] as const) {
      const anchor = STATION_ANCHORS.find((a) => a.id === id)!;
      const pose = POSES[TABLE[id]];
      const to = pose.to!;
      // on the same model, with an offset of its own for its shorter distance
      expect(Math.hypot(to.target[0] - pose.target[0], to.target[2] - pose.target[2])).toBeLessThan(0.01);
      expect(to.frameOffset).toBeLessThan(pose.frameOffset!);
      // from over it: higher than the eye, nearer, and on the film's side of the table
      expect(to.position[1]).toBeGreaterThan(pose.position[1] + 1);
      const before = Math.hypot(pose.position[0] - anchor.position[0], pose.position[2] - anchor.position[2]);
      const after = Math.hypot(to.position[0] - anchor.position[0], to.position[2] - anchor.position[2]);
      expect(after).toBeLessThan(before);
      expect(after).toBeGreaterThan(1.2);
      const side = (to.position[0] - anchor.position[0]) * anchor.inward[0] + (to.position[2] - anchor.position[2]) * anchor.inward[1];
      expect(side).toBeGreaterThan(0);
    }
  });

  it("opens every layout's page at that layout's own table", () => {
    for (const project of PROJECTS) {
      const place = placeForRoute(`/projects/${project.slug}`);
      expect(place, project.slug).toBe(TABLE[project.station]);
      expect(setFor(place)).toBe('interior');
    }
  });
});

describe("the film's own frames, held as plates", () => {
  const beats = buildInteriorBeats(PROJECTS.length);
  const beat = (id: string) => beats.find((b) => b.id === id)!;

  it('shoots the portrait and the map from the film', () => {
    for (const [place, id] of [
      ['portrait', 'portrait'],
      ['map', 'map'],
    ] as const) {
      const b = beat(id);
      expect(POSES[place].position, place).toEqual(b.position);
      expect(POSES[place].target, place).toEqual(b.target);
      expect(POSES[place].fov, place).toBe(b.fov);
    }
  });

  it('holds the page about the company under the portrait, and the districts on their table', () => {
    expect(placeForRoute('/about')).toBe('portrait');
    expect(placeForRoute('/locations')).toBe('map');
  });
});

describe('inside and outside', () => {
  it('opens the pages about the house from outside and the pages about its tables from inside', () => {
    for (const route of ['/why-us', '/testimonials', '/construction-updates', '/book-a-site-visit', '/start-here', '/terms', '/refund-policy', '/sitemap']) {
      expect(setFor(placeForRoute(route)), route).toBe('exterior');
    }
    for (const route of ['/projects', '/properties', '/gallery', '/hall', '/about', '/locations', '/faqs', '/privacy', '/cookie-policy', '/nothing-here']) {
      expect(setFor(placeForRoute(route)), route).toBe('interior');
    }
  });
});
