// apps/public/src/components/experience/poses.ts
//
// Where the camera stands for each place.
//
// Coordinates converted from the Blender scene. The GLB was exported with
// export_yup, so Blender (x, y, z) becomes three.js (x, z, -y). Getting this
// backwards puts the camera inside a wall, which is exactly what happened the
// first time a pose was written straight from a Blender render script.
//
// ---------------------------------------------------------------------------
// EVERY POSE HERE IS A FRAME SOMEBODY HAS LOOKED THROUGH (2026-10-06)
// ---------------------------------------------------------------------------
//
// A page opens on a full frame of its place now (app/folio.css, the plate),
// with nothing over the picture but its title. Until then a place was the
// frame held BEHIND a panel, at a twentieth of the room's light, and four of
// the seven poses had gone wrong unseen:
//
//   - `table`, `window` and `study` were written for "reading distance at the
//     table" and then aimed 7.4 m to the LEFT of it: the rig's frame offset,
//     which is a constant sized for the exterior (a house 28 m away), was
//     applied to every still. At 2.5 m that is 71 degrees off the subject.
//     Seen on the build with the lights up: three frames of bare panelling,
//     with no table in any of them.
//   - `hall` was verified once, in a room that has since been extended, and
//     held one table of three.
//
// So the interior poses are the FILM'S OWN, which are verified, collision
// tested and approved: a layout's table is seen from where the film stands to
// read it (interiorPath.ts, stationViewpoint, and its 30 degree lens), the
// portrait from the portrait's beat, the map from the map's. A test holds each
// of them to the film (poses.test.ts), so a table that is moved takes its
// page's plate with it. The rest were found by eye on the running build with
// the look-dev rig (`?debug=1`, window.__estatePose; the tool that shoots a
// set of candidates is _capture_tools/replay/c12/plate_dial.mjs) and are
// recorded here as they were judged.
//
// A pose says its own lens and its own framing now (`fov`, `frameOffset`),
// and the rig applies them; an interior still without a `frameOffset` is aimed
// at what it names.

import type { PlaceId } from '@estate/domain/experience/places';
import { STATION_ANCHORS, stationViewpoint } from './interiorPath';

/** Which GLB a pose's coordinates belong to. The two sets are separate models
 *  with separate origins, so a pose is meaningless without this — an interior
 *  coordinate evaluated against the exterior stands in the middle of a lawn. */
export type SceneSet = 'interior' | 'exterior';

type V3 = [number, number, number];

export interface Pose {
  set: SceneSet;
  position: V3;
  target: V3;
  /**
   * THE PAGE'S SECOND FRAME. Optional: a place without one is a still.
   *
   * `position`/`target` is the frame a page opens on. `to` is the frame it
   * shows at its WINDOW — the opening between two sheets where the picture is
   * let through again — and the camera goes from the one to the other as the
   * page is read down to it (plateBand.ts, pageMove; on a page with no window
   * the move runs the page's length and is only seen leaving the plate, so
   * there it is a short push in).
   *
   * It used to be a few centimetres further along the same sight line, on
   * every page: a window then showed the opening picture again (the forensic
   * audit of 2026-10-09, #66: "several pages then repeat their own opening
   * picture as the band halfway down"). It is a second picture now — the same
   * subject from another side or from close, or the next thing to it.
   *
   * Both ends are real vantages, and so is the last stretch of the line
   * between them, which the window shows as it arrives (a camera that comes to
   * rest through a palm is worse than one that never moved: tried, on the
   * estate's page).
   */
  to?: {
    position: V3;
    target: V3;
    /** The second frame's own offset (see `frameOffset`), where it is not the
     *  opening's: an offset is a distance at the subject, and a frame from
     *  half as far off turns twice as far for it. */
    frameOffset?: number;
  };
  /**
   * Follow the multi-point spline in cameraPath.ts instead of lerping between
   * `position` and `to`.
   *
   * A straight line between two poses stops reading as motion once the page is
   * long: stretching the home page to 15 viewports spread the same 12m over six
   * times the scroll and the camera looked frozen. A path changes direction, so
   * every beat reframes rather than creeps. `position`/`target` stay as the
   * first beat, which is what seeds the camera before the first frame.
   */
  path?: boolean;
  /** The lens, as a vertical field in degrees. A still without one is 45. */
  fov?: number;
  /**
   * How far the aim is pushed left of `target` in the camera's own space, in
   * metres, so the subject stands right of the frame's middle and the left is
   * the title's. Outside, where it is omitted, the rig's own (a house 28 m
   * away); inside, none: an interior pose says where it looks.
   */
  frameOffset?: number;
  /**
   * The frame on a screen held upright, where the title is UNDER the picture
   * and not beside it: how much the lens opens (in the tangent of its half
   * field, as phoneFraming.ts has the film's) and WHERE THE LENS'S AXIS
   * STANDS IN THE PICTURE'S OWN BAND — 0 at the header's foot, 1 at the first
   * line of the words. The page measures that band and the frame is slid up
   * over the axis by what it takes on this screen (plateBand.ts): a fixed
   * share of the frame's height was right for one page's words on one size
   * of phone. The aim's offset to the left goes to nothing there: the
   * subject is centred. Without one, STILL_PHONE's for its set.
   *
   * `target`: what an upright screen looks at, where that is not what a wide
   * one does. A wide frame can hold two things with its aim between them (two
   * tables along a wall); an upright one is a quarter of its width, and the
   * point between them is the wall. There the frame is one of the two.
   */
  phone?: { widen: number; at: number; target?: V3 };
  /**
   * WHAT THE LENS HOLDS, inside: a point, and the hall's long lens is on it
   * as it is on a table in the film (LensFocus.tsx, THE HALL'S LENS) — the
   * subject sharp, and what stands a little behind it soft. Without one a
   * still is sharp from front to back.
   *
   * (The forensic audit of 2026-10-09, #69: on a layout's own page "the model
   * and its name plaque are out of focus … the picture's subject is the one
   * thing not sharp". A still in the hall had been given the ESTATE'S lens,
   * focused on the face of a house that is not in the room.)
   */
  focus?: V3;
  /** Seconds to ease in. Places you travel to are slower than frames you simply
   *  settle into, because the movement is the content in the first case and an
   *  interruption in the second. */
  ease: number;
}

