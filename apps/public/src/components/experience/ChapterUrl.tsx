'use client';

// apps/public/src/components/experience/ChapterUrl.tsx
//
// The journey's address bar: scroll -> URL, and URL -> scroll.
//
// ---------------------------------------------------------------------------
// WHY A FRAGMENT AND NOT A PATH
// ---------------------------------------------------------------------------
//
// The obvious reading of "when the damped progress crosses a node threshold,
// replaceState" is to write a different PATH — to swap `/` for `/about` as the
// camera reaches the About beat. This build must not do that, and the reason is
// structural rather than stylistic.
//
// `/` and `/about` are different documents. The home page is one continuous
// film with nine chapters; `/about` is a surface with its own copy, its own
// metadata and its own place in the route registry. Writing `/about` into the
// bar while the home page's DOM is still on screen would mean the URL and the
// document disagree — the visitor could reload and land somewhere that looks
// nothing like what they were just reading, a crawler following the bar would
// index the wrong markup, and back would restore a state that never existed.
// That is the DOM/URL divergence the phase's own stop conditions name.
//
// A fragment is the honest form of the same idea. `#constellation` is a real,
// linkable address for a moment INSIDE this document; it costs no server
// request; the browser's own history handles it; and because each chapter
// section carries the matching `id`, it degrades to a plain anchor that works
// with JavaScript switched off. The route-level half of the URL contract —
// arriving at /about and having the camera already be at the approach — is
// already handled elsewhere, by placeForRoute in the route registry.
//
// ---------------------------------------------------------------------------
// WHY replaceState AND NOT pushState
// ---------------------------------------------------------------------------
//
// pushState per chapter would put nine entries in the history stack for one
// page. Back would then step the visitor through the film in reverse, one
// chapter per press, before finally leaving — which is not "moving through the
// cinematic world", it is a trap. replaceState keeps the stack meaning what a
// visitor expects (back leaves the page) while still keeping the bar truthful.
//
// It also buys state restoration for nothing: because the bar always carries
// the chapter, leaving the film and coming back through history returns the
// visitor to the chapter they left rather than to the top.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT INSIDE THE CANVAS
// ---------------------------------------------------------------------------
//
// The camera is the obvious owner of "which chapter are we on", and it is the
// wrong one. The canvas is client-only, tier-gated and absent entirely when
// WebGL is unavailable or the visitor has asked for reduced motion — and every
// one of those visitors still scrolls this page and still deserves a URL that
// says where they are. The chapter boundaries are scroll fractions, scroll is
// the shared input, so this reads scroll directly and works with no scene at
// all.

import { useEffect } from 'react';
import type { Chapter } from './journey';
import { isNavigating } from '@/components/site/RouteVeil';
import { rememberChapter } from '@/components/site/residence';
import { measureFilmSpan } from './filmTrack';

/**
 * How long a chapter must hold before the bar is rewritten.
 *
 * Not smoothing for its own sake. A visitor dragging the scrollbar crosses
 * every boundary in a few hundred milliseconds, and browsers rate-limit
 * history writes — Safari has historically thrown after ~100 in 30 seconds.
 * Waiting for the chapter to settle means a scrub writes once, at the end,
 * instead of nine times on the way.
 */
const SETTLE_MS = 180;

/**
 * How long to keep trying to honour an incoming fragment.
 *
 * The preloader holds `overflow: hidden` on the document until the scene is
 * ready, and a scroll issued under that lock is silently dropped. Rather than
 * couple this to the preloader's internals, it retries until the document is
 * actually scrollable — or gives up, because a visitor who never gets a scene
 * should still get the page at its top rather than an infinite retry.
 */
const RESTORE_WINDOW_MS = 14000;

