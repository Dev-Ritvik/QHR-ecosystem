// apps/monolith/src/app/(experience)/downloads/page.tsx
//
// STANDALONE variant — a hard load or a shared link to /downloads.
//
// This does NOT pass through @modal/layout.tsx: that layout wraps the parallel
// slot only. So this route renders the same chrome explicitly (§4.2, "direct-hit
// parity"). If the two ever drift, a shared link produces an unstyled page —
// which is why both call the identical UtilityContent component rather than
// each having their own markup.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UTILITY_PAGES } from '@/lib/utility-content';
import { UtilityContent } from '@/components/command/UtilityContent';
import { StandaloneShell } from '@/components/command/StandaloneShell';

const PAGE = UTILITY_PAGES['downloads'];

export const metadata: Metadata = {
  title: PAGE ? `${PAGE.title} — Quality Homes Reality` : 'Quality Homes Reality',
  description: PAGE?.lede,
};

export default function Page() {
  if (!PAGE) notFound();
  return (
    <StandaloneShell>
      <UtilityContent page={PAGE} />
    </StandaloneShell>
  );
}
