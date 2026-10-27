// apps/public/src/app/(site)/(experience)/projects/page.tsx
//
// THE LAYOUTS: the index the site did not have.
//
// The plan of twenty-six pages has had "Projects" on it from the start, the
// route registry has named /projects since the surface system was written
// (places.ts: the hall), and three pages are its children — and there was no
// page at it. A visitor who cut the slug off a layout's address, or followed
// the registry's own entry, was given a 404.
//
// WHAT IT SAYS, AND FROM WHERE. What each layout IS comes off its sanctioned
// sheet and its brochure (lib/layouts.ts has the account, and the rule about
// compass points and keys the sheets do not print). How many plots it has and
// how many are open is read from the register the offices keep
// (lib/published.ts), as the film reads it: never typed here.
//
// AN INDEX, NOT A SECOND COPY OF EACH LAYOUT'S PAGE (the forensic audit of
// 2026-10-09, #86: each layout's one-line description, its roads and its
// approval stood here and on its own page word for word; #84: the band "The
// plan is the promise. The land is the proof." on four pages). What a buyer
// compares is here in a few words each: the count, the sizes, how wide the
// roads, whose approval. The sentence about a layout is on its page.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import {
  Figures,
  Folio,
  Gilt,
  Go,
  Actions,
  Ledger,
  NextPage,
  Note,
  Paper,
  Plate,
  Sheet,
  Window,
} from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { LAYOUTS, plotAreaLabel } from '@/lib/layouts';
import { countLine, num, publishedLayouts, totals } from '@/lib/published';

export const metadata: Metadata = withShare('/projects', {
  title: pageTitle('/projects'),
  description:
    'Kartikeya Water Front, Lucky Garden and VSR Gayatri Township: three approved plotted layouts in Vizianagaram and Srikakulam districts, each with its sanctioned plan.',
});

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

export default async function ProjectsPage() {
  const next = pageAfter('/projects');
  const live = await publishedLayouts();
  const all = totals(live);
  const districts = Array.from(new Set(LAYOUTS.map((l) => l.district)));
  return (
    <>
      <RouteTelemetry routeId="projects" />
      <Folio>
        <Plate
          kicker="The land"
          title={
            <>
              {WORDS[LAYOUTS.length] ?? LAYOUTS.length} layouts. <Gilt>{WORDS[districts.length]} districts.</Gilt>
            </>
          }
          lede="Each is an approved plan of plots, roads and open ground, and each is open now."
          cue={{ label: 'The count', href: '#count' }}
        />

        <Sheet
          id="count"
          rail="The count"
          first
          layout="full"
          kicker="Today"
          title={
            <>
              How many plots <Gilt>are open.</Gilt>
            </>
          }
        >
          <Figures
            items={[
              { value: String(LAYOUTS.length), label: 'layouts open' },
              ...(all
                ? [
                    { value: num(all.total), label: 'plots drawn on their plans' },
                    { value: num(all.available), label: 'open today' },
                  ]
                : []),
              {
                value: String(LAYOUTS.reduce((n, l) => n + l.sizes.length, 0)),
                label: 'plot sizes between them',
              },
            ]}
          />
          <Note className="mt-12">
            {all ? 'Both counts are read from the offices’ register, as the film’s are. ' : null}
            The branch that holds a layout gives its open plot numbers for the day you ask.
          </Note>
        </Sheet>

        {LAYOUTS.map((l, i) => {
          const count = countLine(live.find((p) => p.slug === l.slug));
          return (
            <Sheet
              key={l.slug}
              id={l.slug}
              rail={l.name}
              layout="full"
              raised={i % 2 === 1}
              kicker={`${l.where} · ${l.district} district`}
              title={l.name}
            >
              {/* (An upright plan takes the width its height allows, and the
                  text beside it has the rest: folio.css.) */}
              <div className={'folio-plan' + (l.plan.w / l.plan.h < 1.25 ? ' is-upright' : '')}>
                <Paper
                  src={l.plan.src}
                  w={l.plan.w}
                  h={l.plan.h}
                  alt={`Sanctioned layout plan of ${l.name}`}
                  eager={i === 0}
                />
                <div>
                  <div>
                    <Ledger
                      rows={[
                        ...(count ? [{ term: 'Plots', value: count }] : []),
                        {
                          term: l.sizes.length === 1 ? 'Size' : 'Sizes',
                          value: (
                            <ul className="folio-stack">
                              {l.sizes.map((s) => (
                                <li key={s.label}>
                                  {s.label} <small>{plotAreaLabel(s)}</small>
                                </li>
                              ))}
                            </ul>
                          ),
                        },
                        { term: 'Roads', value: `${l.roadWidths.map((w) => `${w} ft`).join(' and ')} wide` },
                        { term: 'Approval', value: l.approval.short },
                      ]}
                    />
                  </div>
                  <Actions>
                    <Go href={`/projects/${l.slug}`}>The whole layout</Go>
                    <Go href={l.plan.pdf} download>
                      The plan, {l.plan.pdfSize}
                    </Go>
                  </Actions>
                </div>
              </div>
            </Sheet>
          );
        })}

        <Window gloss="Each of the three is raised from its sanctioned drawing, on a table of its own.">
          See them <Gilt>standing in the hall.</Gilt>
        </Window>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
