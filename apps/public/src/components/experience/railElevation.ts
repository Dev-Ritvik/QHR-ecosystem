// apps/public/src/components/experience/railElevation.ts
//
// THE RAIL'S FIGURES: how high the camera stands at each chapter, metres over
// the ground it is above (the lawn outside, the hall's floor inside; both are
// y = 0 in their sets).
//
// The concept the user asked to be built 1:1 (2026-10-27) draws the rail as a
// surveyor's elevation scale, a figure at each mark and the current one lit.
// Its figures were a picture's; these are the film's own, read off the same
// curves the camera flies (cameraPath.ts outside, interiorPath.ts in the
// hall): 20.0 over the cover, down the house's flank, 1.6 at the door, up the
// stair to the portrait. So the scale says something true — the film comes
// down out of the air onto the land — and cannot drift from the camera.
//
// Loaded by the rail after it mounts (a dynamic import): it brings three's
// curves with it, which the page's own first bundle must not carry.

import * as THREE from 'three';
import { exteriorPoseAt } from './cameraPath';
import { buildInteriorBeats, interiorCurves, interiorCurveT } from './interiorPath';
import { readJourney, type JourneyState } from './journey';

/** The camera's height over its ground at each place on the film (the film's
 *  own fractions, as the rail's stops give them), for this many tables. */
export function filmElevations(places: readonly number[], stations: number): number[] {
  const beats = buildInteriorBeats(stations);
  const curves = interiorCurves(beats);
  const j: JourneyState = { leg: 'exterior', legProgress: 0, veil: 0, armed: false, coda: 0 };
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  return places.map((place) => {
    readJourney(place, j);
    if (j.leg === 'exterior') {
      exteriorPoseAt(j.legProgress, p, t);
    } else {
      curves.position.getPoint(interiorCurveT(beats, j.legProgress), p);
    }
    return Math.max(0, p.y);
  });
}

/** As the scale prints a figure: one decimal, metres. */
export function elevationLabel(metres: number): string {
  return metres.toFixed(1);
}
