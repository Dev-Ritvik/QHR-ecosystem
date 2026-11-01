'use client';

// apps/public/src/components/site/ReticleCursor.tsx
//
// THE SITE'S CURSOR: a shell and nothing else. A phone, which has no pointer to
// follow, loads none of the drawing (ReticleDrawing.tsx); the page's own HTML
// carries none of it either, so it is no word on the page and no weight on the
// first paint.

import { useEffect, useState, type ComponentType } from 'react';
import { RETICLE_MEDIA } from './reticle';

export function ReticleCursor() {
  const [Drawing, setDrawing] = useState<ComponentType | null>(null);
  useEffect(() => {
    const q = window.matchMedia(RETICLE_MEDIA);
    let gone = false;
    const read = () => {
      if (!q.matches) {
        setDrawing(null);
        return;
      }
      void import('./ReticleDrawing').then((m) => {
        if (!gone && q.matches) setDrawing(() => m.ReticleDrawing);
      });
    };
    read();
    q.addEventListener('change', read);
    return () => {
      gone = true;
      q.removeEventListener('change', read);
    };
  }, []);
  return Drawing ? <Drawing /> : null;
}
