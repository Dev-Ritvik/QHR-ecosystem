// apps/public/src/app/(site)/(experience)/careers/page.tsx
//
// A SURFACE read from the desk.
//
// Roles, requirements and contact details are transcribed from the career page
// on qualityhomesreality.com, which the client owns. Nothing about salary,
// benefits, team size or culture is stated, because none of that appears there
// and a careers page that invents it is the fastest way to lose a candidate in
// their first week.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = {
  title: 'Careers — Quality Homes Reality',
  description:
    'Open roles at Quality Homes Reality across Visakhapatnam, Vizianagaram and Srikakulam.',
};

const ROLES = [
  {
    title: 'Sales Executive',
    experience: '1–3 years, real estate preferred',
    education: 'Any graduate',
    location: 'Andhra Pradesh',
  },
  {
    title: 'Senior Sales Executive',
    experience: '1–4 years, real estate preferred',
    education: 'Any graduate',
    location: 'Andhra Pradesh',
  },
];

const APPLY_EMAIL = 'qualityhomesreality@gmail.com';

export default function CareersPage() {
  return (
    <>
      <RouteTelemetry routeId="careers" />
      <Surface
        eyebrow="Careers"
        title="Join the team"
        lede="We sell land we have walked. If you would rather know a site properly than read from a script, these are the roles open now."
      >
        <div className="space-y-8">
          {ROLES.map((r) => (
            <section
              key={r.title}
              className="border-t border-white/10 pt-6 first:border-0 first:pt-0"
            >
              <h2 className="font-serif text-xl text-[#F2EDE4]">{r.title}</h2>
              <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-[#F2EDE4]/60">
                    Experience
                  </dt>
                  <dd className="mt-1 text-[15px] text-[#F2EDE4]/80">
                    {r.experience}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-[#F2EDE4]/60">
                    Education
                  </dt>
                  <dd className="mt-1 text-[15px] text-[#F2EDE4]/80">
                    {r.education}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-[#F2EDE4]/60">
                    Location
                  </dt>
                  <dd className="mt-1 text-[15px] text-[#F2EDE4]/80">
                    {r.location}
                  </dd>
                </div>
              </dl>
            </section>
          ))}
        </div>

        <h2 className="mt-14 font-serif text-xl text-[#F2EDE4]">How to apply</h2>
        <p>
          Send a CV to{' '}
          <a
            className="underline underline-offset-4"
            href={`mailto:${APPLY_EMAIL}?subject=Application%20%E2%80%94%20Sales%20Executive`}
          >
            {APPLY_EMAIL}
          </a>
          , naming the role in the subject line. Applications are read at the
          Visakhapatnam head office and passed to whichever branch is hiring.
        </p>
        <p>
          Telephone{' '}
          <a className="underline underline-offset-4" href="tel:+919553513366">
            +91 95535 13366
          </a>{' '}
          if you would rather ask about a role before applying.
        </p>

        <p className="mt-10 text-sm leading-relaxed text-[#F2EDE4]/55">
          A CV sent to us is handled as set out in the{' '}
          <Link className="underline underline-offset-4" href="/privacy">
            privacy notice
          </Link>
          . Office addresses are on the{' '}
          <Link className="underline underline-offset-4" href="/branches">
            offices page
          </Link>
          .
        </p>
      </Surface>
    </>
  );
}
