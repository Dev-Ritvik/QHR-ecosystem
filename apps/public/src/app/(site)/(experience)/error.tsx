'use client';

// apps/public/src/app/(site)/(experience)/error.tsx
//
// The segment error boundary. There was none anywhere in this app, which is why
// a single failed projection query replaced the entire site with Next's red
// developer overlay printing a raw SELECT statement to the client.
//
// This sits INSIDE (experience), so the layout above it survives — meaning the
// WebGL canvas, the header and the footer all stay on screen and only the page
// body is replaced. A visitor who hits this sees the building, the chrome, and
// a composed message; they do not see that anything technical happened.
//
// Deliberately says nothing about what broke. `error.message` on a server
// exception can carry table names, column lists and connection details, and
// Next only redacts it in production builds — in development it would print the
// query. The digest is enough to find the incident in logs.
//
// A PLATE, LIKE ANY OTHER PAGE'S. This was a column of pale text set straight
// onto the room, written when the hall behind a page stood at a twentieth of
// its light. The hall is lit behind pages now (hallLight.ts, HALL_PLATE), and
// on the day this page was finally seen — the register unreachable, on
// purpose (the preview's `public-prod-nodb`) — its words were ivory on ivory
// panelling: the one page of the site that could not be read, shown at the
// one moment a visitor most needs telling what to do. It is set as the
// not-found page is: the title on the density a plate gives its words
// (folio.css), the three ways on at its foot.
//
// (The plate's markup is written out rather than taken from Folio.tsx: an
// error boundary is client code in every page's bundle, and the folio's whole
// vocabulary does not belong there for the sake of one title.)

import { useEffect } from 'react';
import Link from 'next/link';
import { FolioChrome } from '@/components/folio/FolioClient';
import { COMPANY } from '@/lib/company';

export default function ExperienceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry's Next integration already captures this via the global handler;
    // this is the breadcrumb that says which segment it came from.
    console.error('[experience] segment error', error.digest ?? error);
  }, [error]);

  return (
    <main className="folio">
      {/* The header's ground and the picture's band, as on any folio. */}
      <FolioChrome />
      <header className="folio-plate" data-folio-plate>
        <div className="folio-plate-copy">
          <p className="folio-kicker">One moment</p>
          <h1 className="t-d1 folio-title">
            This page <span className="t-gilt">did not load.</span>
          </h1>
          <p className="t-support folio-lede">
            Something on our side did not answer. Nothing you did caused it, and nothing you entered
            has been lost. Try again in a moment, or telephone the office and we will tell you what
            you were looking for.
          </p>
          <div className="folio-plate-foot">
            <button type="button" onClick={reset} className="cta-quiet">
              <span className="cta-quiet-label">Try again</span>
            </button>
            <Link href="/projects" className="cta-quiet">
              <span className="cta-quiet-label">The layouts</span>
            </Link>
            <a href={COMPANY.phone.href} className="cta-quiet">
              <span className="cta-quiet-label">{COMPANY.phone.display}</span>
            </a>
          </div>
          {error.digest ? <p className="folio-error-ref">Reference {error.digest}</p> : null}
        </div>
      </header>
    </main>
  );
}
