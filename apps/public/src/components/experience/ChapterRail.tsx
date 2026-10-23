'use client';

// apps/public/src/components/experience/ChapterRail.tsx
//
// THE RAIL: where you are, and the way to anywhere else.
//
// A column of dots down the frame's right edge, one a chapter, with a gilt
// marker that travels it as the page is scrolled. It answers the two questions
// a long scroll never does on its own — how far through this am I, and how do
// I get to the part I want — without a visitor having to open anything.
//
//   IT SAYS WHERE YOU ARE. The marker is not a highlight that hops from dot to
//   dot: it moves continuously, and it stands exactly on a dot when the page is
//   where a press on that dot would have taken it (railMath.ts). The dots
//   behind it are gilt, the ones ahead ivory.
//
//   IT TAKES YOU THERE. Every dot is a real link to its chapter's own anchor,
//   so it works with no script and no canvas, and with a keyboard. With the
//   film running a press does better than an anchor: to a neighbouring chapter
//   the page glides and the camera follows its path; to anything further the
//   film CUTS — the dark closes, the camera is placed, the dark lifts — because
//   the camera is sprung toward the scroll, and a scroll that jumped eight
//   chapters would fly it there through the house (doorway.ts, cutTo).
//
//   IT NAMES THE CHAPTERS ONLY WHEN ASKED. Pointed at, or reached by keyboard,
//   the names stand out to the left of their dots, on a density that comes up
//   with them at the frame's edge — density, as the lens wears under the film's
//   copy, never a blur and never a panel. On a touch screen the first touch
//   opens the names and the second chooses one.
//
// TWO KINDS OF PAGE, ONE RAIL. On the film its stops are the film's chapters,
// given by the page in the film's own fractions. On a reading page they are
// that page's sections, found in the document (`data-rail`), in pixels.
//
// One rAF, coalesced from the scroll event; the marker is a custom property on
// the element, so scrolling costs no render. React state changes only when the
// current stop does.
//
// AND ON AN UPRIGHT FRAME IT STEPS OUT OF THE PICTURE AT REST (the forensic
// audit of 2026-10-09, #113: "The dots run down over the house on the cover and
// over the building's right side on a tablet, and at the film's end the
// telephone number runs into the dots' ring at the right edge ... Expected:
// dots clear of the picture's subject and of text"). A phone's frame has no
// edge to spare: the house, the site models and the sign-off all reach the
// right side of it. So on the film, once the page has been still for a moment
// (`RAIL_REST_MS`), the rail is marked as resting, and on a frame that stands
// upright it fades out of the picture (globals.css, THE RAIL); the first
// movement brings it back, saying where you are as you go. It is still there to
// be touched: a touch where it stands opens the names, as the first touch
// always has, and that brings it back too. A wide frame keeps it in view.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { lenisInstance } from './SmoothScroll';
import { measureFilmSpan } from './filmTrack';
import { cutTo, glideOnFilm } from './doorway';
import { CROSSOVER, TRACK_VH } from './journey';
import { RAIL_END, railCurrent, railGlideSeconds, railMove, railPosition, type RailStop } from './railMath';

interface FilmProps {
  mode: 'film';
  /** The film's chapters, in order, in the film's own fractions. A stop whose
   *  `at` is RAIL_END stands for the end of the page. */
  stops: RailStop[];
  label?: string;
}
interface PageProps {
  mode: 'page';
  /** Changes when the page does, so the sections are found again. */
  pageKey?: string;
  label?: string;
}

/** One notch — a third of a viewport — as a fraction of the film's track. */
const NOTCH = 100 / 3 / TRACK_VH;

/** How long the film must be still before the rail rests, ms; and, the first
 *  time, how long it is shown on arrival, so a visitor sees that it is there. */
export const RAIL_REST_MS = 1600;
export const RAIL_FIRST_MS = 4000;

