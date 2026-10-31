// apps/public/src/components/experience/railElevation.test.ts
//
// The rail's figures are the camera's own heights (the concept built 1:1,
// 2026-10-27): the cover's twenty metres, and eye height at the tables.

import { describe, expect, it } from 'vitest';
import { FILM_BEATS } from './cameraPath';
import { elevationLabel, filmElevations } from './railElevation';

describe("the rail's figures", () => {
  it("reads the cover's height off the camera's own path", () => {
    const [cover] = filmElevations([0], 3);
    expect(cover).toBeCloseTo(FILM_BEATS[0].position[1], 6);
    expect(elevationLabel(cover)).toBe(FILM_BEATS[0].position[1].toFixed(1));
  });

  it('comes down to the hall, and never under the ground', () => {
    const places = [0, 0.1, 0.2, 0.3, 0.45, 0.55, 0.7, 0.85, 1];
    const h = filmElevations(places, 3);
    for (const v of h) expect(v).toBeGreaterThanOrEqual(0);
    expect(h[h.length - 1]).toBeLessThan(h[0]);
  });
});
