// apps/public/src/components/experience/interiorPath.ts
//
// The camera's journey INSIDE the hall — the half of the home page that did not
// exist.
//
// Until now the interior was reachable only by routing to /hall, where it got a
// single two-point dolly. The brief asks for a choreographed sequence: arrive,
// establish the room, visit each project station in turn, then climb the
// staircase to the portrait. That is a path, not a pose, so it is authored here
// the same way the exterior path is authored in cameraPath.ts — as beats on a
// centripetal Catmull-Rom, with the lens carried per beat.
//
// EVERY COORDINATE BELOW IS MEASURED FROM interior_hall.glb, not converted by
// hand from Blender. The numbers that matter are restated here so a future edit
// can be checked without re-parsing the file:
//
// THE HALL WAS EXTENDED BY BAYS for the client review — "bigger, taller,
// wider, and importantly longer" — by tools/blender/extend_hall_v7.py, so every
// number
// here changed with it. Re-measured from the re-exported GLB:
//
//   room shell        x -9.90..9.90   y 0..8.00      z -7.70..7.70
//   entry doors       x -1.50..1.50   y 0..4.26      z  7.57..7.69
//   staircase         x -3.25..3.25   z -1.86..-6.96, rising y 0 -> 3.30
//   stair runner      x -2.38..2.38   (carpet inside the stone treads)
//   landing           x -3.25..3.25   y 3.30..3.47   z -6.93..-8.55
//   balustrade        x  2.94..3.19 (mirrored)  y 0.13..4.72  z -7.70..-1.64
//   newel posts       x  2.94..3.18 (mirrored)  y 0..1.76     z -1.70..-1.46
//   portrait          x -1.21..1.21  y 3.95..7.21   z -7.70..-7.57
//   chandelier        x -1.01..1.01  y 5.85..7.85   z -0.14..1.88
//   urns (above eye)  x  4.21..5.19 (mirrored)  y 0.68..1.87  z -2.05..-1.05
//   tables S1..S4     centres below; table top at y 0.80
//
// THE TWO OBSTACLES THAT SHAPE THIS PATH
//
// 1. The BALUSTRADE is solid from y 0.10 to y 2.79 either side of the stairs. A
//    camera at eye height cannot cross the hall behind the newels — it would
//    pass straight through it. So the left-to-right traverse happens in FRONT
//    of the staircase, at z +0.30, where the only thing at that height is air.
//    That is also the better shot: the stair sweeps across frame as the camera
//    passes its foot.
//
// 2. The two dressing URNS moved out to the foot of the wider stair and grew a
//    fifth with it: x +/-4.21..5.19, z -2.05..-1.05, tops at y 1.87 — now ABOVE
//    the eye line rather than just under it. Every beat keeps clear of that z
//    band on both sides rather than relying on a margin.

import * as THREE from 'three';

/**
 * The four pedestals, read from the GLB.
 *
 * S1 and S2 stand on the LEFT (-x), S3 and S4 on the RIGHT (+x), which is the
 * A1 -> A2 -> A3 -> A4 order the brief's floor plan asks for: left-front,
 * left-back, right-back, right-front.
 *
 * `inward` is the direction from the pedestal toward the middle of the room.
 * The camera stands along it, so a station's viewpoint is DERIVED from its
 * position rather than written out twice and allowed to disagree.
 */
export interface StationAnchor {
  /** The suffix in the GLB node names: pedestal_base_S1, projector_S1, ... */
  id: 'S1' | 'S2' | 'S3' | 'S4';
  /** Pedestal centre, three-space metres. Cap top is at y 0.96. */
  position: [number, number, number];
  /** Direction from the pedestal toward the room. Normalised on use. */
  inward: [number, number];
  /** Metres the camera stands back along `inward`. */
  standoff: number;
  /** Extra z offset on the camera only, to dodge geometry. */
  dz: number;
  /**
   * The x at which the camera leaves the promenade to turn in on this station.
   *
   * Explicit per station rather than derived, because what it has to miss
   * differs per station: reaching S3 means descending past urn_1 (x 3.01..3.83)
   * without crossing it, and reaching S2 means descending past urn_0's mirror.
   * A formula that happened to work for three of them would silently fail the
   * fourth, which is precisely what the collision test caught the first time.
   */
  laneX: number;
  /**
   * The height of this station's HOLO_Sn empty, read from the delivered GLB.
   *
   * NOT a shared constant. The four holograms sit at 1.505, 1.401, 1.441 and
   * 1.441 — the artist raked and yawed each plan to face the room, and the
   * plate heights followed. A single averaged value would leave three of the
   * four click targets and three of the four aim points misaligned with the
   * thing they are supposed to be pointing at.
   */
  holoY: number;
}

