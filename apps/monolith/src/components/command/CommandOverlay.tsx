'use client';

// apps/monolith/src/components/command/CommandOverlay.tsx
//
// The Z-999 HUD — MASTER_SPEC §7, §4.5.
//
// THE CROSSFADE IS SEAMLESS BY CONSTRUCTION, NOT BY TIMING.
//
// The canvas is frozen on the EXACT frame that was captured (see
// WorldCanvas/CanvasBridge, where the capture and setFrameloop('never') are two
// statements inside one scene.onAfterRender tick). So for the whole 350ms
// crossfade, the live canvas underneath and the still image on top are
// pixel-identical. You are dissolving an image into itself — there is no motion
// to perceive at any point in the fade, regardless of how precisely the timings
// line up.
//
// Split the capture and the freeze into separately-scheduled effects and you
// will occasionally capture one frame and freeze on another. That produces a
// visible pop which passes QA nine times and fails the tenth.
//
// THE RAIL PERSISTS. Navigating Careers -> Contact re-renders only the right
// pane. The rail is not re-mounted, the canvas is not touched, and the URL is
// the authority for what is shown — so the back button works without any
// history bookkeeping of ours.

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCommandStore } from '@/state/commandStore';
import { setScrollLocked } from '@/lib/ticker';

/** The directory — MASTER_SPEC Routing Arch §3. Grouped as the source document
 *  groups them, because that grouping is how the business thinks about them. */
const DIRECTORY: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: 'Intelligence',
    items: [
      { href: '/investment-guide', label: 'Investment guide' },
      { href: '/locations', label: 'Locations' },
      { href: '/knowledge', label: 'Knowledge' },
      { href: '/downloads', label: 'Downloads' },
      { href: '/gallery', label: 'Gallery' },
    ],
  },
  {
    group: 'The company',
    items: [
      { href: '/about', label: 'About' },
      { href: '/why-us', label: 'Why us' },
      { href: '/testimonials', label: 'Testimonials' },
      { href: '/updates', label: 'Construction updates' },
      { href: '/careers', label: 'Careers' },
    ],
  },
  {
    group: 'Acquisition',
    items: [
      { href: '/contact', label: 'Contact' },
      { href: '/site-visit', label: 'Book a site visit' },
      { href: '/branches', label: 'Branches' },
      { href: '/faqs', label: 'Questions' },
    ],
  },
  {
    group: 'Legal',
    items: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/cookie-policy', label: 'Cookies' },
      { href: '/refund-policy', label: 'Refunds' },
    ],
  },
];

export function CommandOverlay({ children }: { children: React.ReactNode }) {
  const overlayOpen = useCommandStore((s) => s.overlayOpen);
  const backdrop = useCommandStore((s) => s.frozenBackdrop);
  const close = useCommandStore((s) => s.close);
  const router = useRouter();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<Element | null>(null);

  // The world stops; the dossier remains.
  useEffect(() => {
    setScrollLocked(overlayOpen);
  }, [overlayOpen]);

  useEffect(() => {
    if (!overlayOpen) return;

    restoreFocus.current = document.activeElement;
    // Focus the panel itself rather than the first link: a screen reader should
    // hear where it has arrived before it hears the first option.
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      close();
      router.back();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      (restoreFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [overlayOpen, close, router]);

  if (!overlayOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-label="Directory"
    >
      {/* THE FROZEN BACKDROP. backdrop-filter here composites against a single
          STATIC raster, decoupled entirely from the WebGL context — which by
          this point is not compositing at all. Blurring the live canvas instead
          would keep the GPU working for an effect nobody can see moving. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-void"
        style={
          backdrop
            ? {
                backgroundImage: `url(${backdrop})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                // Scaled slightly so the blur has pixels to pull from at the
                // edges instead of smearing the frame border inward.
                transform: 'scale(1.035)',
              }
            : undefined
        }
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backdropFilter: 'blur(18px) brightness(0.58)',
          WebkitBackdropFilter: 'blur(18px) brightness(0.58)',
          background: 'rgba(5,5,5,0.42)',
        }}
      />

      {/* THE GRID. minmax(240px, 0.28fr) for the rail — it must not collapse
          below legibility on a laptop, and must not sprawl on a wide monitor.
          Single column below 768px: a 240px rail on a 375px screen leaves
          nothing for the content it is supposed to introduce. */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative grid h-full grid-cols-1 outline-none md:grid-cols-[minmax(240px,0.28fr)_minmax(0,1fr)]"
      >
        <nav
          aria-label="Directory"
          className="hidden overflow-y-auto border-r border-white/10 px-8 py-10 md:block"
        >
          <p className="t-mono text-ember">Directory</p>

          <div className="mt-10 space-y-9">
            {DIRECTORY.map((section) => (
              <div key={section.group}>
                <p className="t-mono text-ash/45">{section.group}</p>
                <ul className="mt-4 space-y-2.5">
                  {section.items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={
                            't-body transition-colors ' +
                            (active ? 'text-signal' : 'text-ash hover:text-signal')
                          }
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* The content pane. This is the ONLY thing that re-renders when the
            route changes — the rail above and the canvas beneath both survive. */}
        <div className="overflow-y-auto">
          <div className="flex justify-end px-6 pt-6 md:px-12">
            <button
              type="button"
              onClick={() => {
                close();
                router.back();
              }}
              className="t-mono text-ash transition-colors hover:text-signal"
            >
              Close &nbsp;[ Esc ]
            </button>
          </div>

          <div className="mx-auto max-w-3xl px-6 pb-24 pt-8 md:px-12">{children}</div>
        </div>
      </div>
    </div>
  );
}
