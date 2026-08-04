// apps/public/src/app/(site)/(experience)/about/page.tsx
//
// A SURFACE read from the study.
//
// ---------------------------------------------------------------------------
// Sourcing rule for this page
// ---------------------------------------------------------------------------
//
// Everything here is corroborated on BOTH of the client's own sites
// (qualityhomesreality.com, the legacy site, and qualityhomesreality.in, the
// newer one). Where the two disagree, nothing was published.
//
// Deliberately NOT carried over from the .in home page, which presents these
// under a heading reading "Verified credentials":
//
//   ISO 9001 CERTIFIED · CREDAI MEMBER · NATIONAL REALTY EXCELLENCE AWARD ·
//   TOP MOST SENIOR DEVELOPER OF ANDHRA PRADESH · plus a press strip naming
//   Economic Times, Hindu Business, Construction World and two others.
//
// None of it appears on the legacy site — the one that has actually been
// trading for twenty years — and a firm holding ISO 9001 or a CREDAI
// membership puts that on every property it owns. Each is a third-party claim
// with a public register behind it, so each is checkable, and each is a
// misleading-advertisement exposure under the Consumer Protection Act 2019 if
// it is wrong. They go up when the certificates arrive, not before. PROGRESS.md.
//
// The leadership block there names nobody — three titles with generic duties —
// so there is no one to introduce yet either.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = {
  title: 'About — Quality Homes Reality',
  description:
    'Twenty years of plotted layouts, farmlands and gated communities across the northern coastal districts of Andhra Pradesh, sold from offices in the districts where the land is.',
};

// Both sites carry these four figures identically.
const FIGURES = [
  { value: '20', unit: 'years', label: 'in the field' },
  { value: '5,000', unit: '', label: 'customers' },
  { value: '12', unit: 'lakh sq yd', label: 'developed' },
  { value: '8', unit: 'lakh sq yd', label: 'in development' },
];

export default function AboutPage() {
  return (
    <>
      <RouteTelemetry routeId="about" />
      <Surface
        eyebrow="About"
        title="Building communities. Creating futures."
        lede="Quality Homes Reality has been developing land in the northern coastal districts of Andhra Pradesh for more than twenty years — farmlands, residential plots, villas and apartments, sold from offices in the districts where the land actually is."
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-y border-white/10 py-8 sm:grid-cols-4">
          {FIGURES.map((f) => (
            <div key={f.label}>
              <dt className="font-serif text-3xl text-[#F2EDE4]">
                {f.value}
                {f.unit ? (
                  <span className="ml-1.5 text-sm tracking-wide text-[#F2EDE4]/50">{f.unit}</span>
                ) : null}
              </dt>
              <dd className="mt-1 text-xs uppercase tracking-[0.14em] text-[#F2EDE4]/45">
                {f.label}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-10 text-[15px] leading-relaxed text-[#F2EDE4]/75">
          The business has always been built around one idea: that a planned,
          gated address should not be a luxury reserved for the state capital.
          Most of what the company has sold is plotted land, bought by families
          who intend to build on it themselves — at a price that leaves them
          enough left over to do so.
        </p>

        <figure className="mt-12 border-l-2 border-amber-200/40 pl-6">
          <blockquote lang="te" className="font-serif text-xl leading-relaxed text-[#F2EDE4]">
            భూమిలో పెట్టుబడి పెట్టండి, అది ఎప్పుడూ నిరాశపరచదు.
          </blockquote>
          <p className="mt-3 text-[15px] leading-relaxed text-[#F2EDE4]/60">
            Invest in land — it will never disappoint you.
          </p>
          <figcaption className="mt-4 text-xs uppercase tracking-[0.14em] text-[#F2EDE4]/40">
            Managing Director
          </figcaption>
        </figure>

        <section className="mt-14">
          <h2 className="text-xs uppercase tracking-[0.16em] text-[#F2EDE4]/45">Vision</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#F2EDE4]/75">
            To be acknowledged as India&rsquo;s leading and most trusted real estate
            enterprise by nurturing a transparent, trustworthy and professional
            work culture that endears us to discerning customers, and by
            continuously expanding our offerings to reach a wider market.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-[0.16em] text-[#F2EDE4]/45">Mission</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#F2EDE4]/75">
            To be the provider of choice for global-standard residential
            properties by delivering projects enriched with innovative design,
            exceptional location, harmonious environs, superior quality,
            world-class amenities, best-in-class security and unmatched value.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-[0.16em] text-[#F2EDE4]/45">Values</h2>
          <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-2">
            {['Quality', 'On-time possession', 'Integrity', 'Reliability', 'Transparency'].map(
              (v) => (
                <li
                  key={v}
                  className="rounded border border-white/15 px-3 py-1.5 text-sm text-[#F2EDE4]/80"
                >
                  {v}
                </li>
              ),
            )}
          </ul>
        </section>

        <p className="mt-14 border-t border-white/10 pt-6 text-sm leading-relaxed text-[#F2EDE4]/55">
          Three layouts are open right now, in Vizianagaram and Srikakulam
          districts. You can see{' '}
          <Link className="underline underline-offset-4 hover:text-[#F2EDE4]" href="/properties">
            what is on offer
          </Link>
          , or read{' '}
          <Link className="underline underline-offset-4 hover:text-[#F2EDE4]" href="/why-us">
            how we work
          </Link>
          .
        </p>
      </Surface>
    </>
  );
}
