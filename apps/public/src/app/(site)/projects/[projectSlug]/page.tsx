// apps/public/src/app/(site)/projects/[projectSlug]/page.tsx
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
    <main className="min-h-screen py-12">
      <RouteTelemetry routeId="project-detail" />
      <div className="container mx-auto px-4 space-y-16">
        
        {/* Header & Narrative */}
        <section className="space-y-6">
          <h1 className="text-4xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-xl text-gray-600">{project.locality}, {project.city}</p>
          
          {Array.isArray(project.badges) && project.badges.length > 0 ? (
            <ApprovalBadges badges={project.badges as any[]} />
          ) : null}

          <div className="prose max-w-3xl mt-8">
            {project.narrative ? (
              <p className="text-lg leading-relaxed text-gray-700">{project.narrative}</p>
            ) : (
              <EmptyStates type="narrative" />
            )}
          </div>
        </section>

        {/* Gallery */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Gallery</h2>
          {galleryMedia.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {galleryMedia.map((m: any) => (
                <div key={m.id} className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                  <Image 
                    src={(m.variants as any)?.web?.url || ''} 
                    alt={m.altText}
                    fill
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
          <h2 className="text-2xl font-bold text-gray-900">Master Plan</h2>
          <div className="h-[600px] w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
            {geometry && geometry.length > 0 ? (
              <ProjectMap project={project} units={units} geometry={geometry} pois={pois} />
            ) : (
              <EmptyStates type="map" />
            )}
          </div>
        </section>

        {/* Amenities Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Amenities</h2>
          {Array.isArray(project.amenities) && project.amenities.length > 0 ? (
            <ul className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(project.amenities as any[]).map((amenity, i) => (
                <li key={i} className="bg-gray-50 border border-gray-100 p-4 rounded-lg flex items-center gap-3 font-medium text-gray-800">
                  <span>{amenity.label}</span>
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
