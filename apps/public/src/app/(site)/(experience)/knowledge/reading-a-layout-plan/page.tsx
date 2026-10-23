// apps/public/src/app/(site)/(experience)/knowledge/reading-a-layout-plan/page.tsx
//
// A FOLIO. Inherits 'study' through its parent — see placeForRoute, which
// resolves dynamic children to their parent's place.
//
// Content is drawn from the three approved layout plans in this project, which
// makes it concrete rather than generic: every convention described can be
// pointed at on a sheet the reader can open in the gallery.
//
// AND IS POINTED AT (2026-10-06). The article described the sheets in words
// and sent the reader to another page to look. Each section now has the part
// of the sheet it is talking about beside it, enlarged (Detail, in Folio.tsx):
// the road labels, the boundary plots with their printed depths, the parcels
// that are not for sale. Every figure is a region of a plan this site already
// publishes; nothing is drawn or annotated for the purpose.
//
// A SECTION ADDED: "Read the marks". Two of the three sheets, as published,
// colour or hatch some plots and print no key. The pages used to say "plot
// status is marked on the sheet", which a reader cannot use. The article says
// what a reader should do about a mark with no key: ask.
//
// AND THE APPROVAL BLOCK. The article said it is "somewhere on the sheet". On
// the sheets published here, which are the drawings alone, it is not in view,
// and the article says so rather than send a reader to look for it.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import { Detail, Folio, Gilt, NextPage, Plate, Prose, Sheet, Window } from '@/components/folio/Folio';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { layoutBySlug } from '@/lib/layouts';
import { plotSize } from '@/lib/units';

export const metadata: Metadata = withShare('/knowledge/reading-a-layout-plan', {
  title: 'How to read a layout plan — Quality Homes Reality',
  description:
    'Road widths, plot dimensions, open space and utility parcels: what a layout drawing tells you that a brochure will not.',
});

const KARTIKEYA = layoutBySlug('kartikeya-water-front')!.plan;
const LUCKY = layoutBySlug('lucky-garden')!.plan;
const GAYATRI = layoutBySlug('vsr-gayatri-township')!.plan;

