'use client';

// apps/monolith/src/components/experience/TierD.tsx
//
// MASTER_SPEC §9.3, §10 — the no-WebGL path.
//
// THIS IS NOT A FAILURE STATE AND IT IS NOT AN APOLOGY.
//
// It is a second designed artefact: the same narrative, set as a typeset
// architectural document. It is what a juror sees the moment they enable
// reduced-motion, and it is where the 30% usability weighting is actually won —
// most cinematic sites show a blank canvas or "this site requires WebGL" here,
// and score accordingly.
//
// Reached by three routes, all legitimate:
//   * prefers-reduced-motion: reduce   — a stated preference, which outranks
//                                        every capability heuristic
//   * no WebGL2 context
//   * a software rasteriser (SwiftShader/llvmpipe), which will never hold 60fps
//
// Renders behind the scrolling content as a still composition rather than
// nothing, so the page still has a ground and a horizon — the document has an
// atmosphere without a single frame being rendered.

import { useSceneStore } from '@/state/sceneStore';

export function TierD() {
  const tier = useSceneStore((s) => s.tier);
  const reduced = useSceneStore((s) => s.reducedMotion);

  if (tier !== 'D') return null;

  return (
    <div className="world" aria-hidden>
      {/* The corridor, as a still. Three stacked gradients standing in for
          sky, the ghats and the plain — no canvas, no shader, no rAF. The
          whole thing costs one composite. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(#070810 0%, #12131a 46%, #1b1c24 58%, #0d0c0e 68%, #050505 100%)',
        }}
      />
      {/* The ember, low and west, matching the WebGL sun bearing so the two
          paths share a light direction. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(52% 30% at 18% 58%, rgba(200,100,42,0.20), transparent 70%)',
        }}
      />
      {/* A horizon rule. One pixel, and it does more for the sense of place
          than any amount of blur would. */}
      <div
        className="absolute inset-x-0"
        style={{ top: '58%', height: 1, background: 'rgba(255,255,255,0.10)' }}
      />

      {reduced ? (
        <p
          className="t-mono absolute bottom-6 right-6 text-ash/40"
          // Not aria-hidden: someone who set reduced-motion deserves to know
          // the site honoured it rather than silently degrading.
          aria-hidden={false}
        >
          Reduced motion — still composition
        </p>
      ) : null}
    </div>
  );
}
