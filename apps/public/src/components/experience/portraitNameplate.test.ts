// apps/public/src/components/experience/portraitNameplate.test.ts
//
// The nameplate is the one piece of the portrait wall that is NOT in the GLB —
// it is built at runtime so the wording can change without a re-export and a
// re-bake (PortraitNameplate.tsx). That is what makes it worth a test: nothing
// in the asset pipeline can notice when it drifts away from the frame it hangs
// under.
//
// The hall's own numbers below are measured from the extended interior
// (tools/blender/extend_hall_v7.py; the same figures head interiorPath.ts), so
// if the portrait is ever moved again, this fails on the same edit that moves
// it rather than in a screenshot three chapters later.

import { describe, expect, it } from 'vitest';
import { FOUNDER, NAMEPLATE } from './PortraitNameplate';

/** Measured from the shipped hall, three-space metres. */
const HALL = {
  wallFaceZ: -7.7,
  wallOuterZ: -8.0,
  frame: { halfWidth: 1.207, bottom: 3.95, top: 7.205, faceZ: -7.574 },
  landingTop: 3.471,
  corniceBottom: 7.45,
  /** The back wall's panel mouldings, which the mount must not run into. */
  mouldingInnerX: 3.4,
};

describe('the portrait nameplate', () => {
  const { mount, plate, wallZ, frameBottom } = NAMEPLATE;
  const plateTop = frameBottom - plate.gap;
  const plateBottom = plateTop - plate.height;

  it('hangs on the wall the portrait hangs on', () => {
    expect(wallZ).toBe(HALL.wallFaceZ);
    expect(frameBottom).toBe(HALL.frame.bottom);
    // In front of the plaster, behind the frame's own face.
    expect(mount.depth).toBeGreaterThan(0);
    expect(wallZ + mount.depth + plate.depth).toBeLessThan(HALL.frame.faceZ);
    // And inside the wall's thickness, so nothing pokes out of the building.
    expect(wallZ).toBeGreaterThan(HALL.wallOuterZ);
  });

  it('reads between the frame and the landing, not behind either', () => {
    expect(plateTop).toBeLessThan(HALL.frame.bottom);
    expect(plateBottom).toBeGreaterThan(HALL.landingTop);
  });

  it('gives the frame a mount that is wider and taller than it, and clear of the room', () => {
    expect(mount.width / 2).toBeGreaterThan(HALL.frame.halfWidth);
    expect(mount.width / 2).toBeLessThan(HALL.mouldingInnerX);
    expect(mount.top).toBeGreaterThan(HALL.frame.top);
    expect(mount.top).toBeLessThan(HALL.corniceBottom);
    // It stands ON the landing rather than floating over it or sinking in.
    expect(Math.abs(mount.bottom - HALL.landingTop)).toBeLessThan(0.05);
  });

  it('holds the whole plate', () => {
    expect(plate.width).toBeLessThan(mount.width);
    expect(plateBottom).toBeGreaterThan(mount.bottom);
    expect(plateTop).toBeLessThan(mount.top);
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
