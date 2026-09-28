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
import { Arrow } from './Arrow';
import { InferSelectModel } from 'drizzle-orm';
import { projectsPub } from '@estate/db/src/schema/projection';

type Project = InferSelectModel<typeof projectsPub>;

export function StationText({ project }: { project: Project }) {
  const place = [project.locality, project.city].filter(Boolean).join(' · ');

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="tap-target group block outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-[#E8B98A]"
    >
      <h3 className="t-h2 text-[#F2EDE4] transition-colors group-hover:text-[#E8B98A] group-focus-visible:text-[#E8B98A]">
        {project.name}
      </h3>
      {place ? <p className="t-body mt-4 text-[#F2EDE4]/65">{place}</p> : null}
      <p className="t-eyebrow mt-8 text-[#E8B98A]/90 [font-variant-numeric:tabular-nums]">
        {project.isSoldOut
          ? 'Fully sold'
          : `${project.availableUnits} of ${project.totalUnits} plots open`}
        <Arrow className="ml-3 inline-block align-middle" />
      </p>
    </Link>
  );
}