export default function ReadingALayoutPlanPage() {
  return (
    <>
      <RouteTelemetry routeId="knowledge/reading-a-layout-plan" />
      <Folio>
        <Plate
          long
          kicker="Knowledge · 4 min read"
          title={
            <>
              How to read <Gilt>a layout plan.</Gilt>
            </>
          }
          lede="The drawing is the honest document. It is also the one most buyers skip."
          cue={{ label: 'Start with the roads', href: '#roads' }}
        />

        <Sheet
          id="why"
          first
          kicker="Why the plan"
          title={
            <>
              Why the plan <Gilt>comes first.</Gilt>
            </>
          }
        >
          <Prose>
            <p className="folio-first">
              A brochure is written to persuade. A layout plan is submitted for approval, which
              means it has to be accurate.
            </p>
            <p>
              If the two disagree, the plan is the one that matters &mdash; and it is usually the
              only document a buyer is handed that shows exactly what they are getting.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="roads"
          rail="The roads"
          kicker="First"
          title={
            <>
              Start with <Gilt>the roads.</Gilt>
            </>
          }
        >
          <Prose>
            <p>
              Every internal road carries a stated width. On our Kartikeya Water Front sheet they
              read 40 ft and 30 ft; on VSR Gayatri Township, 40 ft throughout. Width decides whether two
              cars pass comfortably, whether a construction lorry can reach your plot, and how the
              layout feels once it is built out. A plot on a 40 ft road and the same plot on a 20 ft
              road are not the same asset.
            </p>
            <p>
              Check where your plot sits relative to the entrance, and how many turns it takes to
              reach. Corner plots on wider roads carry a premium for a reason, and the drawing
              shows you which they are before anyone tells you.
            </p>
          </Prose>
          <div className="mt-10">
            <Detail
              src={KARTIKEYA.src}
              w={KARTIKEYA.w}
              h={KARTIKEYA.h}
              focus={[47, 30]}
              zoom={2.3}
              ratio={16 / 10}
              alt={`Part of the Kartikeya Water Front plan: two 40 ft roads meeting, with plots of ${plotSize(30, 56)} and ${plotSize(30, 50)} either side`}
              caption="Kartikeya Water Front. The width is printed in each road. Two at 40 ft meet here, and the plots on that corner are plain to see."
            />
          </div>
        </Sheet>

        <Sheet
          id="dimensions"
          rail="The dimensions"
          raised
          kicker="Then"
          title={
            <>
              Then the <Gilt>plot dimensions.</Gilt>
            </>
          }
        >
          <Prose>
            <p>
              Plots are marked in feet &mdash; {plotSize(30, 50)}, {plotSize(30, 60)}, {plotSize(60, 30)}. The first figure is
              normally the frontage. Two plots of identical area can differ considerably in what
              you can build, because frontage and depth drive the setbacks.
            </p>
            <p>
              Where a sheet marks an irregular plot, it usually notes each edge separately:
              measure those on the ground.
            </p>
          </Prose>
          <div className="mt-10">
            <Detail
              src={KARTIKEYA.src}
              w={KARTIKEYA.w}
              h={KARTIKEYA.h}
              focus={[60, 18]}
              zoom={2.3}
              ratio={16 / 10}
              alt="Part of the Kartikeya Water Front plan: the plots along its northern boundary, each printed with its own depth"
              caption="The same sheet, along its northern boundary. The plots here follow the boundary’s line, and each has its own depth printed in it."
            />
          </div>
        </Sheet>

        <Sheet
          id="not-for-sale"
          rail="Not for sale"
          kicker="Then"
          title={
            <>
              Find the parcels that are <Gilt>not for sale.</Gilt>
            </>
          }
        >
          <Prose>
            <p>
              Approved layouts must set aside land that is not sold to anyone: open space, utility
              areas, and sometimes an amenity parcel. On the Gayatri sheet these are labelled
              Public Open Space, Utility Area and Amenity with their own plot numbers. On Kartikeya
              Water Front the same role is played by the landscaped belt and the lake frontage.
            </p>
            <p>
              These matter twice over. They are what stops the layout being built wall to wall, and
              they are a check on the seller: generous, clearly marked open space is the mark of a
              layout planned for the people who will live in it.
            </p>
          </Prose>
          <div className="mt-10">
            <Detail
              src={GAYATRI.src}
              w={GAYATRI.w}
              h={GAYATRI.h}
              focus={[20, 62]}
              zoom={2.3}
              ratio={16 / 10}
              alt="Part of the VSR Gayatri Township plan: the public open space, a utility area and two amenity plots, each labelled"
              caption="VSR Gayatri Township, as its sheet is printed (turned a quarter). The open space, a utility area and the amenity plots are each labelled as what they are."
            />
          </div>
        </Sheet>

        <Sheet
          id="boundary"
          rail="The boundary"
          raised
          kicker="Then"
          title={
            <>
              Read <Gilt>the boundary.</Gilt>
            </>
          }
        >
          <Prose>
            <p>
              The layout&rsquo;s boundary tells you what you back onto. Agricultural land, another layout and
              a highway are three very different neighbours, and the sheet names them.
            </p>
            <p>
              On our Gayatri plan the adjoining survey numbers and the village road are marked; on
              Kartikeya Water Front the approach roads to Vizianagaram, Visakhapatnam and
              Srikakulam are shown at the edge.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="marks"
          rail="The marks"
          kicker="Then"
          title={
            <>
              Read the marks, <Gilt>and ask for the key.</Gilt>
            </>
          }
        >
          <Prose>
            <p>
              A working sheet is often marked up: plots coloured, a block hatched. The marks mean
              something &mdash; a plot sold or held, a parcel reserved &mdash; and a key on the
              sheet should say which.
            </p>
            <p>
              Where a sheet carries marks and no key, ask. Two of our own are published like that:
              Lucky Garden colours some of its plots, and Gayatri hatches two blocks. The branch
              will say what each records before you choose a plot inside one.
            </p>
          </Prose>
          <div className="mt-10">
            <Detail
              src={LUCKY.src}
              w={LUCKY.w}
              h={LUCKY.h}
              focus={[64, 62]}
              zoom={2.3}
              ratio={16 / 10}
              alt="Part of the Lucky Garden plan: rows of plots, some coloured red, orange, green and blue, along roads marked as proposed at 20 ft"
              caption="Lucky Garden. Four colours and no key on the sheet as published. The roads between the rows are marked proposed, at 20 ft."
            />
          </div>
        </Sheet>

        <Window gloss="That single line is what makes everything else on the drawing enforceable.">
          Last, the authority <Gilt>and the order number.</Gilt>
        </Window>

        <Sheet
          id="approval"
          rail="The approval block"
          kicker="Last"
          title={
            <>
              Last, <Gilt>the approval block.</Gilt>
            </>
          }
        >
          <Prose>
            <p>
              Somewhere on a sanctioned sheet is the authority and the order number. Photograph it,
              and look the number up in the authority&rsquo;s own records.
            </p>
            <p>
              Our sheets are published as the drawings alone, with the approval stated on each
              layout&rsquo;s own page. Ask the branch to show you the block itself.
            </p>
            <p>
              All three of our plans are published <Link href="/gallery">at full size</Link>, and
              standing in <Link href="/hall">the hall</Link> you can read them as raised models.
              What to verify beyond the drawing is in{' '}
              <Link href="/investment-guide">the guide</Link>.
            </p>
          </Prose>
        </Sheet>

        <NextPage
          href="/knowledge"
          kicker="Back to"
          title="Knowledge"
          line="Short pieces on the parts of a purchase that are easy to get wrong."
        />
      </Folio>
    </>
  );
}
