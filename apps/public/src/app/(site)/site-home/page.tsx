// apps/public/src/app/(site)/page.tsx
import { getPublishedProjects } from '@/lib/projection';
import { ProjectCard } from '@/components/site/ProjectCard';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

// ISR: Background revalidation every hour, unless manually cleared by the webhook (T37)
export const revalidate = 3600;

export default async function SiteHomePage() {
  const projects = await getPublishedProjects();

  const availableProjects = projects.filter((p: any) => !p.isSoldOut);
  const soldOutProjects = projects.filter((p: any) => p.isSoldOut);

  return (
    <main className="max-w-7xl mx-auto px-6 py-16 md:py-24">
      <RouteTelemetry routeId="site-home" />
      <header className="mb-16 md:mb-24">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif tracking-tight text-gray-900 mb-6">
          Featured Properties
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl font-sans leading-relaxed">
          Explore our curated portfolio of premium plotted developments, commercial spaces, and luxury residences.
        </p>
      </header>

      {projects.length === 0 ? (
        <div className="py-24 text-center border border-dashed border-gray-200 rounded-sm bg-gray-50/50">
          <p className="text-gray-500 font-medium tracking-wide">No projects are currently available.</p>
          <p className="text-gray-400 text-sm mt-2">Check back soon for new inventory.</p>
        </div>
      ) : (
        <div className="space-y-24">
          {availableProjects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
              {availableProjects.map((project: any) => (
                <ProjectCard key={project.projectId} project={project} />
              ))}
            </div>
          )}

          {soldOutProjects.length > 0 && (
            <section>
              <div className="flex items-center space-x-6 mb-10">
                <h2 className="text-2xl font-serif text-gray-400">Legacy Portfolio</h2>
                <div className="flex-grow h-px bg-gray-100"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16 opacity-80">
                {soldOutProjects.map((project: any) => (
                  <ProjectCard key={project.projectId} project={project} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
