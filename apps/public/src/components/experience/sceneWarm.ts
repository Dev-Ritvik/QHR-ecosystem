// apps/public/src/components/experience/sceneWarm.ts
//
// NOTHING IS DRAWN BEFORE ITS PROGRAMS ARE BUILT.
//
// A scene's shaders are compiled by the graphics driver, and three asks for
// each one's result the first time it draws with it — a call that waits. So a
// set drawn the moment it has loaded compiles every program it has in the
// one frame, one after another, with the browser held for all of it.
//
// MEASURED on the finished build (2026-10-07; c12/perf_links.mjs,
// c12/perf_profile.mjs), on the graphics card a browser picks BY ITSELF — this
// machine's integrated one, a Radeon 780M, where every check before it had
// asked for the discrete card:
//
//   the film, first load     64 programs, one frame of 7.9 s, curtain up 12.0 s
//   an estate page           64 programs, one frame of 8.1 s, curtain up 12.3 s
//   a hall page              68 programs, one frame of 2.2 s, curtain up 6.9 s
//
// and of a 14 s profile of the estate's page, 10.2 s stood in the one function
// of three's that asks a program for its link status. Under the curtain that
// is a hairline that does not move for eight seconds. On a navigation from
// one page to another it is worse: the route's veil is shut over the change,
// and it lifts on a timer and a frame — neither of which comes while the
// browser is held. That is the photograph the client sent of the offices'
// page: its address changed, its title changed, and a dark veil over it.
//
// The film had already solved this for the hall, which it loads early and
// keeps hidden until the door: its programs are built a few a frame and
// introduced as the driver finishes them, off the main thread where the
// browser can (hallProbe.ts, warmProgramsUnder). A page that showed the hall
// directly, and the estate everywhere, had no such thing.
//
// So a set is HIDDEN until its programs are built (WorldCanvas, WarmGate), and
// this module says the two things the rest of the page needs to know:
//
//   ready   what the page now showing is a picture of has been built, and has
//           been drawn for a few frames.
//   hold    the dark held over the canvas while it has not, and gone by
//           degrees once it has: the page's words are there at once, on the
//           canvas's own dark, and the picture develops in under them.

//
// THE DARK IS A PICTURE NOW, where there is one (2026-10-10; stills.ts): each
// view has a still of its own first frame, shown over the canvas on this same
// `hold` and gone by the same degrees, so the wait is the picture standing
// still and not the page standing dark. The curtain no longer waits for
// `ready` at all (ExperienceCanvasHost): it waits for the still. `ready` is
// what anything that needs the REAL picture waits for, and the document says
// it (`data-scene`).
//
//   absent  there will be no scene: no WebGL, or one that failed. The still
//           stays; nothing waits.
//
// AND THE SCENE IS REVEALED ONCE, AT THE QUALITY IT WILL KEEP. A device's tier
// is measured on the first frames that draw the scene (useDeviceTier), and
// until it is, the chain is the middle tier's: no lens, no contact shade, no
// grain. Two seconds after the picture was first shown, every capable device
// was promoted and the whole chain rebuilt in front of the visitor — a change
// of picture, and (FOUND 2026-10-10, in the frames after a still gave way to
// the scene) a second in which every lit window of the house was a white
// hole: see WorldCanvas, the canvas's `alpha`. So the measuring is done UNDER
// the still or the dark, which is the same wait a visitor already has a
// picture for:
//
//   drawing     what the page shows has been built and is being drawn, behind
//               whatever is held over it. The tier is measured on these frames.
//   tierSettled the device's tier has been measured (once, for the canvas).
//   ready       drawing, and the tier settled and its chain drawn for a few
//               frames (or TIER_WAIT_MS gone by: a device too slow to measure
//               in that time is shown what it has).

export const sceneWarm = {
  ready: false,
  hold: 1,
  absent: false,
  drawing: false,
  tierSettled: false,
};

/** How long `ready` waits on the tier's measurement, once the scene is being
 *  drawn: a hundred and twenty frames is two seconds on a device that keeps
 *  time, and a device that does not is not kept waiting for a verdict. */
export const TIER_WAIT_MS = 3600;

/** Frames the settled tier's own chain is drawn for before the scene is shown:
 *  its passes are built on the first, and the lens gathers from the second. */
export const TIER_SETTLE_FRAMES = 10;

/** Frames a set is drawn under the dark before it is called ready: its shadow
 *  maps, its first uploads, the six faces of the hall's own probe. */
export const HOLD_FRAMES = 8;

/** Seconds for the dark to go, once what is under it is ready. */
export const HOLD_LIFT_S = 0.7;

/** A set that has not been built in this long is shown as it is: a picture
 *  that compiles on its first frame, as every one did, and not a dark page. */
export const WARM_CEILING_MS = 12000;

/** How long the estate's build waits for its sky to be bound (its programs
 *  are keyed on having one: built without, they are all built again). */
export const SKY_WAIT_MS = 4000;

/** Frames the warm queue has to stand empty before a hall on a page is shown:
 *  its table, its tables' models and its stage join the queue as they mount. */
export const WARM_SETTLE_FRAMES = 6;

/** The hold, a frame on. */
export function stepHold(hold: number, ready: boolean, delta: number): number {
  if (!ready) return 1;
  if (!(delta > 0)) return hold;
  return Math.max(0, hold - delta / HOLD_LIFT_S);
}