/** An upright screen's frame for a still that gives none of its own. (Set as
 *  rises of 0.14 and 0.16 of a 390x844 frame; as places in that frame's band,
 *  these.) */
export const STILL_PHONE: Readonly<Record<SceneSet, { widen: number; at: number }>> = {
  interior: { widen: 1.2, at: 0.62 },
  exterior: { widen: 1.3, at: 0.58 },
};

/** A point `metres` along the line from `from` to `to`. */
function along(from: V3, to: V3, metres: number): V3 {
  const d: V3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const len = Math.hypot(d[0], d[1], d[2]) || 1;
  return [from[0] + (d[0] / len) * metres, from[1] + (d[1] / len) * metres, from[2] + (d[2] / len) * metres];
}

/**
 * A layout's table, from where the film stands to read it: the same eye, the
 * same aim, the film's long lens. Its second frame is from over its near
 * corner, looking down: the model as a plan, where the opening has it as an
 * object on a table.
 */
function atStation(id: 'S1' | 'S2' | 'S3'): Pose {
  const a = STATION_ANCHORS.find((s) => s.id === id)!;
  const vp = stationViewpoint(a);
  const len = Math.hypot(a.inward[0], a.inward[1]) || 1;
  const nx = a.inward[0] / len;
  const nz = a.inward[1] / len;
  const [px, , pz] = a.position;
  return {
    set: 'interior',
    position: vp.position,
    target: vp.target,
    // A metre and a half out on the side the film reads it from, a third of a
    // metre along its edge, over head height. (With an offset of its own: the
    // opening's is sized for three and a half metres, and from two a whole
    // metre of it turned the model half out of the frame.)
    to: {
      position: [px + nx * 1.5 - nz * 0.34, 3.1, pz + nz * 1.5 + nx * 0.34],
      target: [px, 1.42, pz],
      frameOffset: 0.45,
    },
    fov: 30,
    // The model, where the film's lens holds it at this table.
    focus: [px, a.holoY, pz],
    // The model right of the frame's middle, the title's own width clear of
    // it (at 0.8 the last word of "Kartikeya Water Front." stood on the
    // table's rim).
    frameOffset: 1.0,
    // The long lens is fourteen degrees across on a phone: the film opens it
    // to twice its tangent there to hold a model whole, and so does this. The
    // model a little above the middle of its band, its table's foot going
    // down into the title's ground.
    phone: { widen: 2.0, at: 0.45 },
    ease: 0.9,
  };
}

