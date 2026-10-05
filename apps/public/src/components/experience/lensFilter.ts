// apps/public/src/components/experience/lensFilter.ts
//
// A GRADUATED NEUTRAL-DENSITY FILTER, in front of the lens, for the one stretch
// of the film where the copy has to stand in front of the sun.
//
// The fourth art-direction critique (2026-09-30): "Legibility is achieved
// through environmental art direction. An expensive site would either
// dynamically dim the 3D lighting behind the text, use a highly nuanced, barely
// perceptible radial gradient scrim (a photographic ND filter effect), or
// position the camera so the text naturally sits over darker areas." Every
// chapter's copy was placed on the picture's quiet ground by measurement — all
// but one moment. The holdings chapter opens with the camera behind the house
// looking into the golden hour, and for its first frames the heading stands in
// the horizon's glare: measured on the clean plate at legProgress 0.45, the
// eyebrow over a p90 luma of 153 and the heading over 209. By 0.6 the evening
// has taken the glare down on its own (heading p90 129).
//
// Measured again with the filter on: through the chapter's last frames the
// canal takes the sunset instead (the eyebrow over p90 172 at 0.66), so the
// filter stays on for as long as the chapter's copy does.
//
// So for those frames the lens wears the filter a landscape photographer puts
// on for a sunset: a soft ellipse of neutral density over the upper left of
// the frame, applied in scene-linear light before the print's curve
// (FilmGrade), so the sky and the glare come DOWN into the curve's shoulder —
// less light, the way the filter makes it — rather than a grey laid over them.
// It arrives with the chapter's copy and is gone before the evening needs it,
// and nothing else in the film wears it.

import { Vector4 } from 'three';
import { copyPresence, type CopyPane, type ScreenBox } from './copyZone';
import { ld } from './lookdev';

export const lensFilter = {
  /** Stops of density at the ellipse's heart; 0 is no filter. */
  stops: 0,
  /** Centre (uv, origin bottom-left) and radii of the ellipse. */
  shape: new Vector4(0.2, 0.5, 0.3, 0.2),
  /** Where the density starts to fall, as a fraction of the radii: full
   *  inside it, gone at the ellipse's edge. A soft grad is low, a hard one
   *  high. */
  inner: 0.35,
  /** Stops of the band across the top of the frame (HEADER_BAND). */
  top: 0,
  /** The band's reach, as fractions of the frame's height from its top: full
   *  to here, gone by there. The header's own (HEADER_BAND.full, .zero) unless
   *  the tables' copy stands under it (tableBandFilter). */
  topFull: 0.07,
  topZero: 0.24,
  /** Stops over the WHOLE frame: the lens closed down (codaFilter). Like the
   *  band, it never adds to the others: at each point the densest holds. */
  all: 0,
  /** A second ellipse, for a frame whose copy stands in two places (the
   *  cover: its title in the sky, its small type on the land). Same rule. */
  second: { stops: 0, shape: new Vector4(0.2, 0.3, 0.3, 0.2), inner: 0.45 },
};

/**
 * THE TOP OF THE FRAME, for the header that stands on it.
 *
 * The fourth art-direction critique took the header's plate and bar away: the
 * mark and the two controls are reversed out on the picture itself. Over the
 * film's daylight sky that left them on a p90 luma of 137 to 181 (measured on
 * the clean plates at 1440x900: the wordmark, ENQUIRE and MENU at the hero,
 * the revolution and the holdings' first frames), and in the hall ENQUIRE
 * stood on the first table's white pilaster at 172.
 *
 * "Vignette the edges of the camera lens to create natural UI contrast": the
 * lens carries a band of density across its top edge — the grad a landscape
 * photographer sets on a bright sky — full for the header's own height and
 * gone a sixth of the frame below it. By day it is DAY stops (at 2.2 the
 * hero's header stood on 51 to 58, but a phone's ENQUIRE at the revolution,
 * in the sun's own glare, still on 125 — 3.5:1); it lets go as the evening comes down, because a
 * dusk sky is already dark (measured 42 to 62 by leg 0.6); in the hall it is
 * HALL, whatever the house lights are doing — scaled down with them it left
 * the wordmark on 172 at the climb, where what stands behind the header is an
 * attic WINDOW, which no dimmer touches. Only on the film: every other page's
 * header has a bar of its own.
 *
 * AND THE HIGHLIGHTS IN IT ARE BURNT IN. A window behind the header is a
 * light source: at 2.2 stops it still printed at 122 to 142 (the climb and
 * the crossing of the hall, the controls at 2.8:1). No density a band can
 * honestly carry brings a window down, so the print does what a printer does
 * to a hot edge — within the band, what would print above `ceiling` (in the
 * print's own gamma: 0.4 is a luma of 102, where ivory capitals stand at
 * 4.7:1) is rolled off under it on a soft shoulder, and everything below the
 * shoulder is left exactly as the density made it.
 *
 * LIGHTER AND SHORTER OUTSIDE, AND HELD THROUGH THE EVENING (the paid audit of
 * 2026-10-04, pass 1: "more believable relationship between sky and ground").
 * At 2.6 stops over a quarter of the frame the top third of the hero was the
 * darkest thing in the picture — a storm over a sunlit lawn. The band is the
 * header's, so it is the header's height: full to 7% as before, gone by 16%
 * (it was 24%), at 1.6 stops by day (the wordmark on a luma of 82, the
 * controls on 74 to 77, measured). And it no longer lets go with the evening,
 * because the evening's sky no longer goes dark (WorldCanvas, SKY_HOURS): at
 * leg 0.6 the header stood on the sunset at 156 to 184 with no band at all.
 * `evening` and `night` are its stops at those hours. The hall keeps the
 * reach it was measured at (`zero`).
 */
