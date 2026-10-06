// apps/public/src/components/experience/filmShares.ts
//
// HOW THE FILM'S LENGTH IS SHARED OUT: two sets of numbers the camera's paths
// and the page's timeline both read.
//
// THEY LIVE HERE, AND NOT IN THE PATHS, FOR THE PAGE'S SAKE. journey.ts lays
// the page out from them, and the page's own controls reach journey.ts through
// doorway.ts; while these were declared in cameraPath.ts and interiorPath.ts,
// that reach pulled both path modules — and three.js with them — into the home
// page's own script: 114 kB where 15 does (measured on the build of
// 2026-10-06, when the paths were put back). The paths re-export them, with
// the account of each where it has always been: FILM_SHARE in cameraPath.ts,
// CHAPTER_WEIGHTS in interiorPath.ts.
//
// Pure numbers: nothing is imported here.

/** The first three chapters' share of the exterior leg (cameraPath.ts). */
export const FILM_SHARE = 0.625;

/** How much of the interior leg each chapter gets (interiorPath.ts). */
export const CHAPTER_WEIGHTS = {
  /** Threshold, establishing shot and the turn onto the first station. */
  establish: 0.26,
  /** Each published station. */
  station: 0.19,
  /** Withdrawal, the foot of the stairs, and the portrait. */
  portrait: 0.18,
  /**
   * THE MAP TABLE. The film's last chapter: down from the portrait into the
   * court of the stair, onto the land the house is here to sell, carved into
   * a table (MapTable.tsx). Its id stays `city` — the chapter's address and
   * the resume link are unchanged — though the land is no longer out of doors.
   */
  city: 0.2,
} as const;