// The tables the close pictures are of (interiorPath.ts has where each stands).
const S1 = STATION_ANCHORS.find((s) => s.id === 'S1')!;
const S2 = STATION_ANCHORS.find((s) => s.id === 'S2')!;
const S3 = STATION_ANCHORS.find((s) => s.id === 'S3')!;
const S4 = STATION_ANCHORS.find((s) => s.id === 'S4')!;

export const POSES: Readonly<Record<PlaceId, Pose>> = {
  // ── inside ────────────────────────────────────────────────────────────────

  // THE ROOM, WHOLE: from the floor by the first table, up the left flight of
  // the stair to the portrait over the landing, with the second table at the
  // flight's foot and the attic windows above. (/hall.)
  hall: {
    set: 'interior',
    position: [-5.6, 1.7, 3.6],
    target: [-1.2, 4.6, -5.5],
    to: { position: [-5.0, 1.75, 2.6], target: [-1.2, 4.6, -5.5] },
    fov: 46,
    ease: 1.1,
  },

  // The three layouts' own tables (places.ts stands each layout's page at its
  // own): S1 on the left wall's walnut, S2 at the back against the ivory, S3
  // on the right wall.
  table: atStation('S1'),
  window: atStation('S2'),
  study: atStation('S3'),

  // TWO TABLES IN THE ROOM, each with its layout raised on it: along the left
  // wall from inside the door, the first table near and the second at the
  // stair's foot. Its second frame is the second table by itself, against the
  // ivory of the back wall. (/projects.)
  tables: {
    set: 'interior',
    position: [-2.6, 1.7, 5.6],
    target: [-7.2, 1.35, -1.0],
    to: { position: [-5.3, 1.7, -0.3], target: [S2.position[0], 1.35, S2.position[2]] },
    fov: 42,
    frameOffset: 1.9,
    // An upright screen holds the first table, and not the wall between the two.
    phone: { widen: 1.25, at: 0.5, target: [S1.position[0], 1.3, S1.position[2]] },
    ease: 1.0,
  },

  // A LAYOUT'S PLOTS, CLOSE: the third table's model from over its near edge,
  // near enough to read the sizes printed on the plots, its name on the plate
  // below. Its second frame is from the height of the table, along its roads.
  // (/properties: "six plot sizes, measured off the plans".)
  plots: {
    set: 'interior',
    position: [6.72, 2.55, -0.9],
    target: [S3.position[0], 1.42, S3.position[2]],
    to: { position: [6.55, 1.78, -0.15], target: [S3.position[0], 1.45, S3.position[2]] },
    fov: 30,
    frameOffset: 0.55,
    focus: [S3.position[0], S3.holoY, S3.position[2]],
    phone: { widen: 1.5, at: 0.5 },
    ease: 0.9,
  },

  // A MODEL FROM OVER IT, where it is a plan: the first table's, with the
  // marble round it and its name on the plate at its foot. (/gallery: "the
  // plans, full size".)
  plan: {
    set: 'interior',
    position: [-6.75, 3.95, 2.76],
    // (Aimed at the floor before the table, not at the model: the model then
    // stands in the upper part of the frame, and its plate clear of the
    // frame's foot.)
    target: [-7.6, 0.9, 2.76],
    to: { position: [-6.6, 3.7, 2.76], target: [-7.6, 0.9, 2.76] },
    fov: 33,
    frameOffset: 0.5,
    focus: [S1.position[0], S1.holoY, S1.position[2]],
    phone: { widen: 1.6, at: 0.5 },
    ease: 0.9,
  },

  // A LAYOUT'S NAME, on the plate of its board: the third table's, from the
  // side it is read from and close, the plots above it. (/downloads: "one
  // sheet a layout".)
  plaque: {
    set: 'interior',
    position: [6.12, 1.58, -0.5],
    target: [7.5, 1.22, -1.18],
    to: { position: [6.36, 1.54, -0.62], target: [7.5, 1.22, -1.18] },
    fov: 26,
    frameOffset: 0.3,
    focus: [7.6, 1.35, -1.25],
    phone: { widen: 1.5, at: 0.5 },
    ease: 0.9,
  },

  // A PLAN, READ: the second table's model from beside it and above, down its
  // roads; then from over it. (The article on reading a layout plan.)
  reading: {
    set: 'interior',
    position: [-5.6, 2.2, -3.68],
    target: [S2.position[0], 1.35, S2.position[2]],
    to: { position: [-5.75, 2.75, -4.7], target: [S2.position[0], 1.4, S2.position[2]] },
    fov: 30,
    frameOffset: 0.5,
    focus: [S2.position[0], S2.holoY, S2.position[2]],
    phone: { widen: 1.6, at: 0.5 },
    ease: 0.9,
  },

  // UNDER THE PORTRAIT: the film's own beat, over the landing's rail, the
  // picture lamp on and the engraved plate under the frame. (/about, which the
  // storyboard reaches by a click on this portrait.) The height is set by the
  // balustrade (interiorPath.ts has the sight line), so the move is a push in
  // along it and not a rise.
  portrait: {
    set: 'interior',
    position: [0, 9.0, 0.4],
    target: [0, 6.85, -7.6],
    to: { position: [0, 8.78, -0.4], target: [0, 6.85, -7.6] },
    fov: 40,
    frameOffset: 1.5,
    phone: { widen: 1.35, at: 0.49 },
    ease: 1.1,
  },

  // THE MAP TABLE, from the mouth of the court and above it: the film's last
  // frame. Its second is from the table's own edge, across the relief: the
  // hills, the coast and a pin. (/locations.)
  map: {
    set: 'interior',
    position: [0.45, 3.7, 0.6],
    target: [0.15, 0.95, -3.05],
    to: { position: [0.95, 1.55, -2.1], target: [-0.25, 0.9, -3.2] },
    fov: 42,
    frameOffset: 0.5,
    focus: [0, 0.89, -3.05],
    phone: { widen: 1.6, at: 0.45 },
    ease: 1.0,
  },

  // UNDER THE DOME: up from the floor inside the door — the coffers, the
  // dome, the chandelier and the attic's arched windows. The one frame in the
  // house with nothing in it to sell. Its second is from directly under the
  // chandelier, where the dome is a wheel. (/investment-guide.)
  dome: {
    set: 'interior',
    position: [0, 1.6, 5.6],
    target: [0, 12.5, -0.6],
    to: { position: [0.5, 1.6, 0.8], target: [-0.5, 18, 0.1] },
    fov: 52,
    // The dome right of the frame's middle: on the axis, its chandelier hung
    // in the title's own shade.
    frameOffset: 2.6,
    ease: 1.2,
  },

  // THE CHANDELIER AGAINST THE ATTIC'S WINDOWS, from the height it hangs at:
  // where the room's light comes in. (/knowledge.)
  attic: {
    set: 'interior',
    position: [4.5, 9.6, 3.5],
    target: [-9.9, 10.4, -3.2],
    to: { position: [3.7, 9.6, 3.1], target: [-9.9, 10.4, -3.2] },
    fov: 38,
    frameOffset: 0,
    phone: { widen: 1.3, at: 0.5 },
    ease: 1.1,
  },

  // THE STAIR FROM ITS FOOT: the right flight's newel and first steps, its
  // runner going up and round, and the left flight beyond it. The portrait is
  // over the top of this frame and not in it. (/faqs: "the things people ask
  // first".)
  stair: {
    set: 'interior',
    position: [4.9, 1.2, 3.0],
    target: [1.5, 1.55, -2.4],
    to: { position: [4.5, 1.22, 2.4], target: [1.5, 1.55, -2.4] },
    fov: 38,
    frameOffset: 0.5,
    phone: { widen: 1.3, at: 0.5 },
    ease: 1.0,
  },

  // THE BENCH BY THE DOOR, with nobody on it: a table and its layout beyond
  // it, and the foot of the stair. (/careers: the roles open now.)
  bench: {
    set: 'interior',
    position: [1.1, 1.35, 5.7],
    target: [4.03, 0.6, 3.92],
    to: { position: [1.45, 1.32, 5.48], target: [4.03, 0.6, 3.92] },
    fov: 32,
    frameOffset: 0.55,
    phone: { widen: 1.4, at: 0.55 },
    ease: 1.0,
  },

  // THREE LAMPS LIT ALONG THE WALL, each a pair of candles on a brass arm,
  // between the pilasters of the left wall's upper storey, seen across the
  // hall from the right: the wall's corner, its panels and capitals, and the
  // stair's rail coming round at the foot. Its second frame comes lower and
  // nearer, the lamps still ten metres off. (/branches: three offices; "send
  // one enquiry".)
  //
  // NOT CLOSE (the second forensic audit, 2026-10-24, #15). It opened on two
  // of the lamps from five metres on a blank wall, and its band was one of
  // them filling half the screen: brass that is a flat ochre and flames that
  // are cones, at a distance they were never made for. From twelve and more
  // they are what the film shows them as, three lamps lit along a wall.
  sconces: {
    set: 'interior',
    position: [4.0, 3.2, 5.5],
    target: [-8.84, 4.6, -3.6],
    to: { position: [1.2, 2.6, 3.2], target: [-8.84, 4.5, -4.4] },
    fov: 30,
    frameOffset: 2.0,
    phone: { widen: 1.3, at: 0.5 },
    ease: 1.0,
  },

  // THE URN BY THE DOOR, on its plinth: a thing for keeping things in. From
  // over it, so that it stands against the marble: at its own height it was a
  // dark thing against the walnut behind it. (/cookie-policy: "what this
  // site stores on your device".)
  urn: {
    set: 'interior',
    position: [-1.4, 3.0, 4.3],
    target: [-3.3, 1.25, 6.4],
    to: { position: [-1.7, 2.9, 4.65], target: [-3.3, 1.25, 6.4] },
    fov: 30,
    frameOffset: 0.8,
    phone: { widen: 1.4, at: 0.5 },
    ease: 1.0,
  },

  // THE DOOR, FROM INSIDE: shut, an urn either side of it, the carpet leading
  // to it. (/privacy.)
  shut: {
    set: 'interior',
    position: [0, 1.7, -1.0],
    target: [0, 2.2, 7.7],
    to: { position: [0, 1.7, 0.2], target: [0, 2.2, 7.7] },
    fov: 50,
    frameOffset: 1.3,
    ease: 1.0,
  },

  // THE FOURTH TABLE, WITH NOTHING ON IT: its inlaid top bare, where the other
  // three carry a layout. (A page that is not there, and any address that is
  // not a page.)
  empty: {
    set: 'interior',
    position: [4.7, 1.75, 7.0],
    target: [S4.position[0], 0.95, S4.position[2]],
    to: { position: [5.0, 1.72, 6.75], target: [S4.position[0], 0.95, S4.position[2]] },
    fov: 30,
    frameOffset: 0.55,
    phone: { widen: 1.4, at: 0.55 },
    ease: 1.0,
  },

  // Turned toward the room rather than a table: where you speak to someone.
  // (/contact.)
  desk: {
    set: 'interior',
    position: [2.1, 1.6, 1.75],
    target: [-1.3, 1.5, -2.0],
    to: { position: [1.76, 1.59, 1.38], target: [-1.3, 1.5, -2.0] },
    // (This pose was framed with the rig's exterior offset on it, like every
    // still, and unlike the tables' it was a good frame that way: the carpet,
    // an urn, a table against the far wall and the right flight. Its aim is
    // written out as it was seen.)
    frameOffset: 7.4,
    ease: 0.9,
  },

  // ── outside ───────────────────────────────────────────────────────────────

  // OUTSIDE, on the film's own path — the frame the HOME PAGE opens on, via
  // '/' in places.ts, and therefore the single most-seen frame in the build.
  // Beat 0 of the spline — see cameraPath.ts. The whole path is rendered and
  // scored by tools/blender/audit_camera_path.py, which samples BETWEEN the
  // beats too: Catmull-Rom overshoots on unevenly spaced control points, so a
  // path can pass through the fountain between two good keyframes.
  //
  // (`position`, `target` and `to` only seed the camera before its first
  // frame: on a path place the rig reads the film's curves. /start-here shares
  // this place and holds the film's first frame, by day.)
  arrival: {
    set: 'exterior',
    path: true,
    position: [0.0, 1.65, 30.0],
    target: [-7.0, 4.2, 0.0],
    to: { position: [0.0, 1.65, 18.0], target: [-3.2, 3.4, 0.0] },
    // /start-here on an upright screen (the film itself never reads this):
    // the house is in the lower half of the film's first frame, so its axis
    // stands high in the band and the house under it, over the words. (The
    // lens there is the film's own — cameraPath, UPRIGHT_LENS — and `widen`
    // is not read.)
    phone: { widen: 1, at: 0.2 },
    ease: 1.4,
  },

  // THE ESTATE FROM ABOVE: the film's frame for its count of plots — the house
  // from behind and over the pool, the gardens, the palms down the drive and
  // the evening behind them. Its second frame is from the other side and low:
  // the parterre, the forecourt and the front of the house. (/construction-
  // updates: "on the ground".)
  estate: {
    set: 'exterior',
    position: [-38.4, 28.8, -67.2],
    target: [0, 12, 0],
    to: { position: [-40, 7, 44], target: [-14, 2.5, 14] },
    fov: 37,
    frameOffset: 5.76,
    phone: { widen: 1.5, at: 0.54 },
    ease: 1.3,
  },

  // THE FRONT DOOR, square on from the drive: the film's last frame outside,
  // before it goes in. Its second is from the far end of the avenue, the
  // house at the end of its palms: the walk up to it. (/book-a-site-visit.)
  door: {
    set: 'exterior',
    position: [0.0, 9.3, 36.7],
    target: [0.0, 2.9, 8.2],
    to: { position: [0.8, 2.4, 112], target: [0, 6.0, 0] },
    fov: 32,
    frameOffset: 1.6,
    phone: { widen: 1.6, at: 0.49 },
    ease: 1.2,
  },

  // UNDER THE PORTICO, looking up: its columns, what they carry and the sky
  // past its corner. Its second frame is the door between them, under its
  // lantern. No car in either: the saloon at the foot of the steps holds at
  // the film's distance and not at this one (the audit's #70). (/why-us:
  // "proof, not persuasion".)
  portico: {
    set: 'exterior',
    position: [3.2, 1.5, 16.0],
    target: [-1.5, 5.6, 9.0],
    to: { position: [-0.9, 2.0, 14.6], target: [0.25, 3.2, 9.4] },
    fov: 48,
    frameOffset: 0,
    phone: { widen: 1.2, at: 0.5 },
    ease: 1.2,
  },

  // THE TERRACE BY THE POOL: its chairs in a row under their shades, the
  // water, and the long windows of the house's side. (/testimonials.)
  terrace: {
    set: 'exterior',
    position: [-25.5, 1.6, 10.5],
    target: [-19.5, 1.2, -3],
    to: { position: [-25.0, 1.6, 8.6], target: [-19.5, 1.2, -3] },
    fov: 40,
    frameOffset: 0,
    phone: { widen: 1.3, at: 0.5 },
    ease: 1.2,
  },

  // THE GATE: its two piers and the avenue of palms beyond them, rising into
  // the evening toward the house. From eighty-five metres out and twelve up.
  // (/terms: the terms on which you come in.)
  //
  // NOT UNDER THE PALMS (the second forensic audit, 2026-10-24, #15). From
  // seventeen metres outside the gate the nearest crowns were twenty-four
  // metres off and filled the top of the frame, faceted fronds and a hard band
  // of colour at the crown, over piers that were blank slabs. The palms are
  // the film's, made to be seen from far off; from here the nearest are ninety
  // metres away and the piers are small at the frame's foot.
  gate: {
    set: 'exterior',
    position: [6, 12, 300],
    target: [0, 4, 150],
    to: { position: [5.6, 11.6, 294], target: [0, 4, 150] },
    fov: 26,
    frameOffset: 14,
    phone: { widen: 1.3, at: 0.5 },
    ease: 1.2,
  },

  // THE HOUSE FROM BEHIND, down its canal: the garden front between its
  // hedges, under the evening. (/refund-policy.)
  canal: {
    set: 'exterior',
    position: [1.2, 2.6, -74],
    target: [0, 5.5, 0],
    to: { position: [1.1, 2.6, -68], target: [0, 5.5, 0] },
    fov: 30,
    frameOffset: 9,
    phone: { widen: 1.4, at: 0.5 },
    ease: 1.2,
  },

  // THE ESTATE FROM OVER IT, as a plan of the site: the roof, the canal, the
  // parterre, the forecourt's circle and the pool. (/sitemap: "every page, on
  // one sheet".)
  above: {
    set: 'exterior',
    position: [-26, 80, 12],
    target: [-8, 0, 12],
    to: { position: [-25, 74, 12], target: [-8, 0, 12] },
    fov: 46,
    frameOffset: 10,
    // An upright screen is over the house itself, and opens to hold its
    // forecourt and its canal's head.
    phone: { widen: 1.7, at: 0.5, target: [0, 0, 10] },
    ease: 1.3,
  },
};

/** Which model this route needs loaded. Drives both the GLB and the lighting
 *  rig, which differ completely between the two sets. */
export function setFor(place: PlaceId): SceneSet {
  return poseFor(place).set;
}

export function poseFor(place: PlaceId): Pose {
  return POSES[place] ?? POSES.hall;
}
