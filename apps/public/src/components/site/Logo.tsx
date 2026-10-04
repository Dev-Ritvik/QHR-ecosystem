// apps/public/src/components/site/Logo.tsx
//
// The mark, reversed out onto the picture.
//
// It used to stand on a small ivory plate with a hairline edge and a drop
// shadow — an enamelled badge fixed to the page, so the client's cobalt and
// orange had the light ground they were drawn on. The fourth art-direction
// critique (2026-09-30) named that plate the site's loudest template tell:
// "trapped inside a white rounded rectangle with a slight shadow ... It breaks
// the immersive fourth wall completely", and asked for the mark "reversed out
// (pure white or subtle metallic) ... directly on the environment without a
// container, acting as an elegant watermark on the experience."
//
// So the mark is its reversed version, as a brand sheet draws one for dark
// grounds: the house and its H in the site's ivory, the Q in the house's
// gilt — the same paths as the flat mark (qhr-mark-reversed.svg). One colour
// alone was tried and does not work: the H's stem runs down inside the Q, and
// in a single colour the two merge into one shape. No plate, no ring, no
// shadow: it sits on the picture like a watermark.

import Link from 'next/link';

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
  const content = (
    <span className="inline-flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/qhr-mark-reversed.svg"
        alt=""
        width={size}
        height={size}
        className="shrink-0"
        style={{ width: side, height: side }}
      />
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
      // tap-target: the mark is 30px at header size, so the hit area is widened
      // invisibly to 44 rather than enlarging it.
      className="tap-target inline-flex items-center rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
    >
      {content}
    </Link>
  );
}