export const STATION_ANCHORS: readonly StationAnchor[] = [
  // LEFT FRONT. Clear floor: the nearest obstruction is urn_0 at z -1.05, more
  // than three metres behind the camera.
  { id: 'S1', position: [-7.85, 0, 2.76], inward: [1, 0], standoff: 2.4, dz: 0.4, laneX: -4.6, holoY: 1.505 },
  // LEFT BACK. Approached axially down the left lane rather than from the
  // middle of the room: the balustrade begins at x -2.94 and this keeps the
  // whole move outside it. laneX matches the table's own x, so the descent is a
  // straight run at x -6.07 — outside urn_0 (which ends at x -5.19) for its
  // whole length.
  { id: 'S2', position: [-6.07, 0, -5.52], inward: [0, 1], standoff: 2.3, dz: 0, laneX: -6.07, holoY: 1.401 },
  // RIGHT BACK. The hard one.
  //
  // inward was [-1, -0.35], which stands the camera at z -1.74 and puts the
  // descent from the promenade straight through urn_1. Pitched to [-0.8, -0.6]
  // it stands off the urn's corner instead, and the run down from laneX 6.90
  // clears the urn's x by 0.98m at the moment it crosses the urn's z band. Same
  // subject distance (2.55m), same framing, clearance instead of none.
  { id: 'S3', position: [7.85, 0, -1.31], inward: [-0.8, -0.6], standoff: 2.55, dz: 0, laneX: 6.9, holoY: 1.441 },
  // RIGHT FRONT. No project is published for this pedestal today, so it stays
  // dark furniture until one is. Described here so a fourth project lights it
  // up with no code change.
  { id: 'S4', position: [7.85, 0, 4.94], inward: [-1, 0], standoff: 2.4, dz: -0.35, laneX: 5.6, holoY: 1.441 },
] as const;

/**
 * Nominal hologram height, kept only for code that needs one number for all
 * four (the DOM has none today). Per-station truth is `StationAnchor.holoY`.
 */
export const HOLOGRAM_HEIGHT = 1.45;

/**
 * Where a station beat AIMS, which is not where the hologram is.
 *
 * Aiming at the hologram's own centre frames the plan beautifully and pushes
 * the table out of the bottom of the picture. MEASURED at the S1 dwell: with a
 * 31-degree lens at 2.75m the frame is 1.53m tall centred on 1.52, so it holds
 * y 0.76..2.28 — and the pedestal cap is at 0.96 with its base at 0. The plan
 * floated in the middle of a wall with nothing under it.
 *
 * That is a composition problem and an INTERACTION problem. The table is the
 * drag surface; a drag surface below the bottom edge of the frame cannot be
 * grabbed, so the rotation the brief asks for would have been unreachable at
 * exactly the beat that offers it.
 *
 * Aiming 18cm lower puts the frame at roughly 0.66..2.03: the table top, the
 * projector, the plan and its leader cards are all inside it, and the plan sits
 * in the upper third where a model on a table belongs.
 *
 * RE-CHECKED against the final delivery. The table top dropped from 0.96 to
 * 0.80 (Ø0.58 pedestal replaced by a Ø1.15 turned table) while the holograms
 * stayed at 1.40–1.51. The span the shot has to hold is therefore 0.80 up to
 * about 1.90, whose centre is 1.35 — so this value survives the asset change
 * unchanged, which is worth recording so the next person does not assume it
 * drifted.
 */
export const STATION_AIM_HEIGHT = 1.34;

/**
 * Eye height for every standing beat. A shade under a real 1.7m eye line
 * because the holograms sit at 1.52 and the shot should look very slightly DOWN
 * onto them, the way one looks at a model on a table.
 */
const EYE = 1.7;

