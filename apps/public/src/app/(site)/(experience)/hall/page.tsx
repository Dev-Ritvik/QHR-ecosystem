// apps/public/src/app/(site)/(experience)/hall/page.tsx
//
// A FOLIO whose plate is the room. The world is mounted by the (experience)
// layout and is already standing here — this route contributes only the
// readable layer.
//
// Note what is absent: no <Canvas>. The scene belongs to the layout so it can
// survive navigation; mounting one here as well would create a second WebGL
// context and upload the 15MB model twice.
//
// THE ROOM IS STILL THE CONTENT: the plate is a full frame of the hall with
// its title at the foot, as it always was. What it gained on 2026-10-06 is
// what is under it — the three layouts by name with their counts, and the way
// into the film at the hall's own chapter — where it had a caption and three
// links and then the footer.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import { Folio, Gilt, Go, IndexList, NextPage, Plate, Prose, Sheet, Actions } from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { LAYOUTS } from '@/lib/layouts';
import { countLine, publishedLayouts } from '@/lib/published';

export const metadata: Metadata = withShare('/hall', {
  title: pageTitle('/hall'),
  description:
    'Three layouts raised on their own tables: Kartikeya Water Front, Lucky Garden and VSR Gayatri Township.',
});

export default async function HallPage() {
  const next = pageAfter('/hall');
  const live = await publishedLayouts();
  return (
    <>
      <RouteTelemetry routeId="hall" />
      <Folio>
        <Plate
          kicker="The presentation hall"
          title={
            <>
              Every layout <Gilt>in one room.</Gilt>
            </>
          }
          lede="Each layout stands on its own table, raised from its sanctioned plan."
          cue={{ label: 'On the tables', href: '#tables' }}
        />

        <Sheet
          id="tables"
          rail="On the tables"
          first
          kicker="On the tables"
          title={
            <>
              One table <Gilt>a layout.</Gilt>
            </>
          }
          note="Open one to read its plan, its sizes and its approval."
        >
          <IndexList
            items={LAYOUTS.map((l) => ({
              href: `/projects/${l.slug}`,
              name: l.name,
              line: (
                <>
                  {l.where}, {l.district} district
                </>
              ),
              meta: countLine(live.find((p) => p.slug === l.slug)),
            }))}
          />
        </Sheet>

        <Sheet
          id="walk"
          rail="Walk it"
          raised
          kicker="Walk it"
          title={
            <>
              The film goes <Gilt>round the room.</Gilt>
            </>
          }
        >
          <Prose>
            <p className="folio-first">
              In the film the camera comes in at the door, crosses to each table in turn, climbs to
              the portrait above the stair and ends over the map of the two districts.
            </p>
            <p>
              At a table you can turn the model to read it from another side, and open it to see
              the whole layout. The dots at the edge of the film take you straight to any table.
            </p>
          </Prose>
          <Actions>
            <Go href="/#establish">Enter by the door</Go>
            <Go href="/gallery">The plans, flat</Go>
          </Actions>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
