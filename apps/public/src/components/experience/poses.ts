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
  /**
   * Where scrolling takes you. Optional: a place without one is a still frame.
   *
   * This is the story. `position`/`target` is where you arrive; `to` is where
   * the page has carried you by the time you reach the bottom. The camera is
   * interpolated between them by document scroll progress, so the room moves
   * with the reading rather than sitting behind it.
   *
   * Both ends are real vantages inside the built hall — a scroll path that ends
   * inside a wall is worse than no scroll path, because the failure only shows
   * up at the bottom of a long page where nobody is looking.
   */
  to?: { position: [number, number, number]; target: [number, number, number] };
  /** Seconds to ease in. Places you travel to are slower than frames you simply
   *  settle into, because the movement is the content in the first case and an
   *  interruption in the second. */
  ease: number;
}

export const POSES: Readonly<Record<PlaceId, Pose>> = {
  // Wide, holding all three tables — the establishing frame.
  // VERIFIED by rendering this exact GLB in Blender from this exact pose
  // (tools/blender/inspect_hall_camera.py). The previous value, [4.2, 1.65,
  // -4.6] -> [0, 1.5, 0], was a hand-converted Blender coordinate nobody had
  // ever looked through: it stands beside the staircase with the treads and
  // balusters filling the entire frame, which is exactly what the first device
  // test showed. The model, the scale and the loader were all fine.
  hall: {
    position: [6.4, 1.65, 0.25],
    target: [-5.27, 2.04, -0.95],
    // Scrolling walks the length of the room. A dolly, not an orbit: the room
    // is architecture, and architecture reads through parallax between near and
    // far columns, which a rotation destroys.
    //
    // VERIFIED by render (tools/blender/inspect_hall_camera.py). The previous
    // value, [-1.9, 1.62, -0.55] -> [-5.5, 1.58, -1.5], was invented rather
    // than measured and put the camera a metre from a blank wall panel: on the
    // device you saw the room for a moment at scroll 0, then it damped into
    // featureless grey. Exactly the mistake the original `hall` pose made, made
    // a second time because a scroll destination is only visible at the bottom
    // of a long page where nobody is looking.
    //
    // This one travels ALONG the sight-line the arrival pose already looks
    // down, so the framing is the one that was verified — just closer. A dolly
    // that keeps its subject cannot land in a wall.
    to: { position: [1.95, 1.72, -0.2], target: [-5.27, 1.85, -0.95] },
    ease: 1.1,
  },

  // Reading distance at the Kartikeya table (S1). Blender (-3.40,-1.90,1.60).
  table: { position: [-3.4, 1.6, 1.9], target: [-5.95, 1.45, 1.9], ease: 0.9 },

  // Toward the stair and the upper landing: the approach into the room.
  approach: { position: [0.9, 1.66, 0.6], target: [-5.3, 1.72, -1.1], ease: 1.2 },

  // The entrance, looking in — and the pose the HOME PAGE uses, via '/' in
  // places.ts. That made it the single most-seen frame in the build.
  //
  // It previously read [0.0, 1.7, 6.2] -> [0.0, 1.6, 0.0]. The room ends at
  // z = 5.60, so z = 6.2 stood the camera 0.6m OUTSIDE the back wall, filming
  // its exterior face. Rendered, that frame has a detail score of 0.0174 —
  // effectively a uniform grey — which is exactly what the site showed. The
  // comment above it said "stands in for the exterior until it is modelled",
  // and the exterior is not modelled, so it was standing in a void.
  //
  // Replaced with a vantage chosen by measurement, not by hand: every pose in
  // this file is now rendered by tools/blender/audit_poses.py and scored on
  // frame variance, because a camera aimed at a flat wall produces an almost
  // uniform image and that is detectable without anyone opening the file. This
  // one scores 0.1083 — coffered ceiling, chandelier, columns, staircase.
  arrival: {
    position: [6.9, 1.68, 3.1],
    target: [-4.6, 1.9, -1.4],
    // Scroll draws you into the room along the same sight-line. 0.0910.
    to: { position: [3.4, 1.68, 1.9], target: [-4.2, 1.78, -1.0] },
    ease: 1.4,
  },

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
