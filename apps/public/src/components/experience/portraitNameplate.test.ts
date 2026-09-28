// apps/public/src/components/experience/portraitNameplate.test.ts
//
// The nameplate is the one piece of the portrait wall that is NOT in the GLB —
// it is built at runtime so the wording can change without a re-export and a
// re-bake (PortraitNameplate.tsx). That is what makes it worth a test: nothing
// in the asset pipeline can notice when it drifts away from the frame it hangs
// under.
//
// The hall's own numbers below are measured from the imperial interior
// (tools/blender/imperial_hall_v7.py; the same figures head interiorPath.ts), so
// if the portrait is ever moved again, this fails on the same edit that moves
// it rather than in a screenshot three chapters later.

import { describe, expect, it } from 'vitest';
import { FOUNDER, NAMEPLATE } from './PortraitNameplate';
import { buildInteriorBeats, IMPERIAL_STAIR } from './interiorPath';

/** Measured from the shipped hall, three-space metres. */
const HALL = {
  wallFaceZ: -7.7,
  wallOuterZ: -8.0,
  frame: { halfWidth: 1.509, bottom: 5.0, top: 9.069, faceZ: -7.542 },
  /** The arched walnut panel the portrait hangs on, and its face. */
  panel: { halfWidth: 1.85, faceZ: -7.67 },
  landingTop: IMPERIAL_STAIR.landing,
  /** The landing balustrade's line across the court, on the axis. */
  railZ: -(3.1 + IMPERIAL_STAIR.rInner + 0.14),
  railTop: IMPERIAL_STAIR.landing + IMPERIAL_STAIR.rail,
};

describe('the portrait nameplate', () => {
  const { plate, wallZ, panelDepth, frameBottom } = NAMEPLATE;
  const plateTop = frameBottom - plate.gap;
  const plateBottom = plateTop - plate.height;
  const plateZ = wallZ + panelDepth + plate.depth;

  it('hangs on the panel the portrait hangs on', () => {
    expect(wallZ).toBe(HALL.wallFaceZ);
    expect(frameBottom).toBe(HALL.frame.bottom);
    // On the walnut panel's face, and behind the frame's own face.
    expect(wallZ + panelDepth).toBeCloseTo(HALL.panel.faceZ, 3);
    expect(plateZ).toBeLessThan(HALL.frame.faceZ);
    // And inside the wall's thickness, so nothing pokes out of the building.
    expect(wallZ).toBeGreaterThan(HALL.wallOuterZ);
    expect(plate.width / 2).toBeLessThan(HALL.panel.halfWidth);
  });

  it('reads between the frame and the landing, not behind either', () => {
    expect(plateTop).toBeLessThan(HALL.frame.bottom);
    expect(plateBottom).toBeGreaterThan(HALL.landingTop);
  });

  it('is seen whole over the landing rail from the portrait beat', () => {
    // The landing's balustrade stands 2 m in front of the plate. From the
    // portrait beat the sight line to the plate's lowest edge must pass over
    // the rail, or the rail crosses the engraving.
    const beat = buildInteriorBeats(3).find((b) => b.id === 'portrait')!;
    const [, cy, cz] = beat.position;
    const t = (HALL.railZ - cz) / (plateZ - cz);
    const yAtRail = cy + (plateBottom - cy) * t;
    expect(yAtRail).toBeGreaterThan(HALL.railTop + 0.05);
  });

  it('engraves only what the site actually publishes', () => {
    // The site gives the founder's title and the company on /about and does not
    // give the name. Until the client supplies it, FOUNDER.name stays null and
    // the plate carries the two true lines — an invented name on a nameplate is
    // worse than no name.
    expect(FOUNDER.title).toBe('Managing Director');
    expect(FOUNDER.company).toBe('Quality Homes Reality');
    expect(typeof FOUNDER.name === 'string' || FOUNDER.name === null).toBe(true);
  });
});
