// apps/public/src/app/(site)/(experience)/not-found.tsx
//
// The not-found boundary of the experience group: an unmatched address (the
// catch-all beside this), or a layout that does not exist. A folio, with the
// hall behind it. NotFoundFolio.tsx has the account.

import type { Metadata } from 'next';
import { NotFoundFolio } from '@/components/folio/NotFoundFolio';

export const metadata: Metadata = {
  title: 'Page not found — Quality Homes Reality',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return <NotFoundFolio />;
}
