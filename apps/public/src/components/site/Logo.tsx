// apps/public/src/components/site/Logo.tsx
//
// The client's mark, as the client drew it: cobalt and orange.
//
// THE MARK DOES NOT CHANGE (the client, 2026-10-06: "never change the logo
// keep back the original blue and orange one"). It has been asked twice now.
// The first time, the answer on colour was that the cobalt and orange stay and
// that making it feel premium is our problem; since then the site has shown a
// reversed version (ivory and gilt, for the fourth art-direction critique) and
// a mark redrawn from the house's own front (for the audit of 2026-10-05, on
// its P2 item), and the client sent both back. So: #2f3291 and #ec6028
// exactly, the artwork untouched, and nothing here is to be restyled, recut or
// recoloured for any review that is not the client's own.
//
// What it gets is the ground it was drawn on. Cobalt has almost no contrast
// with a dusk sky or a dark hall, so the mark stands on a small ivory plate
// with a hairline edge — an enamelled badge fixed to the page. Small, with air
// round it.
//
// Two files, deliberately: the full mark carries the roof's gradient, and the
// flat one is used below ~32px, where the gradient gets three pixels to run in
// and turns to mud.

import Link from 'next/link';

/** Clear space round the mark on its plate, as a fraction of the mark's side
 *  (half of it on each side). Nothing enters this. */
const CLEAR = 0.34;

export function Logo({
  size = 34,
  href = '/',
  showWordmark = true,
}: {
  size?: number;
  href?: string | null;
  showWordmark?: boolean;
}) {
  // `size` pixels — of the frame's own unit, which over the film on a wide
  // frame is a nine-hundredth of its height (globals.css, THE FILM'S STAGE)
  // and everywhere else is a pixel. Never under three-quarters of its size: a
  // short frame's mark is still a mark.
  const side = `max(${Math.round(size * 0.74)}px, calc(${size} * var(--u, 1px)))`;
  const plate = `calc(${side} * ${1 + CLEAR})`;
  const content = (
    <span className="inline-flex items-center gap-3">
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-[3px] bg-[#F2EDE4] shadow-[0_1px_0_rgba(255,255,255,0.16),0_2px_10px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
        style={{ width: plate, height: plate }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={size < 32 ? '/brand/qhr-mark-flat.svg' : '/brand/qhr-mark.svg'}
          alt=""
          width={size}
          height={size}
          style={{ width: side, height: side }}
        />
      </span>
      {showWordmark ? (
        <span className="hidden leading-none sm:inline-block">
          <span className="block text-step-0 leading-4 tracking-[0.02em] text-[#F2EDE4]">
            Quality Homes
          </span>
          <span className="mt-1 block text-step--2 font-medium uppercase leading-3 tracking-[0.3em] text-[#D9B07A]">
            Reality
          </span>
        </span>
      ) : null}
    </span>
  );

  if (!href) return content;
  return (
    <Link
      href={href}
      aria-label="Quality Homes Reality — home"
      // tap-target: the badge is about 40px at header size, so the hit area is
      // widened invisibly to 44 rather than enlarging the mark.
      className="tap-target inline-flex items-center rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
    >
      {content}
    </Link>
  );
}
