// apps/monolith/src/components/command/StandaloneShell.tsx
//
// Chrome for the DIRECT-HIT variant of a utility page — MASTER_SPEC §4.2.
//
// A hard load of /careers, or a link someone shared, does not pass through
// @modal/layout.tsx — that layout wraps the parallel slot only. Without this,
// such a page would render as bare text on the void with no way back.
//
// It is deliberately NOT the full HUD. There is no frozen backdrop to sit on
// (nothing was rendered to freeze), and no rail, because a visitor arriving
// cold at a legal page has not opened a directory — they followed a link. What
// they need is the content, an identity, and a way into the site.
//
// Server component. No R3F, no GSAP, no store — the bundle quarantine in §7
// depends on that staying true.

import Link from 'next/link';

export function StandaloneShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-void">
      <div className="mx-auto max-w-3xl px-6 py-16 md:px-12 md:py-24">
        <div className="flex items-baseline justify-between gap-8 border-b border-white/10 pb-6">
          <Link href="/" className="t-mono text-ash transition-colors hover:text-signal">
            Quality Homes Reality
          </Link>
          <Link href="/" className="t-mono text-ember transition-colors hover:text-signal">
            Enter the site
          </Link>
        </div>

        <div className="pt-14">{children}</div>

        <div className="mt-24 border-t border-white/10 pt-8">
          <p className="t-mono text-ash/45">
            Visakhapatnam · Vizianagaram · Srikakulam
          </p>
        </div>
      </div>
    </main>
  );
}
