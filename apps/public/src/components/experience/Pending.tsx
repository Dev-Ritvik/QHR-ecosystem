// apps/public/src/components/experience/Pending.tsx
//
// A visibly unresolved fact inside a legal document.
//
// The alternative — writing a plausible-looking default and hoping someone
// remembers to change it — is how a made-up cancellation window or a wrong
// registered address ends up published as a binding representation to
// consumers. A placeholder that looks like prose WILL eventually ship as prose.
//
// So these render loudly, and any document containing one declares itself
// noindex via `pendingRobots` below. An incomplete legal page should not be
// discoverable, and should not look finished to anyone reading it.

export function Pending({ children }: { children: React.ReactNode }) {
  return (
    <mark className="mx-0.5 rounded-sm bg-amber-300/20 px-1.5 py-0.5 font-mono text-[0.85em] text-amber-200 ring-1 ring-amber-300/40">
      [{children}]
    </mark>
  );
}

/** Spread into a page's `metadata` while it still contains <Pending> facts. */
export const pendingRobots = {
  robots: { index: false, follow: false },
} as const;

export function PendingNotice({ what }: { what: string }) {
  return (
    <div className="mb-10 rounded border border-amber-300/30 bg-amber-300/5 px-5 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-amber-200/90">
        Draft — not yet in force
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#F2EDE4]/70">
        {what} Highlighted items are unresolved and must be confirmed by Quality
        Homes Reality and reviewed by its legal advisers before this page is
        published. Until then it is excluded from search engines.
      </p>
    </div>
  );
}
