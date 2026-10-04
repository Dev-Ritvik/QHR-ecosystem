// apps/public/src/components/experience/phoneFraming.ts
//
// THE PHONE'S LENS, for the rooms a phone cannot see whole.
//
// The film's cameras are framed for a landscape screen. A perspective camera
// keeps its VERTICAL field of view whatever the screen, so on a portrait phone
// every shot keeps its height and loses two-thirds of its width: at the
// portrait (40 degrees) a 390x844 screen is 19 degrees across, the canvas fills
// it edge to edge, and the chapter's centred copy crossed the sitter's face.
// The establishing copy stood on the window and the map's list on the pale
// relief (measured on the clean plates at 390x844: p90 luma 240, 195, 211).
//
// So on a portrait screen the hall's non-station beats get a phone lens: a
// little wider (`widen` multiplies the tangent of the half-angle) and with a
// shifted front (`rise`, as a fraction of the frame's height: the movement an
// architectural photographer's shift lens makes — the camera is not re-aimed,
// so the verticals stay vertical, but the subject moves up or down the frame).
// That opens a band of the room's own dark for the copy: below the portrait
// and its plate, below the establishing stair, above the map table.
//
// THE TABLES TOO, SINCE THEY CARRY SITE MODELS (stationStyle.ts; the
// refinement brief, 2026-10-04). While the plans were projected in light the
// tables were not to be touched, and at a station beat the phone's lens was
// the desktop's: a frame composed for copy on the left and a plan on the
// right, of which a phone shows the middle third — the plan ran off the right
// edge of every upright screen (seen at 390x844 and 820x1180: its left 60%).
// A cropped projection read as a projection; a cropped model on a stand is a
// model nobody can see. So each table has a phone frame (wider, and shifted
// so the model stands whole in the frame under its four lines of copy), held
// through the dwell that follows it. Under `?stations=hologram` the tables
// are as they were.

import type { PerspectiveCamera } from 'three';
import type { InteriorBeat } from './interiorPath';
import { stationStyle } from './stationStyle';

export interface PhoneFrame {
  widen: number;
  rise: number;
  /** The front shifted sideways, as a fraction of the frame's width:
   *  positive moves the subject left. */
  shift: number;
}

const NONE: PhoneFrame = { widen: 1, rise: 0, shift: 0 };

/** By beat id; a beat not listed takes no phone lens (the threshold and the
 *  walks between the tables). */
// Set on the phone's own frames (390x844): the establishing stair with the
// portrait at the end of its axis over the copy; the portrait whole, its plate
// clear above the copy (1.35 keeps the sitter the subject — 1.7 and 1.85 were
// tried and only made him smaller); the map table low and centred under the
// list of layouts (the table sits right of the lens's axis at this beat, so
// the front shifts it back; 0.3 pushed it off the left edge at the film's
// last frame), with the court's approach already on the same framing so the
// chapter holds still as it arrives.
export const PHONE_FRAMING: Record<string, PhoneFrame> = {
  establish: { widen: 1.2, rise: 0.12, shift: 0 },
  'stair-foot': { widen: 1.15, rise: 0.06, shift: 0 },
  'stair-rise': { widen: 1.3, rise: 0.12, shift: 0 },
  portrait: { widen: 1.35, rise: 0.14, shift: 0 },
  court: { widen: 1.55, rise: -0.22, shift: 0.2 },
  map: { widen: 1.75, rise: -0.3, shift: 0.2 },
  // The tables (site models only: see frameOf). Set on the phone's own frames
  // (390x844): at 1.5 / 0.3 the model still ran off the right edge, at 1.85 /
  // 0.37 the third did; at 2.0 each stands whole, its name plaque legible, with
  // its table and the table's foot under it.
  'station-S1': { widen: 2.0, rise: -0.02, shift: 0.4 },
  'dwell-S1': { widen: 2.0, rise: -0.02, shift: 0.4 },
  'station-S2': { widen: 2.0, rise: -0.02, shift: 0.4 },
  'dwell-S2': { widen: 2.0, rise: -0.02, shift: 0.4 },
  'station-S3': { widen: 2.0, rise: -0.02, shift: 0.45 },
};

/** And on a tablet held upright, whose frame is half as wide again for its
 *  height: the same tables need less of both (set at 820x1180: the model
 *  across the middle half of the frame). */
export const TABLET_TABLES: PhoneFrame = { widen: 1.5, rise: -0.04, shift: 0.3 };

/** The beats that frame a table. */
const TABLE_BEAT = /^(station|dwell)-S\d$/;

/**
 * AND THROUGH THE CODA, THE PHONE'S LAST FRAME (codaFrame.ts).
 *
 * The map's frame keeps the table low, under the list of layouts. When the
 * list has gone and the page scrolls on, the colophon comes up from the foot
 * of the frame — onto the table: the sign-off's own lines crossed its lit
 * relief on the way in (measured at 390x844, its telephone number on a p90
 * luma of 178). A phone has no beside to move the table to, so it goes up:
 * the front shifts the other way and the field closes, and the table rises to
 * the upper part of the frame at the screen's own width (its rim from 12 to
 * 88% across and 21 to 43% down at 390x844; under the header's band, whose
 * density is gone by 24%) with the sign-off coming to stand beneath it. Set on
 * the phone's own frames, like the rest of this table.
 */
export const PHONE_CODA: PhoneFrame = { widen: 1.27, rise: 0.27, shift: 0.105 };

