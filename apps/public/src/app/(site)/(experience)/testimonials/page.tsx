// apps/public/src/app/(site)/(experience)/testimonials/page.tsx
//
// DELIBERATELY EMPTY OF TESTIMONIALS.
//
// The instruction was to source these from the web. Any quote found elsewhere
// and placed here would be attributed to a Quality Homes Reality buyer who
// never said it — a fabricated review. That is deceptive to the people this
// page is meant to reassure, and under the Consumer Protection Act 2019 and the
// CCPA's guidelines on fake reviews it is an exposure for the client rather
// than an asset.
//
// So the page ships as a working shell: drop real, attributable testimonials
// into TESTIMONIALS below and it renders them. Until then it says plainly that
// there are none, which is a more persuasive thing to read than five invented
// five-star quotes that every buyer has learned to discount anyway.
//
// noindex while empty — an empty page should not compete in search.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = {
  title: 'In their words — Quality Homes Reality',
  description:
    'Accounts from people who have bought at Kartikeya Water Front, Lucky Garden and VSR Gayatri Township.',
  robots: { index: false, follow: true },
};

interface Testimonial {
  quote: string;
  name: string;
  /** Which layout they bought at — buyers weigh a same-project account far
   *  more heavily than a general one. */
  project: string;
  /** Consent to publish is not optional: a name and words attached to a
   *  purchase are personal data under the DPDP Act. */
  consentOnFile: boolean;
}

const TESTIMONIALS: Testimonial[] = [];

export default function TestimonialsPage() {
  const publishable = TESTIMONIALS.filter((t) => t.consentOnFile);

  return (
    <>
      <RouteTelemetry routeId="testimonials" />
      <Surface
        eyebrow="In their words"
        title="What buyers say"
        lede="Accounts from people who have actually bought here."
      >
        {publishable.length === 0 ? (
          <>
            <p>
              We have not published any testimonials yet. Nothing here is
              borrowed, rewritten from elsewhere, or written in-house and
              attributed to a customer — so until real buyers have given us
              their words and their permission to use them, this page stays
              empty.
            </p>
            <p>
              If you would rather hear it from someone who has bought, ask the
              branch handling your enquiry to put you in touch. That is a
              slower answer than a wall of quotes, and a more useful one.
            </p>
            <p className="mt-8">
              <Link
                className="underline underline-offset-4 hover:text-[#F2EDE4]"
                href="/contact"
              >
                Ask to speak to a buyer
              </Link>
            </p>
          </>
        ) : (
          <div className="space-y-10">
            {publishable.map((t) => (
              <figure key={t.name} className="border-t border-white/10 pt-6">
                <blockquote className="font-serif text-lg leading-relaxed text-[#F2EDE4]/90">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-3 text-sm text-[#F2EDE4]/55">
                  {t.name} &middot; {t.project}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </Surface>
    </>
  );
}
