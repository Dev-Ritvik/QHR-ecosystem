// apps/public/src/app/(site)/(experience)/locations/page.tsx
//
// A PLACE (mapped to 'window'). Every landmark, road and distance below is
// printed on one of the three brochures — the Kartikeya sheet carries its own
// access map and nearby temples, the Gayatri brochure lists the institutions
// around it and its distance to the National Highway.
//
// No distance, travel time or price has been estimated. Where a brochure states
// a figure it is quoted; where it does not, nothing is claimed.

import type { Metadata } from 'next';
import Link from 'next/link';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = {
  title: 'Locations — Quality Homes Reality',
  description:
    'Where the three layouts sit: Poosapatirega and Garividi in Vizianagaram district, and Bayyannapeta near Allinagaram in Srikakulam.',
};

interface Site {
  slug: string;
  name: string;
  where: string;
  district: string;
  access: string[];
  near: { label: string; items: string[] }[];
}

const SITES: Site[] = [
  {
    slug: 'kartikeya-water-front',
    name: 'Kartikeya Water Front',
    where: 'Poosapatirega',
    district: 'Vizianagaram',
    access: [
      'Off AH-16, with the layout entrance on the Poosapatirega side',
      'Roads signposted to Vizianagaram, Visakhapatnam and Srikakulam',
      'Agraharam is the neighbouring settlement on the highway approach',
    ],
    near: [
      {
        label: 'Landmarks',
        items: ['Ramatheertham', 'Heritage Kumili Temple', 'Vizianagaram Fort'],
      },
    ],
  },
  {
    slug: 'lucky-garden',
    name: 'Lucky Garden',
    where: 'Kumaram Village, Garividi',
    district: 'Vizianagaram',
    access: [
      'Reached from the Garividi side of Kumaram Village',
      'Internal roads laid out at 20 feet, as marked on the layout plan',
    ],
    near: [],
  },
  {
    slug: 'vsr-gayatri-township',
    name: 'VSR Gayatri Township',
    where: 'Bayyannapeta, Pedaraopalle, near Allinagaram',
    district: 'Srikakulam',
    access: [
      'Two kilometres from the National Highway',
      'On the Allinagaram road, off the Chilakapalem junction approach',
      'Internal roads laid out at 40 feet, as marked on the layout plan',
    ],
    near: [
      {
        label: 'Education',
        items: [
          'Sri Sivani Engineering College',
          'Sri Sivani Polytechnic College',
          'Ambedkar University',
          'Sri Venkateswara College of Engineering & Technology',
          'Kesava Reddy Residential & Non-Residential School',
          'RGVKT IIIT campus',
          'Sri Kinjarapu Errannaidu Agricultural College',
          'N.E.R Schools',
          'A.P. Residential Model School, S.M. Puram',
          'Government ITI College',
        ],
      },
      { label: 'Civic', items: ['Police Training Academy', 'R.T.O. Office'] },
    ],
  },
];

export default function LocationsPage() {
  return (
    <>
      <RouteTelemetry routeId="locations" />
      <main className="relative z-10 mx-auto w-full max-w-4xl px-6 py-16 md:py-24">
        <p className="text-xs uppercase tracking-[0.2em] text-[#F2EDE4]/50">
          Locations
        </p>
        <h1 className="mt-3 font-serif text-3xl text-[#F2EDE4] md:text-4xl">
          Where the ground actually is
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#F2EDE4]/70">
          All three layouts sit in the northern coastal districts, within reach
          of the new Bhogapuram airport. What follows is taken from the approved
          layout plans and the project brochures — no distances or travel times
          have been estimated.
        </p>

        <div className="mt-12 space-y-12">
          {SITES.map((s) => (
            <section key={s.slug} className="border-t border-white/10 pt-8">
              <h2 className="font-serif text-2xl text-[#F2EDE4]">{s.name}</h2>
              <p className="mt-1 text-sm text-[#F2EDE4]/55">
                {s.where} &middot; {s.district} district
              </p>

              <h3 className="mt-6 text-xs uppercase tracking-[0.16em] text-[#F2EDE4]/60">
                Getting there
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-[#F2EDE4]/75 marker:text-[#F2EDE4]/50">
                {s.access.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>

              {s.near.map((group) => (
                <div key={group.label}>
                  <h3 className="mt-6 text-xs uppercase tracking-[0.16em] text-[#F2EDE4]/60">
                    {group.label} nearby
                  </h3>
                  <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[15px] text-[#F2EDE4]/75">
                    {group.items.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              ))}

              <p className="mt-6">
                <Link
                  href={`/projects/${s.slug}`}
                  className="text-sm uppercase tracking-[0.14em] text-[#F2EDE4]/60 underline-offset-4 hover:text-[#F2EDE4] hover:underline"
                >
                  See the layout
                </Link>
              </p>
            </section>
          ))}
        </div>

        <p className="mt-14 text-sm text-[#F2EDE4]/55">
          Why the airport matters to this stretch of coast is set out in the{' '}
          <Link className="underline underline-offset-4 hover:text-[#F2EDE4]" href="/investment-guide">
            investment guide
          </Link>
          .
        </p>
      </main>
    </>
  );
}
