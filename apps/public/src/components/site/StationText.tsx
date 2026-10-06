// apps/public/src/components/site/StationText.tsx
//
// A station's copy inside the mansion: the project's name, where it is, and how
// many plots are open. Text only.
//
// It replaced ProjectCard in the station chapters. The card put a boxed plan
// image with badges over the hall, directly beside the hologram that already
// shows the same plan in three dimensions, and the client review asked for
// every overlay inside the mansion to go and only the text to stay.
//
// The link is kept on purpose. The canvas is aria-hidden, so for a keyboard or
// screen-reader visitor this name is the only way to reach the project from the
// hall — the hologram cannot be focused. Removing the image removed decoration;
// removing the link would remove the product.

import Link from 'next/link';
import { InferSelectModel } from 'drizzle-orm';
import { projectsPub } from '@estate/db/src/schema/projection';

type Project = InferSelectModel<typeof projectsPub>;

/**
 * `numeral` is the table's number in the collection ("II · III"). On a wide
 * frame site-home sets it as an eyebrow over a hairline above this block; on
 * any other the block stands in four short lines under the header, above the
 * plan, and the numeral closes its last line instead.
 */
export function StationText({ project, numeral }: { project: Project; numeral?: string }) {
  const place = [project.locality, project.city].filter(Boolean).join(' · ');

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="tap-target group block outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-[#E8B98A]"
    >
      <h3 className="t-d2 text-[#F2EDE4] transition-colors group-hover:text-[#E8B98A] group-focus-visible:text-[#E8B98A]">
        {project.name}
      </h3>
      {/* Full ivory (it was 90%): at the second table, which stands against
          the ivory wall, the place measured 4.23:1 on a phone held sideways
          once the hall's lamps led its light (2026-10-04). */}
      {place ? <p className="t-support mt-2 text-[#F2EDE4] wide:mt-5">{place}</p> : null}
      {/* The numeral follows the count, a gap on: set out at the line's far
          end it stood directly over the first plan's own "Open" marker on a
          phone's short frame (seen at 390x664, ten pixels apart).
          THE COUNT IN IVORY, AND IN WORDS. It was gilt, and small gilt needs a
          ground under a luma of 80; this line stands at the foot of the
          block, on the pilaster the lens has burnt in, at 72 to 89. And it
          was set in tracked capitals, a third register under the name and the
          place: with the refinement brief (2026-10-03, "tiny uppercase labels
          ... micro-metadata") it is a line of the same small text as any
          other, read as a sentence. */}
      <p className="t-body mt-1 flex items-baseline gap-8 text-[#F2EDE4] [font-variant-numeric:tabular-nums] wide:mt-2 wide:block">
        <span>
          {project.isSoldOut
            ? 'Fully sold'
            : `${project.availableUnits} of ${project.totalUnits} plots open`}
        </span>
        {numeral ? (
          <span aria-hidden className="shrink-0 text-[#E8B98A] wide:hidden">
            {numeral}
          </span>
        ) : null}
      </p>
    </Link>
  );
}
