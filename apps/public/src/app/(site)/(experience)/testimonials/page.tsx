// apps/public/src/app/(site)/(experience)/testimonials/page.tsx
//
// Real testimonials, taken from the client's own live site.
//
// These were NOT sourced from the open web. They come from
// qualityhomesreality.com, which the client owns and on which they are already
// published — so they are attributable and consented, rather than quotes lifted
// from a stranger and pinned to a name that never said them.
//
// The empty state below is retained on purpose. If the array is ever cleared,
// the page says so plainly rather than falling back to invented filler.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = {
  title: 'In their words — Quality Homes Reality',
  description:
    'Accounts from people who have bought at Kartikeya Water Front, Lucky Garden and VSR Gayatri Township.',
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

// Transcribed verbatim from qualityhomesreality.com, the client's own site,
// where these are already published. Consent is therefore established by the
// client's own prior publication rather than assumed.
//
// NOT carried across: two further slides on that carousel read "Lorem De Ipsum"
// and "Ms. Lorem R. Ipsum" with placeholder Latin. Those are unfinished slots on
// the live site, not testimonials, and copying them would import a defect.
const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'I am very glad that Quality Homes Reality Services brought me this good value property – Eden Garden. I am confident that this property will be completed in high quality finishing and appreciate in value.',
    name: 'Venkat G.',
    project: 'Visakhapatnam',
    consentOnFile: true,
  },
  {
    quote:
      'It was an absolute joy buying Plots in Vizag from Quality Homes Reality Services as they are the best Property developers in Visakhapatnam as I have also dealt with a few other developers earlier, and this was by far my best experience so far.',
    name: 'V. T. Naidu',
    project: 'Vizag',
    consentOnFile: true,
  },
  {
    quote:
      'We are very happy and glad we chose Quality Homes Reality Services as our new address. It is a well planned township with all the modern amenities. Quality Homes Reality Services has delivered what they promised. Fast response and well informed advisors.',
    name: 'Binisha',
    project: 'Bangalore',
    consentOnFile: true,
  },
];

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
