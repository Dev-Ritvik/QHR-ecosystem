import { getProjects } from '@/lib/projection';
import { ProjectGrid } from '@/components/present/ProjectGrid';

export const dynamic = 'force-dynamic';

export default async function PresentationHomePage() {
  // Read entirely from the projection schema. No access to core CRM data (FR-PM8).
  const projects = await getProjects();
  
  return <ProjectGrid projects={projects} />;
}
