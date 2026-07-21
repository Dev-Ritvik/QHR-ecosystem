// apps/crm/src/app/(app)/projects/[projectId]/page.tsx
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { coreSchema as schema } from '@estate/db';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { ProjectGallery } from '@/components/projects/ProjectGallery';
import { ProjectNav } from '@/components/projects/ProjectNav';
import { PublishChecklist } from '@/components/publish/PublishChecklist';
import Link from 'next/link';

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const context = await getRoleContext();
  if (!context) redirect('/login');

  const project = await authedQuery(context, async (tx: any) => {
    return tx.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });
  });

  if (!project || project.archivedAt) notFound();

  // Fetch media for the gallery
  const projectMedia = await authedQuery(context, async (tx: any) => {
    return tx.query.media.findMany({
      where: eq(schema.media.projectId, projectId),
      orderBy: schema.media.sortOrder,
    });
  });

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <Link href="/projects" className="text-sm font-medium text-gray-500 hover:text-gray-900">
            &larr; Back to Projects
          </Link>
          <h1 className="text-2xl font-bold">{project.name}</h1>
        </div>
        <div className="text-sm text-gray-500">
          Publish status: {project.publishedAt ? "Published" : "Draft"}
        </div>
      </div>

      <ProjectNav projectId={project.id} />

      <div className="mb-8">
        <PublishChecklist projectId={project.id} isPublished={!!project.publishedAt} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">Project Details</h2>
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <ProjectForm projectId={project.id} initialData={project as any} />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Media & Gallery</h2>
            <ProjectGallery projectId={project.id} initialMedia={projectMedia} />
          </section>
        </div>
      </div>
    </div>
  );
}
