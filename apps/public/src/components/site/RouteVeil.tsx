'use client';

// apps/public/src/components/site/RouteVeil.tsx
//
// ONE transition device for the whole public site.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS FOR
// ---------------------------------------------------------------------------
//
// The build already had a veil, and it was not this one. The blackout in
// WorldCanvas covers the SCROLL crossover — the last metre of the approach and
// the first moment inside the hall — and it is driven by scroll position, lives
// inside the canvas, and exists only on the home page. Every actual navigation
// on the site had no visual bridge at all: leaving the film for a project page
// swapped one document for another with nothing in between, so the answer to
// "why am I moving there" was "the route changed", which is the failure the
// route-transition gate describes.
//
// This is the missing half. It is DOM rather than canvas, deliberately, because
// it has to survive the thing the canvas cannot: navigations that unmount the
// canvas entirely (into /projects, which is outside the experience segment) and
// navigations on pages that never had one.
//
// ---------------------------------------------------------------------------
// THE RULE THAT MATTERS MORE THAN THE LOOK
// ---------------------------------------------------------------------------
//
// A transition device sits in front of every navigation on the site. If it
// hangs, the visitor is behind an opaque screen with no way out, and that is
// strictly worse than no transition at all. So:
//
//   * the veil OPENS on a watchdog no matter what happens — navigation
//     rejected, route error, a push that never resolves;
//   * anything it cannot handle confidently is not intercepted at all, and
//     falls through to the browser's own behaviour;
//   * reduced motion skips it entirely rather than approximating it.
//
// Every one of those is a bias toward "navigation works" over "navigation is
// pretty".
//
// ---------------------------------------------------------------------------
// WHY A CLICK INTERCEPT
// ---------------------------------------------------------------------------
//
// The App Router gives an arrival signal (pathname changes) but no departure
// one, and a transition needs both halves — a veil that only opens is a flash
// of black on arrival. The departure has to come from the gesture, so this
// listens for link clicks in the capture phase, plays the close, and then hands
// the same href to the router. Programmatic navigations — the holograms, which
// call router.push directly — go through `veiledPush` for the same treatment.

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/** Close, swap, open. Roughly the brief's 680 ms, split so the closing half is
 *  brisk (it is dead time the visitor did not ask for) and the opening half is
 *  slower (it is the new page arriving, which is the part worth watching). */
const CLOSE_MS = 280;
const OPEN_MS = 400;

/**
 * Absolute ceiling on how long the veil may stay shut.
 *
 * Not a timing choice — a safety one. If the navigation never completes, this
 * is the only thing between the visitor and a permanently black screen.
 */
const WATCHDOG_MS = 2600;

type Phase = 'idle' | 'closing' | 'closed' | 'opening';

/** Set by the mounted component so non-React callers can request a veiled
 *  navigation. One instance, in the site layout, so this is never ambiguous. */
let controller: { go: (href: string) => void } | null = null;

/**
 * True from the moment a navigation is requested until it lands.
 *
 * Published because anything else that writes to history has to stand down
 * while a navigation is in flight. The App Router reconciles against
 * window.history, so a second writer during a push does not merely clash — it
 * loses the navigation. ChapterUrl learned that the hard way: its 180 ms
 * settle timer fired inside a router.push and left the visitor on the home
 * page with the veil shut and the URL reading a chapter it had just left.
 *
 * A link click is visible to anyone listening for clicks, but a programmatic
 * push — the holograms — is not, which is why this is published rather than
 * inferred from the DOM.
 */
let navigating = false;

/** Whether a route change is currently in flight. */
export function isNavigating(): boolean {
  return navigating;
}

/**
 * Navigate with the veil, from outside React.
 *
 * The fallback is a real navigation rather than a silent no-op: if the veil is
 * somehow not mounted, the visitor still gets where they asked to go.
 */
export function veiledPush(href: string) {
  if (controller) controller.go(href);
  else if (typeof window !== 'undefined') window.location.assign(href);
}

/**
 * Should this click be taken over?
 *
 * Everything here is a reason NOT to intercept, and the list is deliberately
 * conservative — a link this misjudges is a broken link.
 */
function interceptable(e: MouseEvent): string | null {
  if (e.defaultPrevented) return null;
  // Left button only, and no modifier: ctrl/cmd/shift/alt-click all mean
  // "open this somewhere else", which is the browser's job, not ours.
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;

  const el = (e.target as Element | null)?.closest?.('a');
  if (!(el instanceof HTMLAnchorElement)) return null;
  if (el.target && el.target !== '_self') return null;
  if (el.hasAttribute('download')) return null;
  if (el.dataset.noVeil !== undefined) return null;

  const href = el.getAttribute('href');
  if (!href) return null;
  // Anything not a same-origin app path: mailto:, tel:, http(s) elsewhere.
  if (!href.startsWith('/')) return null;
  // Route handlers and files are real document loads (the brochure PDFs go
  // through /api), and a veil over a download is a veil that never opens.
  if (href.startsWith('/api/')) return null;

  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) return null;
  // Same page, different fragment — the chapter anchors and the skip link.
  // Veiling these would black out the screen to scroll a few hundred pixels.
  if (url.pathname === window.location.pathname && url.hash) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;

  return url.pathname + url.search + url.hash;
}

