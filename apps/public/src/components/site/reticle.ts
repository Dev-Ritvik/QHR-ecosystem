// apps/public/src/components/site/reticle.ts
//
// WHEN THE CURSOR IS DRAWN (the user's sheet, 2026-11-01; ReticleDrawing.tsx draws it).
//
// Apart from the drawing so its shell (ReticleCursor.tsx) can ask without loading it.

/** Only with a pointer that hovers, and never over a forced palette, whose
 *  system cursor is part of what the visitor asked for. */
export const RETICLE_MEDIA = '(hover: hover) and (pointer: fine) and (forced-colors: none)';

/** Where a caret is placed: these keep the system's I-beam and the drawing
 *  stands aside. A ring round a line of type being edited hides the line. */
export const RETICLE_TEXT =
  'input:not([type="checkbox"], [type="radio"], [type="submit"], [type="button"], [type="hidden"]), textarea, [contenteditable="true"]';

export function reticleOnField(el: Element | null): boolean {
  return !!el?.closest(RETICLE_TEXT);
}
