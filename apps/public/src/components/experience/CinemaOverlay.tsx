'use client';

// apps/public/src/components/experience/CinemaOverlay.tsx
//
// The last layer of the image, and the one that is not 3D at all.
//
// THE REVIEW: "it is just another 3D build". A large part of what separates a
// photograph of a building from a render of one happens after the renderer has
// finished — the grain of a film stock, the warmth a lens spills toward a low
// sun, the frame a photograph is printed inside. None of it is geometry and all
// of it is read instantly, so it is done here, in the DOM, over the canvas:
//
//   grain   a 180x180 turbulence tile at 3.5% in overlay, stepped through eight
//           offsets a second. Overlay leaves the midtones alone and works into
//           the shadows and the highlights, which is where film grain lives. It
//           also does the one useful technical job a grain pass has: it breaks
//           up the banding a wide, smooth sky gradient shows on an 8-bit display.
//   leak    a warm radial on the sun's own bearing (front-left, where the
//           daylight key is), at 7%. A real lens flares toward its light source
//           and the absence of any such spill is part of what makes a clean
//           render read as synthetic.
//
// THERE IS NO FRAME. There was, for one release: a hairline inset in the
// site's gold with corner ticks. The client's art-direction review asked for it
// to go — "it boxes in the 3D experience and reduces the feeling of vastness" —
// and the review is right about what an inset border does to a view that is
// meant to open out to a horizon.
//
// COSTS NOTHING TO ANIMATE. Three fixed-position composited layers, no paint on
// scroll, `pointer-events-none` throughout so nothing here can take a click
// meant for the canvas or the copy. The grain animation is dropped under
// prefers-reduced-motion, where a flickering field is exactly what the setting
// is asking not to see.

import type { SceneSet } from './poses';
import type { Grade } from './WorldCanvas';

/** One 180px tile of fractal noise, inline so it costs no request. */
const GRAIN_TILE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.86' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export function CinemaOverlay({ set, grade }: { set: SceneSet; grade: Grade }) {
  const day = set === 'exterior' && grade === 'daylight';
  return (
    <>
      {/* THE LIGHT LEAK. Only in daylight outside, and only on the sun's side:
          the key stands at DAY_SUN (front-right), which from the hero is the
          right of frame — away from the copy column, which it used to wash. */}
      {day && (
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              'radial-gradient(58% 48% at 88% 16%, rgba(255,203,138,0.14) 0%, rgba(255,186,110,0.06) 38%, rgba(255,186,110,0) 72%)',
            mixBlendMode: 'screen',
          }}
        />
      )}

      {/* THE GRAIN. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] estate-grain"
        style={{ backgroundImage: GRAIN_TILE }}
      />

    </>
  );
}
