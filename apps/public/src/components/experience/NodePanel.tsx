// apps/public/src/components/experience/NodePanel.tsx
//
// Server component. The frosted panel that a flight node resolves into.
//
// Critical architectural property: this is ordinary DOM, server-rendered.
// It is what Google indexes, what a screen reader announces, and what the
// low-tier (no-WebGL) path renders on its own. The canvas behind it is
// decorative. Slice 0 proper adds the GSAP slide-in choreography; the skeleton
// deliberately renders it static so persistence is measured without animation
// noise.
import type { ReactNode } from 'react';
import Link from 'next/link';

export function NodePanel({
  eyebrow,
  title,
  lede,
  children,
  next,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children?: ReactNode;
  next: { href: string; label: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-end px-6 py-24 sm:px-10 lg:px-16">
      <article className="w-full max-w-xl rounded-2xl border border-[#E8B98A]/20 bg-[#101A2A]/60 p-8 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#C08A5D]">
          {eyebrow}
        </p>

        <h1
          className="mt-4 text-4xl leading-[1.08] text-[#F2EDE4] sm:text-5xl"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {title}
        </h1>

        <div className="mt-5 h-px w-16 bg-gradient-to-r from-[#C08A5D] to-transparent" />

        <p className="mt-6 text-[17px] leading-relaxed text-[#F2EDE4]/75">{lede}</p>

        {children ? <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-[#F2EDE4]/65">{children}</div> : null}

        <Link
          href={next.href}
          className="group mt-10 inline-flex items-center gap-3 text-sm font-medium text-[#E8B98A] transition-colors hover:text-[#F2EDE4]"
        >
          <span className="inline-block h-px w-8 bg-[#C08A5D] transition-all group-hover:w-12" />
          {next.label}
        </Link>
      </article>
    </div>
  );
}