export const HEADER_BAND = {
  day: 1.6,
  evening: 2.0,
  night: 1.2,
  hall: 2.2,
  full: 0.07,
  zero: 0.24,
  zeroOutside: 0.16,
  ceiling: 0.4,
} as const;

/** The band outside, for this much of the film's evening (0 day .. 1 fallen)
 *  and of the night that follows it (0 .. 1). */
export function headerBandOutside(evening: number, night = 0): number {
  const e = Math.min(1, Math.max(0, evening));
  const n = Math.min(1, Math.max(0, night));
  const day = ld('bandDay', HEADER_BAND.day);
  const at = day + (ld('bandEvening', HEADER_BAND.evening) - day) * (e * e * (3 - 2 * e));
  return at + (ld('bandNight', HEADER_BAND.night) - at) * (n * n * (3 - 2 * n));
}

/** The holdings' opening frames, in exterior-leg progress. The density is
 *  ridden, as an operator rides a grad while the sun leaves the frame:
 *  `open` while the heading stands on the canal's reflection of the sunset
 *  (measured at 0.45: the heading over p90 142 at 1.5 stops, 115 at 2.0),
 *  easing to `stops` once the camera has turned off it (0.5: 96 at 1.5). */
export const HOLDINGS_ND = {
  stops: 1.5,
  open: 2.0,
  settle: [0.47, 0.55] as const,
  // On before the copy has developed (ChapterFade brings it up over the last
  // of its arrival): begun at 0.37 it was three-quarters on at 0.40, with the
  // eyebrow already standing on a p90 of 116.
  from: [0.33, 0.38] as const,
  to: [0.68, 0.74] as const,
} as const;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * THE DESIGN'S FRAME, and the frame the copy is actually on.
 *
 * On a wide frame the film's copy is set in the frame's own unit, on a grid
 * that stays centred (globals.css, THE FILM'S STAGE): it stands over the same
 * part of the picture at every size of frame. The picture keeps its height
 * and shows more or less of itself at the sides, so that same part of the
 * picture is at a different fraction of a wider or a squarer frame's WIDTH —
 * and the filters below were measured as fractions of a 1440x900 frame. Left
 * as they were, the tables' burnt edge sat on the frame's edge at 1920x1080
 * while the copy it was made for stood a fifth of the way in (measured: the
 * third table's name on a p90 luma of 140, its place line on 123).
 *
 * So a wide frame's filter is given for the design's frame and placed by the
 * frame's aspect: its centre and its width are scaled about the middle of the
 * frame, exactly as the copy's grid is. `safe` is the squarest frame the grid
 * is still centred at that scale (4:3: the design's middle 1200 pixels);
 * squarer than that the grid is fitted to the frame's width instead, and the
 * copy stays where it stands at 4:3.
 */
export const STAGE = { aspect: 1440 / 900, safe: 1200 / 900 } as const;

/** Put on the lens a shape given for the design's frame, where the same
 *  picture stands on a frame of this aspect (width / height). */
function onStage(cx: number, cy: number, rx: number, ry: number, aspect: number): void {
  const k = STAGE.aspect / Math.max(aspect, STAGE.safe);
  // (cx about the middle of the frame; written so the design's own aspect
  // gives the design's own numbers back exactly)
  lensFilter.shape.set(cx * k + 0.5 * (1 - k), cy, rx * k, ry);
}

/**
 * THE HEADER'S BAND AGAIN, AT NIGHT, WHILE THE LIT HOUSE PASSES BEHIND IT
 * (HEADER_BAND, above). The band lets go with the evening because a dusk sky
 * is already dark; but through the approach the camera comes down the front
 * of the floodlit house, and on a portrait screen the cupola's lit wall
 * stands behind ENQUIRE: measured at 390x844 from leg 0.85 to 0.9, a p90 luma
 * of 96 to 106 under it, 4.6 to 5.4:1 — inside AA by a hair, and a hair is not
 * a margin. So a light band comes back for those frames only, and is gone
 * again before the door, where the top of the frame is the attic's dark.
 */
export const HEADER_APPROACH = { stops: 0.6, from: [0.8, 0.84], to: [0.91, 0.95] } as const;

/** The band through the approach, at this place on the exterior leg. */
export function headerBandApproach(legS: number): number {
  const { stops, from, to } = HEADER_APPROACH;
  return stops * smooth(from[0], from[1], legS) * (1 - smooth(to[0], to[1], legS));
}

/**
 * AT THE TABLES (the critique, of the interior: "Move the typography to the
 * darker edges of the screen, or vignette the edges of the camera lens to
 * create natural UI contrast"). The station frames are the client's and stay
 * as they are — table, projector, plan and angle — but two of them stand the
 * copy column in front of an ivory pilaster: measured on the clean plates,
 * the first table's name over a p90 luma of 191 and its place line over 200,
 * the third's 195 and 199; the second's copy sits on the walnut at 78. So at
 * the first and third tables the lens darkens its own left edge, the way a
 * lens vignettes, over the copy's third of the frame and never the plan's
 * half. Stops per station, at full emphasis. (As the camera withdraws from
 * the third table the bare wall comes round behind the copy's column, and no
 * density a wall will take holds half-gone lines on it: the copy leaves with
 * the camera instead — ChapterFade, OUT_ATTR.)
 *
 * ONLY ON A WIDE FRAME (copyZone.filmIsWide), where the copy has that column.
 * On any other the tables' copy stands across the top of the frame, and what
 * comes down over it is the header's own band (tableBandFilter). The first
 * version of this pass wore a soft ellipse across the middle of a portrait
 * frame instead, behind copy set across the plan — and that ellipse lay over
 * the plan itself and took it down two stops (seen at 390x844, lens on against
 * lens clear): the one thing in the room the client had said to leave alone.
 *
 * LIGHTER, AND AT EACH TABLE WHAT ITS OWN COPY NEEDS (the client, 2026-10-01,
 * of the first: "the darkness behind the kartikeya water front text is a bit
 * too much kindly reduce it"; of the second, which had no edge and a room at
 * 0.15 instead: "this also looks too dark"). The first stood at 2.4 stops and
 * the third at 2.3, set with margin to spare — the copy at 6 to 8.4:1 where
 * 4.5 is asked. Measured line by line at 1920x1080, each line at rest:
 *   the first   its two small lines stand on the foot of the ivory pilaster,
 *               the brightest ground any table's copy has: at 2.0 stops 4.8
 *               and 4.3:1 against the brightest tenth of that ground (7:1
 *               against its mean), every other line 6:1 or better; 4.4 and
 *               4.0 at 1.9. So 2.1, where the weaker of them stands at 4.5,
 *               and no lighter: the client asked for the shade to come down,
 *               and that is as far as it goes with every line still at AA.
 *   the third   on shaded plaster: 6.0:1 or better at 2.0, so 1.8 (5.1 there).
 *   the second  in a room at 0.34 (hallLight.HALL_LEVEL_S2) the wall behind
 *               its copy prints under 50 at 2.0 stops: 1.2 holds it under 70.
 * And the numeral over each block is ivory, not gilt: small gilt wants a
 * ground under 80, which is what part of the old density was buying.
 */
export const STATION_ND: Readonly<Record<string, number>> = { S1: 2.1, S2: 1.2, S3: 1.8, S4: 1.0, portrait: 1.4 };

/**
 * AND HALF A STOP UNDER THE ESTABLISHING COPY, as under the cover's (HERO_ND).
 * It stands at the foot of the frame, on the dim wall under the sconces, and
 * at the design's size that is enough: its statement is 25px, large text. But
 * the statement follows the frame, and on a laptop's 1536x730 it is 20px —
 * small text, which wants a ground under 105 — with three of its words on
 * 104 to 108 where the stair's pale stone begins (4.5 to 4.8:1, no margin at
 * all). A soft ellipse over the lower left, for as long as that copy is up,
 * and never as far as the stair's foot.
 */
export const ESTABLISH_ND = { stops: 0.5, shape: [0.24, 0.15, 0.32, 0.3] as const, inner: 0.45 } as const;

/**
 * The filter at the tables — and on a landscape screen along the portrait's
 * climb, whose copy is pinned on the same left third from the foot of the
 * stair to the landing while windows and the chandelier pass behind it
 * (measured at leg 0.77: its eyebrow on a p90 luma of 115 with the house
 * lights already down). `weights` is how much of each chapter's copy is up,
 * 0..1 (copyZone): the edge is there for the copy, for as long as the copy is.
 * On a frame that is not wide there is no such column and no such filter: the
 * portrait's copy has its own grad (phoneRoomFilter), the tables' the header's
 * band (tableBandFilter). `aspect` is the frame's (STAGE, above): the edge is
 * burnt in beside the same part of the picture on every wide frame.
 */
export function stationFilter(
  weights: Readonly<Record<string, number>>,
  wide: boolean,
  aspect: number = STAGE.aspect,
): void {
  if (!wide) {
    lensFilter.stops = 0;
    return;
  }
  let stops = 0;
  for (const [id, w] of Object.entries(weights)) {
    stops = Math.max(stops, (STATION_ND[id] ?? 0) * w);
  }
  // The establishing shot's half stop, under its copy in the lower left
  // (ESTABLISH_ND): the tables' edge takes over when it is the denser.
  const establish = ESTABLISH_ND.stops * Math.min(1, Math.max(0, weights.establish ?? 0));
  if (establish > stops) {
    lensFilter.stops = establish;
    lensFilter.inner = ESTABLISH_ND.inner;
    onStage(ESTABLISH_ND.shape[0], ESTABLISH_ND.shape[1], ESTABLISH_ND.shape[2], ESTABLISH_ND.shape[3], aspect);
    return;
  }
  lensFilter.stops = stops;
  // The left edge of the frame burnt in, the way a printer holds back the
  // side of a picture the eye should leave: the whole copy column at full
  // density from top to bottom, then a short, gently bowed fall (centred far
  // off the frame, so the fall curves like a lens's field) that is gone
  // before the plan begins. Not a shape round the words — that read as a
  // smudge on the pilaster (seen) — and not a soft radial fade, which was
  // measured still falling off across the pilaster behind the copy (the
  // third table's name over p90 139 at 1.8 stops).
  onStage(-0.55, 0.5, 1.02, 2.4, aspect);
  lensFilter.inner = 0.83;
}

/**
 * AT THE TABLES ON A FRAME THAT IS NOT WIDE: THE HEADER'S BAND COMES DOWN
 * OVER THE COPY.
 *
 * A frame taller than it is wide shows the middle of the landscape one, and
 * the plan's pane begins at its centre line as it does on every screen — so
 * there is no column beside the plan wide enough to set a name in, and copy
 * set across the frame's middle is copy set across the plan. Above the plan
 * there is only the wall. So on these frames the tables' copy stands across
 * the top, under the header (site-home), and the band the lens already wears
 * for the header — the same density, the same burnt-in highlights, so a white
 * pilaster swinging through behind the words on the way in or out is held as
 * it is behind the controls — reaches down to just under the copy's last line
 * and is gone before the plan begins (measured at 390x844: the pane's top
 * edge at 29% of the height at the first table, 36% and 40% at the others).
 *
 * `panes` is copyZone's; the band rides its measured foot, eased, and goes
 * back to the header's own reach when no table's copy is up. Capped: on a
 * short screen the copy's foot stands lower in the frame, and the band stops
 * short of the plan rather than follow it there.
 */
export const TABLE_BAND = { margin: 0.015, fall: 0.05, fullMax: 0.25, zeroMax: 0.3 } as const;
const tableBand = { on: 0, foot: 0 };

export function tableBandFilter(panes: readonly CopyPane[], dt: number): void {
  let on = 0;
  for (const p of panes) {
    if (!/^station-\d+$/.test(p.id)) continue;
    const c = copyPresence(p.weight);
    if (c <= on) continue;
    on = c;
    tableBand.foot = p.bottom;
  }
  tableBand.on += (on - tableBand.on) * (1 - Math.exp(-Math.max(0, dt) / 0.2));
  const e = tableBand.on < 0.004 ? 0 : tableBand.on;
  const full = Math.max(HEADER_BAND.full, Math.min(TABLE_BAND.fullMax, tableBand.foot + TABLE_BAND.margin));
  const zero = Math.max(HEADER_BAND.zero, Math.min(TABLE_BAND.zeroMax, full + TABLE_BAND.fall));
  lensFilter.topFull = HEADER_BAND.full + (full - HEADER_BAND.full) * e;
  lensFilter.topZero = HEADER_BAND.zero + (zero - HEADER_BAND.zero) * e;
}

/**
 * The band at the header's own reach: wherever no table's copy is under it.
 * `outside`: over the estate's sky, where it is shorter (HEADER_BAND) — and
 * EASED there (`dt`, seconds), because the estate takes the frame back from
 * the hall at the end of the way out by the door, and a reach that stepped
 * from the hall's to its own would lift a strip of the picture in one frame.
 */
export function headerBandReach(outside = false, dt = Infinity): void {
  tableBand.on = 0;
  lensFilter.topFull = ld('bandFull', HEADER_BAND.full);
  if (!outside) {
    lensFilter.topZero = HEADER_BAND.zero;
    return;
  }
  const want = ld('bandZero', HEADER_BAND.zeroOutside);
  lensFilter.topZero += (want - lensFilter.topZero) * (1 - Math.exp(-Math.max(0, dt) / 0.35));
}

/**
 * THE HOLDINGS' GRAD ON A WIDE FRAME: its shape, and how much denser it opens.
 *
 * The ellipse was drawn for the heading in the horizon's glare — centred on
 * it, a quarter of the frame tall — and the rest of the block was left to the
 * land's own dark. Line by line, at each line's own colour, that was thin:
 * the heading's words at 3.0 to 3.3:1 at the opening (on a p90 luma of 104 to
 * 132, where large text needs 3), and at leg 0.60 the garden's blossom passes
 * behind the foot of the block — a figure's label on 114, 4.15:1. So the
 * ellipse reaches down over the figures and their labels (the same centre
 * line across, the same reach up, half as tall again), and opens seven-tenths
 * of a stop denser, given back as the evening settles. (Seven, not four: on a
 * 13-inch laptop's 1280x593 the eyebrow's capitals cannot shrink with the
 * frame, reach half as far again across the picture, and at leg 0.40 stood on
 * the haze between two trees — a p90 luma of 125 at the plain opening.)
 */
export const HOLDINGS_SHAPE = [0.22, 0.4, 0.33, 0.36] as const;
export const HOLDINGS_WIDE_OPEN = 0.7;

/**
 * THE COVER'S SKY (the paid audit of 2026-10-04, passes 2 and 6: "typography
 * as composition, not information sitting over an image").
 *
 * The cover's words stood on the land, over the pool terrace, in a cloud's
 * shade made for them. On the long-lens cover (cameraPath, the hero) the top
 * third of the frame is sky and nothing else, and the words are set there: a
 * title in the air over the house, as a magazine sets one. A sky photographed
 * at this hour is a stop and a half brighter than ivory type can stand on, so
 * the lens wears what a landscape photographer puts on for any sky at this
 * hour: a soft-edged graduated filter, its density from the top of the frame
 * to the foot of the title and gone at the horizon. Not a shape behind the
 * text: a grad across the whole width, which is what a grad is. A light one
 * (the first, at 1.4 stops down to the tree line, was the dark lid over a
 * sunlit lawn that the audit's first pass had just taken off): it holds a
 * LARGE line of ivory at 3:1 and no more, so only the title stands in the
 * sky. The small type is on the land (site-home).
 *
 * It does not come and go with the words (a sky that brightens as a line
 * fades is an exposure hunting). It is on from the film's first frame and is
 * ridden off as the camera turns from this sky toward the sun's (`off`, in
 * leg progress), before the holdings' own grad comes on.
 */
export const COVER_SKY = { stops: 1.3, full: 0.27, zero: 0.37, off: [0.2, 0.31] as const } as const;

/**
 * AND HALF A STOP UNDER THE COVER'S SMALL TYPE, on the land (as there was
 * under the whole block before it was parted: "a highly nuanced, barely
 * perceptible radial gradient ... a photographic ND filter effect", the fourth
 * critique's own second means). The supporting line stands on the west lawn,
 * whose brightest tenth reads 103 to 108 under its three lines (measured on
 * the clean plate, 2026-10-04): at the limit for small ivory, with a mown
 * stripe's worth of margin. Half a stop gives it a fifth. There for as long
 * as the cover's copy is (`cover`, copyZone), in the design's frame (STAGE).
 */
export const COVER_LAND_ND = { stops: 0.5, shape: [0.24, 0.3, 0.27, 0.2] as const, inner: 0.45 } as const;

/**
 * AND A STOP UNDER THE REVOLUTION'S COPY ON A SHORT FRAME (a phone on its
 * side). On every other wide frame that copy stands on the lawn by
 * composition and needs nothing. On a frame 390 px tall its type cannot
 * shrink with the picture: three lines at 15 px reach half-way across the
 * frame, out over the pool terrace's pale stone, and with the sky as the fill
 * (the paid audit, 2026-10-04) two of its words stood on a p90 luma of 139 to
 * 142, 2.8:1. A soft ellipse under the block, for as long as it is up
 * (`revolution`, copyZone), on the lens's second ellipse — which the cover's
 * small type has given up by then.
 */
export const REVOLUTION_SHORT_ND = { stops: 1.0, shape: [0.31, 0.29, 0.3, 0.2] as const, inner: 0.45 } as const;

/** The cover's sky grad at this point of the exterior leg, in stops. */
export function coverSkyStops(legS: number): number {
  return ld('coverSky', COVER_SKY.stops) * (1 - smooth(COVER_SKY.off[0], COVER_SKY.off[1], legS));
}

/**
 * The filter for this frame of the exterior leg, on a wide frame: the cover's
 * sky grad through the film's first chapters, then the holdings' grad where
 * that copy stands in the lower left. (Any other frame wears the sky grad
 * that rides with the copy: phoneSkyFilter.) `aspect` is the frame's (STAGE);
 * `cover` is how much of the cover's copy is up, 0..1 (copyPresence), and
 * `revolutionShort` the same for the revolution's on a short frame.
 */
export function holdingsFilter(
  legS: number,
  aspect: number = STAGE.aspect,
  cover = 0,
  /** How much of the revolution's copy is up, on a SHORT frame; 0 on any other. */
  revolutionShort = 0,
): void {
  // The second ellipse: half a stop under the cover's small type, or (on a
  // short frame) a stop under the revolution's copy. Whichever is the denser.
  const land = ld('coverLand', COVER_LAND_ND.stops) * Math.min(1, Math.max(0, cover));
  const rev = REVOLUTION_SHORT_ND.stops * Math.min(1, Math.max(0, revolutionShort));
  const second = rev > land ? REVOLUTION_SHORT_ND : COVER_LAND_ND;
  const stops = Math.max(land, rev);
  lensFilter.second.stops = stops < 0.004 ? 0 : stops;
  if (stops > 0) {
    const [cx, cy, rx, ry] = second.shape;
    const k = STAGE.aspect / Math.max(aspect, STAGE.safe);
    lensFilter.second.shape.set(cx * k + 0.5 * (1 - k), cy, rx * k, ry);
    lensFilter.second.inner = second.inner;
  }
  const on = smooth(HOLDINGS_ND.from[0], HOLDINGS_ND.from[1], legS) * (1 - smooth(HOLDINGS_ND.to[0], HOLDINGS_ND.to[1], legS));
  const opening = 1 - smooth(HOLDINGS_ND.settle[0], HOLDINGS_ND.settle[1], legS);
  const holdings = (holdingsDensity(legS) + HOLDINGS_WIDE_OPEN * opening) * on;
  const sky = coverSkyStops(legS);
  if (sky > holdings) {
    // A grad anchored at the top edge: an ellipse centred above the frame,
    // wide enough that across the frame its edge is a line.
    const vFull = 1 - ld('coverSkyFull', COVER_SKY.full);
    const vZero = 1 - ld('coverSkyZero', COVER_SKY.zero);
    const cy = 1.2;
    const ry = cy - vZero;
    lensFilter.stops = sky;
    lensFilter.shape.set(0.5, cy, 3, ry);
    lensFilter.inner = (cy - vFull) / ry;
    return;
  }
  lensFilter.stops = holdings;
  lensFilter.inner = 0.35;
  onStage(HOLDINGS_SHAPE[0], HOLDINGS_SHAPE[1], HOLDINGS_SHAPE[2], HOLDINGS_SHAPE[3], aspect);
}

/**
 * THE APPROACH, as the camera comes down the flank. The chapter's copy stands
 * centred at the foot of the frame, on the forecourt's dark — except for the
 * few frames in which the lit portico swings through behind it (measured at
 * leg 0.85: the eyebrow on a p90 luma of 160; 57 at 0.80 and 55 at 0.90). For
 * those frames the foot of the frame is burnt in, from the bottom edge to
 * just over the copy, and let go as the camera settles on the axis: the same
 * ridden grad as the holdings', the other way up.
 */
export const APPROACH_ND = {
  stops: 1.6,
  // (It came on from 0.79, for copy that was up from 0.76. The copy waits
  // for the door now — ChapterFade, AFTER_ATTR: it develops from leg 0.845 —
  // so the foot of the frame is left alone until just before it does.)
  from: [0.815, 0.85] as const,
  to: [0.87, 0.91] as const,
  /** Full from the foot of the frame to here, gone by there (from the top). */
  full: 0.72,
  zero: 0.6,
} as const;

/**
 * The approach's grad for this frame, over whatever the exterior's other
 * filter wrote: the denser stands. Call after holdingsFilter / phoneSkyFilter.
 */
export function approachFilter(legS: number): void {
  const on =
    smooth(APPROACH_ND.from[0], APPROACH_ND.from[1], legS) * (1 - smooth(APPROACH_ND.to[0], APPROACH_ND.to[1], legS));
  const stops = APPROACH_ND.stops * on;
  if (stops <= lensFilter.stops) return;
  lensFilter.stops = stops;
  const vFull = 1 - APPROACH_ND.full;
  const vZero = 1 - APPROACH_ND.zero;
  const cy = -0.2;
  const ry = vZero - cy;
  lensFilter.shape.set(0.5, cy, 3, ry);
  lensFilter.inner = (vFull - cy) / ry;
}

/** The holdings' ridden density at this point of the leg (HOLDINGS_ND). */
function holdingsDensity(legS: number): number {
  const ride = smooth(HOLDINGS_ND.settle[0], HOLDINGS_ND.settle[1], legS);
  return HOLDINGS_ND.open + (HOLDINGS_ND.stops - HOLDINGS_ND.open) * ride;
}

/**
 * ON A PORTRAIT SCREEN the copy has no quiet side of the frame to stand on:
 * the chapters stack over the sky. Measured on the clean plates at 390x844,
 * the hero's place line over a p90 luma of 172, its headline 151 and its note
 * 205 (white cloud); the revolution's eyebrow 172 (the horizon's haze); the
 * holdings' eyebrow 130 and its note 132. The residence's copy stands low, on
 * the forecourt's dark (91 at most), and needs nothing.
 *
 * So on a phone the lens wears a sky grad: full density from the top edge down
 * to just below the lowest line of copy standing in the upper frame (copyZone:
 * ChapterFade publishes where the words are), then a short fall beneath —
 * a grad's edge set where the words end, riding down and up with them as they
 * scroll. Copy entering from below stands on the ground and is left alone
 * until it rises into the upper frame, and then eases in, so the grad never
 * jumps. The density is the chapter's own: 2.5 stops over the hero's
 * daylight sky, 1.8 at the revolution, and the holdings' ridden density
 * (HOLDINGS_ND). (The hero's was 2.2, its note then over a p90 luma of 99;
 * set shorter for a phone's real frame, the block's gloss runs the column's
 * full measure, out over the bright end of the cloud bank: 106 at 2.2.)
 */
// (The revolution's was 1.8 until the paid audit of 2026-10-04: with the sky
// as the fill, the shaded parapet its second line crosses on a phone came up
// to a p90 luma of 121, and one word stood at 3.7:1. At 2.3 it is under 105.)
export const PHONE_SKY_ND: Readonly<Record<string, number>> = { hero: 2.5, revolution: 2.3, holdings: 2.0 };
/** How far down the frame the grad may reach; its margin below the copy and
 *  the height of its fall, as fractions of the frame's height. */
export const PHONE_SKY = { reach: 0.74, rise: 0.12, margin: 0.03, fall: 0.09 } as const;
/**
 * The holdings' copy ARRIVES into the sunset's glare on these frames: measured
 * at leg 0.40 with the holdings' own two stops, its eyebrow on a p90 luma of
 * 100 at 390x844, 105 at 820x1180 and 114 at 375x667. So the grad opens this
 * much denser, and gives it back as the evening settles (HOLDINGS_ND.settle).
 */
export const PHONE_HOLDINGS_BOOST = 0.6;

type Anchor = 'top' | 'bottom';
interface GradState {
  stops: number;
  /** The copy's far edge, as a distance from the anchored edge of the frame. */
  extent: number;
}
interface GradGeometry {
  /** Copy counts once its near edge is within `reach` of the anchored edge… */
  reach: number;
  /** …easing in over `rise` more. */
  rise: number;
  /** Full density to the copy's far edge plus `margin`, gone `fall` past it. */
  margin: number;
  fall: number;
}

/**
 * A grad anchored at one edge of the frame and riding with the copy
 * (copyZone): full from that edge to just past the copy's far edge, then a
 * short fall. Eased (0.2 s), so it rides rather than steps. Writes nothing;
 * returns the stops and leaves the shape to `writeGrad`.
 */
function rideGrad(
  st: GradState,
  panes: readonly CopyPane[],
  density: (id: string) => number,
  anchor: Anchor,
  g: GradGeometry,
  dt: number,
): void {
  let stops = 0;
  let sum = 0;
  let far = 0;
  for (const p of panes) {
    const base = density(p.id);
    if (base <= 0) continue;
    const near = anchor === 'top' ? p.top : 1 - p.bottom;
    const farEdge = anchor === 'top' ? p.bottom : 1 - p.top;
    const within = smooth(g.reach, g.reach - g.rise, near);
    const c = base * copyPresence(p.weight) * within;
    if (c <= 0) continue;
    stops = Math.max(stops, c);
    sum += c;
    far += c * Math.min(farEdge, g.reach);
  }
  const want = sum > 0 ? far / sum : st.extent;
  const k = 1 - Math.exp(-Math.max(0, dt) / 0.2);
  st.stops += (stops - st.stops) * k;
  st.extent += (want - st.extent) * k;
}

/** Put a ridden grad on the lens: an ellipse centred off the anchored edge,
 *  wide enough that across the frame it is a line. */
function writeGrad(st: GradState, anchor: Anchor, g: GradGeometry): void {
  lensFilter.stops = st.stops < 0.01 ? 0 : st.stops;
  const full = st.extent + g.margin;
  if (anchor === 'top') {
    const vFull = 1 - full;
    const vZero = vFull - g.fall;
    const cy = 1.2;
    const ry = cy - vZero;
    lensFilter.shape.set(0.5, cy, 3, ry);
    lensFilter.inner = (cy - vFull) / ry;
  } else {
    const vFull = full;
    const vZero = vFull + g.fall;
    const cy = -0.2;
    const ry = vZero - cy;
    lensFilter.shape.set(0.5, cy, 3, ry);
    lensFilter.inner = (vFull - cy) / ry;
  }
}

const sky: GradState = { stops: 0, extent: 0 };

/**
 * The phone's filter for this frame of the exterior leg: `panes` from
 * copyZone, `dt` in seconds (the grad eases rather than steps).
 */
export function phoneSkyFilter(panes: readonly CopyPane[], legS: number, dt: number): void {
  const opening = 1 - smooth(HOLDINGS_ND.settle[0], HOLDINGS_ND.settle[1], legS);
  const density = (id: string) =>
    id === 'holdings' ? holdingsDensity(legS) + PHONE_HOLDINGS_BOOST * opening : PHONE_SKY_ND[id] ?? 0;
  rideGrad(sky, panes, density, 'top', PHONE_SKY, dt);
  writeGrad(sky, 'top', PHONE_SKY);
}

/**
 * IN THE HALL, ON A PHONE, the same grad for the chapters the phone's lens
 * reframes (phoneFraming.ts): the establishing and portrait copy stand at the
 * foot of the frame, on the stair's shade and the landing's balustrade, and
 * the grad rises from the floor to just over them; the map's list stands at
 * the top, on the landing's walnut, and the grad falls from the top edge to
 * just under it. The tables are not in ROOM_ND: their copy stands under the
 * header's band (tableBandFilter).
 *
 * The establishing copy's was 1.6 stops, set against the whole paragraph's
 * ground. Word by word it was not enough: at the foot of the stair, behind
 * the middle of the first line, stands the court's map table, and its relief
 * left three words on a p90 luma of 107 to 123 (3.1 to 3.8:1, measured at
 * 390x844). At 2.4 the same words stand on 96 or under.
 */
export const ROOM_ND: Readonly<Record<string, { stops: number; anchor: Anchor }>> = {
  establish: { stops: 2.4, anchor: 'bottom' },
  portrait: { stops: 1.4, anchor: 'bottom' },
  city: { stops: 1.6, anchor: 'top' },
};
export const PHONE_ROOM: GradGeometry = { reach: 0.62, rise: 0.12, margin: 0.03, fall: 0.12 };

const roomTop: GradState = { stops: 0, extent: 0 };
const roomBottom: GradState = { stops: 0, extent: 0 };

/**
 * The phone's filter in the hall, over whatever the tables' filter wrote this
 * frame: the stronger of the two stands.
 */
export function phoneRoomFilter(panes: readonly CopyPane[], dt: number): void {
  const of = (anchor: Anchor) => (id: string) => {
    const r = ROOM_ND[id];
    return r && r.anchor === anchor ? r.stops : 0;
  };
  rideGrad(roomTop, panes, of('top'), 'top', PHONE_ROOM, dt);
  rideGrad(roomBottom, panes, of('bottom'), 'bottom', PHONE_ROOM, dt);
  const st = roomTop.stops >= roomBottom.stops ? roomTop : roomBottom;
  if (st.stops <= lensFilter.stops) return;
  writeGrad(st, st === roomTop ? 'top' : 'bottom', PHONE_ROOM);
}

/**
 * THE FILM'S LAST LIGHT, AND THE COLOPHON THAT COMES UP OVER IT.
 *
 * The film ends on the map table, lit, in a house whose lights have gone
 * down, and the page scrolls on into the colophon: the sign-off, then the
 * footer's links, its offices and its legal line, set on the picture with no
 * ground of their own. The coda's last frame is composed for it (codaFrame.ts):
 * the table beside the sign-off on a wide frame, above it on a phone. But a
 * colophon is taller than most frames, and on a phone, a phone on its side or
 * a short laptop its lines still ride up through the place the table stands —
 * measured before this was written, at 390x844: ten lines on the lit relief,
 * ivory capitals on a p90 luma of 178 to 207, 1.15 to 1.7:1.
 *
 * Nothing in a frame can be moved out of the way of a block of text that
 * crosses all of it. So the light goes instead, as it does in a cinema when
 * the credits come up: the lens closes down over the whole frame — density,
 * in scene-linear light before the print's curve, so the land sinks into the
 * curve's toe and stays the last warm thing in a dark house — as the first
 * line that will cross the table comes within `reach` of it, and it stays
 * closed for as long as any of those lines has still to pass. Lines BESIDE
 * the table ask for nothing (the sign-off's column on a desk), so on a frame
 * whose colophon ends clear of the table the film ends with the land lit.
 *
 * `stops` was set on the phone's last frames, the relief under the links on
 * the clean plate: a p90 luma of 64 at 3.0, 46 at 3.5, 32 at 4.0 (the print's
 * toe takes more than the density alone would). `reach` and `beside` are
 * fractions of the frame's height and width.
 */
export const CODA_FADE = { stops: 3.2, reach: 0.04, beside: 0.02, ease: 0.2 } as const;

/**
 * How much of the fade the colophon asks for, 0..1: `lines` are the words of
 * each of its visible lines (copyZone.lines), `table` where the map table's
 * top stands (mapStage.screen), both in fractions of the frame from its
 * top-left.
 *
 * The lines that can cross the table — those whose words reach across any
 * part of its width — are taken as ONE block, from the top of the first to
 * the foot of the last: all of it from the moment the block's top touches the
 * table's foot until its foot has cleared the table's top, with no letting go
 * in the gaps between its lines (the sixth of a viewport between the sign-off
 * and the links would otherwise bring the light up and take it down again).
 */
export function colophonCover(lines: readonly ScreenBox[], table: ScreenBox | null): number {
  if (!table) return 0;
  let top = Infinity;
  let bottom = -Infinity;
  for (const b of lines) {
    if (b.r < table.l - CODA_FADE.beside || b.l > table.r + CODA_FADE.beside) continue;
    if (b.t < top) top = b.t;
    if (b.b > bottom) bottom = b.b;
  }
  if (top === Infinity) return 0;
  const coming = 1 - smooth(0, CODA_FADE.reach, top - table.b);
  const gone = 1 - smooth(0, CODA_FADE.reach, table.t - bottom);
  return coming * gone;
}

const codaFade = { on: 0 };

/**
 * The lens for this frame of the coda: `dt` in seconds (the fade eases, so a
 * jump to the page's end closes the lens over a fifth of a second rather than
 * in one frame). Writes lensFilter.all and nothing else.
 */
export function codaFilter(lines: readonly ScreenBox[], table: ScreenBox | null, dt: number): void {
  const want = colophonCover(lines, table);
  codaFade.on += (want - codaFade.on) * (1 - Math.exp(-Math.max(0, dt) / CODA_FADE.ease));
  lensFilter.all = codaFade.on < 0.004 ? 0 : CODA_FADE.stops * codaFade.on;
}

/** The lens open again, at once: off the film. */
export function codaFilterClear(): void {
  codaFade.on = 0;
  lensFilter.all = 0;
}