/**
 * The PROMENADE: the one z at which a camera can cross this room at eye height.
 *
 * Established by the collision test in cameraPath.test.ts, which failed the
 * first version of this path in three separate places — all of them the same
 * mistake. Travelling directly between two station viewpoints looks correct
 * beat-to-beat and is not, because:
 *
 *   the URNS occupy z -2.05..-1.05 either side at x +/-4.21..5.19 and stand to
 *   y 1.87, which is ABOVE the eye line, and
 *   the BALUSTRADE occupies z -7.70..-1.64 at x +/-2.94..3.19 and stands to
 *   y 4.72, which is above it entirely.
 *
 * Between them those two leave no lane across the middle of the room. z +2.60
 * — the old z +1.75 carried out with the extended room — is clear of both by
 * more than 3.6m, clear of the newels (which end at z -1.46), and above the
 * bench (y 0.53) and the rug. Every move between stations goes out to this
 * lane, along it, and back in — which is also simply how a camera operator
 * crosses a room they are not allowed to walk through.
 */
const PROMENADE_Z = 2.6;

/** Height on the promenade. Slightly above the station eye line so the travel
 *  beats look down the room a little and the turn-in reads as a settle. */
const PROMENADE_Y = 1.86;

export interface InteriorBeat {
  /** Identifies the beat, so DOM chapters can be authored against it. */
  id: string;
  /** Position on the interior leg, 0..1. Renormalised when stations are
   *  dropped, so these are proportions rather than absolutes. */
  at: number;
  position: [number, number, number];
  target: [number, number, number];
  /** Vertical FOV, degrees. See LENS. */
  fov: number;
  /** Bank about the view axis, radians. Interior banks are tiny: a room with
   *  visible verticals punishes roll far harder than open landscape does. */
  roll: number;
  /** Which station this beat frames, if any. Drives the DOM chapter and the
   *  station's own emphasis. */
  station?: StationAnchor['id'];
}

/**
 * LENS LANGUAGE.
 *
 * The brief asks for "135mm f/2.8" at the stations. Taken literally on a
 * full-frame back that is a 15-degree vertical field, and at the 2.4m working
 * distance this room allows it would frame 63cm — less than the table. So it is
 * read as the brief says to read it: a VISUAL TARGET. What 135mm actually buys
 * is compressed perspective and an isolated subject, and against these
 * distances that lands at 30 degrees — roughly a 68mm equivalent. Stated
 * plainly rather than labelled 135mm and quietly made wide.
 *
 *   establish  56  the room must read whole, including both side walls
 *   traverse   44  moving shots stay wider so architecture keeps its parallax
 *   station    30  compressed, subject isolated — the brief's telephoto
 *   portrait   32  wide enough to hold 3.26m of canvas from 8m back
 */
const LENS = { establish: 56, traverse: 44, station: 30, portrait: 32 } as const;

/**
 * How much of the interior leg each chapter gets.
 *
 * EXPORTED, because journey.ts needs the identical numbers to size the DOM
 * sections and the two were duplicated. That duplication is not hypothetical
 * risk: the first build had the station chapters at 0.15 in both files, which
 * gave each project card 106vh of page against roughly 90vh of card, so two
 * cards were on screen at the boundary and the copy read as a broken stack.
 * Fixing it meant editing the same constant in two files, which is exactly the
 * kind of edit that gets made in one of them.
 *
 * The weights are relative; buildInteriorBeats renormalises. A station now
 * carries more page than the establishing shot's per-beat share because a
 * station is a READING beat — the visitor has stopped to look at a plan — and
 * the camera should still be holding that composition when they look up.
 */
export const CHAPTER_WEIGHTS = {
  /** Threshold, establishing shot and the turn onto the first station. */
  establish: 0.26,
  /** Each published station. */
  station: 0.19,
  /** Withdrawal, the foot of the stairs, and the portrait. */
  portrait: 0.18,
  /**
   * THE THRESHOLD AND THE DISTRICT FIELD.
   *
   * The film's last chapter, and the one the Phase 6 report records as missing
   * outright: no city plane, no beacons, no dive. It is placed here, after the
   * portrait, because the hall has NO WINDOW — parsed from the delivered GLB,
   * the only opening in 545 nodes is `int_door_arch` with `int_doors` in it, on
   * the entry axis at z 7.63. So the region is revealed through the door the
   * visitor came in by, which is both the model's only aperture and the right
   * sentence: the film ends by turning round and looking out at the land the
   * house is here to sell.
   */
  city: 0.2,
} as const;