export function ChapterRail(props: FilmProps | PageProps) {
  const nav = useRef<HTMLElement>(null);
  const [stops, setStops] = useState<RailStop[]>(props.mode === 'film' ? props.stops : []);
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState(false);
  const [resting, setResting] = useState(false);
  // DRAWN ON THE DOCUMENT, NOT IN THE PAGE. The page's content and its footer
  // are two stacking contexts of the same order, the footer the later: a rail
  // that lived in the page was under the footer where the two met — there to
  // be seen at the film's end, and not there to be pressed.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  /** The stops as the scroll handler reads them: resolved to this page. */
  const live = useRef<RailStop[]>([]);
  const film = props.mode === 'film';
  const filmStops = film ? props.stops : null;
  const pageKey = !film ? props.pageKey : undefined;

  // ── the stops, resolved against this document ───────────────────────────
  const resolve = useCallback(() => {
    if (filmStops) {
      const span = measureFilmSpan();
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const end = max / span;
      live.current = filmStops.map((s) =>
        s.at === RAIL_END
          ? // The end of the page: current once the last frame's sign-off is up.
            { ...s, at: end, from: Math.max(s.from, end - (window.innerHeight * 0.9) / span) }
          : s,
      );
      return;
    }
    const found: RailStop[] = [];
    const lead = window.innerHeight * 0.32;
    document.querySelectorAll<HTMLElement>('[data-rail]').forEach((el) => {
      if (!el.id) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      found.push({
        id: el.id,
        label: el.dataset.rail || el.id,
        from: Math.max(0, top - lead),
        at: Math.max(0, top - (el.dataset.railOffset ? Number(el.dataset.railOffset) : 0)),
      });
    });
    // The page cannot scroll past its end: a last section shorter than the
    // frame is reached at the page's foot, not at a place below it.
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    for (const s of found) {
      s.at = Math.min(s.at, max);
      s.from = Math.min(s.from, Math.max(0, max - 2));
    }
    live.current = found;
    setStops((prev) =>
      prev.length === found.length && prev.every((p, i) => p.id === found[i].id && p.label === found[i].label)
        ? prev
        : found.map((s) => ({ ...s })),
    );
  }, [filmStops]);

  // ── scroll -> the marker, and the current stop ──────────────────────────
  useEffect(() => {
    let frame = 0;
    let resizeTimer = 0;
    const place = () => (filmStops ? window.scrollY / measureFilmSpan() : window.scrollY);
    const apply = () => {
      frame = 0;
      const el = nav.current;
      const list = live.current;
      if (!el || list.length === 0) return;
      const at = place();
      el.style.setProperty('--rail-pos', railPosition(list, at).toFixed(3));
      setCurrent(railCurrent(list, at));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const settle = () => {
      resolve();
      onScroll();
    };
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(settle, 150);
    };
    settle();
    // The page's height is not final at mount: fonts, images and (on the film)
    // the marker that says where its track ends all land after it.
    const late = [300, 1200, 3000].map((ms) => window.setTimeout(settle, ms));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    ro?.observe(document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
      late.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(resizeTimer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [filmStops, resolve, pageKey, mounted]);

  // ── at rest (the film only): see the head of this file ──────────────────
  useEffect(() => {
    if (!film) return;
    let timer = window.setTimeout(() => setResting(true), RAIL_FIRST_MS);
    const moved = () => {
      setResting(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setResting(true), RAIL_REST_MS);
    };
    window.addEventListener('scroll', moved, { passive: true });
    return () => {
      window.removeEventListener('scroll', moved);
      window.clearTimeout(timer);
    };
  }, [film]);

  // ── a touch screen: the first touch opens the names ─────────────────────
  useEffect(() => {
    if (!open) return;
    const startY = window.scrollY;
    const away = (e: PointerEvent) => {
      if (!nav.current?.contains(e.target as Node)) setOpen(false);
    };
    // The names go as soon as the page is scrolled: they were asked for to
    // choose a chapter, and a scroll is the choice not to. (They used to wait
    // for an eighth of a viewport, and on a touch screen were then held open
    // by the touch's own `:hover` whatever this did: globals.css, THE RAIL.)
    const moved = () => {
      if (Math.abs(window.scrollY - startY) > 12) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    window.addEventListener('scroll', moved, { passive: true });
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      window.removeEventListener('scroll', moved);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  // ── a press ──────────────────────────────────────────────────────────────
  const go = (index: number, e: React.MouseEvent<HTMLAnchorElement>) => {
    // Modified clicks keep their browser meaning.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    // No hover on a touch screen: the first touch shows what the dots are.
    if (!open && window.matchMedia('(hover: none)').matches) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    setOpen(false);
    // A press made with a pointer is finished with the rail: the names go
    // back, as they would have if the pointer had left. (A keyboard's press
    // keeps its focus, and the names with it.)
    if (e.detail > 0) e.currentTarget.blur();
    const list = live.current;
    const stop = list[index];
    if (!stop) return;

    if (filmStops) {
      const span = measureFilmSpan();
      const now = window.scrollY / span;
      // Past the film's end the camera holds its last frame: anything from
      // there, or to there, is its own short scroll or a cut.
      const kind = railMove(railCurrent(list, now), index, now, stop.at, CROSSOVER);
      const notches = (stop.at - now) / NOTCH;
      if (kind === 'glide' && glideOnFilm(stop.at, railGlideSeconds(notches))) {
        e.preventDefault();
        return;
      }
      if (cutTo(stop.at)) {
        e.preventDefault();
        return;
      }
      // No film on this machine (no WebGL): the page is still a page.
      e.preventDefault();
      window.scrollTo({ top: Math.round(stop.at * span) + 2 });
      return;
    }

    e.preventDefault();
    const y = Math.round(stop.at);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (lenisInstance && !reduced) {
      const distance = Math.abs(y - window.scrollY) / Math.max(1, window.innerHeight);
      lenisInstance.scrollTo(y, {
        duration: Math.min(1.8, Math.max(0.7, distance * 0.45)),
        easing: (t: number) => 1 - (1 - t) ** 3,
      });
    } else {
      window.scrollTo({ top: y });
    }
    // The address names the section, as an anchor's would have.
    window.history.replaceState(window.history.state, '', `#${stop.id}`);
  };

  if (!mounted || stops.length < 2) return null;

  return createPortal(
    <nav
      ref={nav}
      aria-label={props.label ?? (film ? 'Chapters of the film' : 'On this page')}
      // (`film-stage` on the film: the rail is sized in the frame's own unit,
      // like everything else on that picture, and takes the frame's edge.)
      className={'rail' + (film ? ' film-stage' : ' folio-stage') + (open ? ' is-open' : '')}
      data-rail-mode={props.mode}
      data-rail-resting={resting && !open ? '' : undefined}
      style={{ ['--rail-n' as string]: stops.length }}
    >
      <span aria-hidden className="rail-shade" />
      <span aria-hidden className="rail-track">
        <i />
      </span>
      <ol className="rail-list">
        {stops.map((s, i) => (
          <li key={s.id} className="rail-item" data-state={i < current ? 'past' : i === current ? 'current' : 'ahead'}>
            <a href={`#${s.id}`} aria-current={i === current ? 'step' : undefined} onClick={(e) => go(i, e)}>
              <span className="rail-label">{s.label}</span>
              <span aria-hidden className="rail-dot" />
            </a>
          </li>
        ))}
      </ol>
      <span aria-hidden className="rail-marker" />
    </nav>,
    document.body,
  );
}