/**
 * AND A TABLET HELD UPRIGHT HAS A BESIDE. Its frame is laid out as a phone's
 * is, but it is wide enough that the sign-off keeps to its left half
 * (measured at the page's end: its last word at 51% of a 768x1024 frame, 48%
 * of 820x1180, 38% of 1024x1366) — and its colophon is shorter than the
 * frame, so the page ends with the sign-off standing in the table's band of
 * the frame's height. Under the phone's frame the lens closed over the last
 * sixteenth of a viewport, as the headline came level with the table's foot:
 * the one size at which the film's last frame was the dark one for no reason
 * a visitor could see. So on a tablet the table goes to the right instead,
 * beside the sign-off as it is on a desk (its rim from 58 to 98% across and
 * 22 to 40% down at 820x1180; from 57% across on the narrowest, 744x1133),
 * and the film ends with the land lit.
 */
export const TABLET_CODA: PhoneFrame = { widen: 1.592, rise: 0.263, shift: -0.224 };

/** How much of the tablet's coda frame an upright screen this wide (CSS px)
 *  takes: none of it on a phone, all of it from the smallest tablet up. (A
 *  600 px frame still sets the sign-off across two-thirds of its width.) */
export function tabletWeight(width: number): number {
  return smooth(640, 740, width);
}

const mix = (a: PhoneFrame, b: PhoneFrame, k: number): PhoneFrame => ({
  widen: a.widen + (b.widen - a.widen) * k,
  rise: a.rise + (b.rise - a.rise) * k,
  shift: a.shift + (b.shift - a.shift) * k,
});

/** The coda's last frame on an upright screen `width` CSS px wide. */
export function codaFrameFor(width: number): PhoneFrame {
  const t = tabletWeight(width);
  return t <= 0 ? PHONE_CODA : t >= 1 ? TABLET_CODA : mix(PHONE_CODA, TABLET_CODA, t);
}

/** The phone frame `e` of the way through the coda (0..1, eased: codaEase),
 *  on a screen `width` CSS px wide. */
export function phoneFrameInCoda(frame: PhoneFrame, e: number, width = 0): PhoneFrame {
  if (e <= 0) return frame;
  const end = codaFrameFor(width);
  return e >= 1 ? end : mix(frame, end, e);
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** How much of the phone lens a screen of this aspect (width / height) takes:
 *  all of it on a phone held upright, none on anything landscape. */
export function phoneWeight(aspect: number): number {
  return smooth(1, 0.75, aspect);
}

function frameOf(b: InteriorBeat, width: number): PhoneFrame {
  if (TABLE_BEAT.test(b.id)) {
    if (stationStyle() === 'hologram') return NONE;
    const phone = PHONE_FRAMING[b.id] ?? NONE;
    const t = tabletWeight(width);
    return t <= 0 ? phone : t >= 1 ? TABLET_TABLES : mix(phone, TABLET_TABLES, t);
  }
  return PHONE_FRAMING[b.id] ?? NONE;
}

/** The phone frame at `s` of the interior leg, on an upright screen `width`
 *  CSS px wide: linear between the beats, as the lens is (interiorLensAt). */
export function phoneFrameAt(beats: readonly InteriorBeat[], s: number, width = 0): PhoneFrame {
  const t = Math.min(1, Math.max(0, s));
  for (let i = 0; i < beats.length - 1; i += 1) {
    const a = beats[i];
    const b = beats[i + 1];
    if (t <= b.at) {
      const k = b.at === a.at ? 0 : (t - a.at) / (b.at - a.at);
      const fa = frameOf(a, width);
      const fb = frameOf(b, width);
      return {
        widen: fa.widen + (fb.widen - fa.widen) * k,
        rise: fa.rise + (fb.rise - fa.rise) * k,
        shift: fa.shift + (fb.shift - fa.shift) * k,
      };
    }
  }
  return beats.length ? frameOf(beats[beats.length - 1], width) : NONE;
}

/** A vertical field of view, degrees, opened by `widen` on the tangent. */
export function widenFov(fov: number, widen: number): number {
  if (widen === 1) return fov;
  const half = (fov * Math.PI) / 360;
  return (Math.atan(Math.tan(half) * widen) * 360) / Math.PI;
}

/**
 * A shifted front (the phone's frame): the frame slides `rise` of its height and
 * `shift` of its width over the lens's axis — positive moves the subject up,
 * and left — through the camera's view offset, which three folds into the
 * projection (so raycasts and the passes that unproject agree with the
 * picture). Written only when it changes, and cleared outright at zero.
 *
 * The full frame is given in the canvas's own proportions (`aspect` wide, 1
 * high) because setViewOffset WRITES camera.aspect = fullWidth / fullHeight:
 * given 1 x 1 it squeezed a phone's picture into a square's proportions
 * (seen: the round map table drawn as a tall oval).
 */
export function applyShift(cam: PerspectiveCamera, aspect: number, rise: number, shift: number): void {
  const v = cam.view;
  if (Math.abs(rise) < 1e-4 && Math.abs(shift) < 1e-4) {
    if (v && v.enabled) cam.clearViewOffset();
    return;
  }
  const x = shift * aspect;
  if (
    v &&
    v.enabled &&
    Math.abs(v.fullWidth - aspect) < 1e-6 &&
    Math.abs(v.offsetY - rise) < 1e-5 &&
    Math.abs(v.offsetX - x) < 1e-5
  ) {
    return;
  }
  cam.setViewOffset(aspect, 1, x, rise, aspect, 1);
}
