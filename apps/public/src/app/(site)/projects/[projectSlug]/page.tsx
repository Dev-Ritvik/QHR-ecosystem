// apps/public/src/app/(site)/projects/[projectSlug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { 
  getProjectBySlug, 
  getUnitsByProjectId, 
  getGeometryByProjectId,
  getMediaByProjectId,
  getPoisByProjectId
} from '@/lib/projection';
import { ApprovalBadges } from '@/components/site/ApprovalBadges';
import { EmptyStates } from '@/components/site/EmptyStates';
import { ProjectMap } from '@/components/map/ProjectMap';
import { LocationSection } from '@/components/site/LocationSection';
import Image from 'next/image';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

/**
 * The project page had no metadata at all, so every one of these — the most
 * shared and most searched pages on the site — served Next's fallback title.
 *
 * Everything below is read from the projection. Nothing is composed, padded or
 * invented: the description is the project's own narrative when it has one, and
 * falls back to its locality when it does not, because a made-up sentence about
 * a real development is exactly the class of claim this project must not make.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}): Promise<Metadata> {
  const { projectSlug } = await params;
  const project = await getProjectBySlug(projectSlug).catch(() => null);
  if (!project) return { title: 'Project not found — Quality Homes Reality' };

  const where = [project.locality, project.city].filter(Boolean).join(', ');
  const title = where
    ? `${project.name} — ${where} | Quality Homes Reality`
    : `${project.name} | Quality Homes Reality`;

  const description =
    (typeof project.narrative === 'string' && project.narrative.trim()) ||
    (where ? `${project.name}, an approved plotted development at ${where}.` : undefined);

  return { title, description };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const project = await getProjectBySlug(projectSlug);

  if (!project) {
    notFound();
  }

  const [units, geometry, media, pois] = await Promise.all([
    getUnitsByProjectId(project.projectId),
    getGeometryByProjectId(project.projectId),
    getMediaByProjectId(project.projectId),
    getPoisByProjectId(project.projectId),
  ]);

  const galleryMedia = media.filter((m: any) => m.kind === 'gallery');

  return (
    // This page was still in the light theme the whole site started in —
    // text-gray-900 on bg-white, generic font-bold headings — while every other
    // route had moved to #0A1120 / #F2EDE4 and the fluid type scale in
    // globals.css. On the most commercially important route in the build, that
    // read as a different website. Same sections, same data, same components;
    // the design system that already exists, applied.
    <main className="min-h-screen pb-24 pt-12">
      <RouteTelemetry routeId="project-detail" />
      <div className="mx-auto max-w-6xl space-y-20 px-6">
        {/* Header & Narrative */}
        <section>
          <p className="t-eyebrow text-[#F2EDE4]/50">
            {project.locality}
            {project.city ? `, ${project.city}` : ''}
          </p>
          <h1 className="t-h1 mt-4 max-w-3xl text-[#F2EDE4]">{project.name}</h1>

          {Array.isArray(project.badges) && project.badges.length > 0 ? (
            <ApprovalBadges badges={project.badges as any[]} />
          ) : null}

          <div className="mt-10 max-w-3xl">
            {project.narrative ? (
              <p className="t-lede text-[#F2EDE4]/70">{project.narrative}</p>
            ) : (
              <EmptyStates type="narrative" />
            )}
          </div>
        </section>

        {/* Gallery */}
        <section>
          <h2 className="t-h2 mb-8 text-[#F2EDE4]">Gallery</h2>
          {galleryMedia.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {galleryMedia.map((m: any) => (
                <div
                  key={m.id}
                  className="relative aspect-video overflow-hidden rounded-sm bg-white/[0.03] ring-1 ring-white/[0.07]"
                >
                  <Image
                    src={(m.variants as any)?.web?.url || ''}
                    alt={m.altText}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyStates type="gallery" />
          )}
        </section>

        {/* Map Section */}
        <section className="space-y-6">
          <h2 className="t-h2 text-[#F2EDE4]">Master plan</h2>
          <div className="h-[600px] w-full overflow-hidden rounded-sm border border-white/10 bg-white/[0.02]">
            {geometry && geometry.length > 0 ? (
              <ProjectMap project={project} units={units} geometry={geometry} pois={pois} />
            ) : (
              <EmptyStates type="map" />
            )}
          </div>
        </section>

        {/* Amenities Section */}
        <section>
          <h2 className="t-h2 mb-8 text-[#F2EDE4]">Amenities</h2>
          {Array.isArray(project.amenities) && project.amenities.length > 0 ? (
            // Ruled rather than boxed. Amenity labels are short, and four cards
            // of chrome around four words is more furniture than information.
            <ul className="grid grid-cols-2 gap-x-8 border-t border-white/10 md:grid-cols-4">
              {(project.amenities as any[]).map((amenity, i) => (
                <li
                  key={i}
                  className="border-b border-white/10 py-4 text-[15px] text-[#F2EDE4]/80"
                >
                  {amenity.label}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyStates type="amenities" />
          )}
        </section>

        {/* Location & Connectivity */}
        <LocationSection pois={pois} projectCentroid={project.centroid} />

      </div>
    </main>
  );
}
