'use client';

// apps/monolith/src/components/command/Chrome.tsx
//
// Persistent site chrome — MASTER_SPEC §7, §8.1.
//
// Two elements, both fixed, both deliberately minimal:
//
//   [ DIRECTORY ]   the only way into the Command Overlay
//   legal rail      9px, mix-blend-mode: difference, bottom of viewport
//
// THE LEGAL RAIL IS NOT A FOOTER, and that is a narrative decision with a
// compliance consequence. Pushing the scroll track past the Act IV climax into
// a block of copyright text destroys the standoff the whole narrative exists to
// produce. So the links live in a permanent instrument strip instead.
//
// mix-blend-mode: difference means it stays legible against every lighting
// state the scene passes through — dusk sky, dark interior, the collapsed final
// frame — without anyone maintaining a per-Act colour override.
//
// It fades to zero during q > 0.90 (§8.1). The links remain in the DOM at every
// other scroll position; momentary de-emphasis during a ten-percent window is
// not hiding a required disclosure, it is removing peripheral distraction from
// the one moment designed for none.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { subscribe } from '@/lib/ticker';
import { useSceneStore } from '@/state/sceneStore';
import { useCommandStore } from '@/state/commandStore';
import { toggleMute } from '@/lib/audio';

const LEGAL = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/cookie-policy', label: 'Cookies' },
  { href: '/refund-policy', label: 'Refunds' },
];

export function Chrome() {
  const gate = useSceneStore((s) => s.gate);
  const overlayOpen = useCommandStore((s) => s.overlayOpen);
  const router = useRouter();
  const rail = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);

  // Driven from the ticker, not from React state — this value changes every
  // frame and writing it to a store would re-render the tree at frame rate for
  // a single opacity.
  useEffect(
    () =>
      subscribe((q) => {
        if (!rail.current) return;
        const fade = q <= 0.9 ? 1 : Math.max(0, 1 - (q - 0.9) / 0.06);
        rail.current.style.opacity = String(fade * 0.55);
        // Below a threshold the links are not merely faint, they are
        // unclickable — so remove them from the tab order too rather than
        // leaving an invisible focus stop.
        rail.current.style.pointerEvents = fade < 0.15 ? 'none' : 'auto';
      }),
    [],
  );

  // Chrome appears only once the narrative is live. During consent and ignition
  // the screen is deliberately bare.
  if (gate !== 'live' || overlayOpen) return null;

  return (
    <>
      {/* MASTER_SPEC §10 — audio never autoplays, and the control to stop it is
          permanent and keyboard-reachable. A sound you cannot silence without
          leaving the page is a usability failure, and usability is the 30% this
          build is betting on. */}
      <button
        type="button"
        aria-pressed={muted}
        onClick={() => setMuted(toggleMute())}
        className="t-mono fixed left-6 top-6 z-[70] text-ash transition-colors hover:text-signal md:left-10 md:top-8"
      >
        {muted ? '[ Sound off ]' : '[ Sound on ]'}
      </button>

      <button
        type="button"
        onClick={() => router.push('/about')}
        className="t-mono fixed right-6 top-6 z-[70] border border-white/20 px-5 py-3 text-signal transition-colors hover:border-white/60 md:right-10 md:top-8"
      >
        [ Directory ]
      </button>

      <div
        ref={rail}
        className="fixed inset-x-0 bottom-8 z-[70] px-6 md:px-10"
        style={{ mixBlendMode: 'difference' }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <p className="t-mono" style={{ fontSize: 9 }}>
            © 2026 Quality Homes Reality
          </p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="t-mono" style={{ fontSize: 9 }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}
