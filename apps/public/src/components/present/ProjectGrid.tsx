// apps/public/src/components/present/ProjectGrid.tsx
'use client';

import { useEffect, useState } from 'react';
import { ProjectCard } from './ProjectCard';
import { probeCapabilities, CapabilityTier } from '@/lib/capability-probe';
import { prefetchProjectBundle } from '@/lib/prefetch';

interface ProjectGridProps {
  projects: any[]; // Inferred from projects_pub
}

export function ProjectGrid({ projects }: ProjectGridProps) {
  const [tier, setTier] = useState<CapabilityTier>('medium');

  useEffect(() => {
    // Run hardware probe on mount to dictate fetch heaviness (FR-PM3, §4.4)
    probeCapabilities().then((caps) => setTier(caps.tier));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (document.activeElement === document.body) {
          const firstCard = document.querySelector('[tabindex="0"]') as HTMLElement;
          if (firstCard) {
            firstCard.focus();
            e.preventDefault();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFocus = (project: any) => {
    // Spatial nav triggers focus before click -> pre-warms the cache (FR-PM2)
    prefetchProjectBundle(project, tier);
  };

  return (
    <main className="w-full h-full p-16 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="max-w-7xl mx-auto h-full flex flex-col justify-center min-h-full">
        <h1 className="text-5xl font-bold text-white mb-16 tracking-tight">
          Select Project
        </h1>
        
        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {projects.map((project) => (
              <ProjectCard 
                key={project.projectId} 
                project={project} 
                onFocus={handleFocus}
              />
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-2xl font-medium">
            No projects available for presentation.
          </div>
        )}
      </div>
    </main>
  );
}
