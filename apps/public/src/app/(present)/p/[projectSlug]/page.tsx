import { notFound } from 'next/navigation';
import { getProjectBySlug, getUnitsByProjectId, getGeometryByProjectId, getPoisByProjectId } from '@/lib/projection';
import { PresentationClient } from './PresentationClient';
import { cookies } from 'next/headers';
import { verifyDeviceToken } from '@/lib/device-token';

export const dynamic = 'force-dynamic';

export default async function ProjectPresentationPage({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const project = await getProjectBySlug(projectSlug);
  
  if (!project) notFound();

  const [units, geometry, pois] = await Promise.all([
    getUnitsByProjectId(project.projectId),
    getGeometryByProjectId(project.projectId),
    getPoisByProjectId(project.projectId),
  ]);

  // FR-PM12: Check if this device holds a valid, unrevoked token for unlocking owner prices
  const cookieStore = await cookies();
  const token = cookieStore.get('device_token')?.value;
  const isPricingUnlocked = await verifyDeviceToken(token);

  return (
    <PresentationClient 
      project={project} 
      units={units} 
      geometry={geometry} 
      pois={pois} 
      isPricingUnlocked={isPricingUnlocked}
    />
  );
}