export function RouteVeil() {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>('idle');

  // Refs, because the listeners below are installed once and must see live
  // values without being reinstalled on every phase change.
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;
  const pendingPath = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const open = useCallback(() => {
    clearTimers();
    pendingPath.current = null;
    navigating = false;
    setPhase('opening');
    later(() => setPhase('idle'), OPEN_MS);
  }, []);

  const go = useCallback(
    (href: string) => {
      // Already mid-transition: let the first one finish rather than stacking
      // two navigations and two timelines.
      if (phaseRef.current === 'closing' || phaseRef.current === 'closed') return;

      // Reduced motion still NAVIGATES — it just does not dissolve. This
      // branch exists because the first version registered the controller only
      // when motion was allowed, which left `veiledPush` with no router and
      // sent reduced-motion visitors through window.location.assign: a full
      // document load that tears down the WebGL context and reloads both
      // models. The transition is the optional part; the client navigation is
      // not.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        navigating = true;
        router.push(href);
        // No veil means no arrival handler to clear the flag, so clear it on a
        // timer. Generous, because it only gates other writers, never the
        // navigation itself.
        window.setTimeout(() => { navigating = false; }, WATCHDOG_MS);
        return;
      }

      const target = new URL(href, window.location.origin);
      pendingPath.current = target.pathname;
      navigating = true;
      setPhase('closing');

      later(() => {
        setPhase('closed');
        router.push(href);
        // THE WATCHDOG. Nothing below this line is allowed to leave the veil
        // shut: if the push is rejected, errors, or resolves to a page that
        // never renders, this opens anyway.
        later(open, WATCHDOG_MS);
      }, CLOSE_MS);
    },
    [router, open],
  );

  // Arrival. When the pathname becomes the one we were waiting for, the new
  // document is on screen and the veil can lift.
  useEffect(() => {
    if (pendingPath.current && pendingPath.current === pathname) {
      // One frame, so the incoming page has painted behind the veil rather
      // than appearing halfway through the opening.
      requestAnimationFrame(() => requestAnimationFrame(open));
    }
    // `open` is stable; pathname is the trigger.
  }, [pathname, open]);

  useEffect(() => {
    // The controller is registered UNCONDITIONALLY, including under reduced
    // motion, because it is what gives `veiledPush` a client router. `go`
    // itself decides whether to dissolve.
    controller = { go };

    // The click intercept, however, is skipped under reduced motion: with no
    // dissolve to play there is nothing to intercept FOR, and every link then
    // takes Next's own handler unmodified — which is the least that can go
    // wrong. Read once, on mount: a visitor who changes the OS setting
    // mid-session gets the new behaviour on their next page load, and the
    // alternative is a live listener rebinding the document on a media query.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onClick = (e: MouseEvent) => {
      const href = interceptable(e);
      if (!href) return;
      e.preventDefault();
      go(href);
    };

    // Capture phase, so this runs before Next's own Link handler.
    if (!reduced) document.addEventListener('click', onClick, true);
    return () => {
      if (!reduced) document.removeEventListener('click', onClick, true);
      if (controller && controller.go === go) controller = null;
    };
  }, [go]);

  useEffect(() => () => clearTimers(), []);

  const shut = phase === 'closed' || phase === 'closing';

  return (
    <div
      aria-hidden="true"
      // z-[80]: above the header (z-40), the skip link (z-50), the preloader
      // (z-60) and the cursor ring (z-70). A transition that something else
      // draws over is not a transition.
      className="pointer-events-none fixed inset-0 z-[80]"
      style={{
        opacity: shut ? 1 : 0,
        // Only while shut. The veil must never eat a click on a page it is not
        // covering — and while it IS covering one, swallowing a second click is
        // exactly right, because that click would start a second navigation.
        pointerEvents: shut ? 'auto' : 'none',
        transition: `opacity ${phase === 'closing' ? CLOSE_MS : OPEN_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        // Midnight, with the light of a door that is still open at the centre.
        // The same construction as the scroll crossover's blackout, so the two
        // read as one device rather than two effects that happen to be dark.
        background:
          'radial-gradient(120% 90% at 50% 52%, #0B1220 0%, #05080F 46%, #04060B 100%)',
        visibility: phase === 'idle' ? 'hidden' : 'visible',
      }}
    >
      {/* The ember. One element, transform and opacity only, so the whole
          transition stays on the compositor. It expands as the veil closes and
          keeps expanding as it opens — a single continuous gesture through the
          navigation rather than two symmetrical halves, which is what stops it
          reading as a loading screen. */}
      <div
        className="absolute left-1/2 top-1/2 h-[52vmax] w-[52vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(232,185,138,0.22) 0%, rgba(192,138,93,0.10) 34%, rgba(192,138,93,0) 68%)',
          transform: `translate(-50%, -50%) scale(${shut ? 1 : 0.55})`,
          opacity: phase === 'closing' ? 0.9 : phase === 'closed' ? 0.55 : 0,
          transition: `transform ${CLOSE_MS + OPEN_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${OPEN_MS}ms ease-out`,
          willChange: 'transform, opacity',
        }}
      />
    </div>
  );
}
