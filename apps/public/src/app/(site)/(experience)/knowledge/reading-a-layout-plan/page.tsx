// apps/public/src/app/(site)/(experience)/knowledge/reading-a-layout-plan/page.tsx
//
// A SURFACE. Inherits 'study' through its parent — see placeForRoute, which
// resolves dynamic children to their parent's place.
//
// Content is drawn from the three approved layout plans in this project, which
// makes it concrete rather than generic: every convention described can be
// pointed at on a sheet the reader can open in the gallery.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = {
  title: 'How to read a layout plan — Quality Homes Reality',
  description:
    'Road widths, plot dimensions, open space and utility parcels: what a layout drawing tells you that a brochure will not.',
};

export default function ReadingALayoutPlanPage() {
  return (
    <>
      <RouteTelemetry routeId="knowledge/reading-a-layout-plan" />
      <Surface
        eyebrow="Knowledge · 4 min"
        title="How to read a layout plan"
        lede="The drawing is the honest document. It is also the one most buyers skip."
        fallbackHref="/knowledge"
      >
        <p>
          A brochure is written to persuade. A layout plan is submitted for
          approval, which means it has to be accurate. If the two disagree, the
          plan is the one that matters — and it is usually the only document a
          buyer is handed that shows exactly what they are getting.
        </p>

        <h2 className="mt-10 font-serif text-xl text-[#F2EDE4]">
          Start with the roads
        </h2>
        <p>
          Every internal road carries a stated width. On our Kartikeya Water
          Front sheet they read 40′ and 30′; on VSR Gayatri Township, 40′
          throughout. Width decides whether two cars pass comfortably, whether a
          construction lorry can reach your plot, and how the layout feels once
          it is built out. A plot on a 40′ road and the same plot on a 20′ road
          are not the same asset.
        </p>
        <p>
          Check where your plot sits relative to the entrance, and how many turns
          it takes to reach. Corner plots on wider roads carry a premium for a
          reason, and the drawing shows you which they are before anyone tells
          you.
        </p>

        <h2 className="mt-10 font-serif text-xl text-[#F2EDE4]">
          Then the plot dimensions
        </h2>
        <p>
          Plots are marked in feet — 30′×50′, 30′×60′, 60′×30′. The first figure
          is normally the frontage. Two plots of identical area can differ
          considerably in what you can build, because frontage and depth drive
          the setbacks. Where a sheet marks an irregular plot, it usually notes
          each edge separately; those are worth measuring rather than assuming.
        </p>

        <h2 className="mt-10 font-serif text-xl text-[#F2EDE4]">
          Find the parcels that are not for sale
        </h2>
        <p>
          Approved layouts must set aside land that is not sold to anyone: open
          space, utility areas, and sometimes an amenity parcel. On the Gayatri
          sheet these are labelled Public Open Space, Utility Area and Amenity
          with their own plot numbers. On Kartikeya Water Front the same role is
          played by the landscaped belt and the lake frontage.
        </p>
        <p>
          These matter twice over. They are what stops the layout being built
          wall to wall, and they are a check on the seller — a layout with
          generous, clearly marked open space has been planned rather than
          maximised.
        </p>

        <h2 className="mt-10 font-serif text-xl text-[#F2EDE4]">
          Read the boundary
        </h2>
        <p>
          The site boundary tells you what you back onto. Agricultural land,
          another layout and a highway are three very different neighbours, and
          the sheet names them. On our Gayatri plan the adjoining survey numbers
          and the village road are marked; on Kartikeya Water Front the
          approach roads to Vizianagaram, Visakhapatnam and Srikakulam are
          shown at the edge.
        </p>

        <h2 className="mt-10 font-serif text-xl text-[#F2EDE4]">
          Last, the approval block
        </h2>
        <p>
          Somewhere on the sheet is the authority and the order number. That
          single line is what makes everything else on the drawing enforceable.
          Photograph it, and check it against the authority&rsquo;s own records
          rather than taking the printed sheet as proof.
        </p>

        <p className="mt-10">
          All three of our plans are on the{' '}
          <Link className="underline underline-offset-4" href="/gallery">
            gallery page
          </Link>{' '}
          at full size, and standing in the{' '}
          <Link className="underline underline-offset-4" href="/hall">
            hall
          </Link>{' '}
          you can read them as raised models. What to verify beyond the drawing
          is in the{' '}
          <Link className="underline underline-offset-4" href="/investment-guide">
            investment guide
          </Link>
          .
        </p>
      </Surface>
    </>
  );
}
