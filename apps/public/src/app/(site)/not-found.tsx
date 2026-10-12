// apps/public/src/app/(site)/not-found.tsx
//
// The not-found boundary of the site outside the canvas: today, a plot that
// does not exist. The same folio, under the site's header and over its
// footer, with no picture behind its plate. NotFoundFolio.tsx has the account.

import type { Metadata } from 'next';
import { NotFoundFolio } from '@/components/folio/NotFoundFolio';

export const metadata: Metadata = {
  title: 'Page not found — Quality Homes Reality',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return <NotFoundFolio bare />;
}