/** Camera pose for a station, derived from its anchor so the two cannot drift. */
export function stationViewpoint(a: StationAnchor): {
  position: [number, number, number];
  target: [number, number, number];
} {
  const [px, , pz] = a.position;
  const len = Math.hypot(a.inward[0], a.inward[1]) || 1;
  const nx = a.inward[0] / len;
  const nz = a.inward[1] / len;
  return {
    position: [px + nx * a.standoff, EYE, pz + nz * a.standoff + a.dz],
    target: [px, STATION_AIM_HEIGHT, pz],
  };
}

/**
 * The interior beats for `count` published stations.
 *
 * Built rather than declared, because the number of stations is DATA — there
 * are three published projects today and four pedestals in the model.
 * Hardcoding four beats would either invent a project or leave the camera
 * pausing at an empty plinth; hardcoding three would break the day a fourth is
 * published.
 *
 * The fixed beats (threshold, establish, stair-foot, portrait) are always
 * present. Station beats are spliced between them in order, and every `at` is
 * renormalised at the end so the leg spans 0..1 regardless of count.
 */
export function buildInteriorBeats(count: number): InteriorBeat[] {
  const n = Math.max(0, Math.min(STATION_ANCHORS.length, count));
  const beats: InteriorBeat[] = [];

  // THRESHOLD. Just inside the doors, low and wide, before the eye has
  // adjusted. This is the frame the entry transition resolves onto, so it is
  // deliberately the least composed shot in the sequence: you have walked in,
  // you have not yet looked around.
  beats.push({
    id: 'threshold',
    at: 0,
    position: [0, 1.58, 6.7],
    target: [0, 3.1, -5.0],
    fov: LENS.establish,
    roll: 0,
  });

  // ESTABLISH. A three-quarter across the room, holding the staircase as the
  // architectural axis with the right wall raking away and the back half of the
  // left wall behind it. The portrait is visible but small at the end of that
  // axis, which is the point: it is the destination, announced early and
  // arrived at last.
  //
  // OFF THE AXIS OF SYMMETRY IN PHASE 6B, and the reason is in the frame that
  // was there before. [0, 2.15, 3.15] -> [0, 2.35, -4.6] stands on the room's
  // own mirror line, so both side walls meet the lens at the same angle and
  // render at the same value, the stair fills the centre, and there is no
  // foreground, no diagonal and no convergence anywhere — an elevation drawing
  // rather than a photograph. Measured on the shipped build at 1440x900, the
  // frame carried no clipping and a usable range (mean 57.6, p05 13.8,
  // p95 120.6) and still read as inert, because RANGE is not the same as
  // STRUCTURE.
  //
  // 2.35m right and 1.05m back, aimed 0.85m left of the axis, puts the right
  // wall at a 20-degree rake and brings the left wall in from z -1.38 back.
  // Both walls now converge, which is the depth cue a symmetric frame cannot
  // have at any exposure.
  //
  // AND WHAT IT DELIBERATELY DOES NOT DO: get a project station into this
  // frame. The room is 19.8m wide and 15.4m deep and the camera stands near its
  // front wall, so from any vantage that holds the stair, S1 sits 54 degrees
  // off axis against a 40-degree half-angle. Fitting both would need an
  // 80-degree lens — a fisheye in a classical hall. The establishing CHAPTER
  // still delivers the station: `turn-left` is the very next beat.
  beats.push({
    id: 'establish',
    at: CHAPTER_WEIGHTS.establish * 0.33,
    position: [3.1, 3.1, 6.1],
    target: [-1.1, 3.2, -6.7],
    fov: LENS.establish,
    roll: 0,
  });

  // TURN TO THE FIRST STATION. The brief: "faces to the left side". A beat of
  // its own, so the camera has committed to the turn before the station beat
  // starts settling. Arriving at a composition slightly before the subject
  // becomes active is what makes a move read as anticipation rather than as a
  // cut.
  const W = CHAPTER_WEIGHTS;
  if (n > 0) {
    beats.push({
      id: 'turn-left',
      at: W.establish * 0.66,
      position: [-2.8, 1.8, 5.1],
      target: [-7.4, 1.7, 3.5],
      fov: LENS.traverse,
      roll: -0.015,
    });
  }

  for (let i = 0; i < n; i += 1) {
    const a = STATION_ANCHORS[i];
    const vp = stationViewpoint(a);

    // THE CONNECTOR. Out to the promenade, along it, back in — see PROMENADE_Z.
    //
    // One before every station after the first, not only before the crossing.
    // Making it unconditional is what makes the choreography a RHYTHM rather
    // than a set of shots with an exception in the middle, and it is also the
    // only version the collision test passes at every station count: a
    // Catmull-Rom bulges toward whatever is on the outside of a turn, so a path
    // that clears the urns with three stations can bury itself in them with
    // four.
    if (i > 0) {
      const prev = STATION_ANCHORS[i - 1];
      const crossing = Math.sign(prev.position[0]) !== Math.sign(a.position[0]);

      // A CROSSING gets two beats, not one. The first passes the foot of the
      // staircase and looks at it; the second arrives at the far lane and turns
      // in. Collapsing them into a single mid-room waypoint is what put the
      // camera through the balustrade: from the middle of the room the only
      // straight line to a right-hand station crosses x 2.45 at negative z,
      // which is exactly where the balustrade stands. The stair sweep and the
      // turn-in have to be separate moves because the geometry says so.
      // THE DWELL. The camera does not leave a plan the moment its chapter
      // starts; it eases 35cm straight back along the axis it arrived on,
      // across more than half the chapter, and only then begins the move to the
      // next station.
      //
      // This exists because the first version did not have it, and it showed:
      // the station beat sat at the very start of its DOM chapter, so by the
      // time a visitor had read the project card the camera had already
      // travelled to the next connector. VERIFIED in a browser — at the middle
      // of the Kartikeya chapter the camera was standing at the approach to
      // Lucky Garden.
      //
      // A slow pull-back rather than a frozen frame, because a camera that
      // stops dead reads as a paused video. This is the same move a
      // cinematographer uses to hold a subject without the shot dying.
      const prevVp = stationViewpoint(prev);
      const plen = Math.hypot(prev.inward[0], prev.inward[1]) || 1;
      beats.push({
        id: `dwell-${prev.id}`,
        at: W.establish + (i - 1) * W.station + W.station * 0.55,
        position: [
          prevVp.position[0] + (prev.inward[0] / plen) * 0.35,
          prevVp.position[1] + 0.04,
          prevVp.position[2] + (prev.inward[1] / plen) * 0.35,
        ],
        target: prevVp.target,
        fov: LENS.station + 2,
        roll: (i - 1) % 2 === 0 ? 0.012 : -0.012,
      });

      if (crossing) {
        // Out first, along the station's OWN lane, before any lateral move.
        // Without this the curve leaves the departing station diagonally and
        // grazes the near end of the balustrade — 9cm of clearance against a
        // 10cm near plane, which is a clipped baluster across the bottom of
        // frame. Symmetric with the approach below, so every station is
        // entered and left the same way.
        beats.push({
          id: `exit-${prev.id}`,
          at: W.establish + (i - 1) * W.station + W.station * 0.72,
          position: [prev.laneX, PROMENADE_Y, PROMENADE_Z],
          target: [prev.position[0] * 0.3, 2.6, -4.6],
          fov: LENS.traverse,
          roll: 0.008,
        });
        beats.push({
          id: 'cross-hall',
          at: W.establish + (i - 1) * W.station + W.station * 0.82,
          position: [((prev.position[0] + a.position[0]) / 2) * 0.35, PROMENADE_Y, PROMENADE_Z],
          target: [1.2, 2.2, -3.8],
          fov: LENS.traverse,
          roll: 0.022,
        });
      }

      beats.push({
        id: `approach-${a.id}`,
        at: W.establish + (i - 1) * W.station + W.station * (crossing ? 0.91 : 0.78),
        position: [a.laneX, PROMENADE_Y, PROMENADE_Z],
        target: [a.position[0], a.holoY + 0.25, a.position[2] + 0.6],
        fov: LENS.traverse,
        roll: -0.01,
      });
    }

    beats.push({
      id: `station-${a.id}`,
      at: W.establish + i * W.station,
      position: vp.position,
      target: vp.target,
      fov: LENS.station,
      // A hair of bank, opposite on each side of the room, so consecutive
      // stations do not read as the same shot twice.
      roll: i % 2 === 0 ? 0.012 : -0.012,
      station: a.id,
    });
  }

  // BACK TO THE PROMENADE. The last station is left the same way every other
  // one is, so the exit from the commercial sequence matches its entries: out
  // along the station's OWN lane, drifting a metre toward the middle of the
  // room as it goes.
  //
  // IT USED TO CUT THE CORNER — `last.position[0] * 0.4`, straight from the
  // station toward the centre line — and in the extended hall the collision
  // test failed on it at both ends of the room: the urns moved out to the foot
  // of the wider stair and grew a fifth with it, so their tops now stand at
  // y 1.87, ABOVE the travelling eye line instead of 14cm under it. A diagonal
  // that used to pass over an urn now passes through it (measured: 13cm inside
  // urn_l leaving S2, 13cm inside urn_r leaving S3). Leaving along the lane
  // keeps the whole move outside the urns' x, which is what the lane is for.
  if (n > 0) {
    const last = STATION_ANCHORS[n - 1];
    beats.push({
      id: 'withdraw',
      at: W.establish + n * W.station - W.station * 0.18,
      position: [last.laneX - Math.sign(last.laneX) * 0.9, PROMENADE_Y, PROMENADE_Z],
      target: [0, 3.2, -5.8],
      fov: LENS.traverse,
      roll: 0.014,
    });
  }

  // FOOT OF THE STAIRS. The brief's diagonal, resolved: onto the central axis
  // looking up the flight. The runner leads the eye and the portrait is already
  // at the top of frame.
  beats.push({
    id: 'stair-foot',
    at: W.establish + n * W.station,
    position: [1.2, 1.9, 3.9],
    target: [0, 3.9, -6.1],
    fov: LENS.traverse,
    roll: 0.02,
  });

  // PORTRAIT. On the axis, lifted, 7m out.
  //
  // The CHANDELIER now hangs x +/-1.01, y 5.85..7.85, z -0.14..1.88 — a metre
  // above the raised camera rather than in front of it, so what decides this
  // beat is the frame: at FOV 32 and 8.02m it is 4.69m tall against a 3.26m
  // canvas, so the portrait holds 70% of frame with the landing and the newels
  // beneath it, exactly the proportion it held in the smaller room.
  beats.push({
    id: 'portrait',
    at: W.establish + n * W.station + W.portrait,
    position: [0, 4.1, 0.45],
    target: [0, 5.55, -7.6],
    fov: LENS.portrait,
    roll: 0,
  });

  // TURN OUT. The camera comes off the portrait, down the axis, and starts to
  // face the way it came in. A beat of its own so the reversal is a MOVE — the
  // longest one in the room, from the back wall to the middle of the floor —
  // rather than a cut from a portrait to a doorway.
  beats.push({
    id: 'turn-out',
    at: W.establish + n * W.station + W.portrait + W.city * 0.45,
    position: [0, 2.9, -1.4],
    target: [0, 2.8, 7.7],
    fov: LENS.traverse,
    roll: 0,
  });

  // THE THRESHOLD. Square onto the entry doors, framing the opening.
  //
  // z 5.70 is derived, and the first attempt — standing far enough back to hold
  // the whole opening — is why it is stated: that frame was a keyhole, a doorway
  // seen from across the room with the region a slot in the middle of a wall.
  // The chapter is supposed to be a revelation, not a peephole.
  //
  // So the standoff comes from the opening instead. 1.95m back from a doorway
  // that is now 2.99m wide (it grew with the room), the jambs subtend 75
  // degrees against the frame's own 80 — they sit at the extreme edges and
  // everything between them is region. The visitor is standing IN the doorway
  // rather than looking at it, and the head and sill leave frame, which is what
  // they do when you step into a door.
  //
  // Eye height 2.30, and the aim at 1.60, so the horizon sits a little above
  // centre: the sight line to the field's ground at y -2.4 first meets it about
  // 7.6m beyond the camera, which is why FIELD.near is 26 and not less.
  beats.push({
    id: 'city',
    at: W.establish + n * W.station + W.portrait + W.city,
    position: [0, 2.3, 5.7],
    target: [0, 1.6, 16.5],
    fov: LENS.establish,
    roll: 0,
  });

  // Renormalise so the leg always spans exactly 0..1.
  const span = beats[beats.length - 1].at || 1;
  for (const b of beats) b.at = b.at / span;
  return beats;
}

