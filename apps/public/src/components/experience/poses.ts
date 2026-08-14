// apps/public/src/components/experience/poses.ts
//
// Where the camera stands for each place.
//
// Coordinates converted from the Blender scene. The GLB was exported with
// export_yup, so Blender (x, y, z) becomes three.js (x, z, -y). Getting this
// backwards puts the camera inside a wall, which is exactly what happened the
// first time a pose was written straight from a Blender render script.
//
// HONEST STATE: `arrival` and `approach` stand outside, in the exterior set.
// `hall` and the three table poses are inside the built hall. Window, study and
// desk are framings WITHIN that hall so the frame behind a surface is always
// somewhere real rather than an empty void — they become their own rooms when
// those rooms are modelled. Nothing here pretends a space exists that does not.

import type { PlaceId } from '@estate/domain/experience/places';

/** Which GLB a pose's coordinates belong to. The two sets are separate models
 *  with separate origins, so a pose is meaningless without this — an interior
 *  coordinate evaluated against the exterior stands in the middle of a lawn. */
export type SceneSet = 'interior' | 'exterior';

export interface Pose {
  set: SceneSet;
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
    set: 'interior',
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
  table: { set: 'interior', position: [-3.4, 1.6, 1.9], target: [-5.95, 1.45, 1.9], ease: 0.9 },

  // OUTSIDE, three-quarter. Reads /about, /why-us and /testimonials — the pages
  // about the company rather than a plot, so the building is seen whole and at
  // an angle that shows it has depth.
  //
  // Verified: 0.2444 at the far end, 0.2341 at the near end
  // (tools/blender/find_exterior_approach.py).
  approach: {
    set: 'exterior',
    position: [8.5, 1.65, 26.0],
    target: [0.0, 4.0, 0.0],
    to: { position: [7.0, 1.7, 20.0], target: [0.0, 3.6, 0.0] },
    ease: 1.2,
  },

  // OUTSIDE, on the entry axis — the frame the HOME PAGE opens on, via '/' in
  // places.ts, and therefore the single most-seen frame in the build.
  //
  // This pose has been wrong twice, both times because it was an interior
  // coordinate pretending to be an exterior one:
  //
  //   [0.0, 1.7, 6.2] stood 0.6m outside the hall's BACK WALL filming its
  //   outer face — detail 0.0174, a uniform grey, exactly what the client saw.
  //   [6.9, 1.68, 3.1] was a real interior vantage, but the brief never asked
  //   for an interior here. The reference the client gave (vertex3d.asia) opens
  //   on the outside of a building, and so should this.
  //
  // Now it is genuinely outdoors. The camera stands on the axis at eye height
  // beyond the fountain, holding the full elevation: portico, lion frieze,
  // cupola and spire, with the fountain as the foreground object.
  //
  // Both ends rendered against this exact GLB before shipping — 0.2352 and
  // 0.2029, against 0.1255 for the best interior pose in the file. z=13 was
  // tested and rejected: it is close enough that the door panels fill the frame
  // and the building is lost, so the dolly stops at 18.
  arrival: {
    set: 'exterior',
    position: [0.0, 1.65, 30.0],
    target: [0.0, 4.2, 0.0],
    // Scroll walks you up the axis toward the door. A dolly, not an orbit:
    // architecture reads through parallax between the fountain and the facade.
    to: { position: [0.0, 1.65, 18.0], target: [0.0, 3.4, 0.0] },
    ease: 1.4,
  },

  // Facing the Lucky Garden table, which is the closest thing the built hall
  // has to a map surface.
  window: { set: 'interior', position: [-4.6, 1.58, -1.5], target: [-4.6, 1.42, -3.8], ease: 1.0 },

  // Facing the Gayatri table — papers on a surface, which is what the study is.
  study: { set: 'interior', position: [3.4, 1.6, -0.9], target: [5.95, 1.42, -0.9], ease: 0.8 },

  // Turned toward the room rather than a table: where you speak to someone.
  desk: { set: 'interior', position: [1.6, 1.6, 1.2], target: [-1.0, 1.5, -1.4], ease: 0.9 },
};

/** Which model this route needs loaded. Drives both the GLB and the lighting
 *  rig, which differ completely between the two sets. */
export function setFor(place: PlaceId): SceneSet {
  return poseFor(place).set;
}

export function poseFor(place: PlaceId): Pose {
  return POSES[place] ?? POSES.hall;
}
