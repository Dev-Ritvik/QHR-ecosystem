'use client';

// apps/public/src/components/experience/EnterLink.tsx
//
// "Step inside" — the doorway, from a control instead of from the wheel.
//
// A real link to the first chapter inside, so it works with no script, no
// canvas and no pointer: the fragment scrolls the page to the hall's copy. With
// the scene running and motion allowed it does better than scroll — it carries
// the camera to the front door and through it (doorway.ts, enterResidence).

import type { ReactNode } from 'react';
import { enterResidence } from './doorway';

export function EnterLink({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <a
      href="#establish"
      className={className}
      onClick={(e) => {
        // Modified clicks keep their browser meaning.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (enterResidence()) e.preventDefault();
      }}
    >
      {children}
    </a>
  );
}
