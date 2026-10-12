// apps/public/src/components/folio/planView.ts
//
// The arithmetic of looking at a sheet closely (PlanViewer.tsx): how large it
// lies when the whole of it is in the frame, how much closer it can honestly
// be brought, and where it may be moved to. Pure, so it can be held to
// account without a browser.

export interface Size {
  w: number;
  h: number;
}

/** A view of the sheet: `scale` 1 is the whole sheet in the frame; `x`, `y`
 *  are how far its centre stands from the frame's, in pixels. */
export interface View {
  scale: number;
  x: number;
  y: number;
}

export const WHOLE: View = { scale: 1, x: 0, y: 0 };

/** The sheet's size when the whole of it lies in the frame, a margin clear. */
export function fitSize(frame: Size, sheet: Size, margin = 0): Size {
  const w = Math.max(1, frame.w - 2 * margin);
  const h = Math.max(1, frame.h - 2 * margin);
  const k = Math.min(w / sheet.w, h / sheet.h);
  return { w: sheet.w * k, h: sheet.h * k };
}

/**
 * How close it can come. To twice its own pixels: at that a plot's number is
 * a comfortable size on the scan the site holds, and past it there is nothing
 * more to read, only larger blur. Never less than twice the whole, so that a
 * sheet already shown near its own size can still be leaned into.
 */
export function maxScale(frame: Size, sheet: Size, margin = 0): number {
  const fit = fitSize(frame, sheet, margin);
  return Math.max(2, (2 * sheet.w) / fit.w);
}

/** Keep the sheet in the frame: it may not be moved further than brings its
 *  own edge to the frame's (and not at all on an axis it does not fill). */
export function clampView(v: View, frame: Size, sheet: Size, margin = 0): View {
  const fit = fitSize(frame, sheet, margin);
  const scale = Math.min(maxScale(frame, sheet, margin), Math.max(1, v.scale));
  const mx = Math.max(0, (fit.w * scale - frame.w) / 2);
  const my = Math.max(0, (fit.h * scale - frame.h) / 2);
  // (+ 0: a sheet that cannot move on an axis stands at 0 on it, not at -0)
  return { scale, x: Math.min(mx, Math.max(-mx, v.x)) + 0, y: Math.min(my, Math.max(-my, v.y)) + 0 };
}

/**
 * Come closer (or go back) by `factor`, holding still the point of the sheet
 * that is under `at` (pixels from the frame's centre): what the hand or the
 * pointer is on stays under it.
 */
export function zoomAt(v: View, factor: number, at: { x: number; y: number }, frame: Size, sheet: Size, margin = 0): View {
  const scale = Math.min(maxScale(frame, sheet, margin), Math.max(1, v.scale * factor));
  const k = scale / v.scale;
  return clampView({ scale, x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k }, frame, sheet, margin);
}

/** Move by a drag of (dx, dy) pixels. */
export function panBy(v: View, dx: number, dy: number, frame: Size, sheet: Size, margin = 0): View {
  return clampView({ scale: v.scale, x: v.x + dx, y: v.y + dy }, frame, sheet, margin);
}
