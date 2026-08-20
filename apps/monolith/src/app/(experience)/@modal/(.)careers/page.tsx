// apps/monolith/src/app/(experience)/@modal/(.)careers/page.tsx
//
// INTERCEPTED variant — soft navigation to /careers from inside the experience.
//
// Next matches (.)careers at the same tree depth as the interceptor, which is
// why each page needs its own folder rather than one dynamic catch-all
// (§4.2 [RESOLVED §5]). That cost buys clean top-level URLs.
//
// Rendering this mounts @modal/layout.tsx, which mounts ModalOpener, which
// starts the freeze sequence. The narrative underneath is never unmounted.
import { notFound } from 'next/navigation';
import { UTILITY_PAGES } from '@/lib/utility-content';
import { UtilityContent } from '@/components/command/UtilityContent';

const PAGE = UTILITY_PAGES['careers'];

export default function InterceptedPage() {
  if (!PAGE) notFound();
  return <UtilityContent page={PAGE} />;
}