export function ChapterUrl({ chapters }: { chapters: Chapter[] }) {
  useEffect(() => {
    if (chapters.length === 0) return;

    const idOf = (frac: number): string | null => {
      for (const c of chapters) {
        if (frac >= c.from && frac < c.to) return c.id;
      }
      // Past the last boundary — the film has landed on its final composition
      // and holds there while the footer arrives. That is still the last
      // chapter, not "no chapter".
      return chapters[chapters.length - 1]?.id ?? null;
    };

    // The SAME measure the camera uses (filmTrack.ts). Against the document it
    // put the address a chapter behind the frame on the long track.
    const maxScroll = () => measureFilmSpan();

    // ---- URL -> scroll ---------------------------------------------------
    // Runs first, and only once, so an incoming fragment is honoured before
    // the scroll listener below starts writing over it.
    const wanted = decodeURIComponent(window.location.hash.replace(/^#/, ''));
    const target = chapters.find((c) => c.id === wanted);
    let restoreTimer = 0;
    let restored = !target;

    if (target) {
      const started = Date.now();
      const tryRestore = () => {
        // Under the preloader's `overflow: hidden` a scrollTo is thrown away
        // without error, so wait for the lock to lift rather than issue a
        // scroll into the void. The INLINE style is the right thing to read —
        // it is what the preloader sets, and the computed value is 'visible'
        // both before it locks and after it releases.
        const locked = document.documentElement.style.overflow === 'hidden';
        if (locked && Date.now() - started <= RESTORE_WINDOW_MS) {
          restoreTimer = window.setTimeout(tryRestore, 120);
          return;
        }

        // COOPERATE WITH THE BROWSER RATHER THAN RACE IT.
        //
        // Each chapter section carries its own id, so a load with a fragment
        // gets a native anchor jump for free — and measurement showed that is
        // what actually lands the deep link, landing exactly on the section
        // top. This existed to cover the case where the preloader's lock eats
        // that jump, and in the ordinary case it was scrolling a second time
        // to a slightly different place, fighting the browser for no gain.
        //
        // So: only act if the native jump did NOT happen. If the viewport is
        // already anywhere inside the chapter, leave it exactly where the
        // browser put it.
        const el = document.getElementById(target.id);
        const top = el ? el.offsetTop : Math.round(target.from * maxScroll());
        const bottom = el ? el.offsetTop + el.offsetHeight : Math.round(target.to * maxScroll());
        const y = window.scrollY;
        if (y < top - 8 || y > bottom) {
          window.scrollTo({ top, behavior: 'auto' });
        }
        restored = true;
      };
      tryRestore();
    }

    // ---- scroll -> URL ---------------------------------------------------
    let current = target ? target.id : idOf(0);
    let pending: string | null = null;
    let settleTimer = 0;
    let frame = 0;

    // TWO WRITERS, ONE HISTORY ENTRY: THE BUG THIS GUARD EXISTS FOR.
    //
    // Clicking a project card from a station chapter left the visitor on `/`
    // with the URL reading `/#station-1` and the route veil shut until its
    // watchdog fired — the navigation simply did not happen. Cause: this
    // component's settle timer fired DURING the router's in-flight push and
    // replaceState'd the URL out from under it. The App Router reconciles
    // against window.history, so rewriting the address mid-navigation is not a
    // cosmetic clash; it loses the navigation.
    //
    // The rule is therefore: the moment a click could take this document
    // somewhere else, this stops writing. It is deliberately keyed on the
    // GESTURE rather than on the veil, because the veil does not intercept
    // under reduced motion and Next's own Link handles those clicks — the race
    // exists on that path too.
    const mountPath = window.location.pathname;
    let leaving = false;
    let leaveTimer = 0;

    const write = (id: string) => {
      // A navigation has already committed: this page is on its way out and
      // has no business naming the chapter of a document that is being
      // replaced.
      // isNavigating covers the case a click listener cannot see: a
      // programmatic push, which is how the holograms open a project page.
      if (leaving || isNavigating() || window.location.pathname !== mountPath) return;
      current = id;
      // The FIRST chapter is the bare page. Landing on the home page and
      // seeing `/#hero` in the bar is noise: the document already is the hero.
      const hash = id === chapters[0].id ? '' : `#${id}`;
      const next = window.location.pathname + window.location.search + hash;
      if (next === window.location.pathname + window.location.search + window.location.hash) return;
      // history.state is passed THROUGH rather than replaced. The App Router
      // keeps its own routing state there, and handing replaceState a null
      // state silently breaks back/forward for the whole segment — the kind of
      // fault that only shows up two navigations later.
      window.history.replaceState(window.history.state, '', next);
      // The bar carries the chapter only while the film is on screen; the
      // moment a visitor opens a project page it is the project's URL. This is
      // what survives that trip and lets the header offer a resume rather than
      // a reset.
      rememberChapter(id);
    };

    const sample = () => {
      frame = 0;
      if (!restored) return; // do not fight our own restore
      const id = idOf(window.scrollY / maxScroll());
      if (!id || id === current || id === pending) return;
      pending = id;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (pending) write(pending);
        pending = null;
      }, SETTLE_MS);
    };

    // rAF-coalesced: a scroll event can fire many times per frame, and this
    // reads layout.
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(sample);
    };

    /**
     * Capture phase, and it never preventDefaults — this only decides whether
     * WE may keep writing, and must not change what the click does.
     */
    const onLinkClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!(a instanceof HTMLAnchorElement)) return;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('/')) return;
      const url = new URL(href, window.location.origin);
      // Same document, different fragment — that is this component's own
      // business and must not silence it.
      if (url.pathname === mountPath) return;

      leaving = true;
      pending = null;
      window.clearTimeout(settleTimer);

      // Release if the navigation never happens. A cancelled or failed push
      // would otherwise leave the address bar frozen for the rest of the
      // visit, which is a quieter fault than the one above but still a fault.
      window.clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(() => {
        if (window.location.pathname === mountPath) leaving = false;
      }, 3000);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onLinkClick, true);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onLinkClick, true);
      window.clearTimeout(settleTimer);
      window.clearTimeout(restoreTimer);
      window.clearTimeout(leaveTimer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [chapters]);

  return null;
}
