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
//
// (Loud in the folio's own terms since 2026-10-06 — app/folio.css, "pending" —
// and no quieter: the mark is still a filled, ruled box in the middle of a
// sentence, in capitals, and nothing else on a sheet is boxed.)

export function Pending({ children }: { children: React.ReactNode }) {
  return <mark className="folio-pending">[{children}]</mark>;
}

/** Spread into a page's `metadata` while it still contains <Pending> facts. */
export const pendingRobots = {
  robots: { index: false, follow: false },
} as const;

export function PendingNotice({ what }: { what: string }) {
  return (
    <div className="folio-pending-notice" data-reveal>
      <p className="folio-pending-notice-head">Draft — not yet in force</p>
      <p>
        {what} Highlighted items are still to be confirmed. The draft is kept out of search
        engines.
      </p>
    </div>
  );
}
