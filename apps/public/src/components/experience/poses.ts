// apps/public/src/components/experience/poses.ts
//
// Where the camera stands for each place.
//
// Coordinates converted from the Blender scene. The GLB was exported with
// export_yup, so Blender (x, y, z) becomes three.js (x, z, -y). Getting this
// backwards puts the camera inside a wall, which is exactly what happened the
// first time a pose was written straight from a Blender render script.
//
// HONEST STATE: only `hall` and the three table poses correspond to geometry
// that actually exists. Arrival, approach, window, study and desk are framings
// WITHIN the built hall so the frame behind a surface is always somewhere real
// rather than an empty void — they become their own rooms when those rooms are
// modelled. Nothing here pretends a space exists that does not.

import type { PlaceId } from '@estate/domain/experience/places';

export interface Pose {
  position: [number, number, number];
  target: [number, number, number];
  /** Seconds to ease in. Places you travel to are slower than frames you simply
   *  settle into, because the movement is the content in the first case and an
   *  interruption in the second. */
  ease: number;
}

export const POSES: Readonly<Record<PlaceId, Pose>> = {
  // Wide, holding all three tables — the establishing frame.
  hall: { position: [4.2, 1.65, -4.6], target: [0, 1.5, 0], ease: 1.1 },

  // Reading distance at the Kartikeya table (S1). Blender (-3.40,-1.90,1.60).
  table: { position: [-3.4, 1.6, 1.9], target: [-5.95, 1.45, 1.9], ease: 0.9 },

  // Toward the stair and the upper landing: the approach into the room.
  approach: { position: [0.9, 1.66, 0.6], target: [-5.3, 1.72, -1.1], ease: 1.2 },

  // The entrance, looking in. Stands in for the exterior until it is modelled.
  arrival: { position: [0.0, 1.7, 6.2], target: [0.0, 1.6, 0.0], ease: 1.4 },

  // Facing the Lucky Garden table, which is the closest thing the built hall
  // has to a map surface.
  window: { position: [-4.6, 1.58, -1.5], target: [-4.6, 1.42, -3.8], ease: 1.0 },

  // Facing the Gayatri table — papers on a surface, which is what the study is.
  study: { position: [3.4, 1.6, -0.9], target: [5.95, 1.42, -0.9], ease: 0.8 },

  // Turned toward the room rather than a table: where you speak to someone.
  desk: { position: [1.6, 1.6, 1.2], target: [-1.0, 1.5, -1.4], ease: 0.9 },
};

export function poseFor(place: PlaceId): Pose {
  return POSES[place] ?? POSES.hall;
}
