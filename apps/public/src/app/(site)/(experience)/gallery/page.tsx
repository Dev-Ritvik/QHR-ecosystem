// apps/public/src/app/(site)/(experience)/gallery/page.tsx
//
// A FOLIO, read from the hall.
//
// What is here is what genuinely exists: the three approved layout plans, which
// are the most informative images the client has — a buyer learns more from a
// plot grid than from a stock render.
//
// EACH SHEET AT THE PAGE'S FULL WIDTH, and each opens as the file itself. They
// were set in a 768px column, where a plot number is three pixels tall: "full
// size" was the page's title and not its fact.
//
// THE SHEETS, AND NOTHING SAID TWICE (the forensic audit of 2026-10-09). Each
// plan stood here over its layout's one-line description, its "on this sheet"
// list and its figures, all three of which are that layout's own page word for
// word (#86: "each layout's description is repeated on three"), and the page
// ended in a section headed "No photographs, and why." (#85, #87: a section
// that is a notice that its content is not there). The plans are the page.
// What to look for on a sheet is on the layout's page, beside the same sheet;
// when the register holds photographs of a site they are on that layout's
// page too (projects/[projectSlug], "Photographs"), and a section with nothing
// in it is not on a page.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import { Actions, Folio, Gilt, Go, NextPage, Paper, Plate, Sheet } from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { LAYOUTS } from '@/lib/layouts';

export const metadata: Metadata = withShare('/gallery', {
  title: pageTitle('/gallery'),
  description:
    'Approved layout plans for Kartikeya Water Front, Lucky Garden and VSR Gayatri Township.',
});

type Layout = (typeof LAYOUTS)[number];

const paper = (l: Layout, eager: boolean) => (
  <Paper src={l.plan.src} w={l.plan.w} h={l.plan.h} alt={`Sanctioned layout plan of ${l.name}`} eager={eager} />
);

const actions = (l: Layout) => (
  <Actions>
    <Go href={`/projects/${l.slug}#plan`}>What to look for on it</Go>
    <Go href={l.plan.pdf} download>
      Take it with you, {l.plan.pdfSize}
    </Go>
  </Actions>
);

export default function GalleryPage() {
  const next = pageAfter('/gallery');
  return (
    <>
      <RouteTelemetry routeId="gallery" />
      <Folio>
        <Plate
          kicker="The land"
          title={
            <>
              The plans, <Gilt>full size.</Gilt>
            </>
          }
          lede="The same three plans that stand on the tables in the hall — here as flat sheets you can read closely or take away."
          cue={{ label: LAYOUTS[0].name, href: `#${LAYOUTS[0].slug}` }}
        />

        {LAYOUTS.map((l, i) => (
          <Sheet
            key={l.slug}
            id={l.slug}
            rail={l.name}
            first={i === 0}
            layout="full"
            kicker={`${l.where}, ${l.district}`}
            title={l.name}
          >
            {/* ONE LAYOUT FOR THE THREE (the forensic audit of 2026-10-09,
                #65: "the first plan has its picture on the left and its lists
                on the right; the second and third have the picture full width
                with the lists underneath ... Expected: one layout for all
                three, with plan pictures cropped to a common proportion").
                The sheets are 1.03, 1.69 and 1.40 wide for their height, and
                a sanctioned plan is not cropped: each is laid whole on a mount
                of one proportion (folio.css, .folio-plan.is-mounted), and what
                can be done with it stands beside the mount, on one edge. */}
            <div className="folio-plan is-mounted">
              {paper(l, i === 0)}
              <div>{actions(l)}</div>
            </div>
          </Sheet>
        ))}

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
