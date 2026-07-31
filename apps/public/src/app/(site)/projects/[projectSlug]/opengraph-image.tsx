import { ImageResponse } from 'next/og';
import { db } from '@/lib/projection';
import { projectsPub } from '@estate/db/src/schema/projection';
import { eq } from 'drizzle-orm';

// Must stay on the Node runtime: this route reads the projection through the
// `postgres` driver, which needs `stream` and `perf_hooks`. Those do not exist
// on Edge, so 'edge' here failed the production build outright. next/og's
// ImageResponse is supported on both runtimes, so Node costs us nothing.
export const runtime = 'nodejs';
export const alt = 'Project Preview';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { projectSlug: string } }) {
  const [project] = await db
    .select()
    .from(projectsPub)
    .where(eq(projectsPub.slug, params.projectSlug))
    .limit(1);

  if (!project) {
    return new ImageResponse(
      (
        <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#0a0a0a', color: 'white', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
          ESTATE
        </div>
      ), { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: '#FAFAFA', // neutral-50
          padding: '64px',
          fontFamily: 'sans-serif',
          justifyContent: 'space-between',
          borderTop: '16px solid #171717', // neutral-900
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 24, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#525252', marginBottom: '16px' }}>
            {project.assetClass.replace('_', ' ')}
          </div>
          <div style={{ display: 'flex', fontSize: 80, fontWeight: 700, color: '#171717', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '24px' }}>
            {project.name}
          </div>
          <div style={{ display: 'flex', fontSize: 36, color: '#404040' }}>
            {project.locality}, {project.city}
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 48, fontWeight: 600, color: '#171717' }}>
              {project.availableUnits}
            </div>
            <div style={{ display: 'flex', fontSize: 24, color: '#525252' }}>
              Available Units
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: '#171717', letterSpacing: '0.05em' }}>
            ESTATE
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
