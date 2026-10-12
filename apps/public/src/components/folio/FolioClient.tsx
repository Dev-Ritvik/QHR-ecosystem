'use client';

// apps/public/src/components/folio/FolioClient.tsx
//
// The four things a folio needs a browser for, as one leaf that renders
// nothing of its own but the rail:
//
//   THE RAIL of the page's sections (ChapterRail, in its page mode): the same
//   dots the film has for its chapters, here for every section a page names
//   with `data-rail`.
//
//   THE REVEAL. What is read develops as it comes into the frame, as the
//   film's copy develops in place: an observer marks each `data-reveal`
//   element once it is a little way into the viewport (`data-in`), and the
//   stylesheet does the rest. Marked once and left — text that has been read
//   does not perform again on the way back up. With no script nothing is
//   hidden (the stylesheet's rule is inside `@media (scripting: enabled)`).
//
//   THE HEADER'S GROUND. Over a plate the header is air, as it is over the
//   film; over the sheets it stands on the sheets' own dark. Which of the two
//   it is over is a fact about the scroll, written to the document
//   (`data-folio`), and the header's stylesheet reads it.
//
//   THE PICTURE'S BAND. On a screen held upright a plate's words stand under
//   its picture, and the picture has the band between the header's foot and
//   their first line. How tall that is depends on the words and on the
//   screen, so the page measures it and the camera's rig stands the subject
//   in it (components/experience/plateBand.ts).

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChapterRail } from '@/components/experience/ChapterRail';
import { pageMove, plateBand } from '@/components/experience/plateBand';

/**
 * THE TAB'S TITLE, SAID AGAIN. A "not found" raised inside a layout (a layout
 * the register does not hold, a plot that does not exist) is drawn by Next in
 * the browser, and its redraw drops the document's title: the tab read as an
 * empty string (the forensic audit of 2026-10-09, #4). The folio it draws
 * carries this, which puts the title back. Renders nothing.
 */
export function TabTitle({ title }: { title: string }) {
  useEffect(() => {
    if (document.title !== title) document.title = title;
  }, [title]);
  return null;
}

export function FolioChrome() {
  const pathname = usePathname() || '/';

  // ── the reveal ──────────────────────────────────────────────────────────
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.folio [data-reveal]'));
    if (els.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.setAttribute('data-in', ''));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).setAttribute('data-in', '');
          io.unobserve(e.target);
        }
      },
      // A little way in, not at the edge: a line that develops on the very
      // last pixel of the frame is developing where nobody is looking.
      { rootMargin: '0px 0px -9% 0px', threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    // Nothing may stay hidden because an observer never fired (a print, a
    // tab opened in the background and read much later).
    const safety = window.setTimeout(() => {
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.setAttribute('data-in', '');
      }
    }, 2500);
    return () => {
      io.disconnect();
      window.clearTimeout(safety);
    };
  }, [pathname]);

  // ── the header's ground ─────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    const plate = document.querySelector<HTMLElement>('[data-folio-plate]');
    const words = plate ? plate.querySelector<HTMLElement>('.folio-plate-words') : null;
    const header = document.querySelector<HTMLElement>('.site-header');
    let frame = 0;
    let cut = '';
    const apply = () => {
      frame = 0;
      // Over the plate until its foot is nearly at the header's.
      const over = plate ? plate.getBoundingClientRect().bottom > 96 : false;
      const next = over ? 'plate' : 'sheet';
      if (root.dataset.folio !== next) root.dataset.folio = next;
      // WHERE THE PLATE'S WORDS MEET THE HEADER. Over a plate the header has
      // no ground, so whatever scrolls up under it is read through its mark:
      // the cue at a plate's foot was printed across the wordmark on the
      // first notch of every page (the forensic audit of 2026-10-09, #73).
      // The words are dissolved from a little under the bar's foot upward —
      // the film's own rule for its copy (ChapterFade). Said in the block's
      // own measure, from its top: the stylesheet does the rest.
      if (words) {
        const bar = header ? header.offsetHeight : 62;
        const v = `${Math.round(bar + 4 - words.getBoundingClientRect().top)}px`;
        if (v !== cut) {
          words.style.setProperty('--cut', v);
          cut = v;
        }
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
      delete root.dataset.folio;
    };
  }, [pathname]);

  // ── the picture's band ──────────────────────────────────────────────────
  useEffect(() => {
    const plate = document.querySelector<HTMLElement>('[data-folio-plate]');
    const copy = plate ? plate.querySelector<HTMLElement>('.folio-plate-copy') : null;
    if (!plate || !copy) {
      plateBand.current = null;
      return;
    }
    const header = document.querySelector<HTMLElement>('.site-header');
    let frame = 0;
    const measure = () => {
      frame = 0;
      // Where the page's move ends: its first window, in the middle of the
      // frame (plateBand.ts, pageMove).
      const opening = document.querySelector<HTMLElement>('.folio .folio-window');
      if (opening) {
        const r = opening.getBoundingClientRect();
        pageMove.end = Math.max(1, r.top + window.scrollY + r.height / 2 - window.innerHeight / 2);
      } else {
        pageMove.end = null;
      }
      plateBand.current = {
        // (The header is fixed to the frame's top: its height is its foot.)
        top: header ? header.offsetHeight : 0,
        // Where the words begin with the page unscrolled. The plate is the
        // first thing on the page, so that is their place in the frame a
        // visitor opens on, wherever the page happens to be scrolled to now.
        bottom: copy.getBoundingClientRect().top + window.scrollY,
      };
    };
    const ask = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(ask);
    if (ro) {
      ro.observe(plate);
      ro.observe(copy);
      // (the sheets over the window: a list that arrives, a picture that loads)
      const page = document.querySelector<HTMLElement>('main.folio');
      if (page) ro.observe(page);
    }
    window.addEventListener('resize', ask);
    // The title's face arrives after the first paint, and a line more or
    // less of it moves the first line of the block.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ask).catch(() => {});
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', ask);
      if (frame) cancelAnimationFrame(frame);
      plateBand.current = null;
      pageMove.end = null;
    };
  }, [pathname]);

  return <ChapterRail mode="page" pageKey={pathname} />;
}