/**
 * Catmull-Rom, centripetal — same reasoning as the exterior path: the beats are
 * unevenly spaced, and uniform parameterisation overshoots on the long legs. In
 * a room, an overshoot is a camera inside a wall.
 */
export function interiorCurves(beats: readonly InteriorBeat[]) {
  const mk = (pts: readonly [number, number, number][]) =>
    new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(...p)),
      false,
      'centripetal',
    );
  return {
    position: mk(beats.map((b) => b.position)),
    target: mk(beats.map((b) => b.target)),
  };
}

/**
 * Map interior-leg progress to curve parameter, so scrolling to a beat's `at`
 * lands ON that beat rather than near it. Same remap as curveT in cameraPath.ts,
 * over a list whose length is not known at module load.
 */
export function interiorCurveT(beats: readonly InteriorBeat[], s: number): number {
  const t = Math.min(1, Math.max(0, s));
  const n = beats.length - 1;
  if (n <= 0) return 0;
  for (let i = 0; i < n; i += 1) {
    const a = beats[i].at;
    const b = beats[i + 1].at;
    if (t <= b) {
      const local = b === a ? 0 : (t - a) / (b - a);
      return (i + ease(local)) / n;
    }
  }
  return 1;
}

/**
 * PER-SEGMENT easing, which is the opposite of what the exterior path does, and
 * deliberately so.
 *
 * cameraPath.ts applies one ease across its whole track and its comment
 * explains why: an inOut ease has zero derivative at both ends, so easing each
 * segment separately drives the velocity to zero at EVERY waypoint, and a
 * continuous sweep around a building that stops five times is stop-and-go
 * rather than a move.
 *
 * Inside, coming to rest at every waypoint is the entire point. The interior
 * beats are not a sweep — they are stations, and a station is somewhere the
 * camera arrives, settles, and holds while a visitor reads a layout plan. So
 * the ease belongs on the segment here.
 *
 * It also fixes a desync that a single global ease guaranteed. The DOM chapters
 * are laid out on the same weights as the beats, so the card for station one
 * begins exactly where beat `station-S1` sits. A global power2.inOut maps that
 * scroll position to 0.17 of the curve instead of 0.26 — so the copy arrived
 * while the camera was still turning, roughly a tenth of the interior leg
 * early, and every station after it inherited the error. VERIFIED in a browser:
 * at the top of the Kartikeya chapter the camera was still framing the
 * staircase. A per-segment ease maps 0 to 0 and 1 to 1 at every beat, so the
 * card and the composition arrive together by construction.
 *
 * smootherstep rather than smoothstep: its second derivative is also zero at
 * the ends, so the settle has no residual kick in it.
 */
