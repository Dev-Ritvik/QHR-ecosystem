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
//
// THERE IS NO LEAK. A warm CSS radial stood on the sun's bearing for a while;
// the second art-direction audit (2026-09-30) asked for everything that reads
// as a "CSS effect" to go, and over the top of the sky it was also half of why
// the sky read as muddy. The sun's warmth is in the sky and the grade now.
//
// THERE IS NO FRAME. There was, for one release: a hairline inset in the
// site's gold with corner ticks. The client's art-direction review asked for it
// to go — "it boxes in the 3D experience and reduces the feeling of vastness" —
// and the review is right about what an inset border does to a view that is
// meant to open out to a horizon.
//
// COSTS NOTHING TO ANIMATE. One fixed-position composited layer, no paint on
// scroll, `pointer-events-none` throughout so nothing here can take a click
// meant for the canvas or the copy. The grain animation is dropped under
// prefers-reduced-motion, where a flickering field is exactly what the setting
// is asking not to see.

/** One 180px tile of fractal noise, inline so it costs no request. */
const GRAIN_TILE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.86' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export function CinemaOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] estate-grain"
      style={{ backgroundImage: GRAIN_TILE }}
    />
  );
}
