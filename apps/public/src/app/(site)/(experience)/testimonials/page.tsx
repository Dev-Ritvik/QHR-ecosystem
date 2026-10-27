// apps/public/src/app/(site)/(experience)/testimonials/page.tsx
//
// Real testimonials, taken from the client's own live site.
//
// These were NOT sourced from the open web. They come from
// qualityhomesreality.com, which the client owns and on which they are already
// published — so they are attributable and consented, rather than quotes lifted
// from a stranger and pinned to a name that never said them.
//
// AND THE PAGE SAYS WHERE THEY ARE FROM. Its description used to call these
// "accounts from people who have bought at Kartikeya Water Front, Lucky Garden
// and VSR Gayatri Township". Nothing in them says so — one names an earlier
// project, the others name none — and the place printed under each is the
// buyer's own, as the company's site gives it. They are the company's buyers;
// they are not claimed for the three layouts open today.
//
// IN ONE LINE, NOT A SECTION (the forensic audit of 2026-10-09, #88: "the
// page's long explanation of that draws attention to it. Expected: dated
// accounts from buyers of these layouts, or a shorter page"; #84 on its
// heading, "Three, because three are real."). Dated accounts from buyers of
// the three layouts are the client's to supply. Until then this is the shorter
// page: the three accounts, one line on whose they are and which development
// one of them names, and the way to the layouts that are open.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import { Actions, Folio, Gilt, Go, NextPage, Plate, Quote, Sheet } from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = withShare('/testimonials', {
  title: pageTitle('/testimonials'),
  description:
    'Accounts from people who have bought from Quality Homes Reality, in their own words, as the company publishes them.',
});

interface Testimonial {
  quote: string;
  name: string;
  /** Where the buyer is, as the company's site gives it. */
  place: string;
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
    place: 'Visakhapatnam',
    consentOnFile: true,
  },
  {
    quote:
      'It was an absolute joy buying Plots in Vizag from Quality Homes Reality Services as they are the best Property developers in Visakhapatnam as I have also dealt with a few other developers earlier, and this was by far my best experience so far.',
    name: 'V. T. Naidu',
    place: 'Vizag',
    consentOnFile: true,
  },
  {
    quote:
      'We are very happy and glad we chose Quality Homes Reality Services as our new address. It is a well planned township with all the modern amenities. Quality Homes Reality Services has delivered what they promised. Fast response and well informed advisors.',
    name: 'Binisha',
    place: 'Bangalore',
    consentOnFile: true,
  },
];

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

export default function TestimonialsPage() {
  const next = pageAfter('/testimonials');
  const publishable = TESTIMONIALS.filter((t) => t.consentOnFile);
  const n = publishable.length;
  // The one that names a development names it itself; the page only points.
  const eden = publishable.find((t) => t.quote.includes('Eden Garden'));

  return (
    <>
      <RouteTelemetry routeId="testimonials" />
      <Folio>
        <Plate
          kicker="The company"
          title={
            <>
              Buyers <Gilt>in their own words.</Gilt>
            </>
          }
          lede={
            n > 0
              ? 'Accounts from people who have bought from this company, as they wrote them.'
              : 'To hear from someone who has bought from this company, ask the branch to put you in touch.'
          }
          cue={n > 0 ? { label: 'The accounts', href: '#accounts' } : undefined}
        >
          {n === 0 ? <Go href="/contact">Ask to speak to a buyer</Go> : null}
        </Plate>

        {n > 0 ? (
          <Sheet
            id="accounts"
            rail="The accounts"
            first
            kicker="As they wrote them"
            title={
              <>
                {WORDS[n] ?? n} {n === 1 ? 'account' : 'accounts'} <Gilt>from buyers.</Gilt>
              </>
            }
            note={
              <>
                Each is printed as the company publishes it, with the buyer&rsquo;s name and place.
                {eden ? <> {eden.name} writes of Eden Garden, an earlier development.</> : null}
              </>
            }
          >
            <div className="folio-quotes">
              {publishable.map((t) => (
                <Quote key={t.name} by={t.name} where={t.place}>
                  &ldquo;{t.quote}&rdquo;
                </Quote>
              ))}
            </div>
            <Actions>
              <Go href="/projects">The three layouts open today</Go>
              <Go href="/book-a-site-visit">Walk one of them</Go>
            </Actions>
          </Sheet>
        ) : null}

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