function ease(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * FOV and bank between the surrounding beats. Linear, for the reason the
 * exterior path gives: the curve parameter is already eased, and a second ease
 * on the lens produces motion nobody asked for.
 */
export function interiorLensAt(
  beats: readonly InteriorBeat[],
  s: number,
): { fov: number; roll: number } {
  const t = Math.min(1, Math.max(0, s));
  for (let i = 0; i < beats.length - 1; i += 1) {
    const a = beats[i];
    const b = beats[i + 1];
    if (t <= b.at) {
      const k = b.at === a.at ? 0 : (t - a.at) / (b.at - a.at);
      return { fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k };
    }
  }
  const last = beats[beats.length - 1];
  return { fov: last.fov, roll: last.roll };
}

/**
 * Which station the camera is on, and how strongly.
 *
 * Returns 1 at the station's own beat and falls to 0 by the neighbouring beats.
 * Drives the hologram's emphasis and which station accepts a click, so only the
 * station being looked at is interactive — a hologram three metres behind the
 * camera should not be a target.
 */
export function stationEmphasis(
  beats: readonly InteriorBeat[],
  s: number,
  id: string,
): number {
  const i = beats.findIndex((b) => b.station === id);
  if (i < 0) return 0;
  const here = beats[i].at;
  const prev = i > 0 ? beats[i - 1].at : here - 0.1;
  const next = i < beats.length - 1 ? beats[i + 1].at : here + 0.1;
  const t = Math.min(1, Math.max(0, s));
  if (t <= here) return here === prev ? 1 : Math.max(0, (t - prev) / (here - prev));
  return next === here ? 1 : Math.max(0, 1 - (t - here) / (next - here));
}
