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

import { useEffect } from 'react';
import Link from 'next/link';

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
    <main className="mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-center px-6 py-24">
      <p className="t-eyebrow text-[#E8B98A]">One moment</p>

      <h1 className="t-h1 mt-6 max-w-2xl text-[#F2EDE4]">
        This page didn&rsquo;t load
      </h1>

      <p className="t-lede mt-6 max-w-xl text-[#F2EDE4]/65">
        Something on our side didn&rsquo;t answer. Nothing you did caused it, and
        nothing you entered has been lost. Try again in a moment &mdash; or call
        the office and we will tell you what you were looking for directly.
      </p>

      <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-4">
        <button
          type="button"
          onClick={reset}
          className="t-eyebrow text-[#E8B98A] transition-colors hover:text-[#F2EDE4]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="t-eyebrow text-[#F2EDE4]/60 transition-colors hover:text-[#F2EDE4]"
        >
          Back to the layouts
        </Link>
        <a
          href="tel:+919553513366"
          className="t-eyebrow text-[#F2EDE4]/60 transition-colors hover:text-[#F2EDE4]"
        >
          +91 95535 13366
        </a>
      </div>

      {error.digest ? (
        <p className="t-small mt-16 text-[#F2EDE4]/50">
          Reference {error.digest}
        </p>
      ) : null}
    </main>
  );
}
