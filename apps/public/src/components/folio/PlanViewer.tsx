'use client';

// apps/public/src/components/folio/PlanViewer.tsx
//
// A SHEET, LOOKED AT CLOSELY, ON THE PAGE IT IS ON.
//
// The forensic audit of 2026-10-09 (#64): "The control opens the bare JPEG in
// a new browser tab, with no way back to the site ... Its label is a square
// dark chip found nowhere else on the site. Expected: a viewer inside the
// page with zoom and pan."
//
// So a plan opens over its own page: the whole sheet in the frame, brought
// closer by the wheel, by two fingers, by a double press or by the two
// controls at the foot, and moved by dragging it or with the arrow keys.
// Escape, or "Close", puts it away, and the page is where it was left. It is
// the browser's own modal dialog, so the page behind is inert while the sheet
// is up, the focus is kept inside it and handed back when it closes.
//
// THE LINK STILL WORKS AS A LINK. With no script the sheet opens as the file
// it is; so does a press with a modifier or the middle button, for whoever
// wants it in a tab of its own.
//
// HOW CLOSE: to twice the scan's own pixels and no further (planView.ts). The
// sheets the site holds are 1600 pixels wide. When the client's originals
// arrive (the audit's #62) a larger file is this component's `src` and
// nothing else changes.
//
// The label is the page's own quiet action, under the sheet and off it (it
// was a chip over the sheet's corner, shown on hover).

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { WHOLE, clampView, fitSize, maxScale, panBy, zoomAt, type Size, type View } from './planView';

/** Clear ground round the whole sheet, pixels. */
const MARGIN = 24;
/** One press of a control, and one of an arrow key. */
const STEP = 1.6;
const NUDGE = 96;

export function PaperLink({ src, w, h, alt, children }: { src: string; w: number; h: number; alt: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const show = useCallback(() => {
    const d = dialog.current;
    if (!d || typeof d.showModal !== 'function') return false;
    setOpen(true);
    if (!d.open) d.showModal();
    return true;
  }, []);

  return (
    <>
      <a
        className="folio-paper"
        href={src}
        aria-haspopup="dialog"
        aria-label={`${alt}: look closer`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          if (show()) e.preventDefault();
        }}
      >
        {children}
      </a>
      {/* The same action in words, for the eye: the sheet itself is the
          control a keyboard and a reader reach. */}
      <button type="button" className="cta-quiet folio-paper-closer" tabIndex={-1} aria-hidden onClick={show}>
        <span className="cta-quiet-label">Look closer</span>
      </button>
      <dialog ref={dialog} className="plan-viewer" aria-label={alt} data-lenis-prevent onClose={() => setOpen(false)}>
        {open ? <Viewer src={src} sheet={{ w, h }} alt={alt} onClose={() => dialog.current?.close()} /> : null}
      </dialog>
    </>
  );
}

function Viewer({ src, sheet, alt, onClose }: { src: string; sheet: Size; alt: string; onClose: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Size>({ w: 0, h: 0 });
  const [view, setView] = useState<View>(WHOLE);
  const [held, setHeld] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const spread = useRef(0);

  // The frame the sheet lies in, as the window has it.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setFrame({ w: r.width, h: r.height });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (frame.w > 0) setView((v) => clampView(v, frame, sheet, MARGIN));
  }, [frame, sheet]);

  // From the frame's centre, where the view is measured from.
  const fromCentre = useCallback((x: number, y: number) => {
    const r = stage.current?.getBoundingClientRect();
    return r ? { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 } : { x: 0, y: 0 };
  }, []);

  // The wheel brings it closer under the pointer. (Not passive: the page
  // behind must not take the turn of the wheel.)
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const at = { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView((v) => zoomAt(v, factor, at, { w: r.width, h: r.height }, sheet, MARGIN));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [sheet]);

  const gap = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    spread.current = pointers.current.size === 2 ? gap() : 0;
    setHeld(true);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const was = pointers.current.get(e.pointerId);
    if (!was) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size === 1) {
      setView((v) => panBy(v, now.x - was.x, now.y - was.y, frame, sheet, MARGIN));
      return;
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = gap();
      if (spread.current > 0 && d > 0) {
        const at = fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2);
        const factor = d / spread.current;
        setView((v) => zoomAt(v, factor, at, frame, sheet, MARGIN));
      }
      spread.current = d;
    }
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    spread.current = 0;
    if (pointers.current.size === 0) setHeld(false);
  };

  const closer = (factor: number, at = { x: 0, y: 0 }) => setView((v) => zoomAt(v, factor, at, frame, sheet, MARGIN));

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const move: Record<string, [number, number]> = {
      ArrowLeft: [NUDGE, 0],
      ArrowRight: [-NUDGE, 0],
      ArrowUp: [0, NUDGE],
      ArrowDown: [0, -NUDGE],
    };
    if (e.key === '+' || e.key === '=') closer(STEP);
    else if (e.key === '-' || e.key === '_') closer(1 / STEP);
    else if (e.key === '0') setView(WHOLE);
    else if (move[e.key]) setView((v) => panBy(v, move[e.key][0], move[e.key][1], frame, sheet, MARGIN));
    else return;
    e.preventDefault();
  };

  const fit = fitSize(frame, sheet, MARGIN);
  const most = maxScale(frame, sheet, MARGIN);
  const whole = view.scale <= 1.001;

  return (
    <div className="plan-viewer-room" onKeyDown={onKey}>
      <div
        ref={stage}
        className={'plan-viewer-stage' + (held ? ' is-held' : '')}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={(e) => (whole ? closer(2.5, fromCentre(e.clientX, e.clientY)) : setView(WHOLE))}
      >
        {frame.w > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            draggable={false}
            style={{
              width: fit.w,
              height: fit.h,
              transform: `translate(calc(-50% + ${view.x.toFixed(1)}px), calc(-50% + ${view.y.toFixed(1)}px)) scale(${view.scale.toFixed(4)})`,
            }}
          />
        ) : null}
      </div>
      <div className="plan-viewer-bar">
        <button type="button" className="cta-quiet" onClick={onClose}>
          <span className="cta-quiet-label">Close</span>
        </button>
        <span className="plan-viewer-set">
          <button type="button" className="cta-quiet" onClick={() => closer(1 / STEP)} disabled={whole}>
            <span className="cta-quiet-label">Further</span>
          </button>
          <button type="button" className="cta-quiet" onClick={() => closer(STEP)} disabled={view.scale >= most - 0.001}>
            <span className="cta-quiet-label">Closer</span>
          </button>
          <button type="button" className="cta-quiet" onClick={() => setView(WHOLE)} disabled={whole}>
            <span className="cta-quiet-label">Whole sheet</span>
          </button>
        </span>
      </div>
    </div>
  );
}
