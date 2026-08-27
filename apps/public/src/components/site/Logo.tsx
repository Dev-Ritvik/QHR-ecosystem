// apps/public/src/components/site/Logo.tsx
//
// The mark, given the ground it was drawn on.
//
// The client's answer on colour was that the cobalt and orange do not change,
// and that making it feel premium is our problem. It is not the palette that
// reads cheap — a Ferrari badge is loud red and nobody calls it cheap. What
// reads cheap is a flat sticker floating at large scale on a dark page.
//
// So the mark keeps #2f3291 and #ec6028 exactly, and instead gets back what it
// was designed to sit on: a light surface. Rendered here as a small plate with
// a hairline edge, it reads as an enamelled badge fixed to the page rather than
// an image pasted over it. Small, with air around it — restraint is most of
// what reads as expensive.
//
// Two files, deliberately: the full mark carries the roof gradient, and the
// flat one is used below ~32px where the gradient gets three pixels to run in
// and turns to mud.

import Link from 'next/link';

/** Clear space, as a fraction of the plate's width. Nothing enters this. */
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
  const pad = Math.round(size * CLEAR);

  const badge = (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[3px] bg-[#F2EDE4] shadow-[0_1px_0_rgba(255,255,255,0.16),0_2px_10px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
      style={{ width: size + pad, height: size + pad }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={size < 32 ? '/brand/qhr-mark-flat.svg' : '/brand/qhr-mark.svg'}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    </span>
  );

  const content = (
    <span className="inline-flex items-center gap-3">
      {badge}
      {showWordmark ? (
        <span className="hidden leading-none sm:inline-block">
          <span className="block font-serif text-[15px] tracking-[0.02em] text-[#F2EDE4]">
            Quality Homes
          </span>
          <span className="mt-[3px] block text-[10px] uppercase tracking-[0.34em] text-[#C08A5D]">
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
      // tap-target: the badge is 40x40 at header size, so the hit area is
      // widened invisibly to 44 rather than enlarging the mark.
      className="tap-target inline-flex items-center rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
    >
      {content}
    </Link>
  );
}
