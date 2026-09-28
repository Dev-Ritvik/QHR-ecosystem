// apps/public/src/components/site/Arrow.tsx
//
// The site's one arrow, drawn rather than typed.
//
// The calls to action ended in "→", a text glyph. The art-direction review
// read it as raw, unfinished code, and it is: a glyph takes the weight, width
// and baseline of whatever font is around it, so the same arrow was a
// different mark at every size, and it could only move as a block. This is a
// hairline shaft and an open head at the stroke weight of the site's rules.
// On hover (of the nearest `group`) the shaft draws out and the head travels
// with it — the arrow lengthens toward where it points instead of sliding.

export function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 30 10"
      width="30"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={'shrink-0 overflow-visible ' + className}
    >
      <line
        x1="0.5"
        y1="5"
        x2="20"
        y2="5"
        className="origin-left transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-box:fill-box] group-hover:scale-x-[1.4] group-focus-visible:scale-x-[1.4]"
      />
      <path
        d="M16 1.2 L20.2 5 L16 8.8"
        className="transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[8px] group-focus-visible:translate-x-[8px]"
      />
    </svg>
  );
}
