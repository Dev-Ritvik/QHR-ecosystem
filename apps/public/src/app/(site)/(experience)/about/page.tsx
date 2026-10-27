// apps/public/src/app/(site)/(experience)/about/page.tsx
//
// A FOLIO, opened on the founder's portrait.
//
// ---------------------------------------------------------------------------
// Sourcing rule for this page
// ---------------------------------------------------------------------------
//
// Everything here is corroborated on BOTH of the client's own sites
// (qualityhomesreality.com, the legacy site, and qualityhomesreality.in, the
// newer one). Where the two disagree, nothing was published. The facts
// themselves are kept in lib/company.ts, which has the full account.
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
// The leadership block there names nobody — three titles with generic duties.
// The one name this page carries is the Managing Director's, which the client
// supplied for the nameplate under his portrait in the hall.
//
// THE ACREAGE in the note under the figures is arithmetic on the company's own
// numbers (4,840 square yards to the acre), given because a reader abroad does
// not think in lakhs of square yards. It is not a figure of its own.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import { BRANCHES } from '@estate/domain/leads/branches';
import {
  Figures,
  Folio,
  Gilt,
  IndexList,
  Ledger,
  NextPage,
  Note,
  Plate,
  Prose,
  Sheet,
  Window,
} from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { COMPANY } from '@/lib/company';
import { LAYOUTS } from '@/lib/layouts';

export const metadata: Metadata = withShare('/about', {
  title: pageTitle('/about'),
  description:
    'Twenty years of plotted layouts, farmlands and gated communities across the northern coastal districts of Andhra Pradesh, sold from offices in the districts where the land is.',
});

const OFFICES = (['visakhapatnam', 'vizianagaram', 'srikakulam'] as const).map((id) => BRANCHES[id]);

export default function AboutPage() {
  const next = pageAfter('/about');
  return (
    <>
      <RouteTelemetry routeId="about" />
      <Folio>
        <Plate
          kicker="The company"
          title={
            <>
              Land, sold from <Gilt>where the land is.</Gilt>
            </>
          }
          lede="Quality Homes Reality has been developing land in the northern coastal districts of Andhra Pradesh for more than twenty years."
          cue={{ label: 'In figures', href: '#figures' }}
        />

        <Sheet
          id="figures"
          rail="In figures"
          first
          layout="full"
          kicker="In figures"
          title={
            <>
              The company&rsquo;s <Gilt>own figures.</Gilt>
            </>
          }
        >
          <Figures items={COMPANY.figures.map((f) => ({ ...f }))} />
          <Note className="mt-12">
            The company&rsquo;s own figures, as it publishes them. A lakh is a hundred thousand:
            12 lakh sq yd is about 248 acres, and 8 lakh about 165.
          </Note>
        </Sheet>

        <Sheet
          id="idea"
          rail="The idea"
          kicker="The idea"
          title={
            <>
              A planned address is not <Gilt>a luxury of the capital.</Gilt>
            </>
          }
        >
          <Prose>
            <p className="folio-first">
              The business has always been built around one idea: that a planned, gated address
              should not be a luxury reserved for the state capital.
            </p>
            <p>
              Most of what the company has sold is plotted land, bought by families who intend to
              build on it themselves &mdash; at a price that leaves them enough left over to do so.
            </p>
            <p>
              In twenty years that has meant farmlands, residential plots, villas and apartments
              across the northern coastal districts. And it has meant selling them from offices in
              the districts where the land actually is: the branch that answers a question about a
              layout is the branch that holds it, and the one that will walk you over it.
            </p>
          </Prose>
        </Sheet>

        <Window
          lang="te"
          gloss={<>&ldquo;{COMPANY.motto.en}&rdquo;</>}
          by={
            <>
              {COMPANY.founder.name}, {COMPANY.founder.title}
            </>
          }
        >
          {COMPANY.motto.te}
        </Window>

        <Sheet
          id="words"
          rail="In its own words"
          kicker="In its own words"
          title={
            <>
              What the company <Gilt>says it is for.</Gilt>
            </>
          }
          note="Set down here as the company prints them."
        >
          <Ledger
            rows={[
              { term: 'Vision', value: COMPANY.vision },
              { term: 'Mission', value: COMPANY.mission },
              {
                term: 'Values',
                value: (
                  <ul className="folio-values">
                    {COMPANY.values.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                ),
              },
            ]}
          />
        </Sheet>

        <Sheet
          id="where"
          rail="Where it works"
          layout="full"
          kicker="Where it works"
          title={
            <>
              Three offices. <Gilt>Three layouts open.</Gilt>
            </>
          }
        >
          <div className="folio-pair">
            <div>
              <h3 className="folio-sub" data-reveal>
                The offices
              </h3>
              <IndexList
                two
                items={OFFICES.map((b) => ({
                  href: '/branches',
                  name: b.name,
                  line: (
                    <>
                      {b.role === 'head_office' ? 'Head office' : 'Branch'}. {b.address} &ndash;{' '}
                      {b.pincode}
                    </>
                  ),
                }))}
              />
            </div>
            <div>
              <h3 className="folio-sub" data-reveal>
                The layouts open now
              </h3>
              <IndexList
                two
                items={LAYOUTS.map((l) => ({
                  href: `/projects/${l.slug}`,
                  name: l.name,
                  line: (
                    <>
                      {l.where}, {l.district}. {l.approval.short}.
                    </>
                  ),
                }))}
              />
            </div>
          </div>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
