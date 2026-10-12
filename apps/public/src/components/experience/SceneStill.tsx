'use client';

// apps/public/src/components/experience/SceneStill.tsx
//
// THE STILL A VIEW OPENS ON, and the layer it is shown in (stills.ts has the
// account). Over the canvas and under the page: where the scene is not built
// yet this is the picture, and it goes by degrees as the scene comes up under
// it — on `sceneWarm.hold`, the same measure the canvas's own dark is held by.
//
// It is in the server's markup, as a <picture> whose cut the browser chooses
// by the screen's proportions before any script has run, so the picture is in
// the page's first paint and the curtain over it (ExperienceCanvasHost) lifts
// the moment it has arrived. After that this component keeps the still that
// is shown the still of what the scene WOULD be showing: on a page its place,
// on the film the chapter the scroll is in, each fetched as it is wanted and
// dissolved over the last.
//
// Nothing here knows about three or the canvas: it must be alive before the
// scene's script has even been asked for.

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { measureFilmSpan } from './filmTrack';
import { sceneWarm } from './sceneWarm';
import {
  chapterAt,
  chapterKey,
  isFilmPath,
  pictureOf,
  stillFor,
  stillKeyForRoute,
} from './stills';
import { useSceneCards } from './useSceneCards';

/** One 180px tile of the print's grain (CinemaOverlay has the account): the
 *  still wears the grain the scene will, so the two are one print. */
const GRAIN_TILE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.86' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

/**
 * Run by the browser as it parses the page, before any bundle: says when the
 * first still has arrived (`data-still` on the document: the curtain's rule
 * reads it, globals.css), and that there is none where there is none. An
 * address that asks for a chapter of the film waits for the script, which
 * knows which chapter (`data-still="held"`): the cover's still under a
 * table's name would be the wrong picture.
 */
const ANNOUNCE = `(function(){var d=document.documentElement,p=document.currentScript.previousElementSibling,i=p&&p.querySelector('img');if(!i||!i.getAttribute('src')){d.dataset.still='none';return}if(location.hash.length>1&&(location.pathname==='/'||location.pathname==='/site-home')){d.dataset.still='held';return}function f(){if(d.dataset.still!=='held')d.dataset.still='in'}if(i.complete&&i.naturalWidth)f();else{i.addEventListener('load',f,{once:true});i.addEventListener('error',function(){d.dataset.still='none'},{once:true})}})()`;

const smooth01 = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

const fetched = new Set<string>();
/** Ask for a still ahead of its being shown. */
function preload(url: string | null) {
  if (!url || fetched.has(url) || typeof Image === 'undefined') return;
  fetched.add(url);
  const im = new Image();
  im.decoding = 'async';
  im.src = url;
}

