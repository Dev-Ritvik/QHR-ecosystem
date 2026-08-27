// apps/public/src/app/not-found.tsx
//
// There was no not-found boundary anywhere in the app, so every notFound() —
// including the one /projects/[projectSlug] calls on an unknown slug — resolved
// to Next's default: unstyled black-on-white Helvetica, on a site where every
// other surface is #0A1120. A visitor who mistyped a URL, or followed a link to
// a plot that has since been withdrawn, was shown something that looked like
// the site had fallen over.
//
// Deliberately quiet, and deliberately routed. A 404 on a property site is
// usually somebody looking for a specific layout, so the useful response is the
// two or three places that layout could actually be — not an apology and not a
// search box we do not have.
//
// This sits at the app root, above the (site) layout, so it carries no header
// or footer and has to stand on its own.

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found — Quality Homes Reality',
  robots: { index: false, follow: true },
};

const ROUTES = [
  { href: '/', label: 'The layouts', hint: 'Every open plotted development' },
  { href: '/properties', label: 'Plots and sizes', hint: 'Sizes and road widths, side by side' },
  { href: '/downloads', label: 'Approved plans', hint: 'All three layout plans as PDFs' },
  { href: '/contact', label: 'Talk to the office', hint: 'The branch that holds the site' },
];

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-24">
      <p className="t-eyebrow text-[#E8B98A]">404</p>

      <h1 className="t-h1 mt-6 max-w-2xl text-[#F2EDE4]">
        That page isn&rsquo;t here
      </h1>

      <p className="t-lede mt-6 max-w-xl text-[#F2EDE4]/65">
        The address may have changed, or the layout may have closed. Everything
        we have open is one step away.
      </p>

      <ul className="mt-14 border-t border-white/10">
        {ROUTES.map((r) => (
          <li key={r.href} className="border-b border-white/10">
            <Link
              href={r.href}
              className="group flex min-h-[64px] items-baseline justify-between gap-6 py-5 outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
            >
              <span className="t-h3 text-[#F2EDE4] transition-colors group-hover:text-[#E8B98A]">
                {r.label}
              </span>
              <span className="t-small hidden text-right text-[#F2EDE4]/50 sm:block">
                {r.hint}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="t-small mt-14 text-[#F2EDE4]/50">
        Or call the head office on{' '}
        <a
          href="tel:+919553513366"
          className="text-[#E8B98A] underline decoration-[#E8B98A]/40 underline-offset-4 transition-colors hover:text-[#F2EDE4]"
        >
          +91 95535 13366
        </a>
        .
      </p>
    </main>
  );
}
