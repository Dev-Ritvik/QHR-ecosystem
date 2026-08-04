// apps/public/src/app/(site)/(experience)/downloads/page.tsx
//
// A SURFACE read from the study.
//
// Only the three layout plans are offered, because they are the only documents
// we hold. Brochures, price lists and approval certificates are deliberately
// absent rather than listed as "coming soon" — a download page whose links do
// not resolve is worse than a short one.
//
// Note the file sizes are stated. A buyer on a metered connection in
// Vizianagaram deserves to know before tapping, and it costs one line.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = {
  title: 'Downloads — Quality Homes Reality',
  description:
    'Approved layout plans for Kartikeya Water Front, Lucky Garden and VSR Gayatri Township.',
};

const FILES = [
  {
    slug: 'kartikeya-water-front',
    name: 'Kartikeya Water Front',
    where: 'Poosapatirega, Vizianagaram',
    href: '/downloads/kartikeya-water-front-layout.pdf',
    size: '118 KB',
    note: 'VMRDA RERA layout. Plots at 30′×50′, 30′×56′ and 30′×60′.',
  },
  {
    slug: 'lucky-garden',
    name: 'Lucky Garden',
    where: 'Kumaram Village, Garividi, Vizianagaram',
    href: '/downloads/lucky-garden-layout.pdf',
    size: '288 KB',
    note: 'Plot status marked on the sheet, with the future extension to the west.',
  },
  {
    slug: 'vsr-gayatri-township',
    name: 'VSR Gayatri Township',
    where: 'Bayyannapeta, near Allinagaram, Srikakulam',
    href: '/downloads/vsr-gayatri-township-layout.pdf',
    size: '630 KB',
    note: 'SUDA approved, F.L.P. No. 10/2025/1178/DTCP/DPMS. Plots at 60′×30′.',
  },
];

export default function DownloadsPage() {
  return (
    <>
      <RouteTelemetry routeId="downloads" />
      <Surface
        eyebrow="Downloads"
        title="Take the plans with you"
        lede="The three approved layout plans, sized to print at A3 and small enough to send on."
      >
        <ul className="space-y-6">
          {FILES.map((f) => (
            <li key={f.slug} className="border-t border-white/10 pt-6 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <div className="min-w-0">
                  <h2 className="font-serif text-xl text-[#F2EDE4]">{f.name}</h2>
                  <p className="mt-1 text-sm text-[#F2EDE4]/55">{f.where}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#F2EDE4]/75">
                    {f.note}
                  </p>
                </div>
                <a
                  href={f.href}
                  download
                  className="shrink-0 rounded border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.14em] text-[#F2EDE4] transition hover:border-amber-200/60 focus:outline-none focus:ring-2 focus:ring-amber-200/50"
                >
                  Layout plan &middot; PDF {f.size}
                </a>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-14 border-t border-white/10 pt-6 text-sm leading-relaxed text-[#F2EDE4]/55">
          Title documents, encumbrance certificates and the approval papers for a
          specific plot are not published here — they are shared on request, for
          the plot you are actually considering. Ask the branch handling your
          enquiry, or see what to check for in the{' '}
          <Link className="underline underline-offset-4" href="/investment-guide">
            investment guide
          </Link>
          .
        </p>
      </Surface>
    </>
  );
}
