// apps/public/src/app/(site)/(experience)/[...missing]/page.tsx
//
// EVERY ADDRESS THAT IS NOT A PAGE, caught inside the house.
//
// Next gives an unmatched address to the ROOT not-found, which is above the
// site's layout: no header, no footer, no canvas. A catch-all here is matched
// only when nothing else is (a real route always wins over it), so what a
// visitor gets is a folio with the hall behind it.
//
// AND IT IS A PAGE, NOT A RAISED "NOT FOUND" (the forensic audit of
// 2026-10-09, #4). It used to do one thing — call notFound() — so that the
// boundary beside the layout answered. But Next draws a nested not-found
// boundary in the BROWSER: the server sent a title and no body, the folio
// appeared when the site's script had arrived and run (five seconds of curtain
// on a connection), and the redraw left the tab with no title at all. The
// middleware now says "404" for an address that is not a page
// (lib/sitePaths.ts) and marks the request; for a request so marked this
// route renders the folio itself, on the server, with its title.
//
// A request that reached here unmarked — a path the middleware's matcher
// leaves alone, a file that is not there — still raises "not found": the
// status has to come from somewhere, and for those nobody is waiting on a
// picture.

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { NotFoundFolio } from '@/components/folio/NotFoundFolio';
import { MISSING_HEADER } from '@/lib/sitePaths';

export const metadata: Metadata = {
  title: 'Page not found — Quality Homes Reality',
  robots: { index: false, follow: true },
};

export default function Missing() {
  if (headers().get(MISSING_HEADER) !== '1') notFound();
  return <NotFoundFolio />;
}
