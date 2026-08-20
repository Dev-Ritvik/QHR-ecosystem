// apps/monolith/src/app/not-found.tsx
//
// MASTER_SPEC §8.3 — SIGNAL LOST.
//
// Pure DOM, and note what is NOT here: no Zustand override, no isErrorState
// flag, no canvas suppression. This file sits at root, OUTSIDE (experience),
// so the <Canvas> in that group's layout never mounts on a 404. No WebGL
// context is created, no shader is compiled, nothing needs turning off.
//
// That is the architectural payoff of the mount-point decision in §4.2.
//
// No web font, no image, no WebGL: the fastest-painting screen on the site,
// which is exactly the right priority for the one page whose entire job is
// telling someone that something already went wrong.

import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-void px-6">
      <div className="relative w-full max-w-xl">
        {/* A single CSS radial gradient standing in for a cinematic light
            source. Costs nothing to render and keeps the visual identity
            without asking a troubled browser to compile a shader. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-40 opacity-40"
          style={{
            background:
              'radial-gradient(40% 40% at 50% 50%, rgba(255,43,43,0.20), transparent 70%)',
          }}
        />

        <p className="t-mono relative text-loss">Signal lost</p>
        <h1 className="t-h1 relative mt-6 font-mono">404</h1>
        <p className="t-body relative mt-6 max-w-md text-ash">
          This route does not exist. Nothing was lost on your side.
        </p>

        <p className="relative mt-12">
          <Link
            href="/"
            className="t-mono border-b border-ember/40 pb-1 text-ember transition-colors hover:text-signal"
          >
            Return to apex
          </Link>
        </p>
      </div>
    </main>
  );
}
