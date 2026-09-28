'use client';

// apps/public/src/components/experience/WordReveal.tsx
//
// Headlines that arrive with the camera, a word at a time.
//
// THE THIRD REVIEW: "text should not just abruptly fade in. Use staggered
// character or word reveals that glide upwards with soft motion blur, timing
// their entrance precisely to camera arrival points." Each chapter's copy is a
// sticky pane that arrives as its chapter does, so the pane's arrival IS the
// camera's: when a pane is on screen its headline's words rise into place one
// after another, out of a small blur, and when it leaves they reset so the
// next arrival plays again.
//
// DONE OVER THE MARKUP, NOT IN IT. The page is a server component and is what
// crawlers, screen readers and no-JavaScript visitors get, so the words stay
// plain text there. This splits the text nodes of each headline into word spans
// once, on the client, keeping every inline element (the italic emphasis, the
// line breaks) where it was; the text content is unchanged, and the spaces
// between words stay real spaces.
//
// Off under prefers-reduced-motion: the words are simply there.

import { useEffect } from 'react';

const TARGETS = '[data-chapter-fade] :is(h1, h2, h3, p.t-h3, p.t-h1), [data-reveal]';

function splitWords(el: HTMLElement): number {
  let i = 0;
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? '';
        if (!text.trim()) continue;
        const frag = document.createDocumentFragment();
        for (const part of text.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else {
            const w = document.createElement('span');
            w.className = 'reveal-word';
            w.style.setProperty('--i', String(i));
            w.textContent = part;
            frag.appendChild(w);
            i += 1;
          }
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && !(child as HTMLElement).classList.contains('reveal-word')) {
        walk(child);
      }
    }
  };
  walk(el);
  return i;
}

export function WordReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>(TARGETS)).filter(
      (el) => !el.dataset.revealReady,
    );
    for (const el of els) {
      splitWords(el);
      el.dataset.revealReady = '1';
      el.classList.add('reveal');
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          (e.target as HTMLElement).classList.toggle('is-revealed', e.isIntersecting);
        }
      },
      // Most of the headline on screen, a little inside the frame, so the
      // words rise as the pane settles rather than as its edge crosses.
      { threshold: 0.6, rootMargin: '-6% 0px -6% 0px' },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, []);
  return null;
}
