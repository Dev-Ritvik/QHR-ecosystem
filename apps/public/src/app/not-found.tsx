// apps/public/src/app/not-found.tsx
//
// THE LAST RESORT. Since 2026-10-06 an address that is not a page is answered
// inside the site (the catch-all in the experience group, and the not-found
// boundaries beside the two layouts): header, footer, the hall behind it. This
// root boundary is what is left for a "not found" raised where the site's
// layout does not reach — the kiosk's group, or a failure above the site.
//
// It sits at the app root, above the (site) layout, so it carries no header or
// footer and has to stand on its own: the same folio, with a way home at its
// head in place of the header it cannot have.

import type { Metadata } from 'next';
import Link from 'next/link';
import { NotFoundFolio } from '@/components/folio/NotFoundFolio';

export const metadata: Metadata = {
  title: 'Page not found — Quality Homes Reality',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="folio-stage min-h-screen bg-[#15110C] pt-[62px] text-[#F2EDE4]">
      <p className="folio-home">
        <Link href="/">Quality Homes Reality</Link>
      </p>
      <NotFoundFolio bare />
    </div>
  );
}