export function SceneStill() {
  const pathname = usePathname() || '/';
  // What the SERVER drew, and so what the first client render must draw: the
  // still of the route the document was asked for. Kept for the document's
  // life — every later still is set on the two images by the loop below, not
  // by a render.
  const [first] = useState(() => pictureOf(stillKeyForRoute(pathname)));
  const root = useRef<HTMLDivElement>(null);
  const imgA = useRef<HTMLImageElement>(null);
  const imgB = useRef<HTMLImageElement>(null);
  const path = useRef(pathname);
  path.current = pathname;

  useEffect(() => {
    const el = root.current;
    const a = imgA.current;
    const b = imgB.current;
    if (!el || !a || !b) return;
    const doc = document.documentElement;

    /** The image now shown, and the address it shows. */
    let front: HTMLImageElement = a;
    let frontUrl = a.currentSrc ? new URL(a.currentSrc).pathname : '';
    /** The address the other image has been asked for. */
    let pending = '';
    let span = 0;
    let spanAt = 0;
    let raf = 0;
    let lastOpacity = '';
    let lastShown = true;

    const show = (im: HTMLImageElement, url: string) => {
      const back = im === a ? b : a;
      im.dataset.on = '';
      delete back.dataset.on;
      front = im;
      frontUrl = url;
      pending = '';
      // The first still of a visit that the script had to choose (an address
      // that named a chapter): the curtain has been waiting on it.
      if (doc.dataset.still !== 'in') doc.dataset.still = 'in';
    };

    const ask = (url: string) => {
      if (url === frontUrl || url === pending) return;
      const im = front === a ? b : a;
      pending = url;
      const done = () => {
        im.removeEventListener('load', done);
        if (pending === url) show(im, url);
      };
      im.addEventListener('load', done);
      // (A plain image: the <picture> round the first one chose by the
      // screen's proportions, and so has `stillFor`.)
      const pic = im.parentElement;
      if (pic && pic.tagName === 'PICTURE') {
        for (const s of Array.from(pic.querySelectorAll('source'))) s.remove();
      }
      im.src = url;
      if (im.complete && im.naturalWidth) done();
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const hold = sceneWarm.hold;
      const shown = hold > 0.001;
      if (shown !== lastShown) {
        el.style.visibility = shown ? 'visible' : 'hidden';
        lastShown = shown;
      }
      const o = shown ? smooth01(hold).toFixed(3) : '0';
      if (o !== lastOpacity) {
        el.style.opacity = o;
        lastOpacity = o;
      }
      // Nothing is fetched for a scene that is already up.
      if (!shown) return;

      const p = path.current;
      let key: string | null;
      if (isFilmPath(p)) {
        const now = performance.now();
        if (!span || now - spanAt > 600) {
          span = measureFilmSpan();
          spanAt = now;
        }
        const stations = Math.min(4, useSceneCards.getState().cards.length);
        const progress = window.scrollY / Math.max(1, span);
        const id = chapterAt(progress, stations);
        key = id ? chapterKey(id) : null;
        // The chapter after it, while this one is read.
        if (id) {
          const next = chapterAt(progress + 0.06, stations);
          if (next && next !== id) preload(stillFor(chapterKey(next), window.innerWidth, window.innerHeight));
        }
      } else {
        key = stillKeyForRoute(p);
      }
      const url = key ? stillFor(key, window.innerWidth, window.innerHeight) : null;
      if (url) ask(url);
      else if (frontUrl || pending) {
        // A view with no still (the film's last frame): the canvas's own dark.
        delete a.dataset.on;
        delete b.dataset.on;
        frontUrl = '';
        pending = '';
      }
    };
    raf = requestAnimationFrame(tick);

    // The first still was in the markup and may have arrived before this
    // script did: an image's `load` is not waited for twice.
    if (a.complete && a.naturalWidth && doc.dataset.still !== 'in' && doc.dataset.still !== 'held') {
      doc.dataset.still = 'in';
    }

    // A link that is about to be followed: its page's still, asked for on the
    // press, so it is there when the route's veil opens on it.
    const onPress = (e: Event) => {
      const link = (e.target as Element | null)?.closest?.('a');
      const href = link?.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('/api/')) return;
      const to = href.split('#')[0].split('?')[0] || '/';
      preload(stillFor(stillKeyForRoute(to), window.innerWidth, window.innerHeight));
    };
    document.addEventListener('pointerdown', onPress, { capture: true, passive: true });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointerdown', onPress, { capture: true });
    };
  }, []);

  return (
    <div ref={root} aria-hidden data-scene-still="" className="scene-still">
      <picture>
        {first
          ? first.sources.map((s) => <source key={s.media} media={s.media} srcSet={s.src} type="image/webp" />)
          : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgA}
          className="scene-still-img"
          data-on=""
          alt=""
          src={first ? first.src : undefined}
          decoding="async"
          // (React 18 knows the attribute by its lower-case name only.)
          {...{ fetchpriority: 'high' }}
        />
      </picture>
      {/* What the first tells the document (ANNOUNCE). In the markup, so it
          runs as the page is parsed; a script React inserts later does not
          run, and does not need to — the loop above says the same. */}
      <script dangerouslySetInnerHTML={{ __html: ANNOUNCE }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgB} className="scene-still-img" alt="" decoding="async" />
      <div className="estate-grain absolute inset-0" style={{ backgroundImage: GRAIN_TILE }} />
    </div>
  );
}
